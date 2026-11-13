from fastapi import APIRouter, HTTPException, Depends, Query, Body, status
from fastapi.responses import JSONResponse
from typing import List, Optional
from datetime import datetime
from pymongo import ReturnDocument
from bson import ObjectId
import logging
from fastapi.security import OAuth2PasswordBearer

from ..utils.database import db
from ..utils.security import get_current_user, require_permission
from ..models.user import User
from ..models.permissions import PermissionGroup

# OAuth2 scheme for token extraction
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# Setup router
router = APIRouter(
    prefix="/patients",
    tags=["patients"],
    responses={404: {"description": "Not found"}},
)

# Configure logging
logger = logging.getLogger(__name__)

# Helper function to convert ObjectId to string
def convert_objectid_to_str(data):
    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, ObjectId):
                data[key] = str(value)
            elif isinstance(value, (dict, list)):
                data[key] = convert_objectid_to_str(value)
    elif isinstance(data, list):
        for i, item in enumerate(data):
            if isinstance(item, ObjectId):
                data[i] = str(item)
            elif isinstance(item, (dict, list)):
                data[i] = convert_objectid_to_str(item)
    return data

# Helper function to format dates in serialization
def format_patient_response(patient):
    if not patient:
        return None
    
    # Create a base response dictionary with explicit conversions
    response = {
        "_id": str(patient["_id"]),
        "patientId": patient.get("patientId", ""),
        "firstName": patient.get("firstName", ""),
        "lastName": patient.get("lastName", ""),
        "dateOfBirth": patient.get("dateOfBirth").strftime("%Y-%m-%d") if patient.get("dateOfBirth") else None,
        "gender": patient.get("gender", ""),
    }
    
    # Process nested contactInfo with safe handling
    if "contactInfo" in patient and patient["contactInfo"]:
        response["contactInfo"] = {}
        contact_info = patient["contactInfo"]
        for key, value in contact_info.items():
            if isinstance(value, ObjectId):
                response["contactInfo"][key] = str(value)
            else:
                response["contactInfo"][key] = value
    else:
        response["contactInfo"] = {}
    
    # Process medications array if present
    if "medications" in patient and patient["medications"]:
        response["medications"] = []
        for med in patient["medications"]:
            if isinstance(med, dict):
                safe_med = {}
                for key, value in med.items():
                    if isinstance(value, ObjectId):
                        safe_med[key] = str(value)
                    else:
                        safe_med[key] = value
                response["medications"].append(safe_med)
            else:
                response["medications"].append(med)
    
    # Handle timestamp fields
    if "createdAt" in patient and patient["createdAt"]:
        response["createdAt"] = patient["createdAt"].isoformat()
    if "updatedAt" in patient and patient["updatedAt"]:
        response["updatedAt"] = patient["updatedAt"].isoformat()
    
    # Handle createdBy field
    if "createdBy" in patient:
        if isinstance(patient["createdBy"], ObjectId):
            response["createdBy"] = str(patient["createdBy"])
        else:
            response["createdBy"] = patient["createdBy"]
    
    # Copy any other fields not explicitly handled
    for key, value in patient.items():
        if key not in response:
            if isinstance(value, ObjectId):
                response[key] = str(value)
            elif isinstance(value, datetime):
                response[key] = value.isoformat()
            else:
                response[key] = value
                
    return response

# Dependency to check permission
async def check_view_patients(token: str = Depends(oauth2_scheme)):
    user = await get_current_user(token)
    await require_permission(user, PermissionGroup.MANAGE_PATIENTS)
    return user

async def check_create_patients(token: str = Depends(oauth2_scheme)):
    user = await get_current_user(token)
    await require_permission(user, PermissionGroup.MANAGE_PATIENTS)
    return user

async def check_update_patients(token: str = Depends(oauth2_scheme)):
    user = await get_current_user(token)
    await require_permission(user, PermissionGroup.MANAGE_PATIENTS)
    return user

async def check_delete_patients(token: str = Depends(oauth2_scheme)):
    user = await get_current_user(token)
    await require_permission(user, PermissionGroup.MANAGE_PATIENTS)
    return user

@router.get("/", response_description="List all patients")
async def list_patients(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    search: Optional[str] = Query(None),
    sort_by: Optional[str] = Query("lastName"),
    sort_order: Optional[int] = Query(-1),  # -1 for descending, 1 for ascending
    current_user: User = Depends(check_view_patients)
):
    """
    Get a paginated list of patients with optional search and sorting
    """
    # Build query
    query = {}
    if search:
        query["$or"] = [
            {"firstName": {"$regex": search, "$options": "i"}},
            {"lastName": {"$regex": search, "$options": "i"}},
            {"patientId": {"$regex": search, "$options": "i"}}
        ]
    
    # Count total - using synchronous operation
    total = db.patients.count_documents(query)
    
    # Get paginated results - using synchronous operation with list conversion
    patients = list(db.patients.find(query).sort(sort_by, sort_order).skip(skip).limit(limit))
    
    # Ensure all patients have the analysisStatus field
    for patient in patients:
        if "analysisStatus" not in patient:
            # Set default values
            patient["analysisStatus"] = {
                "hasAnalysis": False,
                "totalAnalysisCount": 0,
                "abnormalResultCount": 0,
                "normalResultCount": 0,
                "pendingAnalysisCount": 0
            }
            
            # Check if the patient has any analyses
            analyses_count = db.analyses.count_documents({"patientId": patient["_id"]})
            if analyses_count > 0:
                # If there are analyses, fetch the full data
                completed_analyses = list(db.analyses.find({"patientId": patient["_id"], "status": "completed"}))
                
                # CNN-BERN classification: class 0 is Focal (abnormal), class 1 is Non-Focal (normal)
                abnormal_count = sum(1 for a in completed_analyses if a.get("result") and a["result"].get("class") == 0)
                normal_count = sum(1 for a in completed_analyses if a.get("result") and a["result"].get("class") == 1)
                pending_count = db.analyses.count_documents({
                    "patientId": patient["_id"], 
                    "status": {"$in": ["queued", "processing"]}
                })
                
                # Update analysisStatus
                patient["analysisStatus"] = {
                    "hasAnalysis": True,
                    "totalAnalysisCount": analyses_count,
                    "abnormalResultCount": abnormal_count,
                    "normalResultCount": normal_count,
                    "pendingAnalysisCount": pending_count
                }
                
                # Add last result data if available
                if completed_analyses:
                    # Find the most recent completed analysis
                    last_analysis = max(completed_analyses, key=lambda a: a.get("uploadDate", a.get("createdAt", datetime(1970, 1, 1))))
                    if last_analysis.get("result"):
                        patient["analysisStatus"]["lastAnalysisDate"] = last_analysis.get("uploadDate", last_analysis.get("createdAt"))
                        patient["analysisStatus"]["lastResult"] = {
                            "class": last_analysis["result"].get("class", 0),
                            "probability": last_analysis["result"].get("probability", 0),
                            "modelId": last_analysis.get("modelUsed", "unknown")
                        }
    
    # Format results
    formatted_patients = [format_patient_response(patient) for patient in patients]
    
    return {
        "items": formatted_patients,
        "total": total,
        "page": skip // limit + 1,
        "pages": (total + limit - 1) // limit if limit > 0 else 0,
        "limit": limit
    }

@router.get("/{patient_id}", response_description="Get a single patient by ID")
async def get_patient(
    patient_id: str,
    current_user: User = Depends(check_view_patients)
):
    """
    Get details of a specific patient by ID
    """
    # Try to parse as ObjectId first, but fallback to string ID (patientId field)
    try:
        object_id = ObjectId(patient_id)
        query = {"_id": object_id}
    except:
        query = {"patientId": patient_id}
    
    # Using synchronous operation
    patient = db.patients.find_one(query)
    
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient with ID {patient_id} not found")
    
    # Ensure analysisStatus field exists
    if "analysisStatus" not in patient:
        # Count analyses for this patient
        analyses_count = db.analyses.count_documents({"patientId": patient["_id"]})
        completed_analyses = list(db.analyses.find({"patientId": patient["_id"], "status": "completed"}))
        
        # CNN-BERN classification: class 0 is Focal (abnormal), class 1 is Non-Focal (normal)
        abnormal_count = sum(1 for a in completed_analyses if a.get("result") and a["result"].get("class") == 0)
        normal_count = sum(1 for a in completed_analyses if a.get("result") and a["result"].get("class") == 1)
        pending_count = db.analyses.count_documents({
            "patientId": patient["_id"], 
            "status": {"$in": ["queued", "processing"]}
        })
        
        # Create default analysisStatus
        patient["analysisStatus"] = {
            "hasAnalysis": analyses_count > 0,
            "totalAnalysisCount": analyses_count,
            "abnormalResultCount": abnormal_count,
            "normalResultCount": normal_count,
            "pendingAnalysisCount": pending_count
        }
        
        # Add last result data if available
        if completed_analyses:
            # Find the most recent completed analysis
            last_analysis = max(completed_analyses, key=lambda a: a.get("uploadDate", a.get("createdAt", datetime(1970, 1, 1))))
            if last_analysis.get("result"):
                patient["analysisStatus"]["lastAnalysisDate"] = last_analysis.get("uploadDate", last_analysis.get("createdAt"))
                patient["analysisStatus"]["lastResult"] = {
                    "class": last_analysis["result"].get("class", 0),
                    "probability": last_analysis["result"].get("probability", 0),
                    "modelId": last_analysis.get("modelUsed", "unknown")
                }
    
    return format_patient_response(patient)

@router.post("/", response_description="Add new patient", status_code=status.HTTP_201_CREATED)
async def create_patient(
    patient: dict = Body(...),
    current_user: User = Depends(check_create_patients)
):
    """
    Create a new patient record
    """
    # Validate required fields
    required_fields = ["firstName", "lastName", "dateOfBirth", "gender"]
    for field in required_fields:
        if field not in patient:
            raise HTTPException(status_code=400, detail=f"Field '{field}' is required")
    
    # Sanitize input - remove _id if present as MongoDB will create one
    if "_id" in patient:
        del patient["_id"]
        
    # Parse dateOfBirth if it's a string
    if "dateOfBirth" in patient and isinstance(patient["dateOfBirth"], str):
        try:
            patient["dateOfBirth"] = datetime.strptime(patient["dateOfBirth"], "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format for dateOfBirth. Use YYYY-MM-DD format.")
    
    # Add metadata and tracking fields
    now = datetime.now()
    patient["createdAt"] = now
    patient["updatedAt"] = now
    
    # Add default analysisStatus field if not present
    if "analysisStatus" not in patient:
        patient["analysisStatus"] = {
            "hasAnalysis": False,
            "totalAnalysisCount": 0,
            "abnormalResultCount": 0,
            "normalResultCount": 0,
            "pendingAnalysisCount": 0
        }
    
    # Convert user ID to ObjectId for database storage to match schema validation
    try:
        user_id = current_user.get("_id")
        if isinstance(user_id, str):
            patient["createdBy"] = ObjectId(user_id)
        else:
            patient["createdBy"] = user_id
    except Exception as e:
        logger.error(f"Error converting user ID to ObjectId: {str(e)}")
        # If conversion fails, don't include the createdBy field
        if "createdBy" in patient:
            del patient["createdBy"]
    
    # Generate patientId if not provided
    if "patientId" not in patient or not patient["patientId"]:
        # Using synchronous operation
        count = db.patients.count_documents({})
        patient["patientId"] = f"P{count + 1:06d}"
    
    try:
        # Insert document - using synchronous operation
        result = db.patients.insert_one(patient)
        
        # Get the created patient using direct conversion to dictionary
        created_patient = db.patients.find_one({"_id": result.inserted_id})
        
        if not created_patient:
            raise HTTPException(status_code=500, detail="Failed to retrieve created patient")
            
        # Log action
        logger.info(f"User {current_user['username']} created patient {patient['firstName']} {patient['lastName']}")
        
        # Create a safe response dictionary manually
        response = {
            "_id": str(created_patient["_id"]),
            "patientId": created_patient.get("patientId", ""),
            "firstName": created_patient.get("firstName", ""),
            "lastName": created_patient.get("lastName", ""),
            "dateOfBirth": created_patient.get("dateOfBirth").strftime("%Y-%m-%d") if created_patient.get("dateOfBirth") else None,
            "gender": created_patient.get("gender", ""),
            "contactInfo": created_patient.get("contactInfo", {}),
            "createdAt": created_patient.get("createdAt").isoformat() if created_patient.get("createdAt") else None,
            "updatedAt": created_patient.get("updatedAt").isoformat() if created_patient.get("updatedAt") else None
        }
        
        # If there are additional fields, include them with safe conversion
        for key, value in created_patient.items():
            if key not in response:
                # Convert ObjectId to string
                if isinstance(value, ObjectId):
                    response[key] = str(value)
                # Convert dates to ISO format
                elif isinstance(value, datetime):
                    response[key] = value.isoformat()
                # Otherwise use as is
                else:
                    response[key] = value
        
        return response
    except Exception as e:
        logger.error(f"Error creating patient: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create patient: {str(e)}")

@router.put("/{patient_id}", response_description="Update a patient")
async def update_patient(
    patient_id: str,
    patient_update: dict = Body(...),
    current_user: User = Depends(check_update_patients)
):
    """
    Update an existing patient record
    """
    # Don't allow updating certain fields
    if "_id" in patient_update:
        del patient_update["_id"]
    if "createdAt" in patient_update:
        del patient_update["createdAt"]
    if "patientId" in patient_update:
        del patient_update["patientId"]
    
    # Parse dateOfBirth if present and is a string
    if "dateOfBirth" in patient_update and isinstance(patient_update["dateOfBirth"], str):
        try:
            patient_update["dateOfBirth"] = datetime.strptime(patient_update["dateOfBirth"], "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format for dateOfBirth. Use YYYY-MM-DD format.")
    
    # Add update timestamp
    patient_update["updatedAt"] = datetime.now()
    
    # Try to parse as ObjectId first, but fallback to string ID (patientId field)
    query = {}
    try:
        object_id = ObjectId(patient_id)
        query = {"_id": object_id}
    except:
        query = {"patientId": patient_id}
    
    try:
        # Update the document - using synchronous operation
        updated_patient = db.patients.find_one_and_update(
            query,
            {"$set": patient_update},
            return_document=ReturnDocument.AFTER
        )
        
        if not updated_patient:
            raise HTTPException(status_code=404, detail=f"Patient with ID {patient_id} not found")
        
        # Log action
        logger.info(f"User {current_user['username']} updated patient {updated_patient['firstName']} {updated_patient['lastName']}")
        
        # Use our improved formatting function to ensure proper serialization
        return format_patient_response(updated_patient)
    except Exception as e:
        logger.error(f"Error updating patient {patient_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update patient: {str(e)}")

@router.delete("/{patient_id}", response_description="Delete a patient")
async def delete_patient(
    patient_id: str,
    current_user: User = Depends(check_delete_patients)
):
    """
    Delete a patient record
    """
    # Try to parse as ObjectId first, but fallback to string ID (patientId field)
    query = {}
    try:
        object_id = ObjectId(patient_id)
        query = {"_id": object_id}
    except:
        query = {"patientId": patient_id}
    
    try:
        # Find the patient first to log info - using synchronous operation
        patient = db.patients.find_one(query)
        if not patient:
            raise HTTPException(status_code=404, detail=f"Patient with ID {patient_id} not found")
        
        # Delete related analyses first - using synchronous operation
        db.analyses.delete_many({"patientId": patient["_id"]})
        
        # Delete the patient - using synchronous operation
        delete_result = db.patients.delete_one(query)
        
        if delete_result.deleted_count == 0:
            raise HTTPException(status_code=404, detail=f"Patient with ID {patient_id} not found")
        
        # Log action
        logger.info(f"User {current_user['username']} deleted patient {patient['firstName']} {patient['lastName']}")
        
        return JSONResponse(status_code=status.HTTP_204_NO_CONTENT, content={})
    except Exception as e:
        logger.error(f"Error deleting patient {patient_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete patient: {str(e)}") 