#!/usr/bin/env python3
"""
Script to clear all logs from the database.
Run this script to delete all log entries for a fresh start.
"""

import sys
import os
from pathlib import Path

# Add the parent directory to sys.path so we can import from the app package
sys.path.append(str(Path(__file__).resolve().parent.parent))

from app.utils.database import logs_collection

def clear_logs():
    """Delete all logs from the logs collection"""
    try:
        result = logs_collection.delete_many({})
        print(f"Successfully deleted {result.deleted_count} log entries.")
        return result.deleted_count
    except Exception as e:
        print(f"Error deleting logs: {e}")
        return 0

if __name__ == "__main__":
    print("This script will delete ALL logs from the database.")
    confirmation = input("Are you sure you want to proceed? (y/n): ")
    
    if confirmation.lower() == 'y':
        count = clear_logs()
        if count > 0:
            print("Logs cleared successfully.")
        else:
            print("No logs were deleted or an error occurred.")
    else:
        print("Operation cancelled.") 