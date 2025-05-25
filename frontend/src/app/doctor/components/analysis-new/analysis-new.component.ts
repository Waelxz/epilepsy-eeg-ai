import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { PatientSelectionComponent } from '../patient-selection/patient-selection.component';
import { FileUploadComponent } from '../file-upload/file-upload.component';
import { AnalysisSummaryComponent } from '../analysis-summary/analysis-summary.component';
import { PatientCreateComponent } from '../patient-create/patient-create.component';

@Component({
  selector: 'app-analysis-new',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    PatientSelectionComponent,
    FileUploadComponent,
    AnalysisSummaryComponent,
    PatientCreateComponent
  ],
  templateUrl: './analysis-new.component.html',
  styleUrl: './analysis-new.component.css'
})
export class AnalysisNewComponent implements OnInit {
  // Inputs for overlay mode
  @Input() overlayMode: boolean = false;
  @Input() patientIdParam: string | null = null;
  
  // Output for analysis creation (for overlay mode)
  @Output() analysisCreated = new EventEmitter<string>();
  
  // Current step in the workflow
  currentStep: number = 1;
  
  // Sub-step for patient selection
  patientSelectionSubStep: 'choice' | 'select' | 'create' = 'choice';
  
  // Total number of steps
  totalSteps: number = 3;
  
  // Whether to skip the patient selection step
  skipPatientSelection: boolean = false;
  
  // Selected patient ID (if provided via route)
  patientId: string | null = null;
  
  // Selected file for upload
  selectedFile: File | null = null;
  
  // Analysis data for summary step
  analysisData: any = null;
  
  // Show create patient modal
  showCreatePatientModal: boolean = false;
  
  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {}
  
  ngOnInit(): void {
    // Check if patientId is provided as input (overlay mode)
    if (this.overlayMode && this.patientIdParam) {
      this.patientId = this.patientIdParam;
      this.skipPatientSelection = true;
      this.currentStep = 2; // Skip to file upload step
    } 
    // Otherwise check route params (standalone mode)
    else {
      this.route.queryParams.subscribe(params => {
        if (params['patientId']) {
          this.patientId = params['patientId'];
          this.skipPatientSelection = true;
          this.currentStep = 2; // Skip to file upload step
        }
      });
    }
  }
  
  // Handle selection of patient selection mode
  selectPatientMode(mode: 'select' | 'create'): void {
    this.patientSelectionSubStep = mode;
    
    if (mode === 'create') {
      // Show the patient creation modal
      this.showCreatePatientModal = true;
    }
  }
  
  // Handle patient selection
  onPatientSelected(patientId: string): void {
    if (!patientId) {
      console.error('Invalid patient ID received');
      return;
    }
    
    this.patientId = patientId;
    console.log('Patient selected:', patientId);
    this.nextStep();
  }
  
  // Reset to patient choice screen
  backToPatientChoice(): void {
    this.patientSelectionSubStep = 'choice';
  }
  
  // Handle file selection
  onFileSelected(file: File): void {
    if (!file) {
      console.error('Invalid file received');
      return;
    }
    
    this.selectedFile = file;
    console.log('File selected:', file.name);
    this.nextStep();
  }
  
  // Handle pending analysis creation
  onPendingAnalysisCreated(data: any): void {
    if (!data) {
      console.error('Invalid analysis data received');
      return;
    }
    
    console.log('Pending analysis created:', data);
    
    // Set analysis data
    this.analysisData = data;
    
    // Emit event if in overlay mode
    if (this.overlayMode) {
      this.analysisCreated.emit(data.id || data._id);
    } else {
      // Navigate to patient details
      this.router.navigate(['/doctor/patients', this.patientId]);
    }
  }
  
  // Handle analysis completion
  onAnalysisComplete(data: any): void {
    if (!data) {
      console.error('Invalid analysis data received');
      return;
    }
    
    // If we already have analysis data, this is a navigation request from the "View Details" button
    if (this.analysisData) {
      this.finishAnalysis();
      return;
    }
    
    // Otherwise, this is the initial analysis completion
    this.analysisData = data;
    console.log('Analysis completed:', data);
    
    // Stay on the summary step to show the results
    // The "View Detailed Analysis" button in the summary will call this method again
  }
  
  // New method for completing the analysis workflow after viewing the summary
  finishAnalysis(): void {
    if (this.analysisData) {
      // Emit event if in overlay mode
      if (this.overlayMode) {
        this.analysisCreated.emit(this.analysisData.id);
      } else {
        // Navigate to analysis details after completion (standalone mode)
        this.router.navigate(['/doctor/analysis', this.analysisData.id]);
      }
    }
  }
  
  // Move to next step
  nextStep(): void {
    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
    }
  }
  
  // Move to previous step
  prevStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
      
      // Reset sub-step when going back to step 1
      if (this.currentStep === 1) {
        this.patientSelectionSubStep = 'choice';
      }
    }
    
    // If we're going back to step 1 but have skipPatientSelection enabled,
    // we need to handle this special case
    if (this.currentStep === 1 && this.skipPatientSelection) {
      // Option 1: Don't allow going back past file upload when patient is already selected
      this.currentStep = 2;
      
      // Option 2: Allow changing patient (uncomment if needed)
      // this.skipPatientSelection = false;
    }
  }
  
  // Cancel the workflow and go back
  cancelAnalysis(): void {
    // If in overlay mode, don't navigate - the parent will handle closing
    if (this.overlayMode) {
      return;
    }
    
    // If patientId is available, go back to that patient's details
    if (this.patientId) {
      this.router.navigate(['/doctor/patients', this.patientId]);
    } else {
      // Otherwise go to patient list
      this.router.navigate(['/doctor/patients']);
    }
  }
  
  // Get label for current step
  getCurrentStepLabel(): string {
    if (this.skipPatientSelection) {
      // If skipping patient selection, adjust labels
      switch (this.currentStep) {
        case 2: return 'Upload EEG File';
        case 3: return 'Analysis Summary';
        default: return 'Upload EEG File';
      }
    } else {
      switch (this.currentStep) {
        case 1: 
          if (this.patientSelectionSubStep === 'choice') return 'Patient Selection';
          if (this.patientSelectionSubStep === 'select') return 'Select Existing Patient';
          if (this.patientSelectionSubStep === 'create') return 'Create New Patient';
          return 'Patient Selection';
        case 2: return 'Upload EEG File';
        case 3: return 'Analysis Summary';
        default: return 'Patient Selection';
      }
    }
  }
  
  // Get effective step number for display (accounting for skipped steps)
  getEffectiveStepNumber(step: number): number {
    if (this.skipPatientSelection && step > 1) {
      return step - 1;
    }
    return step;
  }
  
  // Get total effective steps (accounting for skipped steps)
  getEffectiveStepCount(): number {
    return this.skipPatientSelection ? this.totalSteps - 1 : this.totalSteps;
  }
  
  // Close the create patient modal
  closeCreatePatientModal(): void {
    this.showCreatePatientModal = false;
    this.patientSelectionSubStep = 'choice';
  }
  
  // Handle newly created patient
  onPatientCreated(patientId: string): void {
    console.log('Patient created with ID:', patientId);
    
    // Update the patientId in our component
    this.patientId = patientId;
    
    // Close the modal first
    this.showCreatePatientModal = false;
    
    // Move to the next step
    this.currentStep = 2; // Skip to file upload step
  }
}
