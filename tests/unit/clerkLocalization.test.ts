import { describe, expect, it } from 'vitest';

import {
  clerkLocalizationFor,
  languageFromPath,
  languageFromTag,
  pickClerkLanguage,
} from '@/i18n/clerkLocalization';

/**
 * The bug this covers: the language Clerk's own form is drawn in was decided once, at page load,
 * from the browser language alone. A visitor whose browser is English who opened `/es/auth` got a
 * Spanish page wrapped around an English form. These cases pin the address as the strongest
 * signal, so reverting to browser-first fails here.
 */
describe('clerkLocalization', () => {
  describe('languageFromPath', () => {
    it('reads the language prefix of a page address', () => {
      expect(languageFromPath('/es/auth')).toBe('es');
      expect(languageFromPath('/en/dashboard')).toBe('en');
      expect(languageFromPath('/sk/pricing')).toBe('sk');
    });

    it('accepts the bare prefix and ignores query and hash', () => {
      expect(languageFromPath('/es')).toBe('es');
      expect(languageFromPath('/es?redirect=%2Fes%2Fdashboard')).toBe('es');
      expect(languageFromPath('/es/auth#sign-in')).toBe('es');
    });

    it('refuses addresses that carry no language', () => {
      expect(languageFromPath('/auth')).toBeNull();
      expect(languageFromPath('/api/health')).toBeNull();
      expect(languageFromPath('/')).toBeNull();
      expect(languageFromPath('')).toBeNull();
      expect(languageFromPath(null)).toBeNull();
      expect(languageFromPath(undefined)).toBeNull();
      // Two letters, but not a language this app publishes: it is not a language.
      expect(languageFromPath('/de/auth')).toBeNull();
    });
  });

  describe('languageFromTag', () => {
    it('reduces a browser or saved locale tag to its language', () => {
      expect(languageFromTag('es-PE')).toBe('es');
      expect(languageFromTag('es_pe')).toBe('es');
      expect(languageFromTag('ES')).toBe('es');
      expect(languageFromTag('sk-SK')).toBe('sk');
      expect(languageFromTag(' en-US ')).toBe('en');
    });

    it('returns null for a language this app does not publish', () => {
      expect(languageFromTag('pt-BR')).toBeNull();
      expect(languageFromTag('')).toBeNull();
      expect(languageFromTag(null)).toBeNull();
    });
  });

  describe('pickClerkLanguage', () => {
    it('lets the address beat the browser', () => {
      expect(pickClerkLanguage({ pathname: '/es/auth', browser: 'en-US' })).toBe('es');
    });

    it('lets the address beat a saved English choice', () => {
      expect(pickClerkLanguage({ pathname: '/es/auth', browser: 'en-US', saved: 'en' })).toBe('es');
    });

    it('uses the saved choice when the address carries no language', () => {
      expect(pickClerkLanguage({ pathname: '/auth', saved: 'es', browser: 'en-US' })).toBe('es');
    });

    it('falls back to the browser, then to English', () => {
      expect(pickClerkLanguage({ pathname: '/auth', saved: null, browser: 'es-PE' })).toBe('es');
      expect(pickClerkLanguage({ browser: 'sk-SK' })).toBe('sk');
      expect(pickClerkLanguage({})).toBe('en');
      expect(pickClerkLanguage({ pathname: '/auth', saved: 'pt-BR', browser: 'pt-BR' })).toBe('en');
    });
  });

  describe('clerkLocalizationFor', () => {
    it("gives Clerk's Spanish strings for Spanish", () => {
      expect(clerkLocalizationFor('es')?.signUp?.start?.title).toBe('Crea tu cuenta');
      expect(clerkLocalizationFor('es')?.signIn?.start?.title).toBe('Entrar');
    });

    it('fills the legal-consent strings Slovak ships empty', () => {
      // Clerk's skSK package has `legalConsent.checkbox` and `.continue` as empty objects, so the
      // consent checkbox on sign-up renders with no label without these overrides.
      const consent = clerkLocalizationFor('sk')?.signUp?.legalConsent?.checkbox;
      expect(consent?.label__termsOfServiceAndPrivacyPolicy).toContain('obchodnými podmienkami');
      expect(consent?.label__termsOfServiceAndPrivacyPolicy).toContain('osobných údajov');
    });

    it("leaves English to Clerk's own default", () => {
      expect(clerkLocalizationFor('en')).toBeUndefined();
    });
  });
});
