import { Injectable, effect, inject } from '@angular/core';
import { AuthService } from './auth.service';

const VALID_THEMES = new Set([
  'blue',
  'green',
  'red',
  'violet',
  'orange',
  'purple',
  'pink',
  'teal',
  'maroon',
  'slate',
  'amber',
  'cyan',
  'olive',
  'bronze',
  'plum',
]);

/**
 * Applies the logged-in user's own church brand color (Masters > Churches >
 * Theme Color) as a `data-brand-theme` attribute on <html> -- _tokens.scss's
 * [data-brand-theme='green'] block then swaps --coms-color-primary (and its
 * sidebar gradient) for the whole app in one place: sidebar, header, buttons,
 * links, everywhere else already reads that same custom property. 'blue' is
 * the default palette baked into :root, so it's applied by simply removing
 * the attribute rather than needing its own override block.
 *
 * Reads AuthService.effectiveChurchThemeColor() rather than
 * currentUser().churchThemeColor directly -- for a Master Administrator
 * (whose own currentUser() has no home church) that resolves to whichever
 * church it's currently acting as via Settings > Change Church & Branch,
 * so the color follows the switcher the same way it follows a regular
 * user's own church.
 *
 * Instantiated once from App (see app.ts) purely for this constructor
 * side-effect -- nothing else needs to inject it.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private authService = inject(AuthService);

  constructor() {
    effect(() => {
      const color = this.authService.effectiveChurchThemeColor();
      this.apply(color && VALID_THEMES.has(color) ? color : null);
    });
  }

  private apply(color: string | null): void {
    const root = document.documentElement;
    if (color && color !== 'blue') {
      root.setAttribute('data-brand-theme', color);
    } else {
      root.removeAttribute('data-brand-theme');
    }
  }
}
