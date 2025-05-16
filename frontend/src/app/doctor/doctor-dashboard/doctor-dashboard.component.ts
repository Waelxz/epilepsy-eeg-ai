import { Component } from '@angular/core';
import { SidebarComponent } from '../components/sidebar/sidebar.component';
import { NavbarComponent } from '../components/navbar/navbar.component';
import { ImportButtonComponent } from '../components/import-button/import-button.component';
import { DashboardContentComponent } from '../components/dashboard-content/dashboard-content.component';

@Component({
  selector: 'app-doctor-dashboard',
  templateUrl: './doctor-dashboard.component.html',
  styleUrls: ['./doctor-dashboard.component.css'],
  imports: [
    SidebarComponent,
    NavbarComponent,
    ImportButtonComponent,
    DashboardContentComponent
  ],
  standalone: true
})
export class DoctorDashboardComponent {}
