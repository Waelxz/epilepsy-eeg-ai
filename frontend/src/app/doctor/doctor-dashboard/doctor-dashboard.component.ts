import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../components/sidebar/sidebar.component';
import { NavbarComponent } from '../components/navbar/navbar.component';
import { ImportButtonComponent } from '../components/import-button/import-button.component';
import { DashboardContentComponent } from '../components/dashboard-content/dashboard-content.component';
import { ChatFloatComponent } from '../components/chat-float/chat-float.component';

@Component({
  selector: 'app-doctor-dashboard',
  templateUrl: './doctor-dashboard.component.html',
  styleUrls: ['./doctor-dashboard.component.css'],
  imports: [
    RouterOutlet,
    SidebarComponent,
    NavbarComponent,
    ChatFloatComponent
  ],
  standalone: true
})
export class DoctorDashboardComponent {}
