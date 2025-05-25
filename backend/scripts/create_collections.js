// MongoDB setup script for Epilepsy Application
// Run this with: mongo REDACTED_MONGO_URI/epilepsy_db create_collections.js

// Connect to the database
// const db = db.getSiblingDB('epilepsy_db'); // Uncomment this line if running directly with mongo shell

// Delete existing collections if needed (CAREFUL: THIS WILL DELETE ALL DATA)
// Uncomment the following lines if you want to recreate collections from scratch
// db.patients.drop();
// db.analyses.drop();
// db.reports.drop();

// Create patients collection
db.createCollection("patients", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["patientId", "firstName", "lastName", "dateOfBirth", "gender"],
      properties: {
        patientId: { bsonType: "string" },
        firstName: { bsonType: "string" },
        lastName: { bsonType: "string" },
        dateOfBirth: { bsonType: "date" },
        gender: { bsonType: "string", enum: ["Male", "Female", "Other"] },
        contactInfo: {
          bsonType: "object",
          properties: {
            phone: { bsonType: "string" },
            email: { bsonType: "string" },
            address: { bsonType: "string" }
          }
        },
        medicalHistory: { bsonType: "string" },
        medications: { 
          bsonType: "array",
          items: {
            bsonType: "object",
            properties: {
              name: { bsonType: "string" },
              dosage: { bsonType: "string" },
              frequency: { bsonType: "string" }
            }
          }
        },
        notes: { bsonType: "string" },
        createdBy: { bsonType: "objectId" },
        createdAt: { bsonType: "date" },
        updatedAt: { bsonType: "date" },
        isActive: { bsonType: "bool" }
      }
    }
  }
});

// Create analyses collection
db.createCollection("analyses", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["patientId", "fileName", "filePath", "modelUsed"],
      properties: {
        patientId: { bsonType: "objectId" },
        fileName: { bsonType: "string" },
        filePath: { bsonType: "string" },
        fileSize: { bsonType: "number" },
        fileType: { bsonType: "string" },
        uploadDate: { bsonType: "date" },
        modelUsed: { bsonType: "string" },
        status: { 
          bsonType: "string",
          enum: ["queued", "processing", "completed", "failed"] 
        },
        processingStartTime: { bsonType: "date" },
        processingEndTime: { bsonType: "date" },
        result: {
          bsonType: "object",
          properties: {
            class: { bsonType: "number" },
            probability: { bsonType: "number" },
            interpretation: { bsonType: "string" },
            metrics: {
              bsonType: "object",
              properties: {
                accuracy: { bsonType: "number" },
                recall: { bsonType: "number" },
                precision: { bsonType: "number" },
                specificity: { bsonType: "number" }
              }
            }
          }
        },
        notes: { bsonType: "string" },
        createdBy: { bsonType: "objectId" },
        createdAt: { bsonType: "date" },
        reportGenerated: { bsonType: "bool" },
        reportPath: { bsonType: "string" }
      }
    }
  }
});

// Create reports collection
db.createCollection("reports", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["analysisId", "patientId", "reportType", "generatedDate"],
      properties: {
        analysisId: { bsonType: "objectId" },
        patientId: { bsonType: "objectId" },
        reportType: { 
          bsonType: "string",
          enum: ["clinical", "summary", "detailed"]
        },
        generatedDate: { bsonType: "date" },
        filePath: { bsonType: "string" },
        content: { bsonType: "string" },
        createdBy: { bsonType: "objectId" },
        isShared: { bsonType: "bool" },
        shareHistory: { 
          bsonType: "array",
          items: {
            bsonType: "object",
            properties: {
              sharedWith: { bsonType: "string" },
              sharedDate: { bsonType: "date" },
              sharedBy: { bsonType: "objectId" }
            }
          }
        }
      }
    }
  }
});

// Create indexes for better query performance
db.patients.createIndex({ "patientId": 1 }, { unique: true });
db.patients.createIndex({ "lastName": 1, "firstName": 1 });
db.analyses.createIndex({ "patientId": 1 });
db.analyses.createIndex({ "status": 1 });
db.analyses.createIndex({ "uploadDate": 1 });
db.reports.createIndex({ "patientId": 1 });
db.reports.createIndex({ "analysisId": 1 });

print("Collections and indexes created successfully!"); 