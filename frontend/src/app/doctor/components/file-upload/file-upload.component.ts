import { Component, EventEmitter, Input, Output, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PatientService, Patient } from '../../../shared/services/patient.service';
import { AnalysisService } from '../../../shared/services/analysis.service';
import { HttpEventType } from '@angular/common/http';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-file-upload',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './file-upload.component.html',
  styleUrl: './file-upload.component.css'
})
export class FileUploadComponent implements OnInit, OnChanges {
  @Input() patientId: string | null = null;
  @Output() fileSelected = new EventEmitter<File>();
  @Output() pendingAnalysisCreated = new EventEmitter<any>();
  
  // Patient data
  patient: Patient | null = null;
  patientLoading: boolean = false;
  patientError: string = '';
  
  // Uploaded file
  file: File | null = null;
  
  // Drag and drop states
  isDragging: boolean = false;
  
  // Error message
  errorMessage: string = '';
  
  // Loading state
  isSubmitting: boolean = false;
  
  constructor(
    private patientService: PatientService,
    private analysisService: AnalysisService
  ) {}
  
  ngOnInit(): void {
    this.loadPatientIfIdExists();
  }
  
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['patientId'] && changes['patientId'].currentValue) {
      this.loadPatientIfIdExists();
    }
  }
  
  loadPatientIfIdExists(): void {
    if (this.patientId) {
      this.loadPatientData(this.patientId);
    }
  }
  
  loadPatientData(patientId: string): void {
    this.patientLoading = true;
    this.patientError = '';
    
    this.patientService.getPatientById(patientId).subscribe({
      next: (patient) => {
        this.patient = patient;
        this.patientLoading = false;
      },
      error: (error) => {
        console.error('Error loading patient data:', error);
        this.patientError = 'Unable to load patient information';
        this.patientLoading = false;
      }
    });
  }
  
  // Calculate patient age
  calculateAge(dateOfBirth: Date | string): number {
    return this.patientService.calculateAge(dateOfBirth);
  }
  
  // Format date 
  formatDate(date: Date | string): string {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
  
  // Get patient status badge class
  getPatientStatusClass(patient: Patient): any {
    if (!patient.analysisStatus) {
      return 'badge-none';
    }
    
    if (patient.analysisStatus.abnormalResultCount > 0) {
      return 'badge-abnormal';
    }
    
    if (patient.analysisStatus.normalResultCount > 0) {
      return 'badge-normal';
    }
    
    if (patient.analysisStatus.pendingAnalysisCount > 0) {
      return 'badge-pending';
    }
    
    return 'badge-none';
  }
  
  // Get patient status label
  getPatientStatusLabel(patient: Patient): string {
    if (!patient.analysisStatus || !patient.analysisStatus.hasAnalysis) {
      return 'No Analysis';
    }
    
    if (patient.analysisStatus.abnormalResultCount > 0) {
      return 'Abnormal History';
    }
    
    if (patient.analysisStatus.normalResultCount > 0) {
      return 'Normal History';
    }
    
    if (patient.analysisStatus.pendingAnalysisCount > 0) {
      return 'Pending Analysis';
    }
    
    return 'No Analysis';
  }
  
  // File upload methods
  onFileDropped(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = false;
    
    if (event.dataTransfer && event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0];
      this.validateAndSetFile(file);
    }
  }
  
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = true;
  }
  
  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = false;
  }
  
  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.validateAndSetFile(file);
    }
  }
  
  validateAndSetFile(file: File): void {
    // Reset error message
    this.errorMessage = '';
    
    // Check file type (accepting .txt and .edf files)
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.txt') && !fileName.endsWith('.edf')) {
      this.errorMessage = 'Please upload a .txt or .edf file containing EEG data.';
      return;
    }
    
    // Check file size (max 50MB)
    const maxSizeInBytes = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSizeInBytes) {
      this.errorMessage = 'File size exceeds the maximum limit of 50MB.';
      return;
    }
    
    // Set the file
    this.file = file;
  }
  
  // Clear selected file
  clearFile(): void {
    this.file = null;
    this.errorMessage = '';
  }
  
  // Confirm file selection and proceed with analysis
  confirmSelection(): void {
    if (this.file) {
      this.fileSelected.emit(this.file);
    }
  }
  
  // Save the analysis as pending without starting it
  saveAsPending(): void {
    if (!this.file || !this.patientId) {
      this.errorMessage = 'File and patient selection are required';
      return;
    }
    
    this.isSubmitting = true;
    this.errorMessage = '';
    
    // Upload the file but set status as "queued" without processing
    this.analysisService.uploadAnalysis(this.patientId, this.file, 'CNN-BERN')
      .pipe(finalize(() => this.isSubmitting = false))
      .subscribe({
        next: (event) => {
          if (event.type === HttpEventType.Response) {
            // Analysis created successfully
            console.log('Analysis saved as pending:', event.body);
            this.pendingAnalysisCreated.emit(event.body);
          }
        },
        error: (error) => {
          console.error('Error saving analysis:', error);
          this.errorMessage = `Failed to save analysis: ${error.message || 'Unknown error'}`;
        }
      });
  }
  
  // Format file size to human-readable format
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
