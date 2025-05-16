import { Component, HostListener, OnInit } from '@angular/core';
import { AuthService } from '../../../auth/auth.service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AppSettingsService } from '../../../shared/services/app-settings.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent implements OnInit {
  isDropdownOpen = false;
  isDarkMode = false;

  constructor(
    private authService: AuthService, 
    private router: Router,
    private appSettingsService: AppSettingsService
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
  }

  toggleDropdown(): void {
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  toggleTheme(): void {
    this.isDarkMode = !this.isDarkMode;
    // Update app settings
    this.appSettingsService.saveSettings({
      ...this.appSettingsService.getSettings(),
      theme: this.isDarkMode ? 'dark' : 'light'
    });
  }

  logout(): void {
    this.authService.logout();
  }

  // Close dropdown when clicking outside
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const dropdown = document.querySelector('.profile-dropdown');
    if (dropdown && !dropdown.contains(event.target as Node)) {
      this.isDropdownOpen = false;
    }
  }
}
