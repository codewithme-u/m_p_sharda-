// src/app/core/services/QuizService/quiz.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { Quiz } from '../../../../../INTERFACE/quiz';
import { QuizHistory } from '../../../../../INTERFACE/quiz-history';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class QuizService {
  private baseUrl: string;
  private resultUrl: string;

  private _refreshNeeded$ = new Subject<void>();
  get refreshNeeded$() {
    return this._refreshNeeded$;
  }

  // loading observable for UI
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  constructor(private http: HttpClient) {
    const apiRoot = environment?.apiUrl && environment.apiUrl.trim().length
      ? environment.apiUrl.replace(/\/$/, '')
      : '';
    this.baseUrl = apiRoot ? `${apiRoot}/api/quizzes` : '/api/quizzes';
    this.resultUrl = apiRoot ? `${apiRoot}/api/results` : '/api/results';
  }

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

  // Get Quiz by code and extract creator's userType
  getQuizCreatorTypeByCode(code: string): Observable<'GENERAL' | 'INSTITUTE'> {
    return this.http.get<any>(`${this.baseUrl}/code/${code}`, this.makeHeaders()).pipe(
      map(quiz => {
        const creatorType = quiz?.createdBy?.userType;
        return creatorType === 'GENERAL' ? 'GENERAL' : 'INSTITUTE';
      }),
      catchError(err => {
        console.error(`getQuizCreatorTypeByCode(${code}) failed`, err);
        // fallback to INSTITUTE to be conservative
        return of<'GENERAL' | 'INSTITUTE'>('INSTITUTE');
      })
    );
  }

  // Get Created Quizzes
  getAll(): Observable<Quiz[]> {
    this.loadingSubject.next(true);
    return this.http.get<Quiz[]>(this.baseUrl, this.makeHeaders()).pipe(
      tap(() => this.loadingSubject.next(false)),
      catchError(err => {
        this.loadingSubject.next(false);
        console.error('getAll quizzes failed', err);
        return of([] as Quiz[]);
      })
    );
  }

  // Update quiz active status
  updateStatus(id: number, active: boolean): Observable<Quiz> {
    return this.http.put<Quiz>(`${this.baseUrl}/${id}/status`, { active }, this.makeHeaders()).pipe(
      tap(() => this._refreshNeeded$.next()),
      catchError(err => {
        console.error(`updateStatus(${id}) failed`, err);
        throw err;
      })
    );
  }

  // Get single quiz by code
  getByCode(code: string): Observable<Quiz> {
    return this.http.get<Quiz>(`${this.baseUrl}/code/${code}`, this.makeHeaders()).pipe(
      catchError(err => {
        console.error(`getByCode(${code}) failed`, err);
        throw err;
      })
    );
  }

  // NEW: Get Participation History (Real-Time)
  getHistory(): Observable<QuizHistory[]> {
    return this.http.get<QuizHistory[]>(`${this.resultUrl}/history`, this.makeHeaders()).pipe(
      catchError(err => {
        console.error('getHistory failed', err);
        return of([] as QuizHistory[]);
      })
    );
  }

  create(title: string, description: string): Observable<Quiz> {
    return this.http.post<Quiz>(this.baseUrl, { title, description }, this.makeHeaders()).pipe(
      tap(() => this._refreshNeeded$.next()),
      catchError(err => {
        console.error('create quiz failed', err);
        throw err;
      })
    );
  }

  delete(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/${id}`, this.makeHeaders()).pipe(
      tap(() => this._refreshNeeded$.next()),
      catchError(err => {
        console.error(`delete(${id}) failed`, err);
        throw err;
      })
    );
  }
}
