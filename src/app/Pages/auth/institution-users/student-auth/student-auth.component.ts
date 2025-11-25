import { Component } from '@angular/core';
import { InstitutionSelectionComponent } from "../institution-selector/institution-selector.component";
import { InstitutionDataType } from '../../../../../../INTERFACE/institution';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../core/services/AuthService/auth.service';
import { Router, ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-student-auth',
  standalone: true,
  imports: [InstitutionSelectionComponent, CommonModule, FormsModule],
  templateUrl: './student-auth.component.html',
  styleUrls: ['./student-auth.component.css']
})
export class StudentAuthComponent {
  selectedInstitution: InstitutionDataType | null = null;
  loginData = { email: '', password: '' };
  signupData = { email: '', name: '', password: '', confirmPassword: '', institutionId: null as number | null };
  isLogin = true;
  loading = false;
  error = '';
  returnUrl: string | null = null;

  constructor(
    private auth: AuthService, 
    private router: Router,
    private route: ActivatedRoute
  ) {
    // Capture returnUrl from parameters (e.g. /play/3FB8C6)
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || null;
  }

  onInstitutionSelected(inst: InstitutionDataType | null): void {
    this.selectedInstitution = inst;
    this.error = '';
    // Ensure the institution ID is stored for submission payload
    if (inst && (inst as any).id != null) {
      this.signupData.institutionId = Number((inst as any).id);
    } else {
      this.signupData.institutionId = null;
    }
  }

  onLogin() {
    this.error = '';
    if (!this.loginData.email || !this.loginData.password) {
      this.error = 'Email & password required';
      return;
    }
    this.loading = true;
    this.auth.login(this.loginData.email, this.loginData.password).subscribe({
      next: (res: any) => {
        this.loading = false;
        if (res?.token) this.auth.saveToken(res.token);
        
        // ✅ CLEANED: Redirect back to the quiz link if it exists, otherwise go to the Student Dashboard.
        this.router.navigateByUrl(this.returnUrl || '/dashboard/student');
      },
      error: (err: any) => {
        this.loading = false;
        this.error = err?.error?.message || 'Login failed';
        console.error('Student login error', err);
      }
    });
  }

  onSignup() {
    this.error = '';
    if (!this.signupData.email || !this.signupData.password) {
      this.error = 'Email & password required';
      return;
    }
    if (this.signupData.password !== this.signupData.confirmPassword) {
      this.error = 'Passwords do not match';
      return;
    }

    const instIdCandidate = this.signupData.institutionId ?? (this.selectedInstitution ? (this.selectedInstitution as any).id : null);
    const instId = instIdCandidate != null ? Number(instIdCandidate) : null;

    if (!instId) {
      this.error = 'Choose your institution';
      return;
    }

    this.loading = true;

    const payload = {
      email: this.signupData.email,
      name: this.signupData.name,
      password: this.signupData.password,
      roles: ['STUDENT'],
      userType: 'INSTITUTE',
      institutionId: instId
    };

    this.auth.register(payload).subscribe({
      next: (_: any) => {
        this.loading = false;
        alert('Registration successful. Please login.');
        this.isLogin = true;
        this.loginData.email = this.signupData.email;
      },
      error: (err: any) => {
        this.loading = false;
        this.error = err?.error?.message || 'Registration failed';
        console.error('Student signup error', err);
      }
    });
  }

  toggleMode(loginMode: boolean) {
    this.isLogin = loginMode;
    this.error = '';
  }
}