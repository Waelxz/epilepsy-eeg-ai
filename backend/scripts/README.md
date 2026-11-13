# Backend Scripts

This directory contains utility scripts for the Epilepsy Application backend.

## Database Setup and Population

### Setting up the database

Before running the application, you should set up the database collections with proper schema validation:

```bash
python setup_database.py
```

This will create the required collections (patients, analyses, reports) with proper schema validation and indexes.

### Populating with sample data

To populate the database with sample data for testing and development:

```bash
python populate_data.py
```

By default, this will create:
- 50 patients with randomized information
- Up to 5 analyses per patient (randomly distributed)

#### Command-line options

The script now supports several command-line options:

```bash
# Generate 100 patients instead of the default 50
python populate_data.py --patients 100

# Set a maximum of 3 analyses per patient
python populate_data.py --max-analyses 3

# Clean existing collections before inserting new data
python populate_data.py --clean

# Combine multiple options
python populate_data.py --patients 30 --max-analyses 2 --clean
```

### Requirements

Make sure you have all dependencies installed:

```bash
pip install -r ../requirements.txt
```

### Database Configuration

These scripts use the MongoDB connection URI from the `.env` file in the project root. Make sure you have a `.env` file with the following settings:

```
MONGO_URI=REDACTED_MONGO_URI/
```

Replace with your actual MongoDB URI if different.

## Other Scripts

- `update_user_schema.py` - Updates user schema when needed
- `create_collections.js` - Alternative way to create collections using MongoDB shell
- `clear_logs.py` - Clears log entries older than specified days
- `delete_logs.py` - Deletes all logs
- `insertuser.py` - Creates a test user
- `test_logging.py` - Tests the logging system 