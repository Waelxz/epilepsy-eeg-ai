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
    this.showPasswordField = false;
    this.newPassword = '';
    this.errorMessage = '';
    this.successMessage = '';
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
    this.resetNewDoctorForm();
  }

  saveDoctorChanges(): void {
    if (!this.selectedDoctor) return;
    
    const doctorId = this.selectedDoctor.id;
    
    // Prepare update data
    const updateData: any = {
      name: this.editFormData.name,
      lastname: this.editFormData.lastname,
      age: this.editFormData.age,
      contact_info: {
        email: this.editFormData.email,
        phone: this.editFormData.phone,
        address: this.editFormData.address
      },
      is_active: this.editFormData.is_active,
      permission_groups: this.editFormData.permission_groups
    };
    
    // Add password if provided
    if (this.showPasswordField && this.newPassword.trim()) {
      updateData.password = this.newPassword;
    }
    
    // Update the doctor
    this.userService.updateUser(doctorId, updateData).subscribe({
      next: (response) => {
        // Update the local data
        this.updateWithModifiedData(response);
        
        this.successMessage = this.getDoctorSuccessMessage(this.selectedDoctor!, 'updated');
        
        // Close modal after a delay
        setTimeout(() => {
          this.closeEditModal();
          this.refreshDoctors();
        }, 2000);
      },
      error: (error) => {
        console.error('Error updating doctor:', error);
        this.errorMessage = 'Failed to update doctor. Please try again.';
        
        // Check for specific error messages
        if (error.error && error.error.detail) {
          this.errorMessage = error.error.detail;
        }
      }
    });
  }

  updateWithModifiedData(updatedData: any): void {
    if (!this.selectedDoctor) return;
    
    // Update the selected doctor with the new data
    Object.assign(this.selectedDoctor, updatedData);
    
    // Update the doctor in the list
    const index = this.doctors.findIndex(d => d.id === this.selectedDoctor!.id);
    if (index !== -1) {
      this.doctors[index] = { ...this.selectedDoctor };
      this.filteredDoctors = this.applyFilters();
    }
  }

  togglePermission(permission: string): void {
    if (this.hasPermission(permission)) {
      this.editFormData.permission_groups = this.editFormData.permission_groups.filter(p => p !== permission);
    } else {
      this.editFormData.permission_groups.push(permission);
    }
  }

  hasPermission(permission: string): boolean {
    return this.editFormData.permission_groups.includes(permission);
  }

  deleteDoctor(): void {
    if (!this.doctorToDelete) return;
    
    this.userService.deleteUser(this.doctorToDelete).subscribe({
      next: () => {
        // Remove from local array
        this.doctors = this.doctors.filter(d => d.id !== this.doctorToDelete);
        this.filteredDoctors = this.applyFilters();
        
        // Close modal and show success message
        this.closeDeleteConfirm();
        this.successMessage = 'Doctor successfully deleted';
        
        // Clear success message after delay
        setTimeout(() => {
          this.successMessage = '';
        }, 3000);
      },
      error: (error) => {
        console.error('Error deleting doctor:', error);
        this.errorMessage = 'Failed to delete doctor. Please try again.';
        this.closeDeleteConfirm();
      }
    });
  }

  toggleDoctorStatus(doctor: Doctor): void {
    const newStatus = !doctor.is_active;
    
    this.userService.updateUser(doctor.id, { is_active: newStatus }).subscribe({
      next: (response) => {
        // Update local data
        doctor.is_active = newStatus;
        
        // Show success message
        this.successMessage = `Doctor ${doctor.name} ${doctor.lastname} ${newStatus ? 'activated' : 'deactivated'} successfully`;
        
        // Clear success message after delay
        setTimeout(() => {
          this.successMessage = '';
        }, 3000);
      },
      error: (error) => {
        console.error('Error toggling doctor status:', error);
        this.errorMessage = `Failed to ${newStatus ? 'activate' : 'deactivate'} doctor. Please try again.`;
        
        // Clear error message after delay
        setTimeout(() => {
          this.errorMessage = '';
        }, 3000);
      }
    });
  }

  filterByStatus(status: 'all' | 'active' | 'inactive'): void {
    this.activeFilter = status;
    this.filteredDoctors = this.applyFilters();
  }

  applyFilters(): Doctor[] {
    let filtered = [...this.doctors];
    
    // Apply status filter
    if (this.activeFilter === 'active') {
      filtered = filtered.filter(d => d.is_active);
    } else if (this.activeFilter === 'inactive') {
      filtered = filtered.filter(d => !d.is_active);
    }
    
    // Apply search filter if there's a query
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(d => 
        d.name.toLowerCase().includes(query) ||
        d.lastname.toLowerCase().includes(query) ||
        d.username.toLowerCase().includes(query) ||
        d.contact_info.email.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }

  searchDoctors(searchTerm: string): void {
    this.searchQuery = searchTerm;
    this.filteredDoctors = this.applyFilters();
  }

  getPermissionGroups(permissions: string[]): string[] {
    const groups = new Set<string>();
    
    permissions.forEach(permission => {
      const matchingPerm = this.availablePermissions.find(p => p.value === permission);
      if (matchingPerm) {
        groups.add(matchingPerm.group);
      }
    });
    
    return Array.from(groups);
  }

  togglePermissionGroup(groupId: string): void {
    const hasGroup = this.hasPermissionGroup(groupId);
    
    // Get all permissions for this group
    const groupPermissions = this.availablePermissions
      .filter(p => p.group === groupId)
      .map(p => p.value);
    
    if (hasGroup) {
      // Remove all permissions for this group
      this.editFormData.permission_groups = this.editFormData.permission_groups
        .filter(p => !groupPermissions.includes(p));
    } else {
      // Add all permissions for this group
      const newPermissions = [...this.editFormData.permission_groups];
      
      groupPermissions.forEach(permission => {
        if (!newPermissions.includes(permission)) {
          newPermissions.push(permission);
        }
      });
      
      this.editFormData.permission_groups = newPermissions;
    }
  }

  hasPermissionGroup(groupId: string): boolean {
    // Get all permissions for this group
    const groupPermissions = this.availablePermissions
      .filter(p => p.group === groupId)
      .map(p => p.value);
    
    // Check if all permissions in the group are selected
    return groupPermissions.every(permission => 
      this.editFormData.permission_groups.includes(permission)
    );
  }

  hasDoctorPermissionGroup(doctor: Doctor, groupId: string): boolean {
    if (!doctor.permission_groups) return false;
    return doctor.permission_groups.includes(groupId);
  }

  getPermissionIconClass(doctor: Doctor, groupId: string): string {
    return this.hasDoctorPermissionGroup(doctor, groupId) 
      ? 'fas fa-check-circle text-success' 
      : 'fas fa-times-circle text-danger';
  }

  handlePermissionGroupChange(groupId: string, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.togglePermissionGroup(groupId);
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  togglePasswordField(): void {
    this.showPasswordField = !this.showPasswordField;
    if (!this.showPasswordField) {
      this.newPassword = '';
    }
  }

  updatePassword(): void {
    if (!this.selectedDoctor || !this.newPassword.trim()) return;
    
    this.userService.updateUser(this.selectedDoctor.id, { password: this.newPassword }).subscribe({
      next: () => {
        this.successMessage = 'Password updated successfully';
        this.newPassword = '';
        this.showPasswordField = false;
        
        // Clear success message after delay
        setTimeout(() => {
          this.successMessage = '';
        }, 3000);
      },
      error: (error) => {
        console.error('Error updating password:', error);
        this.errorMessage = 'Failed to update password. Please try again.';
        
        // Check for specific error messages
        if (error.error && error.error.detail) {
          this.errorMessage = error.error.detail;
        }
      }
    });
  }

  toggleNewDoctorPasswordVisibility(): void {
    this.showNewDoctorPassword = !this.showNewDoctorPassword;
  }

  toggleNewDoctorPermissionGroup(groupId: string): void {
    const hasGroup = this.newDoctorData.permission_groups.includes(groupId);
    
    if (hasGroup) {
      this.newDoctorData.permission_groups = this.newDoctorData.permission_groups.filter(g => g !== groupId);
    } else {
      this.newDoctorData.permission_groups.push(groupId);
    }
  }

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
      permission_groups: [],
      role: 'doctor'
    };
    this.showNewDoctorPassword = false;
    this.errorMessage = '';
    this.successMessage = '';
  }

  createDoctor(): void {
    // Validate required fields
    if (!this.newDoctorData.username || !this.newDoctorData.password || 
        !this.newDoctorData.name || !this.newDoctorData.lastname || 
        !this.newDoctorData.email) {
      this.errorMessage = 'Please fill in all required fields';
      return;
    }
    
    // Create the doctor
    this.userService.createUser({
      username: this.newDoctorData.username,
      password: this.newDoctorData.password,
      name: this.newDoctorData.name,
      lastname: this.newDoctorData.lastname,
      age: this.newDoctorData.age,
      role: 'doctor',
      contact_info: {
        email: this.newDoctorData.email,
        phone: this.newDoctorData.phone,
        address: this.newDoctorData.address
      },
      permission_groups: this.newDoctorData.permission_groups,
      is_active: true
    }).subscribe({
      next: (response) => {
        // Add to local array
        this.doctors.unshift(response);
        this.filteredDoctors = this.applyFilters();
        
        // Show success message
        this.successMessage = `Doctor ${response.name} ${response.lastname} created successfully`;
        
        // Reset form and close modal after delay
        setTimeout(() => {
          this.closeCreateModal();
        }, 2000);
      },
      error: (error) => {
        console.error('Error creating doctor:', error);
        this.errorMessage = 'Failed to create doctor. Please try again.';
        
        // Check for specific error messages
        if (error.error && error.error.detail) {
          this.errorMessage = error.error.detail;
        }
      }
    });
  }

  exportDoctorsList(): void {
    let csvContent = 'ID,Username,Name,Last Name,Email,Status,Date Created\n';
    
    this.doctors.forEach(doctor => {
      const status = doctor.is_active ? 'Active' : 'Inactive';
      const row = [
        doctor.id,
        doctor.username,
        doctor.name,
        doctor.lastname,
        doctor.contact_info.email,
        status,
        new Date(doctor.date_created).toLocaleDateString()
      ];
      csvContent += row.join(',') + '\n';
    });
    
    this.downloadCSV(csvContent, 'doctors_list.csv');
  }

  private downloadCSV(csvContent: string, filename: string): void {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    // Create a URL for the blob
    const url = URL.createObjectURL(blob);
    
    // Set link properties
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    // Add to document, click and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  getDoctorFullName(doctor: Doctor): string {
    return `${doctor.name} ${doctor.lastname}`;
  }

  getDoctorSuccessMessage(doctor: Doctor, action: string): string {
    return `Doctor ${doctor.name} ${doctor.lastname} ${action} successfully`;
  }
}
