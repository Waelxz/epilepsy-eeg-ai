import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ReportService, Report, PaginatedReportResponse } from '../../../shared/services/report.service';
import { PatientService, Patient } from '../../../shared/services/patient.service';
import { AnalysisService } from '../../../shared/services/analysis.service';
import { Router, ActivatedRoute } from '@angular/router';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { ToastService } from '../../../shared/services/toast.service';
import { OAuthService } from '../../../shared/services/oauth.service';

@Component({
  selector: 'app-reports-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ConfirmDialogComponent],
  templateUrl: './reports-list.component.html',
  styleUrl: './reports-list.component.css'
})
export class ReportsListComponent implements OnInit {
  // Data structures
  allLoadedData: Report[] = [];     // All loaded reports
  filteredData: Report[] = [];      // Reports after filtering
  displayedData: Report[] = [];     // Reports displayed on the current page
  
  // Patient and analysis data for displaying names
  patientNames: Record<string, string> = {};
  analysisDetails: Record<string, any> = {};

  // Pagination
  currentPage: number = 1;
  pageSize: number = 10;
  totalPages: number = 0;
  totalItems: number = 0;
  
  // Server-side pagination tracking
  serverCurrentPage: number = 1;
  hasMorePages: boolean = false;
  isLoadingMore: boolean = false;

  // Filtering and sorting
  searchTerm: string = '';
  reportTypeFilter: string = '';
  dateFilter: string = '';
  sortOption: string = 'recent';
  
  // Component state
  loading: boolean = true;
  error: string = '';
  
  // Confirm dialog state
  showDeleteConfirmation: boolean = false;
  showShareDialog: boolean = false;
  reportToDelete: Report | null = null;
  reportToShare: Report | null = null;
  recipientEmail: string = '';

  constructor(
    private reportService: ReportService,
    private patientService: PatientService,
    private analysisService: AnalysisService,
    private router: Router,
    private route: ActivatedRoute,
    private toastService: ToastService,
    private oauthService: OAuthService
  ) {}

  ngOnInit(): void {
    // Check for success message query parameters
    this.route.queryParams.subscribe(params => {
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
    
    this.loadReports();
    
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

  loadReports(): void {
    this.loading = true;
    this.error = '';
    this.serverCurrentPage = 1;
    this.allLoadedData = [];
    
    this.fetchReportsPage();
  }

  fetchReportsPage(): void {
    if (this.isLoadingMore && this.serverCurrentPage > 1) {
      this.loading = false; // Keep UI responsive during subsequent page loads
    } else {
      this.loading = true;
    }
    
    this.reportService.getReports({
      page: this.serverCurrentPage,
      limit: 50, // Maximum allowed by the backend
      search: this.searchTerm,
      reportType: this.reportTypeFilter !== '' ? this.reportTypeFilter : undefined
    }).subscribe({
      next: (response: PaginatedReportResponse) => {
        console.log(`Reports loaded (page ${this.serverCurrentPage}):`, response);
        
        // Append new items to allLoadedData
        this.allLoadedData = [...this.allLoadedData, ...response.items];
        this.totalItems = response.metadata.total_count;
        
        // Check if there are more pages to load
        this.hasMorePages = this.serverCurrentPage < response.metadata.total_pages;
        
        // Apply filters to all loaded data
        this.applyFilters();
        
        // Load additional details for new items
        this.loadPatientNames();
        this.loadAnalysisDetails();
        
        this.loading = false;
        this.isLoadingMore = false;

        // If we need more data and there are more pages, load the next page
        if (this.shouldLoadMoreData() && this.hasMorePages) {
          this.loadNextPage();
        }
      },
      error: (err) => {
        console.error('Error loading reports:', err);
        this.error = 'Failed to load reports. Please try again.';
        this.loading = false;
        this.isLoadingMore = false;
      }
    });
  }

  shouldLoadMoreData(): boolean {
    // If we have fewer items than what would fill all pages, we need more data
    const totalNeededItems = this.totalPages * this.pageSize;
    return this.filteredData.length < totalNeededItems && this.filteredData.length < this.totalItems;
  }

  loadNextPage(): void {
    this.isLoadingMore = true;
    this.serverCurrentPage++;
    console.log(`Loading more data: page ${this.serverCurrentPage}`);
    this.fetchReportsPage();
  }

  applyFilters(): void {
    console.log('Applying filters...');
    console.log('Search term:', this.searchTerm);
    console.log('Report type filter:', this.reportTypeFilter);
    console.log('Date filter:', this.dateFilter);
    
    let filtered = [...this.allLoadedData];
    
    // Apply search term filter (case-insensitive)
    if (this.searchTerm.trim() !== '') {
      const term = this.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(report => {
        // Check patient ID
        if (report.patientId?.toLowerCase().includes(term)) return true;
        
        // Check analysis ID 
        if (report.analysisId?.toLowerCase().includes(term)) return true;
        
        // Check patient name (if loaded)
        const patientName = this.patientNames[report.patientId]?.toLowerCase();
        if (patientName && patientName.includes(term)) return true;
        
        // Check report content
        if (report.content && report.content.toLowerCase().includes(term)) return true;
        
        return false;
      });
    }
    
    // Apply report type filter
    if (this.reportTypeFilter !== '') {
      filtered = filtered.filter(report => report.reportType === this.reportTypeFilter);
    }
    
    // Apply date filter
    if (this.dateFilter !== '') {
      const today = new Date();
      const startDate = new Date();
      
      switch(this.dateFilter) {
        case 'today':
          startDate.setHours(0, 0, 0, 0);
          filtered = filtered.filter(report => {
            const reportDate = new Date(report.generatedDate as string);
            return reportDate >= startDate && reportDate <= today;
          });
          break;
        case 'week':
          startDate.setDate(today.getDate() - 7);
          filtered = filtered.filter(report => {
            const reportDate = new Date(report.generatedDate as string);
            return reportDate >= startDate && reportDate <= today;
          });
          break;
        case 'month':
          startDate.setMonth(today.getMonth() - 1);
          filtered = filtered.filter(report => {
            const reportDate = new Date(report.generatedDate as string);
            return reportDate >= startDate && reportDate <= today;
          });
          break;
      }
    }
    
    // Apply sorting
    this.applySortFilter(filtered);
    
    // Update filtered data and pagination
    this.filteredData = filtered;
    this.totalPages = Math.ceil(filtered.length / this.pageSize);
    
    // Adjust current page if necessary
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = this.totalPages;
    } else if (this.totalPages === 0) {
      this.currentPage = 1;
    }
    
    // Update displayed data
    this.updateDisplayedData();
  }

  applySortFilter(data: Report[] = this.filteredData): Report[] {
    console.log('Applying sort option:', this.sortOption);
    
    switch (this.sortOption) {
      case 'recent':
        data.sort((a, b) => new Date(b.generatedDate as string).getTime() - new Date(a.generatedDate as string).getTime());
        break;
      case 'oldest':
        data.sort((a, b) => new Date(a.generatedDate as string).getTime() - new Date(b.generatedDate as string).getTime());
        break;
      case 'patient-asc':
        data.sort((a, b) => (a.patientId || '').localeCompare(b.patientId || ''));
        break;
      case 'patient-desc':
        data.sort((a, b) => (b.patientId || '').localeCompare(a.patientId || ''));
        break;
      case 'type-asc':
        data.sort((a, b) => (a.reportType || '').localeCompare(b.reportType || ''));
        break;
      case 'type-desc':
        data.sort((a, b) => (b.reportType || '').localeCompare(a.reportType || ''));
        break;
    }
    
    return data;
  }

  updateDisplayedData(): void {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = Math.min(startIndex + this.pageSize, this.filteredData.length);
    this.displayedData = this.filteredData.slice(startIndex, endIndex);
    console.log(`Displaying items ${startIndex + 1}-${endIndex} of ${this.filteredData.length}`);

    // Check if we need to load more data
    if (this.shouldLoadMoreData() && this.hasMorePages && !this.isLoadingMore) {
      this.loadNextPage();
    }
  }

  onSearch(): void {
    // For search, we'll use client-side filtering since we need to search by patient name
    // which is only available after loading patient details
    console.log('Search triggered with term:', this.searchTerm);
    this.currentPage = 1;  // Reset to first page
    
    // If we haven't loaded any data yet, fetch it
    if (this.allLoadedData.length === 0) {
      this.serverCurrentPage = 1;
      this.fetchReportsPage();
    } else {
      // Otherwise just apply filters to existing data
      this.applyFilters();
    }
  }

  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updateDisplayedData();
      console.log('Page changed to:', page);
    }
  }

  filterByReportType(type: string): void {
    if (this.reportTypeFilter === type) return; // No change
    
    this.reportTypeFilter = type;
    // For filter changes, we need to reset the server-side fetching
    this.serverCurrentPage = 1;
    this.currentPage = 1; // Reset to first page
    this.allLoadedData = []; // Clear all loaded data
    this.fetchReportsPage(); // Start over with new filter
  }

  filterByDate(period: string): void {
    if (this.dateFilter === period) return; // No change
    
    this.dateFilter = period;
    this.currentPage = 1; // Reset to first page
    this.applyFilters(); // Just apply client-side filtering for date
  }

  clearFilters(): void {
    // Only reset and reload if there were active filters
    if (this.searchTerm !== '' || this.reportTypeFilter !== '' || this.dateFilter !== '') {
      this.searchTerm = '';
      this.reportTypeFilter = '';
      this.dateFilter = '';
      this.serverCurrentPage = 1;
      this.currentPage = 1;
      this.allLoadedData = []; // Clear all loaded data
      this.fetchReportsPage(); // Start over with no filters
    }
  }

  loadPatientNames(): void {
    // Extract unique patient IDs from newly loaded reports
    const loadedIds = new Set(this.patientNames ? Object.keys(this.patientNames) : []);
    const patientIds = Array.from(
      new Set(
        this.allLoadedData
          .map(report => report.patientId)
          .filter(id => id && !loadedIds.has(id)) // Only fetch IDs we haven't loaded yet
      )
    );
    
    // Fetch patient details for each ID
    patientIds.forEach(id => {
      this.patientService.getPatientById(id).subscribe({
        next: (patient: Patient) => {
          // Format the patient name from patient details
          this.patientNames[id] = `${patient.firstName} ${patient.lastName}`;
        },
        error: (error: any) => {
          console.error(`Failed to load patient details for ID: ${id}`, error);
          this.patientNames[id] = 'Unknown Patient';
        }
      });
    });
  }

  loadAnalysisDetails(): void {
    // Extract unique analysis IDs from newly loaded reports
    const loadedIds = new Set(this.analysisDetails ? Object.keys(this.analysisDetails) : []);
    const analysisIds = Array.from(
      new Set(
        this.allLoadedData
          .map(report => report.analysisId)
          .filter(id => id && !loadedIds.has(id)) // Only fetch IDs we haven't loaded yet
      )
    );
    
    // Fetch analysis details for each ID
    analysisIds.forEach(id => {
      this.analysisService.getAnalysisById(id).subscribe({
        next: (analysis) => {
          this.analysisDetails[id] = analysis;
        },
        error: (error: any) => {
          console.error(`Failed to load analysis details for ID: ${id}`, error);
          this.analysisDetails[id] = { fileName: 'Unknown Analysis' };
        }
      });
    });
  }

  viewReportDetails(report: Report): void {
    // Navigate to report details page
    this.router.navigate(['/doctor/reports', report.id || report._id]);
  }

  downloadReport(report: Report): void {
    const reportId = report.id || report._id;
    if (!reportId) return;

    this.reportService.downloadReport(reportId).subscribe({
      next: (blob: Blob) => {
        // Create a URL for the blob
        const url = window.URL.createObjectURL(blob);
        
        // Create an anchor element and trigger the download
        const a = document.createElement('a');
        a.href = url;
        a.download = `report-${reportId}.pdf`; // Set the file name
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        // Show success message
        this.toastService.success('Report downloaded successfully');
      },
      error: (error: any) => {
        console.error('Error downloading report:', error);
        this.toastService.error('Failed to download report. Please try again.');
      }
    });
  }

  shareReport(report: Report, event: Event): void {
    event.stopPropagation(); // Prevent row click event
    this.reportToShare = report;
    this.showShareDialog = true;
  }
  
  confirmShare(): void {
    if (!this.reportToShare) return;
    
    const reportId = this.reportToShare.id || this.reportToShare._id;
    if (!reportId) return;
    
    // Use direct redirect approach to maintain session state during OAuth flow
    this.reportService.shareReportViaEmail(reportId, this.recipientEmail, true, true)
      .subscribe({
      next: (response) => {
          // The redirection will happen automatically, no need for further action
          // This code will only execute if the method returns without redirecting
          this.toastService.success(`Initiating report share with ${this.recipientEmail}`);
        this.cancelShare();
      },
      error: (error: any) => {
          console.error('Error initiating report share:', error);
          this.toastService.error('Failed to share report. Please try again.');
          this.cancelShare();
      }
    });
  }
  
  cancelShare(): void {
    this.showShareDialog = false;
    this.reportToShare = null;
    this.recipientEmail = '';
  }

  deleteReport(report: Report, event: Event): void {
    event.stopPropagation(); // Prevent row click event
    this.reportToDelete = report;
    this.showDeleteConfirmation = true;
  }
  
  confirmDelete(): void {
    if (!this.reportToDelete) return;
    
    const reportId = this.reportToDelete.id || this.reportToDelete._id;
    if (!reportId) return;
    
    this.reportService.deleteReport(reportId).subscribe({
      next: () => {
        // Remove the report from local arrays
        this.allLoadedData = this.allLoadedData.filter(r => (r.id || r._id) !== reportId);
        this.applyFilters(); // This will update filteredData and displayedData
        this.toastService.success('Report deleted successfully');
        this.cancelDelete();
      },
      error: (error: any) => {
        console.error('Error deleting report:', error);
        this.toastService.error('Failed to delete report. Please try again.');
      }
    });
  }
  
  cancelDelete(): void {
    this.showDeleteConfirmation = false;
    this.reportToDelete = null;
  }

  formatDate(date: Date | string | undefined): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getReportTypeLabel(type: string): string {
    switch (type) {
      case 'patient': return 'Patient Report';
      case 'analysis': return 'Analysis Report';
      default: return type;
    }
  }

  // Determine if the Analysis column should be shown
  showAnalysisColumn(): boolean {
    // Only show analysis column if we have analysis reports or showing all reports
    if (this.reportTypeFilter === 'analysis') return true;
    if (this.reportTypeFilter === '') {
      // Check if we have any analysis reports in the displayed data
      return this.filteredData.some(report => report.reportType === 'analysis');
    }
    return false;
  }

  getPages(): number[] {
    const pages: number[] = [];
    const maxVisiblePages = 5;
    
    if (this.totalPages <= maxVisiblePages) {
      // If we have 5 or fewer pages, show all pages
      for (let i = 1; i <= this.totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show the current page
      pages.push(this.currentPage);
      
      // Add pages before the current page
      let before = this.currentPage - 1;
      while (pages.length < Math.floor(maxVisiblePages / 2) && before >= 1) {
        pages.unshift(before);
        before--;
      }
      
      // Add pages after the current page
      let after = this.currentPage + 1;
      while (pages.length < maxVisiblePages && after <= this.totalPages) {
        pages.push(after);
        after++;
      }
      
      // If we have room for more pages at the beginning, add them
      while (pages.length < maxVisiblePages && pages[0] > 1) {
        pages.unshift(pages[0] - 1);
      }
      
      // If we have room for more pages at the end, add them
      while (pages.length < maxVisiblePages && pages[pages.length - 1] < this.totalPages) {
        pages.push(pages[pages.length - 1] + 1);
      }
    }
    
    return pages;
  }
}
