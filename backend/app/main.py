from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.sessions import SessionMiddleware
# from .utils.session_middleware import PersistentSessionMiddleware
from .routes.auth import router as auth_router
from .routes.users import router as users_router
from .routes.logs import router as logs_router
from .routes.models import router as models_router
from .routes.patients import router as patients_router
from .routes.analyses import router as analyses_router
from .routes.reports import router as reports_router
from .routes.google_auth import router as google_auth_router
import logging
import os
import time
from datetime import datetime
from dotenv import load_dotenv
from bson import ObjectId
from fastapi.encoders import jsonable_encoder
import json
import sys
import uvicorn

# Add parent directory to sys.path for model imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import model loader to check model availability
from models.model_loader import model_loader

# Load environment variables
load_dotenv()

# Configure enhanced logging
log_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "logs")
os.makedirs(log_dir, exist_ok=True)
log_file = os.path.join(log_dir, f"app_{datetime.now().strftime('%Y%m%d')}.log")

# Configure root logger
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_file),
        logging.StreamHandler(sys.stdout)  # Explicitly log to console
    ]
)

# Get logger for this module
logger = logging.getLogger(__name__)
logger.info(f"Starting application with logs in: {log_file}")

# Ensure all loggers (including libraries) output at least INFO level
for log_name, log_obj in logging.Logger.manager.loggerDict.items():
    if isinstance(log_obj, logging.Logger):
        log_obj.setLevel(logging.INFO)

# Store server start time
SERVER_START_TIME = datetime.now().isoformat()

# Custom JSON encoder class to handle MongoDB ObjectIds
class MongoJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        return super().default(obj)

# Custom JSONResponse that uses our encoder
class CustomJSONResponse(JSONResponse):
    def render(self, content) -> bytes:
        return json.dumps(
            content,
            ensure_ascii=False,
            allow_nan=False,
            indent=None,
            separators=(",", ":"),
            cls=MongoJSONEncoder,
        ).encode("utf-8")

# Security Headers Middleware
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Add security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' http://localhost:8000; font-src 'self'"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        
        return response

app = FastAPI(
    title="Epilepsy Detection API",
    description="API for managing patients, EEG analyses, and reports",
    version="1.0.0",
    default_response_class=CustomJSONResponse
)

# Configure CORS
origins = [
    "http://localhost",
    "http://localhost:4200",
    "http://localhost:8000",
    "http://localhost:3000",
    "http://127.0.0.1:4200",
    "http://127.0.0.1:8000",
    "http://127.0.0.1:3000",
]

# Add CORS middleware with more explicit settings
# Add this BEFORE other middleware to ensure it can catch errors
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "Content-Type", "Content-Length"],
    max_age=86400  # 24 hours in seconds
)

# Add session middleware for OAuth state and token storage
app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("SESSION_SECRET_KEY", "change-me-in-env"),
    max_age=14 * 24 * 60 * 60,  # 14 days for better persistence
    same_site="lax",  # Use lax which allows cookies in redirects
    https_only=False,  # Only use true with HTTPS
    session_cookie="epilepsy_session"
)

# Add debug endpoint for session testing
@app.get("/api/debug/session")
async def debug_session(request: Request):
    """Debug endpoint to verify session functionality"""
    # Set a test value in session
    if "test_value" not in request.session:
        request.session["test_value"] = f"Session test {datetime.now().isoformat()}"
    
    # Return all session values
    return {
        "session_data": dict(request.session),
        "cookie_header": request.headers.get("cookie")
    }

# Add security headers middleware
app.add_middleware(SecurityHeadersMiddleware)

# Add logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"Request path: {request.url.path}")
    logger.info(f"Request method: {request.method}")
    logger.info(f"Request headers: {request.headers.get('authorization', '').startswith('Bearer ')}")
    
    response = await call_next(request)
    
    logger.info(f"Response status code: {response.status_code}")
    return response

# Include routers with API prefix
app.include_router(auth_router, prefix="/api")
app.include_router(users_router, prefix="/api")
app.include_router(logs_router, prefix="/api")
app.include_router(models_router, prefix="/api")
app.include_router(patients_router, prefix="/api")
app.include_router(analyses_router, prefix="/api")
app.include_router(reports_router, prefix="/api")
app.include_router(google_auth_router, prefix="/api")

@app.on_event("startup")
async def startup_event():
    """Check that required models are available on startup"""
    logger.info("Checking model availability...")
    
    # Verify CNN-BERN model exists and can be loaded
    model_exists = os.path.exists(model_loader.model_path)
    if not model_exists:
        logger.error(f"Critical: Model file not found at {model_loader.model_path}")
        logger.error("The application may not function correctly without the model file")
    else:
        logger.info(f"Model file found at {model_loader.model_path}")
        
        # Try to load the model to verify it's valid
        try:
            model_loader.load_model()
            if model_loader.loaded:
                logger.info("Model loaded successfully for validation")
                # Release resources
                model_loader.clear_model()
            else:
                logger.error("Model file exists but could not be loaded")
        except Exception as e:
            logger.error(f"Error loading model for validation: {str(e)}")

@app.get("/", tags=["Root"])
def read_root():
    return {"message": "Welcome to the Epilepsy Detection API"}

@app.get("/api/health")
async def health_check():
    """Health check endpoint that returns server status and uptime information"""
    return {
        "status": "ok",
        "server_time": datetime.now().isoformat(),
        "start_time": SERVER_START_TIME,
        "uptime_seconds": (datetime.now() - datetime.fromisoformat(SERVER_START_TIME)).total_seconds()
    }

# Add redirect endpoint for frontend routes
@app.get("/doctor/{path:path}", include_in_schema=False)
async def frontend_redirect(path: str):
    """Redirect to frontend for SPA routes"""
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:4200")
    return RedirectResponse(url=f"{frontend_url}/doctor/{path}")

# Exception handler for global errors
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logging.error(f"Unhandled exception: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={"message": "An unexpected error occurred", "detail": str(exc)}
    )

# Run the app if executed directly
if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)