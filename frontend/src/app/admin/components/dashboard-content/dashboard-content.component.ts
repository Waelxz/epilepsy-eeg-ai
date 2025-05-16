import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { interval, Subscription } from 'rxjs';
import { LogsService, Log, PaginatedResponse } from '../../../shared/services/logs.service';
import { AuthService } from '../../../auth/auth.service';
import { UserService } from '../../../shared/services/user.service';
import { AppSettingsService } from '../../../shared/services/app-settings.service';

interface User {
  id: string;
  username: string;
  name: string;
  lastname: string;
  is_active: boolean;
  contact_info: {
    email: string;
    phone?: string;
  };
  date_created: string;
  role: string;
}

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

@Component({
  selector: 'app-dashboard-content',
  standalone: true,
  imports: [CommonModule, RouterModule],
  providers: [LogsService, UserService, AuthService],
  templateUrl: './dashboard-content.component.html',
  styleUrls: ['./dashboard-content.component.css']
})
export class DashboardContentComponent implements OnInit, OnDestroy {
  // User information
  adminName: string = 'Admin';
  lastLogin: Date | null = null;
  
  // Date and time
  currentDate: Date = new Date();
  currentTime: string = '';
  timeSubscription: Subscription | null = null;
  
  // Statistics
  activeDoctorsCount: number = 0;
  activeTechniciansCount: number = 0;
  totalLogsCount: number = 0;
  totalModelsCount: number = 0;
  
  // System status
  systemOnline: boolean = true;
  uptime: string = '';
  
  // Logs
  recentLogs: ExtendedLog[] = [];
  isLoadingLogs: boolean = true;

  // Users data
  doctors: User[] = [];
  technicians: User[] = [];
  
  // Math object for template
  Math = Math;
  
  constructor(
    private http: HttpClient, 
    private router: Router,
    private logsService: LogsService,
    private userService: UserService,
    private authService: AuthService,
    private appSettingsService: AppSettingsService
  ) {}
  
  ngOnInit(): void {
    // Check for any unsaved settings changes and revert them if needed
    if (this.appSettingsService.hasUnsavedChanges()) {
      this.appSettingsService.revertToSavedSettings();
    }

    // Set up time updates
    this.updateTime();
    this.timeSubscription = interval(60000).subscribe(() => {
      this.currentDate = new Date();
      this.updateTime();
    });
    
    // Load admin info
    this.loadAdminInfo();
    
    // Load dashboard data
    this.loadDashboardData();
    
    // Load recent logs
    this.loadRecentLogs();

    // Check system status
    this.checkSystemStatus();
  }
  
  ngOnDestroy(): void {
    if (this.timeSubscription) {
      this.timeSubscription.unsubscribe();
    }
  }
  
  updateTime(): void {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    this.currentTime = `${hours}:${minutes}`;
  }
  
  loadAdminInfo(): void {
    const storedUser = localStorage.getItem('user');
    
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        // Use full name (first + last name) when available
        if (user.name && user.lastname) {
          this.adminName = `${user.name} ${user.lastname}`;
        } else if (user.name && user.last_name) {
          this.adminName = `${user.name} ${user.last_name}`;
        } else if (user.first_name && user.lastname) {
          this.adminName = `${user.first_name} ${user.lastname}`;
        } else if (user.first_name && user.last_name) {
          this.adminName = `${user.first_name} ${user.last_name}`;
        } else {
          this.adminName = user.name || user.first_name || 'Admin';
        }
        this.lastLogin = user.lastLogin ? new Date(user.lastLogin) : null;
      } catch (e) {
        console.error('Error parsing user data', e);
        this.setDefaultAdminName();
      }
    } else {
      this.setDefaultAdminName();
    }
  }
  
  // Set a default name when no user data exists
  private setDefaultAdminName(): void {
    this.adminName = 'System Admin';
    
    // Create test user data
    const testUser = {
      name: 'System',
      lastname: 'Admin',
      role: 'ADMIN',
      lastLogin: new Date().toISOString()
    };
    localStorage.setItem('user', JSON.stringify(testUser));
  }
  
  loadDashboardData(): void {
    this.isLoadingLogs = true;
    
    // Load doctors
    this.userService.getUsers('DOCTOR').subscribe({
      next: (doctors) => {
        this.doctors = doctors;
        console.log('Doctors loaded:', doctors);
        
        // Check if is_active property exists and handle properly
        if (doctors && doctors.length > 0) {
          // Handle possible different formats for is_active property
          if (doctors[0].hasOwnProperty('is_active')) {
            this.activeDoctorsCount = this.doctors.filter(d => d.is_active).length;
          } else if (doctors[0].hasOwnProperty('active')) {
            this.activeDoctorsCount = this.doctors.filter(d => (d as any).active).length;
          } else {
            // If no active property is found, assume all doctors are active
            this.activeDoctorsCount = doctors.length;
          }
          
          console.log('Active doctors count:', this.activeDoctorsCount);
        } else {
          // Default to 3 if no doctors are returned (for demo purposes)
          this.activeDoctorsCount = 3;
          console.log('No doctors returned, using default value');
        }
      },
      error: (error) => {
        console.error('Error loading doctors:', error);
        // Set default value on error
        this.activeDoctorsCount = 3;
      }
    });
    
    // Load technicians
    this.userService.getUsers('TECHNICIAN').subscribe({
      next: (technicians) => {
        this.technicians = technicians;
        console.log('Technicians loaded:', technicians);
        
        // Check if is_active property exists and handle properly
        if (technicians && technicians.length > 0) {
          // Handle possible different formats for is_active property
          if (technicians[0].hasOwnProperty('is_active')) {
            this.activeTechniciansCount = this.technicians.filter(t => t.is_active).length;
          } else if (technicians[0].hasOwnProperty('active')) {
            this.activeTechniciansCount = this.technicians.filter(t => (t as any).active).length;
          } else {
            // If no active property is found, assume all technicians are active
            this.activeTechniciansCount = technicians.length;
          }
          
          console.log('Active technicians count:', this.activeTechniciansCount);
        } else {
          // Default to 5 if no technicians are returned (for demo purposes)
          this.activeTechniciansCount = 5;
          console.log('No technicians returned, using default value');
        }
      },
      error: (error) => {
        console.error('Error loading technicians:', error);
        // Set default value on error
        this.activeTechniciansCount = 5;
      }
    });
    
    // Get the total logs count for ALL logs in the system
    
    // Use the LogsService to get total logs count without date filters
    const countFilters = {};
    
    // The API will return the total count in metadata
    this.logsService.getLogs(countFilters).subscribe({
      next: (response) => {
        this.totalLogsCount = response.metadata.total_count;
        console.log('Total logs count in system:', this.totalLogsCount);
      },
      error: (error) => {
        console.error('Error loading logs count:', error);
      }
    });
    
    // Get models count (mock data for now)
    this.http.get<any>('http://localhost:8000/api/models/count', {
      headers: { 'Authorization': `Bearer ${this.authService.getToken()}` }
    }).subscribe({
      next: (response) => {
        this.totalModelsCount = response.count || 3; // Default to 3 if API fails
      },
      error: (error) => {
        console.error('Error loading models count:', error);
        this.totalModelsCount = 3; // Default value
      }
    });
  }
  
  loadRecentLogs(): void {
    const filters = {
      page: 1,
      limit: 5
    };
    
    this.logsService.getLogs(filters).subscribe({
      next: (response) => {
        // Convert standard logs to extended logs with actor and target
        this.recentLogs = response.items.map(log => this.enhanceLogWithActorAndTarget(log));
        this.isLoadingLogs = false;
      },
      error: (error) => {
        console.error('Error loading logs:', error);
        this.isLoadingLogs = false;
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
        if (details.target_id || details.target_name) {
          extendedLog.target = {
            id: details.target_id || '',
            name: details.target_name || ''
          };
        }
      } catch (e) {
        console.warn('Could not parse log details:', e);
      }
    }
    
    return extendedLog;
  }
  
  // Helper to extract role from log
  extractRoleFromLog(log: Log): string {
    if (log.details) {
      try {
        const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
        return details.user_role || '';
      } catch (e) {
        // Ignore parsing errors
      }
    }
    
    // Try to infer role from action
    const action = log.action.toLowerCase();
    if (action.includes('doctor')) return 'doctor';
    if (action.includes('technician')) return 'technician';
    if (action.includes('admin')) return 'admin';
    
    return '';
  }
  
  checkSystemStatus(): void {
    this.http.get<any>('http://localhost:8000/api/health', {
      headers: { 'Authorization': `Bearer ${this.authService.getToken()}` }
    }).subscribe({
      next: (data) => {
        this.systemOnline = data.status === 'ok';
        
        // Calculate uptime
        if (data.uptime_seconds) {
          const uptime = data.uptime_seconds;
          const days = Math.floor(uptime / 86400);
          const hours = Math.floor((uptime % 86400) / 3600);
          const minutes = Math.floor((uptime % 3600) / 60);
          
          if (days > 0) {
            this.uptime = `${days}d ${hours}h ${minutes}m`;
          } else if (hours > 0) {
            this.uptime = `${hours}h ${minutes}m`;
          } else {
            this.uptime = `${minutes}m`;
          }
        } else {
          this.uptime = 'Unknown';
        }
      },
      error: (error) => {
        console.error('Error checking system status:', error);
        this.systemOnline = false;
        this.uptime = 'Unknown';
      }
    });
  }
  
  getActionClass(action: string): string {
    action = action.toLowerCase();
    if (action.includes('create') || action.includes('add')) return 'create';
    if (action.includes('update') || action.includes('edit')) return 'update';
    if (action.includes('delete') || action.includes('remove')) return 'delete';
    if (action.includes('login') || action.includes('auth')) return 'auth';
    if (action.includes('view') || action.includes('read')) return 'view';
    return 'other';
  }
  
  getActionIcon(action: string): string {
    action = action.toLowerCase();
    if (action.includes('create') || action.includes('add')) return 'fas fa-plus-circle';
    if (action.includes('update') || action.includes('edit')) return 'fas fa-edit';
    if (action.includes('delete') || action.includes('remove')) return 'fas fa-trash';
    if (action.includes('login')) return 'fas fa-sign-in-alt';
    if (action.includes('logout')) return 'fas fa-sign-out-alt';
    if (action.includes('view') || action.includes('read')) return 'fas fa-eye';
    return 'fas fa-info-circle';
  }
  
  getActionDisplayName(action: string): string {
    action = action.toLowerCase();
    if (action.includes('create')) return 'Created';
    if (action.includes('add')) return 'Added';
    if (action.includes('update')) return 'Updated';
    if (action.includes('edit')) return 'Edited';
    if (action.includes('delete')) return 'Deleted';
    if (action.includes('remove')) return 'Removed';
    if (action.includes('login')) return 'Logged In';
    if (action.includes('logout')) return 'Logged Out';
    if (action.includes('view')) return 'Viewed';
    if (action.includes('read')) return 'Read';
    return action.charAt(0).toUpperCase() + action.slice(1);
  }
  
  getActorName(log: ExtendedLog): string {
    return log.actor?.name || log.actor?.username || 'Unknown User';
  }
  
  getTargetName(log: ExtendedLog): string {
    return log.target?.name || log.target?.username || log.target?.id || 'Unknown';
  }
  
  navigateTo(path: string): void {
    this.router.navigate([path]);
  }
  
  exportDoctorsList(): void {
    let csvContent = 'ID,Username,Name,Last Name,Email,Status,Date Created\n';
    
    this.doctors.forEach(doctor => {
      const status = doctor.is_active ? 'Active' : 'Inactive';
      const row = [
        doctor.id,
        doctor.username,
        doctor.name,
        doctor.lastname,
        doctor.contact_info.email,
        status,
        new Date(doctor.date_created).toLocaleDateString()
      ];
      csvContent += row.join(',') + '\n';
    });
    
    this.downloadCSV(csvContent, 'doctors_list.csv');
  }
  
  exportTechniciansList(): void {
    let csvContent = 'ID,Username,Name,Last Name,Email,Status,Date Created\n';
    
    this.technicians.forEach(technician => {
      const status = technician.is_active ? 'Active' : 'Inactive';
      const row = [
        technician.id,
        technician.username,
        technician.name,
        technician.lastname,
        technician.contact_info.email,
        status,
        new Date(technician.date_created).toLocaleDateString()
      ];
      csvContent += row.join(',') + '\n';
    });
    
    this.downloadCSV(csvContent, 'technicians_list.csv');
  }
  
  exportActivityLogs(): void {
    const filters = {
      page: 1,
      limit: 1000
    };
    
    this.logsService.getLogs(filters).subscribe({
      next: (response) => {
        let csvContent = 'Date,Time,Actor,Action,Description,Target\n';
        
        // Convert standard logs to extended logs with actor and target
        const logs = response.items.map(log => this.enhanceLogWithActorAndTarget(log));
        
        logs.forEach(log => {
          const date = new Date(log.timestamp);
          const dateStr = date.toLocaleDateString();
          const timeStr = date.toLocaleTimeString();
          
          const row = [
            dateStr,
            timeStr,
            this.getActorName(log),
            this.getActionDisplayName(log.action),
            log.description,
            this.getTargetName(log)
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
        
        this.downloadCSV(csvContent, 'activity_logs.csv');
      },
      error: (error) => {
        console.error('Error exporting logs:', error);
      }
    });
  }
  
  private downloadCSV(csvContent: string, filename: string): void {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    // Create a URL for the blob
    const url = URL.createObjectURL(blob);
    
    // Set link properties
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    // Add to document, click and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  
  systemStatusCheck(): void {
    this.checkSystemStatus();
    alert('System status check completed.');
  }
}
