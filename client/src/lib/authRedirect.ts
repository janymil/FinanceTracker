/**
 * Where to send someone after sign-in. A visitor who opened a deep link (for example
 * /es/budget) while signed out should land there after signing in, not on the dashboard.
 * The target comes from the address bar, so only same-site app pages are accepted.
 */

const AUTH_PAGE = /^\/(?:[a-z]{2}\/)?auth(?:\/|$)/;

export function safeRedirect(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const path = raw.trim();
  if (path.length === 0 || path.length > 500) return null;
  // "//host" and "/\host" are read by browsers as another site.
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return null;
  if (/[\u0000-\u001f\u007f]/.test(path)) return null;
  const pathname = path.split(/[?#]/)[0];
  if (AUTH_PAGE.test(pathname)) return null; // would loop back to the sign-in page
  if (pathname.startsWith('/api/')) return null;
  return path;
}

/** The sign-in page address for someone who was sent away from `fromPath`. */
export function signInUrl(lang: string, fromPath?: string | null): string {
  const target = safeRedirect(fromPath);
  const base = `/${lang}/auth`;
  return target ? `${base}?redirect=${encodeURIComponent(target)}#sign-in` : `${base}#sign-in`;
}
