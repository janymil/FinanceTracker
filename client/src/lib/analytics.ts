/**
 * Google Analytics 4 + Google Ads, consent-first.
 *
 * Rules (see client/src/lib/consent.ts):
 *  - nothing is loaded until `analytics === true` in the cookie banner;
 *  - both tag ids come from the build environment, never from a literal buried in code;
 *  - initialisation is idempotent, so every caller can simply call `initGA()`.
 *
 * Missing ids are not an error: the app then runs without analytics (this is the
 * current production state until the GA4 property is created).
 */
import { hasAnalyticsConsent } from './consent';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const GA_MEASUREMENT_ID = String(import.meta.env.VITE_GA_MEASUREMENT_ID ?? '').trim();
const GOOGLE_ADS_ID = String(import.meta.env.VITE_GOOGLE_ADS_ID ?? '').trim();

let initialized = false;
let loading = false;

export function isAnalyticsConfigured(): boolean {
  return GA_MEASUREMENT_ID.length > 0 || GOOGLE_ADS_ID.length > 0;
}

/**
 * Loads gtag.js once, and only with consent. Safe to call on every route change.
 * Returns true when tracking is active afterwards.
 */
export function initGA(): boolean {
  if (typeof window === 'undefined') return false;
  if (initialized) return true;
  if (!hasAnalyticsConsent()) return false;
  if (!isAnalyticsConfigured() || loading) return false;

  loading = true;

  const firstId = GA_MEASUREMENT_ID || GOOGLE_ADS_ID;
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(firstId)}`;
  script.onerror = () => {
    loading = false;
    console.warn('[analytics] gtag.js could not be loaded (likely blocked by the browser).');
  };
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // Google's own snippet shape: the arguments object is pushed as-is.
    window.dataLayer!.push(arguments);
  };
  window.gtag('js', new Date());

  if (GA_MEASUREMENT_ID) {
    window.gtag('config', GA_MEASUREMENT_ID, { anonymize_ip: true });
  }
  if (GOOGLE_ADS_ID) {
    window.gtag('config', GOOGLE_ADS_ID);
  }

  initialized = true;
  loading = false;
  return true;
}

/** Called after the visitor accepts analytics in the banner. */
export function enableAnalytics(): boolean {
  return initGA();
}

export function trackPageView(url: string): void {
  if (!initialized || !window.gtag || !GA_MEASUREMENT_ID) return;
  window.gtag('event', 'page_view', {
    page_path: url,
    page_location: window.location.href,
  });
}

export function trackConversion(conversionLabel?: string, value?: number, currency?: string): void {
  if (!initialized || !window.gtag || !GOOGLE_ADS_ID) return;

  const conversionData: Record<string, unknown> = {
    send_to: conversionLabel ? `${GOOGLE_ADS_ID}/${conversionLabel}` : GOOGLE_ADS_ID,
  };
  if (value !== undefined) conversionData.value = value;
  if (currency) conversionData.currency = currency;

  window.gtag('event', 'conversion', conversionData);
}

export function trackEvent(action: string, category?: string, label?: string, value?: number): void {
  if (!initialized || !window.gtag) return;
  window.gtag('event', action, {
    event_category: category,
    event_label: label,
    value,
  });
}
