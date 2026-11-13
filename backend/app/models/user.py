from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum

class UserRole(str, Enum):
    DOCTOR = "doctor"
    TECHNICIAN = "technician"
    ADMIN = "admin"

# Permission enum kept for reference but deprecated
# Use permission groups instead
class Permission(str, Enum):
    VIEW_PATIENTS = "view_patients"
    ADD_PATIENTS = "add_patients"
    EDIT_PATIENTS = "edit_patients"
    DELETE_PATIENTS = "delete_patients"
    UPLOAD_EEG = "upload_eeg"
    ANALYZE_EEG = "analyze_eeg"
    VIEW_ANALYSIS = "view_analysis"
    EXPORT_RESULTS = "export_results"
    GENERATE_REPORTS = "generate_reports"

class User(BaseModel):
    username: str
    password: str
    role: UserRole
    name: str
    lastname: str
    age: int
    date_created: str
    contact_info: dict
    is_active: bool
    permission_groups: Optional[List[str]] = []
    created_by: Optional[str] = None