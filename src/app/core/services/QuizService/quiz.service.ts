import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, tap, map } from 'rxjs';
import { Quiz } from '../../../../../INTERFACE/quiz';
import { QuizHistory } from '../../../../../INTERFACE/quiz-history';

@Injectable({
  providedIn: 'root'
})
export class QuizService {
  private baseUrl = 'http://localhost:8080/api/quizzes';
  private resultUrl = 'http://localhost:8080/api/results'; 
  
  private _refreshNeeded$ = new Subject<void>();

  get refreshNeeded$() {
    return this._refreshNeeded$;
  }

  constructor(private http: HttpClient) {}

  // Get Quiz by code and extract creator's userType
  getQuizCreatorTypeByCode(code: string): Observable<'GENERAL' | 'INSTITUTE'> {
    return this.http.get<any>(`${this.baseUrl}/code/${code}`).pipe(
      map(quiz => {
        const creatorType = quiz?.createdBy?.userType;
        if (creatorType === 'GENERAL') {
            return 'GENERAL';
        }
        return 'INSTITUTE';
      })
    );
  }

  // Get Created Quizzes
  getAll(): Observable<Quiz[]> {
    return this.http.get<Quiz[]>(this.baseUrl);
  }

  // Update quiz active status
  updateStatus(id: number, active: boolean): Observable<Quiz> {
    return this.http.put<Quiz>(`${this.baseUrl}/${id}/status`, { active }).pipe(
      tap(() => this._refreshNeeded$.next())
    );
  }

  // Get single quiz by code
  getByCode(code: string): Observable<Quiz> {
    return this.http.get<Quiz>(`${this.baseUrl}/code/${code}`);
  }

  // NEW: Get Participation History (Real-Time)
  getHistory(): Observable<QuizHistory[]> {
    return this.http.get<QuizHistory[]>(`${this.resultUrl}/history`);
  }

  create(title: string, description: string): Observable<Quiz> {
    return this.http.post<Quiz>(this.baseUrl, { title, description }).pipe(
      tap(() => this._refreshNeeded$.next())
    );
  }

  delete(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/${id}`).pipe(
        tap(() => this._refreshNeeded$.next())
    );
  }
}
