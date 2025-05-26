from fastapi import APIRouter, HTTPException, Depends, Body, status
from fastapi.security import OAuth2PasswordBearer
from typing import Dict, Optional, Any, List
import logging

from ..utils.chat_service import chat_service
from ..utils.security import get_current_user, require_permission
from ..models.user import User
from ..models.permissions import PermissionGroup
from ..models.chat import ChatRequest, ChatResponse, ChatMessage

# OAuth2 scheme for token extraction
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")

# Setup router
router = APIRouter(
    prefix="/chat",
    tags=["chat"],
    responses={404: {"description": "Not found"}}
)

# Configure logging
logger = logging.getLogger(__name__)

# Check if user is a doctor
async def check_doctor_permission(token: str = Depends(oauth2_scheme)) -> dict:
    user = await get_current_user(token)
    # Only doctors can use the chat
    if user["role"] != "doctor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only doctors can access the chat functionality"
        )
    return user

@router.post("/", response_model=ChatResponse)
async def process_chat(
    request: ChatRequest = Body(...),
    current_user: dict = Depends(check_doctor_permission)
):
    """
    Process a chat request from a doctor
    """
    logger.info(f"Chat request received from user {current_user['_id']}")
    
    # Enhanced history logging for debugging
    history_count = len(request.history) if request.history else 0
    logger.info(f"Request contains {history_count} messages in history")
    
    # Log sample of history messages for debugging
    if history_count > 0:
        try:
            for i, msg in enumerate(request.history[:3]):  # Log first 3 messages
                # Pydantic models have attributes
                if hasattr(msg, 'role') and hasattr(msg, 'content'):
                    logger.info(f"History message {i+1}: role={msg.role}, content={msg.content[:50]}...")
                else:
                    logger.warning(f"History message {i+1} has unexpected format: {type(msg)}")
        except Exception as e:
            logger.error(f"Error logging history: {str(e)}")
    
    try:
        # Generate response using chat service
        response = await chat_service.generate_chat_response(
            message=request.message,
            context=request.context,
            history=request.history
        )
        
        # Check if there was an error
        if "error" in response:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=response["error"]
            )
        
        # Return successful response
        return ChatResponse(
            message=response["response"],
            model=response.get("model", "deepseek-chat"),
            success=True
        )
        
    except Exception as e:
        logger.error(f"Error processing chat request: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process chat request: {str(e)}"
        ) 