import { Component, OnInit, Output, EventEmitter, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { PatientService, Patient } from '../../../shared/services/patient.service';

@Component({
  selector: 'app-patient-create',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    HttpClientModule
  ],
  templateUrl: './patient-create.component.html',
  styleUrl: './patient-create.component.css'
})
export class PatientCreateComponent implements OnInit {
  // Form group
  patientForm!: FormGroup;
  
  // Loading and error states
  isSubmitting: boolean = false;
  errorMessage: string = '';
  successMessage: string = '';
  
  // Return URL (if provided)
  returnUrl: string = '/doctor/patients';
  
  // Current step for the stepper form
  currentStep: number = 1;
  totalSteps: number = 3;
  
  // Event emitter to close the overlay
  @Output() closeOverlay = new EventEmitter<void>();
  
  // Event emitter for patient creation success
  @Output() patientCreated = new EventEmitter<string>();
  
  // Close overlay when Escape key is pressed
  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: KeyboardEvent) {
    this.close();
  }
  
  constructor(
    private fb: FormBuilder,
    private patientService: PatientService,
    private router: Router,
    private route: ActivatedRoute
  ) {}
  
  ngOnInit(): void {
    // Check if return URL is provided
    this.route.queryParams.subscribe(params => {
      if (params['returnUrl']) {
        this.returnUrl = params['returnUrl'];
      }
    });
    
    // Initialize the form
    this.initializeForm();
  }
  
  // Initialize form with validation
  initializeForm(): void {
    this.patientForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      dateOfBirth: ['', [Validators.required]],
      gender: ['', [Validators.required]],
      contactInfo: this.fb.group({
        phone: [''],
        email: ['', [Validators.email]],
        address: ['']
      }),
      medicalHistory: [''],
      medications: this.fb.array([]),
      notes: ['']
    });
  }
  
  // Helper getter for medications form array
  get medications(): FormArray {
    return this.patientForm.get('medications') as FormArray;
  }
  
  // Add a new medication entry
  addMedication(): void {
    const medicationGroup = this.fb.group({
      name: ['', Validators.required],
      dosage: [''],
      frequency: ['']
    });
    
    this.medications.push(medicationGroup);
  }
  
  // Remove a medication at specified index
  removeMedication(index: number): void {
    this.medications.removeAt(index);
  }
  
  // Go to next step
  nextStep(): void {
    if (this.currentStep < this.totalSteps) {
      // Validate current step before proceeding
      if (this.validateCurrentStep()) {
        this.currentStep++;
      }
    }
  }
  
  // Go to previous step
  prevStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }
  
  // Validate the current step
  validateCurrentStep(): boolean {
    if (this.currentStep === 1) {
      const basicInfoControls = ['firstName', 'lastName', 'dateOfBirth', 'gender'];
      return this.validateFormControls(basicInfoControls);
    } else if (this.currentStep === 2) {
      // Contact info step is optional, so always valid
      return true;
    }
    return true;
  }
  
  // Helper to validate form controls
  validateFormControls(controlNames: string[]): boolean {
    let isValid = true;
    
    controlNames.forEach(controlName => {
      const control = this.patientForm.get(controlName);
      if (control && control.invalid) {
        control.markAsTouched();
        isValid = false;
      }
    });
    
    return isValid;
  }
  
  // Close the overlay
  close(): void {
    this.closeOverlay.emit();
  }
  
  // Submit form
  onSubmit(): void {
    if (this.patientForm.invalid) {
      // Mark all fields as touched to show validation errors
      this.markFormGroupTouched(this.patientForm);
      return;
    }
    
    this.isSubmitting = true;
    this.errorMessage = '';
    this.successMessage = '';
    
    // Prepare patient data
    const patientData: Patient = {
      ...this.patientForm.value,
      // Set default analysis status values
      analysisStatus: {
        hasAnalysis: false,
        totalAnalysisCount: 0,
        abnormalResultCount: 0,
        normalResultCount: 0,
        pendingAnalysisCount: 0
      }
    };
    
    // Call the service to create the patient
    this.patientService.createPatient(patientData).subscribe({
      next: (createdPatient) => {
        console.log('Patient created successfully:', createdPatient);
        this.isSubmitting = false;
        this.successMessage = 'Patient created successfully!';
        
        // Emit the created patient ID
        this.patientCreated.emit(createdPatient.id);
        
        // Show success message for longer before closing
        setTimeout(() => {
          this.close();
        }, 3000);
      },
      error: (error) => {
        console.error('Error creating patient:', error);
        this.isSubmitting = false;
        this.errorMessage = 'Failed to create patient. ' + 
          (error.error?.message || 'Please try again.');
        
        // For development/testing purposes only - comment out in production
        // this.simulateSuccess();
      }
    });
  }
  
  // Helper to mark all form controls as touched
  markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }
  
  // Cancel form and go back
  cancelForm(): void {
    this.close();
  }
  
  // For development demo - simulate successful patient creation
  simulateSuccess(): void {
    const mockPatient: Patient = {
      ...this.patientForm.value,
      id: 'new-' + Date.now(),
      createdAt: new Date().toISOString()
    };
    
    this.isSubmitting = false;
    this.successMessage = 'Patient created successfully! (Demo mode)';
    
    // Emit the created patient ID
    this.patientCreated.emit(mockPatient.id);
    
    // Show success message briefly then close
    setTimeout(() => {
      this.close();
    }, 1500);
  }
  
  // Get step label based on current step
  getStepLabel(step: number): string {
    switch (step) {
      case 1: return 'Basic Information';
      case 2: return 'Contact Details';
      case 3: return 'Medical Information';
      default: return '';
    }
  }
}
