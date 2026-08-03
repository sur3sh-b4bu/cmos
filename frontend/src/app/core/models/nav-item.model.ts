export interface NavItem {
  label: string;
  icon: string;
  route: string;
  permissions?: string[];
}

// NOTE: entries are added here only once the module they point to is
// actually built, so the sidebar never contains a dead link.
export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: 'dashboard', route: '/dashboard', permissions: ['dashboard.view'] },
  { label: 'Prayer Intentions', icon: 'volunteer_activism', route: '/prayer-intentions', permissions: ['prayer_intentions.view'] },
  { label: 'Daily Prayer Register', icon: 'menu_book', route: '/prayer-intentions/register', permissions: ['prayer_register.view'] },
  { label: 'Baptism Certificates', icon: 'water_drop', route: '/certificates/baptism', permissions: ['baptism_certificates.view'] },
  { label: 'Marriage Certificates', icon: 'favorite', route: '/certificates/marriage', permissions: ['marriage_certificates.view'] },
  { label: 'Death Certificates', icon: 'church', route: '/certificates/death', permissions: ['death_certificates.view'] },
  { label: 'Reports', icon: 'bar_chart', route: '/reports', permissions: ['reports.view'] },
  { label: 'Masters', icon: 'tune', route: '/masters', permissions: ['masters.view'] },
];
