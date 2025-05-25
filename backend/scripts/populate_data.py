#!/usr/bin/env python
"""
Populate MongoDB database with sample data for Epilepsy Application

This script inserts sample data into the 'patients' and 'analyses' collections
for testing and development purposes.

Usage:
    python populate_data.py

Requirements:
    pymongo, python-dotenv, faker
"""

import os
import random
from datetime import datetime, timedelta, date
from pymongo import MongoClient
from pymongo.errors import ServerSelectionTimeoutError, DuplicateKeyError
from bson import ObjectId
from dotenv import load_dotenv
from faker import Faker
import logging
import argparse

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Get MongoDB URI from environment or use default
MONGO_URI = os.getenv("MONGO_URI", "REDACTED_MONGO_URI/")

# Initialize Faker
fake = Faker()

# Sample EEG file names (for analyses)
EEG_FILES = [
    "eeg_recording_001.edf", "eeg_recording_002.edf", "eeg_recording_003.edf",
    "eeg_recording_004.edf", "eeg_recording_005.edf", "eeg_recording_006.edf",
    "eeg_recording_007.edf", "eeg_recording_008.edf", "eeg_recording_009.edf",
    "eeg_recording_010.edf", "eeg_recording_011.edf", "eeg_recording_012.edf",
]

# Sample ML models
ML_MODELS = ["CNN-LSTM v1.0", "CNN-LSTM v1.5", "CNN-LSTM v2.0", "BERN-EEGNet"]

# Sample medical history templates
MEDICAL_HISTORIES = [
    "Patient first experienced seizures at age {age}. Diagnosed with epilepsy in {year}. "
    "Family history includes epilepsy in maternal grandmother. Patient reports seizures "
    "are typically triggered by stress and sleep deprivation.",
    
    "Patient has had epilepsy since childhood, first diagnosed at age {age}. "
    "No known family history of neurological disorders. Seizures typically occur "
    "{frequency} and are preceded by aura lasting about 30 seconds.",
    
    "First seizure occurred after head trauma at age {age}. Diagnosed with post-traumatic "
    "epilepsy in {year}. Seizures are primarily tonic-clonic, occurring {frequency}.",
    
    "Patient has juvenile myoclonic epilepsy diagnosed at age {age}. Family history "
    "includes epilepsy in first-degree relatives. Seizures typically occur in the "
    "morning shortly after waking and are triggered by fatigue and alcohol consumption.",
    
    "Patient experienced first absence seizure at age {age}. Diagnosed with absence "
    "epilepsy in {year}. Seizures typically last 5-10 seconds with brief loss of awareness. "
    "Frequency has decreased with current medication regimen."
]

# Sample medications commonly prescribed for epilepsy
MEDICATIONS = [
    {"name": "Levetiracetam", "dosage": "500mg", "frequency": "Twice daily"},
    {"name": "Lamotrigine", "dosage": "200mg", "frequency": "Twice daily"},
    {"name": "Valproic acid", "dosage": "500mg", "frequency": "Three times daily"},
    {"name": "Carbamazepine", "dosage": "200mg", "frequency": "Twice daily"},
    {"name": "Oxcarbazepine", "dosage": "300mg", "frequency": "Twice daily"},
    {"name": "Topiramate", "dosage": "100mg", "frequency": "Twice daily"},
    {"name": "Phenytoin", "dosage": "100mg", "frequency": "Three times daily"},
    {"name": "Gabapentin", "dosage": "300mg", "frequency": "Three times daily"},
    {"name": "Zonisamide", "dosage": "100mg", "frequency": "Once daily"},
    {"name": "Ethosuximide", "dosage": "250mg", "frequency": "Twice daily"},
]

# Sample clinical notes templates
CLINICAL_NOTES = [
    "Patient has been responding well to current medication regimen. Seizure frequency "
    "has decreased from {old_frequency} to {new_frequency}. Continue monitoring and "
    "consider EEG follow-up in 3 months.",
    
    "Recent increase in seizure activity, possibly related to medication compliance issues. "
    "Discussed importance of consistent dosing. Will reassess in 1 month and consider "
    "medication adjustment if no improvement.",
    
    "Patient reports good seizure control with current medications. No adverse effects reported. "
    "Last seizure was more than {months} months ago. Recommend maintaining current treatment plan.",
    
    "Patient experiencing side effects from {medication} including {side_effects}. "
    "Consider reducing dosage or switching to alternative medication at next visit.",
    
    "Recent EEG shows improved patterns compared to previous studies. Seizure frequency decreased "
    "to {new_frequency}. Continue current treatment and follow up in 6 months."
]

# Sample side effects for medications
SIDE_EFFECTS = [
    "drowsiness and fatigue", 
    "dizziness and coordination problems", 
    "mild cognitive impairment", 
    "headaches and blurred vision",
    "insomnia and irritability", 
    "nausea and decreased appetite"
]

# Helper function to convert date to datetime at midnight
def convert_to_datetime(date_obj):
    return datetime.combine(date_obj, datetime.min.time())

def generate_patient():
    """Generate a single fake patient document"""
    
    gender = random.choice(["Male", "Female"])
    first_name = fake.first_name_male() if gender == "Male" else fake.first_name_female()
    last_name = fake.last_name()
    
    # Generate date of birth (between 18 and 80 years ago)
    age = random.randint(18, 80)
    date_of_birth = fake.date_of_birth(minimum_age=age, maximum_age=age)
    # Convert date to datetime for MongoDB compatibility
    date_of_birth = convert_to_datetime(date_of_birth)
    
    # Generate random number of medications (0-3)
    num_meds = random.randint(0, 3)
    patient_meds = random.sample(MEDICATIONS, num_meds) if num_meds > 0 else []
    
    # Generate medical history with age-appropriate details
    seizure_age = random.randint(5, age-5)  # First seizure happened at least 5 years ago
    diagnosis_year = datetime.now().year - random.randint(1, 10)  # Diagnosed in the last 10 years
    seizure_frequency = random.choice(["monthly", "weekly", "every 2-3 months", "every 6 months"])
    
    medical_history = random.choice(MEDICAL_HISTORIES).format(
        age=seizure_age,
        year=diagnosis_year,
        frequency=seizure_frequency
    )
    
    # Generate clinical notes
    old_frequency = random.choice(["3-4 per month", "weekly", "2-3 per week", "daily"])
    new_frequency = random.choice(["1-2 per month", "monthly", "every 2-3 months", "every 6 months"])
    months_since = random.randint(2, 18)
    random_medication = random.choice(MEDICATIONS)["name"]
    random_side_effects = random.choice(SIDE_EFFECTS)
    
    notes = random.choice(CLINICAL_NOTES).format(
        old_frequency=old_frequency,
        new_frequency=new_frequency,
        months=months_since,
        medication=random_medication,
        side_effects=random_side_effects
    )
    
    # Generate a creation date (within the past 2 years)
    created_days_ago = random.randint(0, 730)  # Up to 2 years ago
    created_at = datetime.now() - timedelta(days=created_days_ago)
    
    # Generate a patient ID (P + random number)
    patient_id = f"P{random.randint(100000, 999999)}"
    
    return {
        "patientId": patient_id,
        "firstName": first_name,
        "lastName": last_name,
        "dateOfBirth": date_of_birth,
        "gender": gender,
        "contactInfo": {
            "phone": fake.phone_number(),
            "email": fake.email(),
            "address": fake.address().replace('\n', ', ')
        },
        "medicalHistory": medical_history,
        "medications": patient_meds,
        "notes": notes,
        "analysisStatus": {
            "hasAnalysis": False,
            "totalAnalysisCount": 0,
            "abnormalResultCount": 0,
            "normalResultCount": 0,
            "pendingAnalysisCount": 0
        },
        "createdAt": created_at,
        "updatedAt": created_at,
        "isActive": True
    }

def generate_analyses(patient_id, count=None):
    """Generate a list of analyses for a patient"""
    if count is None:
        # Generate a random number of analyses (0-5)
        count = random.randint(0, 5)
    
    analyses = []
    
    for i in range(count):
        # Generate a date for this analysis (within the past year)
        days_ago = random.randint(0, 365)
        upload_date = datetime.now() - timedelta(days=days_ago)
        
        # Add processing time (0-2 hours)
        processing_hours = random.uniform(0, 2)
        processing_start = upload_date + timedelta(minutes=random.randint(5, 30))
        processing_end = processing_start + timedelta(hours=processing_hours)
        
        # Determine status (most analyses should be completed)
        status_weights = [('completed', 85), ('processing', 5), ('queued', 5), ('failed', 5)]
        status = random.choices([s[0] for s in status_weights], weights=[s[1] for s in status_weights])[0]
        
        # Generate analysis result if status is completed
        result = None
        if status == 'completed':
            # 60% chance of abnormal (class 1), 40% chance of normal (class 0)
            classification = random.choices([1, 0], weights=[60, 40])[0]
            
            # Generate probability - higher confidence for normal results
            if classification == 0:
                probability = random.uniform(0.70, 0.99)
                interpretation = "Normal EEG patterns. No significant epileptic activity detected."
            else:
                probability = random.uniform(0.65, 0.99)
                interpretation = "Abnormal EEG patterns detected. Consistent with epileptic seizure activity."
            
            result = {
                "class": classification,
                "probability": probability,
                "interpretation": interpretation,
                "metrics": {
                    "accuracy": random.uniform(0.80, 0.95),
                    "recall": random.uniform(0.75, 0.95),
                    "precision": random.uniform(0.75, 0.95),
                    "specificity": random.uniform(0.75, 0.95)
                }
            }
        
        # Select a random EEG file and model
        file_name = random.choice(EEG_FILES)
        model_used = random.choice(ML_MODELS)
        
        analysis = {
            "patientId": patient_id,
            "fileName": file_name,
            "filePath": f"/uploads/eeg/{upload_date.strftime('%Y%m%d')}/{file_name}",
            "fileSize": random.randint(5000000, 50000000),  # 5-50 MB
            "fileType": "edf",
            "uploadDate": upload_date,
            "modelUsed": model_used,
            "status": status,
            "processingStartTime": processing_start if status != 'queued' else None,
            "processingEndTime": processing_end if status == 'completed' or status == 'failed' else None,
            "result": result,
            "notes": "Standard EEG recording, patient was cooperative during the session.",
            "createdAt": upload_date,
            "reportGenerated": random.choice([True, False]) if status == 'completed' else False,
            "reportPath": f"/reports/{upload_date.strftime('%Y%m%d')}/{file_name.replace('.edf', '.pdf')}" if status == 'completed' and random.choice([True, False]) else None
        }
        
        analyses.append(analysis)
    
    return analyses

def populate_database(patient_count=20, max_analyses_per_patient=3, clean_db=True):
    """Populate the database with fake data"""
    try:
        # Connect to MongoDB
        client = MongoClient(MONGO_URI)
        db = client.epilepsy_db
        
        logger.info(f"Connected to MongoDB at {MONGO_URI}")
        
        patients_collection = db.patients
        analyses_collection = db.analyses
        
        # Clear existing data if requested
        if clean_db:
            logger.warning("Cleaning database collections before insertion")
            patients_delete_result = patients_collection.delete_many({})
            analyses_delete_result = analyses_collection.delete_many({})
            logger.warning(f"Deleted {patients_delete_result.deleted_count} patients and {analyses_delete_result.deleted_count} analyses")
        
        # Insert patients and analyses
        inserted_patients = 0
        inserted_analyses = 0
        
        for i in range(patient_count):
            patient = generate_patient()
            
            try:
                # Insert patient
                result = patients_collection.insert_one(patient)
                patient_id = result.inserted_id
                inserted_patients += 1
                
                # Generate and insert analyses for this patient
                analyses_count = random.randint(0, max_analyses_per_patient)
                if analyses_count > 0:
                    analyses = generate_analyses(patient_id, analyses_count)
                    if analyses:
                        result = analyses_collection.insert_many(analyses)
                        inserted_analyses += len(result.inserted_ids)
                        
                        # Update analysisStatus based on the analyses we just created
                        completed_analyses = [a for a in analyses if a["status"] == "completed"]
                        abnormal_count = sum(1 for a in completed_analyses if a["result"] and a["result"]["class"] == 1)
                        normal_count = sum(1 for a in completed_analyses if a["result"] and a["result"]["class"] == 0)
                        pending_count = sum(1 for a in analyses if a["status"] in ["queued", "processing"])
                        
                        # Find the most recent analysis
                        last_analysis = None
                        if completed_analyses:
                            last_analysis = max(completed_analyses, key=lambda a: a["uploadDate"])
                        
                        # Update patient's analysisStatus
                        analysis_status_update = {
                            "hasAnalysis": True,
                            "totalAnalysisCount": len(analyses),
                            "abnormalResultCount": abnormal_count,
                            "normalResultCount": normal_count,
                            "pendingAnalysisCount": pending_count
                        }
                        
                        # Add last result data if available
                        if last_analysis and last_analysis["result"]:
                            analysis_status_update["lastAnalysisDate"] = last_analysis["uploadDate"]
                            analysis_status_update["lastResult"] = {
                                "class": last_analysis["result"]["class"],
                                "probability": last_analysis["result"]["probability"],
                                "modelId": last_analysis["modelUsed"]
                            }
                        
                        # Update the patient document
                        patients_collection.update_one(
                            {"_id": patient_id},
                            {"$set": {"analysisStatus": analysis_status_update}}
                        )
                        
                logger.info(f"Added patient {patient['firstName']} {patient['lastName']} with {analyses_count} analyses")
                
            except DuplicateKeyError:
                logger.warning(f"Duplicate patient ID {patient['patientId']}, skipping")
                continue
            except Exception as e:
                logger.error(f"Error inserting data: {e}")
                continue
                
        logger.info(f"Database populated successfully with {inserted_patients} patients and {inserted_analyses} analyses")
        
    except ServerSelectionTimeoutError:
        logger.error(f"Error: Could not connect to MongoDB at {MONGO_URI}")
        logger.error("Please ensure MongoDB is running and the connection URI is correct")
    except Exception as e:
        logger.error(f"Error populating database: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Populate MongoDB with sample patient and analysis data')
    parser.add_argument('--patients', type=int, default=20, help='Number of patients to generate')
    parser.add_argument('--max-analyses', type=int, default=5, help='Maximum number of analyses per patient')
    parser.add_argument('--clean', action='store_true', help='Clean existing collections before insertion')
    
    args = parser.parse_args()
    
    logger.info("Starting data population process...")
    populate_database(patient_count=args.patients, max_analyses_per_patient=args.max_analyses, clean_db=True)
    logger.info("Data population complete!") 