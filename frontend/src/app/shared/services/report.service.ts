import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, catchError, throwError, of, map } from 'rxjs';
import { AuthService } from '../../auth/auth.service';

export interface Report {
  _id?: string;  // MongoDB ID
  id?: string;
  analysisId: string;
  patientId: string;
  reportType: 'patient' | 'analysis';
  generatedDate?: Date | string;
  filePath?: string;
  content?: string;
  createdBy?: string;
  isShared?: boolean;
  shareHistory?: Array<{
    sharedWith: string;
    sharedDate: Date | string;
    sharedBy: string;
  }>;
}

export interface PaginatedReportResponse {
  items: Report[];
  metadata: {
    total_count: number;
    page_size: number;
    current_page: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
  };
}

// Define interface for OAuth response
interface OAuthResponse {
  status?: string;
  auth_url?: string;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ReportService {
  private apiUrl = 'http://localhost:8000/api/reports';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  // Get HTTP headers with auth token
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
  private handleError(error: any) {
    console.error('API error:', error);
    
    // Log more details about the error
    if (error.error) {
      console.error('Error details:', error.error);
      
      // Handle FastAPI validation errors which come as arrays
      if (Array.isArray(error.error.detail)) {
        console.error('FastAPI validation errors:');
        error.error.detail.forEach((err: any, index: number) => {
          console.error(`Error ${index + 1}:`, err);
        });
      } else if (error.error.detail) {
        console.error('Error message:', error.error.detail);
      }
    }
    
    let errorMessage = 'An unknown error occurred';
    
    // Extract meaningful error message
    if (error.error) {
      if (Array.isArray(error.error.detail)) {
        // Join all validation errors
        errorMessage = error.error.detail
          .map((err: any) => err.msg || JSON.stringify(err))
          .join('; ');
      } else if (error.error.detail) {
        errorMessage = error.error.detail;
      } else if (typeof error.error === 'string') {
        errorMessage = error.error;
      }
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return throwError(() => new Error(errorMessage));
  }

  // Get all reports with filters and pagination
  getReports(params?: any): Observable<PaginatedReportResponse> {
    let httpParams = new HttpParams();
    
    if (params) {
      if (params.patientId) {
        httpParams = httpParams.set('patient_id', params.patientId);
        console.log('Setting patient_id filter:', params.patientId);
      }
      if (params.analysisId) httpParams = httpParams.set('analysis_id', params.analysisId);
      if (params.page) httpParams = httpParams.set('page', params.page);
      if (params.limit) httpParams = httpParams.set('limit', params.limit);
      if (params.reportType) httpParams = httpParams.set('report_type', params.reportType);
      if (params.startDate) httpParams = httpParams.set('startDate', params.startDate);
      if (params.endDate) httpParams = httpParams.set('endDate', params.endDate);
      if (params.search) httpParams = httpParams.set('search', params.search);
    }
    
    console.log('Final HTTP params for reports request:', httpParams.toString());
    
    return this.http.get<PaginatedReportResponse>(this.apiUrl, {
      ...this.getHttpOptions(),
      params: httpParams
    }).pipe(
      catchError(this.handleError)
    );
  }

  // Get report by ID
  getReportById(id: string): Observable<Report> {
    return this.http.get<Report>(`${this.apiUrl}/${id}`, this.getHttpOptions())
      .pipe(
        catchError(this.handleError)
      );
  }

  // Generate report for analysis
  generateReport(analysisId: string, reportType: 'patient' | 'analysis'): Observable<Report> {
    console.log(`DEBUG: Generating report with type ${reportType} for analysis ${analysisId}`);
    
    // Create request payload as a plain JavaScript object
    const payload = {
      analysisId: analysisId,
      reportType: reportType
    };
    
    console.log('DEBUG: Report request payload:', payload);
    
    // Get the token
    const token = this.authService.getToken() || '';  // Default to empty string if null
    
    // Use only the Authorization header, not the query parameter
    const httpOptions = {
      headers: new HttpHeaders({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      })
    };
    
    // Let Angular HttpClient handle the serialization
    return this.http.post<Report>(
      `${this.apiUrl}/generate`, 
      payload,
      httpOptions
    ).pipe(
        catchError(this.handleError)
      );
  }

  // Get report file for download
  downloadReport(reportId: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${reportId}/download`, {
      ...this.getHttpOptions(),
      responseType: 'blob'
    }).pipe(
      catchError(this.handleError)
    );
  }

  // Share report via email
  shareReportViaEmail(reportId: string, recipientEmail: string, useOAuth: boolean = true, directRedirect: boolean = true): Observable<any> {
    // If using direct redirect, we need to handle the request differently
    if (directRedirect) {
      // For direct redirects, we'll use window.location.href to navigate directly
      // This avoids CORS issues with programmatic redirect following
      
      // Get the auth token
      const token = this.authService.getToken();
      
      // Check if user is already authenticated with Google first
      return this.http.get(`${this.apiUrl.replace('/reports', '')}/auth/google/status`)
        .pipe(
          map((response: any) => {
            // Build the URL with query parameters
            const shareUrl = `${this.apiUrl}/${reportId}/share`;
            const params = new URLSearchParams();
            params.append('email', recipientEmail);
            params.append('direct_redirect', 'true');
            params.append('token', token || '');
            
            // If already authenticated with Google, add pre_auth parameter
            if (response.authenticated) {
              params.append('pre_auth', 'true');
            }
            
            // Navigate directly to the URL - this avoids CORS issues
            window.location.href = `${shareUrl}?${params.toString()}`;
            
            return { status: 'redirecting' };
          }),
          catchError(error => {
            console.error('Error checking Google auth status:', error);
            // Continue with standard flow even if auth check fails
            const shareUrl = `${this.apiUrl}/${reportId}/share`;
            const params = new URLSearchParams();
            params.append('email', recipientEmail);
            params.append('direct_redirect', 'true');
            params.append('token', token || '');
            
            window.location.href = `${shareUrl}?${params.toString()}`;
            return of({ status: 'redirecting' });
          })
        );
    } else {
      // Traditional AJAX approach (may have session issues)
      return this.http.post(`${this.apiUrl}/${reportId}/share`, { 
        email: recipientEmail,
        use_oauth: useOAuth 
      }, this.getHttpOptions())
        .pipe(
          catchError(this.handleError)
        );
    }
  }

  // Delete a report
  deleteReport(reportId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${reportId}`, this.getHttpOptions())
      .pipe(
        catchError(this.handleError)
      );
  }
} 