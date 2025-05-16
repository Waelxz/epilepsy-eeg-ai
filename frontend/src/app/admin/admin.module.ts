import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { AdminDashboardComponent } from './admin-dashboard/admin-dashboard.component';

import { LogsViewerComponent } from './components/logs-viewer/logs-viewer.component';
import { NavbarComponent } from './components/navbar/navbar.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { DashboardContentComponent } from './components/dashboard-content/dashboard-content.component';
import { DoctorManagementComponent } from './components/doctor-management/doctor-management.component';
import { TechnicianManagementComponent } from './components/technician-management/technician-management.component';
import { ModelManagementComponent } from './components/model-management/model-management.component';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    AdminDashboardComponent,
    
    LogsViewerComponent,
    NavbarComponent,
    SidebarComponent,
    DashboardContentComponent,
    DoctorManagementComponent,
    TechnicianManagementComponent,
    ModelManagementComponent
  ]
})
export class AdminModule { }
