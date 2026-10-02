import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Where a Master Administrator in Central Management goes for each module in the sidebar: an organization-wide
 * analytics screen instead of one church's records. Modules not listed here have no central view.
 */
const CENTRAL_ROUTE_FOR: Record<string, string> = {
  '/dashboard': '/central/overview',
  '/mass-intentions': '/central/mass-intentions',
  '/mass-intentions/register': '/central/register',
  '/certificates/baptism': '/central/certificates/baptism',
  '/certificates/marriage': '/central/certificates/marriage',
  '/certificates/confirmation': '/central/certificates/confirmation',
  '/certificates/death': '/central/certificates/death',
  '/contributions': '/central/contributions',
  '/reports': '/central/reports',
};

/** The Central Management screen that stands in for `route`, or null if it has none (creating a record, say). */
export function centralRouteFor(route: string): string | null {
  return CENTRAL_ROUTE_FOR[route.split('?')[0].replace(/\/+$/, '') || '/'] ?? null;
}

/** True while a Master Administrator has not chosen a church: the organization-wide view. */
export function inCentralManagement(auth: AuthService): boolean {
  return auth.isMasterAdmin() && !auth.activeChurchBranch();
}

/**
 * Guards /central/**: only a Master Administrator may enter. Entering Central Management from inside a church
 * switches back to the organization-wide view -- the two are different modes and are not mixed.
 */
export const centralModeGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.whenReady();
  if (!auth.isMasterAdmin()) return router.createUrlTree(['/forbidden']);
  if (auth.activeChurchBranch()) auth.useCentralManagement();
  return true;
};

/** The Dashboard for a Master Administrator in Central Management is the Church Network Overview. */
export const dashboardGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.whenReady();
  return inCentralManagement(auth) ? router.createUrlTree(['/central/overview']) : true;
};
