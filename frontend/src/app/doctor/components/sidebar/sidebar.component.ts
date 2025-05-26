import { Component, OnInit } from '@angular/core';
import { RouterModule, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../auth/auth.service';
import { AppSettingsService } from '../../../shared/services/app-settings.service';
import { UserService } from '../../../shared/services/user.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    RouterLink,
    RouterLinkActive
  ],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent implements OnInit {
  isDarkMode = false;
  isDoctorDarkMode = false; // Specific flag for doctor dark theme
  currentUser: any = null;
  isLoadingUser: boolean = true;
  userError: boolean = false;

  constructor(
    private authService: AuthService,
    private appSettingsService: AppSettingsService,
    private userService: UserService
  ) {}
  
  ngOnInit(): void {
    // Get current theme from app settings
    const currentSettings = this.appSettingsService.getSettings();
    
    // Determine if dark mode is active
    if (currentSettings.theme === 'dark') {
      this.isDarkMode = true;
    } else if (currentSettings.theme === 'system') {
      this.isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    } else {
      this.isDarkMode = false;
    }
    
    // Check for doctor dark mode preference
    this.isDoctorDarkMode = localStorage.getItem('doctor_dark_mode') === 'true';
    
    // If doctor dark mode is enabled, apply it regardless of the app theme
    if (this.isDoctorDarkMode) {
      this.applyDoctorDarkTheme(true);
    }
    
    // Load current user data
    this.loadUserData();
  }
  
  loadUserData(): void {
    // Get current user data from UserService
    this.userService.getCurrentUserProfile().subscribe({
      next: (userData) => {
        console.log('Dashboard - User data received:', userData);
        
        // Check all possible property name combinations
        const firstName = userData.first_name || userData.firstName || '';
        const lastName = userData.last_name || userData.lastName || '';
        
        this.currentUser= {
          firstName: userData.firstName || userData.first_name || userData.name || '',
          lastName: userData.lastName || userData.last_name || userData.lastname || '',
        }
      },
      error: (error) => {
        console.error('Error loading user info:', error);
        // Use default name on error
        this.currentUser = 'Dr. Smith';
      }
    });
  }
  
  // Get user's full name


  // Toggle app-wide theme
  toggleTheme(): void {
    this.isDarkMode = !this.isDarkMode;
    // Update app settings
    this.appSettingsService.saveSettings({
      ...this.appSettingsService.getSettings(),
      theme: this.isDarkMode ? 'dark' : 'light'
    });
  }
  
  // Toggle doctor-specific dark theme
  toggleDoctorTheme(): void {
    this.isDoctorDarkMode = !this.isDoctorDarkMode;
    
    // Save preference
    localStorage.setItem('doctor_dark_mode', this.isDoctorDarkMode.toString());
    
    // Apply or remove doctor dark theme
    this.applyDoctorDarkTheme(this.isDoctorDarkMode);
  }
  
  // Apply or remove doctor dark theme
  applyDoctorDarkTheme(apply: boolean): void {
    const body = document.body;
    
    if (apply) {
      // Add doctor-module class to enable scoping if not already present
      if (!body.classList.contains('doctor-module')) {
        body.classList.add('doctor-module');
      }
      
      // Add the theme-dark class for doctor dark theme
      body.classList.add('theme-dark');
      
      // Ensure dark theme styles are loaded
      this.ensureDoctorDarkThemeStyles();
    } else {
      // Remove the theme-dark class
      body.classList.remove('theme-dark');
      
      // We keep the doctor-module class for proper scoping
    }
  }
  
  // Ensure dark theme styles are loaded
  private ensureDoctorDarkThemeStyles(): void {
    if (!document.getElementById('doctor-dark-theme-styles')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'doctor-dark-theme-styles';
      
      // Load CSS file
      fetch('assets/doctor-dark-theme.css')
        .then(response => response.text())
        .then(css => {
          styleEl.textContent = css;
          document.head.appendChild(styleEl);
        })
        .catch(error => {
          console.error('Error loading doctor dark theme:', error);
        });
    }
  }
  
  logout() {
    this.authService.logout();
  }
}
