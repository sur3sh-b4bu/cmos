import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { centralModeGuard, centralRouteFor, dashboardGuard, inCentralManagement } from './central-mode.guard';

function fakeAuth(opts: { master: boolean; church: number | null }) {
  const useCentralManagement = vi.fn();
  return {
    isMasterAdmin: () => opts.master,
    activeChurchBranch: () => (opts.church ? { churchId: opts.church } : null),
    whenReady: () => Promise.resolve(),
    useCentralManagement,
  };
}

function run(guard: typeof centralModeGuard, auth: ReturnType<typeof fakeAuth>) {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideRouter([]), { provide: AuthService, useValue: auth }] });
  return TestBed.runInInjectionContext(() => guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)) as Promise<boolean | UrlTree>;
}

describe('centralRouteFor - which analytics screen stands in for a church screen', () => {
  it('maps every sidebar module that has a central view', () => {
    expect(centralRouteFor('/dashboard')).toBe('/central/overview');
    expect(centralRouteFor('/mass-intentions')).toBe('/central/mass-intentions');
    expect(centralRouteFor('/mass-intentions/register')).toBe('/central/register');
    expect(centralRouteFor('/certificates/baptism')).toBe('/central/certificates/baptism');
    expect(centralRouteFor('/certificates/marriage')).toBe('/central/certificates/marriage');
    expect(centralRouteFor('/certificates/death')).toBe('/central/certificates/death');
    expect(centralRouteFor('/contributions')).toBe('/central/contributions');
    expect(centralRouteFor('/reports')).toBe('/central/reports');
  });

  it('ignores a query string and a trailing slash', () => {
    expect(centralRouteFor('/contributions?page=2')).toBe('/central/contributions');
    expect(centralRouteFor('/reports/')).toBe('/central/reports');
  });

  it('has nothing for screens that create or edit records, or for Masters and Settings', () => {
    expect(centralRouteFor('/mass-intentions/new')).toBeNull();
    expect(centralRouteFor('/certificates/baptism/new')).toBeNull();
    expect(centralRouteFor('/masters')).toBeNull();
    expect(centralRouteFor('/settings/users')).toBeNull();
  });
});

describe('Central Management vs Church Management', () => {
  it('is the organization-wide view only for a Master Administrator who has not chosen a church', () => {
    expect(inCentralManagement(fakeAuth({ master: true, church: null }) as never)).toBe(true);
    expect(inCentralManagement(fakeAuth({ master: true, church: 3 }) as never)).toBe(false);
    expect(inCentralManagement(fakeAuth({ master: false, church: null }) as never)).toBe(false);
  });

  it('turns anyone but a Master Administrator away from /central', async () => {
    const result = await run(centralModeGuard, fakeAuth({ master: false, church: 1 }));
    expect(result instanceof UrlTree).toBe(true);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/forbidden');
  });

  it('lets a Master Administrator in, dropping back to the organization-wide view if a church was active', async () => {
    const inside = fakeAuth({ master: true, church: 4 });
    expect(await run(centralModeGuard, inside)).toBe(true);
    expect(inside.useCentralManagement).toHaveBeenCalledTimes(1);
    TestBed.resetTestingModule();
    const central = fakeAuth({ master: true, church: null });
    expect(await run(centralModeGuard, central)).toBe(true);
    expect(central.useCentralManagement).not.toHaveBeenCalled();
  });

  it('sends the Master Administrator\'s Dashboard to the network overview, and everyone else to the ordinary Dashboard', async () => {
    const overview = await run(dashboardGuard, fakeAuth({ master: true, church: null }));
    expect(TestBed.inject(Router).serializeUrl(overview as UrlTree)).toBe('/central/overview');
    TestBed.resetTestingModule();
    expect(await run(dashboardGuard, fakeAuth({ master: true, church: 2 }))).toBe(true);
    TestBed.resetTestingModule();
    expect(await run(dashboardGuard, fakeAuth({ master: false, church: 2 }))).toBe(true);
  });
});
