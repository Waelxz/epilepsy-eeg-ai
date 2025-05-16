import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../../auth/auth.service';
import { UserService } from '../../../shared/services/user.service';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';

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
      error: (error: HttpErrorResponse) => {
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
      role: userData.role || 'ADMIN',
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
    
    // Use type assertion to tell TypeScript that this method exists
    (this.userService as any).changePassword(formValues.newPassword).subscribe({
      next: () => {
        this.successMessage = 'Password changed successfully.';
        this.editingPassword = false;
        setTimeout(() => {
          this.successMessage = '';
        }, 3000);
      },
      error: (error: HttpErrorResponse) => {
        console.error('Error changing password:', error);
        this.errorMessage = 'Failed to change password. Please try again.';
        setTimeout(() => {
          this.errorMessage = '';
        }, 3000);
      }
    });
  }
  
  // Generic method to update user profile
  updateUserProfile(data: any, successMessage: string, callback?: () => void): void {
    if (!this.userProfile || !this.userProfile.id) {
      this.errorMessage = 'User ID not found.';
      return;
    }
    
    // Use type assertion to tell TypeScript that this method exists
    (this.userService as any).updateUserProfile(data).subscribe({
      next: (response: any) => {
        // Update local profile data
        this.userProfile = this.mapUserProfile({
          ...this.userProfile,
          ...response
        });
        
        // Update localStorage
        this.updateLocalStorageData(response);
        
        // Show success message
        this.successMessage = successMessage;
        setTimeout(() => {
          this.successMessage = '';
        }, 3000);
        
        // Reset edit mode
        this.editingPersonalInfo = false;
        this.editingContactInfo = false;
        
        if (callback) {
          callback();
        }
      },
      error: (error: HttpErrorResponse) => {
        console.error('Error updating profile:', error);
        this.errorMessage = 'Failed to update profile. Please try again.';
        setTimeout(() => {
          this.errorMessage = '';
        }, 3000);
      }
    });
  }
  
  // Update localStorage data when profile is updated
  private updateLocalStorageData(data: any): void {
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        
        // Merge with new data
        const updatedUser = {
          ...userData,
          ...data
        };
        
        // Handle contact_info separately
        if (data.contact_info) {
          updatedUser.contact_info = {
            ...(userData.contact_info || {}),
            ...data.contact_info
          };
        }
        
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }
    } catch (error) {
      console.error('Error updating localStorage:', error);
    }
  }
  
  // Password validation
  passwordMatchValidator(form: FormGroup): any {
    const password = form.get('newPassword')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;
    
    if (password !== confirmPassword) {
      form.get('confirmPassword')?.setErrors({ notMatching: true });
      return { notMatching: true };
    }
    
    return null;
  }
  
  // Format date for display
  formatDate(dateString: string | undefined): string {
    if (!dateString) return 'Not available';
    
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  }
  
  // Navigation
  goBack(): void {
    this.router.navigate(['/admin/dashboard']);
  }
}
