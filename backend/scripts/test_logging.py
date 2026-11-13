#!/usr/bin/env python3
"""
Test script to verify that logs are being correctly written to the database.
This script will create test logs for login, logout, and other events.
"""

import sys
import os
from pathlib import Path
from datetime import datetime

# Add the parent directory to sys.path
sys.path.append(str(Path(__file__).resolve().parent.parent))

from app.utils.database import logs_collection
from app.utils.logger import log_activity
from app.models.log import LogType
import asyncio

async def create_test_logs():
    """Create test logs for different actions"""
    
    # Create a test login log
    login_log_id = await log_activity(
        action=LogType.LOGIN,
        description="Test user logged in successfully",
        user_id="test_user_id",
        username="test_user",
        ip_address="127.0.0.1",
        details={
            "success": True
        }
    )
    print(f"Created test login log with ID: {login_log_id}")
    
    # Small delay to ensure logs are processed in order
    await asyncio.sleep(0.2)
    
    # Create a test logout log
    logout_log_id = await log_activity(
        action=LogType.LOGOUT,
        description="Test user logged out",
        user_id="test_user_id",
        username="test_user",
        ip_address="127.0.0.1"
    )
    print(f"Created test logout log with ID: {logout_log_id}")
    
    # Small delay to ensure logs are processed in order
    await asyncio.sleep(0.2)
    
    # Create a test doctor update log
    update_log_id = await log_activity(
        action=LogType.UPDATE_DOCTOR,
        description="Test technician updated doctor TestDoctor",
        user_id="test_tech_id",
        username="test_technician",
        ip_address="127.0.0.1",
        details={
            "target_user": "TestDoctor",
            "target_name": "Test Doctor",
            "updated_fields": ["name", "contact_info"],
            "old_values": {
                "name": "Old Name",
                "contact_info": {
                    "email": "old@example.com"
                }
            },
            "new_values": {
                "name": "New Name",
                "contact_info": {
                    "email": "new@example.com"
                }
            }
        }
    )
    print(f"Created test update log with ID: {update_log_id}")
    
    # Small delay to ensure logs are processed in order
    await asyncio.sleep(0.2)
    
    # Create a test permission update log
    permission_log_id = await log_activity(
        action=LogType.DOCTOR_PERMISSIONS_UPDATE,
        description="Test technician updated permissions for doctor TestDoctor",
        user_id="test_tech_id",
        username="test_technician",
        ip_address="127.0.0.1",
        details={
            "target_user": "TestDoctor",
            "target_name": "Test Doctor",
            "old_permission_groups": ["manage_patients"],
            "new_permission_groups": ["manage_patients", "manage_eeg"]
        }
    )
    print(f"Created test permission update log with ID: {permission_log_id}")
    
    # Small delay before counting
    await asyncio.sleep(0.5)
    
    # Count total logs
    count = logs_collection.count_documents({})
    print(f"Total logs in database: {count}")
    
    # Verify logs by action type
    login_count = logs_collection.count_documents({"action": LogType.LOGIN})
    logout_count = logs_collection.count_documents({"action": LogType.LOGOUT})
    update_count = logs_collection.count_documents({"action": LogType.UPDATE_DOCTOR})
    permission_count = logs_collection.count_documents({"action": LogType.DOCTOR_PERMISSIONS_UPDATE})
    
    print(f"Login logs: {login_count}")
    print(f"Logout logs: {logout_count}")
    print(f"Update logs: {update_count}")
    print(f"Permission logs: {permission_count}")

if __name__ == "__main__":
    asyncio.run(create_test_logs()) 