import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClientModule, HttpEventType } from '@angular/common/http';
import { AnalysisService } from '../../../shared/services/analysis.service';
import { PatientService, Patient } from '../../../shared/services/patient.service';

@Component({
  selector: 'app-analysis-summary',
  standalone: true,
  imports: [CommonModule, RouterModule, HttpClientModule],
  templateUrl: './analysis-summary.component.html',
  styleUrl: './analysis-summary.component.css'
})
export class AnalysisSummaryComponent implements OnInit {
  @Input() patientId: string | null = null;
  @Input() file: File | null = null;
  @Output() analysisComplete = new EventEmitter<any>();
  
  // Analysis states
  isAnalyzing: boolean = false;
  isComplete: boolean = false;
  hasFailed: boolean = false;
  
  // Analysis result
  analysisResult: any = null;
  
  // Patient info
  patient: Patient | null = null;
  
  // Error message
  errorMessage: string = '';
  
  // Progress tracking
  progressValue: number = 0;
  
  constructor(
    private analysisService: AnalysisService,
    private patientService: PatientService
  ) {}
  
  ngOnInit(): void {
    // Load patient details if patientId is available
    if (this.patientId) {
      this.loadPatient();
    } else {
      this.createMockPatient(); // For demo only if no patientId
    }
    
    // Start analysis automatically
    this.startAnalysis();
  }
  
  loadPatient(): void {
    // For development/demo - use mock data immediately
    this.createMockPatient();
    return;
    
    this.patientService.getPatientById(this.patientId || '').subscribe({
      next: (patient) => {
        this.patient = patient;
      },
      error: (error) => {
        console.error('Error loading patient:', error);
        this.createMockPatient(); // Create mock data if API fails
      }
    });
  }
  
  // Create mock patient data for development
  createMockPatient(): void {
    this.patient = {
      id: this.patientId || '1',
      patientId: 'P' + (this.patientId || '001'),
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: '1985-06-15',
      gender: 'Male',
      contactInfo: {
        phone: '123-456-7890',
        email: 'john.doe@example.com',
        address: '123 Main St, Cityville, State 12345'
      },
      medicalHistory: 'Patient first experienced seizures at age 25 following a mild concussion.',
      analysisStatus: {
        hasAnalysis: true,
        lastAnalysisDate: '2023-05-20',
        totalAnalysisCount: 3,
        abnormalResultCount: 2,
        normalResultCount: 1,
        pendingAnalysisCount: 0
      }
    };
  }
  
  startAnalysis(): void {
    if (!this.file || !this.patientId) {
      this.errorMessage = 'Missing file or patient information. Please go back and try again.';
      return;
    }
    
    this.isAnalyzing = true;
    this.hasFailed = false;
    this.errorMessage = '';
    this.progressValue = 0;
    
    // Use the real analysis service to upload and analyze
    this.analysisService.uploadAnalysis(this.patientId, this.file, 'CNN-BERN')
      .subscribe({
        next: (event: any) => {
          // Check for upload progress events
          if (event.type === HttpEventType.UploadProgress) {
            if (event.total) {
              // Calculate progress percentage
              this.progressValue = Math.round((event.loaded / event.total) * 50); // First 50% is upload
            }
          } 
          // Check for response event
          else if (event.type === HttpEventType.Response) {
            // Upload complete, now update progressValue to indicate processing
            this.progressValue = 75; // Show 75% when upload is done
            
            // Get the analysis ID from the response
            if (event.body && event.body._id) {
              const analysisId = event.body._id;
              
              // Set result from initial response
              this.analysisResult = event.body;
              
              // Poll for analysis completion
              this.pollAnalysisStatus(analysisId);
            } else {
              console.error('Invalid response format:', event);
              this.handleAnalysisError('Received invalid response from server');
            }
          }
        },
        error: (error) => {
          this.handleAnalysisError('Failed to upload and process the EEG file', error);
        }
      });
  }
  
  // Poll for analysis completion
  pollAnalysisStatus(analysisId: string): void {
    // Set up polling interval (check every 2 seconds)
    const pollInterval = setInterval(() => {
      this.analysisService.getAnalysisById(analysisId).subscribe({
        next: (analysis) => {
          // Update result with latest data
          this.analysisResult = analysis;
          
          // Check if analysis is complete or failed
          if (analysis.status === 'completed') {
            // Analysis successful
            clearInterval(pollInterval);
            this.progressValue = 100;
            this.isAnalyzing = false;
            this.isComplete = true;
          this.analysisComplete.emit(this.analysisResult);
          } 
          else if (analysis.status === 'failed') {
            // Analysis failed
            clearInterval(pollInterval);
            this.handleAnalysisError('The analysis process failed: ' + ((analysis as any).error || 'Unknown error'));
          }
          else if (analysis.status === 'processing') {
            // Still processing - update progress to at least 80%
            this.progressValue = Math.max(this.progressValue, 80);
          }
        },
        error: (error) => {
          clearInterval(pollInterval);
          this.handleAnalysisError('Failed to retrieve analysis status', error);
        }
      });
    }, 2000);
    
    // Set a timeout to stop polling after 5 minutes (to prevent infinite polling)
    setTimeout(() => {
      clearInterval(pollInterval);
      if (this.isAnalyzing) {
        this.handleAnalysisError('Analysis timed out. Please try again later.');
      }
    }, 5 * 60 * 1000);
  }
  
  // Helper method to handle analysis errors
  handleAnalysisError(message: string, error?: any): void {
    this.isAnalyzing = false;
    this.hasFailed = true;
    this.errorMessage = message;
    if (error) {
      console.error('Analysis error:', error);
    }
  }
  
  // Retry analysis if it failed
  retryAnalysis(): void {
    this.startAnalysis();
  }
  
  // View analysis details
  viewDetails(): void {
    if (this.analysisResult && this.analysisResult.id) {
      // Re-emit the complete event for the parent to handle navigation
      this.analysisComplete.emit(this.analysisResult);
    }
  }
  
  // Format date helper
  formatDate(date: Date | string): string {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
  
  // Get full name helper
  getPatientFullName(): string {
    if (!this.patient) return '';
    return `${this.patient.firstName || ''} ${this.patient.lastName || ''}`.trim();
  }
  
  // Get classification CSS class
  getClassificationClass(result: any): string {
    return this.analysisService.getClassificationClass(result);
  }
  
  // Get general status label
  getStatusLabel(result: any): string {
    return this.analysisService.getClassificationLabel(result);
  }
  
  // Get technical/specific classification label
  getTechnicalClassification(result: any): string {
    // Add model information from the analysis result
    if (this.analysisResult && this.analysisResult.modelUsed) {
      const resultWithModel = {
        ...result,
        modelId: this.analysisResult.modelUsed
      };
      return this.analysisService.getClassificationLabel(resultWithModel, 'specific');
    }
    return this.analysisService.getClassificationLabel(result, 'specific');
  }
}
