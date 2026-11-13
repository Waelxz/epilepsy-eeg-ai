from pydantic import BaseModel, Field
from typing import Dict, Optional, List, Any

class ChatContext(BaseModel):
    """Context information for chat requests"""
    page: Optional[str] = None
    patient_id: Optional[str] = None
    analysis_id: Optional[str] = None
    
class ChatMessage(BaseModel):
    """Single chat message"""
    role: str
    content: str

class ChatRequest(BaseModel):
    """Chat request model"""
    message: str = Field(..., description="User's message")
    context: Optional[Dict[str, Any]] = Field(default=None, description="Application context")
    history: Optional[List[ChatMessage]] = Field(default=None, description="Previous chat messages in the conversation")
    
class ChatResponse(BaseModel):
    """Chat response model"""
    message: str = Field(..., description="Assistant's response")
    model: str = Field(default="default", description="Model used for response")
    success: bool = Field(default=True, description="Whether the request was successful")
    
class ChatHistoryItem(BaseModel):
    """Chat history item model"""
    timestamp: str
    message: str
    response: str
    context: Optional[Dict[str, Any]] = None 