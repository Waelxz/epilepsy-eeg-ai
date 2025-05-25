import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { tap } from 'rxjs/operators';

// Check if we can access environment
const API_URL = environment?.apiUrl || 'http://localhost:8000/api';

export interface OAuthStatus {
  authenticated: boolean;
  email?: string;
  has_refresh_token?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class OAuthService {
  private apiUrl = `${API_URL}/auth/google`;

  constructor(private http: HttpClient) { }

  /**
   * Get Google OAuth URL for authentication
   */
  getOAuthUrl(): Observable<{ auth_url: string }> {
    return this.http.get<{ auth_url: string }>(`${this.apiUrl}/login`);
  }

  /**
   * Check if user is authenticated with Google
   */
  checkAuthStatus(): Observable<OAuthStatus> {
    return this.http.get<OAuthStatus>(`${this.apiUrl}/status`);
  }

  /**
   * Refresh OAuth token
   */
  refreshToken(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/refresh`);
  }

  /**
   * Log out from Google
   */
  logout(): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/logout`, {});
  }

  /**
   * Redirect user to Google authentication page
   */
  redirectToGoogleAuth(): void {
    this.getOAuthUrl().subscribe({
      next: (response) => {
        if (response && response.auth_url) {
          window.location.href = response.auth_url;
        } else {
          console.error('No auth URL received from server');
        }
      },
      error: (error) => {
        console.error('Error getting OAuth URL:', error);
      }
    });
  }
} 