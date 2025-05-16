import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { UserService } from '../../../shared/services/user.service';
import { AuthService } from '../../../auth/auth.service';

interface Technician {
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
  selector: 'app-technician-management',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, HttpClientModule],
  providers: [UserService, AuthService],
  templateUrl: './technician-management.component.html',
  styleUrls: ['./technician-management.component.css']
})
export class TechnicianManagementComponent implements OnInit {
  technicians: Technician[] = [];
  filteredTechnicians: Technician[] = [];
  selectedTechnician: Technician | null = null;
  isLoading = true;
  errorMessage: string = '';
  successMessage = '';
  showCreateModal = false;
  showEditModal = false;
  showViewModal = false;
  showDeleteConfirm = false;
  technicianToDelete: string = '';
  activeFilter: 'all' | 'active' | 'inactive' = 'all';
  
  // New technician data
  newTechnicianData = {
    username: '',
    password: '',
    name: '',
    lastname: '',
    age: 30,
    email: '',
    phone: '',
    address: '',
    permission_groups: [] as string[],
    role: 'technician'
  };
  
  showNewTechnicianPassword = false;
  
  // Permission groups with descriptions and their included permissions
  permissionGroups = [
    { 
      id: 'manage_doctors', 
      label: 'Manage Doctors',
      description: 'Create, edit, and deactivate doctor accounts',
    },
    { 
      id: 'view_logs', 
      label: 'View Logs',
      description: 'View system and doctor activity logs',
    },
    { 
      id: 'manage_settings', 
      label: 'Manage Settings',
      description: 'Change system settings and preferences',
    }
  ];
  
  // Map for displaying individual permissions in UI (for backwards compatibility)
  availablePermissions = [
    { value: 'view_doctors', label: 'View Doctors', group: 'manage_doctors' },
    { value: 'add_doctors', label: 'Add Doctors', group: 'manage_doctors' },
    { value: 'edit_doctors', label: 'Edit Doctors', group: 'manage_doctors' },
    { value: 'deactivate_doctors', label: 'Deactivate Doctors', group: 'manage_doctors' },
    { value: 'view_doctor_logs', label: 'View Doctor Logs', group: 'view_logs' },
    { value: 'export_logs', label: 'Export Logs', group: 'view_logs' },
    { value: 'change_settings', label: 'Change Settings', group: 'manage_settings' },
    { value: 'view_settings', label: 'View Settings', group: 'manage_settings' }
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
    this.loadTechnicians();
  }

  loadTechnicians(): void {
    this.isLoading = true;
    this.userService.getUsers('technician').subscribe({
      next: (data: Technician[]) => {
        this.technicians = data;
        this.filteredTechnicians = [...this.technicians];
        this.isLoading = false;
      },
      error: (error: any) => {
        this.errorMessage = 'Failed to load technicians. Please try again.';
        this.isLoading = false;
        console.error('Error loading technicians:', error);
      }
    });
  }

  refreshTechnicians(): void {
    this.loadTechnicians();
  }

  viewTechnicianDetails(technician: Technician): void {
    this.selectedTechnician = technician;
    this.showViewModal = true;
  }

  openCreateModal(): void {
    console.log('Opening create technician modal');
    this.resetNewTechnicianForm();
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

  openEditModal(technician: Technician): void {
    this.selectedTechnician = technician;
    
    // Populate the form with technician data
    this.editFormData = {
      name: technician.name,
      lastname: technician.lastname,
      age: technician.age,
      email: technician.contact_info.email,
      phone: technician.contact_info.phone || '',
      address: technician.contact_info.address || '',
      is_active: technician.is_active,
      permission_groups: technician.permission_groups || []
    };
    
    // Reset password fields and messages
    this.showPasswordField = false;
    this.newPassword = '';
    this.showPassword = false;
    this.errorMessage = '';
    this.successMessage = '';
    
    this.showEditModal = true;
  }
  
  confirmDelete(technicianId: string): void {
    this.technicianToDelete = technicianId;
    this.showDeleteConfirm = true;
  }

  closeDeleteConfirm(): void {
    this.showDeleteConfirm = false;
    this.technicianToDelete = '';
  }

  closeViewModal(): void {
    this.showViewModal = false;
    this.selectedTechnician = null;
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.selectedTechnician = null;
    this.showPasswordField = false;
    this.newPassword = '';
    this.errorMessage = '';
    this.successMessage = '';
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
    this.resetNewTechnicianForm();
  }

  saveTechnicianChanges(): void {
    if (!this.selectedTechnician) return;
    
    const technicianId = this.selectedTechnician.id;
    
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
    
    // Update the technician
    this.userService.updateUser(technicianId, updateData).subscribe({
      next: (response) => {
        // Update the local data
        this.updateWithModifiedData(response);
        
        this.successMessage = this.getTechnicianSuccessMessage(this.selectedTechnician!, 'updated');
        
        // Close modal after a delay
        setTimeout(() => {
          this.closeEditModal();
          this.refreshTechnicians();
        }, 2000);
      },
      error: (error) => {
        console.error('Error updating technician:', error);
        this.errorMessage = 'Failed to update technician. Please try again.';
        
        // Check for specific error messages
        if (error.error && error.error.detail) {
          this.errorMessage = error.error.detail;
        }
      }
    });
  }

  updateWithModifiedData(updatedData: any): void {
    if (!this.selectedTechnician) return;
    
    // Update the selected technician with the new data
    Object.assign(this.selectedTechnician, updatedData);
    
    // Update the technician in the list
    const index = this.technicians.findIndex(d => d.id === this.selectedTechnician!.id);
    if (index !== -1) {
      this.technicians[index] = { ...this.selectedTechnician };
      this.filteredTechnicians = this.applyFilters();
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

  deleteTechnician(): void {
    if (!this.technicianToDelete) return;
    
    this.userService.deleteUser(this.technicianToDelete).subscribe({
      next: () => {
        // Remove from local array
        this.technicians = this.technicians.filter(d => d.id !== this.technicianToDelete);
        this.filteredTechnicians = this.applyFilters();
        
        // Close modal and show success message
        this.closeDeleteConfirm();
        this.successMessage = 'Technician successfully deleted';
        
        // Clear success message after delay
        setTimeout(() => {
          this.successMessage = '';
        }, 3000);
      },
      error: (error) => {
        console.error('Error deleting technician:', error);
        this.errorMessage = 'Failed to delete technician. Please try again.';
        this.closeDeleteConfirm();
      }
    });
  }

  toggleTechnicianStatus(technician: Technician): void {
    const newStatus = !technician.is_active;
    
    this.userService.updateUser(technician.id, { is_active: newStatus }).subscribe({
      next: (response) => {
        // Update local data
        technician.is_active = newStatus;
        
        // Show success message
        this.successMessage = `Technician ${technician.name} ${technician.lastname} ${newStatus ? 'activated' : 'deactivated'} successfully`;
        
        // Clear success message after delay
        setTimeout(() => {
          this.successMessage = '';
        }, 3000);
      },
      error: (error) => {
        console.error('Error toggling technician status:', error);
        this.errorMessage = `Failed to ${newStatus ? 'activate' : 'deactivate'} technician. Please try again.`;
        
        // Clear error message after delay
        setTimeout(() => {
          this.errorMessage = '';
        }, 3000);
      }
    });
  }

  filterByStatus(status: 'all' | 'active' | 'inactive'): void {
    this.activeFilter = status;
    this.filteredTechnicians = this.applyFilters();
  }

  applyFilters(): Technician[] {
    let filtered = [...this.technicians];
    
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

  searchTechnicians(searchTerm: string): void {
    this.searchQuery = searchTerm;
    this.filteredTechnicians = this.applyFilters();
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

  hasTechnicianPermissionGroup(technician: Technician, groupId: string): boolean {
    if (!technician.permission_groups) return false;
    return technician.permission_groups.includes(groupId);
  }

  getPermissionIconClass(technician: Technician, groupId: string): string {
    return this.hasTechnicianPermissionGroup(technician, groupId) 
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
    if (!this.selectedTechnician || !this.newPassword.trim()) return;
    
    this.userService.updateUser(this.selectedTechnician.id, { password: this.newPassword }).subscribe({
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

  toggleNewTechnicianPasswordVisibility(): void {
    this.showNewTechnicianPassword = !this.showNewTechnicianPassword;
  }

  toggleNewTechnicianPermissionGroup(groupId: string): void {
    const hasGroup = this.newTechnicianData.permission_groups.includes(groupId);
    
    if (hasGroup) {
      this.newTechnicianData.permission_groups = this.newTechnicianData.permission_groups.filter(g => g !== groupId);
    } else {
      this.newTechnicianData.permission_groups.push(groupId);
    }
  }

  resetNewTechnicianForm(): void {
    this.newTechnicianData = {
      username: '',
      password: '',
      name: '',
      lastname: '',
      age: 30,
      email: '',
      phone: '',
      address: '',
      permission_groups: [],
      role: 'technician'
    };
    this.showNewTechnicianPassword = false;
    this.errorMessage = '';
    this.successMessage = '';
  }

  createTechnician(): void {
    // Validate required fields
    if (!this.newTechnicianData.username || !this.newTechnicianData.password || 
        !this.newTechnicianData.name || !this.newTechnicianData.lastname || 
        !this.newTechnicianData.email) {
      this.errorMessage = 'Please fill in all required fields';
      return;
    }
    
    // Create the technician
    this.userService.createUser({
      username: this.newTechnicianData.username,
      password: this.newTechnicianData.password,
      name: this.newTechnicianData.name,
      lastname: this.newTechnicianData.lastname,
      age: this.newTechnicianData.age,
      role: 'technician',
      contact_info: {
        email: this.newTechnicianData.email,
        phone: this.newTechnicianData.phone,
        address: this.newTechnicianData.address
      },
      permission_groups: this.newTechnicianData.permission_groups,
      is_active: true
    }).subscribe({
      next: (response) => {
        // Add to local array
        this.technicians.unshift(response);
        this.filteredTechnicians = this.applyFilters();
        
        // Show success message
        this.successMessage = `Technician ${response.name} ${response.lastname} created successfully`;
        
        // Reset form and close modal after delay
        setTimeout(() => {
          this.closeCreateModal();
        }, 2000);
      },
      error: (error) => {
        console.error('Error creating technician:', error);
        this.errorMessage = 'Failed to create technician. Please try again.';
        
        // Check for specific error messages
        if (error.error && error.error.detail) {
          this.errorMessage = error.error.detail;
        }
      }
    });
  }

  exportTechniciansList(): void {
    let csvContent = 'ID,Username,Name,Last Name,Email,Status,Date Created\n';
    
    this.technicians.forEach(technician => {
      const status = technician.is_active ? 'Active' : 'Inactive';
      const row = [
        technician.id,
        technician.username,
        technician.name,
        technician.lastname,
        technician.contact_info.email,
        status,
        new Date(technician.date_created).toLocaleDateString()
      ];
      csvContent += row.join(',') + '\n';
    });
    
    this.downloadCSV(csvContent, 'technicians_list.csv');
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

  getTechnicianFullName(technician: Technician): string {
    return `${technician.name} ${technician.lastname}`;
  }

  getTechnicianSuccessMessage(technician: Technician, action: string): string {
    return `Technician ${technician.name} ${technician.lastname} ${action} successfully`;
  }
}
