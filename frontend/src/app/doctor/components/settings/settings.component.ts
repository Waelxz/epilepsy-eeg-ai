import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormGroup, FormBuilder, Validators } from '@angular/forms';
import { AppSettingsService, AppSettings } from '../../../shared/services/app-settings.service';
import { UserService } from '../../../shared/services/user.service';
import { AuthService } from '../../../auth/auth.service';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule
  ]
})
export class SettingsComponent implements OnInit {
  selectedTab: string = 'appearance';
  settings: AppSettings;
  originalSettings: AppSettings;
  settingsForm: FormGroup;
  profileForm: FormGroup;
  securityForm: FormGroup;
  notificationForm: FormGroup;
  
  isLoading: boolean = false;
  isSaving: boolean = false;
  saveSuccess: boolean = false;
  saveError: string | null = null;
  
  currentUser: any = null;
  isLoadingUser: boolean = true;
  userError: boolean = false;
  
  fontSizeOptions = [
    { value: 12, label: 'Small' },
    { value: 14, label: 'Medium (Default)' },
    { value: 16, label: 'Large' },
    { value: 18, label: 'Extra Large' }
  ];
  
  themeOptions = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System Default' }
  ];

  constructor(
    private appSettingsService: AppSettingsService,
    private formBuilder: FormBuilder,
    private userService: UserService,
    private authService: AuthService,
    private router: Router
  ) {
    // Get current settings
    this.settings = this.appSettingsService.getSettings();
    this.originalSettings = { ...this.settings };
    
    // Initialize forms
    this.settingsForm = this.formBuilder.group({
      theme: [this.settings.theme],
      fontSize: [this.settings.fontSize],
      reduceAnimations: [this.settings.accessibility.reduceAnimations],
      highContrast: [this.settings.accessibility.highContrast]
    });
    
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
    
    this.notificationForm = this.formBuilder.group({
      emailNotifications: [true],
      newPatientNotifications: [true],
      analysisResultsNotifications: [true],
      appointmentReminders: [true],
      systemUpdates: [true]
    });
  }
  
  ngOnInit(): void {
    this.loadUserData();
    
    // Listen for settings form changes to preview
    this.settingsForm.valueChanges.subscribe(values => {
      // Apply settings temporarily for preview
      const previewSettings: AppSettings = {
        theme: values.theme,
        fontSize: values.fontSize,
        accessibility: {
          reduceAnimations: values.reduceAnimations,
          highContrast: values.highContrast
        }
      };
      
      this.appSettingsService.applySettingsTemporarily(previewSettings);
    });
  }
  
  loadUserData(): void {
    this.isLoadingUser = true;
    this.userService.getCurrentUserProfile().subscribe({
      next: (userData) => {
        this.currentUser = userData;
        this.isLoadingUser = false;
        
        // Populate profile form with user data
        this.profileForm.patchValue({
          firstName: userData.firstName || userData.first_name || '',
          lastName: userData.lastName || userData.last_name || '',
          email: userData.email || '',
          phone: userData.phone || '',
          specialization: userData.specialization || '',
          hospital: userData.hospital || '',
          bio: userData.bio || ''
        });
      },
      error: (error) => {
        console.error('Error loading user data:', error);
        this.userError = true;
        this.isLoadingUser = false;
      }
    });
  }
  
  // Change the active tab
  setActiveTab(tab: string): void {
    this.selectedTab = tab;
    
    // Reset any save statuses when switching tabs
    this.saveSuccess = false;
    this.saveError = null;
  }
  
  // Save appearance settings
  saveAppearanceSettings(): void {
    this.isSaving = true;
    this.saveSuccess = false;
    this.saveError = null;
    
    const formValues = this.settingsForm.value;
    
    // Create settings object
    const settings: AppSettings = {
      theme: formValues.theme,
      fontSize: formValues.fontSize,
      accessibility: {
        reduceAnimations: formValues.reduceAnimations,
        highContrast: formValues.highContrast
      }
    };
    
    try {
      // Save to service (and localStorage)
      this.appSettingsService.saveSettings(settings);
      this.settings = settings;
      this.originalSettings = { ...settings };
      
      this.saveSuccess = true;
      setTimeout(() => {
        this.saveSuccess = false;
      }, 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      this.saveError = 'Failed to save settings. Please try again.';
    } finally {
      this.isSaving = false;
    }
  }
  
  // Discard appearance settings changes
  discardAppearanceChanges(): void {
    // Revert to original settings
    this.settingsForm.patchValue({
      theme: this.originalSettings.theme,
      fontSize: this.originalSettings.fontSize,
      reduceAnimations: this.originalSettings.accessibility.reduceAnimations,
      highContrast: this.originalSettings.accessibility.highContrast
    });
    
    // Apply original settings
    this.appSettingsService.revertToSavedSettings();
  }
  
  // Save profile settings
  saveProfileSettings(): void {
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
  
  // Save security settings (change password)
  saveSecuritySettings(): void {
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
  
  // Save notification settings
  saveNotificationSettings(): void {
    this.isSaving = true;
    this.saveSuccess = false;
    this.saveError = null;
    
    const notificationSettings = this.notificationForm.value;
    
    // Format notification settings for the API
    const updateData = {
      notification_preferences: notificationSettings
    };
    
    this.userService.updateCurrentUserProfile(updateData).subscribe({
      next: (response) => {
        this.isSaving = false;
        this.saveSuccess = true;
        
        setTimeout(() => {
          this.saveSuccess = false;
        }, 3000);
      },
      error: (error) => {
        console.error('Error updating notification settings:', error);
        this.isSaving = false;
        this.saveError = 'Failed to update notification settings. Please try again.';
      }
    });
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
  
  // Helper for form control validation
  hasError(form: FormGroup, controlName: string, errorType: string): boolean {
    const control = form.get(controlName);
    return control?.touched && control?.hasError(errorType) || false;
  }
  
  // Check if user has unsaved changes
  hasUnsavedChanges(): boolean {
    return this.appSettingsService.hasUnsavedChanges();
  }
  
  // Add navigation method
  navigateToProfile(): void {
    this.router.navigate(['/doctor/profile']);
  }
}
