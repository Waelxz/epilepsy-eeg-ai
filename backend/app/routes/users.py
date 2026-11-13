from fastapi import APIRouter, Depends, HTTPException, Response, Request, status, Query, Header
from fastapi.security import OAuth2PasswordBearer
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field
from bson import ObjectId
from datetime import datetime
import logging

from ..utils.security import (
    hash_password,
    verify_password,
    decode_token,
    get_current_user,
    require_permission
)
from ..utils.database import users_collection
from ..utils.logger import log_activity
from ..models.log import LogType
from ..models.user import User, UserRole
from ..models.permissions import PermissionGroup

# Helper function to check required roles
def check_permissions(required_roles: List[str], user_data: dict):
    if user_data["role"] not in required_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to perform this action"
        )
    return True

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")

# User creation models
class ContactInfo(BaseModel):
    email: EmailStr
    phone: Optional[str] = None
    address: Optional[str] = None

class UserCreate(BaseModel):
    username: str
    password: str
    role: UserRole
    name: str
    lastname: str
    age: int
    contact_info: ContactInfo
    permission_groups: Optional[List[str]] = []

class UserUpdate(BaseModel):
    name: Optional[str] = None
    lastname: Optional[str] = None
    age: Optional[int] = None
    contact_info: Optional[ContactInfo] = None
    is_active: Optional[bool] = None
    permission_groups: Optional[List[str]] = None
    password: Optional[str] = None

class UserResponse(BaseModel):
    id: str
    username: str
    role: str
    name: str
    lastname: str
    age: int
    date_created: str
    contact_info: ContactInfo
    is_active: bool
    permission_groups: List[str] = []

# Create a new user (Admin: any user, Technician: only doctors)
@router.post("/users/create", response_model=UserResponse)
async def create_user(user: UserCreate, request: Request, token: str = Depends(oauth2_scheme)):
    # Log request information for debugging
    current_user = await get_current_user(token)
    logger = logging.getLogger(__name__)
    logger.info(f"Create user request received for username: {user.username}")
    
    # Admin can create any user, Technician can only create doctors
    if current_user["role"] == UserRole.TECHNICIAN:
        # Ensure technicians can only create doctor accounts
        if user.role != UserRole.DOCTOR:
            logger.warning(f"Permission denied: Technician {current_user['username']} attempted to create non-doctor user")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Technicians can only create doctor accounts"
            )
    elif current_user["role"] != UserRole.ADMIN:
        # Only admins and technicians can create users
        logger.warning(f"Permission denied: {current_user['username']} with role {current_user['role']} attempted to create user")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to create users"
        )
    
    try:
        # Check if user already exists
        existing_user = users_collection.find_one({"username": user.username})
        if existing_user:
            logger.warning(f"Username conflict: {user.username} already exists")
            raise HTTPException(status_code=400, detail="Username already exists")
        
        # Check if email already exists
        existing_email = users_collection.find_one({"contact_info.email": user.contact_info.email})
        if existing_email:
            logger.warning(f"Email conflict: {user.contact_info.email} already exists")
            raise HTTPException(status_code=400, detail="Email already exists")
        
        # Hash the password
        hashed_password = hash_password(user.password)
        
        # Process permission groups
        permission_groups = user.permission_groups if user.permission_groups else []
        
        # Create user document
        user_doc = {
            "username": user.username,
            "password": hashed_password,
            "role": user.role,
            "name": user.name,
            "lastname": user.lastname,
            "age": user.age,
            "date_created": datetime.now().isoformat(),
            "contact_info": user.contact_info.dict(),
            "is_active": True,
            "permission_groups": permission_groups,
        }
        
        logger.info(f"Creating user: {user.username} with role {user.role}")
        
        # Insert the user in the database
        new_user = users_collection.insert_one(user_doc)
        
        # Get the created user
        created_user = users_collection.find_one({"_id": new_user.inserted_id})
        
        # Transform the document to match the response model
        if created_user:
            created_user["id"] = str(created_user.pop("_id"))
            created_user.pop("password", None)  # Remove sensitive data
        
        # Log user creation with the appropriate action type
        action_type = LogType.CREATE_USER  # Default action type
        
        # Use doctor-specific action type if creating a doctor
        if user.role == UserRole.DOCTOR:
            action_type = LogType.CREATE_DOCTOR
        
        await log_activity(
            action=action_type,
            description=f"User {current_user['username']} created new {user.role} account: {user.username} ({user.name} {user.lastname})",
            user_id=str(current_user["_id"]),
            username=current_user["username"],
            ip_address=request.client.host,
            details={
                "created_user": user.username,
                "user_role": user.role,
                "user_name": f"{user.name} {user.lastname}",
                "permission_groups": permission_groups
            }
        )
        
        # Return the created user without sensitive info
        logger.info(f"User created successfully: {created_user['username']}")
        return created_user
        
    except HTTPException as e:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Log unexpected errors
        logger.error(f"Error creating user: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating user: {str(e)}"
        )

# Get all users (Admin: all users, Technician: only doctors)
@router.get("/users", response_model=List[UserResponse])
async def get_users(
    role: Optional[UserRole] = None,
    token: str = Depends(oauth2_scheme)
):
    # Get current user and check permissions
    current_user = await get_current_user(token)
    
    # Build query based on permissions
    query = {}
    
    if current_user["role"] == UserRole.DOCTOR:
        # Doctors can only see their own profile
        query["_id"] = current_user["_id"]
    elif current_user["role"] == UserRole.TECHNICIAN:
        # Technicians can only see doctors
        query["role"] = UserRole.DOCTOR
    
    # Apply role filter if provided and allowed
    if role and current_user["role"] == UserRole.ADMIN:
        query["role"] = role
    
    # Get users from database
    users = list(users_collection.find(query))
    
    # Format response
    for user in users:
        user["id"] = str(user.pop("_id"))
        user.pop("password", None)
    
    return users

# Get current user's profile
@router.get("/users/me", response_model=UserResponse)
async def get_current_user_profile(token: str = Depends(oauth2_scheme)):
    """
    Get the current authenticated user's profile.
    This endpoint allows any authenticated user to access their own profile information.
    """
    # Get current user from token
    current_user = await get_current_user(token)
    
    # Format response
    user_response = {
        "id": str(current_user["_id"]),
        "username": current_user["username"],
        "role": current_user["role"],
        "name": current_user["name"],
        "lastname": current_user["lastname"],
        "age": current_user["age"],
        "date_created": current_user["date_created"],
        "contact_info": current_user["contact_info"],
        "is_active": current_user.get("is_active", True),
        "permission_groups": current_user.get("permission_groups", [])
    }
    
    return user_response

# Get user by ID
@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user_by_id(
    user_id: str,
    token: str = Depends(oauth2_scheme)
):
    # Get current user and check permissions
    current_user = await get_current_user(token)
    
    # Check if the requested user exists
    try:
        user = users_collection.find_one({"_id": ObjectId(user_id)})
    except:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format"
        )
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check if the current user has permission to view this user
    current_user_id = str(current_user["_id"])
    
    # Allow users to access their own profile
    if current_user_id == user_id:
        # Users can always access their own profile
        pass
    elif current_user["role"] == UserRole.DOCTOR and current_user_id != user_id:
        # Doctors can only view their own profile
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Doctors can only view their own profile"
        )
    elif current_user["role"] == UserRole.TECHNICIAN and user["role"] != UserRole.DOCTOR and current_user_id != user_id:
        # Technicians can only view doctor profiles or their own profile
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Technicians can only view doctor profiles or their own profile"
        )
    
    # Format response
    user["id"] = str(user.pop("_id"))
    user.pop("password", None)
    
    return user

# Update user by ID
@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    user_update: UserUpdate,
    request: Request,
    token: str = Depends(oauth2_scheme)
):
    try:
        # Flag to track if we've created a permissions-specific log
        permissions_log_created = False
        
        # Get current user and check permissions
        current_user = await get_current_user(token)
        
        # Check if the requested user exists
        try:
            existing_user = users_collection.find_one({"_id": ObjectId(user_id)})
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid user ID format: {str(e)}"
            )
        
        if not existing_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Current user ID as string for comparison
        current_user_id = str(current_user["_id"])
        
        # Check permissions based on roles
        if current_user["role"] == UserRole.DOCTOR:
            # Doctors can only update their own profile
            if current_user_id != user_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Doctors can only update their own profile"
                )
            
            # Doctors cannot update permissions or status
            if user_update.permission_groups is not None or user_update.is_active is not None:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Doctors cannot update permissions or status"
                )
        
        elif current_user["role"] == UserRole.TECHNICIAN:
            # Technicians can update their own profile or doctor profiles
            if current_user_id != user_id and existing_user["role"] != UserRole.DOCTOR:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Technicians can only update their own profile or doctor accounts"
                )
                
            # Technicians updating their own profile cannot update permissions or status
            if current_user_id == user_id and (user_update.permission_groups is not None or user_update.is_active is not None):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Technicians cannot update their own permissions or status"
                )
        
        # Prepare update data
        update_data = {}
        old_values = {}
        
        if user_update.name is not None:
            old_values["name"] = existing_user.get("name")
            update_data["name"] = user_update.name
        
        if user_update.lastname is not None:
            old_values["lastname"] = existing_user.get("lastname")
            update_data["lastname"] = user_update.lastname
        
        if user_update.age is not None:
            old_values["age"] = existing_user.get("age")
            update_data["age"] = user_update.age
        
        if user_update.contact_info is not None:
            old_values["contact_info"] = existing_user.get("contact_info")
            update_data["contact_info"] = user_update.contact_info.dict()
        
        if user_update.is_active is not None:
            old_values["is_active"] = existing_user.get("is_active")
            update_data["is_active"] = user_update.is_active
            
        # Handle password update
        if user_update.password is not None:
            # Don't store old password in logs for security
            update_data["hashed_password"] = hash_password(user_update.password)

            # Determine the appropriate action type
            action_type = LogType.PASSWORD_CHANGE
            if existing_user["role"] == UserRole.DOCTOR:
                action_type = LogType.DOCTOR_PASSWORD_CHANGE

            # Log password change separately
            await log_activity(
                action=action_type,
                description=f"User {current_user['username']} reset the password for {existing_user['username']} ({existing_user.get('name', '')} {existing_user.get('lastname', '')})",
                user_id=str(current_user["_id"]),
                username=current_user["username"],
                ip_address=request.client.host,
                details={
                    "target_user": existing_user["username"],
                    "target_id": str(existing_user["_id"]),
                    "target_name": f"{existing_user.get('name', '')} {existing_user.get('lastname', '')}",
                    "target_role": existing_user["role"]
                }
            )
        
        # Handle permission groups
        if user_update.permission_groups is not None:
            old_values["permission_groups"] = existing_user.get("permission_groups", [])
            update_data["permission_groups"] = user_update.permission_groups
            
            old_perms = old_values.get("permission_groups", [])
            new_perms = user_update.permission_groups
            
            # Determine if permissions were added, removed, or modified
            if len(new_perms) > len(old_perms):
                added = [p for p in new_perms if p not in old_perms]
                description = f"User {current_user['username']} added permissions ({', '.join(added)}) for {existing_user['username']}"
            elif len(new_perms) < len(old_perms):
                removed = [p for p in old_perms if p not in new_perms]
                description = f"User {current_user['username']} removed permissions ({', '.join(removed)}) from {existing_user['username']}"
            else:
                description = f"User {current_user['username']} modified permissions for {existing_user['username']}"
            
            # Determine the appropriate action type
            action_type = LogType.UPDATE_PERMISSIONS
            if existing_user["role"] == UserRole.DOCTOR:
                action_type = LogType.DOCTOR_PERMISSIONS_UPDATE
            
            await log_activity(
                action=action_type,
                description=description,
                user_id=str(current_user["_id"]),
                username=current_user["username"],
                ip_address=request.client.host,
                details={
                    "target_user": existing_user["username"],
                    "target_name": f"{existing_user.get('name', '')} {existing_user.get('lastname', '')}",
                    "old_permission_groups": old_values["permission_groups"],
                    "new_permission_groups": user_update.permission_groups
                }
            )
            
            # Set flag to indicate we've created a permissions log
            permissions_log_created = True
        
        # Only update if there's something to update
        if update_data:
            try:
                result = users_collection.update_one(
                    {"_id": ObjectId(user_id)},
                    {"$set": update_data}
                )
                
                if result.modified_count == 0 and result.matched_count > 0:
                    # The document was found but not modified (might be same data)
                    print(f"User {user_id} found but not modified. Data might be identical.")
                elif result.matched_count == 0:
                    # No document matched for update
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="User not found or could not be updated"
                    )
                
                # Log user update
                description = f"User {current_user['username']} updated {existing_user['username']}"
                
                # Skip creating a generic update log if we've already created a permissions log
                # and the only thing that was updated was permissions
                if (permissions_log_created and ('permission_groups' in update_data and len(update_data.keys()) <= 2)) or \
                   ('hashed_password' in update_data and len(update_data.keys()) == 1):
                    # We allow up to 2 keys since hashed_password might be present too, but we log that separately
                    # Also skip if only the password was changed (we already log that separately)
                    print(f"Skipping generic update log since we already created a specific log")
                else:
                    # Add more specific descriptions for certain update types
                    if 'is_active' in update_data:
                        status_change = "activated" if update_data['is_active'] else "deactivated"
                        description = f"User {current_user['username']} {status_change} the account of {existing_user['username']} ({existing_user.get('name', '')} {existing_user.get('lastname', '')})"
                    elif 'contact_info' in update_data:
                        description = f"User {current_user['username']} updated contact information for {existing_user['username']} ({existing_user.get('name', '')} {existing_user.get('lastname', '')})"
                    else:
                        description = f"User {current_user['username']} ({current_user.get('name', '')} {current_user.get('lastname', '')}) updated {existing_user['username']} ({existing_user.get('name', '')} {existing_user.get('lastname', '')})"
                    
                    # Determine the appropriate action type
                    action_type = LogType.UPDATE_USER
                    if existing_user["role"] == UserRole.DOCTOR:
                        action_type = LogType.UPDATE_DOCTOR
                    
                    await log_activity(
                        action=action_type,
                        description=description,
                        user_id=str(current_user["_id"]),
                        username=current_user["username"],
                        ip_address=request.client.host,
                        details={
                            "target_user": existing_user["username"],
                            "target_name": f"{existing_user.get('name', '')} {existing_user.get('lastname', '')}",
                            "updated_fields": list(update_data.keys()),
                            "old_values": old_values,
                            "new_values": update_data
                        }
                    )
            except Exception as e:
                # Database operation failed
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to update user: {str(e)}"
                )
        
        # Manually prepare the updated user response instead of calling get_user_by_id
        # This avoids the second token validation that might be causing the 401 error
        updated_user_data = users_collection.find_one({"_id": ObjectId(user_id)})
        if updated_user_data:
            updated_user_data["id"] = str(updated_user_data.pop("_id"))
            updated_user_data.pop("password", None)
            return updated_user_data
        
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found after update"
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions as they already have the correct format
        raise
    except Exception as e:
        # Catch any other exceptions
        print(f"Unexpected error updating user {user_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred: {str(e)}"
        )

# Delete user by ID
@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    request: Request,
    token: str = Depends(oauth2_scheme)
):
    # Get current user and check permissions
    current_user = await get_current_user(token)
    
    # Only admin and technician can delete users
    if current_user["role"] == UserRole.DOCTOR:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Doctors cannot delete user accounts"
        )
    
    # Check if the requested user exists
    try:
        user_to_delete = users_collection.find_one({"_id": ObjectId(user_id)})
    except:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format"
        )
    
    if not user_to_delete:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check role-based permissions
    if current_user["role"] == UserRole.TECHNICIAN:
        # Technicians can only delete doctors
        if user_to_delete["role"] != UserRole.DOCTOR:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Technicians can only delete doctor accounts"
            )
    
    # Delete the user
    users_collection.delete_one({"_id": ObjectId(user_id)})
    
    # Determine the appropriate action type
    action_type = LogType.DELETE_USER
    if user_to_delete["role"] == UserRole.DOCTOR:
        action_type = LogType.DELETE_DOCTOR
    
    # Log user deletion
    await log_activity(
        action=action_type,
        description=f"User {current_user['username']} deleted {user_to_delete['role']} account: {user_to_delete['username']} ({user_to_delete.get('name', '')} {user_to_delete.get('lastname', '')})",
        user_id=str(current_user["_id"]),
        username=current_user["username"],
        ip_address=request.client.host,
        details={
            "deleted_user": user_to_delete["username"],
            "deleted_name": f"{user_to_delete.get('name', '')} {user_to_delete.get('lastname', '')}",
            "deleted_role": user_to_delete["role"],
            "deleted_by": current_user["username"],
            "deleted_by_name": f"{current_user.get('name', '')} {current_user.get('lastname', '')}"
        }
    )
    
    return Response(status_code=status.HTTP_204_NO_CONTENT)

# Add new endpoint for updating current user's profile
@router.patch("/users/me", response_model=UserResponse)
async def update_current_user_profile(
    user_update: UserUpdate,
    request: Request,
    token: str = Depends(oauth2_scheme)
):
    """
    Update the current authenticated user's profile.
    This endpoint allows any authenticated user to update their own profile information.
    """
    # Get current user
    current_user = await get_current_user(token)
    current_user_id = str(current_user["_id"])
    
    # Restrict users from updating permissions or status on their own profile
    if user_update.permission_groups is not None or user_update.is_active is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot update your own permissions or status"
        )
    
    # Prepare update data
    update_data = {}
    updated_fields = []
    
    if user_update.name is not None:
        update_data["name"] = user_update.name
        updated_fields.append("name")
    
    if user_update.lastname is not None:
        update_data["lastname"] = user_update.lastname
        updated_fields.append("lastname")
    
    if user_update.age is not None:
        update_data["age"] = user_update.age
        updated_fields.append("age")
    
    if user_update.contact_info is not None:
        update_data["contact_info"] = user_update.contact_info.dict()
        updated_fields.append("contact_info")
    
    # Handle password update
    if user_update.password is not None:
        update_data["password"] = hash_password(user_update.password)
        updated_fields.append("password")
    
    # Update user in database
    if update_data:
        result = users_collection.update_one(
            {"_id": ObjectId(current_user_id)},
            {"$set": update_data}
        )
        
        if result.modified_count == 0 and result.matched_count > 0:
            # No changes were made - data was identical
            pass
    
    # Log the update activity
    if updated_fields:
        await log_activity(
            action=LogType.UPDATE_USER if current_user["role"] != UserRole.DOCTOR else LogType.UPDATE_DOCTOR,
            description=f"User {current_user['username']} updated their own profile",
            user_id=current_user_id,
            username=current_user["username"],
            ip_address=request.client.host,
            details={
                "updated_fields": updated_fields
            }
        )
    
    # Get updated user
    updated_user = users_collection.find_one({"_id": ObjectId(current_user_id)})
    updated_user["id"] = str(updated_user.pop("_id"))
    updated_user.pop("password", None)
    
    return updated_user 