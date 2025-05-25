import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { DoctorDashboardComponent } from './doctor-dashboard/doctor-dashboard.component';

// Import other components
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { NavbarComponent } from './components/navbar/navbar.component';
import { ImportButtonComponent } from './components/import-button/import-button.component';
import { DashboardContentComponent } from './components/dashboard-content/dashboard-content.component';
import { PatientListComponent } from './components/patient-list/patient-list.component';
import { PatientDetailsComponent } from './components/patient-details/patient-details.component';
import { PatientCreateComponent } from './components/patient-create/patient-create.component';
import { AnalysisNewComponent } from './components/analysis-new/analysis-new.component';
import { AnalysisHistoryComponent } from './components/analysis-history/analysis-history.component';

import { PatientService } from '../shared/services/patient.service';
import { AnalysisService } from '../shared/services/analysis.service';

// Function to prepare doctor-specific dark theme styles
export function prepareDoctorDarkTheme() {
  if (typeof document !== 'undefined') {  // Check if in browser environment
    // Add doctor-module class to enable scoping
    document.body.classList.add('doctor-module');
    
    // Check if we should apply the doctor dark theme based on saved preference
    const isDoctorDarkMode = localStorage.getItem('doctor_dark_mode') === 'true';
    if (isDoctorDarkMode) {
      document.body.classList.add('theme-dark');
      // Pre-load the theme CSS
      if (!document.getElementById('doctor-dark-theme-styles')) {
        const styleEl = document.createElement('link');
        styleEl.id = 'doctor-dark-theme-styles';
        styleEl.rel = 'stylesheet';
        styleEl.href = 'assets/doctor-dark-theme.css';
        document.head.appendChild(styleEl);
      }
    }
  }
}

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    RouterModule,
    DoctorDashboardComponent,
    SidebarComponent,
    NavbarComponent,
    DashboardContentComponent,
    ImportButtonComponent,
    PatientListComponent,
    PatientDetailsComponent,
    PatientCreateComponent,
    AnalysisNewComponent,
    AnalysisHistoryComponent
  ],
  providers: [PatientService, AnalysisService]
})
export class DoctorModule { 
  constructor() {
    // Prepare for doctor-specific dark theme (but don't force it)
    prepareDoctorDarkTheme();
  }
} 