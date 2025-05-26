from fastapi import APIRouter, HTTPException, Depends, Query, Body, status, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import JSONResponse, PlainTextResponse
from typing import List, Optional
from datetime import datetime
import shutil
import os
import tempfile
from pymongo import ReturnDocument
from bson import ObjectId
import logging
from fastapi.security import OAuth2PasswordBearer

from ..utils.database import db
from ..utils.security import get_current_user, require_permission
from ..models.user import User
from ..models.permissions import PermissionGroup

# Import the inference engine
import sys
import inspect
current_dir = os.path.dirname(os.path.abspath(inspect.getfile(inspect.currentframe())))
parent_dir = os.path.dirname(os.path.dirname(os.path.dirname(current_dir)))
sys.path.append(parent_dir)
from models.inference import inference_engine

# OAuth2 scheme for token extraction
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# Setup router
router = APIRouter(
    prefix="/analyses",
    tags=["analyses"],
    responses={404: {"description": "Not found"}},
)

# Define upload directory for EEG files
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "eeg")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Configure logging
logger = logging.getLogger(__name__)

# Helper function to format dates in serialization
def format_analysis_response(analysis):
    analysis_dict = dict(analysis)
    
    # Convert all ObjectId instances to strings recursively
    def convert_object_id(obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        elif isinstance(obj, dict):
            return {key: convert_object_id(value) for key, value in obj.items()}
        elif isinstance(obj, list):
            return [convert_object_id(item) for item in obj]
        return obj
        
    analysis_dict = convert_object_id(analysis_dict)
    
    # Format dates and times for frontend
    for date_field in ["uploadDate", "processingStartTime", "processingEndTime", "createdAt"]:
        if date_field in analysis_dict and analysis_dict[date_field]:
            analysis_dict[date_field] = analysis_dict[date_field].isoformat()
    
    return analysis_dict

# Dependency to check permission
async def check_view_analyses(token: str = Depends(oauth2_scheme)):
    user = await get_current_user(token)
    await require_permission(user, PermissionGroup.MANAGE_EEG)
    return user

async def check_create_analyses(token: str = Depends(oauth2_scheme)):
    user = await get_current_user(token)
    await require_permission(user, PermissionGroup.MANAGE_EEG)
    return user

async def check_update_analyses(token: str = Depends(oauth2_scheme)):
    user = await get_current_user(token)
    await require_permission(user, PermissionGroup.MANAGE_EEG)
    return user

async def check_delete_analyses(token: str = Depends(oauth2_scheme)):
    user = await get_current_user(token)
    await require_permission(user, PermissionGroup.MANAGE_EEG)
    return user

@router.get("/", response_description="List analyses")
async def list_analyses(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    patient_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    sort_by: str = Query("uploadDate"),
    sort_order: int = Query(-1),  # -1 for descending, 1 for ascending
    current_user: User = Depends(check_view_analyses)
):
    """
    Get a paginated list of analyses with optional filtering
    """
    # Build query
    query = {}
    if patient_id:
        # Try to convert to ObjectId
        try:
            patient_obj_id = ObjectId(patient_id)
            query["patientId"] = patient_obj_id
        except:
            # Try to find patient by patientId field
            patient = db.patients.find_one({"patientId": patient_id})
            if patient:
                query["patientId"] = patient["_id"]
            else:
                return {
                    "items": [],
                    "total": 0,
                    "page": 1,
                    "pages": 0,
                    "limit": limit
                }
    
    if status:
        query["status"] = status
    
    # Count total - using synchronous operation
    total = db.analyses.count_documents(query)
    
    # Get paginated results - using synchronous operation with list conversion
    analyses_list = list(db.analyses.find(query).sort(sort_by, sort_order).skip(skip).limit(limit))
    
    # Format results
    formatted_analyses = []
    for analysis in analyses_list:
        formatted_analysis = format_analysis_response(analysis)
        
        # Add patient name if available
        if "patientId" in analysis and isinstance(analysis["patientId"], ObjectId):
            patient = db.patients.find_one({"_id": analysis["patientId"]})
            if patient:
                formatted_analysis["patientName"] = f"{patient.get('firstName', '')} {patient.get('lastName', '')}".strip()
        
        formatted_analyses.append(formatted_analysis)
    
    return {
        "items": formatted_analyses,
        "total": total,
        "page": skip // limit + 1 if limit > 0 else 1,
        "pages": (total + limit - 1) // limit if limit > 0 else 0,
        "limit": limit
    }

@router.get("/{analysis_id}", response_description="Get single analysis")
async def get_analysis(
    analysis_id: str,
    current_user: User = Depends(check_view_analyses)
):
    """
    Get details of a specific analysis
    """
    try:
        object_id = ObjectId(analysis_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid analysis ID format")
    
    # Using synchronous operation
    analysis = db.analyses.find_one({"_id": object_id})
    
    if not analysis:
        raise HTTPException(status_code=404, detail=f"Analysis with ID {analysis_id} not found")
    
    # Format the response
    analysis_dict = format_analysis_response(analysis)
    
    # Add patient details if available
    if "patientId" in analysis and isinstance(analysis["patientId"], ObjectId):
        # Using synchronous operation
        patient = db.patients.find_one({"_id": analysis["patientId"]})
        if patient:
            analysis_dict["patient"] = {
                "_id": str(patient["_id"]),
                "patientId": patient.get("patientId", ""),
                "firstName": patient.get("firstName", ""),
                "lastName": patient.get("lastName", ""),
                "gender": patient.get("gender", ""),
                "dateOfBirth": patient.get("dateOfBirth").strftime("%Y-%m-%d") if patient.get("dateOfBirth") else None
            }
    
    return analysis_dict

@router.post("/", response_description="Upload and analyze EEG file")
async def create_analysis(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    patient_id: str = Query(..., description="Patient ID"),
    model_id: str = Query("CNN-BERN", description="Model ID to use for analysis"),
    current_user: User = Depends(check_create_analyses)
):
    """
    Upload and analyze an EEG file
    """
    # Validate patient ID
    patient_obj_id = None
    try:
        patient_obj_id = ObjectId(patient_id)
        patient = db.patients.find_one({"_id": patient_obj_id})
        if not patient:
            raise HTTPException(status_code=404, detail=f"Patient with ID {patient_id} not found")
    except:
        # Try to find by patientId field
        patient = db.patients.find_one({"patientId": patient_id})
        if patient:
            patient_obj_id = patient["_id"]
        else:
            raise HTTPException(status_code=404, detail=f"Patient with ID {patient_id} not found")

    # Validate file
    file_extension = os.path.splitext(file.filename.lower())[1]
    
    # Check if file is in supported format - only extension matters
    if file_extension not in ['.edf', '.txt']:
        raise HTTPException(
            status_code=400, 
            detail="Only EDF and TXT files are supported for EEG analysis"
        )
        
    # Check file size (max 50MB)
    MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
    file_size = 0
    
    # Get file size without reading entire file into memory
    file_content = await file.read(1024)
    file_size = len(file_content)
    while content := await file.read(1024):
        file_size += len(content)
    
    # Reset file pointer for future reads
    await file.seek(0)
    
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File size exceeds the maximum limit of 50MB"
        )

    try:
        # Create file path based on date
        today = datetime.now().strftime("%Y%m%d")
        patient_upload_dir = os.path.join(UPLOAD_DIR, str(patient_obj_id), today)
        os.makedirs(patient_upload_dir, exist_ok=True)
        
        # Create unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_path = os.path.join(patient_upload_dir, f"{timestamp}_{file.filename}")
        
        # Save the file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Create analysis record in 'queued' state
        new_analysis = {
            "patientId": patient_obj_id,
            "fileName": file.filename,
            "filePath": file_path,
            "fileSize": os.path.getsize(file_path),
            "fileType": file_extension[1:],  # Remove the dot from extension
            "uploadDate": datetime.now(),
            "modelUsed": model_id,
            "status": "queued",
            "createdBy": ObjectId(current_user["_id"]) if "_id" in current_user else None,
            "createdAt": datetime.now(),
            "dataFormat": "standard"  # All files use standard format, no more special detection by filename
        }

        # Insert into database
        result = db.analyses.insert_one(new_analysis)
        analysis_id = result.inserted_id
        
        # Log the analysis request
        logger.info(f"Analysis requested: file={file.filename}, patient={patient_id}, model={model_id}, user={current_user['username']}")
        
        # Add the processing task to background tasks
        background_tasks.add_task(
            safe_process_eeg_analysis,
            analysis_id=analysis_id,
            file_path=file_path,
            model_id=model_id
        )
        
        # Return the created analysis
        created_analysis = db.analyses.find_one({"_id": analysis_id})
        if not created_analysis:
            raise HTTPException(status_code=500, detail="Failed to retrieve created analysis")
        
        return format_analysis_response(created_analysis)
        
    except Exception as e:
        logger.error(f"Error creating analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create analysis: {str(e)}")


async def safe_process_eeg_analysis(analysis_id: ObjectId, file_path: str, model_id: str):
    """
    Wrapper function to make sure all exceptions in the background task are caught
    """
    try:
        await process_eeg_analysis(analysis_id, file_path, model_id)
    except Exception as e:
        logger.error(f"Uncaught exception in background task: {str(e)}")
        # Make sure to update the analysis record even if we have an unexpected error
        try:
            db.analyses.update_one(
                {"_id": analysis_id},
                {
                    "$set": {
                        "status": "failed",
                        "processingEndTime": datetime.now(),
                        "error": f"Unhandled server error: {str(e)}"
                    }
                }
            )
        except Exception as inner_e:
            logger.error(f"Failed to update analysis status after error: {str(inner_e)}")


async def process_eeg_analysis(analysis_id: ObjectId, file_path: str, model_id: str):
    """
    Background task to process EEG analysis
    """
    try:
        # Update status to processing
        db.analyses.update_one(
            {"_id": analysis_id},
            {
                "$set": {
                    "status": "processing", 
                    "processingStartTime": datetime.now()
                }
            }
        )
        
        # Run the inference
        inference_results = inference_engine.process_eeg_file(file_path)
        
        if inference_results.get("status") == "failed":
            # Update status to failed
            db.analyses.update_one(
                {"_id": analysis_id},
                {
                    "$set": {
                        "status": "failed",
                        "processingEndTime": datetime.now(),
                        "error": inference_results.get("error", "Unknown error during processing")
                    }
                }
            )
            logger.error(f"Analysis failed: {inference_results.get('error')}")
        else:
            # Extract results
            overall_result = inference_results.get("overall_result", {})
            
            # Create result object
            result_data = {
                "class": overall_result.get("class", 0),
                "probability": overall_result.get("probability", 0),
                "interpretation": overall_result.get("interpretation", "")
            }
            
            # Add metrics if available
            metrics = inference_results.get("metrics", {}).get("confidence_metrics", {})
            if metrics:
                result_data["metrics"] = {
                    "accuracy": metrics.get("consistency", 0),
                    "recall": 0,  # Would need to be calculated with ground truth
                    "precision": 0,  # Would need to be calculated with ground truth
                    "specificity": 0  # Would need to be calculated with ground truth
                }
            
            # Update record with results
            db.analyses.update_one(
                {"_id": analysis_id},
                {
                    "$set": {
                        "status": "completed",
                        "processingEndTime": datetime.now(),
                        "result": result_data
                    }
                }
            )
            
            logger.info(f"Analysis completed successfully for file {file_path}")
            
            # Get patient ID
            analysis = db.analyses.find_one({"_id": analysis_id})
            if analysis and "patientId" in analysis:
                # Update patient's analysis status
                update_patient_analysis_status(analysis["patientId"])
    
    except Exception as e:
        # Update status to failed
        db.analyses.update_one(
            {"_id": analysis_id},
            {
                "$set": {
                    "status": "failed",
                    "processingEndTime": datetime.now(),
                    "error": str(e)
                }
            }
        )
        logger.error(f"Error during analysis: {str(e)}")
    
    finally:
        # Attempt to clear model resources to prevent memory leaks
        from models.model_loader import model_loader
        model_loader.clear_model()

def update_patient_analysis_status(patient_id):
    """
    Update the patient's analysis status after a new analysis is completed
    """
    try:
        # Get all analyses for the patient
        analyses = list(db.analyses.find({"patientId": patient_id}))
        
        # Default analysis status if no analyses
        if not analyses:
            return
        
        # Calculate analysis stats
        # CNN-BERN classification scheme: class 0 is Focal (abnormal), class 1 is Non-Focal (normal)
        analysis_status = {
            "hasAnalysis": True,
            "totalAnalysisCount": len(analyses),
            "lastAnalysisDate": max((a.get("uploadDate", a.get("createdAt", datetime.now())) for a in analyses), default=datetime.now()),
            "abnormalResultCount": sum(1 for a in analyses if a.get("result", {}).get("class") == 0),
            "normalResultCount": sum(1 for a in analyses if a.get("result", {}).get("class") == 1),
            "pendingAnalysisCount": sum(1 for a in analyses if a.get("status") == "queued" or a.get("status") == "processing")
        }
        
        # Get last analysis result if available
        completed_analyses = [a for a in analyses if a.get("status") == "completed"]
        if completed_analyses:
            latest_analysis = max(completed_analyses, key=lambda a: a.get("uploadDate", a.get("createdAt", datetime.now())))
            if "result" in latest_analysis:
                analysis_status["lastResult"] = {
                    "class": latest_analysis["result"].get("class"),
                    "probability": latest_analysis["result"].get("probability"),
                    "modelId": latest_analysis.get("modelUsed")
                }
        
        # Update patient record
        db.patients.update_one(
            {"_id": patient_id},
            {"$set": {"analysisStatus": analysis_status}}
        )
        
        logger.info(f"Updated analysis status for patient {patient_id}")
        
    except Exception as e:
        logger.error(f"Error updating patient analysis status: {str(e)}")

@router.get("/{analysis_id}/eeg-data", response_description="Get EEG data for visualization")
async def get_eeg_data(
    analysis_id: str,
    current_user: User = Depends(check_view_analyses)
):
    """
    Get EEG data file contents for visualization
    """
    try:
        object_id = ObjectId(analysis_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid analysis ID format")
    
    # Get the analysis document
    analysis = db.analyses.find_one({"_id": object_id})
    if not analysis:
        raise HTTPException(status_code=404, detail=f"Analysis with ID {analysis_id} not found")
    
    # Get the file path
    file_path = analysis.get("filePath")
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="EEG data file not found")
    
    try:
        # Read the file
        with open(file_path, 'r') as file:
            eeg_data = file.read()
        
        # Return the raw file content
        return PlainTextResponse(content=eeg_data)
    except Exception as e:
        logger.error(f"Error reading EEG file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to read EEG data file: {str(e)}")
 