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
  styleUrl: './navbar.component.css'
})
export class NavbarComponent implements OnInit {
  technicianName: string = 'Technician';
  showDropdown: boolean = false;
  
  constructor(
    private router: Router,
    private authService: AuthService,
    private userService: UserService
  ) {}
  
  ngOnInit(): void {
    this.loadTechnicianInfo();
  }
  
  loadTechnicianInfo(): void {
    // First try to get user ID from localStorage
    const storedUser = localStorage.getItem('user');
    let userId = null;
    
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        userId = userData.id;
        
        // Temporarily use name from localStorage while we fetch from API
        if (userData.name && userData.lastname) {
          this.technicianName = `${userData.name} ${userData.lastname}`;
        } else if (userData.name && userData.last_name) {
          this.technicianName = `${userData.name} ${userData.last_name}`;
        } else if (userData.first_name && userData.lastname) {
          this.technicianName = `${userData.first_name} ${userData.lastname}`;
        } else if (userData.first_name && userData.last_name) {
          this.technicianName = `${userData.first_name} ${userData.last_name}`;
        } else {
          this.technicianName = userData.name || userData.first_name || 'Technician';
        }
      } catch (e) {
        console.error('Error parsing user data', e);
        this.technicianName = 'Technician';
      }
    } else {
      this.technicianName = 'Technician';
      console.warn('No user data found in local storage.');
    }
    
    // If we have a userId, fetch fresh data from API
    if (userId) {
      this.userService.getUser(userId).subscribe({
        next: (userData) => {
          // Update with fresh data from API
          if (userData.name && userData.lastname) {
            this.technicianName = `${userData.name} ${userData.lastname}`;
          } else if (userData.name && userData.last_name) {
            this.technicianName = `${userData.name} ${userData.last_name}`;
          } else if (userData.first_name && userData.lastname) {
            this.technicianName = `${userData.first_name} ${userData.lastname}`;
          } else if (userData.first_name && userData.last_name) {
            this.technicianName = `${userData.first_name} ${userData.last_name}`;
          } else {
            this.technicianName = userData.name || userData.first_name || 'Technician';
          }
          
          // Update localStorage with latest data
          const updatedUserData = {
            id: userData.id,
            name: userData.name || userData.first_name || '',
            lastname: userData.lastname || userData.last_name || '',
            role: userData.role || 'TECHNICIAN',
            lastLogin: new Date().toISOString()
          };
          localStorage.setItem('user', JSON.stringify(updatedUserData));
        },
        error: (error) => {
          console.error('Error fetching user data:', error);
        }
      });
    } else {
      // If we don't have a userId, try to get the current user's role
      // This is a fallback only
      const role = this.authService.getUserRole();
      if (role === 'TECHNICIAN' || role === 'technician') {
        this.userService.getUsers('TECHNICIAN').subscribe({
          next: (technicians) => {
            if (technicians && technicians.length > 0) {
              const tech = technicians[0];
              this.technicianName = `${tech.name || tech.first_name || ''} ${tech.lastname || tech.last_name || ''}`.trim() || 'Technician';
              
              // Save to localStorage
              const userData = {
                id: tech.id,
                name: tech.name || tech.first_name || '',
                lastname: tech.lastname || tech.last_name || '',
                role: 'TECHNICIAN',
                lastLogin: new Date().toISOString()
              };
              localStorage.setItem('user', JSON.stringify(userData));
            }
          },
          error: (err) => console.error('Error fetching technicians:', err)
        });
      }
    }
  }
  
  getCurrentPage(): string {
    const url = this.router.url;
    
    if (url.includes('/dashboard')) return 'Dashboard';
    if (url.includes('/doctors')) return 'Doctor Management';
    if (url.includes('/logs')) return 'Doctor Logs';
    if (url.includes('/profile')) return 'My Profile';
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
