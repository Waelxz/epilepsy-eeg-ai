import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../../auth/auth.service';
import { UserService } from '../../../shared/services/user.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent implements OnInit {
  adminName: string = 'Admin';
  showDropdown: boolean = false;
  
  constructor(
    private router: Router,
    private authService: AuthService,
    private userService: UserService
  ) {}
  
  ngOnInit(): void {
    this.loadAdminInfo();
  }
  
  loadAdminInfo(): void {
    // First try to get user ID from localStorage
    const storedUser = localStorage.getItem('user');
    let userId = null;
    
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        userId = userData.id;
        
        // Temporarily use name from localStorage while we fetch from API
        if (userData.name && userData.lastname) {
          this.adminName = `${userData.name} ${userData.lastname}`;
        } else if (userData.name && userData.last_name) {
          this.adminName = `${userData.name} ${userData.last_name}`;
        } else if (userData.first_name && userData.lastname) {
          this.adminName = `${userData.first_name} ${userData.lastname}`;
        } else if (userData.first_name && userData.last_name) {
          this.adminName = `${userData.first_name} ${userData.last_name}`;
        } else {
          this.adminName = userData.name || userData.first_name || 'Admin';
        }
      } catch (e) {
        console.error('Error parsing user data', e);
        this.adminName = 'Admin';
      }
    } else {
      this.adminName = 'Admin';
      console.warn('No user data found in local storage.');
    }
    
    // If we have a userId, fetch fresh data from API
    if (userId) {
      this.userService.getUser(userId).subscribe({
        next: (userData) => {
          // Update with fresh data from API
          if (userData.name && userData.lastname) {
            this.adminName = `${userData.name} ${userData.lastname}`;
          } else if (userData.name && userData.last_name) {
            this.adminName = `${userData.name} ${userData.last_name}`;
          } else if (userData.first_name && userData.lastname) {
            this.adminName = `${userData.first_name} ${userData.lastname}`;
          } else if (userData.first_name && userData.last_name) {
            this.adminName = `${userData.first_name} ${userData.last_name}`;
          } else {
            this.adminName = userData.name || userData.first_name || 'Admin';
          }
          
          // Update localStorage with latest data
          const updatedUserData = {
            id: userData.id,
            name: userData.name || userData.first_name || '',
            lastname: userData.lastname || userData.last_name || '',
            role: userData.role || 'ADMIN',
            lastLogin: new Date().toISOString()
          };
          localStorage.setItem('user', JSON.stringify(updatedUserData));
        },
        error: (error) => {
          console.error('Error fetching user data:', error);
        }
      });
    }
  }
  
  getCurrentPage(): string {
    const url = this.router.url;
    
    if (url.includes('/dashboard')) return 'Dashboard';
    if (url.includes('/doctors')) return 'Doctor Management';
    if (url.includes('/technicians')) return 'Technician Management';
    if (url.includes('/logs')) return 'System Logs';
    if (url.includes('/models')) return 'Classification Models';
    if (url.includes('/settings')) return 'Settings';
    
    return 'Dashboard';
  }
  
  toggleDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.showDropdown = !this.showDropdown;
  }
  
  hideDropdown(): void {
    this.showDropdown = false;
  }
  
  navigateTo(path: string): void {
    this.router.navigate([path]);
    this.hideDropdown();
  }
  
  logout(): void {
    this.authService.logout();
  }
  
  // Close dropdown when clicking outside
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const userProfile = document.querySelector('.user-profile');
    if (userProfile && !userProfile.contains(event.target as Node) && this.showDropdown) {
      this.showDropdown = false;
    }
  }
}
