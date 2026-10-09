import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import { ActiveChurchBranch, CurrentUser, LoginRequest, SessionResponseData } from '../models/auth.model';
import { BiometricAuthService } from './biometric-auth.service';

const ACTIVE_CHURCH_BRANCH_STORAGE_KEY = 'coms.activeChurchBranch';
const ADMIN_ACTIVE_BRANCH_STORAGE_KEY = 'coms.adminActiveBranchId';

/**
 * The whole session lives server-side: login sets one httpOnly `sid` cookie
 * (see backend authController.js), which the browser sends automatically on
 * every request (see auth.interceptor.ts's `withCredentials: true`) -- there
 * is no token for this service, or any frontend code, to hold at all. A full
 * page reload restores the session by simply asking the server who the
 * cookie belongs to (see restoreSession()).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly baseUrl = `${environment.apiBaseUrl}/auth`;
  

  readonly currentUser = signal<CurrentUser | null>(null);
  readonly isAuthenticated = computed(() => this.currentUser() !== null);
  readonly initializing = signal(true);

  /** Cross-church superuser -- see backend authorize.js's matching bypass.
   * Its access can never be narrowed by editing Roles & Permissions, so
   * hasPermission()/hasAnyPermission() below short-circuit for it the same
   * way, rather than relying on its (deliberately empty) permissions array. */
  readonly isMasterAdmin = computed(() => this.currentUser()?.roleCode === 'MASTER_ADMIN');

  /** Only meaningful for a Master Administrator -- the church/branch it's
   * currently acting as, picked via Settings > Change Church & Branch.
   * Persisted in localStorage purely so a page refresh doesn't lose the
   * selection; the server never trusts this by itself (authenticate.js
   * re-validates the church/branch on every request). */
  readonly activeChurchBranch = signal<ActiveChurchBranch | null>(this.readStoredActiveChurchBranch());

  /** Only meaningful for a per-church ADMIN -- which single branch of their
   * own (fixed) church they're currently narrowed to, picked via Settings >
   * Change Branch. `null` (the default) means "All branches", this role's
   * traditional unrestricted view -- see backend's utils/effectiveScope.js.
   * Persisted in localStorage purely for continuity across a refresh; the
   * server re-validates it belongs to the requester's own church on every
   * request regardless (see authenticate.js). */
  readonly adminActiveBranch = signal<{ id: number; name: string } | null>(this.readStoredAdminActiveBranch());

  /** What ThemeService/the sidebar crest should actually show: a Master
   * Administrator's own currentUser().churchThemeColor/churchLogoUrl is
   * always null (it has no home church), so these fall back to whichever
   * church it's currently acting as instead. Every other role's own
   * currentUser() fields are already correct and used as-is. */
  readonly effectiveChurchThemeColor = computed(() =>
    this.isMasterAdmin() ? this.activeChurchBranch()?.themeColor ?? null : this.currentUser()?.churchThemeColor ?? null
  );
  readonly effectiveChurchLogoUrl = computed(() =>
    this.isMasterAdmin() ? this.activeChurchBranch()?.logoUrl ?? null : this.currentUser()?.churchLogoUrl ?? null
  );

  /** The church being worked in: a Master Administrator's chosen church (null in Central Management),
   * or everyone else's own church. */
  readonly effectiveChurchId = computed(() =>
    this.isMasterAdmin() ? this.activeChurchBranch()?.churchId ?? null : this.currentUser()?.churchId ?? null
  );

  private resolveReady!: () => void;
  private readyPromise = new Promise<void>((resolve) => (this.resolveReady = resolve));

  private biometric = inject(BiometricAuthService);
  private http = inject(HttpClient);
  private router = inject(Router);

  /** Resolves once the initial session-restore attempt (on app boot) has finished. */
  whenReady(): Promise<void> {
    return this.readyPromise;
  }

  hasPermission(code: string): boolean {
    if (this.isMasterAdmin()) return true;
    return this.currentUser()?.permissions.includes(code) ?? false;
  }

  hasAnyPermission(codes: string[]): boolean {
    if (this.isMasterAdmin()) return true;
    return codes.some((c) => this.hasPermission(c));
  }

  /** Called from Settings > Change Church & Branch. Every subsequent
   * request carries this as X-Church-Id/X-Branch-Id headers (see
   * auth.interceptor.ts); pass `branch: null` for "all branches". */
  setActiveChurchBranch(
    church: { id: number; name: string; theme_color?: string | null; logo_url?: string | null },
    branch: { id: number; name: string } | null
  ): void {
    this.persistActiveChurchBranch({
      churchId: church.id,
      churchName: church.name,
      branchId: branch?.id ?? null,
      branchName: branch?.name ?? null,
      themeColor: church.theme_color ?? null,
      logoUrl: church.logo_url ?? null,
    });
  }

  private persistActiveChurchBranch(value: ActiveChurchBranch): void {
    this.activeChurchBranch.set(value);
    try {
      localStorage.setItem(ACTIVE_CHURCH_BRANCH_STORAGE_KEY, JSON.stringify(value));
    } catch {
      // Private browsing / storage disabled -- the in-memory signal above
      // still works for the rest of this tab's session.
    }
  }

  private readStoredActiveChurchBranch(): ActiveChurchBranch | null {
    try {
      const raw = localStorage.getItem(ACTIVE_CHURCH_BRANCH_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as ActiveChurchBranch) : null;
    } catch {
      return null;
    }
  }

  /** Called from Settings > Change Branch (ADMIN only). Every subsequent
   * request carries this as an X-Branch-Id header (see auth.interceptor.ts);
   * pass `null` for "all branches". */
  setAdminActiveBranch(branch: { id: number; name: string } | null): void {
    this.adminActiveBranch.set(branch);
    try {
      if (branch) localStorage.setItem(ADMIN_ACTIVE_BRANCH_STORAGE_KEY, JSON.stringify(branch));
      else localStorage.removeItem(ADMIN_ACTIVE_BRANCH_STORAGE_KEY);
    } catch {
      // Private browsing / storage disabled -- the in-memory signal above
      // still works for the rest of this tab's session.
    }
  }

  private readStoredAdminActiveBranch(): { id: number; name: string } | null {
    try {
      const raw = localStorage.getItem(ADMIN_ACTIVE_BRANCH_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as { id: number; name: string }) : null;
    } catch {
      return null;
    }
  }

  /** "Central Management" -- a Master Administrator's default/neutral
   * state (no specific church), selectable in the Change Church & Branch
   * switcher's own dropdown as well as being what a fresh session starts
   * in (activeChurchBranch() is simply null; there's no separate sentinel
   * object for it -- every place that displays activeChurchBranch() shows
   * "Central Management" when it's null, see change-church-branch.html/
   * header.html). Masters/Roles stay browsable across every church in this
   * state (see genericMasterRepository's addChurchScope); church-scoped
   * operational screens (mass intentions, certificates, ...) require
   * switching to an actual church first, same as today. */
  useCentralManagement(): void {
    this.activeChurchBranch.set(null);
    try {
      localStorage.removeItem(ACTIVE_CHURCH_BRANCH_STORAGE_KEY);
    } catch {
      // Same best-effort swallow as readStoredActiveChurchBranch.
    }
  }

  /** Patches the in-memory session's church logo right after an upload in
   * Masters > Churches, so the sidebar crest updates immediately instead of
   * waiting for the next login/refresh -- everything else in CurrentUser is
   * a snapshot from token-issue time by design, but a logo the admin just
   * picked should show up without a re-login. No-op if the edited church
   * isn't the current user's own (nothing in the visible session changed).
   * Also patches activeChurchBranch, so a Master Administrator editing the
   * logo of whichever church it's currently acting as sees the same
   * immediate update the sidebar crest gives everyone else. */
  updateCurrentUserChurchLogo(churchId: number, logoUrl: string | null): void {
    const user = this.currentUser();
    if (user && user.churchId === churchId) {
      this.currentUser.set({ ...user, churchLogoUrl: logoUrl });
    }
    const active = this.activeChurchBranch();
    if (active && active.churchId === churchId) {
      this.persistActiveChurchBranch({ ...active, logoUrl });
    }
  }

  /** Same live-patch as updateCurrentUserChurchLogo, for the brand color
   * picked in Masters > Churches -- ThemeService's effect (see app.ts)
   * reacts to effectiveChurchThemeColor and re-applies data-brand-theme
   * immediately. */
  updateCurrentUserChurchThemeColor(churchId: number, themeColor: string): void {
    const user = this.currentUser();
    if (user && user.churchId === churchId) {
      this.currentUser.set({ ...user, churchThemeColor: themeColor });
    }
    const active = this.activeChurchBranch();
    if (active && active.churchId === churchId) {
      this.persistActiveChurchBranch({ ...active, themeColor });
    }
  }

  async login(payload: LoginRequest): Promise<CurrentUser> {
    const res = await firstValueFrom(
      this.http.post<ApiResponse<SessionResponseData>>(`${this.baseUrl}/login`, payload, { withCredentials: true })
    );
    this.applySession(res.data);
    return res.data.user;
  }

  /**
   * Biometric sign-in. The WebAuthn ceremony lives in BiometricAuthService;
   * the resulting session is applied here so it goes through exactly the same
   * path as a password login.
   */
  async loginWithBiometrics(username: string): Promise<CurrentUser> {
    const data = (await this.biometric.signIn(username)) as SessionResponseData;
    this.applySession(data);
    return data.user;
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${this.baseUrl}/logout`, {}, { withCredentials: true }));
    } finally {
      this.clearSession();
      this.router.navigate(['/login']);
    }
  }

  /**
   * Marks boot as finished without checking for a session at all, for
   * public pages (see App.ngOnInit) where no session can or should exist.
   */
  skipSessionRestore(): void {
    this.clearSession();
    this.initializing.set(false);
    this.resolveReady();
  }

  /** Called once on app bootstrap. The `sid` cookie (if any) rides along
   * automatically (`withCredentials: true`) -- this just asks the server
   * who, if anyone, it belongs to. */
  async restoreSession(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponse<SessionResponseData>>(`${this.baseUrl}/me`, { withCredentials: true })
      );
      this.applySession(res.data);
    } catch {
      this.clearSession();
    } finally {
      this.initializing.set(false);
      this.resolveReady();
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.baseUrl}/change-password`, { currentPassword, newPassword })
    );
    await this.logout();
  }

  private applySession(data: SessionResponseData): void {
    this.currentUser.set(data.user);
  }

  private clearSession(): void {
    this.currentUser.set(null);
    this.useCentralManagement();
    this.setAdminActiveBranch(null);
  }
}
