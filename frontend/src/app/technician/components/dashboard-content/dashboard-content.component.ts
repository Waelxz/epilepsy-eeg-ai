import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { interval, Subscription, forkJoin } from 'rxjs';
import { LogsService, Log, PaginatedResponse } from '../../../shared/services/logs.service';
import { AuthService } from '../../../auth/auth.service';
import { UserService } from '../../../shared/services/user.service';
import { AppSettingsService } from '../../../shared/services/app-settings.service';

interface Doctor {
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
}

@Component({
  selector: 'app-dashboard-content',
  standalone: true,
  imports: [CommonModule, RouterModule],
  providers: [LogsService, UserService, AuthService],
  templateUrl: './dashboard-content.component.html',
  styleUrl: './dashboard-content.component.css'
})
export class DashboardContentComponent implements OnInit, OnDestroy {
  // User information
  technicianName: string = 'Technician';
  lastLogin: Date | null = null;
  
  // Date and time
  currentDate: Date = new Date();
  currentTime: string = '';
  timeSubscription: Subscription | null = null;
  
  // Statistics
  activeDoctorsCount: number = 0;
  inactiveDoctorsCount: number = 0;
  totalLogsCount: number = 0;
  doctorsTrend: number = 0;
  
  // System status
  systemOnline: boolean = true;
  uptime: string = '';
  
  // Logs
  recentLogs: Log[] = [];
  isLoadingLogs: boolean = true;

  // Doctors data for export
  doctors: Doctor[] = [];
  
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
    
    // Load technician info
    this.loadTechnicianInfo();
    
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
  
  loadTechnicianInfo(): void {
    const storedUser = localStorage.getItem('user');
    
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        // Use full name (first + last name) when available
        if (user.name && user.lastname) {
          this.technicianName = `${user.name} ${user.lastname}`;
        } else if (user.name && user.last_name) {
          this.technicianName = `${user.name} ${user.last_name}`;
        } else if (user.first_name && user.lastname) {
          this.technicianName = `${user.first_name} ${user.lastname}`;
        } else if (user.first_name && user.last_name) {
          this.technicianName = `${user.first_name} ${user.last_name}`;
        } else {
          this.technicianName = user.name || user.first_name || 'Technician';
        }
        this.lastLogin = user.lastLogin ? new Date(user.lastLogin) : null;
      } catch (e) {
        console.error('Error parsing user data', e);
        this.setDefaultTechnicianName();
      }
    } else {
      this.setDefaultTechnicianName();
    }
  }
  
  // Set a default name when no user data exists
  private setDefaultTechnicianName(): void {
    this.technicianName = 'Admin User';
    
    // Create test user data
    const testUser = {
      name: 'Admin',
      lastname: 'User',
      role: 'TECHNICIAN',
      lastLogin: new Date().toISOString()
    };
    localStorage.setItem('user', JSON.stringify(testUser));
  }
  
  loadDashboardData(): void {
    this.isLoadingLogs = true;
    
    // Try with both capitalized and lowercase role parameter to handle API differences
    this.userService.getUsers('DOCTOR').subscribe({
      next: (doctors) => {
        console.log('Received doctors data:', doctors);
        
        this.doctors = doctors.map(doctor => ({
          id: doctor.id,
          username: doctor.username,
          name: doctor.name || doctor.first_name || '',
          lastname: doctor.lastname || doctor.last_name || '',
          is_active: doctor.is_active !== undefined ? doctor.is_active : true,
          contact_info: doctor.contact_info || { email: '' },
          date_created: doctor.date_created || new Date().toISOString()
        }));
        
        this.activeDoctorsCount = this.doctors.filter(d => d.is_active).length;
        this.inactiveDoctorsCount = this.doctors.filter(d => !d.is_active).length;
        
        // Calculate doctor trend (new doctors in last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
        
        const newLastMonth = this.doctors.filter(d => {
          const creationDate = new Date(d.date_created);
          return creationDate >= thirtyDaysAgo;
        }).length;
        
        const newPreviousMonth = this.doctors.filter(d => {
          const creationDate = new Date(d.date_created);
          return creationDate >= sixtyDaysAgo && creationDate < thirtyDaysAgo;
        }).length;
        
        this.doctorsTrend = newLastMonth - newPreviousMonth;
      },
      error: (error) => {
        console.error('Error loading doctors with DOCTOR role:', error);
        // Try with lowercase 'doctor' if uppercase failed
        this.userService.getUsers('doctor').subscribe({
          next: (doctors) => {
            console.log('Received doctors data with lowercase role:', doctors);
            this.processUserData(doctors);
          },
          error: (err2) => {
            console.error('Error loading doctors with lowercase role:', err2);
            // Final fallback - get all users and filter
            this.userService.getUsers().subscribe({
              next: (users) => {
                console.log('Fetched all users as fallback');
                // Filter users who are doctors
                const doctorUsers = users.filter(user => 
                  user.role === 'DOCTOR' || 
                  user.role === 'doctor'
                );
                this.processUserData(doctorUsers);
              },
              error: (err3) => {
                console.error('All attempts to fetch doctors failed:', err3);
                this.isLoadingLogs = false;
              }
            });
          }
        });
      }
    });
    
    // Get the total logs count for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    let params = new HttpParams()
      .set('start_date', thirtyDaysAgo.toISOString())
      .set('limit', '1') // We only need the count
      .set('skip', '0');
    
    this.http.get<PaginatedResponse<any>>('http://localhost:8000/api/logs', {
      params: params,
      headers: { 'Authorization': `Bearer ${this.authService.getToken()}` }
    }).subscribe({
      next: (response) => {
        this.totalLogsCount = response.metadata.total_count;
      },
      error: (error) => {
        console.error('Error loading logs count:', error);
      }
    });
  }
  
  // Helper method to process user data in a consistent way
  private processUserData(userData: any[]): void {
    this.doctors = userData.map(doctor => ({
      id: doctor.id,
      username: doctor.username,
      name: doctor.name || doctor.first_name || '',
      lastname: doctor.lastname || doctor.last_name || '',
      is_active: doctor.is_active !== undefined ? doctor.is_active : true,
      contact_info: doctor.contact_info || { email: '' },
      date_created: doctor.date_created || new Date().toISOString()
    }));
    
    this.activeDoctorsCount = this.doctors.filter(d => d.is_active).length;
    this.inactiveDoctorsCount = this.doctors.filter(d => !d.is_active).length;
    this.isLoadingLogs = false;
  }
  
  loadRecentLogs(): void {
    this.isLoadingLogs = true;
    
    this.logsService.getLogs({ limit: 3, page: 1 }).subscribe({
      next: (response) => {
        this.recentLogs = response.items;
        this.isLoadingLogs = false;
      },
      error: (error) => {
        console.error('Error loading logs:', error);
        this.isLoadingLogs = false;
      }
    });
  }
  
  checkSystemStatus(): void {
    // Real implementation would check system status from backend
    // For now, just get the server timestamp to calculate uptime
    this.http.get<{ server_time: string, start_time: string }>('http://localhost:8000/api/health', {
      headers: { 'Authorization': `Bearer ${this.authService.getToken()}` }
    }).subscribe({
      next: (response) => {
        if (response.start_time) {
          const startTime = new Date(response.start_time);
          const now = new Date();
          const uptimeMs = now.getTime() - startTime.getTime();
          
          // Calculate days, hours, minutes
          const days = Math.floor(uptimeMs / (1000 * 60 * 60 * 24));
          const hours = Math.floor((uptimeMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          
          this.uptime = `${days} days, ${hours} hours`;
          this.systemOnline = true;
        }
      },
      error: (error) => {
        console.error('Error checking system status:', error);
        // If we can't reach the health endpoint, assume system is having issues
        this.systemOnline = false;
        this.uptime = 'Unknown';
      }
    });
  }
  
  // Helper methods for displaying log info
  getActionClass(action: string): string {
    const actionMap: {[key: string]: string} = {
      'CREATE_DOCTOR': 'action-create',
      'UPDATE_DOCTOR': 'action-update',
      'DEACTIVATE_DOCTOR': 'action-deactivate',
      'ACTIVATE_DOCTOR': 'action-activate',
      'DELETE_DOCTOR': 'action-delete',
      'LOGIN': 'action-login',
      'LOGOUT': 'action-logout',
      'doctor_permissions_update': 'action-update',
      'doctor_password_change': 'action-update',
      'create_doctor': 'action-create',
      'update_doctor': 'action-update',
      'delete_doctor': 'action-delete'
    };
    
    return actionMap[action] || 'action-default';
  }
  
  getActionIcon(action: string): string {
    const actionMap: {[key: string]: string} = {
      'CREATE_DOCTOR': 'fas fa-user-plus',
      'UPDATE_DOCTOR': 'fas fa-user-edit',
      'DEACTIVATE_DOCTOR': 'fas fa-user-slash',
      'ACTIVATE_DOCTOR': 'fas fa-user-check',
      'DELETE_DOCTOR': 'fas fa-user-times',
      'LOGIN': 'fas fa-sign-in-alt',
      'LOGOUT': 'fas fa-sign-out-alt',
      'doctor_permissions_update': 'fas fa-user-shield',
      'doctor_password_change': 'fas fa-key',
      'create_doctor': 'fas fa-user-plus',
      'update_doctor': 'fas fa-user-edit',
      'delete_doctor': 'fas fa-user-times'
    };
    
    return actionMap[action] || 'fas fa-info-circle';
  }
  
  getActionDisplayName(action: string): string {
    const actionMap: {[key: string]: string} = {
      'CREATE_DOCTOR': 'created',
      'UPDATE_DOCTOR': 'updated',
      'DEACTIVATE_DOCTOR': 'deactivated',
      'ACTIVATE_DOCTOR': 'activated',
      'DELETE_DOCTOR': 'deleted',
      'LOGIN': 'logged in',
      'LOGOUT': 'logged out',
      'doctor_permissions_update': 'updated permissions for',
      'doctor_password_change': 'changed password for',
      'create_doctor': 'created',
      'update_doctor': 'updated',
      'delete_doctor': 'deleted'
    };
    
    return actionMap[action] || action.toLowerCase().replace('_', ' ');
  }
  
  getActorName(log: Log): string {
    return log.username || 'System';
  }
  
  getTargetName(log: Log): string {
    if (log.details && log.details.target_account) {
      return log.details.target_account.username || 'Unknown';
    }
    return '';
  }
  
  navigateTo(path: string): void {
    this.router.navigate([path]);
  }
  
  exportDoctorsList(): void {
    if (this.doctors.length === 0) {
      alert('No doctors data available to export');
      return;
    }
    
    // Generate CSV content
    const headers = ['ID', 'Username', 'Name', 'Last Name', 'Active', 'Email', 'Phone', 'Created'];
    const csvRows = [headers];
    
    for (const doctor of this.doctors) {
      const row = [
        doctor.id,
        doctor.username,
        doctor.name,
        doctor.lastname,
        doctor.is_active ? 'Yes' : 'No',
        doctor.contact_info.email,
        doctor.contact_info.phone || 'N/A',
        new Date(doctor.date_created).toLocaleDateString()
      ];
      csvRows.push(row);
    }
    
    // Convert to CSV string
    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    
    // Download the CSV file
    this.downloadCSV(csvContent, 'doctors_list.csv');
  }
  
  exportActivityLogs(): void {
    // Fetch all logs for export (with a reasonable limit)
    this.logsService.getLogs({ limit: 1000, page: 1 }).subscribe({
      next: (response) => {
        const logs = response.items;
        
        if (logs.length === 0) {
          alert('No logs available to export');
          return;
        }
        
        // Generate CSV content
        const headers = ['Timestamp', 'User', 'Action', 'Description'];
    const csvRows = [headers];
    
        for (const log of logs) {
      const row = [
        new Date(log.timestamp).toLocaleString(),
            log.username || 'System',
            log.action,
            log.description
      ];
      csvRows.push(row);
        }
        
        // Convert to CSV string
        const csvContent = csvRows.map(row => row.join(',')).join('\n');
        
        // Download the CSV file
        this.downloadCSV(csvContent, 'activity_logs.csv');
      },
      error: (error) => {
        console.error('Error fetching logs for export:', error);
        alert('Failed to export logs. Please try again.');
      }
    });
  }
  
  private downloadCSV(csvContent: string, filename: string): void {
    // Create a blob with CSV content
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // Create a download link
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
  
  systemStatusCheck(): void {
    // Call the health endpoint to check system status
    this.http.get('http://localhost:8000/api/health').subscribe({
      next: () => {
        alert('System check completed: All systems operational');
        this.systemOnline = true;
        this.checkSystemStatus(); // Refresh uptime
      },
      error: () => {
        alert('System check completed: Issues detected');
        this.systemOnline = false;
      }
    });
  }
} 