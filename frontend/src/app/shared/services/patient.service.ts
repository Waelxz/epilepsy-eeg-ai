import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, catchError, throwError, map } from 'rxjs';
import { AuthService } from '../../auth/auth.service';

export interface Patient {
  _id?: string;  // MongoDB ID
  id?: string;   // For compatibility
  patientId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date | string;
  gender: 'Male' | 'Female' | 'Other';
  contactInfo?: {
    phone?: string;
    email?: string;
    address?: string;
  };
  medicalHistory?: string;
  medications?: Array<{
    name: string;
    dosage: string;
    frequency: string;
  }>;
  notes?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  isActive?: boolean;
  analysisStatus?: {
    hasAnalysis: boolean;
    lastAnalysisDate?: Date | string;
    totalAnalysisCount: number;
    lastResult?: {
      class: number;
      probability: number;
      modelId: string;
    };
    abnormalResultCount: number;
    normalResultCount: number;
    pendingAnalysisCount: number;
  };
}

export interface BackendResponse {
  items: any[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}

export interface PaginatedPatientResponse {
  items: Patient[];
  metadata: {
    total_count: number;
    page_size: number;
    current_page: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
  };
}

@Injectable({
  providedIn: 'root'
})
export class PatientService {
  private apiUrl = 'http://localhost:8000/api/patients';

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
    let errorMessage = 'An unknown error occurred';
    if (error.error?.detail) {
      errorMessage = error.error.detail;
    } else if (error.message) {
      errorMessage = error.message;
    }
    return throwError(() => new Error(errorMessage));
  }

  // Transform backend response to match frontend expectations
  private transformResponse(response: BackendResponse): PaginatedPatientResponse {
    // Map the response fields to match the frontend PaginatedPatientResponse format
    return {
      items: response.items.map(item => this.transformPatientData(item)),
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

  // Helper method to transform a single patient
  private transformPatientData(item: any): Patient {
    // Add debug log to see what the backend is returning
    console.log('Backend patient data:', JSON.stringify(item, null, 2));
    
    // Ensure MongoDB _id is also available as id for frontend compatibility
    if (item._id && !item.id) {
      item.id = item._id;
    }
    
    // Add analysis status if not present
    const transformedPatient: Patient = {...item} as Patient;
    
    // If analysisStatus is already present but has different property names, map them
    if (transformedPatient.analysisStatus) {
      // Check for snake_case property names and map to camelCase
      const status = transformedPatient.analysisStatus as any;
      if ('has_analysis' in status && !('hasAnalysis' in status)) {
        status.hasAnalysis = status.has_analysis;
      }
      if ('analysis_count' in status && !('totalAnalysisCount' in status)) {
        status.totalAnalysisCount = status.analysis_count;
      }
      if ('abnormal_count' in status && !('abnormalResultCount' in status)) {
        status.abnormalResultCount = status.abnormal_count;
      }
      if ('normal_count' in status && !('normalResultCount' in status)) {
        status.normalResultCount = status.normal_count;
      }
      if ('pending_count' in status && !('pendingAnalysisCount' in status)) {
        status.pendingAnalysisCount = status.pending_count;
      }
      if ('last_analysis_date' in status && !('lastAnalysisDate' in status)) {
        status.lastAnalysisDate = status.last_analysis_date;
      }
      if ('last_result' in status && !('lastResult' in status)) {
        status.lastResult = status.last_result;
      }
    }
    
    // Check if we have analysis data in any form
    // Try multiple possible backend response formats
    
    // Option 1: The backend might include analysis_count, analyses_data, or other fields 
    // directly on the patient object
    if (!transformedPatient.analysisStatus) {
      const hasAnalysis = item.analysis_count > 0 || 
                         (item.analyses && item.analyses.length > 0) ||
                         item.has_analysis === true;
      
      // Create the analysis status object based on whatever data is available
      transformedPatient.analysisStatus = {
        hasAnalysis: hasAnalysis || false,
        totalAnalysisCount: item.analysis_count || (item.analyses ? item.analyses.length : 0) || 0,
        abnormalResultCount: item.abnormal_count || 0,
        normalResultCount: item.normal_count || 0,
        pendingAnalysisCount: item.pending_count || 0
      };
      
      // If there's a last analysis result, use it
      if (item.last_analysis) {
        transformedPatient.analysisStatus.lastAnalysisDate = item.last_analysis.date || item.last_analysis.uploadDate;
        transformedPatient.analysisStatus.lastResult = {
          class: item.last_analysis.result?.class ?? 0,
          probability: item.last_analysis.result?.probability ?? 0,
          modelId: item.last_analysis.modelUsed || 'unknown'
        };
      }
      
      // If we have analyses array, extract data from it
      if (item.analyses && Array.isArray(item.analyses) && item.analyses.length > 0) {
        const completedAnalyses = item.analyses.filter((a: any) => a.status === 'completed');
        const pendingAnalyses = item.analyses.filter((a: any) => 
          a.status === 'processing' || a.status === 'queued');
        // CNN-BERN classification: class 0 is Focal (abnormal), class 1 is Non-Focal (normal)
        const abnormalResults = completedAnalyses.filter((a: any) => a.result?.class === 0);
        const normalResults = completedAnalyses.filter((a: any) => a.result?.class === 1);
        
        // Update counts from actual analyses data if available
        transformedPatient.analysisStatus.abnormalResultCount = abnormalResults.length;
        transformedPatient.analysisStatus.normalResultCount = normalResults.length;
        transformedPatient.analysisStatus.pendingAnalysisCount = pendingAnalyses.length;
        
        // Get the latest analysis
        if (completedAnalyses.length > 0) {
          const lastAnalysis = completedAnalyses.sort((a: any, b: any) => 
            new Date(b.uploadDate || b.date || 0).getTime() - 
            new Date(a.uploadDate || a.date || 0).getTime()
          )[0];
          
          if (lastAnalysis) {
            transformedPatient.analysisStatus.lastAnalysisDate = 
              lastAnalysis.uploadDate || lastAnalysis.date;
            
            if (lastAnalysis.result) {
              transformedPatient.analysisStatus.lastResult = {
                class: lastAnalysis.result.class,
                probability: lastAnalysis.result.probability,
                modelId: lastAnalysis.modelUsed || 'unknown'
              };
            }
          }
        }
      }
    }
    
    console.log('Transformed patient with analysisStatus:', 
      transformedPatient.firstName, 
      transformedPatient.lastName, 
      JSON.stringify(transformedPatient.analysisStatus, null, 2));
    
    return transformedPatient;
  }

  // Get patients with pagination and filters
  getPatients(params?: any): Observable<PaginatedPatientResponse> {
    let httpParams = new HttpParams();
    
    if (params) {
      if (params.page) httpParams = httpParams.set('skip', ((params.page - 1) * (params.limit || 10)).toString());
      if (params.limit) httpParams = httpParams.set('limit', params.limit);
      if (params.search) httpParams = httpParams.set('search', params.search);
      if (params.isActive !== undefined) httpParams = httpParams.set('isActive', params.isActive.toString());
      if (params.sortBy) httpParams = httpParams.set('sort_by', params.sortBy);
      if (params.sortOrder) httpParams = httpParams.set('sort_order', params.sortOrder.toString());
    }
    
    return this.http.get<BackendResponse>(this.apiUrl, {
      ...this.getHttpOptions(),
      params: httpParams
    }).pipe(
      map(this.transformResponse.bind(this)),
      catchError(this.handleError)
    );
  }

  // Get patient by ID
  getPatientById(id: string): Observable<Patient> {
    return this.http.get<any>(`${this.apiUrl}/${id}`, this.getHttpOptions())
      .pipe(
        map(patient => this.transformPatientData(patient)),
        catchError(this.handleError)
      );
  }

  // Create new patient
  createPatient(patientData: Patient): Observable<Patient> {
    return this.http.post<any>(this.apiUrl, patientData, this.getHttpOptions())
      .pipe(
        map(patient => this.transformPatientData(patient)),
        catchError(this.handleError)
      );
  }

  // Update patient
  updatePatient(id: string, patientData: Partial<Patient>): Observable<Patient> {
    return this.http.put<any>(`${this.apiUrl}/${id}`, patientData, this.getHttpOptions())
      .pipe(
        map(patient => this.transformPatientData(patient)),
        catchError(this.handleError)
      );
  }

  // Delete patient
  deletePatient(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`, this.getHttpOptions())
      .pipe(
        catchError(this.handleError)
      );
  }

  // Get patient's full name helper
  getPatientFullName(patient: Patient): string {
    return `${patient.firstName} ${patient.lastName}`;
  }

  // Calculate age from birthdate
  calculateAge(dateOfBirth: Date | string): number {
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDifference = today.getMonth() - birthDate.getMonth();
    
    if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }
} 