from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.security import OAuth2PasswordBearer
from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel

from ..utils.security import get_current_user
from ..utils.logger import get_logs
from ..models.log import LogType
from ..models.user import UserRole

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")

class LogResponse(BaseModel):
    id: str
    timestamp: datetime
    user_id: Optional[str] = None
    username: Optional[str] = None
    action: str
    description: str
    ip_address: Optional[str] = None
    details: Optional[dict] = None

class PaginatedLogResponse(BaseModel):
    items: List[LogResponse]
    metadata: Dict[str, Any]

@router.get("/logs", response_model=PaginatedLogResponse)
async def get_system_logs(
    request: Request,
    action_type: Optional[LogType] = None,
    user_id: Optional[str] = None,
    target_username: Optional[str] = None,
    search: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = Query(50, ge=1, le=1000),
    skip: int = Query(0, ge=0),
    token: str = Depends(oauth2_scheme)
):
    # Get current user and check permissions
    current_user = await get_current_user(token)
    
    # Only admin and technician can view logs
    if current_user["role"] == UserRole.DOCTOR:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Doctors cannot access system logs"
        )
    
    # If technician, restrict to only viewing logs related to doctors
    if current_user["role"] == UserRole.TECHNICIAN:
        # Get doctor IDs for filtering
        from ..utils.database import users_collection
        doctor_users = list(users_collection.find({"role": UserRole.DOCTOR}, {"_id": 1, "username": 1}))
        doctor_ids = [str(doc["_id"]) for doc in doctor_users]
        doctor_usernames = [doc.get("username", "") for doc in doctor_users]
        
        # If a specific user_id was requested, ensure it's a doctor
        if isinstance(user_id, str) and user_id not in doctor_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Technicians can only view logs related to doctors"
            )
        else:
            # We need a custom query to filter logs properly
            # Either the log's user_id is a doctor, OR the log is about a doctor
            custom_query = {
                "$or": [
                    {"user_id": {"$in": doctor_ids}},  # Doctor is the actor
                    {"details.target_id": {"$in": doctor_ids}},  # Doctor is the target
                    {"details.target_role": UserRole.DOCTOR.value},  # Target role is doctor
                    {"details.created_role": UserRole.DOCTOR.value},  # Created role is doctor
                    {"details.updated_role": UserRole.DOCTOR.value},  # Updated role is doctor
                    {"details.deleted_role": UserRole.DOCTOR.value}   # Deleted role is doctor
                ]
            }
            
            # Additional filter to include logs with doctor usernames in the description
            for username in doctor_usernames:
                if username:
                    custom_query["$or"].append({"description": {"$regex": username, "$options": "i"}})
            
            # Apply action_type filter if provided
            if action_type:
                # Add the action_type filter to the main query, outside of the $or
                custom_query["action"] = action_type.value if hasattr(action_type, 'value') else action_type
                print(f"Applied action_type filter to custom query: {action_type}")
            
            # Apply target_username filter if provided
            if target_username:
                # Create a list of possible locations where the username might appear
                # This builds a query that searches for the username in various fields
                username_conditions = [
                    {"username": target_username},  # The log's actor has this username
                    {"details.target_user": target_username},  # Direct match in target_user field
                    {"details.created_user": target_username},  # Direct match in created_user field
                    {"description": {"$regex": f"\\b{target_username}\\b", "$options": "i"}}  # Regex match in description
                ]
                custom_query["$and"] = custom_query.get("$and", []) + [{"$or": username_conditions}]
                print(f"Applied target_username filter to custom query: {target_username}")
            
            # Apply search filter if provided (full text search)
            if search and search.strip():
                search_term = search.strip()
                # Create search conditions for various fields
                search_conditions = [
                    {"username": {"$regex": search_term, "$options": "i"}},
                    {"description": {"$regex": search_term, "$options": "i"}},
                    {"action": {"$regex": search_term, "$options": "i"}},
                    {"details.target_user": {"$regex": search_term, "$options": "i"}},
                    {"details.target_name": {"$regex": search_term, "$options": "i"}},
                    {"details.reason": {"$regex": search_term, "$options": "i"}}
                ]
                
                # Add to existing $and condition or create a new one
                custom_query["$and"] = custom_query.get("$and", []) + [{"$or": search_conditions}]
                print(f"Applied search filter to custom query: {search_term}")
            
            # Pass the custom query to get_logs
            logs, metadata = await get_logs(
                action_type=None,  # We've already added this to the custom query
                start_date=start_date,
                end_date=end_date,
                limit=limit,
                skip=skip,
                search=search,  # Pass search parameter for non-custom query fallback
                custom_query=custom_query
            )
            
            # Process the logs for technician visibility restrictions
            current_user_id = str(current_user["_id"])
            for log in logs:
                # Get the user_id of the log, defaulting to None if not present
                log_user_id = log.get("user_id")
                
                # Check if this is a doctor action log (done by doctor themselves)
                is_doctor_action = log_user_id in doctor_ids
                
                # Check if this is a technician action on a doctor account
                is_technician_action = (log_user_id is not None and 
                                     log_user_id not in doctor_ids and 
                                     (
                                        "doctor" in str(log.get("description", "")).lower() or
                                        "2222W" in str(log.get("description", "")) or
                                        log.get("details", {}).get("target_role") == UserRole.DOCTOR.value or
                                        log.get("details", {}).get("target_id") in doctor_ids or
                                        log.get("details", {}).get("created_role") == UserRole.DOCTOR.value or
                                        log.get("details", {}).get("updated_role") == UserRole.DOCTOR.value or
                                        log.get("details", {}).get("deleted_role") == UserRole.DOCTOR.value
                                     ))
                
                # Check if this log was created by the current technician
                is_current_technician = log_user_id == current_user_id
                
                # If it's a technician action on a doctor account but NOT by this technician
                if is_technician_action and not is_current_technician:
                    # Anonymize technician details for privacy/security
                    log["username"] = "Another Technician"
                    # Remove technician ID to prevent tracking
                    log["user_id"] = None
                    
                    # Update the description to hide technician identity
                    if "description" in log:
                        # Replace name patterns in various formats
                        import re
                        # Match patterns like "User JohnDoe (John Doe)"
                        log["description"] = re.sub(
                            r"User (\w+)\s+\([\w\s]+\)",
                            "Another Technician",
                            log["description"]
                        )
                        # Match patterns like "1111W (Wael Dridi)"
                        log["description"] = re.sub(
                            r"\b\w+W\s+\([\w\s]+\)",
                            "Another Technician",
                            log["description"]
                        )
                    
                    # Sanitize any details that might contain technician identity
                    if "details" in log and log["details"]:
                        # Remove actor fields but keep target fields
                        safe_details = {}
                        for key, value in log["details"].items():
                            if "target" in key or key in ["old_values", "new_values", "updated_fields"]:
                                safe_details[key] = value
                        log["details"] = safe_details
            
            return {"items": logs, "metadata": metadata}
            
    # For admin or when not using custom query
    logs, metadata = await get_logs(
        user_id=user_id,
        action_type=action_type,
        start_date=start_date,
        end_date=end_date,
        search=search,  # Pass search parameter
        limit=limit,
        skip=skip
    )
    
    return {"items": logs, "metadata": metadata}

@router.get("/logs/actions", response_model=List[str])
async def get_log_action_types(token: str = Depends(oauth2_scheme)):
    """Get all possible log action types"""
    # Get current user and check permissions
    current_user = await get_current_user(token)
    
    # Only admin and technician can view log types
    if current_user["role"] == UserRole.DOCTOR:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Doctors cannot access log information"
        )
    
    # Return all log action types
    return [action.value for action in LogType] 