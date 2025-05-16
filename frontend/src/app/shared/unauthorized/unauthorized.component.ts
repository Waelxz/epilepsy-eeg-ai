import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="unauthorized-container">
      <div class="content">
        <h1>Access Denied</h1>
        <p>You do not have permission to access this page.</p>
        <div class="buttons">
          <button (click)="goToDashboard()" class="primary-btn">Go to Dashboard</button>
          <button (click)="logout()" class="secondary-btn">Logout</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .unauthorized-container {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      background-color: #f5f5f5;
    }
    .content {
      background: white;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      text-align: center;
      max-width: 400px;
    }
    h1 {
      color: #e53935;
      margin-bottom: 1rem;
    }
    p {
      margin-bottom: 2rem;
      color: #555;
    }
    .buttons {
      display: flex;
      justify-content: center;
      gap: 1rem;
    }
    .primary-btn {
      background-color: #3f51b5;
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 4px;
      cursor: pointer;
    }
    .secondary-btn {
      background-color: transparent;
      color: #3f51b5;
      border: 1px solid #3f51b5;
      padding: 0.5rem 1rem;
      border-radius: 4px;
      cursor: pointer;
    }
  `]
})
export class UnauthorizedComponent {
  constructor(private authService: AuthService) {}

  goToDashboard() {
    const role = this.authService.getUserRole();
    if (role) {
      window.location.href = `/${role}`;
    } else {
      this.logout();
    }
  }

  logout() {
    this.authService.logout();
  }
} 