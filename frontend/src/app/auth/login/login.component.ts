import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { AuthService } from '../auth.service';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule, isPlatformBrowser } from '@angular/common';

// Add a global function to set test user data from the browser console
declare global {
  interface Window {
    setTestUser?: (name: string, lastname: string, role?: string) => void;
  }
}

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  standalone: true,
  imports: [RouterModule, FormsModule, CommonModule],
  providers: [AuthService],
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  username = '';
  password = '';
  errorMessage = '';
  isLoading = false;
  isSuccess = false;
  showPopup = false;
  isFadingOut = false;
  isInputSuccess = false;
  fieldTouched = { username: false, password: false };
  private isBrowser: boolean;

  constructor(
    private authService: AuthService, 
    private router: Router,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    
    // Only set up the test function if we're in a browser environment
    if (this.isBrowser && window) {
      window.setTestUser = (name: string, lastname: string, role: string = 'technician') => {
        this.authService.setTestUserData(name, lastname, role);
        alert(`Test user set: ${name} ${lastname} (${role}). Refresh the page to see changes.`);
      };
    }
  }

  ngOnInit(): void {
    // Check if user is already logged in
    if (this.authService.isLoggedIn()) {
      const role = this.authService.getUserRole();
      if (role) {
        this.redirectBasedOnRole(role);
      }
    }
    
    // Create a test user directly (safer approach than using window)
    if (this.isBrowser) {
      // Let's check if we need to add a test user (if none exists)
      const storedUser = localStorage.getItem('user');
      if (!storedUser) {
        this.authService.setTestUserData('Technical', 'Support', 'technician');
        console.log('Created default test user');
      }
    }
  }

  // Track when fields are touched for better validation UX
  onFieldFocus(field: 'username' | 'password'): void {
    this.fieldTouched[field] = true;
  }

  // Clear error when user starts typing after an error
  onFieldInput(): void {
    if (this.errorMessage) {
      this.errorMessage = '';
    }
  }

  login() {
    // Mark both fields as touched when attempting to login
    this.fieldTouched = { username: true, password: true };

    if (!this.username || !this.password) {
      this.errorMessage = 'Please enter both username and password';
      return;
    }

    this.isLoading = true;
    this.showPopup = true;
    this.errorMessage = ''; // Clear any previous error messages
    this.isInputSuccess = false; // Reset success state
  
    // Simulate a 1.5-second loading delay
    setTimeout(() => {
      this.authService.login(this.username, this.password).subscribe(
        (response: any) => {
          this.isLoading = false;
          this.isFadingOut = true;
          this.isInputSuccess = true; // Set success state for inputs
  
          // Wait for fade-out to complete (0.5 seconds), then switch to success
          setTimeout(() => {
            this.isFadingOut = false;
            this.isSuccess = true;
  
            // Wait for 1.5 seconds to show the success animation, then redirect
            setTimeout(() => {
              const role = this.authService.getUserRole();
              if (role) {
                this.redirectBasedOnRole(role);
              } else {
                this.errorMessage = 'Invalid user role';
                this.isSuccess = false;
                this.showPopup = false;
              }
            }, 1800); // Increased from 1400ms to 1800ms for better animation visibility
          }, 500);
        },
        (error) => {
          this.isLoading = false;
          this.showPopup = false;
          
          // Provide more user-friendly error messages
          if (error.message?.includes('Invalid credentials')) {
            this.errorMessage = 'Incorrect username or password. Please try again.';
          } else {
            this.errorMessage = error.message || 'Login failed. Please try again later.';
          }
          
          this.isInputSuccess = false;
          
          // Shake animation on error
          const form = document.querySelector('form');
          if (form) {
            form.classList.add('animate__animated', 'animate__shakeX');
            setTimeout(() => {
              form.classList.remove('animate__animated', 'animate__shakeX');
            }, 1000);
          }
        }
      );
    }, 1500);
  }

  // Helper method to redirect based on role
  private redirectBasedOnRole(role: string): void {
    switch (role) {
      case 'doctor':
        this.router.navigate(['/doctor']);
        break;
      case 'technician':
        this.router.navigate(['/technician']);
        break;
      case 'admin':
        this.router.navigate(['/admin']);
        break
      default:
        this.errorMessage = 'Unknown role: ' + role;
        this.isSuccess = false;
        this.showPopup = false;
        // Logout the user since we can't determine where to send them
        this.authService.logout();
    }
  }
}