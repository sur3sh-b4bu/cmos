export interface CurrentUser {
  id: number;
  username: string;
  fullName?: string;
  email?: string | null;
  phone?: string | null;
  roleId: number;
  roleCode: string;
  roleName?: string;
  /** null for a Master Administrator until it picks one via Settings >
   * Change Church & Branch (see AuthService.isMasterAdmin/activeChurch) --
   * that role has no home church of its own. Every other role always has a
   * real church here. */
  churchId: number | null;
  churchName?: string | null;
  /** Optional -- shown instead of churchName when the site's language is
   * Tamil (see localized-name.util.ts); falls back to churchName when blank. */
  churchNameTa?: string | null;
  churchLogoUrl?: string | null;
  /** 'blue' | 'green' -- drives the sidebar/header/button color scheme app-wide, see [[ThemeService]]. */
  churchThemeColor?: string | null;
  branchId?: number | null;
  branchName?: string | null;
  mustChangePassword?: boolean;
  permissions: string[];
}

/** A Master Administrator's current selection from Settings > Change
 * Church & Branch (see AuthService.activeChurch/setActiveChurchBranch).
 * `branchId: null` means "all branches" of that church. themeColor/logoUrl
 * are carried along so ThemeService/the sidebar crest can follow the
 * selection too, the same way they'd follow a regular user's own
 * currentUser().churchThemeColor/churchLogoUrl. */
export interface ActiveChurchBranch {
  churchId: number;
  churchName: string;
  branchId: number | null;
  branchName: string | null;
  themeColor?: string | null;
  logoUrl?: string | null;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface SessionResponseData {
  user: CurrentUser;
}
