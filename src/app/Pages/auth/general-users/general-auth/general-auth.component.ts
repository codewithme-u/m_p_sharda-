// src/app/Pages/auth/general-users/general-auth/general-auth.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router'; // ✅ Import ActivatedRoute
import { AuthService } from '../../../../core/services/AuthService/auth.service';

@Component({
  selector: 'app-general-auth',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './general-auth.component.html',
  styleUrls: ['./general-auth.component.css'],
})
export class GeneralAuthComponent {
  loginData = { email: '', password: '' };
  signupData = { email: '', password: '', confirmPassword: '' };
  isLoginSelected = true;

  loading = false;
  error = '';
  returnUrl: string | null = null; // ✅ Variable to store return URL

  constructor(
    private auth: AuthService, 
    private router: Router,
    private route: ActivatedRoute // ✅ Inject ActivatedRoute
  ) {
    // ✅ Capture the returnUrl from the query parameters (if it exists)
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || null;
  }

  toggleForm(isLogin: boolean) {
    this.isLoginSelected = isLogin;
    this.error = '';
  }

  onLogin() {
    this.error = '';
    if (!this.loginData.email || !this.loginData.password) {
      this.error = 'Email and password are required';
      return;
    }

    this.loading = true;

    this.auth.login(this.loginData.email, this.loginData.password).subscribe({
      next: (res: any) => {
        this.loading = false;
        if (res?.token) {
          this.auth.saveToken(res.token);
        }
        
        // ✅ CORRECTED: Check if there is a returnUrl
        if (this.returnUrl) {
          this.router.navigateByUrl(this.returnUrl); // Go back to Quiz (e.g. /play/3FDF34)
        } else {
          this.router.navigate(['/dashboard/general']); // Default to Dashboard
        }
      },
      error: (err: any) => {
        this.loading = false;
        this.error = err?.error?.message || 'Login failed. Please check your credentials.';
        console.error('General login error:', err);
      },
    });
  }

  onSignup() {
    this.error = '';
    if (!this.signupData.email || !this.signupData.password) {
      this.error = 'Email and password are required';
      return;
    }
    if (this.signupData.password !== this.signupData.confirmPassword) {
      this.error = 'Passwords do not match';
      return;
    }

    this.loading = true;

    const payload = {
      email: this.signupData.email,
      name: '',
      password: this.signupData.password,
      roles: ['GENERAL_USER'],
      userType: 'GENERAL',
    };

    this.auth.register(payload).subscribe({
      next: (_: any) => {
        this.loading = false;
        alert('Registration successful. Please login.');
        this.isLoginSelected = true;
      },
      error: (err: any) => {
        this.loading = false;
        
        if (err.status === 403) {
            this.error = 'Registration is currently unavailable due to server security restrictions.';
        } else {
            this.error = err?.error?.message || 'Registration failed. Please try again.';
        }
        
        console.error('General signup error:', err);
      },
    });
  }

  onForgotPassword(event: Event) {
    event.preventDefault();
    alert('Forgot password functionality to be implemented.');
  }
}