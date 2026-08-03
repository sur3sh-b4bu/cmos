import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Usage: { path: 'masters', canActivate: [permissionGuard], data: { permissions: ['masters.view'] } }
 * Passes if the user holds ANY of the listed permission codes.
 *
 * For routes where the permission depends on a URL param (e.g.
 * certificates/:certType -> baptism_certificates.view), use
 * data: { permissionFromParam: { param: 'certType', suffix: '_certificates.view' } }
 * instead of a static list.
 */
export const permissionGuard: CanActivateFn = async (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  await authService.whenReady();

  let required = (route.data?.['permissions'] as string[] | undefined) ?? [];

  const dynamic = route.data?.['permissionFromParam'] as { param: string; suffix: string } | undefined;
  if (dynamic) {
    const paramValue = route.paramMap.get(dynamic.param);
    if (paramValue) required = [...required, `${paramValue}${dynamic.suffix}`];
  }

  if (!required.length || authService.hasAnyPermission(required)) {
    return true;
  }

  return router.createUrlTree(['/forbidden']);
};
