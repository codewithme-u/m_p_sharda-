// src/app/app.config.ts
import { importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { TokenInterceptor } from './app/core/interceptors/token.interceptor';
import { routes as appRoutes } from './app/app.routes';

export const appConfig = {
  providers: [
    // Router provider (use your routes from app.routes.ts)
    provideRouter(appRoutes),

    // Import HttpClientModule so HttpClient is available to the app
    importProvidersFrom(HttpClientModule),

    // Register TokenInterceptor globally
    {
      provide: HTTP_INTERCEPTORS,
      useClass: TokenInterceptor,
      multi: true
    },

    // add other global providers here (guards, state, etc.)
  ]
};
