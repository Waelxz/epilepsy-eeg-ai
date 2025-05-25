#!/usr/bin/env python3
"""
Simple script to delete all logs from the database.
"""

import sys
import os
from pathlib import Path

# Add the parent directory to sys.path
sys.path.append(str(Path(__file__).resolve().parent.parent))

from app.utils.database import logs_collection

def delete_all_logs():
    """Delete all logs from the database"""
    try:
        result = logs_collection.delete_many({})
        count = result.deleted_count
        print(f"Successfully deleted {count} log entries.")
        return count
    except Exception as e:
        print(f"Error deleting logs: {e}")
        return 0

if __name__ == "__main__":
    delete_all_logs() 