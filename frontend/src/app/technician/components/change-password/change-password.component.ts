import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../auth/auth.service';
import { HttpErrorResponse } from '@angular/common/http';
import { AppSettingsService } from '../../../shared/services/app-settings.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './change-password.component.html',
  styleUrls: ['./change-password.component.css']
})
export class ChangePasswordComponent implements OnInit, OnDestroy {
  changePasswordForm: FormGroup;
  isSubmitting = false;
  showSuccess = false;
  errorMessage = '';
  
  // Password visibility toggles
  showCurrentPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;
  
  // Theme detection
  isDarkMode = false;
  private themeChangeListener: any;
  private darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private appSettingsService: AppSettingsService
  ) {
    this.changePasswordForm = this.fb.group({
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [
        Validators.required, 
        Validators.minLength(8),
        this.passwordStrengthValidator
      ]],
      confirmPassword: ['', Validators.required]
    }, {
      validators: this.passwordMatchValidator
    });
    
    // Initialize dark mode state
    this.checkCurrentTheme();
  }

  ngOnInit(): void {
    // Check current theme on init
    this.detectDarkMode();
    
    // Listen for system dark mode changes
    this.themeChangeListener = (e: MediaQueryListEvent) => {
      if (this.appSettingsService.getSettings().theme === 'system') {
        this.isDarkMode = e.matches;
      }
    };
    
    this.darkModeMediaQuery.addEventListener('change', this.themeChangeListener);
    
    // Update theme when settings change (e.g., when user changes theme in settings)
    document.addEventListener('themeChanged', () => {
      this.detectDarkMode();
    });
    
    // Additional check in case the component is loaded after theme is already applied
    setTimeout(() => this.checkCurrentTheme(), 0);
  }
  
  ngOnDestroy(): void {
    // Clean up media query listener
    if (this.themeChangeListener) {
      this.darkModeMediaQuery.removeEventListener('change', this.themeChangeListener);
    }
    
    // Clean up theme change listener
    document.removeEventListener('themeChanged', () => {
      this.detectDarkMode();
    });
  }
  
  // Check the current theme directly from document
  private checkCurrentTheme(): void {
    // If body already has dark-theme class, apply it to our component
    if (document.body.classList.contains('dark-theme')) {
      this.isDarkMode = true;
    }
  }
  
  // Detect if dark mode is active
  private detectDarkMode(): void {
    const settings = this.appSettingsService.getSettings();
    if (settings.theme === 'dark') {
      this.isDarkMode = true;
    } else if (settings.theme === 'light') {
      this.isDarkMode = false;
    } else if (settings.theme === 'system') {
      // If system preference, check OS preference
      this.isDarkMode = this.darkModeMediaQuery.matches;
    }
    
    // Also check document state as a fallback
    this.checkCurrentTheme();
  }

  // Custom validator for password strength
  passwordStrengthValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.value;
    
    if (!password) return null;
    
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumeric = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    
    const passwordValid = hasUpperCase && hasLowerCase && hasNumeric && hasSpecialChar;
    
    return passwordValid ? null : { weakPassword: true };
  }
  
  // Custom validator to check if passwords match
  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const newPassword = control.get('newPassword')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;
    
    return newPassword === confirmPassword ? null : { passwordMismatch: true };
  }

  onSubmit(): void {
    if (this.changePasswordForm.invalid) {
      // Mark all fields as touched to display validation errors
      Object.keys(this.changePasswordForm.controls).forEach(key => {
        const control = this.changePasswordForm.get(key);
        control?.markAsTouched();
      });
      return;
    }
    
    this.isSubmitting = true;
    this.errorMessage = '';
    
    const { currentPassword, newPassword } = this.changePasswordForm.value;
    
    // Call auth service to change password
    this.authService.changePassword(currentPassword, newPassword).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.showSuccess = true;
        
        // Reset form
        this.changePasswordForm.reset();
        
        // Redirect after a short delay
        setTimeout(() => {
          this.router.navigate(['/technician/settings']);
        }, 2000);
      },
      error: (error: HttpErrorResponse) => {
        this.isSubmitting = false;
        
        if (error.status === 401) {
          this.errorMessage = 'Current password is incorrect';
        } else {
          this.errorMessage = error.error?.message || 'Failed to change password. Please try again.';
        }
      }
    });
  }

  // Helper methods for the template
  togglePasswordVisibility(field: 'current' | 'new' | 'confirm'): void {
    if (field === 'current') {
      this.showCurrentPassword = !this.showCurrentPassword;
    } else if (field === 'new') {
      this.showNewPassword = !this.showNewPassword;
    } else {
      this.showConfirmPassword = !this.showConfirmPassword;
    }
  }
  
  getPasswordFieldType(field: 'current' | 'new' | 'confirm'): string {
    if (field === 'current') {
      return this.showCurrentPassword ? 'text' : 'password';
    } else if (field === 'new') {
      return this.showNewPassword ? 'text' : 'password';
    } else {
      return this.showConfirmPassword ? 'text' : 'password';
    }
  }
  
  getPasswordStrength(): { strength: string, color: string } {
    const newPassword = this.changePasswordForm.get('newPassword')?.value;
    
    if (!newPassword) {
      return { strength: 'None', color: '#ddd' };
    }
    
    const hasUpperCase = /[A-Z]/.test(newPassword);
    const hasLowerCase = /[a-z]/.test(newPassword);
    const hasNumeric = /[0-9]/.test(newPassword);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword);
    
    const criteriaCount = [hasUpperCase, hasLowerCase, hasNumeric, hasSpecialChar].filter(Boolean).length;
    
    if (newPassword.length < 8) {
      return { strength: 'Weak', color: '#ef4444' };
    }
    
    if (criteriaCount <= 2) {
      return { strength: 'Medium', color: '#f97316' };
    }
    
    if (criteriaCount === 3) {
      return { strength: 'Strong', color: '#3b82f6' };
    }
    
    return { strength: 'Very Strong', color: '#22c55e' };
  }
  
  // Helper methods for template password requirements
  hasUpperCase(): boolean {
    const password = this.changePasswordForm.get('newPassword')?.value || '';
    return /[A-Z]/.test(password);
  }
  
  hasLowerCase(): boolean {
    const password = this.changePasswordForm.get('newPassword')?.value || '';
    return /[a-z]/.test(password);
  }
  
  hasNumber(): boolean {
    const password = this.changePasswordForm.get('newPassword')?.value || '';
    return /[0-9]/.test(password);
  }
  
  hasSpecialChar(): boolean {
    const password = this.changePasswordForm.get('newPassword')?.value || '';
    return /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  }
  
  hasMinLength(): boolean {
    const password = this.changePasswordForm.get('newPassword')?.value || '';
    return password.length >= 8;
  }
  
  goBack(): void {
    this.router.navigate(['/technician/settings']);
  }
}
