import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Usage: { path: 'settings/change-branch', canActivate: [adminOnlyGuard] }
 * Only the per-church ADMIN role may activate the route -- Master
 * Administrator has its own, separate church+branch switcher
 * (masterAdminGuard/change-church-branch), and every other role has no
 * branch of its own to switch between. */
export const adminOnlyGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  await authService.whenReady();

  return authService.currentUser()?.roleCode === 'ADMIN' ? true : router.createUrlTree(['/forbidden']);
};
