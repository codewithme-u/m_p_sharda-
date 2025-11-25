// src/app/core/services/AuthService/auth.service.ts
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';
import { HttpResponse } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  // Build base URL from environment. When developing with ng serve + proxy,
  // environment.apiUrl should be '' (or undefined) so we use the relative '/api/auth'.
  private baseUrl: string;

  // ✅ 1. Create a BehaviorSubject to track login state (Initial value checks localStorage)
  private loggedInSubject = new BehaviorSubject<boolean>(this.hasToken());
  
  // ✅ 2. Expose it as an Observable so components can subscribe
  public isLoggedIn$ = this.loggedInSubject.asObservable();

  constructor(private http: HttpClient) {
    const apiRoot = environment?.apiUrl && environment.apiUrl.trim().length
      ? environment.apiUrl.replace(/\/$/, '') // remove trailing slash if any
      : '';
    this.baseUrl = apiRoot ? `${apiRoot}/api/auth` : '/api/auth';
  }

  // Helper to check localStorage directly
  private hasToken(): boolean {
    return !!localStorage.getItem('token');
  }

  // normal login
  login(email: string, password: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/login`, { email, password });
  }

  loginWithResponse(email: string, password: string): Observable<HttpResponse<any>> {
    return this.http.post<any>(`${this.baseUrl}/login`, { email, password }, { observe: 'response' });
  }

  register(payload: {
    email: string;
    name: string;
    password: string;
    roles: string[];
    userType: string;
    institutionId?: number | null;
  }): Observable<any> {
    return this.http.post(`${this.baseUrl}/register`, payload);
  }

  saveToken(token: string): void {
    localStorage.setItem('token', token);
    // ✅ 3. Notify app that user is logged in
    this.loggedInSubject.next(true);
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  logout(): void {
    localStorage.removeItem('token');
    // ✅ 4. Notify app that user is logged out
    this.loggedInSubject.next(false);
  }

  isLoggedIn(): boolean {
    return this.hasToken();
  }
}
