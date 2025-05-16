import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { UserService } from '../../../shared/services/user.service';
import { AuthService } from '../../../auth/auth.service';

interface Doctor {
  id: string;
  username: string;
  role: string;
  name: string;
  lastname: string;
  age: number;
  date_created: string;
  contact_info: {
    email: string;
    phone?: string;
    address?: string;
  };
  is_active: boolean;
  permission_groups: string[];
  created_by?: {
    id: string;
    username: string;
    name: string;
    lastname: string;
  };
}

@Component({
  selector: 'app-doctor-management',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, HttpClientModule],
  providers: [UserService, AuthService],
  templateUrl: './doctor-management.component.html',
  styleUrls: ['./doctor-management.component.css']
})
export class DoctorManagementComponent implements OnInit {
  doctors: Doctor[] = [];
  filteredDoctors: Doctor[] = [];
  selectedDoctor: Doctor | null = null;
  isLoading = true;
  errorMessage: string = '';
  successMessage = '';
  showCreateModal = false;
  showEditModal = false;
  showViewModal = false;
  showDeleteConfirm = false;
  doctorToDelete: string = '';
  activeFilter: 'all' | 'active' | 'inactive' = 'all';
  
  // New doctor data
  newDoctorData = {
    username: '',
    password: '',
    name: '',
    lastname: '',
    age: 30,
    email: '',
    phone: '',
    address: '',
    permission_groups: [] as string[],
    role: 'doctor'
  };
  
  showNewDoctorPassword = false;
  
  // Permission groups with descriptions and their included permissions
  permissionGroups = [
    { 
      id: 'manage_patients', 
      label: 'Manage Patients',
      description: 'View, add, edit, and delete patients',
    },
    { 
      id: 'manage_eeg', 
      label: 'Manage EEG',
      description: 'Upload and analyze EEG data',
    },
    { 
      id: 'manage_reports', 
      label: 'Manage Reports',
      description: 'Export results and generate reports',
    }
  ];
  
  // Map for displaying individual permissions in UI (for backwards compatibility)
  availablePermissions = [
    { value: 'view_patients', label: 'View Patients', group: 'manage_patients' },
    { value: 'add_patients', label: 'Add Patients', group: 'manage_patients' },
    { value: 'edit_patients', label: 'Edit Patients', group: 'manage_patients' },
    { value: 'delete_patients', label: 'Delete Patients', group: 'manage_patients' },
    { value: 'upload_eeg', label: 'Upload EEG', group: 'manage_eeg' },
    { value: 'analyze_eeg', label: 'Analyze EEG', group: 'manage_eeg' },
    { value: 'view_analysis', label: 'View Analysis', group: 'manage_eeg' },
    { value: 'export_results', label: 'Export Results', group: 'manage_reports' },
    { value: 'generate_reports', label: 'Generate Reports', group: 'manage_reports' }
  ];

  // Form data for editing
  editFormData = {
    name: '',
    lastname: '',
    age: 0,
    email: '',
    phone: '',
    address: '',
    is_active: true,
    permission_groups: [] as string[]
  };

  showPasswordField = false;
  newPassword = '';
  showPassword = false;

  // Search and filter
  searchQuery = '';

  constructor(
    private userService: UserService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadDoctors();
  }

  loadDoctors(): void {
    this.isLoading = true;
    this.userService.getUsers('doctor').subscribe({
      next: (data: Doctor[]) => {
        this.doctors = data;
        this.filteredDoctors = [...this.doctors];
        this.isLoading = false;
      },
      error: (error: any) => {
        this.errorMessage = 'Failed to load doctors. Please try again.';
        this.isLoading = false;
        console.error('Error loading doctors:', error);
      }
    });
  }

  refreshDoctors(): void {
    this.loadDoctors();
  }

  viewDoctorDetails(doctor: Doctor): void {
    this.selectedDoctor = doctor;
    this.showViewModal = true;
  }

  openCreateModal(): void {
    console.log('Opening create doctor modal');
    this.resetNewDoctorForm();
    this.errorMessage = '';
    this.successMessage = '';
    this.showCreateModal = true;
    
    // Focus the first input field after modal is shown
    setTimeout(() => {
      const usernameInput = document.getElementById('newUsername');
      if (usernameInput) {
        usernameInput.focus();
      }
    }, 100);
  }

  openEditModal(doctor: Doctor): void {
    this.selectedDoctor = doctor;
    
    // Populate the form with doctor data
    this.editFormData = {
      name: doctor.name,
      lastname: doctor.lastname,
      age: doctor.age,
      email: doctor.contact_info.email,
      phone: doctor.contact_info.phone || '',
      address: doctor.contact_info.address || '',
      is_active: doctor.is_active,
      permission_groups: doctor.permission_groups || []
    };
    
    // Reset password fields and messages
    this.showPasswordField = false;
    this.newPassword = '';
    this.showPassword = false;
    this.errorMessage = '';
    this.successMessage = '';
    
    this.showEditModal = true;
  }
  
  confirmDelete(doctorId: string): void {
    this.doctorToDelete = doctorId;
    this.showDeleteConfirm = true;
  }

  closeDeleteConfirm(): void {
    this.showDeleteConfirm = false;
    this.doctorToDelete = '';
  }

  closeViewModal(): void {
    this.showViewModal = false;
    this.selectedDoctor = null;
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.selectedDoctor = null;
    this.errorMessage = '';
    this.successMessage = '';
    this.showPasswordField = false;
    this.newPassword = '';
    this.showPassword = false;
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
    this.resetNewDoctorForm();
  }

  saveDoctorChanges(): void {
    if (!this.selectedDoctor) return;
    
    // Validate inputs
    if (!this.editFormData.name || !this.editFormData.lastname || !this.editFormData.email) {
      this.errorMessage = 'Please fill all required fields (Name, Last Name, Email)';
      return;
    }
    
    // Email validation
    const emailPattern = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;
    if (!emailPattern.test(this.editFormData.email)) {
      this.errorMessage = 'Please enter a valid email address';
      return;
    }
    
    // Age validation
    if (this.editFormData.age < 18 || this.editFormData.age > 100) {
      this.errorMessage = 'Age must be between 18 and 100';
      return;
    }
    
    // Ensure permission_groups is properly formatted
    const permissionGroups = Array.isArray(this.editFormData.permission_groups) 
      ? [...this.editFormData.permission_groups] 
      : [];
    
    // Create an object to hold only changed fields
    const updatedDoctor: any = {};
    let hasChanges = false;
    
    // Compare and add only changed fields
    if (this.editFormData.name !== this.selectedDoctor.name) {
      updatedDoctor.name = this.editFormData.name;
      hasChanges = true;
    }
    
    if (this.editFormData.lastname !== this.selectedDoctor.lastname) {
      updatedDoctor.lastname = this.editFormData.lastname;
      hasChanges = true;
    }
    
    if (this.editFormData.age !== this.selectedDoctor.age) {
      updatedDoctor.age = this.editFormData.age;
      hasChanges = true;
    }
    
    // Check changes in contact info
    const contactInfoChanged = (
      this.editFormData.email !== this.selectedDoctor.contact_info.email ||
      this.editFormData.phone !== (this.selectedDoctor.contact_info.phone || '') ||
      this.editFormData.address !== (this.selectedDoctor.contact_info.address || '')
    );
    
    if (contactInfoChanged) {
      updatedDoctor.contact_info = {
        email: this.editFormData.email,
        phone: this.editFormData.phone || '',
        address: this.editFormData.address || ''
      };
      hasChanges = true;
    }
    
    // Check if is_active changed
    if (this.editFormData.is_active !== this.selectedDoctor.is_active) {
      updatedDoctor.is_active = this.editFormData.is_active;
      hasChanges = true;
    }
    
    // Compare permission_groups - properly handle array comparison
    const origPermissions = this.selectedDoctor.permission_groups || [];
    const permissionsChanged = 
      permissionGroups.length !== origPermissions.length ||
      permissionGroups.some(p => !origPermissions.includes(p)) ||
      origPermissions.some(p => !permissionGroups.includes(p));
    
    if (permissionsChanged) {
      // Always make sure permission_groups is included
      updatedDoctor.permission_groups = permissionGroups;
      hasChanges = true;
      console.log('Permission groups changed from', origPermissions, 'to', permissionGroups);
    }
    
    // If nothing changed, just close the modal
    if (!hasChanges) {
      console.log('No changes detected, closing modal without update');
      this.closeEditModal();
      return;
    }
    
    // If we're updating permission_groups only, we need a special approach
    // The backend has an issue with processing permission_groups changes alone
    if (Object.keys(updatedDoctor).length === 1 && 'permission_groups' in updatedDoctor) {
      console.log('Only permission_groups changed - ensuring proper update format');
      // Add a harmless field that won't affect anything
      updatedDoctor.name = this.selectedDoctor.name;
    }
    
    this.errorMessage = '';
    console.log('Sending doctor update with changed fields only:', updatedDoctor);
    
    this.userService.updateUser(this.selectedDoctor.id, updatedDoctor).subscribe({
      next: (response) => {
        console.log('Doctor update successful:', response);
        this.closeEditModal();
        this.closeViewModal();
        this.loadDoctors();
      },
      error: (error) => {
        console.error('Error updating doctor:', error);
        
        // Check for the specific "not modified" error message
        const errorMsg = error.error?.detail || '';
        if (errorMsg.includes('not modified') || errorMsg.includes('identical')) {
          // This is actually not an error - the server found the record but didn't modify it
          // because the data is the same. We'll treat this as a success.
          console.log('Data was identical, treating as success');
          this.closeEditModal();
          this.closeViewModal();
          this.loadDoctors();
          return;
        }
        
        // Look for specific permission_groups error patterns
        const permissionError = 
          errorMsg.includes('permission_groups') || 
          errorMsg.includes('KeyError') ||
          errorMsg.includes('old_values');
        
        // Special handling for permission_groups error
        if ((error.status === 500 || error.status === 400) && permissionError) {
          console.log('Permission groups error detected, trying workaround');
          
          if ('permission_groups' in updatedDoctor && this.selectedDoctor) {
            console.log('Attempting specialized permissions update');
            // Specialized approach for permission-only updates
            const permissionUpdate = {
              // Include original data to avoid backend errors
              name: this.selectedDoctor.name,
              lastname: this.selectedDoctor.lastname,
              permission_groups: updatedDoctor.permission_groups
            };
            
            this.updateWithPermissionFix(permissionUpdate);
            return;
          } else {
            // Remove permission_groups and retry with other fields
            delete updatedDoctor.permission_groups;
            
            // Only proceed if there are still fields to update
            if (Object.keys(updatedDoctor).length > 0) {
              this.updateWithModifiedData(updatedDoctor);
              return;
            } else {
              this.errorMessage = 'Failed to update permissions. Other fields unchanged.';
              return;
            }
          }
        }
        
        // Provide more specific error messages based on HTTP status codes
        if (error.status === 400) {
          this.errorMessage = 'Invalid data format. Please check your inputs.';
        } else if (error.status === 401) {
          this.errorMessage = 'Authentication error. Please log in again.';
        } else if (error.status === 403) {
          this.errorMessage = 'You do not have permission to update this doctor.';
        } else if (error.status === 404) {
          this.errorMessage = 'Doctor not found.';
        } else if (error.status === 500) {
          this.errorMessage = 'Server error. Please try again later.';
        } else if (error.status === 0) {
          this.errorMessage = 'Server connection error. Please check your connection.';
        } else {
          this.errorMessage = `Failed to update doctor: ${error.error?.detail || 'Please try again.'}`;
        }
      }
    });
  }
  
  // New method to update with modified data after removing problematic fields
  updateWithModifiedData(updatedData: any): void {
    this.errorMessage = 'Retrying update without changing permissions...';
    
    this.userService.updateUser(this.selectedDoctor!.id, updatedData).subscribe({
      next: (response) => {
        console.log('Doctor partial update successful:', response);
        this.closeEditModal();
        this.closeViewModal();
        this.loadDoctors();
      },
      error: (error) => {
        console.error('Error in partial update:', error);
        this.errorMessage = 'Update failed. Please try again later.';
      }
    });
  }

  togglePermission(permission: string): void {
    const index = this.editFormData.permission_groups.indexOf(permission);
    if (index === -1) {
      this.editFormData.permission_groups.push(permission);
    } else {
      this.editFormData.permission_groups.splice(index, 1);
    }
  }

  hasPermission(permission: string): boolean {
    return this.editFormData.permission_groups.includes(permission);
  }

  deleteDoctor(): void {
    if (!this.doctorToDelete) return;
    
    this.userService.deleteUser(this.doctorToDelete).subscribe({
      next: () => {
        this.closeDeleteConfirm();
        this.loadDoctors();
      },
      error: (error) => {
        console.error('Error deleting doctor:', error);
        this.errorMessage = 'Failed to delete doctor. Please try again.';
      }
    });
  }

  toggleDoctorStatus(doctor: Doctor): void {
    // Store the original status before updating
    const originalStatus = doctor.is_active;
    
    // Update UI immediately to appear responsive
    const index = this.doctors.findIndex(d => d.id === doctor.id);
    if (index !== -1) {
      this.doctors[index] = { ...this.doctors[index], is_active: !originalStatus };
      // Update filtered list as well
      this.filteredDoctors = this.filteredDoctors.map(d => 
        d.id === doctor.id ? { ...d, is_active: !originalStatus } : d
      );
    }
    
    // Clear any previous error messages
    this.errorMessage = '';
    
    const updatedStatus = {
      is_active: !originalStatus
    };
    
    this.userService.updateUser(doctor.id, updatedStatus).subscribe({
      next: () => {
        // UI already updated, no need to reload
        // Clear any error messages
        this.errorMessage = '';
      },
      error: (error) => {
        console.error('Error updating doctor status:', error);
        // On error, revert the UI change
        if (index !== -1) {
          this.doctors[index] = { ...this.doctors[index], is_active: originalStatus };
          this.filteredDoctors = this.filteredDoctors.map(d => 
            d.id === doctor.id ? { ...d, is_active: originalStatus } : d
          );
        }
        
        // Set the error message
        if (error.message) {
          this.errorMessage = `Failed to update doctor status: ${error.message}`;
        } else {
          this.errorMessage = 'Failed to update doctor status. Please try again.';
        }
        
        // Clear error message after 5 seconds
        setTimeout(() => {
          this.errorMessage = '';
        }, 5000);
      }
    });
  }

  // Filter doctors by active status
  filterByStatus(status: 'all' | 'active' | 'inactive'): void {
    this.activeFilter = status;
    
    if (status === 'all') {
      this.filteredDoctors = [...this.doctors];
    } else if (status === 'active') {
      this.filteredDoctors = this.doctors.filter(doctor => doctor.is_active);
    } else {
      this.filteredDoctors = this.doctors.filter(doctor => !doctor.is_active);
    }
  }

  // Search doctors by name or username
  searchDoctors(searchTerm: string): void {
    if (!searchTerm) {
      this.filteredDoctors = [...this.doctors];
      return;
    }
    
    const term = searchTerm.toLowerCase();
    this.filteredDoctors = this.doctors.filter(doctor => 
      doctor.username.toLowerCase().includes(term) || 
      doctor.name.toLowerCase().includes(term) || 
      doctor.lastname.toLowerCase().includes(term)
    );
  }

  // Extract permission groups from individual permissions
  getPermissionGroups(permissions: string[]): string[] {
    const groups = new Set<string>();
    
    // Group permissions by their group
    permissions.forEach(permission => {
      const permissionObj = this.availablePermissions.find(p => p.value === permission);
      if (permissionObj) {
        groups.add(permissionObj.group);
      }
    });
    
    return Array.from(groups);
  }
  
  // Toggle a permission group
  togglePermissionGroup(groupId: string): void {
    // Ensure permission_groups is an array
    if (!Array.isArray(this.editFormData.permission_groups)) {
      this.editFormData.permission_groups = [];
    }
    
    // Make a copy of the array to ensure proper change detection
    const updatedPermissions = [...this.editFormData.permission_groups];
    
    const index = updatedPermissions.indexOf(groupId);
    if (index === -1) {
      // Add the permission
      updatedPermissions.push(groupId);
      console.log(`Added permission group: ${groupId}`);
    } else {
      // Remove the permission
      updatedPermissions.splice(index, 1);
      console.log(`Removed permission group: ${groupId}`);
    }
    
    // Assign the new array back to ensure change detection
    this.editFormData.permission_groups = updatedPermissions;
    console.log('Updated permissions:', this.editFormData.permission_groups);
  }
  
  // Check if a permission group is currently selected
  hasPermissionGroup(groupId: string): boolean {
    if (!Array.isArray(this.editFormData.permission_groups)) {
      return false;
    }
    return this.editFormData.permission_groups.includes(groupId);
  }

  // Check if doctor has the permission group
  hasDoctorPermissionGroup(doctor: Doctor, groupId: string): boolean {
    return doctor.permission_groups && doctor.permission_groups.includes(groupId);
  }

  // Get icon class based on whether doctor has all permissions in a group
  getPermissionIconClass(doctor: Doctor, groupId: string): string {
    return this.hasDoctorPermissionGroup(doctor, groupId) ? 'fas fa-check-circle' : 'fas fa-times-circle';
  }

  // Handle checkbox change event
  handlePermissionGroupChange(groupId: string, event: Event): void {
    const isChecked = (event.target as HTMLInputElement).checked;
    if (isChecked) {
      if (!this.editFormData.permission_groups.includes(groupId)) {
        this.editFormData.permission_groups.push(groupId);
      }
    } else {
      const index = this.editFormData.permission_groups.indexOf(groupId);
      if (index !== -1) {
        this.editFormData.permission_groups.splice(index, 1);
      }
    }
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  togglePasswordField(): void {
    this.showPasswordField = !this.showPasswordField;
    if (!this.showPasswordField) {
      this.newPassword = '';
      this.showPassword = false;
    }
  }

  updatePassword(): void {
    if (!this.selectedDoctor || !this.newPassword.trim()) {
      this.errorMessage = 'Please enter a valid password';
      return;
    }
    
    const passwordUpdate = {
      password: this.newPassword
    };
    
    this.userService.updateUser(this.selectedDoctor.id, passwordUpdate).subscribe({
      next: () => {
        this.successMessage = 'Password updated successfully';
        this.newPassword = '';
        this.showPasswordField = false;
        this.showPassword = false;
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          this.successMessage = '';
        }, 3000);
      },
      error: (error) => {
        console.error('Error updating password:', error);
        this.errorMessage = 'Failed to update password. Please try again.';
        
        // Clear error message after 3 seconds
        setTimeout(() => {
          this.errorMessage = '';
        }, 3000);
      }
    });
  }

  // New specialized method to handle permission updates with a workaround
  updateWithPermissionFix(updateData: any): void {
    if (!this.selectedDoctor) return;
    
    this.errorMessage = 'Applying permission changes...';
    
    // Create a more robust update payload that explicitly includes all required fields
    const robustUpdate = {
      // Include all original data to avoid any backend issues
      name: this.selectedDoctor.name,
      lastname: this.selectedDoctor.lastname,
      age: this.selectedDoctor.age,
      contact_info: {
        email: this.selectedDoctor.contact_info.email,
        phone: this.selectedDoctor.contact_info.phone || '',
        address: this.selectedDoctor.contact_info.address || ''
      },
      is_active: this.selectedDoctor.is_active,
      // Include the new permission groups
      permission_groups: updateData.permission_groups
    };
    
    console.log('Using specialized permission update with robust data:', robustUpdate);
    
    // Use specialized method that handles permission updates
    this.updatePermissionsOnly(this.selectedDoctor.id, updateData.permission_groups);
  }
  
  // Direct method to update just permissions - avoids the problematic backend logic
  updatePermissionsOnly(doctorId: string, permissions: string[]): void {
    if (!permissions || !Array.isArray(permissions)) {
      this.errorMessage = 'Invalid permission data';
      return;
    }
    
    console.log(`Directly updating permissions for doctor ${doctorId} to:`, permissions);
    
    // First get the current doctor to ensure we have the latest data
    this.userService.getUser(doctorId).subscribe({
      next: (doctor) => {
        // Create a complete update object with all original data
        const completeUpdate = {
          name: doctor.name,
          lastname: doctor.lastname,
          age: doctor.age,
          contact_info: doctor.contact_info,
          is_active: doctor.is_active,
          // Set the new permissions
          permission_groups: permissions
        };
        
        console.log('Sending complete doctor update with permissions:', completeUpdate);
        
        // Update the doctor with the complete data
        this.userService.updateUser(doctorId, completeUpdate).subscribe({
          next: (response) => {
            console.log('Permission update successful:', response);
            this.successMessage = 'Doctor permissions updated successfully';
            setTimeout(() => {
              this.closeEditModal();
              this.closeViewModal();
              this.loadDoctors();
            }, 1000);
          },
          error: (error) => {
            console.error('Error in permission update:', error);
            
            // Try one more fallback approach - modify the message to give user options
            this.errorMessage = 'Permission update failed. You can:';
            
            // Add an action button to the HTML message that will be handled by the appropriate UI elements
            setTimeout(() => {
              // Update UI with more options
              const messageEl = document.querySelector('.error-message');
              if (messageEl) {
                messageEl.innerHTML += `
                  <ul class="error-options">
                    <li>Try saving other fields first, then permissions separately</li>
                    <li>Ask an administrator to update the permissions</li>
                    <li>Check server logs for more details</li>
                  </ul>
                `;
              }
            }, 100);
          }
        });
      },
      error: (error) => {
        console.error('Error fetching doctor for permission update:', error);
        this.errorMessage = 'Failed to retrieve doctor data for permission update';
      }
    });
  }

  // Toggle password visibility for new doctor
  toggleNewDoctorPasswordVisibility(): void {
    this.showNewDoctorPassword = !this.showNewDoctorPassword;
  }
  
  // Toggle permission group for new doctor
  toggleNewDoctorPermissionGroup(groupId: string): void {
    const index = this.newDoctorData.permission_groups.indexOf(groupId);
    if (index === -1) {
      this.newDoctorData.permission_groups.push(groupId);
    } else {
      this.newDoctorData.permission_groups.splice(index, 1);
    }
  }
  
  // Reset new doctor form
  resetNewDoctorForm(): void {
    this.newDoctorData = {
      username: '',
      password: '',
      name: '',
      lastname: '',
      age: 30,
      email: '',
      phone: '',
      address: '',
      permission_groups: this.permissionGroups.map(group => group.id), // Initialize with all permission groups
      role: 'doctor'
    };
    this.showNewDoctorPassword = false;
    this.errorMessage = '';
    this.successMessage = '';
  }
  
  // Create new doctor
  createDoctor(): void {
    if (!this.newDoctorData.username || !this.newDoctorData.password ||
        !this.newDoctorData.name || !this.newDoctorData.lastname || !this.newDoctorData.email) {
      this.errorMessage = 'Please fill in all required fields';
      return;
    }

    // Create a properly formatted user object with contact_info as a nested object
    const formattedUserData = {
      username: this.newDoctorData.username,
      password: this.newDoctorData.password,
      role: this.newDoctorData.role,
      name: this.newDoctorData.name,
      lastname: this.newDoctorData.lastname,
      age: this.newDoctorData.age,
      contact_info: {
        email: this.newDoctorData.email,
        phone: this.newDoctorData.phone || '',
        address: this.newDoctorData.address || ''
      },
      permission_groups: this.newDoctorData.permission_groups
    };

    console.log('Sending formatted user data:', formattedUserData);

    this.userService.createUser(formattedUserData).subscribe({
      next: (response) => {
        this.successMessage = this.getDoctorSuccessMessage(response, 'created');
        this.closeCreateModal();
        this.refreshDoctors();
      },
      error: (error) => {
        this.errorMessage = 'Failed to create doctor. Please try again.';
        console.error('Error creating doctor:', error);
      }
    });
  }

  // Function to export the current filtered doctors list as CSV
  exportDoctorsList(): void {
    if (this.filteredDoctors.length === 0) {
      alert('No doctors data available to export');
      return;
    }
    
    // Generate CSV content
    const headers = ['ID', 'Username', 'Name', 'Last Name', 'Age', 'Email', 'Phone', 'Address', 'Active', 'Created Date'];
    const csvRows = [headers];
    
    for (const doctor of this.filteredDoctors) {
      const row = [
        doctor.id,
        doctor.username,
        doctor.name,
        doctor.lastname,
        doctor.age.toString(),
        doctor.contact_info.email,
        doctor.contact_info.phone || 'N/A',
        doctor.contact_info.address || 'N/A',
        doctor.is_active ? 'Yes' : 'No',
        new Date(doctor.date_created).toLocaleDateString()
      ];
      csvRows.push(row);
    }
    
    // Convert to CSV string
    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    
    // Download the CSV file
    this.downloadCSV(csvContent, 'doctors_list.csv');
  }
  
  // Helper function to download CSV file
  private downloadCSV(csvContent: string, filename: string): void {
    // Create a blob with CSV content
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // Create a download link
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  getDoctorFullName(doctor: Doctor): string {
    return `Dr. ${doctor.name} ${doctor.lastname}`;
  }

  getDoctorSuccessMessage(doctor: Doctor, action: string): string {
    return `Doctor ${this.getDoctorFullName(doctor)} ${action} successfully`;
  }
}
