import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { PatientService, Patient, PaginatedPatientResponse } from '../../../shared/services/patient.service';
import { PatientCreateComponent } from '../patient-create/patient-create.component';
import { AnalysisOverlayComponent } from '../analysis-overlay/analysis-overlay.component';
import { Router } from '@angular/router';
import { AnalysisService } from '../../../shared/services/analysis.service';

@Component({
  selector: 'app-patient-list',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    RouterModule, 
    PatientCreateComponent,
    AnalysisOverlayComponent
  ],
  templateUrl: './patient-list.component.html',
  styleUrls: ['./patient-list.component.css']
})
export class PatientListComponent implements OnInit {
  allLoadedPatients: Patient[] = []; // All patients loaded from server
  filteredPatients: Patient[] = []; // Patients after filtering but before pagination
  displayedPatients: Patient[] = []; // Patients after filtering and pagination (shown in UI)
  isLoading: boolean = true;
  errorMessage: string = '';
  Math = Math; // Expose Math object for template use
  
  // Search and filter
  searchQuery: string = '';
  statusFilter: 'all' | 'no-analysis' | 'normal-results' | 'abnormal-results' | 'pending-analysis' = 'all';
  
  // Advanced search
  showAdvancedSearch: boolean = false;
  ageRangeMin: number | null = null;
  ageRangeMax: number | null = null;
  selectedGender: string = '';
  selectedDateRange: string = '';
  dateRangeStart: string = '';
  dateRangeEnd: string = '';
  
  // Bulk operations
  selectedPatients: { [id: string]: boolean } = {};
  selectedCount: number = 0;
  allSelected: boolean = false;
  showBulkActions: boolean = false;
  
  // Sorting
  sortOption: string = 'recent';
  
  // Pagination
  currentPage: number = 1;
  pageSize: number = 10;
  totalItems: number = 0;
  totalPages: number = 0;

  // Show create patient modal
  showCreatePatientModal: boolean = false;
  
  // Show analysis overlay
  showAnalysisOverlay: boolean = false;
  selectedPatientId: string | null = null;

  // Date presets for advanced search
  dateRangePresets = [
    { label: 'Any time', value: '' },
    { label: 'Last 30 days', value: '30days' },
    { label: 'Last 90 days', value: '90days' },
    { label: 'Last 6 months', value: '6months' },
    { label: 'Last year', value: '1year' },
    { label: 'Custom range', value: 'custom' }
  ];

  constructor(
    private patientService: PatientService, 
    private router: Router,
    private analysisService: AnalysisService
  ) {}

  ngOnInit(): void {
    this.loadPatients();
  }

  loadPatients(): void {
    this.isLoading = true;
    this.errorMessage = '';
    
    // Only send server-side parameters
    const params = {
      // We'll handle pagination client-side
      page: 1, // Always request page 1
      limit: 100, // Request a large number to get all patients
      search: this.searchQuery?.trim() || undefined
    };
    
    console.log('Sending API request with params:', params);
    
    this.patientService.getPatients(params).subscribe({
      next: (response: PaginatedPatientResponse) => {
        // Store all patients in our local array
        this.allLoadedPatients = response.items;
        
        // Debug - inspect the analysis status structure 
        console.log('Loaded patients:', this.allLoadedPatients.length);
        this.allLoadedPatients.forEach(patient => {
          console.log(`Patient ${patient.patientId} analysis status:`, patient.analysisStatus);
        });
        
        // Apply client-side filtering and pagination
        this.applyFiltersAndPaginate();
        
        // Store total count for reference
        this.totalItems = this.filteredPatients.length;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading patients:', error);
        this.errorMessage = 'Failed to load patients. Using mock data instead.';
        this.isLoading = false;
        this.createMockPatients();
      }
    });
  }
  
  // Apply client-side filters and pagination
  applyFiltersAndPaginate(): void {
    console.log('Applying filters and pagination, starting with', this.allLoadedPatients.length, 'patients');
    
    // First apply all filters
    this.applyFilters();
    
    // Then apply pagination to the filtered results
    this.applyPagination();
  }
  
  // Create mock data for demonstration
  createMockPatients(): void {
    const mockPatients: Patient[] = [
      {
        id: '1',
        patientId: 'P001',
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1985-06-15',
        gender: 'Male',
        contactInfo: {
          phone: '123-456-7890',
          email: 'john.doe@example.com',
          address: '123 Main St'
        },
        medicalHistory: 'Previous seizures, diagnosed with epilepsy in 2020',
        notes: 'Needs follow-up appointment',
        createdAt: '2023-01-15',
        analysisStatus: {
          hasAnalysis: true,
          lastAnalysisDate: '2023-05-20',
          totalAnalysisCount: 3,
          lastResult: {
            class: 0, // Focal (Abnormal)
            probability: 0.89,
            modelId: 'model-v2'
          },
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
        dateOfBirth: '1990-03-22',
        gender: 'Female',
        contactInfo: {
          phone: '987-654-3210',
          email: 'jane.smith@example.com',
          address: '456 Oak Ave'
        },
        medicalHistory: 'First seizure reported in 2022, family history of epilepsy',
        createdAt: '2023-10-20',
        analysisStatus: {
          hasAnalysis: true,
          lastAnalysisDate: '2023-11-05',
          totalAnalysisCount: 1,
          lastResult: {
            class: 1, // Non-Focal (Normal)
            probability: 0.76,
            modelId: 'model-v2'
          },
          abnormalResultCount: 0,
          normalResultCount: 1,
          pendingAnalysisCount: 0
        }
      },
      {
        id: '3',
        patientId: 'P003',
        firstName: 'Michael',
        lastName: 'Johnson',
        dateOfBirth: '1978-11-08',
        gender: 'Male',
        contactInfo: {
          phone: '555-123-4567',
          email: 'michael.j@example.com',
          address: '789 Pine Rd'
        },
        medicalHistory: 'Traumatic brain injury in 2018, seizures began after',
        notes: 'Requires urgent follow-up',
        createdAt: '2023-03-05',
        analysisStatus: {
          hasAnalysis: false,
          totalAnalysisCount: 0,
          abnormalResultCount: 0,
          normalResultCount: 0,
          pendingAnalysisCount: 0
        }
      },
      {
        id: '4',
        patientId: 'P004',
        firstName: 'Sarah',
        lastName: 'Williams',
        dateOfBirth: '1992-08-30',
        gender: 'Female',
        contactInfo: {
          phone: '444-555-6666',
          email: 's.williams@example.com',
          address: '321 Elm St'
        },
        medicalHistory: 'Recently diagnosed, first EEG scheduled',
        createdAt: '2023-11-12',
        analysisStatus: {
          hasAnalysis: true,
          lastAnalysisDate: '2023-12-01',
          totalAnalysisCount: 1,
          abnormalResultCount: 0,
          normalResultCount: 0,
          pendingAnalysisCount: 1
        }
      },
      {
        id: '5',
        patientId: 'P005',
        firstName: 'David',
        lastName: 'Brown',
        dateOfBirth: '1975-04-18',
        gender: 'Male',
        contactInfo: {
          phone: '777-888-9999',
          email: 'david.b@example.com',
          address: '555 Maple Ave'
        },
        medicalHistory: 'Long-term epilepsy patient, medication resistant',
        notes: 'Consider alternative treatment options',
        createdAt: '2022-06-10',
        analysisStatus: {
          hasAnalysis: true,
          lastAnalysisDate: '2023-11-28',
          totalAnalysisCount: 5,
          lastResult: {
            class: 0, // Focal (Abnormal)
            probability: 0.95,
            modelId: 'model-v3'
          },
          abnormalResultCount: 4,
          normalResultCount: 1,
          pendingAnalysisCount: 0
        }
      }
    ];
    
    this.allLoadedPatients = mockPatients;
    this.applyFiltersAndPaginate();
  }
  
  // Apply filters to patient data
  applyFilters(): void {
    // Start with all loaded patients
    let filtered = [...this.allLoadedPatients];
    console.log('Starting filters with', filtered.length, 'patients');
    
    // Apply search query filter
    if (this.searchQuery && this.searchQuery.trim() !== '') {
      const query = this.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(patient => {
        const fullName = `${patient.firstName} ${patient.lastName}`.toLowerCase();
        const patientId = patient.patientId?.toLowerCase() || '';
        const email = patient.contactInfo?.email?.toLowerCase() || '';
        return fullName.includes(query) || 
               patientId.includes(query) || 
               email.includes(query);
      });
      console.log('After search filter:', filtered.length, 'patients');
    }
    
    // Apply status filter based on analysisStatus
    if (this.statusFilter !== 'all') {
      console.log('Applying status filter:', this.statusFilter);
      
      switch (this.statusFilter) {
        case 'no-analysis':
          filtered = filtered.filter(patient => 
            !patient.analysisStatus?.hasAnalysis || 
            (patient.analysisStatus?.totalAnalysisCount ?? 0) === 0
          );
          break;
        
        case 'abnormal-results':
          console.log('Patients before abnormal filter:', filtered.length);
          
          // Debug each patient's analysis status
          filtered.forEach(patient => {
            console.log(`Patient ${patient.patientId} - abnormal count:`, 
                       patient.analysisStatus?.abnormalResultCount ?? 'undefined', 
                       'hasAnalysis:', patient.analysisStatus?.hasAnalysis ?? 'undefined');
          });
          
          filtered = filtered.filter(patient => {
            // Make sure we have analysis status data
            if (!patient.analysisStatus) {
              return false;
            }
            
            // Get abnormal count, ensuring it's a number with nullish coalescing
            const abnormalCount = patient.analysisStatus.abnormalResultCount ?? 0;
            
            // Show patients with at least one abnormal result
            const hasAbnormal = patient.analysisStatus.hasAnalysis === true && abnormalCount > 0;
            
            if (hasAbnormal) {
              console.log(`Including patient ${patient.patientId} in abnormal results`);
            }
            
            return hasAbnormal;
          });
          break;
          
        case 'normal-results':
          console.log('Patients before normal filter:', filtered.length);
          
          // Debug each patient's analysis status
          filtered.forEach(patient => {
            console.log(`Patient ${patient.patientId} - normal count:`, 
                       patient.analysisStatus?.normalResultCount ?? 'undefined',
                       'abnormal count:', patient.analysisStatus?.abnormalResultCount ?? 'undefined',
                       'hasAnalysis:', patient.analysisStatus?.hasAnalysis ?? 'undefined');
          });
          
          filtered = filtered.filter(patient => {
            // Make sure we have analysis status data
            if (!patient.analysisStatus) {
              return false;
            }
            
            // Get counts, ensuring they're numbers with nullish coalescing
            const normalCount = patient.analysisStatus.normalResultCount ?? 0;
            const abnormalCount = patient.analysisStatus.abnormalResultCount ?? 0;
            
            // Show patients that have normal results but NO abnormal results
            const normalOnly = patient.analysisStatus.hasAnalysis === true && 
                              normalCount > 0 && 
                              abnormalCount === 0;
            
            if (normalOnly) {
              console.log(`Including patient ${patient.patientId} in normal results`);
            }
            
            return normalOnly;
          });
          break;
        
        case 'pending-analysis':
          filtered = filtered.filter(patient => {
            // Make sure we have analysis status data
            if (!patient.analysisStatus) {
              return false;
            }
            
            // Get pending count, ensuring it's a number
            const pendingCount = patient.analysisStatus.pendingAnalysisCount ?? 0;
            
            // Show patients with pending analyses
            return patient.analysisStatus.hasAnalysis === true && pendingCount > 0;
          });
          break;
      }
      
      console.log('After status filter:', filtered.length, 'patients');
    }
    
    // Apply advanced filters if they exist
    
    // Apply age range filter if both min and max are set
    if (this.ageRangeMin !== null && this.ageRangeMax !== null) {
      filtered = filtered.filter(patient => {
        const age = this.calculateAge(patient.dateOfBirth);
        return age >= this.ageRangeMin! && age <= this.ageRangeMax!;
      });
    } 
    // Apply only min age filter if only min is set
    else if (this.ageRangeMin !== null) {
      filtered = filtered.filter(patient => this.calculateAge(patient.dateOfBirth) >= this.ageRangeMin!);
    } 
    // Apply only max age filter if only max is set
    else if (this.ageRangeMax !== null) {
      filtered = filtered.filter(patient => this.calculateAge(patient.dateOfBirth) <= this.ageRangeMax!);
    }
    
    // Apply gender filter
    if (this.selectedGender) {
      filtered = filtered.filter(patient => patient.gender === this.selectedGender);
    }
    
    // Apply date range filter (for record creation date)
    if (this.dateRangeStart && this.dateRangeEnd) {
      const startDate = new Date(this.dateRangeStart);
      const endDate = new Date(this.dateRangeEnd);
      // Set end date to end of day
      endDate.setHours(23, 59, 59, 999);
      
      filtered = filtered.filter(patient => {
        const recordDate = new Date(patient.createdAt!);
        return recordDate >= startDate && recordDate <= endDate;
      });
    }
    
    // Apply sorting
    this.applySortToFiltered(filtered);
    
    // Store the filtered results
    this.filteredPatients = filtered;
    
    // Update pagination data based on filtered results
    this.updatePaginationData();
  }
  
  // Apply pagination to the filtered results
  applyPagination(): void {
    // Calculate start and end indices
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = Math.min(startIndex + this.pageSize, this.filteredPatients.length);
    
    // If there are no filtered patients, show empty results
    if (this.filteredPatients.length === 0) {
      this.displayedPatients = [];
      return;
    }
    
    // Make sure we don't try to access invalid indices
    if (startIndex >= this.filteredPatients.length) {
      // If the current page is now invalid (e.g., after filtering reduced items)
      this.currentPage = 1;
      this.applyPagination(); // Retry with page 1
      return;
    }
    
    // Slice the array to get current page items
    this.displayedPatients = this.filteredPatients.slice(startIndex, endIndex);
    console.log(`Pagination applied: showing ${this.displayedPatients.length} of ${this.filteredPatients.length} filtered patients`);
  }
  
  // Update pagination data based on filtered results
  updatePaginationData(): void {
    this.totalItems = this.filteredPatients.length;
    this.totalPages = Math.max(1, Math.ceil(this.totalItems / this.pageSize));
    
    // If current page is beyond available pages, reset to page 1
    if (this.currentPage > this.totalPages) {
      this.currentPage = 1;
    }
  }
  
  // Apply sorting to the filtered patients
  applySortToFiltered(patients: Patient[]): void {
    switch (this.sortOption) {
      case 'recent':
        patients.sort((a, b) => this.compareDates(b.createdAt, a.createdAt));
        break;
        
      case 'oldest':
        patients.sort((a, b) => this.compareDates(a.createdAt, b.createdAt));
        break;
        
      case 'id-asc':
        patients.sort((a, b) => (a.patientId || '').localeCompare(b.patientId || ''));
        break;
        
      case 'id-desc':
        patients.sort((a, b) => (b.patientId || '').localeCompare(a.patientId || ''));
        break;
        
      case 'name-asc':
        patients.sort((a, b) => this.getPatientFullName(a).localeCompare(this.getPatientFullName(b)));
        break;
        
      case 'name-desc':
        patients.sort((a, b) => this.getPatientFullName(b).localeCompare(this.getPatientFullName(a)));
        break;
    }
        }
        
  // Helper method to compare dates (handles string or Date objects)
  private compareDates(dateA: Date | string | undefined, dateB: Date | string | undefined): number {
    if (!dateA && !dateB) return 0;
    if (!dateA) return -1;
    if (!dateB) return 1;
    
    const timeA = typeof dateA === 'string' ? new Date(dateA).getTime() : dateA.getTime();
    const timeB = typeof dateB === 'string' ? new Date(dateB).getTime() : dateB.getTime();
    
    return timeA - timeB;
  }
  
  searchPatients(): void {
    this.currentPage = 1; // Reset to first page
    
    // For short search terms or clearing search, apply client-side filtering
    if (!this.searchQuery || this.searchQuery.trim().length < 3) {
      this.applyFiltersAndPaginate();
    } else {
      // For longer search terms, reload from server
    this.loadPatients();
    }
  }
  
  filterByStatus(status: 'all' | 'no-analysis' | 'normal-results' | 'abnormal-results' | 'pending-analysis'): void {
    this.statusFilter = status;
    this.currentPage = 1; // Reset to first page
    this.applyFiltersAndPaginate();
  }
  
  // Clear all filters and reset to defaults
  clearFilters(): void {
    this.searchQuery = '';
    this.statusFilter = 'all';
    this.sortOption = 'recent';
    this.currentPage = 1;
    
    // Clear advanced filters too
    this.ageRangeMin = null;
    this.ageRangeMax = null;
    this.selectedGender = '';
    this.selectedDateRange = '';
    this.dateRangeStart = '';
    this.dateRangeEnd = '';
    
    // Clear selection
    this.clearSelection();
    
    // Apply client-side filtering if we already have data loaded
    if (this.allLoadedPatients.length > 0) {
      this.applyFiltersAndPaginate();
    } else {
      // Otherwise reload from server
    this.loadPatients();
    }
  }
  
  // Get label for patient's analysis status
  getAnalysisStatusLabel(patient: Patient): string {
    const status = patient.analysisStatus;
    
    if (!status || !status.hasAnalysis) {
      return 'No Analysis';
    }
    
    if (status.pendingAnalysisCount > 0) {
      return 'Analysis Pending';
    }
    
    if (status.lastResult) {
      return this.analysisService.getClassificationLabel(status.lastResult);
    }
    
    return 'Normal';
  }
  
  // Get analysis status class for styling
  getAnalysisStatusClass(patient: Patient): string {
    const status = patient.analysisStatus;
    
    if (!status || !status.hasAnalysis) {
      return 'no-analysis';
    }
    
    if (status.pendingAnalysisCount > 0) {
      return 'pending';
    }
    
    if (status.lastResult) {
      return this.analysisService.getClassificationClass(status.lastResult);
    }
    
    return 'normal';
  }
  
  // Pagination controls
  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.applyPagination(); // Apply client-side pagination
    }
  }
  
  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.applyPagination(); // Apply client-side pagination
    }
  }
  
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.applyPagination(); // Apply client-side pagination
    }
  }
  
  // Helper methods
  getPatientFullName(patient: Patient): string {
    return this.patientService.getPatientFullName(patient);
  }
  
  calculateAge(dateOfBirth: Date | string): number {
    return this.patientService.calculateAge(dateOfBirth);
  }
  
  getPages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }
  
  // Show the create patient modal
  openCreatePatientModal(): void {
    this.showCreatePatientModal = true;
  }
  
  // Close the create patient modal
  closeCreatePatientModal(): void {
    this.showCreatePatientModal = false;
  }
  
  // Handle patient creation success
  onPatientCreated(patientId: string): void {
    console.log('Patient created with ID:', patientId);
    
    // Close the modal
    this.showCreatePatientModal = false;
    
    // Redirect to the patient details page
    if (patientId) {
      this.router.navigate(['/doctor/patients', patientId]);
    }
    
    // Reload the patient list
    this.loadPatients();
  }
  
  // Open the analysis overlay for a specific patient
  openAnalysisOverlay(patientId: string | undefined): void {
    if (!patientId) {
      console.error('Invalid patient ID');
      return;
    }
    this.selectedPatientId = patientId;
    this.showAnalysisOverlay = true;
  }
  
  // Close the analysis overlay
  closeAnalysisOverlay(): void {
    this.showAnalysisOverlay = false;
    this.selectedPatientId = null;
  }
  
  // Handle analysis creation success
  onAnalysisCreated(analysisId: string): void {
    console.log('Analysis created with ID:', analysisId);
    this.closeAnalysisOverlay();
    // Navigate to the analysis details page
    this.router.navigate(['/doctor/analysis', analysisId]);
  }
  
  // Toggle advanced search panel
  toggleAdvancedSearch(): void {
    this.showAdvancedSearch = !this.showAdvancedSearch;
  }
  
  // Handle date range preset selection
  onDateRangeChange(): void {
    const now = new Date();
    
    // Reset custom date inputs if not using custom
    if (this.selectedDateRange !== 'custom') {
      this.dateRangeStart = '';
      this.dateRangeEnd = '';
    }
    
    // Apply preset dates
    if (this.selectedDateRange === '30days') {
      const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
      this.dateRangeStart = this.formatDateForInput(thirtyDaysAgo);
      this.dateRangeEnd = this.formatDateForInput(now);
    } else if (this.selectedDateRange === '90days') {
      const ninetyDaysAgo = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));
      this.dateRangeStart = this.formatDateForInput(ninetyDaysAgo);
      this.dateRangeEnd = this.formatDateForInput(now);
    } else if (this.selectedDateRange === '6months') {
      const sixMonthsAgo = new Date(now);
      sixMonthsAgo.setMonth(now.getMonth() - 6);
      this.dateRangeStart = this.formatDateForInput(sixMonthsAgo);
      this.dateRangeEnd = this.formatDateForInput(now);
    } else if (this.selectedDateRange === '1year') {
      const oneYearAgo = new Date(now);
      oneYearAgo.setFullYear(now.getFullYear() - 1);
      this.dateRangeStart = this.formatDateForInput(oneYearAgo);
      this.dateRangeEnd = this.formatDateForInput(now);
    }
  }
  
  // Format date for HTML date input
  formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  // Apply all advanced filters
  applyAdvancedFilters(): void {
    this.currentPage = 1; // Reset to first page
    this.applyFiltersAndPaginate();
  }
  
  // Clear all advanced filters
  clearAdvancedFilters(): void {
    this.ageRangeMin = null;
    this.ageRangeMax = null;
    this.selectedGender = '';
    this.selectedDateRange = '';
    this.dateRangeStart = '';
    this.dateRangeEnd = '';
    
    // Apply changes
    this.applyFiltersAndPaginate();
  }
  
  // Bulk selection methods
  togglePatientSelection(patient: Patient): void {
    if (!patient.id) return;
    
    if (this.selectedPatients[patient.id]) {
      delete this.selectedPatients[patient.id];
      this.selectedCount--;
    } else {
      this.selectedPatients[patient.id] = true;
      this.selectedCount++;
    }
    
    this.checkBulkSelectionState();
    this.updateBulkActionsVisibility();
  }
  
  isPatientSelected(patient: Patient): boolean {
    return patient.id ? !!this.selectedPatients[patient.id] : false;
  }
  
  toggleAllPatients(): void {
    if (this.allSelected) {
      // Deselect all
      this.selectedPatients = {};
      this.selectedCount = 0;
    } else {
      // Select all displayed patients (current page only)
      this.selectedPatients = {};
      this.selectedCount = 0;
      
      this.displayedPatients.forEach(patient => {
        if (patient.id) {
          this.selectedPatients[patient.id] = true;
          this.selectedCount++;
        }
      });
    }
    
    this.allSelected = !this.allSelected;
    this.updateBulkActionsVisibility();
  }
  
  checkBulkSelectionState(): void {
    if (this.filteredPatients.length === 0) {
      this.allSelected = false;
      return;
    }
    
    this.allSelected = this.filteredPatients.every(
      patient => patient.id && this.selectedPatients[patient.id]
    );
  }
  
  updateBulkActionsVisibility(): void {
    this.showBulkActions = this.selectedCount > 0;
  }
  
  // Clear patient selection
  clearSelection(): void {
    this.selectedPatients = {};
    this.selectedCount = 0;
    this.allSelected = false;
    this.updateBulkActionsVisibility();
  }
  
  // Bulk action methods
  bulkGenerateReports(): void {
    const selectedIds = Object.keys(this.selectedPatients);
    
    if (selectedIds.length === 0) {
      return;
    }
    
    // Here you would implement the bulk report generation
    console.log(`Generating reports for ${selectedIds.length} patients`);
    
    // In a real implementation, you would:
    // 1. Call an API endpoint to generate reports in bulk
    // 2. Show a progress indicator
    // 3. Provide download links for the generated reports
    
    alert(`Started generating reports for ${selectedIds.length} patients.`);
  }
  
  bulkExportData(): void {
    const selectedIds = Object.keys(this.selectedPatients);
    
    if (selectedIds.length === 0) {
      return;
    }
    
    // Here you would implement exporting patient data
    console.log(`Exporting data for ${selectedIds.length} patients`);
    
    // In a real implementation, you would:
    // 1. Call an API endpoint to prepare the export
    // 2. Download the resulting file (CSV, Excel, etc.)
    
    alert(`Started exporting data for ${selectedIds.length} patients.`);
  }
  
  bulkDeletePatients(): void {
    const selectedIds = Object.keys(this.selectedPatients);
    const count = selectedIds.length;
    
    if (count === 0) {
      return;
    }
    
    if (confirm(`Are you sure you want to delete ${count} patient${count > 1 ? 's' : ''}? This action cannot be undone.`)) {
      // Here you would implement deleting multiple patients
      console.log(`Deleting ${count} patients`);
      
      // In a real implementation, you would:
      // 1. Call an API endpoint to delete multiple patients
      // 2. Show a progress indicator
      // 3. Update the UI after successful deletion
      
      // For demo, we'll just clear the selection and reload
      this.clearSelection();
      this.loadPatients();
    }
  }

  // Apply sort when the sort option changes
  applySortFilter(): void {
    // Apply client-side sorting and pagination
    this.applySortToFiltered(this.filteredPatients);
    this.applyPagination();
  }
}
