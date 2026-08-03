import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Usage: { path: 'masters', canActivate: [permissionGuard], data: { permissions: ['masters.view'] } }
 * Passes if the user holds ANY of the listed permission codes.
 */
export const permissionGuard: CanActivateFn = async (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  await authService.whenReady();

  const required = (route.data?.['permissions'] as string[] | undefined) ?? [];
  if (!required.length || authService.hasAnyPermission(required)) {
    return true;
  }

  return router.createUrlTree(['/forbidden']);
};
