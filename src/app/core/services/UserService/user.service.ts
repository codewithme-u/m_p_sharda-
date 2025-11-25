// src/app/core/services/UserService/user.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, catchError, Observable, of, tap } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private baseUrl: string;

  // Loading state for UI
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  constructor(private http: HttpClient) {
    const apiRoot = environment?.apiUrl && environment.apiUrl.trim().length
      ? environment.apiUrl.replace(/\/$/, '')
      : '';

    this.baseUrl = apiRoot ? `${apiRoot}/api/users` : '/api/users';
  }

  // Attach Authorization header if token exists
  private makeHeaders(): { headers?: HttpHeaders } {
    const token = localStorage.getItem('token');
    if (token) {
      return {
        headers: new HttpHeaders({
          'Authorization': `Bearer ${token}`
        })
      };
    }
    return {};
  }

  // ============================
  // User Operations
  // ============================

  // Get current user details
  getMe(): Observable<any> {
    this.loadingSubject.next(true);

    return this.http.get(`${this.baseUrl}/me`, this.makeHeaders()).pipe(
      tap(() => this.loadingSubject.next(false)),
      catchError(err => {
        this.loadingSubject.next(false);
        console.error('getMe failed', err);
        return of(null);
      })
    );
  }

  // Update Profile (FormData for image upload)
  updateProfile(formData: FormData): Observable<any> {
    return this.http.put(`${this.baseUrl}/me`, formData, this.makeHeaders()).pipe(
      catchError(err => {
        console.error('updateProfile failed', err);
        throw err;
      })
    );
  }

  // Change Password
  changePassword(payload: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/change-password`, payload, {
      ...this.makeHeaders(),
      responseType: 'text'
    }).pipe(
      catchError(err => {
        console.error('changePassword failed', err);
        throw err;
      })
    );
  }
}
