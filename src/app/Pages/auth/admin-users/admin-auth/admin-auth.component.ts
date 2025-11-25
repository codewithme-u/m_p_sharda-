// src/app/Pages/auth/admin-users/admin-auth/admin-auth.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/services/AuthService/auth.service';
import { HttpResponse } from '@angular/common/http';

@Component({
  selector: 'app-admin-auth',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-auth.component.html',
  styleUrls: ['./admin-auth.component.css']
})
export class AdminAuthComponent {
  adminLoginData = { email: '', password: '' };
  loginError = false;
  loading = false;
  errorMessage = '';

  constructor(private router: Router, private auth: AuthService) {}

  onAdminLogin(): void {
    this.loginError = false;
    this.errorMessage = '';

    if (!this.adminLoginData.email || !this.adminLoginData.password) {
      this.loginError = true;
      this.errorMessage = 'Email and password are required.';
      return;
    }

    this.loading = true;

    // DEBUG: show outgoing payload
    console.debug('Admin login payload:', { ...this.adminLoginData });

    // use loginWithResponse so we can inspect status/headers/body
    this.auth.loginWithResponse(this.adminLoginData.email, this.adminLoginData.password)
      .subscribe({
        next: (resp: HttpResponse<any>) => {
          this.loading = false;
          console.debug('Login HTTP response status:', resp.status, 'headers:', resp.headers);
          console.debug('Login response body:', resp.body);

          const body = resp.body || {};
          if (body?.token) {
            this.auth.saveToken(body.token);
          }

          // roles may be array or Set-like; normalize
          const roles: string[] = Array.isArray(body?.roles) ? body.roles : (body?.roles ? Array.from(body.roles) : []);

          if (roles.includes('ADMIN')) {
            this.router.navigateByUrl('/dashboard/admin');
          } else {
            this.auth.logout();
            this.loginError = true;
            this.errorMessage = 'You do not have admin privileges.';
          }
        },
        error: (err: any) => {
          this.loading = false;
          this.loginError = true;

          // Log full error for debugging
          console.error('Admin login error (full):', err);

          // Try to derive friendly message
          if (err?.error?.message) {
            this.errorMessage = err.error.message;
          } else if (err?.status === 0) {
            this.errorMessage = 'Network error / backend unreachable';
          } else if (err?.status === 401) {
            this.errorMessage = 'Invalid credentials';
          } else {
            this.errorMessage = 'Login failed. Check console for details.';
          }
        }
      });
  }
}
