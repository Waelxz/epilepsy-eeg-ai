import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Google OAuth Configuration
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI")

# OAuth scopes needed for Gmail API
GMAIL_SCOPES = [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile"
]

# OAuth state key for CSRF protection - use environment variable or hardcoded value
OAUTH_STATE_KEY = os.getenv("OAUTH_STATE_KEY", "change-me-in-env")

# User session key for storing tokens
USER_TOKENS_KEY = "user_oauth_tokens" 