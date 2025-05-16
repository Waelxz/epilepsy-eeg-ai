import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule, HttpHeaders } from '@angular/common/http';
import { LogsService, Log, PaginationMetadata } from '../../../shared/services/logs.service';
import { AuthService } from '../../../auth/auth.service';
import { HttpClient } from '@angular/common/http';
import { UserService } from '../../../shared/services/user.service';
import { AppSettingsService } from '../../../shared/services/app-settings.service';

@Component({
  selector: 'app-doctor-logs',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, HttpClientModule],
  providers: [LogsService, AuthService, UserService],
  templateUrl: './doctor-logs.component.html',
  styleUrls: ['./doctor-logs.component.css']
})
export class DoctorLogsComponent implements OnInit {
  logs: Log[] = [];
  filteredLogs: Log[] = [];
  isLoading = true;
  errorMessage: string = '';
  selectedAction: string = '';
  startDate: string = '';
  endDate: string = '';
  searchTerm: string = '';
  selectedTargetAccount: string = '';
  doctorSearchTerm: string = '';
  actionTypes: string[] = [];
  allDoctors: string[] = [];
  targetAccounts: string[] = [];
  filteredTargetAccounts: string[] = [];
  showLogDetails: boolean = false;
  selectedLog: Log | null = null;
  showDoctorDropdown: boolean = false;
  
  // Pagination properties
  pagination: PaginationMetadata | null = null;
  currentPage: number = 1;
  pageSize: number = 10;
  pageSizeOptions: number[] = [5, 10, 25, 50];
  
  // Add properties to track all logs across pages
  allLogs: Log[] = [];
  isLoadingAllLogs = false;
  
  private searchDebounceTimer: any;
  
  constructor(
    private logsService: LogsService,
    private authService: AuthService,
    private http: HttpClient,
    private userService: UserService,
    private appSettingsService: AppSettingsService
  ) {
    // Add document click handler to close dropdown when clicking outside
    document.addEventListener('click', (event: MouseEvent) => {
      // If dropdown is open and click is outside the dropdown
      if (this.showDoctorDropdown) {
        const target = event.target as HTMLElement;
        // Check if the click is not within the doctor search or dropdown
        if (!target.closest('#doctorSearch') && 
            !target.closest('.doctor-dropdown') &&
            !target.closest('.doctor-search-container')) {
          this.showDoctorDropdown = false;
        }
      }
    });
  }
  
  ngOnInit(): void {
    // Check for unsaved settings changes
    if (this.appSettingsService.hasUnsavedChanges()) {
      // Revert any unsaved settings
      this.appSettingsService.revertToSavedSettings();
    }

    this.loadActionTypes();
    this.loadAllDoctors();
    this.loadLogs();
    this.loadAllLogsForSearch();
  }
  
  loadActionTypes(): void {
    this.logsService.getLogActionTypes().subscribe({
      next: (types: string[]) => {
        // Filter to doctor-relevant actions
        const doctorRelevantActions = [
          'create_doctor',
          'update_doctor',
          'delete_doctor',
          'doctor_password_change',
          'doctor_permissions_update',
          'login',
          'logout'
        ];
        
        // Get the exact action types from the API that match our doctor-relevant actions
        this.actionTypes = types.filter(type => 
          doctorRelevantActions.includes(type.toLowerCase())
        );
        
        console.log('Filtered action types:', this.actionTypes);
      },
      error: (error: any) => {
        console.error('Error loading log action types:', error);
      }
    });
  }
  
  // Load doctors from the API instead of extracting from logs
  loadAllDoctors(): void {
    this.userService.getUsers('doctor').subscribe({
      next: (doctors: any[]) => {
        // Create a list of doctor usernames for the dropdown
        this.allDoctors = doctors.map(doctor => doctor.username)
          .filter(username => username !== undefined && username !== null && username !== '');
        
        // Sort alphabetically
        this.allDoctors.sort();
        
        // Initialize the filtered list
        this.filteredTargetAccounts = [...this.allDoctors];
        
        console.log('Loaded doctors from API:', this.allDoctors);
      },
      error: (error: any) => {
        console.error('Error loading doctors:', error);
      }
    });
  }
  
  // Load all logs without pagination for comprehensive search
  loadAllLogsForSearch(): void {
    this.isLoadingAllLogs = true;
    
    // Create a filters object without pagination but with current action/date filters
    const filters: any = {
      limit: 1000 // Request maximum allowed logs (backend limit is 1000)
    };
    
    // Apply any active action filter
    if (this.selectedAction && this.selectedAction.trim() !== '') {
      filters.action_type = this.selectedAction.trim();
    }
    
    // Apply username filter if set
    if (this.selectedTargetAccount && this.selectedTargetAccount.trim() !== '') {
      filters.target_username = this.selectedTargetAccount.trim();
    }
    
    // Apply search filter if set
    if (this.searchTerm && this.searchTerm.trim() !== '') {
      filters.search = this.searchTerm.trim();
      console.log('Adding search term to loadAllLogsForSearch:', filters.search);
    }
    
    // SIMPLIFIED DATE FILTER IMPLEMENTATION
    if (this.startDate) {
      filters.start_date = this.startDate;
    }
    
    if (this.endDate) {
      filters.end_date = this.endDate;
    }
    
    this.logsService.getLogs(filters).subscribe({
      next: (response) => {
        this.allLogs = response.items;
        
        // Apply client-side date filtering if date filters are set
        if (this.startDate || this.endDate) {
          console.log('Applying client-side date filtering to allLogs as fallback...');
          this.allLogs = this.applyClientSideDateFilters(this.allLogs);
        }
        
        this.isLoadingAllLogs = false;
        console.log(`Loaded ${this.allLogs.length} total logs for search (based on current filters)`);
      },
      error: (error) => {
        console.error('Error loading all logs for search:', error);
        this.isLoadingAllLogs = false;
      }
    });
  }
  
  loadLogs(): void {
    this.isLoading = true;
    this.errorMessage = '';
    const filters = this.getFilters();
    
    console.log('DEBUG: Calling API with filters:', filters);
    
    this.logsService.getLogs(filters).subscribe({
      next: (response) => {
        this.logs = response.items;
        console.log(`Received ${this.logs.length} logs from server with action types:`, 
          [...new Set(this.logs.map(log => log.action))]);
        
        this.pagination = response.metadata;
        this.currentPage = this.pagination.current_page;
        this.pageSize = this.pagination.page_size;
        
        // Apply client-side date filtering if date filters are set
        // This is needed because the backend date filtering doesn't seem to be working
        if (this.startDate || this.endDate) {
          console.log('Applying client-side date filtering as fallback...');
          this.logs = this.applyClientSideDateFilters(this.logs);
          console.log(`After client-side date filtering: ${this.logs.length} logs remaining`);
        }
        
        // Skip client-side filtering when any server-side filtering is applied
        // (action filter, target username filter, or search term)
        if ((this.selectedAction && this.selectedAction.trim() !== '') || 
            (this.selectedTargetAccount && this.selectedTargetAccount.trim() !== '') ||
            (this.searchTerm && this.searchTerm.trim() !== '')) {
          console.log('Using server-side filtered results directly');
          this.filteredLogs = [...this.logs];
        } else {
          // Only apply client-side filters when we don't have server-side filters
          console.log('Applying client-side filters');
          this.applyClientSideFilters();
        }
        
        console.log(`Final filtered logs count: ${this.filteredLogs.length}`);
        
        this.isLoading = false;
        
        if (this.logs.length === 0 && (this.selectedAction || this.startDate || this.endDate || this.selectedTargetAccount || this.searchTerm)) {
          this.errorMessage = 'No logs found matching your filters. Try adjusting your search criteria.';
        }
      },
      error: (error: any) => {
        this.errorMessage = 'Failed to load logs. Please try again.';
        this.isLoading = false;
        console.error('Error loading logs:', error);
        if (error.error && error.error.detail) {
          console.error('Server error details:', error.error.detail);
        }
        // Log request details for debugging
        console.error('Request was made with filters:', filters);
      }
    });
  }
  
  // Apply client-side filters (search term and doctor filter)
  applyClientSideFilters(): void {
    console.log('Applying client-side filters');
    // Start with logs from the API
    this.filteredLogs = [...this.logs];
    console.log(`Starting with ${this.filteredLogs.length} logs`);
    
    // Apply target account filter if selected
    if (this.selectedTargetAccount) {
      const beforeCount = this.filteredLogs.length;
      this.filteredLogs = this.filteredLogs.filter(log => {
        const targetName = this.getTargetName(log);
        // Match against username - case insensitive match
        return targetName.toLowerCase() === this.selectedTargetAccount.toLowerCase();
      });
      console.log(`After target account filter: ${beforeCount} → ${this.filteredLogs.length} logs`);
    }
    
    // Apply search term if provided
    if (this.searchTerm && this.searchTerm.trim() !== '') {
      const search = this.searchTerm.toLowerCase().trim();
      const beforeCount = this.filteredLogs.length;
      
      // Use all logs for search, then reload the paginated view with search results
      if (this.allLogs.length > 0) {
        // Search across all logs
        const matchedLogIds = this.allLogs
          .filter(log => 
            (log.description && log.description.toLowerCase().includes(search)) ||
            (log.username && log.username.toLowerCase().includes(search)) ||
            (this.getTargetName(log).toLowerCase().includes(search)) ||
            (this.getActionDisplayName(log.action).toLowerCase().includes(search)) ||
            (this.getShortDescription(log).toLowerCase().includes(search))
          )
          .map(log => log.id);
        
        // Filter current page logs to only include logs that matched the search
        this.filteredLogs = this.filteredLogs.filter(log => matchedLogIds.includes(log.id));
        console.log(`After search term filter using allLogs: ${beforeCount} → ${this.filteredLogs.length} logs`);
      } else {
        // Fallback to filtering only current page if all logs aren't loaded yet
        this.filteredLogs = this.filteredLogs.filter(log => {
          return (
            (log.description && log.description.toLowerCase().includes(search)) ||
            (log.username && log.username.toLowerCase().includes(search)) ||
            (this.getTargetName(log).toLowerCase().includes(search)) ||
            (this.getActionDisplayName(log.action).toLowerCase().includes(search)) ||
            (this.getShortDescription(log).toLowerCase().includes(search))
          );
        });
        console.log(`After search term filter using current page: ${beforeCount} → ${this.filteredLogs.length} logs`);
      }
    }
    
    console.log(`Final filtered logs count: ${this.filteredLogs.length}`);
  }
  
  getFilters(): any {
    const filters: any = {
      page: this.currentPage,
      limit: this.pageSize
    };
    
    // Add server-side filters
    if (this.selectedAction && this.selectedAction.trim() !== '') {
      // Preserve the original case, don't convert to lowercase
      filters.action_type = this.selectedAction.trim();
      console.log('Setting action filter:', filters.action_type);
    }
    
    // Add username filter to server-side filtering
    if (this.selectedTargetAccount && this.selectedTargetAccount.trim() !== '') {
      filters.target_username = this.selectedTargetAccount.trim();
      console.log('Setting target username filter:', filters.target_username);
    }
    
    // IMPROVED DATE FILTER IMPLEMENTATION
    if (this.startDate) {
      try {
        // Format as ISO date with time component
        const [year, month, day] = this.startDate.split('-').map(Number);
        const dateObj = new Date(year, month - 1, day, 0, 0, 0, 0);
        filters.start_date = dateObj.toISOString();
        console.log('Setting start_date filter:', filters.start_date, '(from input:', this.startDate, ')');
      } catch (error) {
        console.error('Error formatting start date:', error);
        // Fallback to raw date string
        filters.start_date = this.startDate;
      }
    }
    
    if (this.endDate) {
      try {
        // Format as ISO date with time component (end of day)
        const [year, month, day] = this.endDate.split('-').map(Number);
        const dateObj = new Date(year, month - 1, day, 23, 59, 59, 999);
        filters.end_date = dateObj.toISOString();
        console.log('Setting end_date filter:', filters.end_date, '(from input:', this.endDate, ')');
      } catch (error) {
        console.error('Error formatting end date:', error);
        // Fallback to raw date string
        filters.end_date = this.endDate;
      }
    }
    
    // Add search term to server-side filtering (ensuring it's properly set)
    if (this.searchTerm && this.searchTerm.trim() !== '') {
      filters.search = this.searchTerm.trim();
      console.log('Setting search filter:', filters.search);
    } else {
      // Make sure we don't have a lingering search parameter
      if ('search' in filters) {
        delete filters.search;
      }
    }
    
    console.log('Using filters for API:', filters);
    return filters;
  }
  
  applyFilters(): void {
    // Log the current filters
    console.log('Applying filters with:', {
      action: this.selectedAction,
      targetAccount: this.selectedTargetAccount,
      startDate: this.startDate,
      endDate: this.endDate,
      searchTerm: this.searchTerm
    });
    
    // Reset to first page when applying filters
    this.currentPage = 1; 
    
    // Call API to get logs with the current filters
    console.log('About to call loadLogs with server-side filtering');
    this.loadLogs();
    
    // Also refresh the all logs cache with the new filters
    console.log('About to refresh allLogs cache with the same filters');
    this.loadAllLogsForSearch();
    
    // Debug output
    console.log('Apply Filters - searchTerm:', this.searchTerm);
  }
  
  // Debug method to show current filters
  debugCurrentFilters(): void {
    console.log('Current Filters Debug:');
    console.log('- selectedAction:', this.selectedAction);
    console.log('- startDate:', this.startDate);
    console.log('- endDate:', this.endDate);
    console.log('- searchTerm:', this.searchTerm);
    console.log('- selectedTargetAccount:', this.selectedTargetAccount);
    
    // Show what filters would be sent to API
    const filters = this.getFilters();
    console.log('API Filters:', filters);
  }
  
  clearSearch(): void {
    this.searchTerm = '';
    this.currentPage = 1; // Reset to first page
    this.loadLogs(); // Reload logs without the search term
    this.loadAllLogsForSearch(); // Refresh all logs cache
  }
  
  resetFilters(): void {
    this.selectedAction = '';
    this.selectedTargetAccount = '';
    this.doctorSearchTerm = '';
    this.searchTerm = '';
    this.startDate = '';
    this.endDate = '';
    this.showDoctorDropdown = false;
    this.currentPage = 1;
    this.loadLogs();
    // Also refresh all logs cache with no filters
    this.loadAllLogsForSearch();
  }
  
  // Pagination Methods
  goToPage(page: number): void {
    if (this.pagination && page >= 1 && page <= this.pagination.total_pages) {
      this.currentPage = page;
      this.loadLogs();
    }
  }
  
  previousPage(): void {
    if (this.pagination?.has_previous) {
      this.goToPage(this.currentPage - 1);
    }
  }
  
  nextPage(): void {
    if (this.pagination?.has_next) {
      this.goToPage(this.currentPage + 1);
    }
  }
  
  firstPage(): void {
    this.goToPage(1);
  }
  
  lastPage(): void {
    if (this.pagination) {
      this.goToPage(this.pagination.total_pages);
    }
  }
  
  changePageSize(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    this.pageSize = parseInt(selectElement.value, 10);
    this.currentPage = 1; // Reset to first page when changing page size
    this.loadLogs();
  }
  
  // Generate an array of page numbers for pagination controls
  getPageNumbers(): number[] {
    if (!this.pagination) return [];
    
    const totalPages = this.pagination.total_pages;
    const currentPage = this.pagination.current_page;
    
    // Always include first and last page
    const pages = new Set<number>([1, totalPages]);
    
    // Include current page and 1 page before and after
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      pages.add(i);
    }
    
    // Add ellipsis indicators (represented as -1) when needed
    const pagesArray = Array.from(pages).sort((a, b) => a - b);
    const result: number[] = [];
    
    for (let i = 0; i < pagesArray.length; i++) {
      if (i > 0 && pagesArray[i] - pagesArray[i-1] > 1) {
        result.push(-1); // Add ellipsis indicator
      }
      result.push(pagesArray[i]);
    }
    
    return result;
  }
  
  // Add comprehensive date filter debug method
  debugShowAllLogs(): void {
    console.log('Current logs in component:', this.logs);
    
    // Make a direct API call with no filters
    const options = {
      headers: new HttpHeaders({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authService.getToken()}`
      })
    };
    
    // Fetch logs directly from API for debugging
    this.http.get<any[]>('http://localhost:8000/api/logs', options).subscribe({
      next: (data: any[]) => {
        console.log('All logs from API (debug):', data);
        console.log('Log count:', data.length);
        console.log('Action types:', [...new Set(data.map((log: any) => log.action))]);
        
        // Additional date checking if date filters are active
        if (this.startDate || this.endDate) {
          console.log('Checking logs against current date filters:');
          console.log('- startDate:', this.startDate);
          console.log('- endDate:', this.endDate);
          
          // Convert to date objects for comparison
          const startDateObj = this.startDate ? new Date(this.startDate) : null;
          const endDateObj = this.endDate ? new Date(this.endDate) : null;
          
          // End date should be at the end of the day (23:59:59)
          if (endDateObj) {
            endDateObj.setHours(23, 59, 59, 999);
          }
          
          // Count logs that would match the current date filters
          const matchingLogs = data.filter((log: any) => {
            const logDate = new Date(log.timestamp);
            let matches = true;
            
            // Check start date
            if (startDateObj && logDate < startDateObj) {
              matches = false;
            }
            
            // Check end date
            if (endDateObj && logDate > endDateObj) {
              matches = false;
            }
            
            return matches;
          });
          
          console.log(`Found ${matchingLogs.length} logs matching current date filters (client-side)`);
          
          // Get date range of matching logs
          if (matchingLogs.length > 0) {
            const dates = matchingLogs.map((log: any) => new Date(log.timestamp));
            const minDate = new Date(Math.min(...dates.map((d: Date) => d.getTime())));
            const maxDate = new Date(Math.max(...dates.map((d: Date) => d.getTime())));
            
            console.log('Date range of matching logs:');
            console.log('- Earliest log:', minDate.toISOString());
            console.log('- Latest log:', maxDate.toISOString());
          }
          
          // Now test an API call with explicit date filters
          this.testApiDateFilters();
        }
      },
      error: (error: any) => {
        console.error('Debug fetch error:', error);
      }
    });
  }
  
  // Test API date filters directly
  testApiDateFilters(): void {
    if (!this.startDate && !this.endDate) {
      console.log('No date filters to test');
      return;
    }
    
    const baseUrl = 'http://localhost:8000/api/logs';
    const params: Record<string, string> = { limit: '10' };
    
    if (this.startDate) {
      params['start_date'] = this.startDate;
    }
    
    if (this.endDate) {
      params['end_date'] = this.endDate;
    }
    
    // Construct URL with query parameters
    const queryString = Object.entries(params)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
    
    const url = `${baseUrl}?${queryString}`;
    
    console.log('Testing API date filters with URL:', url);
    
    // Make the API call with the date filters
    const options = {
      headers: new HttpHeaders({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authService.getToken()}`
      })
    };
    
    this.http.get<any>(url, options).subscribe({
      next: (response: any) => {
        if (response.items && Array.isArray(response.items)) {
          console.log(`API returned ${response.items.length} logs with date filters`);
          
          // Show the date range of the returned logs
          if (response.items.length > 0) {
            const dates = response.items.map((log: any) => new Date(log.timestamp));
            const minDate = new Date(Math.min(...dates.map((d: Date) => d.getTime())));
            const maxDate = new Date(Math.max(...dates.map((d: Date) => d.getTime())));
            
            console.log('Date range of API results:');
            console.log('- Earliest log:', minDate.toISOString());
            console.log('- Latest log:', maxDate.toISOString());
          }
        } else {
          console.error('Unexpected API response format:', response);
        }
      },
      error: (error: any) => {
        console.error('API date filter test error:', error);
      }
    });
  }
  
  // Function to format dates for display
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString();
  }
  
  // View log details
  viewLogDetails(log: Log): void {
    this.selectedLog = log;
    this.showLogDetails = true;
  }
  
  // Close log details modal
  closeLogDetails(): void {
    this.showLogDetails = false;
    this.selectedLog = null;
  }
  
  // Function to get action type as display-friendly text
  getActionDisplayName(action: string): string {
    // Special handling for doctor-specific actions
    switch (action) {
      case 'create_doctor':
        return 'Create Doctor';
      case 'update_doctor':
        return 'Update Doctor';
      case 'delete_doctor':
        return 'Delete Doctor';
      case 'doctor_password_change':
        return 'Reset Password';
      case 'doctor_permissions_update':
        return 'Update Permissions';
      case 'login':
        return 'Login';
      case 'logout':
        return 'Logout';
      default:
        // Default handling for other actions
        // Convert snake_case to Title Case with spaces
        return action
          .split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
    }
  }
  
  // Function to get CSS class for action type
  getActionClass(action: string, details?: any): string {
    // For login actions, check if it failed
    if (action === 'login') {
      const isLoginFailed = details?.success === false || 
                           (details === undefined && this.selectedLog?.details?.success === false);
      
      return isLoginFailed ? 'login-failed' : 'login-success';
    }
    
    // For other action types
    switch (action) {
      case 'create_user':
      case 'create_doctor':
        return 'create';
      
      case 'update_user':
      case 'update_doctor':
      case 'update_permissions':
      case 'doctor_permissions_update':
      case 'password_change':
      case 'doctor_password_change':
        return 'update';
      
      case 'delete_user':
      case 'delete_doctor':
        return 'delete';
      
      case 'logout':
        return 'logout';
      
      default:
        return 'default';
    }
  }

  // Function to check if a log represents an action by an anonymized technician
  isAnonymizedTechnician(log: Log): boolean {
    return log.username === 'Another Technician' || 
           log.description?.includes('Another Technician');
  }

  // Extract the name of the actor who performed the action
  getActorName(log: Log): string {
    if (this.isAnonymizedTechnician(log)) {
      return 'Another Technician';
    }
    return log.username || 'System';
  }

  // Extract the name of the target account affected by the action
  getTargetName(log: Log): string {
    // Try to extract from details first
    const details = log.details || {};
    
    // For doctor-related actions, prioritize username
    if (details.target_user) {
      return details.target_user;
    }
    if (details.created_user) {
      return details.created_user;
    }
    if (details.deleted_user) {
      return details.deleted_user;
    }
    
    // For login/logout events, the username is the target
    if (log.action === 'login' || log.action === 'logout') {
      return log.username || 'Unknown';
    }

    // Fall back to parsing the description for common patterns
    const description = log.description || '';
    
    // Look for pattern: "updated NAME" or "created NAME"
    const updateMatch = description.match(/updated\s+(\w+)/);
    if (updateMatch) return updateMatch[1];
    
    const createMatch = description.match(/created\s+user\s+(\w+)/);
    if (createMatch) return createMatch[1];
    
    const deleteMatch = description.match(/deleted\s+(\w+)/);
    if (deleteMatch) return deleteMatch[1];
    
    return 'N/A';
  }

  // Create a shorter, clearer description of the action
  getShortDescription(log: Log): string {
    const action = log.action || '';
    const details = log.details || {};
    const targetUser = this.getTargetName(log);
    const targetName = details.target_name || '';
    
    // Check for login status in details and description
    const isLoginFailed = details.success === false || 
                         log.description?.toLowerCase().includes('fail') || 
                         log.description?.toLowerCase().includes('invalid') ||
                         log.description?.toLowerCase().includes('disabled');
    
    // Generate narrative descriptions based on action type
    switch (action) {
      // Authentication actions
      case 'login':
        if (isLoginFailed) {
          const reason = details.reason || 'unknown';
          if (reason === 'incorrect_password') {
            return `Failed login - Incorrect password`;
          } else if (reason === 'account_disabled') {
            return `Failed login - Account disabled`;
          }
          return `Failed login attempt`;
        }
        return `Successful login`;
        
      case 'logout':
        return `User logged out`;
      
      // Doctor-specific actions
      case 'create_doctor':
        return `Created doctor account`;
        
      case 'update_doctor':
        const fields = details.updated_fields || [];
        const oldValues = details.old_values || {};
        const newValues = details.new_values || {};
        
        // Generate specific narratives based on updated fields
        if (fields.includes('is_active')) {
          const wasActivated = newValues.is_active === true;
          return wasActivated 
            ? `Activated account for Dr. ${targetName}`
            : `Deactivated account for Dr. ${targetName}`;
        }
        
        if (fields.includes('contact_info')) {
          return `Updated contact information`;
        }
        
        if (fields.includes('name') || fields.includes('lastname')) {
          return `Updated name for Dr. ${targetName}`;
        }
        
        return `Updated doctor account`;
      
      default:
        return `Action not specified`;
    }
  }
  
  // Simplified debug date filters method
  debugDateFilters(): void {
    console.log('Current date filters:');
    console.log('- startDate (raw):', this.startDate);
    console.log('- endDate (raw):', this.endDate);
    
    // Get the filters that would be sent to the API
    const filters = this.getFilters();
    console.log('Date filters that would be sent to API:', {
      start_date: filters.start_date,
      end_date: filters.end_date
    });
    
    // Test the date parsing to ensure it's working as expected
    if (this.startDate) {
      const startDateObj = new Date(this.startDate);
      console.log('Start date parsed:', startDateObj);
      console.log('Start date ISO:', startDateObj.toISOString());
      console.log('Start date at 00:00:00:', new Date(startDateObj.getFullYear(), startDateObj.getMonth(), startDateObj.getDate(), 0, 0, 0, 0).toISOString());
    }
    
    if (this.endDate) {
      const endDateObj = new Date(this.endDate);
      console.log('End date parsed:', endDateObj);
      console.log('End date ISO:', endDateObj.toISOString());
      console.log('End date at 23:59:59:', new Date(endDateObj.getFullYear(), endDateObj.getMonth(), endDateObj.getDate(), 23, 59, 59, 999).toISOString());
    }
    
    // Test if any logs exist in the current logs array before filtering
    console.log(`Current logs: ${this.logs.length}`);
    
    // Test filtering the current logs
    if (this.logs.length > 0) {
      const filteredLogsTest = this.applyClientSideDateFilters([...this.logs]);
      console.log(`Client-side filtered logs test: ${filteredLogsTest.length} logs match the date range out of ${this.logs.length}`);
      
      if (filteredLogsTest.length > 0) {
        console.log('Examples of logs matching the date filter:');
        filteredLogsTest.slice(0, 3).forEach((log, index) => {
          console.log(`Log ${index + 1}:`, {
            timestamp: log.timestamp,
            date: new Date(log.timestamp).toISOString(),
            action: log.action
          });
        });
      }
      
      if (filteredLogsTest.length < this.logs.length) {
        console.log('Examples of logs NOT matching the date filter:');
        const excludedLogs = this.logs.filter(log => !filteredLogsTest.includes(log));
        excludedLogs.slice(0, 3).forEach((log, index) => {
          const logDate = new Date(log.timestamp);
          const startDateObj = this.startDate ? new Date(this.startDate) : null;
          const endDateObj = this.endDate ? new Date(this.endDate) : null;
          const endDateWithTime = endDateObj ? new Date(endDateObj) : null;
          if (endDateWithTime) {
            endDateWithTime.setHours(23, 59, 59, 999);
          }
          
          const beforeStartDate = startDateObj && logDate < startDateObj;
          const afterEndDate = endDateWithTime && logDate > endDateWithTime;
          
          console.log(`Log ${index + 1}:`, {
            timestamp: log.timestamp,
            date: logDate.toISOString(),
            action: log.action,
            reason: beforeStartDate ? 'Before start date' : (afterEndDate ? 'After end date' : 'Unknown reason')
          });
        });
      }
    }
    
    // Make a test request with just the date filters
    const testFilters: Record<string, any> = {
      limit: 5
    };
    
    if (this.startDate) {
      testFilters['start_date'] = this.startDate;
    }
    
    if (this.endDate) {
      testFilters['end_date'] = this.endDate;
    }
    
    console.log('Testing date filter with:', testFilters);
    
    this.logsService.getLogs(testFilters).subscribe({
      next: (response) => {
        console.log('API date filter response:', response);
        console.log('Date filter test results:', {
          count: response.items.length,
          items: response.items.map((log: Log) => ({
            timestamp: log.timestamp,
            date: new Date(log.timestamp).toISOString(),
            action: log.action
          }))
        });
        
        // Also test client-side filtering on the API results
        if (response.items.length > 0) {
          const clientFiltered = this.applyClientSideDateFilters([...response.items]);
          console.log(`API results after client filtering: ${clientFiltered.length} of ${response.items.length} match date range`);
        }
      },
      error: (error) => {
        console.error('Date filter test error:', error);
      }
    });
  }
  
  // Simplified date change handler
  onDateChange(): void {
    console.log('Date changed - applying filters automatically');
    console.log('- startDate:', this.startDate);
    console.log('- endDate:', this.endDate);
    
    // Apply filters immediately when dates change
    this.applyFilters();
  }

  // Add methods required by the template
  onSearchInput(): void {
    clearTimeout(this.searchDebounceTimer);
    this.searchDebounceTimer = setTimeout(() => {
      this.applyFilters();
    }, 500); // 500ms debounce
  }

  debugSearch(): void {
    console.log('DEBUG Search:');
    console.log('- Current searchTerm:', this.searchTerm);
    console.log('- Search results count:', this.filteredLogs.length);
  }

  debugActionFilter(): void {
    console.log('DEBUG Action Filter:');
    console.log('- Available actions:', this.actionTypes);
    console.log('- Selected action:', this.selectedAction);
  }

  filterDoctors(): void {
    if (this.doctorSearchTerm) {
      const search = this.doctorSearchTerm.toLowerCase();
      this.filteredTargetAccounts = this.allDoctors.filter(
        doctor => doctor.toLowerCase().includes(search)
      );
    } else {
      this.filteredTargetAccounts = [...this.allDoctors];
    }
  }

  selectFirstDoctor(): void {
    if (this.filteredTargetAccounts.length > 0) {
      this.selectDoctor(this.filteredTargetAccounts[0]);
    }
  }

  clearDoctorFilter(): void {
    this.selectedTargetAccount = '';
    this.doctorSearchTerm = '';
    this.showDoctorDropdown = false;
    this.applyFilters();
  }

  selectDoctor(doctor: string): void {
    this.selectedTargetAccount = doctor;
    this.doctorSearchTerm = doctor;
    this.showDoctorDropdown = false;
    this.applyFilters();
  }

  exportActivityLogs(): void {
    console.log('Export functionality not implemented yet');
    // Example implementation could download logs as CSV
    alert('Export functionality is not implemented yet');
  }

  hasDetails(log: Log): boolean {
    const details = log.details || {};
    return Object.keys(details).length > 0;
  }

  formatFieldName(field: string): string {
    // Convert snake_case to Title Case with spaces
    return field
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  formatPermissionName(permission: string): string {
    // Convert permission names to more readable format
    return permission
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  formatValues(values: any): string {
    // Format object values for display
    if (!values || typeof values !== 'object') {
      return String(values);
    }
    
    // Safely convert the values to a formatted string
    try {
      return JSON.stringify(values, null, 2);
    } catch (error) {
      return String(values);
    }
  }

  // Apply client-side date filtering
  applyClientSideDateFilters(logs: Log[]): Log[] {
    if (!this.startDate && !this.endDate) {
      return logs;
    }

    console.log(`Filtering ${logs.length} logs by date...`);
    
    // Convert date strings to Date objects with timezone handling
    let startDateObj: Date | null = null;
    let endDateObj: Date | null = null;
    
    if (this.startDate) {
      // Create a date at start of day in local timezone
      const [year, month, day] = this.startDate.split('-').map(Number);
      startDateObj = new Date(year, month - 1, day, 0, 0, 0, 0);
      console.log(`Start date filter: ${startDateObj.toISOString()} (from input: ${this.startDate})`);
    }
    
    if (this.endDate) {
      // Create a date at end of day in local timezone
      const [year, month, day] = this.endDate.split('-').map(Number);
      endDateObj = new Date(year, month - 1, day, 23, 59, 59, 999);
      console.log(`End date filter: ${endDateObj.toISOString()} (from input: ${this.endDate})`);
    }
    
    // Check if we have valid date objects
    if ((this.startDate && !startDateObj) || (this.endDate && !endDateObj)) {
      console.error('Failed to parse date inputs:', { 
        startDate: this.startDate,
        endDate: this.endDate,
        parsedStart: startDateObj,
        parsedEnd: endDateObj
      });
      return logs; // Return unfiltered logs if date parsing fails
    }
    
    // Store original count for logging
    const originalCount = logs.length;
    
    // Filter logs by date
    const filteredLogs = logs.filter(log => {
      // Skip filtering if the log doesn't have a timestamp
      if (!log.timestamp) {
        console.warn('Log missing timestamp:', log);
        return true; // Include logs without timestamps
      }
      
      try {
        // Parse the log's timestamp
        const logDate = new Date(log.timestamp);
        
        // Check if the log date is valid
        if (isNaN(logDate.getTime())) {
          console.warn('Invalid log date:', log.timestamp);
          return true; // Include logs with invalid dates
        }
        
        // Check against start date
        if (startDateObj && logDate < startDateObj) {
          return false; // Log is before start date
        }
        
        // Check against end date
        if (endDateObj && logDate > endDateObj) {
          return false; // Log is after end date
        }
        
        return true; // Log is within date range
      } catch (error) {
        console.error('Error processing log date:', error, log);
        return true; // Include logs that cause errors
      }
    });
    
    // Calculate how many logs were filtered out
    const removedCount = originalCount - filteredLogs.length;
    
    console.log(`Date filtering results: ${originalCount} → ${filteredLogs.length} logs (removed ${removedCount})`);
    
    // Show date range of filtered logs if any remain
    if (filteredLogs.length > 0) {
      try {
        const dates = filteredLogs.map(log => new Date(log.timestamp));
        const minDate = new Date(Math.min(...dates.map((d: Date) => d.getTime())));
        const maxDate = new Date(Math.max(...dates.map((d: Date) => d.getTime())));
        
        console.log('Date range of filtered logs:');
        console.log('- Earliest log:', minDate.toISOString());
        console.log('- Latest log:', maxDate.toISOString());
      } catch (error) {
        console.error('Error calculating date range of filtered logs:', error);
      }
    }
    
    return filteredLogs;
  }
}