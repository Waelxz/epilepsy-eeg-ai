import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationStart } from '@angular/router';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AppSettingsService } from '../../../shared/services/app-settings.service';
import { Subscription, filter } from 'rxjs';
import { Location } from '@angular/common';

@Component({
  selector: 'app-technician-settings',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css'
})
export class SettingsComponent implements OnInit, OnDestroy {
  activeSection: 'profile' | 'appearance' | 'notifications' | 'accessibility' = 'profile';
  
  // Settings
  originalSettings: any;
  tempSettings: any;
  hasUnsavedChanges = false;
  showSaved = false;
  
  // Form
  accessibilityForm: FormGroup;
  
  // Subscriptions
  private subscriptions: Subscription[] = [];
  
  constructor(
    private appSettingsService: AppSettingsService,
    private location: Location,
    private router: Router,
    private fb: FormBuilder
  ) {
    this.accessibilityForm = this.fb.group({
      reduceAnimations: [false]
    });

    // Subscribe to router events to handle navigation away
    this.subscriptions.push(
      this.router.events
        .pipe(filter(event => event instanceof NavigationStart))
        .subscribe((event: any) => {
          // Check if navigating away from settings
          if (!event.url.includes('/technician/settings') && this.appSettingsService.hasUnsavedChanges()) {
            // Revert to saved settings when navigating away
            this.appSettingsService.revertToSavedSettings();
          }
        })
    );
  }

  // Handle browser refresh or close
  @HostListener('window:beforeunload')
  unloadHandler() {
    if (this.appSettingsService.hasUnsavedChanges()) {
      this.appSettingsService.revertToSavedSettings();
    }
  }
  
  ngOnInit(): void {
    // Load settings
    this.originalSettings = this.appSettingsService.getSettings();
    this.tempSettings = JSON.parse(JSON.stringify(this.originalSettings));
    
    // Initialize accessibility form
    this.accessibilityForm.get('reduceAnimations')?.setValue(
      this.tempSettings.accessibility.reduceAnimations
    );
    
    // Subscribe to form changes
    this.subscriptions.push(
      this.accessibilityForm.get('reduceAnimations')?.valueChanges.subscribe(value => {
        this.tempSettings.accessibility.reduceAnimations = value;
        this.applyTempSettings();
        this.hasUnsavedChanges = true;
      }) || new Subscription()
    );
  }
  
  ngOnDestroy(): void {
    // Unsubscribe from all subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
  
  // Navigation
  goBack(): void {
    if (this.hasUnsavedChanges) {
      if (confirm('You have unsaved changes. Do you want to discard them?')) {
        this.resetChanges();
        this.location.back();
      }
    } else {
      this.location.back();
    }
  }
  
  navigateToProfile(): void {
    if (this.hasUnsavedChanges) {
      if (confirm('You have unsaved changes. Do you want to discard them?')) {
        this.resetChanges();
        this.router.navigate(['/technician/profile']);
      }
    } else {
      this.router.navigate(['/technician/profile']);
    }
  }
  
  navigateToChangePassword(): void {
    if (this.hasUnsavedChanges) {
      if (confirm('You have unsaved changes. Do you want to discard them?')) {
        this.resetChanges();
        this.router.navigate(['/technician/change-password']);
      }
    } else {
      this.router.navigate(['/technician/change-password']);
    }
  }
  
  setActiveSection(section: 'profile' | 'appearance' | 'notifications' | 'accessibility'): void {
    // Check for unsaved changes
    if (this.hasUnsavedChanges) {
      if (confirm('You have unsaved changes. Do you want to discard them?')) {
        this.resetChanges();
        this.activeSection = section;
      }
    } else {
      this.activeSection = section;
    }
  }
  
  // Theme settings
  setTheme(theme: 'light' | 'dark' | 'system'): void {
    this.tempSettings.theme = theme;
    this.applyTempSettings();
    this.hasUnsavedChanges = true;
  }
  
  isThemeActive(theme: string): boolean {
    return this.tempSettings.theme === theme;
  }
  
  // Font size settings
  setFontSize(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = parseInt(input.value, 10);
    this.tempSettings.fontSize = value;
    this.applyTempSettings();
    this.hasUnsavedChanges = true;
  }
  
  // Contrast settings
  isContrastActive(highContrast: boolean): boolean {
    return this.tempSettings.accessibility.highContrast === highContrast;
  }
  
  setHighContrast(highContrast: boolean): void {
    this.tempSettings.accessibility.highContrast = highContrast;
    this.applyTempSettings();
    this.hasUnsavedChanges = true;
  }
  
  // Accessibility settings
  toggleReduceAnimations(): void {
    this.tempSettings.accessibility.reduceAnimations = !this.tempSettings.accessibility.reduceAnimations;
    this.accessibilityForm.get('reduceAnimations')?.setValue(
      this.tempSettings.accessibility.reduceAnimations,
      { emitEvent: false }
    );
    this.applyTempSettings();
    this.hasUnsavedChanges = true;
  }
  
  toggleHighContrast(): void {
    this.tempSettings.accessibility.highContrast = !this.tempSettings.accessibility.highContrast;
    this.applyTempSettings();
    this.hasUnsavedChanges = true;
  }
  
  // Save/Reset
  saveSettings(): void {
    this.hasUnsavedChanges = false;
    this.appSettingsService.saveSettings(this.tempSettings);
    this.originalSettings = JSON.parse(JSON.stringify(this.tempSettings));
    
    // Show saved message
    this.showSaved = true;
    setTimeout(() => {
      this.showSaved = false;
    }, 3000);
  }
  
  cancelChanges(): void {
    this.resetChanges();
  }
  
  resetChanges(): void {
    this.tempSettings = JSON.parse(JSON.stringify(this.originalSettings));
    
    // Reset form values
    this.accessibilityForm.get('reduceAnimations')?.setValue(
      this.tempSettings.accessibility.reduceAnimations,
      { emitEvent: false }
    );
    
    this.applyTempSettings();
    this.hasUnsavedChanges = false;
  }
  
  // Apply settings temporarily (for preview)
  applyTempSettings(): void {
    this.appSettingsService.applySettingsTemporarily(this.tempSettings);
    // Update local flag to match service
    this.hasUnsavedChanges = this.appSettingsService.hasUnsavedChanges();
  }
} 