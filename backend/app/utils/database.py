from pymongo import MongoClient
from dotenv import load_dotenv
import os

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")

client = MongoClient(MONGO_URI)
db = client.epilepsy_db
users_collection = db.users
logs_collection = db.logs
ml_models_collection = db.ml_models