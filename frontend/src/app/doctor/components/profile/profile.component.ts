import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { UserService } from '../../../shared/services/user.service';
import { AuthService } from '../../../auth/auth.service';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit {
  profileForm: FormGroup;
  securityForm: FormGroup;
  
  currentUser: any = null;
  isLoading: boolean = true;
  isSaving: boolean = false;
  loadError: boolean = false;
  
  saveSuccess: boolean = false;
  saveError: string | null = null;
  
  isEditMode: boolean = false;
  isPasswordEditMode: boolean = false;
  
  constructor(
    private formBuilder: FormBuilder,
    private userService: UserService,
    private authService: AuthService,
    private router: Router
  ) {
    // Initialize forms
    this.profileForm = this.formBuilder.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      specialization: [''],
      hospital: [''],
      bio: ['']
    });
    
    this.securityForm = this.formBuilder.group({
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required]
    }, { validator: this.passwordMatchValidator });
  }
  
  ngOnInit(): void {
    this.loadUserProfile();
  }
  
  loadUserProfile(): void {
    this.isLoading = true;
    this.loadError = false;
    
    this.userService.getCurrentUserProfile().subscribe({
      next: (userData) => {
        console.log('Raw user profile data received:', userData);
        
        // Ensure we have a valid user object
        if (!userData) {
          console.error('Empty userData received from API');
          this.loadError = true;
          this.isLoading = false;
          return;
        }
        
        // Normalize data fields - handle different API response formats
        this.currentUser = {
          firstName: userData.firstName || userData.first_name || userData.name || '',
          lastName: userData.lastName || userData.last_name || userData.lastname || '',
          email: userData.email || (userData.contact_info ? userData.contact_info.email : ''),
          phone: userData.phone || (userData.contact_info ? userData.contact_info.phone : ''),
          specialization: userData.specialization || '',
          hospital: userData.hospital || '',
          bio: userData.bio || ''
        };
        
        console.log('Normalized user data:', this.currentUser);
        this.isLoading = false;
        
        // Populate form with normalized user data
        this.profileForm.patchValue({
          firstName: this.currentUser.firstName,
          lastName: this.currentUser.lastName,
          email: this.currentUser.email,
          phone: this.currentUser.phone,
          specialization: this.currentUser.specialization,
          hospital: this.currentUser.hospital,
          bio: this.currentUser.bio
        });
        
        // Set form to read-only initially
        this.profileForm.disable();
      },
      error: (error) => {
        console.error('Error loading user profile:', error);
        this.isLoading = false;
        this.loadError = true;
        
        // Try to get user data from localStorage as fallback
        try {
          const storedUser = localStorage.getItem('user');
          if (storedUser) {
            const userData = JSON.parse(storedUser);
            console.log('Fallback: Using stored user data:', userData);
            
            this.currentUser = {
              firstName: userData.name || '',
              lastName: userData.lastname || '',
              email: userData.email || '',
              phone: userData.phone || '',
              specialization: userData.specialization || '',
              hospital: userData.hospital || '',
              bio: userData.bio || ''
            };
            
            this.profileForm.patchValue(this.currentUser);
            this.profileForm.disable();
            this.loadError = false;
          }
        } catch (e) {
          console.error('Failed to load user data from localStorage:', e);
        }
      }
    });
  }
  
  toggleEditMode(): void {
    if (this.isEditMode) {
      // Cancel edit mode - reset form and disable
      this.profileForm.patchValue({
        firstName: this.currentUser.firstName || this.currentUser.first_name || '',
        lastName: this.currentUser.lastName || this.currentUser.last_name || '',
        email: this.currentUser.email || '',
        phone: this.currentUser.phone || '',
        specialization: this.currentUser.specialization || '',
        hospital: this.currentUser.hospital || '',
        bio: this.currentUser.bio || ''
      });
      this.profileForm.disable();
    } else {
      // Enable edit mode
      this.profileForm.enable();
    }
    
    this.isEditMode = !this.isEditMode;
    this.saveSuccess = false;
    this.saveError = null;
  }
  
  togglePasswordEditMode(): void {
    this.isPasswordEditMode = !this.isPasswordEditMode;
    
    if (!this.isPasswordEditMode) {
      this.securityForm.reset();
    }
    
    this.saveSuccess = false;
    this.saveError = null;
  }
  
  saveProfile(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }
    
    this.isSaving = true;
    this.saveSuccess = false;
    this.saveError = null;
    
    const profileData = this.profileForm.value;
    
    this.userService.updateCurrentUserProfile(profileData).subscribe({
      next: (response) => {
        this.isSaving = false;
        this.saveSuccess = true;
        this.currentUser = { ...this.currentUser, ...profileData };
        
        // Disable form after successful save
        this.profileForm.disable();
        this.isEditMode = false;
        
        setTimeout(() => {
          this.saveSuccess = false;
        }, 3000);
      },
      error: (error) => {
        console.error('Error updating profile:', error);
        this.isSaving = false;
        this.saveError = 'Failed to update profile. Please try again.';
      }
    });
  }
  
  changePassword(): void {
    if (this.securityForm.invalid) {
      this.securityForm.markAllAsTouched();
      return;
    }
    
    this.isSaving = true;
    this.saveSuccess = false;
    this.saveError = null;
    
    const { currentPassword, newPassword } = this.securityForm.value;
    
    this.authService.changePassword(currentPassword, newPassword).subscribe({
      next: (response) => {
        this.isSaving = false;
        this.saveSuccess = true;
        this.securityForm.reset();
        this.isPasswordEditMode = false;
        
        setTimeout(() => {
          this.saveSuccess = false;
        }, 3000);
      },
      error: (error) => {
        console.error('Error changing password:', error);
        this.isSaving = false;
        this.saveError = 'Failed to change password. Please ensure your current password is correct.';
      }
    });
  }
  
  navigateToSettings(): void {
    this.router.navigate(['/doctor/settings']);
  }
  
  // Password validators
  passwordMatchValidator(group: FormGroup): { [key: string]: boolean } | null {
    const newPassword = group.get('newPassword')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    
    if (newPassword === confirmPassword) {
      return null;
    }
    
    return { passwordMismatch: true };
  }
  
  // Form validation helper methods that are more type-safe
  isFormControlInvalid(form: FormGroup, controlName: string): boolean {
    const control = form.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  hasRequiredError(form: FormGroup, controlName: string): boolean {
    const control = form.get(controlName);
    return !!control && control.hasError('required') && (control.dirty || control.touched);
  }

  hasMinLengthError(form: FormGroup, controlName: string): boolean {
    const control = form.get(controlName);
    return !!control && control.hasError('minlength') && (control.dirty || control.touched);
  }

  hasEmailError(form: FormGroup, controlName: string): boolean {
    const control = form.get(controlName);
    return !!control && control.hasError('email') && (control.dirty || control.touched);
  }

  hasPasswordMismatchError(form: FormGroup): boolean {
    return !!form.hasError('passwordMismatch') && 
           !!(form.get('confirmPassword')?.dirty || form.get('confirmPassword')?.touched);
  }

  // Original hasError method - keeping for backward compatibility
  hasError(form: FormGroup, controlName: string, errorType: string): boolean {
    const control = form.get(controlName);
    if (!control) return false;
    return (control.touched || control.dirty) && control.hasError(errorType);
  }
}
