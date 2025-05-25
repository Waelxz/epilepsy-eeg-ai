import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { PatientService, Patient } from '../../../shared/services/patient.service';
import { AnalysisService, Analysis, PaginatedAnalysisResponse } from '../../../shared/services/analysis.service';
import { ReportService, Report, PaginatedReportResponse } from '../../../shared/services/report.service';
import { AnalysisOverlayComponent } from '../analysis-overlay/analysis-overlay.component';
import { PatientEditComponent } from '../patient-edit/patient-edit.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { PatientTimelineComponent } from '../patient-timeline/patient-timeline.component';
import { ToastService } from '../../../shared/services/toast.service';
import { OAuthService } from '../../../shared/services/oauth.service';
import { AuthService } from '../../../auth/auth.service';

@Component({
  selector: 'app-patient-details',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule, 
    FormsModule, 
    ReactiveFormsModule, 
    HttpClientModule,
    AnalysisOverlayComponent, 
    PatientEditComponent,
    ConfirmDialogComponent,
    PatientTimelineComponent
  ],
  templateUrl: './patient-details.component.html',
  styleUrl: './patient-details.component.css'
})
export class PatientDetailsComponent implements OnInit {
  patient: Patient | null = null;
  patientId: string = '';
  isLoading: boolean = true;
  errorMessage: string = '';
  
  // Analysis and reports
  analyses: Analysis[] = [];
  reports: Report[] = [];
  filteredReports: Report[] = [];
  
  // Reports filtering
  reportsFilter = {
    type: 'all',
    sort: 'newest'
  };
  
  // Map to track which analyses have reports
  analysisReportsMap: Map<string, Report> = new Map();
  
  // Active tab - including history tab
  activeTab: 'analyses' | 'reports' | 'history' | 'timeline' = 'analyses';
  
  // Show analysis overlay
  showAnalysisOverlay: boolean = false;
  
  // Show edit patient overlay
  showEditPatientModal: boolean = false;
  
  // Show delete confirmation
  showDeleteConfirmation: boolean = false;
  
  // Show delete report confirmation
  showDeleteReportConfirmation: boolean = false;
  
  // ID of the report to delete
  reportToDeleteId: string = '';
  
  // Share report dialog
  showShareReportDialog: boolean = false;
  reportToShareId: string = '';
  emailToShareWith: string = '';
  
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private patientService: PatientService,
    private analysisService: AnalysisService,
    private reportService: ReportService,
    private toastService: ToastService,
    private oauthService: OAuthService,
    private authService: AuthService
  ) {}
  
  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.patientId = params['id'];
      this.loadPatient();
    });
    
    // Set analyses as the default active tab
    this.activeTab = 'analyses';
    
    // Check for query parameters
    this.route.queryParams.subscribe(params => {
      // Check for success message
      if (params['success'] === 'true' && params['message']) {
        // Use special share success notification for email sent messages
        if (params['message'].includes('sent successfully')) {
          this.toastService.shareSuccess(decodeURIComponent(params['message']));
        } else {
          this.toastService.success(decodeURIComponent(params['message']));
        }
        
        // Remove the parameters from URL to prevent showing the message again on refresh
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {},
          replaceUrl: true
        });
      }
      
      // Check for oauth_success query parameter
      if (params['oauth_success'] === 'true') {
        this.toastService.success('Google authentication successful! You can now share reports via email.');
        
        // Check if email was sent automatically
        if (params['email_sent'] === 'true' && params['recipient']) {
          this.toastService.shareSuccess(`Report shared successfully with ${params['recipient']}`);
        } else if (params['email_sent'] === 'false') {
          this.toastService.error('Failed to send report email. Please try again.');
        }
      }
    });
    
    // Check OAuth status
    this.oauthService.checkAuthStatus().subscribe({
      next: (status) => {
        if (status.authenticated) {
          console.log('User is authenticated with Google as:', status.email);
        }
      },
      error: (error) => {
        console.error('Error checking OAuth status:', error);
      }
    });
  }
  
  loadPatient(): void {
    this.isLoading = true;
    this.errorMessage = '';
    
    this.patientService.getPatientById(this.patientId).subscribe({
      next: (patient) => {
        this.patient = patient;
        this.isLoading = false;
        this.loadAnalyses();
        this.loadReports();
      },
      error: (error) => {
        console.error('Error loading patient:', error);
        this.errorMessage = 'Failed to load patient data.';
        this.isLoading = false;
        this.createMockData(); // For development/demo
      }
    });
  }
  
  loadAnalyses(): void {
    if (!this.patientId) return;
    
    const params = {
      patientId: this.patientId,
      page: 1,
      limit: 10
    };
    
    this.analysisService.getAnalyses(params).subscribe({
      next: (response: PaginatedAnalysisResponse) => {
        this.analyses = response.items;
        // Check for existing reports for each analysis
        this.checkExistingReportsForAnalyses();
      },
      error: (error) => {
        console.error('Error loading analyses:', error);
      }
    });
  }
  
  loadReports(): void {
    if (!this.patientId) return;
    
    const params = {
      patientId: this.patientId,
      page: 1,
      limit: 50 // Increased limit to ensure we get all reports
    };
    
    console.log('Loading reports with params:', params);
    
    this.reportService.getReports(params).subscribe({
      next: (response: PaginatedReportResponse) => {
        console.log('Reports loaded:', response);
        // Ensure we only get reports for this patient
        this.reports = response.items.filter(report => report.patientId === this.patientId);
        
        if (this.reports.length !== response.items.length) {
          console.warn(`Filtered out ${response.items.length - this.reports.length} reports that didn't match patient ID ${this.patientId}`);
        }
        
        // Apply initial filtering
        this.filterReports();
        
        // Map reports to analyses
        this.mapReportsToAnalyses();
      },
      error: (error) => {
        console.error('Error loading reports:', error);
      }
    });
  }
  
  // Filter reports based on current filter settings
  filterReports(): void {
    // Start with all reports
    let filtered = [...this.reports];
    
    // Filter by type
    if (this.reportsFilter.type !== 'all') {
      filtered = filtered.filter(report => report.reportType === this.reportsFilter.type);
    }
    
    // Sort by date
    filtered.sort((a, b) => {
      const dateA = a.generatedDate ? new Date(a.generatedDate).getTime() : 0;
      const dateB = b.generatedDate ? new Date(b.generatedDate).getTime() : 0;
      
      if (this.reportsFilter.sort === 'newest') {
        return dateB - dateA; // Newest first
      } else {
        return dateA - dateB; // Oldest first
      }
    });
    
    // Update filtered reports
    this.filteredReports = filtered;
  }
  
  // Map reports to analyses for quick lookup
  mapReportsToAnalyses(): void {
    // Clear existing map
    this.analysisReportsMap.clear();
    
    // Add each report to the map keyed by analysisId
    this.reports.forEach(report => {
      if (report.analysisId) {
        // For patient reports, store only the most recent one for each analysis
        if (report.reportType === 'patient') {
          const existingReport = this.analysisReportsMap.get(report.analysisId);
          if (!existingReport || new Date(report.generatedDate || '') > new Date(existingReport.generatedDate || '')) {
            this.analysisReportsMap.set(report.analysisId, report);
          }
        } else {
          // For analysis reports, always replace
          this.analysisReportsMap.set(report.analysisId, report);
        }
      }
    });
    
    console.log('Reports mapped to analyses:', this.analysisReportsMap);
  }
  
  // Check for existing reports for specific analyses
  checkExistingReportsForAnalyses(): void {
    // If we already have reports loaded, map them to analyses
    if (this.reports.length > 0) {
      this.mapReportsToAnalyses();
      return;
    }
    
    // Otherwise load reports first
    this.loadReports();
  }
  
  // Check if an analysis has a report
  hasReport(analysisId: string): boolean {
    return this.analysisReportsMap.has(analysisId);
  }
  
  // Get report for an analysis
  getReportForAnalysis(analysisId: string): Report | undefined {
    return this.analysisReportsMap.get(analysisId);
  }
  
  // Download existing report
  downloadExistingReport(analysisId: string): void {
    const report = this.analysisReportsMap.get(analysisId);
    if (!report || !report.id) {
      console.error('No report found for analysis:', analysisId);
      return;
    }
    
    this.downloadReport(report.id);
  }
  
  // Regenerate report for analysis
  regenerateReport(analysisId: string, reportType: 'patient' | 'analysis'): void {
    if (!analysisId) {
      console.error('No analysis ID provided');
      return;
    }
    
    // Remove the report from the map to show generating state
    this.analysisReportsMap.delete(analysisId);
    
    // Generate new report
    this.generateReport(analysisId, reportType);
  }
  
  // Create mock data for development/demo
  createMockData(): void {
    this.patient = {
      id: this.patientId || '1',
      patientId: 'P001',
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: '1985-06-15',
      gender: 'Male',
      contactInfo: {
        phone: '123-456-7890',
        email: 'john.doe@example.com',
        address: '123 Main St, Cityville, State 12345'
      },
      medicalHistory: 'Patient first experienced seizures at age 25 following a mild concussion. Diagnosed with epilepsy in 2020. Family history includes epilepsy in maternal grandmother. Patient reports seizures are typically triggered by stress and sleep deprivation.',
      medications: [
        {
          name: 'Lamotrigine',
          dosage: '200mg',
          frequency: 'Twice daily'
        },
        {
          name: 'Levetiracetam',
          dosage: '500mg',
          frequency: 'Three times daily'
        }
      ],
      notes: 'Patient has been responding well to current medication regimen. Seizure frequency has decreased from 3-4 per month to 1-2 per month. Continue monitoring and consider EEG follow-up in 3 months.',
      createdAt: '2023-01-15',
      analysisStatus: {
        hasAnalysis: true,
        lastAnalysisDate: '2023-05-20',
        totalAnalysisCount: 3,
        lastResult: {
          class: 1,
          probability: 0.89,
          modelId: 'model-v2'
        },
        abnormalResultCount: 2,
        normalResultCount: 1,
        pendingAnalysisCount: 0
      }
    };
    
    // Mock analyses
    this.analyses = [
      {
        id: 'a1',
        patientId: this.patientId || '1',
        fileName: 'eeg_recording_05202023.edf',
        status: 'completed',
        uploadDate: '2023-05-20',
        modelUsed: 'CNN-LSTM v2.0',
        result: {
          class: 1,
          probability: 0.89,
          interpretation: 'Abnormal EEG patterns detected. Consistent with epileptic seizure activity.'
        }
      },
      {
        id: 'a2',
        patientId: this.patientId || '1',
        fileName: 'eeg_recording_03152023.edf',
        status: 'completed',
        uploadDate: '2023-03-15',
        modelUsed: 'CNN-LSTM v1.5',
        result: {
          class: 1,
          probability: 0.76,
          interpretation: 'Abnormal EEG. Moderate probability of epileptic patterns.'
        }
      },
      {
        id: 'a3',
        patientId: this.patientId || '1',
        fileName: 'eeg_recording_01102023.edf',
        status: 'completed',
        uploadDate: '2023-01-10',
        modelUsed: 'CNN-LSTM v1.5',
        result: {
          class: 0,
          probability: 0.82,
          interpretation: 'Normal EEG patterns. No significant epileptic activity detected.'
        }
      }
    ];
    
    // Mock reports
    this.reports = [
      {
        id: 'r1',
        analysisId: 'a1',
        patientId: this.patientId || '1',
        reportType: 'patient',
        generatedDate: '2023-05-21',
        content: 'Patient report for EEG analysis. Abnormal patterns detected.'
      },
      {
        id: 'r2',
        analysisId: 'a2',
        patientId: this.patientId || '1',
        reportType: 'analysis',
        generatedDate: '2023-03-16',
        content: 'Analysis report for EEG analysis.'
      }
    ];
  }
  
  // Set active tab - including history tab
  setActiveTab(tab: 'analyses' | 'reports' | 'history' | 'timeline'): void {
    this.activeTab = tab;
  }
  
  // Navigate to new analysis with this patient preselected
  startNewAnalysis(): void {
    // Use the overlay instead of navigating
    this.showAnalysisOverlay = true;
  }
  
  // Close the analysis overlay
  closeAnalysisOverlay(): void {
    this.showAnalysisOverlay = false;
  }
  
  // Handle analysis creation success
  onAnalysisCreated(analysisId: string): void {
    console.log('Analysis created with ID:', analysisId);
    this.closeAnalysisOverlay();
    // Refresh analyses list
    this.loadAnalyses();
    // Navigate to the analysis details page
    this.router.navigate(['/doctor/analysis', analysisId]);
  }
  
  // Calculate age from birthdate
  calculateAge(dateOfBirth: Date | string): number {
    return this.patientService.calculateAge(dateOfBirth);
  }
  
  // Get full name helper
  getPatientFullName(): string {
    if (!this.patient) return '';
    return this.patientService.getPatientFullName(this.patient);
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
  
  // Format date with time helper
  formatDateTime(date: Date | string): string {
    if (!date) return '';
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  
  // Get class for analysis result
  getAnalysisStatusClass(analysis: Analysis): string {
    return this.analysisService.getAnalysisStatusClass(analysis);
  }
  
  // Get label for analysis status
  getAnalysisStatusLabel(analysis: Analysis): string {
    if (analysis.status === 'queued') {
      return 'In Queue';
    }
    
    if (analysis.status === 'processing') {
      return 'Processing';
    }
    
    if (analysis.status === 'failed') {
      return 'Failed';
    }
    
    if (analysis.status === 'completed') {
      return this.analysisService.getClassificationLabel(analysis.result);
    }
    
    return 'Unknown';
  }
  
  // Get technical classification (specific to model)
  getTechnicalClassification(analysis: Analysis): string {
    if (analysis.status === 'completed' && analysis.result) {
      // Create a result object with model information
      const resultWithModel = {
        ...analysis.result,
        modelId: analysis.modelUsed
      };
      return this.analysisService.getClassificationLabel(resultWithModel, 'specific');
    }
    return 'Unknown';
  }
  
  // Download a report with improved error handling
  downloadReport(reportId: string): void {
    if (!reportId) {
      console.error('No report ID provided');
      return;
    }
    
    // Add loading state if needed
    const loadingElement = document.getElementById('report-' + reportId);
    if (loadingElement) {
      loadingElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
      loadingElement.setAttribute('disabled', 'true');
    }
    
    this.reportService.downloadReport(reportId).subscribe({
      next: (blob) => {
        // Create file name with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `report-${timestamp}.pdf`;
        
        // Create and trigger download
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        // Reset loading text
        if (loadingElement) {
          loadingElement.innerHTML = '<i class="fas fa-download"></i>';
          loadingElement.removeAttribute('disabled');
        }
        
        this.toastService.success('Report downloaded successfully');
      },
      error: (error) => {
        console.error('Error downloading report:', error);
        this.toastService.error('Failed to download report. Please try again later.');
        
        // Reset loading text
        if (loadingElement) {
          loadingElement.innerHTML = '<i class="fas fa-download"></i>';
          loadingElement.removeAttribute('disabled');
        }
      }
    });
  }
  
  // Generate a new report with improved error handling
  generateReport(analysisId: string, reportType: 'patient' | 'analysis'): void {
    if (!analysisId) {
      console.error('No analysis ID provided');
      return;
    }
    
    // Get the button that was clicked to show loading state
    const loadingElements = document.querySelectorAll(`[data-analysis="${analysisId}"]`);
    loadingElements.forEach(element => {
      if (element instanceof HTMLElement) {
        element.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
        element.setAttribute('disabled', 'true');
      }
    });
    
    this.reportService.generateReport(analysisId, reportType).subscribe({
      next: (report) => {
        // Add the new report to the beginning of the list
        this.reports.unshift(report);
        
        // Update the analysis reports map
        this.analysisReportsMap.set(analysisId, report);
        
        // Show success message
        this.toastService.success(`${reportType.charAt(0).toUpperCase() + reportType.slice(1)} report generated successfully!`);
        
        // Reset button state
        loadingElements.forEach(element => {
          if (element instanceof HTMLElement) {
            element.innerHTML = '<i class="fas fa-file-pdf"></i> Generate Report';
            element.removeAttribute('disabled');
          }
        });
        
        // If we're not on the reports tab, suggest switching to it
        if (this.activeTab !== 'reports' && this.reports.length === 1) {
          if (confirm('Report generated successfully! Would you like to view it in the Reports tab?')) {
            this.setActiveTab('reports');
          }
        }
      },
      error: (error) => {
        console.error('Error generating report:', error);
        this.toastService.error(`Failed to generate ${reportType} report. Please try again later.`);
        
        // Reset button state
        loadingElements.forEach(element => {
          if (element instanceof HTMLElement) {
            element.innerHTML = '<i class="fas fa-file-pdf"></i> Generate Report';
            element.removeAttribute('disabled');
          }
        });
      }
    });
  }
  
  // Navigate to analysis details page
  viewAnalysisDetails(analysisId: string): void {
    console.log('Navigating to analysis details with ID:', analysisId);
    
    if (!analysisId) {
      console.error('Analysis ID is empty or undefined');
      return;
    }
    
    // Use absolute navigation path to ensure consistent routing
    this.router.navigate(['/doctor/analysis', analysisId])
      .then(success => {
        console.log('Navigation result:', success ? 'Success' : 'Failed');
      })
      .catch(error => {
        console.error('Navigation error:', error);
      });
  }
  
  // Get medications as comma-separated list
  getMedicationsList(): string {
    if (!this.patient?.medications || this.patient.medications.length === 0) {
      return 'No medications';
    }
    return this.patient.medications.map(med => med.name).join(', ');
  }
  
  // Navigate to the patient list
  goToPatientList(): void {
    this.router.navigate(['/doctor/patients']);
  }
  
  goBack(): void {
    // Use the History API to go back to previous page
    window.history.back();
  }
  
  // Edit patient
  editPatient(): void {
    console.log('Edit patient function called');
    this.showEditPatientModal = true;
    console.log('showEditPatientModal set to:', this.showEditPatientModal);
  }
  
  // Close edit patient modal
  closeEditPatientModal(): void {
    this.showEditPatientModal = false;
  }
  
  // Handle patient update success
  onPatientUpdated(): void {
    this.closeEditPatientModal();
    // Reload patient data
    this.loadPatient();
  }
  
  // Confirm delete patient
  confirmDeletePatient(): void {
    this.showDeleteConfirmation = true;
  }
  
  // Cancel delete
  cancelDelete(): void {
    this.showDeleteConfirmation = false;
  }
  
  // Delete patient
  deletePatient(): void {
    if (!this.patientId) return;
    
    this.isLoading = true;
    this.showDeleteConfirmation = false;
    
    this.patientService.deletePatient(this.patientId).subscribe({
      next: () => {
        // Navigate back to patient list
        this.router.navigate(['/doctor/patients']);
      },
      error: (error) => {
        console.error('Error deleting patient:', error);
        this.errorMessage = 'Failed to delete patient.';
        this.isLoading = false;
        
        // For development mode only
        if (confirm('Demo mode: Simulate successful deletion?')) {
          this.router.navigate(['/doctor/patients']);
        }
      }
    });
  }
  
  // Generate a patient report without a specific analysis
  generatePatientReport(): void {
    if (!this.patientId) {
      console.error('No patient ID available');
      return;
    }
    
    // Check if we have any completed analyses to use for the report
    const completedAnalyses = this.analyses.filter(a => a.status === 'completed');
    if (completedAnalyses.length === 0) {
      this.toastService.error('Cannot generate a patient report. The patient needs at least one completed analysis.');
      return;
    }
    
    // Find the patient report button to show loading state
    const patientReportBtn = document.querySelector('.patient-actions .btn-gradient');
    if (patientReportBtn instanceof HTMLElement) {
      patientReportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
      patientReportBtn.setAttribute('disabled', 'true');
    }
    
    // Use the most recent completed analysis for the patient report
    const mostRecentAnalysis = completedAnalyses.sort((a, b) => {
      const dateA = a.uploadDate ? new Date(a.uploadDate).getTime() : 0;
      const dateB = b.uploadDate ? new Date(b.uploadDate).getTime() : 0;
      return dateB - dateA; // Sort in descending order (newest first)
    })[0];
    
    console.log('Generating patient report using analysis:', mostRecentAnalysis.id);
    
    this.reportService.generateReport(mostRecentAnalysis.id || '', 'patient').subscribe({
      next: (report) => {
        console.log('Patient report generated successfully:', report);
        
        // Add the new report to the beginning of the list
        this.reports.unshift(report);
        
        // Apply filters to update the filtered list
        this.filterReports();
        
        // Reset button state
        if (patientReportBtn instanceof HTMLElement) {
          patientReportBtn.innerHTML = '<i class="fas fa-file-medical-alt"></i> Generate Patient Report';
          patientReportBtn.removeAttribute('disabled');
        }
        
        // Show success message
        this.toastService.success('Patient report generated successfully! You can access it in the Reports tab.');
        
        // If we're not on the reports tab, suggest switching to it
        if (this.activeTab !== 'reports') {
          if (confirm('Would you like to view the report in the Reports tab?')) {
            this.setActiveTab('reports');
          }
        }
      },
      error: (error) => {
        console.error('Error generating patient report:', error);
        this.toastService.error('Failed to generate patient report. Please try again later.');
        
        // Reset button state
        if (patientReportBtn instanceof HTMLElement) {
          patientReportBtn.innerHTML = '<i class="fas fa-file-medical-alt"></i> Generate Patient Report';
          patientReportBtn.removeAttribute('disabled');
        }
      }
    });
  }
  
  // Get analysis associated with a report
  getAnalysisForReport(report: Report): Analysis | null {
    if (!report.analysisId) return null;
    
    // Find the analysis by ID
    const analysis = this.analyses.find(a => a.id === report.analysisId);
    return analysis || null;
  }
  
  // Get formatted analysis result for display
  getAnalysisResult(analysis: Analysis | null): string {
    if (!analysis || !analysis.result) return 'No result';
    
    const result = analysis.result;
    const classification = result.class === 1 ? 'Normal' : 'Abnormal';
    const confidence = result.probability ? `(${(result.probability * 100).toFixed(1)}%)` : '';
    
    return `${classification} ${confidence}`;
  }
  
  // Confirm delete report
  confirmDeleteReport(reportId: string): void {
    if (!reportId) return;
    
    this.reportToDeleteId = reportId;
    this.showDeleteReportConfirmation = true;
  }
  
  // Cancel delete report
  cancelDeleteReport(): void {
    this.showDeleteReportConfirmation = false;
    this.reportToDeleteId = '';
  }
  
  // Delete a report
  deleteReport(reportId: string): void {
    if (!reportId) return;
    
    this.reportService.deleteReport(reportId).subscribe({
      next: () => {
        console.log('Report deleted successfully');
        
        // Remove the report from the lists
        this.reports = this.reports.filter(r => r.id !== reportId);
        this.filteredReports = this.filteredReports.filter(r => r.id !== reportId);
        
        // Update the analysis-reports map
        this.mapReportsToAnalyses();
        
        // Hide the confirmation dialog
        this.showDeleteReportConfirmation = false;
        this.reportToDeleteId = '';
        
        // Show success notification
        this.toastService.success('Report deleted successfully');
      },
      error: (error: Error) => {
        console.error('Error deleting report:', error);
        this.toastService.error('Failed to delete report. Please try again later.');
        
        // Hide the confirmation dialog
        this.showDeleteReportConfirmation = false;
        this.reportToDeleteId = '';
      }
    });
  }
  
  // Open share report dialog
  openShareReportDialog(reportId: string): void {
    if (!reportId) return;
    
    this.reportToShareId = reportId;
    this.showShareReportDialog = true;
  }
  
  // Share report with OAuth handling
  shareReport(reportId: string, email: string): void {
    if (!reportId || !email) return;
    
    this.showShareReportDialog = false;
    
    // Use the report service instead of manual form submission
    this.reportService.shareReportViaEmail(reportId, email, true, true)
      .subscribe({
      next: (response) => {
          if (response && response.status === 'success') {
        this.toastService.success('Report shared successfully');
            this.clearShareDialogState();
          }
      },
      error: (error) => {
        console.error('Error sharing report:', error);
          this.toastService.error('Failed to share report');
          this.clearShareDialogState();
      }
    });
  }
  
  // Cancel share report
  cancelShareReport(): void {
    this.showShareReportDialog = false;
    this.clearShareDialogState();
  }
  
  clearShareDialogState(): void {
    this.reportToShareId = '';
    this.emailToShareWith = '';
  }
  
  // Show toast message (for success/error notifications)
  showToast(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    // Use the toast service instead of alert
    switch(type) {
      case 'success':
        this.toastService.success(message);
        break;
      case 'error':
        this.toastService.error(message);
        break;
      default:
        this.toastService.info(message);
        break;
    }
  }
}
