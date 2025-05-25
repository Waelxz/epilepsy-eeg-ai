from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class MLModel(BaseModel):
    name: str
    description: str
    version: str
    upload_date: datetime = Field(default_factory=datetime.utcnow)
    uploaded_by: str  # user_id of the admin who uploaded
    file_path: str
    metrics: Optional[Dict[str, Any]] = None
    is_default: bool = False
    is_active: bool = True
    parameters: Optional[Dict[str, Any]] = None 