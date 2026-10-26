/**
 * One source of truth for the cookie banner's decision.
 *
 * Analytics must never start before the visitor said yes (consent-first analytics). Every analytics call goes through `hasAnalyticsConsent()`,
 * so a future component cannot accidentally bypass the banner.
 */
export const CONSENT_STORAGE_KEY = 'cookie-consent';

export interface CookiePreferences {
  essential: boolean;
  functional: boolean;
  analytics: boolean;
  timestamp?: string;
}

const DEFAULT_PREFERENCES: CookiePreferences = {
  essential: true,
  functional: false,
  analytics: false,
};

export function readConsent(): CookiePreferences | null {
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CookiePreferences>;
    return {
      essential: true,
      functional: Boolean(parsed.functional),
      analytics: Boolean(parsed.analytics),
      timestamp: parsed.timestamp,
    };
  } catch {
    return null;
  }
}

export function saveConsent(preferences: CookiePreferences): CookiePreferences {
  const value: CookiePreferences = {
    ...DEFAULT_PREFERENCES,
    ...preferences,
    essential: true,
    timestamp: preferences.timestamp ?? new Date().toISOString(),
  };
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* storage can be blocked (private mode); the in-memory callers still work */
  }
  return value;
}

export function hasAnalyticsConsent(): boolean {
  return readConsent()?.analytics === true;
}

export const COOKIE_SETTINGS_EVENT = 'kaptia:cookie-settings';

/**
 * The web fonts are a third-party request (`fonts.googleapis.com`), so they are not made until
 * the visitor allows functional cookies. Before this, three font requests left the page on load,
 * before the banner had even been answered.
 */
const FONT_STYLESHEET_ID = 'kaptia-consented-fonts';
const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap';

export function loadConsentedFonts(preferences: CookiePreferences | null = readConsent()): void {
  if (!preferences?.functional) return;
  if (typeof document === 'undefined') return;
  if (document.getElementById(FONT_STYLESHEET_ID)) return;

  for (const href of ['https://fonts.googleapis.com', 'https://fonts.gstatic.com']) {
    if (!document.querySelector(`link[rel="preconnect"][href="${href}"]`)) {
      const preconnect = document.createElement('link');
      preconnect.rel = 'preconnect';
      preconnect.href = href;
      if (href.includes('gstatic')) preconnect.crossOrigin = 'anonymous';
      document.head.appendChild(preconnect);
    }
  }

  const stylesheet = document.createElement('link');
  stylesheet.id = FONT_STYLESHEET_ID;
  stylesheet.rel = 'stylesheet';
  stylesheet.href = FONT_HREF;
  document.head.appendChild(stylesheet);
}

/** Re-open the banner so a stored decision can be changed or withdrawn. */
export function openCookieSettings(): void {
  window.dispatchEvent(new Event(COOKIE_SETTINGS_EVENT));
}
