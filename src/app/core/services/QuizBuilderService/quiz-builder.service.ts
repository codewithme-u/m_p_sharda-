import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Question } from '../../../../../INTERFACE/question';

@Injectable({
  providedIn: 'root'
})
export class QuizBuilderService {
  private baseUrl = 'http://localhost:8080/api/questions';

  constructor(private http: HttpClient) {}

  getQuestions(quizId: number): Observable<Question[]> {
    return this.http.get<Question[]>(`${this.baseUrl}/quiz/${quizId}`);
  }

  addQuestion(quizId: number, question: Question): Observable<Question> {
    return this.http.post<Question>(`${this.baseUrl}/quiz/${quizId}`, question);
  }

  deleteQuestion(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/${id}`);
  }
}