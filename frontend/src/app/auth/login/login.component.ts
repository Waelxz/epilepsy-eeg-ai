import { Component } from '@angular/core';
import { AuthService } from '../auth.service';
import { Router } from '@angular/router';


@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  username = '';
  password = '';

  constructor(private authService: AuthService, private router: Router) {}

  login() {
    this.authService.login(this.username, this.password).subscribe(
      (response: any) => {
        localStorage.setItem('auth_token', response.access_token);
        const role = this.authService.getUserRole();
        if (role === 'doctor') {
          this.router.navigate(['/doctor']);
        } else if (role === 'technician') {
          this.router.navigate(['/technician']);
        }
      },
      (error) => {
        console.error('Login failed', error);
      }
    );
  }
}