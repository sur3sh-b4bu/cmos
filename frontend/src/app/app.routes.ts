import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { permissionGuard } from './core/guards/permission.guard';
import { masterAdminGuard } from './core/guards/master-admin.guard';
import { adminOnlyGuard } from './core/guards/admin-only.guard';
import { churchContextGuard } from './core/guards/church-context.guard';
import { centralModeGuard, dashboardGuard } from './core/guards/central-mode.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/authentication/login').then((m) => m.LoginComponent),
  },
  {
    // Public landing page for the QR code printed on prayer offering receipts.
    // Deliberately outside the authGuard-protected shell: the people scanning
    // it are parishioners, not COMS users.
    path: 'r/:token',
    loadComponent: () =>
      import('./features/public-intention/public-intention').then((m) => m.PublicIntentionComponent),
  },
  {
    path: 'change-password',
    canActivate: [authGuard],
    loadComponent: () => import('./features/authentication/change-password').then((m) => m.ChangePasswordComponent),
    data: { breadcrumb: 'auth.changePassword' },
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell').then((m) => m.ShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        canActivate: [dashboardGuard],
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.DashboardComponent),
        data: { breadcrumb: 'nav.dashboard' },
      },
      {
        // Central Management: organization-wide analytics for the Master Administrator (see features/central-management).
        path: 'central',
        canActivate: [masterAdminGuard, centralModeGuard],
        data: { breadcrumb: 'central.title' },
        loadChildren: () => import('./features/central-management/central.routes').then((m) => m.CENTRAL_ROUTES),
      },
      {
        // Pure grouping/breadcrumb node -- deliberately carries NO permission
        // requirement of its own. It used to require mass_intentions.view,
        // which every descendant route inherited on top of its own permission
        // (Angular runs canActivate for every matched segment, parent AND
        // child). That meant a role granted only prayer_register.view -- e.g.
        // Priest -- was blocked from Daily Prayer Register by a permission
        // that page doesn't even use, and got a false "Access Denied". Each
        // leaf below now declares exactly the permission it needs and nothing
        // more; the list view ('') carries mass_intentions.view itself.
        path: 'mass-intentions',
        canActivate: [churchContextGuard],
        data: { breadcrumb: 'nav.massIntentions' },
        children: [
          {
            path: '',
            canActivate: [permissionGuard],
            data: { permissions: ['mass_intentions.view'] },
            loadComponent: () =>
              import('./features/mass-intentions/mass-intentions-list/mass-intentions-list').then(
                (m) => m.MassIntentionsListComponent
              ),
          },
          {
            path: 'register',
            data: { breadcrumb: 'breadcrumb.dailyRegister', permissions: ['prayer_register.view'] },
            canActivate: [permissionGuard],
            loadComponent: () =>
              import('./features/mass-intentions/daily-register/daily-register').then(
                (m) => m.DailyRegisterComponent
              ),
          },
          {
            path: 'new',
            data: { breadcrumb: 'common.new', permissions: ['mass_intentions.create'] },
            canActivate: [permissionGuard],
            loadComponent: () =>
              import('./features/mass-intentions/mass-intention-form/mass-intention-form').then(
                (m) => m.MassIntentionFormComponent
              ),
          },
          {
            path: 'bulk-new',
            data: { breadcrumb: 'massIntentions.bulkNewTitle', permissions: ['mass_intentions.create'] },
            canActivate: [permissionGuard],
            loadComponent: () =>
              import('./features/mass-intentions/bulk-mass-intention-form/bulk-mass-intention-form').then(
                (m) => m.BulkMassIntentionFormComponent
              ),
          },
          {
            // A full page/tab, same as 'new'/'bulk-new' above -- not a
            // popup -- see bulk-batches-list.ts's own doc comment.
            path: 'bulk-batches',
            data: { breadcrumb: 'massIntentions.showBulkBatches', permissions: ['mass_intentions.view'] },
            canActivate: [permissionGuard],
            loadComponent: () =>
              import('./features/mass-intentions/bulk-batches-list/bulk-batches-list').then(
                (m) => m.BulkBatchesListComponent
              ),
          },
          {
            path: ':id/edit',
            data: { breadcrumb: 'common.edit', permissions: ['mass_intentions.update'] },
            canActivate: [permissionGuard],
            loadComponent: () =>
              import('./features/mass-intentions/mass-intention-form/mass-intention-form').then(
                (m) => m.MassIntentionFormComponent
              ),
          },
        ],
      },
      {
        // Same shape as mass-intentions above (grouping node, no blanket
        // guard -- each leaf declares its own permission).
        path: 'contributions',
        canActivate: [churchContextGuard],
        data: { breadcrumb: 'nav.contributions' },
        children: [
          {
            path: '',
            canActivate: [permissionGuard],
            data: { permissions: ['contributions.view'] },
            loadComponent: () =>
              import('./features/contributions/contributions-list/contributions-list').then((m) => m.ContributionsListComponent),
          },
          {
            path: 'new',
            data: { breadcrumb: 'common.new', permissions: ['contributions.create'] },
            canActivate: [permissionGuard],
            loadComponent: () =>
              import('./features/contributions/contribution-form/contribution-form').then((m) => m.ContributionFormComponent),
          },
          {
            path: ':id/edit',
            data: { breadcrumb: 'common.edit', permissions: ['contributions.update'] },
            canActivate: [permissionGuard],
            loadComponent: () =>
              import('./features/contributions/contribution-form/contribution-form').then((m) => m.ContributionFormComponent),
          },
        ],
      },
      {
        // Same fix as mass-intentions above: no blanket guard on the
        // grouping node, so 'new'/':id/edit' aren't also silently required to
        // hold <type>_certificates.view on top of their own create/update
        // permission.
        path: 'certificates/:certType',
        canActivate: [churchContextGuard],
        data: { breadcrumb: 'breadcrumb.certificates', breadcrumbParam: 'certType' },
        children: [
          {
            path: '',
            canActivate: [permissionGuard],
            data: { permissionFromParam: { param: 'certType', suffix: '_certificates.view' } },
            loadComponent: () =>
              import('./features/certificates/certificate-list/certificate-list').then((m) => m.CertificateListComponent),
          },
          {
            path: 'new',
            canActivate: [permissionGuard],
            data: {
              breadcrumb: 'common.new',
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
              breadcrumb: 'common.edit',
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
        canActivate: [permissionGuard, churchContextGuard],
        data: { breadcrumb: 'nav.reports', permissions: ['reports.view'] },
        loadComponent: () => import('./features/reports/reports').then((m) => m.ReportsComponent),
      },
      {
        // Grouping node again -- see mass-intentions above for why. Also
        // fixes a second, smaller gap found alongside it: 'new' and
        // ':id/edit' under a master table had NO permission check of their
        // own at all (only the ancestor's masters.view), so a view-only role
        // could navigate straight to the create/edit form in the UI even
        // though the API would correctly reject the eventual save. They now
        // require masters.create / masters.update explicitly.
        path: 'masters',
        data: { breadcrumb: 'nav.masters' },
        children: [
          {
            path: '',
            canActivate: [permissionGuard],
            data: { permissions: ['masters.view'] },
            loadComponent: () => import('./features/masters/masters-hub/masters-hub').then((m) => m.MastersHubComponent),
          },
          {
            path: ':masterKey',
            children: [
              {
                path: '',
                canActivate: [permissionGuard],
                data: { permissions: ['masters.view'] },
                loadComponent: () => import('./features/masters/master-list/master-list').then((m) => m.MasterListComponent),
              },
              {
                path: 'new',
                canActivate: [permissionGuard],
                data: { breadcrumb: 'common.new', permissions: ['masters.create'] },
                loadComponent: () => import('./features/masters/master-form/master-form').then((m) => m.MasterFormComponent),
              },
              {
                path: ':id/edit',
                canActivate: [permissionGuard],
                data: { breadcrumb: 'common.edit', permissions: ['masters.update'] },
                loadComponent: () => import('./features/masters/master-form/master-form').then((m) => m.MasterFormComponent),
              },
            ],
          },
        ],
      },
      {
        path: 'settings',
        data: { breadcrumb: 'nav.settings' },
        children: [
          {
            path: '',
            loadComponent: () => import('./features/settings/settings-hub/settings-hub').then((m) => m.SettingsHubComponent),
          },
          {
            // Same fix as mass-intentions/masters above. No
            // churchContextGuard here (unlike mass-intentions/
            // contributions/certificates/reports) -- Master Administrator
            // can manage Users while in Central Management, same as
            // Masters; see userAdminRoutes.js's own comment.
            path: 'users',
            data: { breadcrumb: 'breadcrumb.users' },
            children: [
              {
                path: '',
                canActivate: [permissionGuard],
                data: { permissions: ['users.view'] },
                loadComponent: () => import('./features/settings/users/users-list').then((m) => m.UsersListComponent),
              },
              {
                path: 'new',
                canActivate: [permissionGuard],
                data: { breadcrumb: 'common.new', permissions: ['users.create'] },
                loadComponent: () => import('./features/settings/users/user-form').then((m) => m.UserFormComponent),
              },
              {
                path: ':id/edit',
                canActivate: [permissionGuard],
                data: { breadcrumb: 'common.edit', permissions: ['users.update'] },
                loadComponent: () => import('./features/settings/users/user-form').then((m) => m.UserFormComponent),
              },
            ],
          },
          {
            path: 'roles',
            canActivate: [permissionGuard],
            data: { breadcrumb: 'breadcrumb.rolesPermissions', permissions: ['roles.view'] },
            loadComponent: () =>
              import('./features/settings/roles-permissions/roles-permissions').then((m) => m.RolesPermissionsComponent),
          },
          {
            path: 'audit-logs',
            canActivate: [permissionGuard],
            data: { breadcrumb: 'breadcrumb.auditLogs', permissions: ['audit_logs.view'] },
            loadComponent: () => import('./features/settings/audit-logs/audit-logs').then((m) => m.AuditLogsComponent),
          },
          {
            path: 'trash',
            data: { breadcrumb: 'settings.recycleBin' },
            loadComponent: () => import('./features/settings/trash/trash-list').then((m) => m.TrashListComponent),
          },
          {
            path: 'certificate-templates',
            data: { breadcrumb: 'settings.certificateTemplates' },
            loadComponent: () =>
              import('./features/settings/certificate-templates/certificate-templates').then(
                (m) => m.CertificateTemplatesComponent
              ),
          },
          {
            path: 'change-church-branch',
            canActivate: [masterAdminGuard],
            data: { breadcrumb: 'settings.changeChurchBranch' },
            loadComponent: () =>
              import('./features/settings/change-church-branch/change-church-branch').then(
                (m) => m.ChangeChurchBranchComponent
              ),
          },
          {
            path: 'change-branch',
            canActivate: [adminOnlyGuard],
            data: { breadcrumb: 'settings.changeBranch' },
            loadComponent: () =>
              import('./features/settings/change-branch/change-branch').then((m) => m.ChangeBranchComponent),
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
      title: 'staticPages.accessDeniedTitle',
      message: 'staticPages.accessDeniedMessage',
    },
  },
  {
    path: '**',
    loadComponent: () => import('./features/static-pages/error-page').then((m) => m.ErrorPageComponent),
    data: {
      icon: 'search_off',
      title: 'staticPages.notFoundTitle',
      message: 'staticPages.notFoundMessage',
    },
  },
];
