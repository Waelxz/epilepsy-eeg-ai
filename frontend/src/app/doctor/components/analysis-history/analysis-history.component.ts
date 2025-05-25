import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AnalysisService, Analysis, PaginatedAnalysisResponse } from '../../../shared/services/analysis.service';
import { PatientService } from '../../../shared/services/patient.service';

@Component({
  selector: 'app-analysis-history',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './analysis-history.component.html',
  styleUrl: './analysis-history.component.css'
})
export class AnalysisHistoryComponent implements OnInit {
  analyses: Analysis[] = []; // Displayed analyses (filtered and paginated)
  allLoadedAnalyses: Analysis[] = []; // All analyses loaded from server (before filtering)
  filteredAnalyses: Analysis[] = []; // Analyses after filtering but before pagination
  loading = false;
  error: string | null = null;
  Math = Math; // Expose Math for template usage
  
  // Pagination
  currentPage = 1;
  totalPages = 1;
  pageSize = 10;
  totalCount = 0;
  
  // Filtering
  statusFilter: string = '';
  searchTerm: string = '';
  modelFilter: string = '';
  resultFilter: 'all' | 'normal' | 'abnormal' | 'pending' = 'all';
  
  // Sorting
  sortOption: string = 'recent';
  sortField: string = 'uploadDate';
  sortDirection: 'asc' | 'desc' = 'desc';

  // Track patient names
  patientNames: { [key: string]: string } = {};

  constructor(
    private analysisService: AnalysisService,
    private patientService: PatientService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadAnalyses();
  }

  loadAnalyses(): void {
    this.loading = true;
    this.error = null;
    
    const params: any = {
      page: this.currentPage,
      limit: this.pageSize
    };
    
    // Only apply these filters on server-side
    if (this.statusFilter) params.status = this.statusFilter;
    if (this.modelFilter) params.modelUsed = this.modelFilter;
    
    // Apply search term only if it's substantial (more than 2 characters)
    if (this.searchTerm && this.searchTerm.trim().length > 2) {
      params.search = this.searchTerm.trim();
    }
    
    console.log('Sending API request with params:', params);
    
    this.analysisService.getAnalyses(params).subscribe({
      next: (response: PaginatedAnalysisResponse) => {
        this.totalCount = response.metadata.total_count;
        this.totalPages = response.metadata.total_pages;
        
        // Store all loaded analyses before filtering
        this.allLoadedAnalyses = [...response.items];
        console.log(`Loaded ${this.allLoadedAnalyses.length} analyses from server`);
        
        // Apply client-side filtering and pagination
        this.applyFiltersAndPaginate();
        
        this.loading = false;
        
        // Fetch patient names for all analyses
        this.fetchPatientNames();
      },
      error: (err) => {
        console.error('Error loading analyses:', err);
        this.error = err.message || 'Failed to load analyses';
        this.loading = false;
      }
    });
  }
  
  // Apply client-side filters and pagination
  applyFiltersAndPaginate(): void {
    console.log('Applying filters, starting with', this.allLoadedAnalyses.length, 'analyses');
    console.log('Current resultFilter:', this.resultFilter);
    
    // First apply all filters
    this.applyFilters();
    
    // Then apply pagination to the filtered results
    this.applyPagination();
  }
  
  // Apply client-side filters
  applyFilters(): void {
    // Start with all loaded analyses
    let filtered = [...this.allLoadedAnalyses];
    
    // Apply client-side search filter 
    // (in case we want to search after loading or the backend search isn't working well)
    if (this.searchTerm && this.searchTerm.trim().length > 0) {
      const searchLower = this.searchTerm.trim().toLowerCase();
      
      filtered = filtered.filter(analysis => {
        // Search in various fields
        return (
          (analysis.fileName && analysis.fileName.toLowerCase().includes(searchLower)) ||
          (analysis.patientId && analysis.patientId.toString().toLowerCase().includes(searchLower)) ||
          (analysis.modelUsed && analysis.modelUsed.toLowerCase().includes(searchLower)) ||
          (this.patientNames[analysis.patientId] && 
            this.patientNames[analysis.patientId].toLowerCase().includes(searchLower))
        );
      });
      
      console.log(`After search filter '${searchLower}':`, filtered.length, 'analyses');
    }
    
    // Apply result filter if not 'all'
    if (this.resultFilter !== 'all') {
      console.log('Applying result filter:', this.resultFilter);
      
      switch (this.resultFilter) {
        case 'normal':
          filtered = filtered.filter(a => 
            a.status === 'completed' && a.result && a.result.class === 1
          );
          break;
          
        case 'abnormal':
          filtered = filtered.filter(a => 
            a.status === 'completed' && a.result && a.result.class === 0
          );
          break;
          
        case 'pending':
          filtered = filtered.filter(a => 
            a.status === 'queued' || a.status === 'processing'
          );
          break;
      }
      
      console.log('After result filter:', filtered.length, 'analyses');
    }
    
    // Apply client-side sorting
    this.sortAnalyses(filtered);
    
    // Store the filtered results
    this.filteredAnalyses = filtered;
    
    // Update pagination based on filtered results
    this.updatePaginationData();
  }
  
  // Apply pagination to the filtered results
  applyPagination(): void {
    // Calculate start and end indices
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = Math.min(startIndex + this.pageSize, this.filteredAnalyses.length);
    
    // If there are no filtered analyses, show empty results
    if (this.filteredAnalyses.length === 0) {
      this.analyses = [];
      return;
    }
    
    // Make sure we don't try to access invalid indices
    if (startIndex >= this.filteredAnalyses.length) {
      // If the current page is now invalid (e.g., after filtering reduced items)
      this.currentPage = 1;
      this.applyPagination(); // Retry with page 1
      return;
    }
    
    // Slice the array to get current page items
    this.analyses = this.filteredAnalyses.slice(startIndex, endIndex);
    console.log(`Pagination applied: showing ${this.analyses.length} of ${this.filteredAnalyses.length} filtered analyses`);
  }
  
  // Update pagination data based on filtered results
  updatePaginationData(): void {
    this.totalCount = this.filteredAnalyses.length;
    this.totalPages = Math.max(1, Math.ceil(this.totalCount / this.pageSize));
    
    // If current page is beyond available pages, reset to page 1
    if (this.currentPage > this.totalPages) {
      this.currentPage = 1;
    }
  }
  
  fetchPatientNames(): void {
    // Get unique patient IDs from loaded analyses
    const patientIds = [...new Set(this.allLoadedAnalyses.map(a => a.patientId))];
    
    // Fetch patient details for each unique ID
    patientIds.forEach(id => {
      if (!this.patientNames[id]) {
        this.patientService.getPatientById(id).subscribe({
          next: (patient) => {
            this.patientNames[id] = `${patient.firstName} ${patient.lastName}`;
            
            // Re-apply filters after getting patient names
            // This helps if filtering by patient name
            this.applyFiltersAndPaginate();
          },
          error: (err) => {
            console.error(`Failed to load patient name for ID ${id}`, err);
            this.patientNames[id] = 'Unknown Patient';
          }
        });
      }
    });
  }

  onSearch(): void {
    // Reset to first page when searching
    this.currentPage = 1;
    
    // For shorter search terms (client-side search)
    if (this.searchTerm && this.searchTerm.trim().length <= 2) {
      console.log('Performing client-side search');
      this.applyFiltersAndPaginate();
    } else {
      // For longer search terms or clearing search, reload from server
      console.log('Performing server-side search');
      this.loadAnalyses();
    }
  }
  
  // Apply sort when the sort option changes
  applySortFilter(): void {
    // Just resort the current filtered analyses and re-paginate
    this.sortAnalyses(this.filteredAnalyses);
    this.applyPagination();
  }
  
  // Client-side sorting of analyses
  sortAnalyses(analyses: Analysis[]): void {
    switch (this.sortOption) {
      case 'recent':
        analyses.sort((a, b) => this.compareDates(b.uploadDate, a.uploadDate));
        break;
        
      case 'oldest':
        analyses.sort((a, b) => this.compareDates(a.uploadDate, b.uploadDate));
        break;
        
      case 'filename-asc':
        analyses.sort((a, b) => (a.fileName || '').localeCompare(b.fileName || ''));
        break;
        
      case 'filename-desc':
        analyses.sort((a, b) => (b.fileName || '').localeCompare(a.fileName || ''));
        break;
        
      case 'status-asc':
        analyses.sort((a, b) => (a.status || '').localeCompare(b.status || ''));
        break;
        
      case 'status-desc':
        analyses.sort((a, b) => (b.status || '').localeCompare(a.status || ''));
        break;
    }
  }
  
  // Helper method to compare dates
  private compareDates(dateA: Date | string | undefined, dateB: Date | string | undefined): number {
    if (!dateA && !dateB) return 0;
    if (!dateA) return -1;
    if (!dateB) return 1;
    
    const timeA = typeof dateA === 'string' ? new Date(dateA).getTime() : dateA.getTime();
    const timeB = typeof dateB === 'string' ? new Date(dateB).getTime() : dateB.getTime();
    
    return timeA - timeB;
  }
  
  // Filter analyses by result type
  filterByResult(filter: 'all' | 'normal' | 'abnormal' | 'pending'): void {
    this.resultFilter = filter;
    this.currentPage = 1; // Reset to first page
    // Apply filters client-side
    this.applyFiltersAndPaginate();
  }
  
  // Get status label based on analysis result
  getStatusLabel(analysis: Analysis): string {
    if (analysis.status === 'completed' && analysis.result) {
      return this.analysisService.getClassificationLabel(analysis.result);
    }
    return 'Unknown';
  }
  
  // Get technical classification label
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
  
  // Clear all filters and reset to defaults
  clearFilters(): void {
    this.searchTerm = '';
    this.statusFilter = '';
    this.modelFilter = '';
    this.resultFilter = 'all';
    this.sortOption = 'recent';
    this.currentPage = 1;
    this.loadAnalyses();
  }
  
  onPageChange(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    
    // If we have enough data loaded already, just apply pagination
    // without reloading from server
    this.applyPagination();
  }
  
  // Get array of page numbers for pagination
  getPages(): number[] {
    const pages = [];
    const maxPagesToShow = 5;
    
    if (this.totalPages <= maxPagesToShow) {
      // Show all pages if there are only a few
      for (let i = 1; i <= this.totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Calculate range to show
      let startPage = Math.max(1, this.currentPage - 2);
      let endPage = Math.min(this.totalPages, startPage + maxPagesToShow - 1);
      
      // Adjust if we're near the end
      if (endPage - startPage < maxPagesToShow - 1) {
        startPage = Math.max(1, endPage - maxPagesToShow + 1);
      }
      
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
    }
    
    return pages;
  }
  
  formatDate(date: Date | string | undefined): string {
    if (!date) return 'N/A';
    const dateObj = new Date(date);
    // Format: Jul 23, 2023 14:30
    return dateObj.toLocaleDateString('en-US', { 
      month: 'short', 
      day: '2-digit', 
      year: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit'
    });
  }
  
  formatFileSize(size: number | undefined): string {
    if (size === undefined) return 'N/A';
    return this.analysisService.formatFileSize(size);
  }
  
  getStatusClass(status: string | undefined): string {
    if (!status) return '';
    
    switch (status) {
      case 'completed': return 'status-completed';
      case 'processing': return 'status-processing';
      case 'queued': return 'status-queued';
      case 'failed': return 'status-failed';
      default: return '';
    }
  }
  
  viewAnalysisDetails(analysis: Analysis): void {
    // Store the analysis in the service for overlay/detail components
    this.analysisService.setActiveAnalysis(analysis);
    
    // Navigate to the analysis details page
    if (analysis.id) {
      this.router.navigate(['/doctor/analysis', analysis.id]);
    }
  }

  // Navigate to patient details page
  viewPatientDetails(patientId: string): void {
    if (patientId) {
      this.router.navigate(['/doctor/patients', patientId]);
    }
  }
}
