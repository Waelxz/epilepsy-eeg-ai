import bcrypt
from pymongo import MongoClient
from datetime import datetime

# Example: Hash a password
password = "15935"
hashed_password = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

# Define user details for the doctor
user_data = {
    "username": "0000X",
    "password": hashed_password,
    "role": "admin",
    "name": "Wael",
    "lastname": "Dridi",
    "age": 35,
    "date_created": datetime.now().isoformat(),
    "contact_info": {
        "email": "admin@example.com",
        "phone": "123-456-7890"
    },
    "is_active": True
}

# Connect to MongoDB
client = MongoClient("REDACTED_MONGO_URI")
db = client["epilepsy_db"]
users_collection = db["users"]

# Insert the user into the database
users_collection.insert_one(user_data)

print("User added successfully!")

