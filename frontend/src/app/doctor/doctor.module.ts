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
export class DoctorModule { } 