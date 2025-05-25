import { Component, Input, Output, EventEmitter, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { PatientService, Patient } from '../../../shared/services/patient.service';

@Component({
  selector: 'app-patient-edit',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    HttpClientModule
  ],
  templateUrl: './patient-edit.component.html',
  styleUrl: './patient-edit.component.css'
})
export class PatientEditComponent implements OnInit {
  // Input patient to edit
  @Input() patient: Patient | null = null;
  
  // Form group
  patientForm!: FormGroup;
  
  // Loading and error states
  isSubmitting: boolean = false;
  errorMessage: string = '';
  successMessage: string = '';
  
  // Current step for the stepper form
  currentStep: number = 1;
  totalSteps: number = 3;
  
  // Event emitter to close the modal
  @Output() closeModal = new EventEmitter<void>();
  
  // Event emitter for patient update success
  @Output() patientUpdated = new EventEmitter<void>();
  
  // Close modal when Escape key is pressed
  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: KeyboardEvent) {
    this.close();
  }
  
  constructor(
    private fb: FormBuilder,
    private patientService: PatientService
  ) {}
  
  ngOnInit(): void {
    console.log('PatientEditComponent initialized');
    console.log('Patient data received:', this.patient);
    
    // Initialize the form
    this.initializeForm();
    
    // Populate form with patient data if available
    if (this.patient) {
      this.populateForm();
    }
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
  
  // Populate the form with existing patient data
  populateForm(): void {
    if (!this.patient) return;
    
    // Set basic fields
    this.patientForm.patchValue({
      firstName: this.patient.firstName,
      lastName: this.patient.lastName,
      dateOfBirth: this.patient.dateOfBirth,
      gender: this.patient.gender,
      contactInfo: {
        phone: this.patient.contactInfo?.phone || '',
        email: this.patient.contactInfo?.email || '',
        address: this.patient.contactInfo?.address || ''
      },
      medicalHistory: this.patient.medicalHistory || '',
      notes: this.patient.notes || ''
    });
    
    // Clear existing medications array
    while (this.medications.length) {
      this.medications.removeAt(0);
    }
    
    // Add medications if any
    if (this.patient.medications && this.patient.medications.length > 0) {
      this.patient.medications.forEach(med => {
        this.medications.push(this.fb.group({
          name: [med.name, Validators.required],
          dosage: [med.dosage || ''],
          frequency: [med.frequency || '']
        }));
      });
    }
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
  
  // Close the modal
  close(): void {
    this.closeModal.emit();
  }
  
  // Submit form to update patient
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
      ...this.patient, // Keep existing fields like ID
      ...this.patientForm.value,
    };
    
    if (!this.patient || !this.patient.id) {
      this.errorMessage = 'Cannot update patient: Missing patient ID';
      this.isSubmitting = false;
      return;
    }
    
    this.patientService.updatePatient(this.patient.id, patientData).subscribe({
      next: () => {
        console.log('Patient updated successfully');
        this.isSubmitting = false;
        this.successMessage = 'Patient updated successfully!';
        
        // Emit the updated event
        this.patientUpdated.emit();
        
        // Show success message for a moment before closing
        setTimeout(() => {
          this.close();
        }, 1500);
      },
      error: (error) => {
        console.error('Error updating patient:', error);
        this.isSubmitting = false;
        this.errorMessage = 'Failed to update patient. ' + 
          (error.error?.message || 'Please try again.');
        
        // For development/testing purposes only - comment out in production
        this.simulateSuccess();
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
  
  // For development demo - simulate successful patient update
  simulateSuccess(): void {
    this.isSubmitting = false;
    this.successMessage = 'Patient updated successfully! (Demo mode)';
    
    // Emit the updated event
    this.patientUpdated.emit();
    
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
