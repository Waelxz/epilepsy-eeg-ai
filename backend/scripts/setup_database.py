#!/usr/bin/env python
"""
Setup MongoDB database collections for Epilepsy Application

This script creates the required collections with proper schema validation
for the Epilepsy Application doctor module.

Usage:
    python setup_database.py

Requirements:
    pymongo, python-dotenv
"""

import os
from pymongo import MongoClient
from pymongo.errors import ServerSelectionTimeoutError
from dotenv import load_dotenv
import json

# Load environment variables
load_dotenv()

# Get MongoDB URI from environment or use default
MONGO_URI = os.getenv("MONGO_URI", "REDACTED_MONGO_URI/")

def setup_database():
    """Create all required collections with proper schema validation"""
    try:
        # Connect to MongoDB
        client = MongoClient(MONGO_URI)
        db = client.epilepsy_db
        
        print(f"Connected to MongoDB at {MONGO_URI}")
        
        # Create patients collection
        patients_validator = {
            "$jsonSchema": {
                "bsonType": "object",
                "required": ["patientId", "firstName", "lastName", "dateOfBirth", "gender"],
                "properties": {
                    "patientId": { "bsonType": "string" },
                    "firstName": { "bsonType": "string" },
                    "lastName": { "bsonType": "string" },
                    "dateOfBirth": { "bsonType": "date" },
                    "gender": { "bsonType": "string", "enum": ["Male", "Female", "Other"] },
                    "contactInfo": {
                        "bsonType": "object",
                        "properties": {
                            "phone": { "bsonType": "string" },
                            "email": { "bsonType": "string" },
                            "address": { "bsonType": "string" }
                        }
                    },
                    "medicalHistory": { "bsonType": "string" },
                    "medications": { 
                        "bsonType": "array", 
                        "items": {
                            "bsonType": "object",
                            "properties": {
                                "name": { "bsonType": "string" },
                                "dosage": { "bsonType": "string" },
                                "frequency": { "bsonType": "string" }
                            }
                        }
                    },
                    "notes": { "bsonType": "string" },
                    "createdBy": { "bsonType": "objectId" },
                    "createdAt": { "bsonType": "date" },
                    "updatedAt": { "bsonType": "date" },
                    "isActive": { "bsonType": "bool" }
                }
            }
        }
        
        # Create analyses collection
        analyses_validator = {
            "$jsonSchema": {
                "bsonType": "object",
                "required": ["patientId", "fileName", "filePath", "modelUsed"],
                "properties": {
                    "patientId": { "bsonType": "objectId" },
                    "fileName": { "bsonType": "string" },
                    "filePath": { "bsonType": "string" },
                    "fileSize": { "bsonType": "number" },
                    "fileType": { "bsonType": "string" },
                    "uploadDate": { "bsonType": "date" },
                    "modelUsed": { "bsonType": "string" },
                    "status": {
                        "bsonType": "string",
                        "enum": ["queued", "processing", "completed", "failed"]
                    },
                    "processingStartTime": { "bsonType": "date" },
                    "processingEndTime": { "bsonType": "date" },
                    "result": {
                        "bsonType": "object",
                        "properties": {
                            "class": { "bsonType": "number" },
                            "probability": { "bsonType": "number" },
                            "interpretation": { "bsonType": "string" },
                            "metrics": {
                                "bsonType": "object",
                                "properties": {
                                    "accuracy": { "bsonType": "number" },
                                    "recall": { "bsonType": "number" },
                                    "precision": { "bsonType": "number" },
                                    "specificity": { "bsonType": "number" }
                                }
                            }
                        }
                    },
                    "notes": { "bsonType": "string" },
                    "createdBy": { "bsonType": "objectId" },
                    "createdAt": { "bsonType": "date" },
                    "reportGenerated": { "bsonType": "bool" },
                    "reportPath": { "bsonType": "string" }
                }
            }
        }
        
        # Create reports collection
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

        # Create collections with validators
        db.command("collMod", "patients", validator=patients_validator) if "patients" in db.list_collection_names() else db.create_collection("patients", validator=patients_validator)
        db.command("collMod", "analyses", validator=analyses_validator) if "analyses" in db.list_collection_names() else db.create_collection("analyses", validator=analyses_validator)
        db.command("collMod", "reports", validator=reports_validator) if "reports" in db.list_collection_names() else db.create_collection("reports", validator=reports_validator)
        
        print("Collections created or updated successfully")
        
        # Create indexes for better query performance
        db.patients.create_index([("patientId", 1)], unique=True)
        db.patients.create_index([("lastName", 1), ("firstName", 1)])
        db.analyses.create_index([("patientId", 1)])
        db.analyses.create_index([("status", 1)])
        db.analyses.create_index([("uploadDate", 1)])
        db.reports.create_index([("patientId", 1)])
        db.reports.create_index([("analysisId", 1)])
        
        print("Indexes created successfully")
        print("Database setup complete!")
        
    except ServerSelectionTimeoutError:
        print(f"Error: Could not connect to MongoDB at {MONGO_URI}")
        print("Please ensure MongoDB is running and the connection URI is correct")
    except Exception as e:
        print(f"Error setting up database: {e}")

if __name__ == "__main__":
    setup_database() 