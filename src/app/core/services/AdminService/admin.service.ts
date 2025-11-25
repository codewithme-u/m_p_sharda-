// src/app/core/services/AdminService/admin.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, interval, Observable, of } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';
import { InstitutionDataType } from '../../../../../INTERFACE/institution';
import { environment } from '../../../../environments/environment';

export interface InstitutionStat {
  institutionId: number;
  name?: string;
  studentCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  // base endpoints are built from environment.apiUrl (same approach as AuthService)
  private baseInstitutions: string;
  private baseStats: string;

  // Subjects & observables
  private institutionsSubject = new BehaviorSubject<InstitutionDataType[]>([]);
  public institutions$ = this.institutionsSubject.asObservable();

  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  // polling interval in ms (10s default)
  private readonly pollIntervalMs = 10000;

  constructor(private http: HttpClient) {
    const apiRoot = environment?.apiUrl && environment.apiUrl.trim().length
      ? environment.apiUrl.replace(/\/$/, '')
      : '';
    this.baseInstitutions = apiRoot ? `${apiRoot}/api/institutions` : '/api/institutions';
    this.baseStats = apiRoot ? `${apiRoot}/api/stats/institutions` : '/api/stats/institutions';

    // initial load
    this.loadInstitutions();

    // polling to keep list fresh
    interval(this.pollIntervalMs).pipe(
      switchMap(() => this.fetchInstitutions().pipe(
        catchError(err => {
          console.error('Institutions poll failed', err);
          return of([] as InstitutionDataType[]);
        })
      ))
    ).subscribe(list => this.institutionsSubject.next(list || []));
  }

  // Helper: attach Authorization header if token exists in localStorage
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

  // HTTP wrappers

  fetchInstitutions(): Observable<InstitutionDataType[]> {
    this.loadingSubject.next(true);
    return this.http.get<InstitutionDataType[]>(this.baseInstitutions, this.makeHeaders()).pipe(
      tap(() => this.loadingSubject.next(false)),
      catchError(err => {
        this.loadingSubject.next(false);
        console.error('fetchInstitutions error', err);
        return of([] as InstitutionDataType[]);
      })
    );
  }

  getInstitution(id: number): Observable<InstitutionDataType> {
    return this.http.get<InstitutionDataType>(`${this.baseInstitutions}/${id}`, this.makeHeaders()).pipe(
      catchError(err => {
        console.error(`getInstitution(${id}) failed`, err);
        // rethrow-ish: return an observable that errors so callers can handle if they want
        throw err;
      })
    );
  }

  createInstitution(formData: FormData): Observable<any> {
    return this.http.post<any>(this.baseInstitutions, formData, this.makeHeaders()).pipe(
      tap(() => this.loadInstitutions()),
      catchError(err => {
        console.error('createInstitution failed', err);
        throw err;
      })
    );
  }

  updateInstitution(id: number, formData: FormData): Observable<any> {
    return this.http.put<any>(`${this.baseInstitutions}/${id}`, formData, this.makeHeaders()).pipe(
      tap(() => this.loadInstitutions()),
      catchError(err => {
        console.error(`updateInstitution(${id}) failed`, err);
        throw err;
      })
    );
  }

  deleteInstitution(id: number): Observable<any> {
    return this.http.delete<any>(`${this.baseInstitutions}/${id}`, this.makeHeaders()).pipe(
      tap(() => this.loadInstitutions()),
      catchError(err => {
        console.error(`deleteInstitution(${id}) failed`, err);
        throw err;
      })
    );
  }

  // stats
  fetchInstitutionStats(): Observable<InstitutionStat[]> {
    return this.http.get<InstitutionStat[]>(this.baseStats, this.makeHeaders()).pipe(
      catchError(err => {
        console.error('fetchInstitutionStats failed', err);
        return of([] as InstitutionStat[]);
      })
    );
  }

  // helpers
  loadInstitutions(): void {
    this.fetchInstitutions().subscribe({
      next: list => this.institutionsSubject.next(list || []),
      error: err => console.error('Failed load institutions', err)
    });
  }

  // manual push (for optimistic UI updates)
  pushLocalInstitutions(list: InstitutionDataType[]) {
    this.institutionsSubject.next(list);
  }
}
