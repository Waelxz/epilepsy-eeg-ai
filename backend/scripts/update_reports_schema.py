#!/usr/bin/env python
"""
Update Reports Schema for Epilepsy Application

This script updates the MongoDB reports collection to modify the schema validation
to only allow 'patient' and 'analysis' report types.

Usage:
    python update_reports_schema.py

Requirements:
    pymongo, python-dotenv
"""

import os
from pymongo import MongoClient
from pymongo.errors import ServerSelectionTimeoutError
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get MongoDB URI from environment or use default
MONGO_URI = os.getenv("MONGO_URI", "REDACTED_MONGO_URI/")

def update_reports_schema():
    """Update the reports collection with new schema validation"""
    try:
        # Connect to MongoDB
        client = MongoClient(MONGO_URI)
        db = client.epilepsy_db
        
        print(f"Connected to MongoDB at {MONGO_URI}")
        
        # Check if the reports collection exists
        if "reports" not in db.list_collection_names():
            print("Reports collection does not exist. No changes made.")
            return
        
        # Count existing reports
        reports_count = db.reports.count_documents({})
        print(f"Found {reports_count} existing reports")
        
        # Update report types for existing reports
        if reports_count > 0:
            clinical_reports = list(db.reports.find({"reportType": {"$in": ["clinical", "summary", "detailed"]}}))
            print(f"Found {len(clinical_reports)} reports with old report types to migrate")
            
            # Migrate existing reports to new types based on some logic
            for report in clinical_reports:
                report_id = report["_id"]
                old_type = report["reportType"]
                
                # Determine new type (default to "analysis" for simplicity)
                # You might want to implement more sophisticated logic here
                new_type = "analysis"
                
                print(f"Updating report {report_id} from '{old_type}' to '{new_type}'")
                db.reports.update_one(
                    {"_id": report_id},
                    {"$set": {"reportType": new_type}}
                )
                
            print("Existing reports updated successfully")
        
        # Create new validator for reports collection
        reports_validator = {
            "$jsonSchema": {
                "bsonType": "object",
                "required": ["analysisId", "patientId", "reportType", "generatedDate"],
                "properties": {
                    "analysisId": { "bsonType": "objectId" },
                    "patientId": { "bsonType": "objectId" },
                    "reportType": {
                        "bsonType": "string",
                        "enum": ["patient", "analysis"]
                    },
                    "generatedDate": { "bsonType": "date" },
                    "filePath": { "bsonType": "string" },
                    "content": { "bsonType": "string" },
                    "createdBy": { "bsonType": "objectId" },
                    "isShared": { "bsonType": "bool" },
                    "shareHistory": {
                        "bsonType": "array",
                        "items": {
                            "bsonType": "object",
                            "properties": {
                                "sharedWith": { "bsonType": "string" },
                                "sharedDate": { "bsonType": "date" },
                                "sharedBy": { "bsonType": "objectId" }
                            }
                        }
                    }
                }
            }
        }

        # Update the collection validator
        db.command("collMod", "reports", validator=reports_validator)
        print("Reports collection schema updated successfully")
        
    except ServerSelectionTimeoutError:
        print(f"Error: Could not connect to MongoDB at {MONGO_URI}")
        print("Please ensure MongoDB is running and the connection URI is correct")
    except Exception as e:
        print(f"Error updating schema: {e}")

if __name__ == "__main__":
    update_reports_schema() 