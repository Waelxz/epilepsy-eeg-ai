import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../../auth/auth.service';

export interface PaginationMetadata {
  total_count: number;
  page_size: number;
  current_page: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  metadata: PaginationMetadata;
}

export interface Log {
  id: string;
  timestamp: string;
  user_id?: string;
  username?: string;
  action: string;
  description: string;
  ip_address?: string;
  details?: any;
}

@Injectable({
  providedIn: 'root'
})
export class LogsService {
  private apiUrl = 'http://localhost:8000/api/logs';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  // Get the HTTP options with auth token
  private getHttpOptions() {
    const token = this.authService.getToken();
    return {
      headers: new HttpHeaders({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      })
    };
  }

  // Get logs with pagination
  getLogs(filters?: any): Observable<PaginatedResponse<Log>> {
    let params = new HttpParams();
    
    // Default values for pagination
    const limit = filters?.limit || 10;
    const page = filters?.page || 1;
    const skip = (page - 1) * limit;
    
    params = params.set('limit', limit.toString());
    params = params.set('skip', skip.toString());
    
    if (filters) {
      // Add action filter - prioritize action_type parameter (doctor-logs style)
      if (filters.action_type && filters.action_type.trim() !== '') {
        // Use action_type as-is without lowercase conversion
        const actionType = filters.action_type.trim();
        params = params.set('action', actionType);
        console.log('Setting action param from action_type:', actionType);
      }
      // If no action_type, try other action parameters (fallback)
      else if (filters.actions && Array.isArray(filters.actions)) {
        // Handle multiple action types
        filters.actions.forEach((action: string) => {
          params = params.append('action', action);
        });
        console.log('Setting action params (multiple):', filters.actions);
      } else if (filters.action && filters.action.trim() !== '') {
        // Handle single action type
        const action = filters.action.trim();
        params = params.set('action', action);
        console.log('Setting action param (single) to:', action);
      }
      
      // Add target_username filter
      if (filters.target_username && filters.target_username.trim() !== '') {
        const targetUsername = filters.target_username.trim();
        params = params.set('target_username', targetUsername);
        console.log('Setting target_username param to:', targetUsername);
      }
      
      // Add other filters
      if (filters.user_id) {
        params = params.set('user_id', filters.user_id);
      }
      if (filters.start_date) {
        params = params.set('start_date', filters.start_date);
      }
      if (filters.end_date) {
        params = params.set('end_date', filters.end_date);
      }
      if (filters.search) {
        params = params.set('search', filters.search);
      }
      if (filters.user_role) {
        params = params.set('user_role', filters.user_role);
      }
    }
    
    console.log('API request params:', params.toString());
    console.log('Full API request URL:', `${this.apiUrl}?${params.toString()}`);
    
    return this.http.get<PaginatedResponse<Log>>(this.apiUrl, {
      ...this.getHttpOptions(),
      params
    });
  }

  // Get all possible log action types
  getLogActionTypes(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/actions`, this.getHttpOptions());
  }
} 