import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, NavigationEnd, Router } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { NavbarComponent } from '../components/navbar/navbar.component';
import { SidebarComponent } from '../components/sidebar/sidebar.component';
import { AppSettingsService } from '../../shared/services/app-settings.service';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-technician-dashboard',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule,
    NavbarComponent,
    SidebarComponent
  ],
  templateUrl: './technician-dashboard.component.html',
  styleUrls: ['./technician-dashboard.component.css']
})
export class TechnicianDashboardComponent implements OnInit {
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
      if ((event.url.includes('/technician/dashboard') || 
           event.url.includes('/technician/logs') || 
           event.url.includes('/technician/doctors')) && 
          this.appSettingsService.hasUnsavedChanges()) {
        // Revert any unsaved settings changes
        this.appSettingsService.revertToSavedSettings();
      }
    });
  }
}
