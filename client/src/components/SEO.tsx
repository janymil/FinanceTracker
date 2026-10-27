import { Helmet } from 'react-helmet-async';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  ogImage?: string;
  ogType?: string;
  twitterCard?: string;
  /** Signed-in and utility screens: keep them out of search results. */
  noindex?: boolean;
}

const BASE = 'https://kaptia.app';
const LANGUAGES = ['en', 'es', 'sk'] as const;
const OG_LOCALE: Record<string, string> = { en: 'en_US', es: 'es_ES', sk: 'sk_SK' };

// Old URLs that still render a page: one canonical address per page, as in the sitemap.
const SLUG_ALIAS: Record<string, string> = {
  '/terms': '/terms-of-service',
  '/privacy': '/privacy-policy',
  '/cookies': '/cookie-policy',
  '/refunds': '/refund-policy',
};

/**
 * Canonical and hreflang addresses are derived from the URL the visitor is on, never typed per
 * page: `scripts/generate-sitemap.mjs` lists `/<lang><path>`, and a page that declares a
 * different canonical sends the crawler two contradicting signals.
 */
function addressFor(location: string, fallbackLang: string) {
  const segments = location.split('?')[0].split('#')[0].split('/').filter(Boolean);
  const hasPrefix = (LANGUAGES as readonly string[]).includes(segments[0]);
  const lang = hasPrefix ? segments[0] : (LANGUAGES as readonly string[]).includes(fallbackLang) ? fallbackLang : 'en';
  const rest = '/' + (hasPrefix ? segments.slice(1) : segments).join('/');
  const path = rest === '/' ? '' : SLUG_ALIAS[rest] ?? rest;
  return { lang, path };
}

export function SEO({
  title = "Kaptia - Smart Spending Tracker with AI Insights",
  description = "Kaptia turns receipts, voice notes and statements into a clear picture of your spending. Snap a photo, speak a note, or import a file - AI organizes the rest. Start free today!",
  keywords = "spending tracker, expense tracker, budget planner, receipt scanner, voice expense input, AI categorization, smart budgeting, expense tracking",
  ogImage = `${BASE}/og-image.png`,
  ogType = "website",
  twitterCard = "summary_large_image",
  noindex = false,
}: SEOProps) {
  const [location] = useLocation();
  const { i18n } = useTranslation();
  const { lang, path } = addressFor(location, (i18n.language || 'en').slice(0, 2));
  const canonical = `${BASE}/${lang}${path}`;
  const fullTitle = title.includes("Kaptia") ? title : `${title} | Kaptia`;

  return (
    <Helmet>
      <html lang={lang} />
      {/* Primary Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="title" content={fullTitle} />
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="robots" content={noindex ? 'noindex, nofollow' : 'index, follow'} />
      <link rel="canonical" href={canonical} />
      {!noindex && LANGUAGES.map((l) => (
        <link key={l} rel="alternate" hrefLang={l} href={`${BASE}/${l}${path}`} />
      ))}
      {!noindex && <link rel="alternate" hrefLang="x-default" href={`${BASE}/en${path}`} />}

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={canonical} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:site_name" content="Kaptia" />
      <meta property="og:locale" content={OG_LOCALE[lang]} />

      {/* Twitter */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:url" content={canonical} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
    </Helmet>
  );
}
