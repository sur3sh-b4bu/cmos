import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Usage: { path: 'settings/change-church-branch', canActivate: [masterAdminGuard] }
 * Only the Master Administrator role may activate the route -- unlike
 * permissionGuard, there's no permission code to check (that role's access
 * comes from a hard-coded bypass, see AuthService.isMasterAdmin). */
export const masterAdminGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  await authService.whenReady();

  return authService.isMasterAdmin() ? true : router.createUrlTree(['/forbidden']);
};
