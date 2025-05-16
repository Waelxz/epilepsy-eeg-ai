import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    // First check if user is logged in
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
      return false;
    }

    // Check if route requires specific role
    const requiredRole = route.data['role'] as string;
    if (requiredRole) {
      const userRole = this.authService.getUserRole();
      
      // If user doesn't have the required role, redirect to unauthorized page
      if (userRole !== requiredRole) {
        this.router.navigate(['/unauthorized']);
        return false;
      }
    }

    return true;
  }
}