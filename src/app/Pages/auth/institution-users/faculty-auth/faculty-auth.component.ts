import { Component } from '@angular/core';
import { InstitutionSelectionComponent } from "../institution-selector/institution-selector.component";
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InstitutionDataType } from '../../../../../../INTERFACE/institution';
import { AuthService } from '../../../../core/services/AuthService/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-faculty-auth',
  standalone: true,
  imports: [InstitutionSelectionComponent, CommonModule, FormsModule],
  templateUrl: './faculty-auth.component.html',
  styleUrls: ['./faculty-auth.component.css']
})
export class FacultyAuthComponent {
  selectedInstitution: InstitutionDataType | null = null;
  loginData = { userId: '', password: '' };
  signupData = { email: '', name: '', password: '', confirmPassword: '' };
  loading = false;
  error = '';
  showSignup = false;

  constructor(private auth: AuthService, private router: Router) {}

  onInstitutionSelected(inst: InstitutionDataType | null): void {
    this.selectedInstitution = inst;
    this.error = '';
    this.showSignup = false;
  }

  login(): void {
    this.error = '';
    if (!this.loginData.userId || !this.loginData.password) {
      this.error = 'Please enter credentials';
      return;
    }

    this.loading = true;
    this.auth.login(this.loginData.userId, this.loginData.password).subscribe({
      next: (res: any) => {
        this.loading = false;
        if (res?.token) this.auth.saveToken(res.token);
        // ✅ FIX: Redirect to Teacher Dashboard
        this.router.navigate(['/dashboard/teacher']);
      },
      error: (err: any) => {
        this.loading = false;
        this.error = err?.error?.message || 'Login failed';
        console.error('Faculty login error', err);
      }
    });
  }

  toggleSignup(show: boolean) {
    this.showSignup = show;
    this.error = '';
  }

  signup(): void {
    this.error = '';
    if (!this.signupData.email || !this.signupData.password) {
      this.error = 'Email and password required';
      return;
    }
    if (this.signupData.password !== this.signupData.confirmPassword) {
      this.error = 'Passwords do not match';
      return;
    }
    if (!this.selectedInstitution) {
      this.error = 'Select your institution first';
      return;
    }

    this.loading = true;
    const instId: number = Number((this.selectedInstitution as any).id);

    const payload = {
      email: this.signupData.email,
      name: this.signupData.name,
      password: this.signupData.password,
      roles: ['TEACHER'],
      userType: 'INSTITUTE',
      institutionId: instId
    };

    this.auth.register(payload).subscribe({
      next: (_: any) => {
        this.loading = false;
        alert('Registration successful. Please login.');
        this.showSignup = false;
        this.loginData.userId = this.signupData.email;
      },
      error: (err: any) => {
        this.loading = false;
        this.error = err?.error?.message || 'Registration failed';
        console.error('Faculty signup error', err);
      }
    });
  }
}