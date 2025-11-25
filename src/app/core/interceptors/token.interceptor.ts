// src/app/core/interceptors/token.interceptor.ts
import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable()
export class TokenInterceptor implements HttpInterceptor {

  private readonly apiRoot: string;

  constructor() {
    // ensures consistent detection: remove trailing slash
    this.apiRoot =
      environment.apiUrl && environment.apiUrl.trim().length
        ? environment.apiUrl.replace(/\/$/, '')
        : '';
  }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    
    // ---------------------------------------------------------
    // 1. Skip auth endpoints (login, register, refresh)
    // ---------------------------------------------------------
    if (
      req.url.includes('/api/auth/login') ||
      req.url.includes('/api/auth/register') ||
      req.url.includes('/api/auth/refresh')
    ) {
      return next.handle(req);
    }

    // ---------------------------------------------------------
    // 2. Only attach token for BACKEND API requests
    // - if using relative URLs like /api/...
    // - OR absolute URLs starting with apiUrl
    // ---------------------------------------------------------
    const isBackendRequest =
      req.url.startsWith('/api/') ||
      (this.apiRoot && req.url.startsWith(this.apiRoot));

    if (!isBackendRequest) {
      // Do NOT attach token to CDN, assets, images, or external calls
      return next.handle(req);
    }

    // ---------------------------------------------------------
    // 3. Attempt to read the JWT token safely
    // ---------------------------------------------------------
    let token: string | null = null;
    try {
      token = localStorage.getItem('token');
    } catch (e) {
      console.warn('TokenInterceptor: localStorage unavailable', e);
    }

    if (!token) {
      return next.handle(req);
    }

    // ---------------------------------------------------------
    // 4. Clone request with Authorization header
    // ---------------------------------------------------------
    const cloned = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });

    return next.handle(cloned);
  }
}
