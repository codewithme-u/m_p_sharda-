/// <reference types="@angular/localize" />

import { enableProdMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { environment } from './environments/environment';

/**
 * Guarded telemetry init for production only on allowed hosts.
 * If you have telemetry bootstrap code (Clarity / Hotjar / Sentry / AppInsights),
 * either move that code into safeInitTelemetry() or ensure that code itself
 * checks environment and hostname before initializing.
 */
const ALLOWED_TELEMETRY_HOSTS = [
  'm-p-sharda.onrender.com',
  'localhost',
  '127.0.0.1'
];

function safeInitTelemetry(): void {
  // === Move your explicit telemetry init here (if you have it) ===
  // Example (pseudo):
  // if ((window as any).clarity === undefined) {
  //   // insert clarity init or call library init
  // }
  //
  // IMPORTANT: don't import/execute third-party telemetry modules unguarded here —
  // if telemetry is initialized in other files, make sure those files also check hostname/env.
}

try {
  if (environment.production && ALLOWED_TELEMETRY_HOSTS.includes(window.location.hostname)) {
    try {
      safeInitTelemetry();
      console.info('[telemetry] initialized on', window.location.hostname);
    } catch (telemetryErr) {
      // Crucial: swallow telemetry errors so Angular bootstraps no matter what
      console.error('[telemetry] init failed — continuing without telemetry:', telemetryErr);
    }
  } else {
    console.info('[telemetry] not initialized on', window.location.hostname, ' (production:', environment.production, ')');
  }
} catch (guardErr) {
  // Defensive: if accessing `window` or hostname throws, don't block bootstrapping
  console.warn('[telemetry] guard threw — continuing:', guardErr);
}

// enable prod mode when appropriate
if (environment.production) {
  enableProdMode();
}

// Bootstrap the Angular application (standalone)
bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error('Angular bootstrap failed:', err));
