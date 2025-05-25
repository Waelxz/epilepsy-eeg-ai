from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
import logging
from ..utils.google_oauth import GoogleOAuth
from ..utils.oauth_config import OAUTH_STATE_KEY, USER_TOKENS_KEY
from ..utils.security import get_current_user_from_request
import os

# Configure module logger
logger = logging.getLogger(__name__)

# Create router instance
router = APIRouter(tags=["Google Auth"])

@router.get("/auth/google/login")
async def google_login(request: Request):
    """Initiate Google OAuth login"""
    try:
        result = GoogleOAuth.generate_oauth_url(request)
        return result
    except Exception as e:
        logger.error(f"Error generating Google auth URL: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to initiate Google login")

@router.get("/auth/google/callback")
async def google_callback(request: Request, code: str = None, state: str = None, error: str = None):
    """Handle Google OAuth callback"""
    # Check for errors in the callback
    if error:
        logger.error(f"Google OAuth error: {error}")
        return {"error": "Google authentication failed", "details": error}
    
    # Debug session contents
    logger.info(f"Session contents: {request.session}")
    logger.info(f"Received state: {state}")
    
    # Exchange code for tokens
    try:
        tokens = await GoogleOAuth.exchange_code_for_tokens(code)
        
        # Get user info to verify email
        user_info = await GoogleOAuth.get_user_info(tokens["access_token"])
        
        # Store tokens in session
        request.session[USER_TOKENS_KEY] = {
            "access_token": tokens["access_token"],
            "refresh_token": tokens.get("refresh_token"),
            "expiry": tokens["expires_in"],
            "email": user_info.get("email")
        }
        
        # Extra debug for session
        logger.info(f"Updated session with tokens for {user_info.get('email')}")

        # We need to manually check for pending share in session and handle it
        pending_share = None
        session_keys = list(request.session.keys())
        logger.info(f"Session keys after authentication: {session_keys}")
        
        # Look for pending_share in session
        if "pending_share" in session_keys:
            pending_share = request.session["pending_share"]
            logger.info(f"Found pending share operation to {pending_share.get('recipient_email')}")
            logger.info(f"Report path: {pending_share.get('report_path')}")
            logger.info(f"Full pending share data: {pending_share}")
        else:
            # Try to use a fallback hard-coded share for testing
            logger.warning("No pending_share found in session. Using fallback for testing.")
            # Use the last email that was authenticated with
            fallback_recipient = "your-email@example.com"
            
            # Look for report files in the reports directory
            reports_dir = os.path.join(os.getcwd(), "uploads", "reports")
            report_files = []
            
            for root, dirs, files in os.walk(reports_dir):
                for file in files:
                    if file.endswith(".pdf"):
                        report_files.append(os.path.join(root, file))
            
            if report_files:
                # Use the most recently modified file
                latest_file = max(report_files, key=os.path.getmtime)
                logger.info(f"Using fallback report file: {latest_file}")
                
                pending_share = {
                    "recipient_email": fallback_recipient,
                    "email_subject": "Epilepsy Application: Report Shared",
                    "email_message": """
                    <!DOCTYPE html>
                    <html>
                    <body>
                        <p>Hello,</p>
                        <p>A report has been shared with you.</p>
                        <p>Best regards,<br>Epilepsy Application Team</p>
                    </body>
                    </html>
                    """,
                    "report_path": latest_file
                }
            else:
                logger.error("No report files found for fallback")
        
        if pending_share:
            logger.info(f"Attempting to send email using Gmail API")
            
            recipient_email = pending_share.get('recipient_email')
            if not recipient_email:
                logger.error("Missing recipient email in pending share")
                return RedirectResponse(
                    url="/doctor/reports?oauth_success=true&email_sent=false&error=missing_recipient",
                    status_code=307
                )
            
            # Attempt to send the email now with the tokens
            email_sent = await GoogleOAuth.send_email_with_gmail(
                access_token=tokens["access_token"],
                to=recipient_email,
                subject=pending_share.get("email_subject", "Epilepsy Application Report"),
                message_html=pending_share.get("email_message", "<p>Report shared</p>"),
                attachment_path=pending_share.get("report_path")
            )
            
            # Clean up the pending share from session
            if "pending_share" in request.session:
                del request.session["pending_share"]
            
            if email_sent:
                logger.info(f"Successfully sent pending email to {recipient_email}")
               
            else:
                logger.error(f"Failed to send pending email to {recipient_email}")
              
        else:
            logger.warning("No pending share found in session after OAuth")
        
        # If no pending share, just redirect back to reports
        return RedirectResponse(
            url="/doctor/reports?oauth_success=true&email=" + 
            user_info.get("email", "") + 
            "&action=share_report",
            status_code=307
        )
    
    except Exception as e:
        logger.error(f"Error processing OAuth callback: {str(e)}")
        logger.exception("Full traceback:")
        return RedirectResponse(
            url="/doctor/reports?error=oauth_failed&message=" + str(e),
            status_code=307
        )

@router.get("/auth/google/status", response_model=dict)
async def google_auth_status(request: Request):
    """Check if the user is authenticated with Google"""
    tokens = request.session.get(USER_TOKENS_KEY)
    if tokens and tokens.get("access_token"):
        return {
            "authenticated": True,
            "email": tokens.get("email"),
            "has_refresh_token": bool(tokens.get("refresh_token"))
        }
    return {"authenticated": False}

@router.post("/auth/google/logout")
async def google_logout(request: Request):
    """Remove Google authentication tokens"""
    if USER_TOKENS_KEY in request.session:
        del request.session[USER_TOKENS_KEY]
    return {"status": "success", "message": "Logged out from Google"}

@router.get("/auth/google/refresh")
async def refresh_google_token(request: Request):
    """Refresh the Google access token"""
    tokens = request.session.get(USER_TOKENS_KEY)
    if not tokens or not tokens.get("refresh_token"):
        raise HTTPException(status_code=401, detail="No refresh token available")
    
    try:
        new_tokens = await GoogleOAuth.refresh_access_token(tokens["refresh_token"])
        
        # Update tokens in session
        tokens["access_token"] = new_tokens["access_token"]
        tokens["expiry"] = new_tokens["expires_in"]
        request.session[USER_TOKENS_KEY] = tokens
        
        return {"status": "success", "message": "Token refreshed successfully"}
    except Exception as e:
        logger.error(f"Error refreshing token: {str(e)}")
        # Clear invalid tokens
        if USER_TOKENS_KEY in request.session:
            del request.session[USER_TOKENS_KEY]
        raise HTTPException(status_code=401, detail="Failed to refresh token") 