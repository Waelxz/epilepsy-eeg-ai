import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './auth/auth.guard';
import { LoginComponent } from './auth/login/login.component';
import { DoctorDashboardComponent } from './doctor/doctor-dashboard/doctor-dashboard.component';
import { TechnicianDashboardComponent } from './technician/technician-dashboard/technician-dashboard.component';
import { AdminDashboardComponent } from './admin/admin-dashboard/admin-dashboard.component';
import { UnauthorizedComponent } from './shared/unauthorized/unauthorized.component';
import { DoctorManagementComponent } from './technician/components/doctor-management/doctor-management.component';
import { DoctorLogsComponent } from './technician/components/doctor-logs/doctor-logs.component';
import { DashboardContentComponent as TechnicianDashboardContentComponent } from './technician/components/dashboard-content/dashboard-content.component';
import { ProfileComponent as TechnicianProfileComponent } from './technician/components/profile/profile.component';
import { SettingsComponent as TechnicianSettingsComponent } from './technician/components/settings/settings.component';
import { ChangePasswordComponent as TechnicianChangePasswordComponent } from './technician/components/change-password/change-password.component';
import { DashboardContentComponent as AdminDashboardContentComponent } from './admin/components/dashboard-content/dashboard-content.component';
import { DoctorManagementComponent as AdminDoctorManagementComponent } from './admin/components/doctor-management/doctor-management.component';
import { TechnicianManagementComponent } from './admin/components/technician-management/technician-management.component';
import { ModelManagementComponent } from './admin/components/model-management/model-management.component';
import { LogsViewerComponent } from './admin/components/logs-viewer/logs-viewer.component';
import { ProfileComponent as AdminProfileComponent } from './admin/components/profile/profile.component';
import { SettingsComponent as AdminSettingsComponent } from './admin/components/settings/settings.component';
import { ChangePasswordComponent as AdminChangePasswordComponent } from './admin/components/change-password/change-password.component';

// Import Doctor module components
import { DashboardContentComponent as DoctorDashboardContentComponent } from './doctor/components/dashboard-content/dashboard-content.component';
import { PatientListComponent } from './doctor/components/patient-list/patient-list.component';
import { PatientDetailsComponent } from './doctor/components/patient-details/patient-details.component';
import { PatientCreateComponent } from './doctor/components/patient-create/patient-create.component';
import { AnalysisNewComponent } from './doctor/components/analysis-new/analysis-new.component';
import { AnalysisDetailsComponent } from './doctor/components/analysis-details/analysis-details.component';
import { AnalysisHistoryComponent } from './doctor/components/analysis-history/analysis-history.component';
import { ReportsListComponent } from './doctor/components/reports-list/reports-list.component';
import { SettingsComponent as DoctorSettingsComponent } from './doctor/components/settings/settings.component';
import { ProfileComponent as DoctorProfileComponent } from './doctor/components/profile/profile.component';

export const routes: Routes = [
  // Admin routes with role protection
  { 
    path: 'admin', 
    component: AdminDashboardComponent, 
    canActivate: [AuthGuard], 
    data: { role: 'admin' },
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: AdminDashboardContentComponent },
      { path: 'doctors', component: AdminDoctorManagementComponent },
      { path: 'technicians', component: TechnicianManagementComponent },
      { path: 'logs', component: LogsViewerComponent },
      { path: 'models', component: ModelManagementComponent },
      { path: 'settings', component: AdminSettingsComponent },
      { path: 'profile', component: AdminProfileComponent },
      { path: 'change-password', component: AdminChangePasswordComponent }
    ]
  },
  
  // Doctor routes with role protection
  { 
    path: 'doctor', 
    component: DoctorDashboardComponent, 
    canActivate: [AuthGuard], 
    data: { role: 'doctor' },
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DoctorDashboardContentComponent },
      { path: 'patients', component: PatientListComponent },
      { path: 'patients/new', redirectTo: 'patients', pathMatch: 'full' },
      { path: 'patients/:id', component: PatientDetailsComponent },
      { path: 'new-analysis', component: AnalysisNewComponent },
      { path: 'analysis-history', component: AnalysisHistoryComponent },
      { path: 'analysis/:id', component: AnalysisDetailsComponent },
      { path: 'reports', component: ReportsListComponent },
      { path: 'reports/:id', component: AnalysisDetailsComponent },
      { path: 'settings', component: DoctorSettingsComponent },
      { path: 'profile', component: DoctorProfileComponent },
      // More doctor routes will be added as we create components
    ]
  },
  
  // Technician routes with role protection
  { 
    path: 'technician', 
    component: TechnicianDashboardComponent, 
    canActivate: [AuthGuard], 
    data: { role: 'technician' },
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: TechnicianDashboardContentComponent },
      { path: 'doctors', component: DoctorManagementComponent },
      { path: 'logs', component: DoctorLogsComponent },
      { path: 'profile', component: TechnicianProfileComponent },
      { path: 'settings', component: TechnicianSettingsComponent },
      { path: 'change-password', component: TechnicianChangePasswordComponent }
    ]
  },
  
  // Public routes
  { path: 'login', component: LoginComponent },
  { path: 'unauthorized', component: UnauthorizedComponent },
  
  // Default route redirects to login
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  
  // Catch-all route - redirect to login
  { path: '**', redirectTo: '/login' }
];