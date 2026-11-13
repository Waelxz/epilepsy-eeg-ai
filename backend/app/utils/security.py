from jose import jwt, JWTError
from datetime import datetime, timedelta
from dotenv import load_dotenv
import os
import bcrypt
from typing import Optional, Dict, Any, List
from .key_generator import generate_secure_key
from .database import users_collection
from fastapi import HTTPException, status, Request, Depends
from bson import ObjectId
from ..models.permissions import PermissionGroup, PERMISSION_GROUP_MAP

load_dotenv()

# Generate secure keys if not present in environment
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY") or generate_secure_key()
JWT_REFRESH_SECRET_KEY = os.getenv("JWT_REFRESH_SECRET_KEY") or generate_secure_key()
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
JWT_REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("JWT_REFRESH_TOKEN_EXPIRE_DAYS", "7"))

# Token blacklist with expiry times to automatically clean up
token_blacklist = {}

def hash_password(password: str) -> str:
    """Hash a password using bcrypt with a salt."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

def create_access_token(data: dict) -> str:
    """Create a new JWT access token."""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({
        "exp": expire,
        "type": "access"
    })
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

def create_refresh_token(data: dict) -> str:
    """Create a new JWT refresh token."""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({
        "exp": expire,
        "type": "refresh"
    })
    return jwt.encode(to_encode, JWT_REFRESH_SECRET_KEY, algorithm=JWT_ALGORITHM)

def decode_token(token: str, is_refresh: bool = False) -> Dict[str, Any]:
    """Decode and verify a JWT token."""
    try:
        secret_key = JWT_REFRESH_SECRET_KEY if is_refresh else JWT_SECRET_KEY
        payload = jwt.decode(token, secret_key, algorithms=[JWT_ALGORITHM])
        
        # Check if token is blacklisted
        if token in token_blacklist:
            raise JWTError("Token has been revoked")
            
        return payload
    except JWTError as e:
        raise JWTError(f"Could not validate credentials: {str(e)}")

def revoke_token(token: str) -> None:
    """Add a token to the blacklist with expiration time."""
    try:
        # Parse the token to get its expiration
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM], options={"verify_signature": False})
        expiry = datetime.fromtimestamp(payload["exp"])
        
        # Store token with its expiry time
        token_blacklist[token] = expiry
        
        # Clean up old tokens
        clean_expired_tokens()
    except JWTError:
        # If we can't decode the token, add it anyway with a default expiry
        token_blacklist[token] = datetime.utcnow() + timedelta(days=JWT_REFRESH_TOKEN_EXPIRE_DAYS)

def clean_expired_tokens() -> None:
    """Clean up expired tokens from the blacklist."""
    current_time = datetime.utcnow()
    expired_tokens = [
        token for token, expiry in token_blacklist.items()
        if expiry < current_time
    ]
    
    for token in expired_tokens:
        token_blacklist.pop(token, None)

def extract_token_from_request(request: Request) -> Optional[str]:
    """
    Extract JWT token from either query parameters or Authorization header
    
    Args:
        request: FastAPI request object
        
    Returns:
        str: Extracted token or None
    """
    # First try to get from query parameters
    token = request.query_params.get('token')
    if token:
        print(f"DEBUG: Found token in query parameters: {token[:10]}...")
        return token
        
    # Then try to get from Authorization header
    auth_header = request.headers.get('Authorization')
    if auth_header:
        # Check for Bearer prefix
        parts = auth_header.split()
        if len(parts) == 2 and parts[0].lower() == 'bearer':
            print(f"DEBUG: Found token in Authorization header: {parts[1][:10]}...")
            return parts[1]
            
    return None

async def get_current_user_from_request(request: Request) -> dict:
    """
    Get current user from the request (either query params or header)
    
    Args:
        request: FastAPI request object
        
    Returns:
        dict: User data from database
        
    Raises:
        HTTPException: If token is invalid or user not found
    """
    token = extract_token_from_request(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return await get_current_user(token)

async def get_current_user(token: str) -> dict:
    """
    Get current user from token
    
    Args:
        token: JWT token
        
    Returns:
        dict: User data from database
        
    Raises:
        HTTPException: If token is invalid or user not found
    """
    try:
        # Ensure token is a string before decoding
        if not isinstance(token, str):
            token = str(token)
            
        # Decode the token
        payload = decode_token(token)
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Find user in database
    try:
        user = users_collection.find_one({"_id": ObjectId(user_id)})
    except:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user ID in token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Inactive user",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return user

async def check_permission(user: dict, required_permission: str) -> bool:
    """
    Check if a user has a specific permission group
    
    Args:
        user: User dictionary from database
        required_permission: Permission group to check
        
    Returns:
        bool: True if user has permission, False otherwise
    """
    # Admins have all permissions
    if user.get("role") == "admin":
        return True
        
    # Get user permission groups
    permission_groups = user.get("permission_groups", [])
    
    # Check if the user has the specific permission group
    return required_permission in permission_groups
    
async def require_permission(user: dict, required_permission: str):
    """
    Verify user has the required permission group or raise HTTP exception
    
    Args:
        user: User dictionary from database
        required_permission: Permission group to check
        
    Raises:
        HTTPException: If user doesn't have the required permission
    """
    has_permission = await check_permission(user, required_permission)
    
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You don't have access to the required features: {required_permission}"
        )

# For backward compatibility - these functions are deprecated
# Use check_permission and require_permission instead
async def check_permission_group(user: dict, group: str) -> bool:
    return await check_permission(user, group)

async def require_permission_group(user: dict, group: str):
    await require_permission(user, group)

async def get_current_user_from_token(token: str) -> dict:
    """
    Get current user directly from provided token
    
    Args:
        token: JWT token string
        
    Returns:
        dict: User data from database
        
    Raises:
        HTTPException: If token is invalid or user not found
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return await get_current_user(token)