from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum

class LogType(str, Enum):
    # Authentication actions
    LOGIN = "login"
    LOGOUT = "logout"
    
    # Doctor management actions
    CREATE_DOCTOR = "create_doctor"
    UPDATE_DOCTOR = "update_doctor"
    DELETE_DOCTOR = "delete_doctor"
    DOCTOR_PASSWORD_CHANGE = "doctor_password_change"
    DOCTOR_PERMISSIONS_UPDATE = "doctor_permissions_update"
    
    # General user actions (for backward compatibility and admin use)
    CREATE_USER = "create_user"
    UPDATE_USER = "update_user"
    DELETE_USER = "delete_user"
    UPDATE_PERMISSIONS = "update_permissions"
    PASSWORD_CHANGE = "password_change"
    
    # Model management actions
    MODEL_UPLOAD = "model_upload"
    MODEL_DELETE = "model_delete"
    MODEL_UPDATE = "model_update"
    
    # System actions
    SYSTEM = "system"

class Log(BaseModel):
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    user_id: Optional[str] = None
    username: Optional[str] = None
    action: LogType
    description: str
    ip_address: Optional[str] = None
    details: Optional[dict] = None 