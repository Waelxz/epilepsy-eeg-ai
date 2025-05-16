import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { retry, catchError } from 'rxjs/operators';
import { AuthService } from '../../auth/auth.service';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = 'http://localhost:8000/api';

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

  // Error handling
  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An unknown error occurred';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Error: ${error.error.message}`;
      console.error('Client-side error:', error.error.message);
    } else {
      // Server-side error
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
      if (error.error && error.error.detail) {
        errorMessage += `\nDetails: ${error.error.detail}`;
      }
      console.error('Server-side error:', {
        status: error.status,
        statusText: error.statusText,
        message: error.message,
        error: error.error
      });
    }
    
    // Return the original error object to preserve status codes and other details
    return throwError(() => error);
  }

  // Get all users
  getUsers(role?: string): Observable<any[]> {
    let url = `${this.apiUrl}/users`;
    if (role) {
      url += `?role=${role}`;
    }
    return this.http.get<any[]>(url, this.getHttpOptions())
      .pipe(
        catchError(this.handleError)
      );
  }

  // Get user by ID
  getUser(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/users/${id}`, this.getHttpOptions())
      .pipe(
        catchError(this.handleError)
      );
  }

  // Get current user's profile
  getCurrentUserProfile(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/users/me`, this.getHttpOptions())
      .pipe(
        catchError(this.handleError)
      );
  }

  // Create new user
  createUser(userData: any): Observable<any> {
    console.log('Creating user with data:', userData);
    
    // Use standard URL without query parameters
    const url = `${this.apiUrl}/users/create`;
    
    // Get HTTP options with authorization header
    const options = this.getHttpOptions();
    console.log('Auth headers:', options.headers);
    
    // Add debug output to see exactly what's being sent to the server
    const formattedData = JSON.stringify(userData, null, 2);
    console.log('Formatted data being sent to server:', formattedData);
    
    // Use the standard authorization pattern like other endpoints
    return this.http.post<any>(url, userData, options)
      .pipe(
        catchError((error) => {
          console.error('Error in createUser:', error);
          console.error('Error status:', error.status);
          console.error('Error message:', error.message);
          
          // Specifically handle 422 Unprocessable Entity errors
          if (error.status === 422) {
            console.error('422 Validation Error:', error.error);
            if (error.error && error.error.detail) {
              // Log each validation error
              if (Array.isArray(error.error.detail)) {
                console.error('Validation error details:');
                error.error.detail.forEach((err: any) => {
                  console.error(`Field: ${err.loc.join('.')}, Error: ${err.msg}, Type: ${err.type}`);
                });
              }
            }
          }
          
          console.error('Error details:', error.error);
          return this.handleError(error);
        })
      );
  }

  // Update existing user
  updateUser(id: string, userData: any): Observable<any> {
    console.log('Updating user with ID:', id);
    console.log('Update payload:', userData);
    
    const options = this.getHttpOptions();
    console.log('Request headers:', options.headers);
    
    return this.http.put<any>(`${this.apiUrl}/users/${id}`, userData, options)
      .pipe(
        retry(1), // Retry once before failing
        catchError((error: HttpErrorResponse) => {
          // Special handling for "not modified" cases
          if (error.status === 500 && 
             error.error?.detail && 
             (error.error.detail.includes('not modified') || error.error.detail.includes('identical'))) {
            console.log('Server reported data not modified, treating as success');
            
            // Return a success response instead of error
            // We'll create a simple object similar to what the API would return
            return of({ 
              id: id,
              message: 'No changes were needed as data was identical',
              success: true
            });
          }
          
          // For all other errors, use the standard error handler
          return this.handleError(error);
        })
      );
  }

  // Update current user's profile
  updateCurrentUserProfile(userData: any): Observable<any> {
    console.log('Updating current user profile:', userData);
    
    const options = this.getHttpOptions();
    
    return this.http.patch<any>(`${this.apiUrl}/users/me`, userData, options)
      .pipe(
        retry(1), // Retry once before failing
        catchError((error: HttpErrorResponse) => {
          // Special handling for "not modified" cases
          if (error.status === 500 && 
             error.error?.detail && 
             (error.error.detail.includes('not modified') || error.error.detail.includes('identical'))) {
            console.log('Server reported data not modified, treating as success');
            
            // Return a success response instead of error
            return of({ 
              message: 'No changes were needed as data was identical',
              success: true
            });
          }
          
          // For all other errors, use the standard error handler
          return this.handleError(error);
        })
      );
  }

  // Delete user
  deleteUser(id: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/users/${id}`, this.getHttpOptions())
      .pipe(
        catchError(this.handleError)
      );
  }
} 