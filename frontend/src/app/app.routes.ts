import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './auth/auth.guard';
import { LoginComponent } from './auth/login/login.component';
import { DoctorDashboardComponent } from './doctor/doctor-dashboard/doctor-dashboard.component';
import { TechnicianDashboardComponent } from './technician/technician-dashboard/technician-dashboard.component';

export const routes: Routes = [
  { path: 'doctor', component: DoctorDashboardComponent, canActivate: [AuthGuard], data: { role: 'doctor' } },
  { path: 'technician', component: TechnicianDashboardComponent, canActivate: [AuthGuard], data: { role: 'technician' } },
  { path: 'login', component: LoginComponent },
  { path: '', redirectTo: '/login', pathMatch: 'full' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}