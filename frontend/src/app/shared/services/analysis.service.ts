import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams, HttpEvent } from '@angular/common/http';
import { Observable, catchError, throwError, BehaviorSubject, map, of, switchMap } from 'rxjs';
import { AuthService } from '../../auth/auth.service';

export interface Analysis {
  _id?: string;  // MongoDB ID
  id?: string;   // For compatibility
  patientId: string;
  fileName: string;
  filePath?: string;
  fileSize?: number;
  fileType?: string;
  uploadDate?: Date | string;
  modelUsed: string;
  status?: 'queued' | 'processing' | 'completed' | 'failed';
  processingStartTime?: Date | string;
  processingEndTime?: Date | string;
  error?: string;  // Error message for failed analyses
  result?: {
    class: number;
    probability: number;
    interpretation?: string;
    metrics?: {
      accuracy?: number;
      recall?: number;
      precision?: number;
      specificity?: number;
    };
  };
  notes?: string;
  reportGenerated?: boolean;
  reportPath?: string;
  createdAt?: Date | string;
}

export interface BackendResponse {
  items: any[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}

export interface PaginatedAnalysisResponse {
  items: Analysis[];
  metadata: {
    total_count: number;
    page_size: number;
    current_page: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
  };
}

export interface Model {
  id: string;
  name: string;
  version: string;
  description?: string;
  is_default?: boolean;
  is_active?: boolean;
  upload_date?: Date | string;
}

@Injectable({
  providedIn: 'root'
})
export class AnalysisService {
  private apiUrl = 'http://localhost:8000/api/analyses';
  private _activeAnalysis = new BehaviorSubject<Analysis | null>(null);
  
  activeAnalysis$ = this._activeAnalysis.asObservable();

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

  // Get HTTP headers with auth token for file uploads
  private getFileUploadHttpOptions() {
    const token = this.authService.getToken();
    return {
      headers: new HttpHeaders({
        'Authorization': `Bearer ${token}`
      })
    };
  }

  // Error handling
  private handleError(error: any) {
    console.error('API error:', error);
    let errorMessage = 'An unknown error occurred';
    if (error.error?.detail) {
      errorMessage = error.error.detail;
    } else if (error.message) {
      errorMessage = error.message;
    }
    return throwError(() => new Error(errorMessage));
  }

  // Transform backend response to match frontend expectations
  private transformResponse(response: BackendResponse): PaginatedAnalysisResponse {
    // Map the response fields to match the frontend PaginatedAnalysisResponse format
    return {
      items: response.items.map(item => {
        // Ensure MongoDB _id is also available as id for frontend compatibility
        if (item._id && !item.id) {
          item.id = item._id;
        }
        return item as Analysis;
      }),
      metadata: {
        total_count: response.total,
        page_size: response.limit,
        current_page: response.page,
        total_pages: response.pages,
        has_next: response.page < response.pages,
        has_previous: response.page > 1
      }
    };
  }

  // Get all analyses with filters and pagination
  getAnalyses(params?: any): Observable<PaginatedAnalysisResponse> {
    let httpParams = new HttpParams();
    
    if (params) {
      if (params.patientId) httpParams = httpParams.set('patient_id', params.patientId);
      if (params.page) httpParams = httpParams.set('skip', ((params.page - 1) * (params.limit || 10)).toString());
      if (params.limit) httpParams = httpParams.set('limit', params.limit);
      if (params.status) httpParams = httpParams.set('status', params.status);
      if (params.search) httpParams = httpParams.set('search', params.search);
      if (params.startDate) httpParams = httpParams.set('start_date', params.startDate);
      if (params.endDate) httpParams = httpParams.set('end_date', params.endDate);
      if (params.modelUsed) httpParams = httpParams.set('model_used', params.modelUsed);
      if (params.sortBy) httpParams = httpParams.set('sort_by', params.sortBy);
      if (params.sortOrder) httpParams = httpParams.set('sort_order', params.sortOrder.toString());
    }
    
    return this.http.get<BackendResponse>(`${this.apiUrl}`, {
      ...this.getHttpOptions(),
      params: httpParams
    }).pipe(
      map(this.transformResponse),
      catchError(this.handleError)
    );
  }

  // Get analysis by ID
  getAnalysisById(id: string): Observable<Analysis> {
    return this.http.get<any>(`${this.apiUrl}/${id}`, this.getHttpOptions())
      .pipe(
        map(analysis => {
          // Ensure MongoDB _id is also available as id for frontend compatibility
          if (analysis._id && !analysis.id) {
            analysis.id = analysis._id;
          }
          return analysis as Analysis;
        }),
        catchError(this.handleError)
      );
  }

  // Upload EEG file and create analysis
  uploadAnalysis(patientId: string, file: File, modelId: string = 'default'): Observable<HttpEvent<Analysis>> {
    const formData = new FormData();
    formData.append('file', file);
    
    // Use query parameters as the backend expects
    let httpParams = new HttpParams()
      .set('patient_id', patientId)
      .set('model_id', modelId);
    
    // The backend API is using the root endpoint with POST method for file uploads
    return this.http.post<any>(`${this.apiUrl}`, formData, {
      ...this.getFileUploadHttpOptions(),
      params: httpParams,
      reportProgress: true,
      observe: 'events'
    }).pipe(
      catchError(this.handleError)
    );
  }

  // Update analysis notes
  updateAnalysisNotes(id: string, notes: string): Observable<Analysis> {
    return this.http.put<any>(`${this.apiUrl}/${id}/notes`, { notes }, this.getHttpOptions())
      .pipe(
        map(analysis => {
          // Ensure MongoDB _id is also available as id for frontend compatibility
          if (analysis._id && !analysis.id) {
            analysis.id = analysis._id;
          }
          return analysis as Analysis;
        }),
        catchError(this.handleError)
      );
  }

  // Get available models
  getModels(): Observable<Model[]> {
    return this.http.get<Model[]>(`${this.apiUrl}/models?active_only=true`, this.getHttpOptions())
      .pipe(
        catchError(this.handleError)
      );
  }

  // Set active analysis (for sharing between components)
  setActiveAnalysis(analysis: Analysis | null) {
    this._activeAnalysis.next(analysis);
  }

  // Helper to format file size
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Update patient's analysis status after creating or completing an analysis
  updatePatientAnalysisStatus(patientId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/patients/${patientId}/update-analysis-status`, {}, this.getHttpOptions())
      .pipe(
        catchError(this.handleError)
      );
  }

  // Fetch EEG data for visualization
  getEEGData(analysisId: string): Observable<number[][]> {
    // Use a dedicated endpoint that serves the EEG data file
    const endpoint = `${this.apiUrl}/${analysisId}/eeg-data`;
    
    return this.http.get(endpoint, {
      ...this.getHttpOptions(),
      responseType: 'text'
    }).pipe(
      map(data => this.parseEEGData(data)),
      catchError(error => {
        console.error('Error fetching EEG data:', error);
        return of([[], []]);
      })
    );
  }
  
  // Parse EEG data from text file (Bern-Barcelona format)
  private parseEEGData(data: string): number[][] {
    // Initialize two channels for X and Y signals
    const channels: number[][] = [[], []];
    
    try {
      // Split the text by new lines
      const lines = data.trim().split('\n');
      
      // Process each line
      for (const line of lines) {
        // Skip empty lines or comments
        if (!line.trim() || line.startsWith('#')) continue;
        
        // Split the line by comma and parse - Bern-Barcelona format has exactly 2 channels
        const values = line.trim().split(',').map(v => parseFloat(v.trim()));
        
        // First value is X signal, second is Y signal
        if (values.length >= 1) channels[0].push(values[0]);
        if (values.length >= 2) channels[1].push(values[1]);
      }
    } catch (error) {
      console.error('Error parsing EEG data:', error);
    }
    
    return channels;
  }

  /**
   * Get classification label based on context
   * @param result Analysis result object
   * @param context 'general' for Normal/Abnormal or 'specific' for model-specific labels
   * @returns Classification label
   */
  getClassificationLabel(result: any, context: 'general' | 'specific' = 'general'): string {
    if (!result) return 'Unknown';
    
    // Only return model-specific labels for CNN-BERN
    if (context === 'specific') {
      const modelId = result.modelId || '';
      
      // Return model-specific classification only for CNN-BERN
      if (modelId.toUpperCase().includes('CNN-BERN')) {
        // For CNN-BERN model, class mapping:
        // Class 0 is Focal (abnormal)
        // Class 1 is Non-Focal (normal)
        return result.class === 0 ? 'Focal' : 'Non-Focal';
      } else {
        // For other models, return the general health status
        return result.class === 0 ? 'Abnormal' : 'Normal';
      }
    } else {
      // Return general health status for general context
      return result.class === 0 ? 'Abnormal' : 'Normal';
    }
  }
  
  /**
   * Get CSS class for styling based on classification result
   * @param result Analysis result object
   * @returns CSS class name
   */
  getClassificationClass(result: any): string {
    if (!result) return '';
    
    // Class 0 is always abnormal, Class 1 is always normal
    return result.class === 0 ? 'abnormal' : 'normal';
  }
  
  /**
   * Get status class for analysis status
   * @param analysis Analysis object
   * @returns CSS class name for status
   */
  getAnalysisStatusClass(analysis: Analysis): string {
    if (!analysis.status || analysis.status === 'queued' || analysis.status === 'processing') {
      return 'pending';
    }
    
    if (analysis.status === 'failed') {
      return 'failed';
    }
    
    if (analysis.result?.class === 0) {
      return 'abnormal';
    }
    
    return 'normal';
  }
} 