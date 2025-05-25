from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form, status, Request, Query
from fastapi.security import OAuth2PasswordBearer
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime
import os
import shutil
from bson import ObjectId
import logging
import sys

from ..utils.security import get_current_user, check_permission, require_permission
from ..utils.database import ml_models_collection
from ..utils.logger import log_activity
from ..models.log import LogType
from ..models.user import UserRole, User
from ..models.ml_model import MLModel
from ..models.permissions import PermissionGroup
from models.health_check import health_checker

# Add parent directory to sys.path for imports
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(os.path.dirname(os.path.dirname(current_dir)))
sys.path.append(parent_dir)

# OAuth2 scheme for token extraction
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# Setup router
router = APIRouter(
    prefix="/models",
    tags=["models"],
    responses={404: {"description": "Not found"}},
)

# Configure logging
logger = logging.getLogger(__name__)

# Dependency to check admin permission
async def check_admin_access(token: str = Depends(oauth2_scheme)):
    user = await get_current_user(token)
    await require_permission(user, PermissionGroup.ADMIN)
    return user

# Models directory path
MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "models")
os.makedirs(MODELS_DIR, exist_ok=True)

class MLModelResponse(BaseModel):
    id: str
    name: str
    description: str
    version: str
    upload_date: datetime
    uploaded_by: str
    metrics: Optional[Dict[str, Any]] = None
    is_default: bool = False
    is_active: bool = True

@router.post("/models", response_model=MLModelResponse)
async def upload_model(
    request: Request,
    name: str = Form(...),
    description: str = Form(...),
    version: str = Form(...),
    model_file: UploadFile = File(...),
    metrics: Optional[str] = Form(None),
    token: str = Depends(oauth2_scheme)
):
    # Get current user and check permissions
    current_user = await get_current_user(token)
    
    # Only admin can upload models
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can upload ML models"
        )
    
    # Check if model with same name and version already exists
    existing_model = ml_models_collection.find_one({
        "name": name,
        "version": version
    })
    
    if existing_model:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Model with name '{name}' and version '{version}' already exists"
        )
    
    # Save model file
    model_filename = f"{name.replace(' ', '_')}_{version}.h5"
    file_path = os.path.join(MODELS_DIR, model_filename)
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(model_file.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error saving model file: {str(e)}"
        )
    
    # Parse metrics if provided
    model_metrics = None
    if metrics:
        import json
        try:
            model_metrics = json.loads(metrics)
        except:
            model_metrics = {"raw": metrics}
    
    # Create model record
    new_model = {
        "name": name,
        "description": description,
        "version": version,
        "upload_date": datetime.utcnow(),
        "uploaded_by": str(current_user["_id"]),
        "file_path": file_path,
        "metrics": model_metrics,
        "is_default": False,  # New models are not default by default
        "is_active": True,
        "parameters": {}
    }
    
    result = ml_models_collection.insert_one(new_model)
    
    # Log model upload
    await log_activity(
        action=LogType.MODEL_UPLOAD,
        description=f"Admin {current_user['username']} uploaded model: {name} v{version}",
        user_id=str(current_user["_id"]),
        username=current_user["username"],
        ip_address=request.client.host,
        details={"model_id": str(result.inserted_id), "model_name": name, "version": version}
    )
    
    # Prepare response
    created_model = ml_models_collection.find_one({"_id": result.inserted_id})
    created_model["id"] = str(created_model.pop("_id"))
    
    return created_model

@router.get("/models", response_model=List[MLModelResponse])
async def get_models(
    active_only: bool = True,
    token: str = Depends(oauth2_scheme)
):
    # Get current user
    current_user = await get_current_user(token)
    
    # Build query
    query = {}
    if active_only:
        query["is_active"] = True
    
    # Get models from database
    models = list(ml_models_collection.find(query))
    
    # Format response
    for model in models:
        model["id"] = str(model.pop("_id"))
        # Remove file path from response
        model.pop("file_path", None)
        model.pop("parameters", None)
    
    return models

@router.get("/models/{model_id}", response_model=MLModelResponse)
async def get_model(
    model_id: str,
    token: str = Depends(oauth2_scheme)
):
    # Get current user
    current_user = await get_current_user(token)
    
    # Check permissions for doctor role
    if current_user["role"] == UserRole.DOCTOR:
        # Doctors need the EEG permission group to access models
        await require_permission(current_user, PermissionGroup.MANAGE_EEG)
    
    # Get model from database
    try:
        model = ml_models_collection.find_one({"_id": ObjectId(model_id)})
    except:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid model ID format"
        )
    
    if not model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Model not found"
        )
    
    # Format response
    model["id"] = str(model.pop("_id"))
    # Remove file path from response
    model.pop("file_path", None)
    model.pop("parameters", None)
    
    return model

@router.put("/models/{model_id}/set-default")
async def set_default_model(
    model_id: str,
    request: Request,
    token: str = Depends(oauth2_scheme)
):
    # Get current user and check permissions
    current_user = await get_current_user(token)
    
    # Only admin can set default model
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can set the default ML model"
        )
    
    # Check if model exists
    try:
        model = ml_models_collection.find_one({"_id": ObjectId(model_id)})
    except:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid model ID format"
        )
    
    if not model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Model not found"
        )
    
    # Check if model is active
    if not model.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot set an inactive model as default"
        )
    
    # Reset all models to non-default
    ml_models_collection.update_many(
        {},
        {"$set": {"is_default": False}}
    )
    
    # Set the selected model as default
    ml_models_collection.update_one(
        {"_id": ObjectId(model_id)},
        {"$set": {"is_default": True}}
    )
    
    # Log the action
    await log_activity(
        action=LogType.MODEL_UPDATE,
        description=f"Admin {current_user['username']} set model '{model['name']}' v{model['version']} as default",
        user_id=str(current_user["_id"]),
        username=current_user["username"],
        ip_address=request.client.host,
        details={"model_id": model_id, "model_name": model['name'], "version": model['version']}
    )
    
    return {"message": f"Model '{model['name']}' set as default"}

@router.delete("/models/{model_id}")
async def delete_model(
    model_id: str,
    request: Request,
    token: str = Depends(oauth2_scheme)
):
    # Get current user and check permissions
    current_user = await get_current_user(token)
    
    # Only admin can delete models
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can delete ML models"
        )
    
    # Check if model exists
    try:
        model = ml_models_collection.find_one({"_id": ObjectId(model_id)})
    except:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid model ID format"
        )
    
    if not model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Model not found"
        )
    
    # Check if model is default
    if model.get("is_default", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete the default model. Set another model as default first."
        )
    
    # Delete the model file
    file_path = model.get("file_path")
    if file_path and os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception as e:
            # Log error but continue with database deletion
            print(f"Error deleting model file: {str(e)}")
    
    # Delete from database
    ml_models_collection.delete_one({"_id": ObjectId(model_id)})
    
    # Log the action
    await log_activity(
        action=LogType.MODEL_DELETE,
        description=f"Admin {current_user['username']} deleted model '{model['name']}' v{model['version']}",
        user_id=str(current_user["_id"]),
        username=current_user["username"],
        ip_address=request.client.host,
        details={"model_name": model['name'], "version": model['version']}
    )
    
    return {"message": f"Model '{model['name']}' deleted successfully"} 

@router.get("/health", response_description="Check model health")
async def check_model_health(
    current_user: User = Depends(check_admin_access)
):
    """
    Check if the model is loaded and working properly
    """
    try:
        status = health_checker.get_model_status()
        if status["status"] == "error":
            return {
                "status": "error",
                "message": status["message"]
            }
        return status
    except Exception as e:
        logger.error(f"Error checking model health: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to check model health: {str(e)}")

@router.get("/", response_description="List available models")
async def list_models(
    current_user: User = Depends(check_admin_access)
):
    """
    List all available models for EEG analysis
    """
    try:
        # For now, we only have one model - CNN-BERN
        return {
            "models": [
                {
                    "id": "CNN-BERN",
                    "name": "CNN-BERN",
                    "description": "Convolutional Neural Network model for epilepsy detection from EEG signals",
                    "version": "1.0.0",
                    "is_default": True,
                    "is_active": True,
                    "input_shape": [1024, 2],
                    "accuracy": 0.92,
                    "precision": 0.89,
                    "recall": 0.94
                }
            ]
        }
    except Exception as e:
        logger.error(f"Error listing models: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list models: {str(e)}") 