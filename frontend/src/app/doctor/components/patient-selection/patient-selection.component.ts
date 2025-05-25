import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { PatientService, Patient } from '../../../shared/services/patient.service';

@Component({
  selector: 'app-patient-selection',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './patient-selection.component.html',
  styleUrl: './patient-selection.component.css'
})
export class PatientSelectionComponent implements OnInit {
  @Output() patientSelected = new EventEmitter<string>();
  
  // List of patients from API
  patients: Patient[] = [];
  
  // Filtered patients based on search
  filteredPatients: Patient[] = [];
  
  // Selected patient
  selectedPatient: Patient | null = null;
  
  // Search query
  searchQuery: string = '';
  
  // Loading state
  isLoading: boolean = true;
  
  // Error message
  errorMessage: string = '';
  
  constructor(private patientService: PatientService) {}
  
  ngOnInit(): void {
    this.loadPatients();
  }
  
  // Load patients from API
  loadPatients(): void {
    this.isLoading = true;
    this.errorMessage = '';
    
    // Get patients from API
    this.patientService.getPatients({
      limit: 50,  // Get a reasonably large number of patients
      page: 1
    }).subscribe({
      next: (response) => {
        this.patients = response.items;
        this.filteredPatients = [...this.patients];
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading patients:', error);
        this.errorMessage = 'Failed to load patients. Please try again.';
        this.isLoading = false;
        
        // Only use mock data in development if API fails
        if (true) { // Can be replaced with an environment check if needed
          this.createMockData(); 
          this.errorMessage = 'Using mock data (API not available)';
        }
      }
    });
  }
  
  // Filter patients based on search query
  filterPatients(): void {
    if (!this.searchQuery.trim()) {
      this.filteredPatients = [...this.patients];
      return;
    }
    
    const query = this.searchQuery.toLowerCase().trim();
    this.filteredPatients = this.patients.filter(patient => 
      patient.firstName?.toLowerCase().includes(query) || 
      patient.lastName?.toLowerCase().includes(query) || 
      patient.patientId?.toLowerCase().includes(query)
    );
  }
  
  // Select a patient
  selectPatient(patient: Patient): void {
    this.selectedPatient = patient;
  }
  
  // Confirm selection and emit event
  confirmSelection(): void {
    if (this.selectedPatient) {
      this.patientSelected.emit(this.selectedPatient.id);
    }
  }
  
  // Create mock data for development/demo
  createMockData(): void {
    this.patients = [
      {
        id: '1',
        patientId: 'P001',
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1985-06-15',
        gender: 'Male',
        analysisStatus: {
          hasAnalysis: true,
          lastAnalysisDate: '2023-05-20',
          totalAnalysisCount: 3,
          abnormalResultCount: 2,
          normalResultCount: 1,
          pendingAnalysisCount: 0
        }
      },
      {
        id: '2',
        patientId: 'P002',
        firstName: 'Jane',
        lastName: 'Smith',
        dateOfBirth: '1990-03-20',
        gender: 'Female',
        analysisStatus: {
          hasAnalysis: true,
          lastAnalysisDate: '2023-06-10',
          totalAnalysisCount: 2,
          abnormalResultCount: 0,
          normalResultCount: 2,
          pendingAnalysisCount: 0
        }
      },
      {
        id: '3',
        patientId: 'P003',
        firstName: 'Robert',
        lastName: 'Johnson',
        dateOfBirth: '1978-09-05',
        gender: 'Male',
        analysisStatus: {
          hasAnalysis: false,
          totalAnalysisCount: 0,
          abnormalResultCount: 0,
          normalResultCount: 0,
          pendingAnalysisCount: 0
        }
      }
    ];
    
    this.filteredPatients = [...this.patients];
  }
  
  // Get full name helper
  getPatientFullName(patient: Patient): string {
    return `${patient.firstName || ''} ${patient.lastName || ''}`.trim();
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
  
  // Get last analysis date safely
  getLastAnalysisDate(patient: Patient): string {
    if (patient.analysisStatus?.lastAnalysisDate) {
      return this.formatDate(patient.analysisStatus.lastAnalysisDate);
    }
    return 'N/A';
  }
}
