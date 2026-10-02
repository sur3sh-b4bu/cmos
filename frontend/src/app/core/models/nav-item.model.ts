export interface NavItem {
  /** A translation key (e.g. "nav.dashboard"), resolved via the `translate` pipe in sidebar.html. */
  labelKey: string;
  icon: string;
  route: string;
  permissions?: string[];
  children?: NavItem[];
}

// NOTE: entries are added here only once the module they point to is
// actually built, so the sidebar never contains a dead link.
export const NAV_ITEMS: NavItem[] = [
  { labelKey: 'nav.dashboard', icon: 'dashboard', route: '/dashboard', permissions: ['dashboard.view'] },
  { labelKey: 'nav.massIntentions', icon: 'volunteer_activism', route: '/mass-intentions', permissions: ['mass_intentions.view'] },
  { labelKey: 'nav.dailyRegister', icon: 'menu_book', route: '/mass-intentions/register', permissions: ['prayer_register.view'] },
  { labelKey: 'nav.contributions', icon: 'redeem', route: '/contributions', permissions: ['contributions.view'] },
  { labelKey: 'nav.baptismCertificates', icon: 'water_drop', route: '/certificates/baptism', permissions: ['baptism_certificates.view'] },
  { labelKey: 'nav.marriageCertificates', icon: 'favorite', route: '/certificates/marriage', permissions: ['marriage_certificates.view'] },
  { labelKey: 'nav.confirmationCertificates', icon: 'workspace_premium', route: '/certificates/confirmation', permissions: ['confirmation_certificates.view'] },
  { labelKey: 'nav.deathCertificates', icon: 'church', route: '/certificates/death', permissions: ['death_certificates.view'] },
  { labelKey: 'nav.reports', icon: 'bar_chart', route: '/reports', permissions: ['reports.view'] },
  { labelKey: 'nav.masters', icon: 'tune', route: '/masters', permissions: ['masters.view'] },
  { labelKey: 'nav.settings', icon: 'settings', route: '/settings' },
];
