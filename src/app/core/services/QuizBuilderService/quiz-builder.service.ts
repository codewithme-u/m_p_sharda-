import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, catchError, Observable, of, tap } from 'rxjs';
import { Question } from '../../../../../INTERFACE/question';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class QuizBuilderService {
  private baseUrl: string;

  // Loading indicator for UI
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  constructor(private http: HttpClient) {
    const apiRoot = environment?.apiUrl && environment.apiUrl.trim().length
      ? environment.apiUrl.replace(/\/$/, '') // remove trailing slash
      : '';

    // final: "/api/questions" or "{apiUrl}/api/questions"
    this.baseUrl = apiRoot ? `${apiRoot}/api/questions` : '/api/questions';
  }

  // Attach authorization header if JWT exists
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

  getQuestions(quizId: number): Observable<Question[]> {
    this.loadingSubject.next(true);

    return this.http.get<Question[]>(`${this.baseUrl}/quiz/${quizId}`, this.makeHeaders()).pipe(
      tap(() => this.loadingSubject.next(false)),
      catchError(err => {
        this.loadingSubject.next(false);
        console.error(`getQuestions(${quizId}) failed`, err);
        return of([] as Question[]);
      })
    );
  }

  addQuestion(quizId: number, question: Question): Observable<Question> {
    return this.http.post<Question>(
      `${this.baseUrl}/quiz/${quizId}`,
      question,
      this.makeHeaders()
    ).pipe(
      catchError(err => {
        console.error('addQuestion failed', err);
        throw err;
      })
    );
  }

  deleteQuestion(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/${id}`, this.makeHeaders()).pipe(
      catchError(err => {
        console.error(`deleteQuestion(${id}) failed`, err);
        throw err;
      })
    );
  }
}
