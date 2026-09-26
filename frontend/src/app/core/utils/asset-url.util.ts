import { environment } from '../../../environments/environment';

/**
 * Resolves a relative asset path as returned by the API (e.g.
 * "/uploads/church-logos/church-1-....png") into an absolute URL against the
 * API's origin. `environment.apiBaseUrl` includes the `/api` suffix, which
 * uploaded-file paths are NOT under, so that suffix has to be stripped first
 * -- a plain concatenation would 404.
 */
export function resolveUploadUrl(relativePath: string | null | undefined): string | null {
  if (!relativePath) return null;
  if (/^https?:\/\//i.test(relativePath)) return relativePath;
  const origin = environment.apiBaseUrl.replace(/\/api\/?$/, '');
  return `${origin}${relativePath}`;
}
