import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, Subject, BehaviorSubject, tap, catchError, of } from 'rxjs';
import { InstitutionDataType } from '../../../../../INTERFACE/institution';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class InstitutionService {
  private baseUrl: string;

  // 🔄 Notify components when changes happen (real-time refresh)
  private _refreshNeeded$ = new Subject<void>();
  get refreshNeeded$() {
    return this._refreshNeeded$;
  }

  // ⏳ Loading state for UI
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  constructor(private http: HttpClient) {
    // Build base URL like AuthService & AdminService
    const apiRoot = environment?.apiUrl && environment.apiUrl.trim().length
      ? environment.apiUrl.replace(/\/$/, '') // remove trailing slash
      : '';

    this.baseUrl = apiRoot ? `${apiRoot}/api/institutions` : '/api/institutions';
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
  // CRUD OPERATIONS
  // ============================

  getInstitutionList(): Observable<InstitutionDataType[]> {
    this.loadingSubject.next(true);

    return this.http.get<InstitutionDataType[]>(this.baseUrl, this.makeHeaders()).pipe(
      tap(() => this.loadingSubject.next(false)),
      catchError(err => {
        this.loadingSubject.next(false);
        console.error('getInstitutionList error', err);
        return of([] as InstitutionDataType[]);
      })
    );
  }

  getInstituteById(id: number): Observable<InstitutionDataType> {
    return this.http.get<InstitutionDataType>(`${this.baseUrl}/${id}`, this.makeHeaders()).pipe(
      catchError(err => {
        console.error(`getInstituteById(${id}) failed`, err);
        throw err;
      })
    );
  }

  createInstitution(formData: FormData): Observable<any> {
    return this.http.post<any>(this.baseUrl, formData, this.makeHeaders()).pipe(
      tap(() => this._refreshNeeded$.next()),
      catchError(err => {
        console.error('createInstitution failed', err);
        throw err;
      })
    );
  }

  updateInstitution(id: number, formData: FormData): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/${id}`, formData, this.makeHeaders()).pipe(
      tap(() => this._refreshNeeded$.next()),
      catchError(err => {
        console.error(`updateInstitution(${id}) failed`, err);
        throw err;
      })
    );
  }

  deleteInstitution(id: number): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}/${id}`, this.makeHeaders()).pipe(
      tap(() => this._refreshNeeded$.next()),
      catchError(err => {
        console.error(`deleteInstitution(${id}) failed`, err);
        throw err;
      })
    );
  }
}
