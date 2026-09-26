import { AppLang } from '../i18n/translations';

/**
 * Picks the Tamil name for a DB row (Mass Intention preset, Mass) when the
 * site's language is Tamil and one's actually been filled in via Masters --
 * falls back to the English `name` otherwise, so an untranslated row (a
 * custom preset an admin just added, e.g.) never shows blank. This is the
 * one place that fallback rule lives; every dropdown/grid/PDF that shows an
 * intention or Mass name should go through this rather than reading `name`
 * or `name_ta` directly. Mirrors backend's identical fallback in
 * pdfLabels.js's localizedName(), used server-side for receipts/register.
 */
export function localizedName(row: { name: string; name_ta?: string | null } | null | undefined, lang: AppLang): string {
  if (!row) return '';
  if (lang === 'ta' && row.name_ta) return row.name_ta;
  return row.name;
}
