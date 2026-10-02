import { Routes } from '@angular/router';

/**
 * Central Management: organization-wide analytics. Mounted at /central (see app.routes.ts), which is guarded so only a
 * Master Administrator gets in. Each child sets its own title/subtitle (shown in the layout) and its breadcrumb.
 */
export const CENTRAL_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./central-layout').then((m) => m.CentralLayoutComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      {
        path: 'overview',
        data: { breadcrumb: 'nav.dashboard', titleKey: 'central.overview.title', subtitleKey: 'central.overview.subtitle' },
        loadComponent: () => import('./pages/central-overview').then((m) => m.CentralOverviewComponent),
      },
      {
        path: 'mass-intentions',
        data: { breadcrumb: 'nav.massIntentions', titleKey: 'central.mi.title', subtitleKey: 'central.mi.subtitle' },
        loadComponent: () => import('./pages/central-mass-intentions').then((m) => m.CentralMassIntentionsComponent),
      },
      {
        path: 'register',
        data: { breadcrumb: 'nav.dailyRegister', titleKey: 'central.reg.title', subtitleKey: 'central.reg.subtitle' },
        loadComponent: () => import('./pages/central-register').then((m) => m.CentralRegisterComponent),
      },
      {
        path: 'certificates/baptism',
        data: { breadcrumb: 'nav.baptismCertificates', type: 'baptism', titleKey: 'central.cert.title.baptism', subtitleKey: 'central.cert.subtitle.baptism' },
        loadComponent: () => import('./pages/central-certificates').then((m) => m.CentralCertificatesComponent),
      },
      {
        path: 'certificates/marriage',
        data: { breadcrumb: 'nav.marriageCertificates', type: 'marriage', titleKey: 'central.cert.title.marriage', subtitleKey: 'central.cert.subtitle.marriage' },
        loadComponent: () => import('./pages/central-certificates').then((m) => m.CentralCertificatesComponent),
      },
      {
        path: 'certificates/confirmation',
        data: { breadcrumb: 'nav.confirmationCertificates', type: 'confirmation', titleKey: 'central.cert.title.confirmation', subtitleKey: 'central.cert.subtitle.confirmation' },
        loadComponent: () => import('./pages/central-certificates').then((m) => m.CentralCertificatesComponent),
      },
      {
        path: 'certificates/death',
        data: { breadcrumb: 'nav.deathCertificates', type: 'death', titleKey: 'central.cert.title.death', subtitleKey: 'central.cert.subtitle.death' },
        loadComponent: () => import('./pages/central-certificates').then((m) => m.CentralCertificatesComponent),
      },
      {
        path: 'contributions',
        data: { breadcrumb: 'nav.contributions', titleKey: 'central.con.title', subtitleKey: 'central.con.subtitle' },
        loadComponent: () => import('./pages/central-contributions').then((m) => m.CentralContributionsComponent),
      },
      {
        path: 'reports',
        data: { breadcrumb: 'nav.reports', titleKey: 'central.reports.title', subtitleKey: 'central.reports.subtitle' },
        loadComponent: () => import('./pages/central-reports').then((m) => m.CentralReportsComponent),
      },
    ],
  },
];
