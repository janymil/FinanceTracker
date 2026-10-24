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
