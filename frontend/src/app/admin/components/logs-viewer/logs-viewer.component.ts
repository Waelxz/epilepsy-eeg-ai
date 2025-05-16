import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { LogsService, Log, PaginatedResponse } from '../../../shared/services/logs.service';
import { UserService } from '../../../shared/services/user.service';
import { HttpParams } from '@angular/common/http';
import { AuthService } from '../../../auth/auth.service';

// Extended Log interface with actor and target properties
interface ExtendedLog extends Log {
  actor?: {
    id: string;
    username: string;
    name: string;
    role: string;
  };
  target?: {
    id: string;
    name?: string;
    username?: string;
  };
}

// Action group interface
interface ActionGroup {
  name: string;
  displayName: string;
  actions: string[];
}

@Component({
  selector: 'app-logs-viewer',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  providers: [LogsService, UserService],
  templateUrl: './logs-viewer.component.html',
  styleUrls: ['./logs-viewer.component.css']
})
export class LogsViewerComponent implements OnInit {
  logs: ExtendedLog[] = [];
  isLoading = true;
  errorMessage = '';
  
  // Pagination
  currentPage = 1;
  totalPages = 1;
  logsPerPage = 20;
  totalLogs = 0;
  
  // Filters
  startDate: string = '';
  endDate: string = '';
  actionType: string = 'all';
  userRole: string = 'all';
  searchQuery: string = '';
  hideCurrentUserLogs: boolean = false; // Toggle to hide current user's logs
  
  // User lists for filters
  doctors: any[] = [];
  technicians: any[] = [];
  selectedDoctor: string = '';
  selectedTechnician: string = '';
  
  // Valid action types from backend
  actionTypes: string[] = [];
  
  // Log details view
  showLogDetails: boolean = false;
  selectedLog: ExtendedLog | null = null;
  
  // Action groups for filtering
  actionGroups: ActionGroup[] = [
    {
      name: 'all',
      displayName: 'All Actions',
      actions: []
    },
    {
      name: 'login_logout',
      displayName: 'Login/Logout',
      actions: ['login', 'logout']
    },
    {
      name: 'create',
      displayName: 'Create',
      actions: ['create_user', 'create_doctor']
    },
    {
      name: 'update',
      displayName: 'Update',
      actions: ['update_user', 'update_doctor', 'update_permissions', 'doctor_permissions_update']
    },
    {
      name: 'delete',
      displayName: 'Delete',
      actions: ['delete_user', 'delete_doctor']
    },
    {
      name: 'password',
      displayName: 'Password Change',
      actions: ['password_change', 'doctor_password_change']
    },
    {
      name: 'model',
      displayName: 'Model Management',
      actions: ['model_upload', 'model_update', 'model_delete']
    },
    {
      name: 'system',
      displayName: 'System',
      actions: ['system']
    }
  ];
  
  // Add a cache for user roles to avoid repeated lookups
  private userRoleCache: Map<string, string> = new Map();
  
  // Add a set to track usernames that are currently being looked up
  // to prevent duplicate requests for the same username
  private pendingUserRoleLookups: Set<string> = new Set();
  
  // Flag to indicate all users have been preloaded
  private allUsersPreloaded: boolean = false;
  
  constructor(
    private logsService: LogsService,
    private userService: UserService,
    private authService: AuthService
  ) {}
  
  ngOnInit(): void {
    this.loadActionTypes();
    
    // Load users for filters
    this.loadUsers();
    
    // Preload user roles before loading logs
    this.preloadUserRoles().then(() => {
      // Once roles are preloaded, then load logs
      this.loadLogs();
    }).catch(error => {
      console.error('Error preloading user roles:', error);
      // Load logs anyway if preloading fails
      this.loadLogs();
    });
  }
  
  loadActionTypes(): void {
    this.logsService.getLogActionTypes().subscribe({
      next: (types) => {
        this.actionTypes = types;
        console.log('Loaded action types:', this.actionTypes);
        
        // Update action groups with actual action types
        this.updateActionGroups(types);
      },
      error: (error) => {
        console.error('Error loading action types:', error);
        // Fallback to hardcoded types
        this.actionTypes = [
          'login',
          'logout', 
          'create_doctor', 
          'update_doctor', 
          'delete_doctor',
          'create_user',
          'update_user',
          'delete_user',
          'model_upload',
          'model_delete',
          'model_update',
          'system'
        ];
        
        // Update action groups with fallback action types
        this.updateActionGroups(this.actionTypes);
      }
    });
  }
  
  // Update action groups based on available action types
  updateActionGroups(actionTypes: string[]): void {
    // Update 'all' group to include all action types
    this.actionGroups[0].actions = [...actionTypes];
    
    // Ensure each action group only includes actions that exist in the backend
    for (let i = 1; i < this.actionGroups.length; i++) {
      this.actionGroups[i].actions = this.actionGroups[i].actions.filter(
        action => actionTypes.includes(action)
      );
    }
  }
  
  // Check if an action type is a group name or an actual action
  isActionGroup(actionType: string): boolean {
    return this.actionGroups.some(group => group.name === actionType);
  }
  
  // Get actions for a group
  getActionsForGroup(groupName: string): string[] {
    const group = this.actionGroups.find(g => g.name === groupName);
    return group ? group.actions : [];
  }
  
  loadUsers(): void {
    // Load doctors
    this.userService.getUsers('doctor').subscribe({
      next: (doctors) => {
        this.doctors = doctors.filter(d => d.is_active);
      },
      error: (error) => {
        console.error('Error loading doctors:', error);
      }
    });
    
    // Load technicians
    this.userService.getUsers('technician').subscribe({
      next: (technicians) => {
        this.technicians = technicians.filter(t => t.is_active);
      },
      error: (error) => {
        console.error('Error loading technicians:', error);
      }
    });
  }
  
  // Preload user roles for common actors
  // Return a promise to allow chaining
  preloadUserRoles(): Promise<void> {
    // Set loading flag to prevent duplicate calls
    if (this.allUsersPreloaded) {
      return Promise.resolve();
    }
    
    return new Promise((resolve, reject) => {
      // Load all users and cache their roles
      this.userService.getUsers().subscribe({
        next: (users: any[]) => {
          users.forEach((user: any) => {
            if (user.username) {
              this.userRoleCache.set(user.username, user.role || '');
            }
          });
          
          console.log(`Cached roles for ${this.userRoleCache.size} users`);
          this.allUsersPreloaded = true;
          resolve();
        },
        error: (error: any) => {
          console.error('Error preloading user roles:', error);
          reject(error);
        }
      });
    });
  }
  
  // Get a user's role by username
  getUserRole(username: string): string {
    // Return empty if no username
    if (!username) return '';
    
    // Check cache first
    if (this.userRoleCache.has(username)) {
      return this.userRoleCache.get(username) || '';
    }
    
    // If all users should already be preloaded but this username isn't found,
    // it might be a new user or the preload failed
    if (this.allUsersPreloaded) {
      // Cache 'unknown' to prevent repeated lookups for this username
      this.userRoleCache.set(username, '');
      return '';
    }
    
    // If not in cache and not already being looked up, initiate lookup
    if (!this.pendingUserRoleLookups.has(username)) {
      this.lookupUserRole(username);
    }
    
    // Return empty for now, it will be updated in the next render cycle
    return '';
  }
  
  // Look up a user's role and cache it
  lookupUserRole(username: string): void {
    if (!username) return;
    
    // Skip if this username is already being looked up
    if (this.pendingUserRoleLookups.has(username)) return;
    
    // Mark this username as being looked up
    this.pendingUserRoleLookups.add(username);
    
    // Look up the user by filtering all users
    this.userService.getUsers().subscribe({
      next: (users: any[]) => {
        const user = users.find((u: any) => u.username === username);
        if (user && user.role) {
          this.userRoleCache.set(username, user.role);
          // Force re-render only if logs are already loaded
          if (!this.isLoading && this.logs.length > 0) {
            this.logs = [...this.logs];
          }
        } else {
          // Cache empty string to prevent future lookups
          this.userRoleCache.set(username, '');
        }
        
        // Remove from pending set
        this.pendingUserRoleLookups.delete(username);
      },
      error: (error: any) => {
        console.error(`Error looking up role for user ${username}:`, error);
        // Cache a default value to avoid repeated lookups
        this.userRoleCache.set(username, '');
        // Remove from pending set
        this.pendingUserRoleLookups.delete(username);
      }
    });
  }
  
  // Simplified username retrieval method
  getCurrentUsername(): string {
    // First try to get username from the user data in localStorage
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        if (userData.username) {
          return userData.username;
        }
      }
      
      // If not found in localStorage, try token data
      const tokenData = this.authService.getDecodedToken();
      if (tokenData && tokenData.username) {
        return tokenData.username;
      }
    } catch (e) {
      console.error('Error getting username:', e);
    }
    
    // If we couldn't find a username, fetch it from API silently
    this.fetchAndStoreUsername();
    return '';
  }
  
  // Separate method to fetch username asynchronously
  private fetchAndStoreUsername(): void {
    this.userService.getCurrentUserProfile().subscribe({
      next: (response) => {
        if (response && response.username) {
          try {
            const userData = JSON.parse(localStorage.getItem('user') || '{}');
            userData.username = response.username;
            localStorage.setItem('user', JSON.stringify(userData));
            
            // If logs are already loaded and we need to filter by username,
            // reapply filters to use the new username
            if (!this.isLoading && this.hideCurrentUserLogs) {
              this.applyFilters();
            }
          } catch (e) {
            console.error('Error updating user data:', e);
          }
        }
      }
    });
  }
  
  loadLogs(): void {
    this.isLoading = true;
    
    // Build filters object for the logs service
    const filters: any = {
      page: this.currentPage,
      limit: this.logsPerPage
    };
    let clientSideActionGroup = false;
    let needsClientSideRoleFiltering = false;
    let needsCurrentUserFiltering = this.hideCurrentUserLogs;
    
    // Get current username for filtering
    const currentUsername = needsCurrentUserFiltering ? this.getCurrentUsername() : '';
    
    // Add date filters if provided
    if (this.startDate) {
      const startDateTime = new Date(this.startDate);
      startDateTime.setHours(0, 0, 0, 0);
      filters.start_date = startDateTime.toISOString();
    }
    
    if (this.endDate) {
      const endDateTime = new Date(this.endDate);
      endDateTime.setHours(23, 59, 59, 999);
      filters.end_date = endDateTime.toISOString();
    }
    
    // Handle action type filter - check if it's a group or an actual action
    if (this.actionType !== 'all') {
      if (this.isActionGroup(this.actionType)) {
        const actions = this.getActionsForGroup(this.actionType);
        // Try to send all actions in the group to the backend
        filters.action_types = actions;
        // For client-side fallback, fetch a large number of logs
        filters.limit = 1000;
        filters.page = 1;
        clientSideActionGroup = true;
      } else {
        filters.action_type = this.actionType;
      }
    }
    
    // Check if we need client-side role filtering
    if (this.userRole !== 'all' || needsCurrentUserFiltering) {
      needsClientSideRoleFiltering = true;
      // Still send the role parameter to backend in case it supports it
      if (this.userRole !== 'all') {
        filters.user_role = this.userRole;
      }
      
      // If we need client-side filtering, increase limit to fetch more data
      if (!clientSideActionGroup) {
        filters.limit = 1000;
        filters.page = 1;
        clientSideActionGroup = true;
      }
    }
    
    if (this.selectedDoctor) {
      filters.user_id = this.selectedDoctor;
    }
    if (this.selectedTechnician) {
      filters.user_id = this.selectedTechnician;
    }
    if (this.searchQuery.trim()) {
      filters.search = this.searchQuery.trim();
    }
    
    console.log('Applying filters:', filters);
    
    this.logsService.getLogs(filters).subscribe({
      next: (response: PaginatedResponse<Log>) => {
        // Collect unique usernames from all logs
        const usernames = new Set<string>();
        response.items.forEach(log => {
          if (log.username) usernames.add(log.username);
          
          // Also get target usernames from details
          if (log.details) {
            try {
              const details = typeof log.details === 'string' ? 
                JSON.parse(log.details) : log.details;
              if (details.target_user) usernames.add(details.target_user);
            } catch (e) {
              // Ignore parsing errors
            }
          }
        });
        
        // Ensure all usernames are in the role cache
        usernames.forEach(username => {
          if (!this.userRoleCache.has(username) && !this.pendingUserRoleLookups.has(username)) {
            this.userRoleCache.set(username, ''); // Set temporary empty value
          }
        });
        
        // Continue with normal log processing
        let allLogs = response.items.map(log => this.enhanceLogWithActorAndTarget(log));
        
        // Apply current user filtering if needed - do this regardless of other filters
        if (needsCurrentUserFiltering && currentUsername) {
          console.log('Filtering logs by username:', currentUsername);
          
          const filtered = allLogs.filter(log => {
            // Try exact username match
            if (log.username === currentUsername) {
              return false;
            }
            
            // Check if username is mentioned in description
            if (log.description && log.description.includes(currentUsername)) {
              return false;
            }
            
            // Check for username in details
            if (log.details) {
              try {
                const details = typeof log.details === 'string' ? 
                  JSON.parse(log.details) : log.details;
                
                // Check username in various details fields
                if ((details.username && details.username === currentUsername) ||
                    (details.target_user && details.target_user === currentUsername) ||
                    (details.user && details.user === currentUsername)) {
                  return false;
                }
                
                // Also check if any string field in details contains the username
                for (const field in details) {
                  if (typeof details[field] === 'string' && 
                      details[field] === currentUsername) {
                    return false;
                  }
                }
              } catch (e) {
                // Ignore parsing errors
              }
            }
            
            return true;
          });
          
          allLogs = filtered;
        } else if (needsCurrentUserFiltering) {
          // Try one more time with username from localStorage
          const storedUsername = this.getUsernameFromStorage();
          if (storedUsername) {
            const filtered = this.filterLogsByUsername(allLogs, storedUsername);
            allLogs = filtered;
          }
        }
        
        // Additional server-side filtering handling
        if (clientSideActionGroup || needsClientSideRoleFiltering) {
          // First filter by action group if needed
          if (clientSideActionGroup && this.actionType !== 'all') {
            const actions = this.getActionsForGroup(this.actionType);
            allLogs = allLogs.filter(log => actions.includes(log.action));
          }
          
          // Then filter by user role if needed
          if (needsClientSideRoleFiltering && this.userRole !== 'all') {
            const userRoleLower = this.userRole.toLowerCase();
            allLogs = allLogs.filter(log => {
              // Get the actor's role (from the enhanced log)
              const actorRole = log.actor?.role?.toLowerCase();
              
              // Check if this log is an action performed by the selected role
              if (actorRole === userRoleLower) {
                return true;
              }
              
              // Check if this log is about a user of the selected role
              if (log.details) {
                try {
                  const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
                  if (details.target_user) {
                    const targetRole = this.getUserRole(details.target_user).toLowerCase();
                    if (targetRole === userRoleLower) {
                      return true;
                    }
                  }
                } catch (e) {
                  console.warn('Error parsing log details for filtering:', e);
                }
              }
              
              // Check for role mentions in description
              if (log.description) {
                const desc = log.description.toLowerCase();
                if (desc.includes(userRoleLower)) {
                  return true;
                }
              }
              
              return false;
            });
          }
          
          // Custom client-side pagination
          this.totalLogs = allLogs.length;
          this.totalPages = Math.ceil(this.totalLogs / this.logsPerPage);
          const startIndex = (this.currentPage - 1) * this.logsPerPage;
          const endIndex = startIndex + this.logsPerPage;
          this.logs = allLogs.slice(startIndex, endIndex);
        } else {
          // Use server-side pagination if no client-side filtering was needed
          this.logs = allLogs;
          this.totalLogs = response.metadata.total_count;
          this.totalPages = Math.ceil(this.totalLogs / this.logsPerPage);
        }
        
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('Error loading logs:', error);
        this.errorMessage = 'Failed to load logs. Please try again.';
        this.isLoading = false;
        if (error.status === 404) {
          this.createMockLogs();
        }
      }
    });
  }
  
  // Helper to enhance log with actor and target for UI display
  enhanceLogWithActorAndTarget(log: Log): ExtendedLog {
    const extendedLog: ExtendedLog = { ...log };
    
    // Add actor information if user_id and username exist
    if (log.user_id || log.username) {
      extendedLog.actor = {
        id: log.user_id || '',
        username: log.username || '',
        name: log.username || '',
        role: this.extractRoleFromLog(log)
      };
    }
    
    // Add target information if it can be extracted from details
    if (log.details) {
      try {
        const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
        
        // Look for target information in the details
        // The example shows target_user and target_name fields
        if (details.target_user || details.target_name || details.target_id) {
          extendedLog.target = {
            id: details.target_id || '',
            username: details.target_user || '',
            name: details.target_name || details.target_user || ''
          };
        }
      } catch (e) {
        console.warn('Could not parse log details:', e);
      }
    }
    
    // If no target was found but description mentions a target, try to extract from description
    if (!extendedLog.target && log.description) {
      // Example: "User 0000X deactivated the account of 1111W (Mohammed Chaouachi)"
      const targetMatch = log.description.match(/(?:of|for|to)\s+(\w+)(?:\s*\(([^)]+)\))?/);
      if (targetMatch) {
        extendedLog.target = {
          id: '',
          username: targetMatch[1] || '',
          name: targetMatch[2] || targetMatch[1] || ''
        };
      }
    }
    
    return extendedLog;
  }
  
  // Update extractRoleFromLog to use getUserRole instead of hardcoded patterns
  extractRoleFromLog(log: Log): string {
    // Try to get role directly from user service/cache
    if (log.username) {
      const cachedRole = this.getUserRole(log.username);
      if (cachedRole) {
        return cachedRole;
      }
    }
    
    // Try to extract from details as fallback
    if (log.details) {
      try {
        const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
        
        // Check for direct role field
        if (details.user_role) {
          return details.user_role;
        }
      } catch (e) {
        console.warn('Could not parse log details:', e);
      }
    }
    
    // Try to infer role from action as last resort
    const action = log.action.toLowerCase();
    if (action.includes('doctor')) return 'doctor';
    if (action.includes('technician')) return 'technician';
    if (action.includes('admin')) return 'admin';
    
    return '';
  }
  
  // Helper method to get the actor name (who performed the action)
  getActorName(log: ExtendedLog): string {
    if (!log.actor) {
      // If the actor isn't available in the extended log, try to create it from the base log
      return log.username || 'System';
    }
    return log.actor.name || log.actor.username || 'Unknown User';
  }
  
  // Helper method to get the actor's role
  getActorRole(log: ExtendedLog): string {
    if (!log.actor || !log.actor.role) return '';
    
    const role = log.actor.role.toLowerCase();
    if (role === 'doctor') return 'Doctor';
    if (role === 'technician') return 'Technician';
    if (role === 'admin') return 'Admin';
    return role.charAt(0).toUpperCase() + role.slice(1);
  }
  
  // Helper to get the target of the action (what was affected)
  getTargetName(log: ExtendedLog): string {
    // If we already have a target in the extended log, use it
    if (log.target) {
      return log.target.name || log.target.username || log.target.id || '';
    }
    
    // Try to extract from details first - follow the format from the example
    if (log.details) {
      try {
        const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
        // The example had these fields
        if (details.target_name && details.target_user) {
          return `${details.target_user} (${details.target_name})`;
        }
        if (details.target_user) {
          return details.target_user;
        }
        if (details.target_name) {
          return details.target_name;
        }
        // Check other common target fields
        if (details.created_user) {
          return details.created_user;
        }
        if (details.deleted_user) {
          return details.deleted_user;
        }
      } catch (e) {
        console.warn('Could not parse log details:', e);
      }
    }
    
    // For login/logout events, the username is the target
    if (log.action === 'login' || log.action === 'logout') {
      return log.actor?.username || 'Unknown';
    }
    
    // Extract target from description using regex for the specific pattern
    // Example: "User 0000X deactivated the account of 1111W (Mohammed Chaouachi)"
    const description = log.description || '';
    const targetMatch = description.match(/(?:of|for|to)\s+(\w+)(?:\s*\(([^)]+)\))?/);
    if (targetMatch) {
      if (targetMatch[2]) {
        return `${targetMatch[1]} (${targetMatch[2]})`;
      }
      return targetMatch[1];
    }
    
    // Fall back to parsing the description for common patterns
    const updateMatch = description.match(/updated\s+(\w+)/);
    if (updateMatch) return updateMatch[1];
    const createMatch = description.match(/created\s+user\s+(\w+)/);
    if (createMatch) return createMatch[1];
    const deleteMatch = description.match(/deleted\s+(\w+)/);
    if (deleteMatch) return deleteMatch[1];
    
    return '';
  }
  
  // Update getShortDescription to use real roles instead of hardcoded patterns
  getShortDescription(log: ExtendedLog): string {
    const action = log.action || '';
    const details = log.details || {};
    const targetUser = this.getTargetName(log);
    
    // Get target role if available (from target username)
    let targetRole = '';
    if (targetUser) {
      // Try to extract just the username part
      const targetUsername = targetUser.split(' ')[0];
      const role = this.getUserRole(targetUsername);
      if (role) {
        targetRole = role.charAt(0).toUpperCase() + role.slice(1);
      }
    }
    
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
      
      // User management actions
      case 'create_user':
      case 'create_doctor':
        return `Created ${targetRole ? targetRole + ' account' : 'account'} for ${targetUser}`;
        
      case 'update_user':
      case 'update_doctor':
        const fields = details.updated_fields || [];
        const oldValues = details.old_values || {};
        const newValues = details.new_values || {};
        
        // Generate specific narratives based on updated fields
        if (fields.includes('is_active')) {
          const wasActivated = newValues.is_active === true;
          return wasActivated 
            ? `Activated ${targetRole ? targetRole + ' account' : 'account'} for ${targetUser}`
            : `Deactivated ${targetRole ? targetRole + ' account' : 'account'} for ${targetUser}`;
        }
        
        if (fields.includes('contact_info')) {
          return `Updated contact information for ${targetUser}`;
        }
        
        if (fields.includes('name') || fields.includes('lastname')) {
          return `Updated name for ${targetUser}`;
        }
        
        return `Updated ${targetRole ? targetRole + ' account' : 'account'} for ${targetUser}`;
      
      case 'delete_user':
      case 'delete_doctor':
        return `Deleted ${targetRole ? targetRole + ' account' : 'account'} for ${targetUser}`;
        
      case 'model_upload':
        return `Uploaded new model`;
        
      case 'model_update':
        return `Updated model settings`;
        
      case 'model_delete':
        return `Deleted model`;
      
      default:
        return log.description || `${action.charAt(0).toUpperCase() + action.slice(1).replace('_', ' ')}`;
    }
  }
  
  // Create mock data for demonstration purposes
  createMockLogs(): void {
    const mockLogs: ExtendedLog[] = [];
    
    // Generate some mock logs
    const actions = ['login', 'logout', 'create_patient', 'update_patient', 'delete_patient', 'view_eeg', 'upload_eeg', 'create_doctor', 'update_doctor', 'deactivate_doctor'];
    const roles = ['doctor', 'technician', 'admin'];
    
    for (let i = 0; i < 50; i++) {
      const role = roles[Math.floor(Math.random() * roles.length)];
      const action = actions[Math.floor(Math.random() * actions.length)];
      
      // Create date between start and end date
      const start = new Date(this.startDate || '2023-01-01').getTime();
      const end = new Date(this.endDate || new Date()).getTime();
      const randomDate = new Date(start + Math.random() * (end - start));
      
      mockLogs.push({
        id: `log-${i}`,
        timestamp: randomDate.toISOString(),
        action: action,
        description: `User performed ${action} action`,
        actor: {
          id: `user-${i % 10}`,
          username: `user${i % 10}`,
          name: `User ${i % 10}`,
          role: role
        },
        target: action.includes('patient') ? {
          id: `patient-${i % 20}`,
          name: `Patient ${i % 20}`
        } : action.includes('doctor') ? {
          id: `doctor-${i % 5}`,
          name: `Doctor ${i % 5}`
        } : undefined
      });
    }
    
    // Apply filters
    let filteredLogs = [...mockLogs];
    
    if (this.actionType !== 'all') {
      filteredLogs = filteredLogs.filter(log => log.action.includes(this.actionType));
    }
    
    if (this.userRole !== 'all') {
      filteredLogs = filteredLogs.filter(log => log.actor?.role === this.userRole);
    }
    
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filteredLogs = filteredLogs.filter(log => 
        log.action.toLowerCase().includes(query) ||
        log.description.toLowerCase().includes(query) ||
        (log.actor && log.actor.name.toLowerCase().includes(query))
      );
    }
    
    // Sort by date (newest first)
    filteredLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    // Apply pagination
    const startIndex = (this.currentPage - 1) * this.logsPerPage;
    const endIndex = startIndex + this.logsPerPage;
    
    this.logs = filteredLogs.slice(startIndex, endIndex);
    this.totalLogs = filteredLogs.length;
    this.totalPages = Math.ceil(this.totalLogs / this.logsPerPage);
    this.isLoading = false;
  }
  
  applyFilters(): void {
    this.currentPage = 1;
    this.loadLogs();
  }
  
  resetFilters(): void {
    // Reset all filters to show all logs with no restrictions
    this.startDate = '';
    this.endDate = '';
    this.actionType = 'all';
    this.userRole = 'all';
    this.searchQuery = '';
    this.selectedDoctor = '';
    this.selectedTechnician = '';
    this.hideCurrentUserLogs = false; // Reset the hide current user toggle
    
    this.currentPage = 1;
    this.loadLogs();
  }
  
  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadLogs();
    }
  }
  
  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.loadLogs();
    }
  }
  
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadLogs();
    }
  }
  
  getPageNumbers(): number[] {
    const pages: number[] = [];
    const totalPages = this.totalPages;
    const currentPage = this.currentPage;
    
    // Always show first page
    pages.push(1);
    
    // Show pages around current page
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      pages.push(i);
    }
    
    // Always show last page if there is more than one page
    if (totalPages > 1) {
      pages.push(totalPages);
    }
    
    // Remove duplicates and sort
    return [...new Set(pages)].sort((a, b) => a - b);
  }
  
  shouldShowEllipsis(pageNumbers: number[]): boolean[] {
    const result: boolean[] = [false, false];
    
    // Show ellipsis before if there's a gap between first page and second page in array
    if (pageNumbers.length > 1 && pageNumbers[1] > 2) {
      result[0] = true;
    }
    
    // Show ellipsis after if there's a gap between last page and second-to-last page in array
    if (pageNumbers.length > 1 && pageNumbers[pageNumbers.length - 1] - pageNumbers[pageNumbers.length - 2] > 1) {
      result[1] = true;
    }
    
    return result;
  }
  
  exportLogs(): void {
    // Build filters for export (same as current filters but with higher limit)
    const exportFilters = {
      page: 1,
      limit: 1000,
      start_date: this.startDate ? new Date(this.startDate).toISOString() : undefined,
      end_date: this.endDate ? new Date(this.endDate).toISOString() : undefined,
      action_type: this.actionType !== 'all' ? this.actionType : undefined,
      user_role: this.userRole !== 'all' ? this.userRole : undefined,
      user_id: this.selectedDoctor || this.selectedTechnician || undefined,
      search: this.searchQuery.trim() || undefined
    };
    
    this.logsService.getLogs(exportFilters).subscribe({
      next: (response: PaginatedResponse<Log>) => {
        // Convert standard logs to extended logs with actor and target
        const exportLogs = response.items.map(log => this.enhanceLogWithActorAndTarget(log));
        this.downloadCSV(exportLogs);
      },
      error: (error: any) => {
        console.error('Error exporting logs:', error);
        this.errorMessage = 'Failed to export logs. Please try again.';
        
        // For demo purposes, export current logs if API fails
        if (error.status === 404) {
          this.downloadCSV(this.logs);
        }
      }
    });
  }
  
  downloadCSV(logs: ExtendedLog[]): void {
    // Create CSV content
    let csvContent = 'Date,Time,User,Role,Action,Description,Target\n';
    
    logs.forEach(log => {
      const date = new Date(log.timestamp);
      const dateStr = date.toLocaleDateString();
      const timeStr = date.toLocaleTimeString();
      
      const userName = log.actor ? `${log.actor.name || log.actor.username}` : 'Unknown';
      const userRole = log.actor ? log.actor.role : 'Unknown';
      const action = log.action;
      const description = log.description || '';
      const target = this.getTargetName(log);
      
      const row = [
        dateStr,
        timeStr,
        userName,
        userRole,
        action,
        description,
        target
      ];
      
      // Escape commas and quotes in fields
      const escapedRow = row.map(field => {
        if (field && (field.includes(',') || field.includes('"'))) {
          return `"${field.replace(/"/g, '""')}"`;
        }
        return field;
      });
      
      csvContent += escapedRow.join(',') + '\n';
    });
    
    // Create file and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `system_logs_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  
  getActionClass(action: string, log?: ExtendedLog): string {
    action = action.toLowerCase();
    
    // Handle specific login actions first
    if (action === 'login_success') return 'login-success';
    if (action === 'login_failed') return 'login-failed';
    if (action === 'logout') return 'logout';
    
    // If the action is login, check if it's a failed login
    if (action === 'login' && log) {
      // Check if details has success=false or description contains failure indicators
      if (this.isFailedLogin(log)) {
        return 'login-failed';
      }
      return 'login-success';
    }
    
    // Then handle general categories
    if (action.includes('create') || action.includes('add')) return 'create';
    if (action.includes('update') || action.includes('edit')) return 'update';
    if (action.includes('delete') || action.includes('remove')) return 'delete';
    if (action.includes('auth')) return 'auth';
    if (action.includes('view') || action.includes('read')) return 'view';
    if (action.includes('upload')) return 'upload';
    
    return 'default';
  }
  
  // Helper method to determine if a login is failed
  private isFailedLogin(log: ExtendedLog): boolean {
    const details = log.details || {};
    return details.success === false || 
           (log.description?.toLowerCase().includes('fail') || 
           log.description?.toLowerCase().includes('invalid') ||
           log.description?.toLowerCase().includes('disabled'));
  }
  
  getActionIcon(action: string): string {
    action = action.toLowerCase();
    if (action.includes('create') || action.includes('add')) return 'fas fa-plus-circle';
    if (action.includes('update') || action.includes('edit')) return 'fas fa-edit';
    if (action.includes('delete') || action.includes('remove')) return 'fas fa-trash';
    if (action.includes('login')) return 'fas fa-sign-in-alt';
    if (action.includes('logout')) return 'fas fa-sign-out-alt';
    if (action.includes('view') || action.includes('read')) return 'fas fa-eye';
    if (action.includes('upload')) return 'fas fa-upload';
    return 'fas fa-info-circle';
  }
  
  getActionDisplayName(action: string): string {
    action = action.toLowerCase();
    
    // Replace underscores with spaces and capitalize each word
    return action.split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  }
  
  formatTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleTimeString();
  }
  
  // Log detail view methods
  viewLogDetails(log: ExtendedLog): void {
    console.log('View Log Details clicked', log);
    this.selectedLog = log;
    
    // Use setTimeout to ensure change detection runs after the current cycle
    setTimeout(() => {
      this.showLogDetails = true;
    }, 0);
  }
  
  closeLogDetails(): void {
    this.showLogDetails = false;
    this.selectedLog = null;
  }
  
  hasDetails(log: ExtendedLog): boolean {
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
  
  // Helper method to get username from storage
  private getUsernameFromStorage(): string {
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        return userData.username || '';
      }
    } catch (e) {}
    return '';
  }
  
  // Helper method to filter logs by username
  private filterLogsByUsername(logs: ExtendedLog[], username: string): ExtendedLog[] {
    if (!username) return logs;
    
    return logs.filter(log => {
      // Try exact username match
      if (log.username === username) {
        return false;
      }
      
      // Check if username is mentioned in description
      if (log.description && log.description.includes(username)) {
        return false;
      }
      
      // Check for username in details
      if (log.details) {
        try {
          const details = typeof log.details === 'string' ? 
            JSON.parse(log.details) : log.details;
          
          if ((details.username && details.username === username) ||
              (details.target_user && details.target_user === username) ||
              (details.user && details.user === username)) {
            return false;
          }
          
          for (const field in details) {
            if (typeof details[field] === 'string' && 
                details[field] === username) {
              return false;
            }
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
      
      return true;
    });
  }
  
  // Check if action is a simple login/logout with no extra details needed
  isSimpleAuthAction(log: ExtendedLog): boolean {
    if (!log) return false;
    
    const action = log.action.toLowerCase();
    const isLoginLogout = action === 'login' || action === 'logout';
    
    // Simple login/logout actions typically don't have meaningful details to display
    if (isLoginLogout) {
      // If login/logout action has no details or empty details, it's simple
      if (!log.details) return true;
      
      try {
        // Check if details is a string or object
        const detailsObj = typeof log.details === 'string' ? 
          JSON.parse(log.details) : log.details;
          
        // If the only details are success status or timestamp, still simple
        const keys = Object.keys(detailsObj);
        if (keys.length === 0) return true;
        
        // If it only has basic fields, consider it simple
        const basicFields = ['success', 'timestamp', 'ip', 'user_agent'];
        const hasOnlyBasicFields = keys.every(key => basicFields.includes(key));
        
        return hasOnlyBasicFields;
      } catch (e) {
        // If can't parse details, default to simple
        return true;
      }
    }
    
    return false;
  }
}
