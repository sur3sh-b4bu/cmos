import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { centralRouteFor } from './central-mode.guard';

/**
 * Guards routes that assume a church is always present (mass intentions,
 * certificates, contributions, reports, user management). A no-op for
 * every role except Master Administrator before it has picked a church via
 * Settings > Change Church & Branch -- everyone else's session always has
 * a real home church. Without this, a Master Administrator landing on one
 * of these routes with nothing selected would just see the backend's
 * "Select a church to continue" 400 surface as a generic error toast.
 *
 * In Central Management, a module with an organization-wide view (Mass Intentions, the register, certificates,
 * Contributions, Reports) goes to that analytics screen; anything else (creating a record...) still asks for a church.
 */
export const churchContextGuard: CanActivateFn = async (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  await authService.whenReady();

  if (authService.isMasterAdmin() && !authService.activeChurchBranch()) {
    const central = centralRouteFor(state.url);
    return router.createUrlTree([central ?? '/settings/change-church-branch']);
  }
  return true;
};
