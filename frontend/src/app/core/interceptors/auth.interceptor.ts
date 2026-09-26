import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';

// `/public/` covers the receipt-QR calendar page, which parishioners open
// without any COMS account -- it must never trigger a logout-redirect cycle.
// `/auth/me` is excluded too: its own 401 (no session cookie, or an expired
// one) is the normal, expected boot-time "not logged in" signal that
// restoreSession() already handles directly -- reacting to it here as well
// would fire a redundant logout()+navigate on every fresh page load.
const AUTH_FREE_PATHS = ['/auth/login', '/auth/logout', '/auth/me', '/public/'];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const isApiRequest = req.url.startsWith(environment.apiBaseUrl);
  const isAuthFreePath = AUTH_FREE_PATHS.some((p) => req.url.includes(p));

  const active = authService.isMasterAdmin() ? authService.activeChurchBranch() : null;
  const isAdmin = authService.currentUser()?.roleCode === 'ADMIN';
  const adminBranchId = isAdmin ? authService.adminActiveBranch()?.id ?? null : null;
  const headers: Record<string, string> = {};
  if (active) {
    headers['X-Church-Id'] = String(active.churchId);
    if (active.branchId != null) headers['X-Branch-Id'] = String(active.branchId);
  }
  if (adminBranchId != null) headers['X-Branch-Id'] = String(adminBranchId);
  // The `sid` session cookie is the sole credential now -- every API request
  // must carry it (previously only the auth endpoints opted into
  // `withCredentials` individually; everything else relied on the
  // Authorization header instead).
  const authedReq = isApiRequest ? req.clone({ setHeaders: headers, withCredentials: true }) : req;

  return next(authedReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // No more silent-refresh dance -- a session cookie is either valid or
      // it isn't; there's no "expired access token but still-good refresh
      // token" state to reconcile. An expired/revoked session just signs
      // the user out.
      if (isApiRequest && !isAuthFreePath && error.status === 401) {
        authService.logout();
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};
