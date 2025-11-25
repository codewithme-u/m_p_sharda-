// src/app/core/services/AdminService/admin.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, interval, Observable, of } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';
import { InstitutionDataType } from '../../../../../INTERFACE/institution';

export interface InstitutionStat {
  institutionId: number;
  name?: string;
  studentCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  // adjust base URL to match your backend
  private baseInstitutions = 'http://localhost:8080/api/institutions';
  private baseStats = 'http://localhost:8080/api/stats/institutions';

  private institutionsSubject = new BehaviorSubject<InstitutionDataType[]>([]);
  public institutions$ = this.institutionsSubject.asObservable();

  constructor(private http: HttpClient) {
    // initial load
    this.loadInstitutions();

    // polling to keep list fresh every 10s
    interval(10000).pipe(
      switchMap(() => this.fetchInstitutions()),
      catchError(err => {
        console.error('Institutions poll failed', err);
        return of([]);
      })
    ).subscribe(list => this.institutionsSubject.next(list || []));
  }

  // HTTP wrappers
  fetchInstitutions(): Observable<InstitutionDataType[]> {
    return this.http.get<InstitutionDataType[]>(this.baseInstitutions);
  }

  getInstitution(id: number): Observable<InstitutionDataType> {
    return this.http.get<InstitutionDataType>(`${this.baseInstitutions}/${id}`);
  }

  createInstitution(formData: FormData): Observable<any> {
    return this.http.post<any>(this.baseInstitutions, formData).pipe(
      tap(() => this.loadInstitutions())
    );
  }

  updateInstitution(id: number, formData: FormData): Observable<any> {
    return this.http.put<any>(`${this.baseInstitutions}/${id}`, formData).pipe(
      tap(() => this.loadInstitutions())
    );
  }

  deleteInstitution(id: number): Observable<any> {
    return this.http.delete<any>(`${this.baseInstitutions}/${id}`).pipe(
      tap(() => this.loadInstitutions())
    );
  }

  // stats
  fetchInstitutionStats(): Observable<InstitutionStat[]> {
    return this.http.get<InstitutionStat[]>(this.baseStats);
  }

  // helpers
  loadInstitutions(): void {
    this.fetchInstitutions().subscribe({
      next: list => this.institutionsSubject.next(list || []),
      error: err => console.error('Failed load institutions', err)
    });
  }

  // manual push (for optimistic updates if needed)
  pushLocalInstitutions(list: InstitutionDataType[]) {
    this.institutionsSubject.next(list);
  }
}
