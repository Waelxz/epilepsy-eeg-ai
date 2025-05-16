import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, catchError, throwError, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { isPlatformBrowser } from '@angular/common';

// Define a type for permission groups
type PermissionGroupMap = {
  [key: string]: string[];
};

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:8000/api';
  private tokenKey = 'auth_token';
  private userRoleKey = 'user_role';
  private permissionGroupsKey = 'permission_groups';
  private isBrowser: boolean;

  // Permission groups with their individual permissions mapping
  private permissionGroupMap: PermissionGroupMap = {
    'manage_patients': ['view_patients', 'add_patients', 'edit_patients', 'delete_patients'],
    'manage_eeg': ['upload_eeg', 'analyze_eeg', 'view_analysis'],
    'manage_reports': ['export_results', 'generate_reports']
  };

  constructor(
    private http: HttpClient, 
    private router: Router,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  login(username: string, password: string): Observable<any> {
    return this.http.post<{ 
      access_token: string, 
      token_type: string,
      permission_groups: string[],
      user?: {
        id: string,
        name: string,
        lastname: string,
        role: string,
        username?: string,
        preferred_username?: string
      }
    }>(`${this.apiUrl}/login`, { username, password })
      .pipe(
        tap(response => {
          if (response.access_token && this.isBrowser) {
            localStorage.setItem(this.tokenKey, response.access_token);
            
            try {
              const payload = this.decodeToken(response.access_token);
              if (payload && payload.role) {
                localStorage.setItem(this.userRoleKey, payload.role);
              }
              if (payload && payload.permission_groups) {
                localStorage.setItem(this.permissionGroupsKey, JSON.stringify(payload.permission_groups));
              }
              
              // Save user info if available from response
              if (response.user) {
                const userData = {
                  id: response.user.id,
                  name: response.user.name || '',
                  lastname: response.user.lastname || '',
                  role: response.user.role || payload.role,
                  username: username || response.user.username || '',
                  lastLogin: new Date().toISOString()
                };
                localStorage.setItem('user', JSON.stringify(userData));
                console.log('Saved user data to localStorage:', userData);
              } else {
                // If token has user information, use that
                const userData = {
                  id: payload.sub || '',
                  name: payload.name || payload.given_name || '',
                  lastname: payload.lastname || payload.family_name || '',
                  role: payload.role || '',
                  username: username || payload.username || payload.preferred_username || '',
                  lastLogin: new Date().toISOString()
                };
                
                // Only store meaningful data
                if (userData.id || userData.name || userData.lastname || userData.role || userData.username) {
                  localStorage.setItem('user', JSON.stringify(userData));
                  console.log('Saved token-based user data:', userData);
                }
              }
            } catch (error) {
              console.error('Error decoding token during login:', error);
            }
          }
        }),
        catchError((error: HttpErrorResponse) => {
          let errorMessage = 'An error occurred';
          if (error.error && error.error.detail) {
            errorMessage = error.error.detail;
          }
          return throwError(() => new Error(errorMessage));
        })
      );
  }

  logout(): void {
    // Get token before clearing local storage
    const token = this.getToken();
    
    // Call logout API if we have a token
    if (token) {
      this.http.post(`${this.apiUrl}/logout`, {}, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }).subscribe({
        next: (response) => {
          console.log('Logout successful:', response);
        },
        error: (error) => {
          console.error('Error during logout:', error);
        },
        complete: () => {
          // Clear local storage and navigate regardless of API success
          this.clearStorageAndNavigate();
        }
      });
    } else {
      // If no token, just clear storage and navigate
      this.clearStorageAndNavigate();
    }
  }
  
  // Helper method to clear storage and navigate
  private clearStorageAndNavigate(): void {
    if (this.isBrowser) {
      localStorage.removeItem(this.tokenKey);
      localStorage.removeItem(this.userRoleKey);
      localStorage.removeItem(this.permissionGroupsKey);
      localStorage.removeItem('user'); // Also remove user data
    }
    this.router.navigate(['/login']);
  }

  isLoggedIn(): boolean {
    const token = this.getToken();
    if (!token) return false;
    
    try {
      const payload = this.decodeToken(token);
      // Check if token is expired
      if (payload.exp && payload.exp < Date.now() / 1000) {
        this.logout();
        return false;
      }
      return true;
    } catch {
      // If token is invalid, clear it
      this.logout();
      return false;
    }
  }

  getToken(): string | null {
    if (!this.isBrowser) return null;
    return localStorage.getItem(this.tokenKey);
  }

  getUserRole(): string | null {
    // First try to get from localStorage for efficiency
    if (this.isBrowser) {
      const cachedRole = localStorage.getItem(this.userRoleKey);
      if (cachedRole) return cachedRole;
    }
    
    // Fall back to token decoding
    const token = this.getToken();
    if (token) {
      try {
        const payload = this.decodeToken(token);
        if (payload && payload.role) {
          // Cache the role for future calls
          if (this.isBrowser) {
            localStorage.setItem(this.userRoleKey, payload.role);
          }
          return payload.role;
        }
      } catch {
        return null;
      }
    }
    return null;
  }

  hasRole(allowedRoles: string[]): boolean {
    const userRole = this.getUserRole();
    return userRole !== null && allowedRoles.includes(userRole);
  }

  // Get user permission groups from token or local storage
  getPermissionGroups(): string[] {
    // First try to get from localStorage for efficiency
    if (this.isBrowser) {
      const cachedGroups = localStorage.getItem(this.permissionGroupsKey);
      if (cachedGroups) {
        try {
          return JSON.parse(cachedGroups);
        } catch {
          return [];
        }
      }
    }
    
    // Fall back to token decoding
    const token = this.getToken();
    if (token) {
      try {
        const payload = this.decodeToken(token);
        if (payload && payload.permission_groups) {
          // Cache the groups for future calls
          if (this.isBrowser) {
            localStorage.setItem(this.permissionGroupsKey, JSON.stringify(payload.permission_groups));
          }
          return payload.permission_groups;
        }
      } catch {
        return [];
      }
    }
    return [];
  }

  // Get user permissions from token
  getUserPermissions(): string[] {
    // Get permission groups first
    const groups = this.getPermissionGroups();
    
    // Expand groups to individual permissions
    return this.expandPermissionGroups(groups);
  }

  // Check if user has a specific permission group
  hasPermissionGroup(group: string): boolean {
    const groups = this.getPermissionGroups();
    return groups.includes(group);
  }

  // Check if user has a specific permission
  hasPermission(permission: string): boolean {
    // If it's a group, check directly
    if (Object.keys(this.permissionGroupMap).includes(permission)) {
      return this.hasPermissionGroup(permission);
    }
    
    // Otherwise, expand all groups and check
    const perms = this.getUserPermissions();
    return perms.includes(permission);
  }

  // Convert permission groups to individual permissions
  private expandPermissionGroups(groups: string[]): string[] {
    let permissions: string[] = [];
    groups.forEach(group => {
      if (this.permissionGroupMap[group]) {
        permissions = [...permissions, ...this.permissionGroupMap[group]];
      }
    });
    return permissions;
  }

  private decodeToken(token: string): any {
    try {
      return JSON.parse(atob(token.split('.')[1]));
    } catch (error) {
      console.error('Error decoding token:', error);
      this.logout();
      throw error;
    }
  }

  // This is a helper method for testing only - not for production use
  setTestUserData(name: string, lastname: string, role: string = 'technician'): void {
    if (this.isBrowser) {
      const testUser = {
        name: name,
        lastname: lastname,
        role: role.toUpperCase(),
        lastLogin: new Date().toISOString()
      };
      localStorage.setItem('user', JSON.stringify(testUser));
      console.log('Set test user data:', testUser);
    }
  }

  // Get decoded token for profile usage
  getDecodedToken(): any {
    const token = this.getToken();
    if (!token) return null;
    
    try {
      return this.decodeToken(token);
    } catch {
      return null;
    }
  }
  
  // Change password implementation
  changePassword(currentPassword: string, newPassword: string): Observable<any> {
    const token = this.getToken();
    if (!token) {
      return throwError(() => new Error('Not authenticated'));
    }
    
    return this.http.post(
      `${this.apiUrl}/change-password`, 
      { currentPassword, newPassword },
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    ).pipe(
      catchError((error: HttpErrorResponse) => {
        let errorMessage = 'Failed to change password';
        if (error.error && error.error.detail) {
          errorMessage = error.error.detail;
        }
        return throwError(() => new Error(errorMessage));
      })
    );
  }
}