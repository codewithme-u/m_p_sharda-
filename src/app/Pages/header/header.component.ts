import { Component, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/AuthService/auth.service';
import { jwtDecode } from 'jwt-decode';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLinkActive, RouterLink, CommonModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css'
})
export class HeaderComponent implements OnInit {
  
  isLoggedIn = false;
  // ✅ FIX 1: Initialize to a valid, catch-all route (like general)
  dashboardPath: string = '/dashboard/general'; 
  
  isQuizLockedView: boolean = false;

  constructor(private auth: AuthService, private router: Router) {}

  ngOnInit(): void {
    this.auth.isLoggedIn$.subscribe(status => {
      this.isLoggedIn = status;
      if (status) {
        this.checkUserRole();
      } else {
        this.dashboardPath = '/home'; // Go back to home if logged out
      }
    });

    this.router.events.subscribe(() => {
        this.isQuizLockedView = this.router.url.includes('/play/');
    });
  }

  // Determines the user's highest role and sets the corresponding dashboard path
  checkUserRole(): void {
    const token = this.auth.getToken();
    if (!token) {
      this.dashboardPath = '/home';
      return;
    }

    try {
      const decodedToken: any = jwtDecode(token);
      const roles: string[] = decodedToken.roles || [];

      // Priority check based on roles
      if (roles.includes('ADMIN')) {
        this.dashboardPath = '/dashboard/admin';
      } else if (roles.includes('TEACHER')) {
        this.dashboardPath = '/dashboard/teacher';
      } else if (roles.includes('STUDENT')) {
        this.dashboardPath = '/dashboard/student';
      } else {
        // Fallback for General user or if roles array is empty
        this.dashboardPath = '/dashboard/general'; 
      }

    } catch (e) {
      console.error("Error decoding token for role:", e);
      // ✅ FIX 2: Ensure fallback is always a defined route
      this.dashboardPath = '/dashboard/general'; 
    }
  }

  onLogout(): void {
    this.auth.logout();
    this.router.navigate(['/home']);
  }
}