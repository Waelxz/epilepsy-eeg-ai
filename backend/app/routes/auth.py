from fastapi import APIRouter, Depends, HTTPException, Response, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from typing import Optional, List
from ..utils.security import (
    hash_password, 
    verify_password, 
    create_access_token, 
    create_refresh_token,
    decode_token,
    revoke_token
)
from ..utils.database import users_collection
from ..utils.logger import log_activity
from ..models.log import LogType
from ..models.permissions import get_groups_from_permissions
from bson import ObjectId
import logging

router = APIRouter()

# Define the OAuth2 password bearer scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")

# Define the LoginRequest model
class LoginRequest(BaseModel):
    username: str
    password: str

# Define the TokenResponse model
class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    role: str
    permission_groups: List[str] = []

# Login endpoint
@router.post("/login", response_model=TokenResponse)
async def login(login_request: LoginRequest, response: Response, request: Request):
    # Find the user in the database
    user = users_collection.find_one({"username": login_request.username})
    if not user:
        raise HTTPException(
            status_code=401,
            detail="**Invalid Account Information**"
        )
    
    if not verify_password(login_request.password, user["password"]):
        # Log failed login attempt
        await log_activity(
            action=LogType.LOGIN,
            description=f"Failed login attempt for user {login_request.username}",
            username=login_request.username,
            ip_address=request.client.host,
            details={
                "success": False,
                "reason": "incorrect_password"
            }
        )
        
        raise HTTPException(
            status_code=401,
            detail="**Password is incorrect**"
        )
    
    if not user.get("is_active", True):
        await log_activity(
            action=LogType.LOGIN,
            description=f"Login attempt on disabled account: {login_request.username}",
            username=login_request.username,
            ip_address=request.client.host,
            details={
                "success": False,
                "reason": "account_disabled"
            }
        )
        
        raise HTTPException(
            status_code=401,
            detail="**Account is disabled**"
        )
    
    # Get user permission groups
    permission_groups = user.get("permission_groups", [])
    
    # Create access and refresh tokens
    user_id = str(user["_id"])
    access_token = create_access_token({
        "sub": user_id, 
        "role": user["role"],
        "permission_groups": permission_groups
    })
    refresh_token = create_refresh_token({"sub": user_id})
    
    # Log successful login
    await log_activity(
        action=LogType.LOGIN,
        description=f"User {login_request.username} logged in successfully",
        user_id=user_id,
        username=login_request.username,
        ip_address=request.client.host,
        details={
            "success": True
        }
    )
    
    # Set refresh token as HTTP-only cookie
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=7 * 24 * 60 * 60  # 7 days
    )
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "role": user["role"],
        "permission_groups": permission_groups
    }

# Logout endpoint
@router.post("/logout")
async def logout(request: Request, response: Response, token: str = Depends(oauth2_scheme)):
    try:
        # Decode token to get user info
        payload = decode_token(token)
        user_id = payload["sub"]
        
        # Revoke the current token
        revoke_token(token)
        
        # Clear refresh token cookie
        response.delete_cookie(key="refresh_token")
        
        # Log the logout
        user = users_collection.find_one({"_id": ObjectId(user_id)})
        if user:
            await log_activity(
                action=LogType.LOGOUT,
                description=f"User {user['username']} logged out",
                user_id=user_id,
                username=user['username'],
                ip_address=request.client.host
            )
        
        return {"message": "Successfully logged out"}
    except Exception as e:
        # Even if there's an error, we should still delete the cookie
        response.delete_cookie(key="refresh_token")
        
        # Log the error as a warning and return a success message
        # This way, frontend still treats it as a successful logout
        logging.warning(f"Error during logout: {str(e)}")
        
        return {"message": "Successfully logged out"}

# Refresh token endpoint
@router.post("/refresh")
async def refresh_token_endpoint(response: Response):
    try:
        # Get refresh token from cookie
        refresh_token = response.cookies.get("refresh_token")
        if not refresh_token:
            raise HTTPException(
                status_code=401,
                detail="Refresh token not found"
            )
        
        # Decode refresh token
        payload = decode_token(refresh_token, is_refresh=True)
        
        # Get user from database
        user = users_collection.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(
                status_code=401,
                detail="User not found"
            )
        
        # Get user permission groups
        permission_groups = user.get("permission_groups", [])
        
        # Create new access token
        access_token = create_access_token({
            "sub": str(user["_id"]), 
            "role": user["role"],
            "permission_groups": permission_groups
        })
        
        return {
            "access_token": access_token, 
            "token_type": "bearer",
            "permission_groups": permission_groups
        }
    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail="Invalid refresh token"
        )

# Protected endpoint example
@router.get("/protected")
async def protected_route(token: str = Depends(oauth2_scheme)):
    try:
        # Decode and verify the token
        payload = decode_token(token)
        return {
            "message": "You have access!",
            "user_id": payload["sub"],
            "role": payload["role"]
        }
    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail="Invalid token"
        )