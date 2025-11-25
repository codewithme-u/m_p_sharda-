// src/app/core/interceptors/token.interceptor.ts
import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor
} from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable()
export class TokenInterceptor implements HttpInterceptor {

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    
    // ---------------------------------------------------------
    // FIX: Do NOT attach tokens for Auth endpoints (Login/Register)
    // ---------------------------------------------------------
    if (req.url.includes('/api/auth')) {
      return next.handle(req);
    }

    try {
      const token = localStorage.getItem('token');

      if (token) {
        const clonedRequest = req.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`
          }
        });
        return next.handle(clonedRequest);
      }
    } catch (err) {
      console.warn('TokenInterceptor localStorage error:', err);
    }

    return next.handle(req);
  }
}