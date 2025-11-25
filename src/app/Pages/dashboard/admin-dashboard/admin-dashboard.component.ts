import { Component } from '@angular/core';
import { InstitutionsComponent } from '../../auth/institutions/institutions.component';
import { InstitutionsStatsComponent } from './institutions-stats/institutions-stats.component';
import { AuthService } from '../../../core/services/AuthService/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    InstitutionsComponent,
    InstitutionsStatsComponent
  ],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent {
  totalInstitutions = 0;

  constructor(private auth: AuthService, private router: Router) {}

  logout() {
    this.auth.logout();
    this.router.navigate(['/home']);
  }

  // Receive count from child component
  updateCount(count: number) {
    this.totalInstitutions = count;
  }
}