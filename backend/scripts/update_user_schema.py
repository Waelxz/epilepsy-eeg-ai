#!/usr/bin/env python3
"""
Script to update the MongoDB schemas with new fields for patients and users.
"""
import os
from dotenv import load_dotenv
import pymongo
from pymongo import MongoClient
from datetime import datetime

# Load environment variables
load_dotenv()

# Connect to MongoDB
MONGO_URI = os.getenv("MONGO_URI")
client = MongoClient(MONGO_URI)
db = client.epilepsy_db

print("Starting schema update process...")


# Update existing patients with default analysisStatus 
patients = list(db.patients.find({"analysisStatus": {"$exists": False}}))
print(f"Found {len(patients)} patients without analysisStatus field")

default_analysis_status = {
    "hasAnalysis": False,
    "totalAnalysisCount": 0,
    "abnormalResultCount": 0,
    "normalResultCount": 0,
    "pendingAnalysisCount": 0
}

patient_updates = 0
for patient in patients:
    # Check if patient has any analyses
    analyses = list(db.analyses.find({"patientId": str(patient["_id"])}))
    
    if analyses:
        # Calculate analysis stats
        analysis_status = {
            "hasAnalysis": True,
            "totalAnalysisCount": len(analyses),
            "lastAnalysisDate": max(a.get("createdAt", datetime.now()) for a in analyses),
            "abnormalResultCount": sum(1 for a in analyses if a.get("result", {}).get("class") == 1),
            "normalResultCount": sum(1 for a in analyses if a.get("result", {}).get("class") == 0),
            "pendingAnalysisCount": sum(1 for a in analyses if a.get("status") == "queued" or a.get("status") == "processing")
        }
        
        # Get last analysis result if available
        completed_analyses = [a for a in analyses if a.get("status") == "completed"]
        if completed_analyses:
            latest_analysis = max(completed_analyses, key=lambda a: a.get("createdAt", datetime.now()))
            if "result" in latest_analysis:
                analysis_status["lastResult"] = {
                    "class": latest_analysis["result"].get("class"),
                    "probability": latest_analysis["result"].get("probability"),
                    "modelId": latest_analysis.get("modelUsed")
                }
    else:
        analysis_status = default_analysis_status
    
    # Update the patient document
 

print(f"Updated {patient_updates} patients with analysis status information")

# Update the collection validator for patients to include analysisStatus
try:
    db.command({
        "collMod": "patients",
        "validator": {
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
                    "isActive": { "bsonType": "bool" },
                    "analysisStatus": {
                        "bsonType": "object",
                        "properties": {
                            "hasAnalysis": { "bsonType": "bool" },
                            "lastAnalysisDate": { "bsonType": "date" },
                            "totalAnalysisCount": { "bsonType": "int" },
                            "lastResult": {
                                "bsonType": "object",
                                "properties": {
                                    "class": { "bsonType": "int" },
                                    "probability": { "bsonType": "double" },
                                    "modelId": { "bsonType": "string" }
                                }
                            },
                            "abnormalResultCount": { "bsonType": "int" },
                            "normalResultCount": { "bsonType": "int" },
                            "pendingAnalysisCount": { "bsonType": "int" }
                        }
                    }
                }
            }
        }
    })
    print("Successfully updated patient collection schema")
except Exception as e:
    print(f"Error updating patient collection schema: {e}")

print("Schema update completed.") 