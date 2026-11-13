from datetime import datetime
from typing import Optional, Dict, Any, Tuple
from bson import ObjectId
from .database import logs_collection
from ..models.log import LogType

async def log_activity(
    action: LogType,
    description: str,
    user_id: Optional[str] = None,
    username: Optional[str] = None,
    ip_address: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None
) -> str:
    """
    Log a system activity to the database
    
    Returns:
        str: The ID of the created log entry
    """
    log_entry = {
        "timestamp": datetime.utcnow(),
        "user_id": user_id,
        "username": username,
        "action": action,
        "description": description,
        "ip_address": ip_address,
        "details": details or {}
    }
    
    result = logs_collection.insert_one(log_entry)
    return str(result.inserted_id)

async def get_logs(
    user_id: Optional[str] = None,
    action_type: Optional[LogType] = None, 
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    search: Optional[str] = None,
    limit: int = 100,
    skip: int = 0,
    custom_query: Optional[dict] = None
) -> Tuple[list, dict]:
    """
    Retrieve logs with optional filtering
    
    Args:
        user_id: Filter by user ID
        action_type: Filter by action type
        start_date: Filter logs after this date
        end_date: Filter logs before this date
        search: Free text search across multiple fields
        limit: Maximum number of logs to return
        skip: Number of logs to skip (for pagination)
        custom_query: Custom MongoDB query to use instead of building one
        
    Returns:
        Tuple[list, dict]: List of log entries and pagination metadata
    """
    # If a custom query is provided, use it directly
    if custom_query:
        query = custom_query
        print(f"Using custom query: {query}")
    else:
        # Otherwise build the query from parameters
        query = {}
        
        if user_id:
            query["user_id"] = user_id
        
        if action_type:
            # Handle both Enum values and string values
            if hasattr(action_type, 'value'):
                query["action"] = action_type.value
                print(f"Using action_type Enum value: {action_type.value}")
            else:
                query["action"] = action_type
                print(f"Using action_type string value: {action_type}")
        
        # Apply search filter if provided
        if search and search.strip():
            search_term = search.strip()
            # Create a full-text search across multiple fields
            search_conditions = [
                {"username": {"$regex": search_term, "$options": "i"}},
                {"description": {"$regex": search_term, "$options": "i"}},
                {"action": {"$regex": search_term, "$options": "i"}},
                {"details.target_user": {"$regex": search_term, "$options": "i"}},
                {"details.target_name": {"$regex": search_term, "$options": "i"}},
                {"details.reason": {"$regex": search_term, "$options": "i"}}
            ]
            query["$or"] = search_conditions
            print(f"Applied search filter: {search_term}")
        
        date_query = {}
        if start_date:
            date_query["$gte"] = start_date
        if end_date:
            date_query["$lte"] = end_date
        
        if date_query:
            query["timestamp"] = date_query
    
    # Count total matching documents before applying limit and skip
    total_count = logs_collection.count_documents(query)
    print(f"Total matching logs found: {total_count}")
    
    # Get logs with sorting and pagination
    logs = list(logs_collection.find(query).sort("timestamp", -1).skip(skip).limit(limit))
    
    # Convert ObjectId to string for JSON serialization and rename _id to id
    for log in logs:
        log["id"] = str(log.pop("_id"))
    
    # Calculate pagination metadata
    current_page = (skip // limit) + 1 if limit > 0 else 1
    total_pages = (total_count + limit - 1) // limit if limit > 0 else 1
    
    metadata = {
        "total_count": total_count,
        "page_size": limit,
        "current_page": current_page,
        "total_pages": total_pages,
        "has_next": current_page < total_pages,
        "has_previous": current_page > 1
    }
    
    return logs, metadata 