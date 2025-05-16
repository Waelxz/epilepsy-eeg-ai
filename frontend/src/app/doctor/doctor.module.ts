import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DoctorDashboardComponent } from './doctor-dashboard/doctor-dashboard.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { NavbarComponent } from './components/navbar/navbar.component';
import { ImportButtonComponent } from './components/import-button/import-button.component';
import { DashboardContentComponent } from './components/dashboard-content/dashboard-content.component';

@NgModule({
  declarations: [
    
  ],
  imports: [
    CommonModule,
    SidebarComponent,
    NavbarComponent,
    ImportButtonComponent,
    DashboardContentComponent
  ]
})
export class DoctorModule { } 