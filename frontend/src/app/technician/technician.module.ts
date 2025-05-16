import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { TechnicianDashboardComponent } from './technician-dashboard/technician-dashboard.component';
import { DoctorManagementComponent } from './components/doctor-management/doctor-management.component';
import { NavbarComponent } from './components/navbar/navbar.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { DoctorLogsComponent } from './components/doctor-logs/doctor-logs.component';
import { DashboardContentComponent } from './components/dashboard-content/dashboard-content.component';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    TechnicianDashboardComponent,
    DoctorManagementComponent,
    NavbarComponent,
    SidebarComponent,
    DoctorLogsComponent,
    DashboardContentComponent
  ]
})
export class TechnicianModule { }
