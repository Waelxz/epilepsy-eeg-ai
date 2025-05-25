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
    
    // Load current user data
    this.loadUserData();
  }
  
  loadUserData(): void {
    this.isLoadingUser = true;
    this.userService.getCurrentUserProfile().subscribe({
      next: (userData) => {
        console.log('User data received:', userData);
        this.currentUser = userData;
        this.isLoadingUser = false;
      },
      error: (error) => {
        console.error('Error loading user data:', error);
        this.userError = true;
        this.isLoadingUser = false;
      }
    });
  }
  
  // Get user's full name
  getUserFullName(): string {
    if (this.isLoadingUser) {
      return 'Loading...';
    }
    
    if (this.userError || !this.currentUser) {
      return 'Doctor';
    }
    
    // Check all possible property name combinations
    const firstName = this.currentUser.first_name || this.currentUser.firstName || '';
    const lastName = this.currentUser.last_name || this.currentUser.lastName || '';
    
    if (firstName && lastName) {
      return `Dr. ${firstName} ${lastName}`;
    } else if (this.currentUser.name) {
      return `Dr. ${this.currentUser.name}`;
    } else if (this.currentUser.username) {
      return `Dr. ${this.currentUser.username}`;
    } else if (this.currentUser.email) {
      // Fallback to email if no name fields are available
      return `Dr. ${this.currentUser.email.split('@')[0]}`;
    } else {
      return 'Doctor';
    }
  }

  toggleTheme(): void {
    this.isDarkMode = !this.isDarkMode;
    // Update app settings
    this.appSettingsService.saveSettings({
      ...this.appSettingsService.getSettings(),
      theme: this.isDarkMode ? 'dark' : 'light'
    });
  }
  
  logout() {
    this.authService.logout();
  }
}
