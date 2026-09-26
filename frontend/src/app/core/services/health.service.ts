import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { catchError, interval, of, startWith, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';

export type HealthStatus = 'checking' | 'ok' | 'down';

interface HealthResponse {
  success: boolean;
  status: string;
  uptime: number;
  timestamp: string;
}

const POLL_INTERVAL_MS = 30_000;

/**
 * Polls the backend's plain liveness endpoint (GET /health -- see app.js;
 * deliberately NOT /api/health, which only proves the *API* is reachable,
 * not that the Node process itself is up) for the sidebar's health icon
 * (see sidebar.ts/html). Unauthenticated and outside environment.apiBaseUrl
 * on purpose, so auth.interceptor.ts's token/refresh-on-401 logic never
 * touches it -- see that interceptor's own isApiRequest check.
 */
@Injectable({ providedIn: 'root' })
export class HealthService {
  private http = inject(HttpClient);

  // Uses environment.apiBaseUrl ('http://host:4000/api' in dev, '/api' in prod)
  // so IIS / reverse-proxy rewrite rules correctly forward the health check to backend.
  private readonly healthUrl = `${environment.apiBaseUrl}/health`;

  readonly status = signal<HealthStatus>('checking');

  private started = false;

  /** Starts polling -- call from the sidebar's constructor. Guarded so
   * calling it more than once (the sidebar living inside the persistent
   * shell layout should only ever construct once per session, but this is
   * a free safety net) doesn't stack up duplicate polling subscriptions.
   * Re-checks every POLL_INTERVAL_MS, immediately on subscribe (startWith),
   * so the icon reflects reality within one request rather than sitting on
   * "checking" for a full interval first. */
  start(): void {
    if (this.started) return;
    this.started = true;
    interval(POLL_INTERVAL_MS)
      .pipe(
        startWith(0),
        switchMap(() =>
          this.http.get<HealthResponse>(this.healthUrl).pipe(catchError(() => of(null)))
        )
      )
      .subscribe((res) => {
        this.status.set(res?.success === true && (res?.status === 'ok' || !res?.status) ? 'ok' : 'down');
      });
  }
}
