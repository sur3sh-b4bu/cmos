import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { permissionGuard } from './core/guards/permission.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/authentication/login').then((m) => m.LoginComponent),
  },
  {
    path: 'change-password',
    canActivate: [authGuard],
    loadComponent: () => import('./features/authentication/change-password').then((m) => m.ChangePasswordComponent),
    data: { breadcrumb: 'Change Password' },
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell').then((m) => m.ShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.DashboardComponent),
        data: { breadcrumb: 'Dashboard' },
      },
      {
        path: 'prayer-intentions',
        data: { breadcrumb: 'Prayer Intentions', permissions: ['prayer_intentions.view'] },
        canActivate: [permissionGuard],
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/prayer-intentions/prayer-intentions-list/prayer-intentions-list').then(
                (m) => m.PrayerIntentionsListComponent
              ),
          },
          {
            path: 'register',
            data: { breadcrumb: 'Daily Register', permissions: ['prayer_register.view'] },
            canActivate: [permissionGuard],
            loadComponent: () =>
              import('./features/prayer-intentions/daily-register/daily-register').then(
                (m) => m.DailyRegisterComponent
              ),
          },
          {
            path: 'new',
            data: { breadcrumb: 'New', permissions: ['prayer_intentions.create'] },
            canActivate: [permissionGuard],
            loadComponent: () =>
              import('./features/prayer-intentions/prayer-intention-form/prayer-intention-form').then(
                (m) => m.PrayerIntentionFormComponent
              ),
          },
          {
            path: ':id/edit',
            data: { breadcrumb: 'Edit', permissions: ['prayer_intentions.update'] },
            canActivate: [permissionGuard],
            loadComponent: () =>
              import('./features/prayer-intentions/prayer-intention-form/prayer-intention-form').then(
                (m) => m.PrayerIntentionFormComponent
              ),
          },
        ],
      },
      {
        path: 'certificates/:certType',
        canActivate: [permissionGuard],
        data: {
          breadcrumb: 'Certificates',
          breadcrumbParam: 'certType',
          permissionFromParam: { param: 'certType', suffix: '_certificates.view' },
        },
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/certificates/certificate-list/certificate-list').then((m) => m.CertificateListComponent),
          },
          {
            path: 'new',
            canActivate: [permissionGuard],
            data: {
              breadcrumb: 'New',
              breadcrumbParam: undefined, // don't inherit the parent's certType prefix here
              permissionFromParam: { param: 'certType', suffix: '_certificates.create' },
            },
            loadComponent: () =>
              import('./features/certificates/certificate-form/certificate-form').then((m) => m.CertificateFormComponent),
          },
          {
            path: ':id/edit',
            canActivate: [permissionGuard],
            data: {
              breadcrumb: 'Edit',
              breadcrumbParam: undefined, // don't inherit the parent's certType prefix here
              permissionFromParam: { param: 'certType', suffix: '_certificates.update' },
            },
            loadComponent: () =>
              import('./features/certificates/certificate-form/certificate-form').then((m) => m.CertificateFormComponent),
          },
        ],
      },
      {
        path: 'reports',
        canActivate: [permissionGuard],
        data: { breadcrumb: 'Reports', permissions: ['reports.view'] },
        loadComponent: () => import('./features/reports/reports').then((m) => m.ReportsComponent),
      },
      {
        path: 'masters',
        canActivate: [permissionGuard],
        data: { breadcrumb: 'Masters', permissions: ['masters.view'] },
        children: [
          {
            path: '',
            loadComponent: () => import('./features/masters/masters-hub/masters-hub').then((m) => m.MastersHubComponent),
          },
          {
            path: ':masterKey',
            children: [
              {
                path: '',
                loadComponent: () => import('./features/masters/master-list/master-list').then((m) => m.MasterListComponent),
              },
              {
                path: 'new',
                data: { breadcrumb: 'New' },
                loadComponent: () => import('./features/masters/master-form/master-form').then((m) => m.MasterFormComponent),
              },
              {
                path: ':id/edit',
                data: { breadcrumb: 'Edit' },
                loadComponent: () => import('./features/masters/master-form/master-form').then((m) => m.MasterFormComponent),
              },
            ],
          },
        ],
      },
    ],
  },
  {
    path: 'forbidden',
    loadComponent: () => import('./features/static-pages/error-page').then((m) => m.ErrorPageComponent),
    data: {
      icon: 'block',
      title: 'Access Denied',
      message: "You don't have permission to view this page. Contact your administrator if you believe this is a mistake.",
    },
  },
  {
    path: '**',
    loadComponent: () => import('./features/static-pages/error-page').then((m) => m.ErrorPageComponent),
    data: {
      icon: 'search_off',
      title: 'Page Not Found',
      message: "The page you're looking for doesn't exist or has moved.",
    },
  },
];
