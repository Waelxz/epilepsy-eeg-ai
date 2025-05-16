import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, NavigationEnd, Router } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { NavbarComponent } from '../components/navbar/navbar.component';
import { SidebarComponent } from '../components/sidebar/sidebar.component';
import { AppSettingsService } from '../../shared/services/app-settings.service';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule,
    NavbarComponent,
    SidebarComponent
  ],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent implements OnInit {
  constructor(
    private authService: AuthService,
    private appSettingsService: AppSettingsService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Listen for navigation events to check if we need to revert settings
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      // If we're on dashboard or logs page and have unsaved settings changes, revert them
      if ((event.url.includes('/admin/dashboard') || 
           event.url.includes('/admin/logs') || 
           event.url.includes('/admin/doctors') ||
           event.url.includes('/admin/technicians')) && 
          this.appSettingsService.hasUnsavedChanges()) {
        // Revert any unsaved settings changes
        this.appSettingsService.revertToSavedSettings();
      }
    });
  }

  logout(): void {
    this.authService.logout();
  }
}
