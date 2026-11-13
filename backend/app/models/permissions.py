from enum import Enum
from typing import Dict, List

# Permission Groups
class PermissionGroup:
    MANAGE_PATIENTS = "manage_patients"
    MANAGE_EEG = "manage_eeg"
    MANAGE_REPORTS = "manage_reports"

# Define a mapping from permission groups to individual permissions
# This is useful for UI display and documentation purposes
PERMISSION_GROUP_MAP = {
    PermissionGroup.MANAGE_PATIENTS: [
        "view_patients", 
        "add_patients", 
        "edit_patients", 
        "delete_patients"
    ],
    PermissionGroup.MANAGE_EEG: [
        "upload_eeg", 
        "analyze_eeg", 
        "view_analysis"
    ],
    PermissionGroup.MANAGE_REPORTS: [
        "export_results", 
        "generate_reports"
    ]
}

# Legacy function for migration - will be removed in future versions
def get_groups_from_permissions(permissions: List[str]) -> List[str]:
    """Convert individual permissions to permission groups - for migration only"""
    groups = set()
    
    # Create mapping from individual permissions to groups
    permission_to_group = {}
    for group, perms in PERMISSION_GROUP_MAP.items():
        for perm in perms:
            permission_to_group[perm] = group
    
    # Map each permission to its group
    for permission in permissions:
        if permission in permission_to_group:
            groups.add(permission_to_group[permission])
        elif permission in [PermissionGroup.MANAGE_PATIENTS, 
                          PermissionGroup.MANAGE_EEG, 
                          PermissionGroup.MANAGE_REPORTS]:
            # If it's already a permission group, add it directly
            groups.add(permission)
    
    return list(groups) 