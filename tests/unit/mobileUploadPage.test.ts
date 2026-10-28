import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { isLanguageFreePath } from '../../client/src/i18n/languageDetector';

/**
 * The page a phone opens after scanning the receipt QR code.
 *
 * "Subir recibo con teléfono" was dead in production while every server-side test passed: the
 * QR encoded `<origin>/mobile-upload/<sessionId>`, `LanguageGuard` prefixes every path that has
 * no language, so the phone was sent to `/es/mobile-upload/<sessionId>` — a URL no route in
 * `App.tsx` serves. The phone showed the 404 page and the desktop kept polling forever.
 *
 * Three things have to agree for the page to open, so all three are held here: the guard must
 * leave the path alone, the router must know both shapes, and the QR must encode one of them.
 */

const ROOT = path.resolve(__dirname, '..', '..');
const read = (relative: string) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const SESSION = '8d1f7c3a-0f5b-4a6e-9c2d-1b0a4f6e8d21';

describe('isLanguageFreePath', () => {
  it.each([
    [`/mobile-upload/${SESSION}`, true],
    ['/mobile-upload', true],
    // A language prefix is the normal case: the guard handles it, the router has the route.
    [`/es/mobile-upload/${SESSION}`, false],
    // Look-alikes must not be swallowed.
    ['/mobile-uploads', false],
    ['/es/dashboard', false],
    ['/', false],
  ])('%s → %s', (pathname, expected) => {
    expect(isLanguageFreePath(pathname)).toBe(expected);
  });
});

describe('the QR receipt page stays reachable', () => {
  it('is a route both with and without the language prefix', () => {
    const app = read('client/src/App.tsx');

    expect(app).toContain('path="/:lang/mobile-upload/:sessionId"');
    expect(app).toContain('path="/mobile-upload/:sessionId"');
  });

  it('is encoded in the QR code with the language prefix', () => {
    const modal = read('client/src/components/UploadReceiptModal.tsx');

    expect(modal).toContain('/${currentLocale}/mobile-upload/${sessionId}');
    // The unprefixed URL is the exact mistake: LanguageGuard rewrites it into a 404.
    expect(modal).not.toMatch(/origin\}\/mobile-upload\/\$\{sessionId\}/);
  });

  it('is matched by the router in both shapes', () => {
    // Every `<Route path>` in the file, read as wouter patterns, must cover the URL the guard
    // leaves behind (`/es/mobile-upload/<id>`, a single-segment language route cannot) and the
    // bare one too.
    const app = read('client/src/App.tsx');
    const patterns = Array.from(app.matchAll(/<Route\s+path="([^"]+)"/g)).map((m) => m[1]);

    const covers = (pathname: string) =>
      patterns.some((pattern) => {
        const patternSegments = pattern.split('/').filter(Boolean);
        const urlSegments = pathname.split('/').filter(Boolean);
        if (patternSegments.length !== urlSegments.length) return false;
        if (patternSegments.includes('*')) return true;
        return patternSegments.every(
          (segment, i) => segment.startsWith(':') || segment === urlSegments[i]
        );
      });

    expect(patterns).toContain('/:lang/mobile-upload/:sessionId');
    expect(covers(`/es/mobile-upload/${SESSION}`)).toBe(true);
    expect(covers(`/mobile-upload/${SESSION}`)).toBe(true);
  });

  it('is left alone by the language guard, before any redirect', () => {
    const guard = read('client/src/components/LanguageGuard.tsx');

    const check = guard.indexOf('isLanguageFreePath(location)');
    expect(check, 'LanguageGuard no longer skips the prefix-free page').toBeGreaterThan(-1);
    expect(check).toBeLessThan(guard.indexOf('setLocation(newPath)'));
  });
});
