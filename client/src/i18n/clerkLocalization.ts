/**
 * Which language Clerk draws its own forms in.
 *
 * The sign-in, sign-up, verification and password-reset forms are rendered by Clerk, not by this
 * app, so nothing in `client/public/locales` can reach them. The only lever is the `localization`
 * object handed to `<ClerkProvider>`.
 *
 * That object used to be chosen once, at page load, from the browser language alone. A visitor
 * whose browser is English who opened `/es/auth` therefore got a Spanish page wrapped around an
 * English form: the address bar said Spanish, the form did not. The address is the one signal that
 * records which language the person actually asked for, so it decides here; the saved choice and
 * the browser language only fill in when the address carries no language.
 *
 * Clerk's hosted Account Portal (the `*.accounts.dev` pages opened from verification emails) is
 * outside this: Clerk documents that `localization` does not reach it.
 */
import { esES, skSK } from '@clerk/localizations';

/** The languages this app publishes. Keep in step with the `/:lang` routes in `App.tsx`. */
export const CLERK_LANGUAGES = ['en', 'es', 'sk'] as const;

export type ClerkLanguage = (typeof CLERK_LANGUAGES)[number];

function isClerkLanguage(value: string | null | undefined): value is ClerkLanguage {
  return !!value && (CLERK_LANGUAGES as readonly string[]).includes(value);
}

/**
 * The language prefix of a page address: `/es/auth` -> `es`, `/es?redirect=%2Fdashboard` -> `es`,
 * `/auth` -> `null`.
 *
 * A two-letter first segment that is not a language we publish is not a language: `/api/health`
 * must not resolve to anything, and neither must `/de/auth` while German is not a route.
 */
export function languageFromPath(pathname: string | null | undefined): ClerkLanguage | null {
  if (!pathname) return null;
  const path = pathname.split(/[?#]/)[0] ?? '';
  const first = path.split('/').filter(Boolean)[0]?.toLowerCase();
  return isClerkLanguage(first) ? first : null;
}

/** `es-PE`, `es_pe`, `ES` -> `es`. A language we do not publish -> `null`. */
export function languageFromTag(tag: string | null | undefined): ClerkLanguage | null {
  if (!tag) return null;
  const main = tag.trim().toLowerCase().split(/[-_]/)[0];
  return isClerkLanguage(main) ? main : null;
}

/**
 * The language Clerk should use, strongest signal first:
 *
 *   1. the address the visitor opened — `/es/auth` means Spanish whatever the browser says,
 *   2. the language they chose last time,
 *   3. their browser,
 *   4. English.
 */
export function pickClerkLanguage(input: {
  pathname?: string | null;
  saved?: string | null;
  browser?: string | null;
}): ClerkLanguage {
  return (
    languageFromPath(input.pathname) ??
    languageFromTag(input.saved) ??
    languageFromTag(input.browser) ??
    'en'
  );
}

/**
 * Clerk's Slovak package ships `signUp.legalConsent` with empty `checkbox` and `continue` blocks,
 * so the consent checkbox renders with no label once the Terms of Service and Privacy Policy links
 * are switched on in the dashboard. English and Spanish ship those strings; Slovak does not.
 */
const slovakWithLegalConsent = {
  ...skSK,
  signUp: {
    ...(skSK.signUp || {}),
    legalConsent: {
      ...(skSK.signUp?.legalConsent || {}),
      checkbox: {
        label__onlyPrivacyPolicy:
          'Súhlasím so {{ privacyPolicyLink || link("zásadami ochrany osobných údajov") }}',
        label__onlyTermsOfService:
          'Súhlasím s {{ termsOfServiceLink || link("obchodnými podmienkami") }}',
        label__termsOfServiceAndPrivacyPolicy:
          'Súhlasím s {{ termsOfServiceLink || link("obchodnými podmienkami") }} a {{ privacyPolicyLink || link("zásadami ochrany osobných údajov") }}',
      },
      continue: {
        subtitle: 'Pokračovaním súhlasíte s našimi zásadami.',
        title: 'Zákonné súhlasy',
      },
    },
  },
};

/** The `localization` object for a language. English is Clerk's own default, so it gets none. */
export function clerkLocalizationFor(language: ClerkLanguage) {
  if (language === 'es') return esES;
  if (language === 'sk') return slovakWithLegalConsent;
  return undefined;
}
