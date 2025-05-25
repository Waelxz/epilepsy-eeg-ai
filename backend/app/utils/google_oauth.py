import logging
import secrets
import base64
import json
from urllib.parse import urlencode
import httpx
from fastapi import HTTPException, Request
from .oauth_config import (
    GOOGLE_CLIENT_ID, 
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
    GMAIL_SCOPES,
    OAUTH_STATE_KEY
)

logger = logging.getLogger(__name__)

class GoogleOAuth:
    @staticmethod
    def generate_oauth_url(request: Request) -> dict:
        """Generate Google OAuth URL for redirecting the user"""
        if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
            logger.error("Google OAuth credentials not configured")
            raise HTTPException(status_code=500, detail="OAuth not configured")
        
        # Generate state token to prevent CSRF
        # For simplicity, we're not verifying it for now
        state = secrets.token_urlsafe(32)
        
        # Build authorization URL
        auth_params = {
            "client_id": GOOGLE_CLIENT_ID,
            "redirect_uri": GOOGLE_REDIRECT_URI,
            "response_type": "code",
            "scope": " ".join(GMAIL_SCOPES),
            "state": state,
            "access_type": "offline",
            "prompt": "consent"  # Force to get refresh token
        }
        
        auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(auth_params)}"
        return {"auth_url": auth_url}
    
    @staticmethod
    async def exchange_code_for_tokens(code: str) -> dict:
        """Exchange authorization code for access and refresh tokens"""
        try:
            token_url = "https://oauth2.googleapis.com/token"
            token_data = {
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": GOOGLE_REDIRECT_URI
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(token_url, data=token_data)
                response.raise_for_status()
                tokens = response.json()
                
                if "access_token" not in tokens:
                    logger.error("Access token not found in OAuth response")
                    raise HTTPException(status_code=400, detail="Invalid OAuth code")
                
                return tokens
        except httpx.HTTPStatusError as e:
            logger.error(f"Error exchanging code for tokens: {str(e)}")
            raise HTTPException(status_code=400, detail="Failed to authenticate with Google")
        except Exception as e:
            logger.error(f"Unexpected error during token exchange: {str(e)}")
            raise HTTPException(status_code=500, detail="Authentication error")
    
    @staticmethod
    async def get_user_info(access_token: str) -> dict:
        """Get user information from Google API"""
        try:
            user_info_url = "https://www.googleapis.com/oauth2/v2/userinfo"
            headers = {"Authorization": f"Bearer {access_token}"}
            
            async with httpx.AsyncClient() as client:
                response = await client.get(user_info_url, headers=headers)
                response.raise_for_status()
                user_info = response.json()
                
                return user_info
        except Exception as e:
            logger.error(f"Error fetching user info: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to get user information")
    
    @staticmethod
    async def send_email_with_gmail(access_token: str, to: str, subject: str, message_html: str, attachment_path: str = None) -> bool:
        """Send email using Gmail API with the user's access token"""
        try:
            # Create email message
            from email.mime.multipart import MIMEMultipart
            from email.mime.text import MIMEText
            from email.mime.application import MIMEApplication
            import os
            
            message = MIMEMultipart()
            message["To"] = to
            message["Subject"] = subject
            # Add From field (will be replaced by Gmail with user's email)
            message["From"] = "me" 
            
            # Add HTML body
            message.attach(MIMEText(message_html, "html"))
            
            # Add attachment if provided
            if attachment_path and os.path.exists(attachment_path):
                try:
                    # Log file info
                    file_size = os.path.getsize(attachment_path)
                    logger.info(f"Adding attachment: {attachment_path}, size: {file_size} bytes")
                    
                    with open(attachment_path, "rb") as attachment:
                        part = MIMEApplication(attachment.read(), Name=os.path.basename(attachment_path))
                    
                    part["Content-Disposition"] = f'attachment; filename="{os.path.basename(attachment_path)}"'
                    message.attach(part)
                    logger.info(f"Successfully attached file: {attachment_path}")
                except Exception as attach_err:
                    logger.error(f"Error attaching file {attachment_path}: {str(attach_err)}")
                    logger.error(f"File exists: {os.path.exists(attachment_path)}")
                    logger.error(f"File size: {os.path.getsize(attachment_path) if os.path.exists(attachment_path) else 'N/A'}")
                    logger.error(f"File readable: {os.access(attachment_path, os.R_OK) if os.path.exists(attachment_path) else 'N/A'}")
            else:
                logger.warning(f"Attachment not found or not specified: {attachment_path}")
                if attachment_path:
                    logger.warning(f"File path exists: {os.path.exists(attachment_path)}")
                    logger.warning(f"Directory exists: {os.path.exists(os.path.dirname(attachment_path))}")
                    logger.warning(f"Directory contents: {os.listdir(os.path.dirname(attachment_path)) if os.path.exists(os.path.dirname(attachment_path)) else 'N/A'}")
            
            # Encode the message
            raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode()
            
            # Send the message via Gmail API
            gmail_url = "https://www.googleapis.com/gmail/v1/users/me/messages/send"
            headers = {"Authorization": f"Bearer {access_token}"}
            payload = {"raw": raw_message}
            
            logger.info(f"Sending email to {to} via Gmail API")
            async with httpx.AsyncClient(timeout=30.0) as client:  # Increased timeout
                logger.info(f"Making request to Gmail API: {gmail_url}")
                response = await client.post(gmail_url, headers=headers, json=payload)
                logger.info(f"Gmail API response status: {response.status_code}")
                
                if response.status_code >= 400:
                    logger.error(f"Gmail API error response: {response.text}")
                    return False
                
                response.raise_for_status()
                response_data = response.json()
                logger.info(f"Gmail API success response: {response_data}")
                
                logger.info(f"Email sent successfully to {to}")
                return True
                
        except Exception as e:
            logger.error(f"Error sending email with Gmail API: {str(e)}")
            logger.exception("Full traceback for Gmail API error:")
            return False
    
    @staticmethod
    async def refresh_access_token(refresh_token: str) -> dict:
        """Refresh the access token using the refresh token"""
        try:
            token_url = "https://oauth2.googleapis.com/token"
            token_data = {
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token"
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(token_url, data=token_data)
                response.raise_for_status()
                new_tokens = response.json()
                
                # Note: The response doesn't include a new refresh token
                return new_tokens
        except Exception as e:
            logger.error(f"Error refreshing access token: {str(e)}")
            raise HTTPException(status_code=401, detail="Failed to refresh authentication") 