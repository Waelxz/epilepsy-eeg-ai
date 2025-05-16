import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../../auth/auth.service';
import { UserService } from '../../../shared/services/user.service';
import { Router } from '@angular/router';
import { Location } from '@angular/common';

interface UserProfile {
  id?: string;
  username: string;
  email: string;
  name: string;
  lastname: string;
  phone?: string;
  role: string;
  date_created?: string;
  last_login?: string;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css'
})
export class ProfileComponent implements OnInit {
  userProfile: UserProfile | null = null;
  loading: boolean = true;
  errorMessage: string = '';
  successMessage: string = '';
  
  // Edit mode flags for different sections
  editingPersonalInfo: boolean = false;
  editingContactInfo: boolean = false;
  editingPassword: boolean = false;
  
  // Forms
  personalInfoForm: FormGroup;
  contactInfoForm: FormGroup;
  passwordForm: FormGroup;
  showNewPassword: boolean = false;
  showConfirmPassword: boolean = false;
  
  constructor(
    private authService: AuthService,
    private userService: UserService,
    private fb: FormBuilder,
    private router: Router,
    private location: Location
  ) {
    // Initialize forms
    this.personalInfoForm = this.fb.group({
      name: ['', [Validators.required]],
      lastname: ['', [Validators.required]]
    });
    
    this.contactInfoForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.pattern(/^\+?[0-9\s\-\(\)]{7,15}$/)]]
    });
    
    this.passwordForm = this.fb.group({
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }
  
  ngOnInit(): void {
    this.loadUserProfile();
  }
  
  // Load user profile from storage and/or API
  loadUserProfile(): void {
    this.loading = true;
    this.errorMessage = '';
    
    // Call the current user profile endpoint
    this.userService.getCurrentUserProfile().subscribe({
      next: (response) => {
        this.userProfile = this.mapUserProfile(response);
        this.updateFormValues();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error fetching user profile:', error);
        this.errorMessage = 'Failed to load profile. Please try again.';
        
        // Fall back to localStorage if API call fails
        this.loadProfileFromLocalStorage();
      }
    });
  }
  
  // Fallback method to load profile from localStorage
  private loadProfileFromLocalStorage(): void {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      this.errorMessage = 'User data not found. Please log in again.';
      this.loading = false;
      return;
    }
    
    try {
      const userData = JSON.parse(storedUser);
      this.userProfile = this.createProfileFromLocalStorage(userData);
      this.updateFormValues();
      this.loading = false;
      
      // Try to get username from token if missing
      if (!this.userProfile.username) {
        const tokenData = this.authService.getDecodedToken();
        if (tokenData && tokenData.sub) {
          this.userProfile.username = tokenData.sub;
        }
      }
    } catch (error) {
      console.error('Error parsing user data:', error);
      this.errorMessage = 'Invalid user data format. Please log in again.';
      this.loading = false;
    }
  }
  
  // Helper method to create a profile from localStorage data
  private createProfileFromLocalStorage(userData: any): UserProfile {
    return {
      id: userData.id || '',
      username: userData.username || '',
      email: userData.email || (userData.contact_info ? userData.contact_info.email : ''),
      name: userData.name || userData.first_name || '',
      lastname: userData.lastname || userData.last_name || '',
      phone: userData.phone || (userData.contact_info ? userData.contact_info.phone : ''),
      role: userData.role || 'TECHNICIAN',
      date_created: userData.date_created,
      last_login: userData.last_login
    };
  }
  
  // Map API response to user profile model
  mapUserProfile(data: any): UserProfile {
    return {
      id: data.id,
      username: data.username,
      email: data.email || (data.contact_info ? data.contact_info.email : ''),
      name: data.name || data.first_name || '',
      lastname: data.lastname || data.last_name || '',
      phone: data.phone || (data.contact_info ? data.contact_info.phone : ''),
      role: data.role,
      date_created: data.date_created,
      last_login: data.last_login
    };
  }
  
  // Update form values based on user profile
  updateFormValues(): void {
    if (this.userProfile) {
      this.personalInfoForm.patchValue({
        name: this.userProfile.name,
        lastname: this.userProfile.lastname
      });
      
      this.contactInfoForm.patchValue({
        email: this.userProfile.email,
        phone: this.userProfile.phone || ''
      });
    }
  }
  
  // Toggle edit mode for sections
  togglePersonalInfoEdit(): void {
    this.editingPersonalInfo = !this.editingPersonalInfo;
    if (this.editingPersonalInfo) {
      this.updateFormValues();
    }
  }
  
  toggleContactInfoEdit(): void {
    this.editingContactInfo = !this.editingContactInfo;
    if (this.editingContactInfo) {
      this.updateFormValues();
    }
  }
  
  togglePasswordEdit(): void {
    this.editingPassword = !this.editingPassword;
    if (this.editingPassword) {
      this.passwordForm.reset();
      this.showNewPassword = false;
      this.showConfirmPassword = false;
    }
  }
  
  toggleNewPasswordVisibility(): void {
    this.showNewPassword = !this.showNewPassword;
  }
  
  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }
  
  // Save changes for different sections
  savePersonalInfo(): void {
    if (this.personalInfoForm.invalid) {
      return;
    }
    
    if (!this.userProfile) {
      this.errorMessage = 'User profile not loaded.';
      return;
    }
    
    const formValues = this.personalInfoForm.value;
    const updatedData = {
      name: formValues.name,
      lastname: formValues.lastname
    };
    
    this.updateUserProfile(updatedData, 'Personal information updated successfully.');
  }
  
  saveContactInfo(): void {
    if (this.contactInfoForm.invalid) {
      return;
    }
    
    if (!this.userProfile) {
      this.errorMessage = 'User profile not loaded.';
      return;
    }
    
    const formValues = this.contactInfoForm.value;
    const updatedData = {
      email: formValues.email,
      contact_info: {
        email: formValues.email,
        phone: formValues.phone
      }
    };
    
    this.updateUserProfile(updatedData, 'Contact information updated successfully.');
  }
  
  savePassword(): void {
    if (this.passwordForm.invalid) {
      return;
    }
    
    if (!this.userProfile) {
      this.errorMessage = 'User profile not loaded.';
      return;
    }
    
    const formValues = this.passwordForm.value;
    const updatedData = {
      password: formValues.newPassword
    };
    
    this.updateUserProfile(updatedData, 'Password updated successfully.', () => {
      this.passwordForm.reset();
      this.editingPassword = false;
      this.showNewPassword = false;
      this.showConfirmPassword = false;
    });
  }
  
  // Update user profile with API
  updateUserProfile(data: any, successMessage: string, callback?: () => void): void {
    if (!this.userProfile) {
      this.errorMessage = 'User profile not loaded.';
      return;
    }
    
    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';
    
    // Use the dedicated endpoint for updating own profile
    this.userService.updateCurrentUserProfile(data).subscribe({
      next: (response) => {
        // If we get a successful response, update the profile
        if (response) {
          // Update local storage with new values
          this.updateLocalStorageData(data);
          
          // If we received the updated user, use it to update the profile
          if (response.id) {
            this.userProfile = this.mapUserProfile(response);
          } else {
            // Otherwise just update the specific fields from our data
            if (this.userProfile && data.name !== undefined) this.userProfile.name = data.name;
            if (this.userProfile && data.lastname !== undefined) this.userProfile.lastname = data.lastname;
            if (this.userProfile && data.email !== undefined) this.userProfile.email = data.email;
            if (this.userProfile && data.contact_info?.email !== undefined) this.userProfile.email = data.contact_info.email;
            if (this.userProfile && data.contact_info?.phone !== undefined) this.userProfile.phone = data.contact_info.phone;
          }
          
          this.updateFormValues();
          this.successMessage = successMessage;
        }
        
        this.loading = false;
        
        // Reset edit modes
        this.editingPersonalInfo = false;
        this.editingContactInfo = false;
        
        // Call optional callback
        if (callback) callback();
      },
      error: (error) => {
        console.error('Error updating profile:', error);
        
        // Show appropriate error message
        if (error.status === 400) {
          this.errorMessage = 'Invalid input. Please check your information.';
        } else if (error.status === 401) {
          this.errorMessage = 'Your session has expired. Please log in again.';
        } else {
          this.errorMessage = 'Failed to update profile. Please try again.';
        }
        
        this.loading = false;
      }
    });
  }
  
  // Helper to update localStorage
  private updateLocalStorageData(data: any): void {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        
        // Create updated user data, careful to preserve existing data
        const updatedUserData = { ...userData };
        
        // Update specific fields from the data
        if (data.name !== undefined) updatedUserData.name = data.name;
        if (data.lastname !== undefined) updatedUserData.lastname = data.lastname;
        if (data.email !== undefined) updatedUserData.email = data.email;
        
        // Update contact_info if provided
        if (data.contact_info) {
          updatedUserData.contact_info = updatedUserData.contact_info || {};
          if (data.contact_info.email !== undefined) updatedUserData.contact_info.email = data.contact_info.email;
          if (data.contact_info.phone !== undefined) updatedUserData.contact_info.phone = data.contact_info.phone;
        }
        
        // Avoid storing passwords in localStorage
        if (data.password) {
          // Just note that password was updated, don't store actual value
          updatedUserData.passwordLastChanged = new Date().toISOString();
        }
        
        localStorage.setItem('user', JSON.stringify(updatedUserData));
      } catch (e) {
        console.error('Error updating local storage:', e);
      }
    }
  }
  
  // Custom validator to check if passwords match
  passwordMatchValidator(form: FormGroup): any {
    const password = form.get('newPassword')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;
    
    if (password !== confirmPassword) {
      form.get('confirmPassword')?.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    
    return null;
  }
  
  // Helper to format date strings
  formatDate(dateString: string | undefined): string {
    if (!dateString) return 'N/A';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    } catch (e) {
      return dateString;
    }
  }
  
  // Navigate back to dashboard
  async goBack(): Promise<void> {
    this.location.back();
  }

  exportProfile(): void {
    if (!this.userProfile) {
      this.showErrorMessage('No profile data available to export');
      return;
    }

    // Create CSV content from user profile data
    const headers = ['Field', 'Value'];
    const rows = [
      ['Username', this.userProfile.username || ''],
      ['First Name', this.userProfile.name || ''],
      ['Last Name', this.userProfile.lastname || ''],
      ['Email', this.userProfile.email || ''],
      ['Phone', this.userProfile.phone || ''],
      ['Role', this.userProfile.role || ''],
      ['Created At', this.userProfile.date_created ? new Date(this.userProfile.date_created).toLocaleString() : ''],
      ['Last Login', this.userProfile.last_login ? new Date(this.userProfile.last_login).toLocaleString() : '']
    ];

    // Convert to CSV
    let csvContent = headers.join(',') + '\n';
    rows.forEach(row => {
      // Properly escape values that might contain commas
      const escapedRow = row.map(value => {
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      });
      csvContent += escapedRow.join(',') + '\n';
    });

    // Download the CSV file
    this.downloadCSV(csvContent, 'user_profile.csv');
  }

  private downloadCSV(csvContent: string, filename: string): void {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  private showErrorMessage(message: string): void {
    // Implement the logic to show an error message to the user
    console.error(message);
  }
}
