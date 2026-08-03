import { HttpClient } from '@angular/common/http';
import { Injectable, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import { CurrentUser, LoginRequest, LoginResponseData } from '../models/auth.model';

/**
 * The access token lives only in memory (never localStorage) to limit
 * exposure to XSS; the refresh token is an httpOnly cookie the browser
 * sends automatically, so a full page reload silently restores the
 * session via restoreSession() rather than persisting the access token.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly baseUrl = `${environment.apiBaseUrl}/auth`;
  private accessToken: string | null = null;
  private pendingRefresh: Promise<string> | null = null;

  readonly currentUser = signal<CurrentUser | null>(null);
  readonly isAuthenticated = computed(() => this.currentUser() !== null);
  readonly initializing = signal(true);

  private resolveReady!: () => void;
  private readyPromise = new Promise<void>((resolve) => (this.resolveReady = resolve));

  constructor(private http: HttpClient, private router: Router) {}

  /** Resolves once the initial silent-refresh attempt (on app boot) has finished. */
  whenReady(): Promise<void> {
    return this.readyPromise;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  hasPermission(code: string): boolean {
    return this.currentUser()?.permissions.includes(code) ?? false;
  }

  hasAnyPermission(codes: string[]): boolean {
    return codes.some((c) => this.hasPermission(c));
  }

  async login(payload: LoginRequest): Promise<CurrentUser> {
    const res = await firstValueFrom(
      this.http.post<ApiResponse<LoginResponseData>>(`${this.baseUrl}/login`, payload, { withCredentials: true })
    );
    this.applySession(res.data);
    return res.data.user;
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${this.baseUrl}/logout`, {}, { withCredentials: true }));
    } finally {
      this.clearSession();
      this.router.navigate(['/login']);
    }
  }

  /** Called once on app bootstrap to silently restore a session from the refresh cookie. */
  async restoreSession(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.post<ApiResponse<LoginResponseData>>(`${this.baseUrl}/refresh`, {}, { withCredentials: true })
      );
      this.applySession(res.data);
    } catch {
      this.clearSession();
    } finally {
      this.initializing.set(false);
      this.resolveReady();
    }
  }

  /**
   * Used by the HTTP interceptor when a request fails with 401. Concurrent
   * callers share a single in-flight refresh instead of each firing their
   * own /auth/refresh request (which would race token rotation).
   */
  refreshAccessToken(): Promise<string> {
    if (!this.pendingRefresh) {
      this.pendingRefresh = firstValueFrom(
        this.http.post<ApiResponse<LoginResponseData>>(`${this.baseUrl}/refresh`, {}, { withCredentials: true })
      )
        .then((res) => {
          this.applySession(res.data);
          return res.data.accessToken;
        })
        .finally(() => {
          this.pendingRefresh = null;
        });
    }
    return this.pendingRefresh;
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.baseUrl}/change-password`, { currentPassword, newPassword })
    );
    await this.logout();
  }

  private applySession(data: LoginResponseData): void {
    this.accessToken = data.accessToken;
    this.currentUser.set(data.user);
  }

  private clearSession(): void {
    this.accessToken = null;
    this.currentUser.set(null);
  }
}
