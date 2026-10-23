import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Regression guard for a real production incident: kaptia.app served a sitemap that
 * pointed at the old domain (finanzerpro.com) with 2025 dates and no language variants,
 * so search engines indexed the wrong addresses.
 */
describe('public sitemap', () => {
  const xml = readFileSync(resolve(process.cwd(), 'public/sitemap.xml'), 'utf8');
  const urls = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map((match) => match[1]);

  it('never mentions the retired domain', () => {
    expect(xml).not.toContain('finanzerpro');
  });

  it('lists every public page in all three languages', () => {
    expect(urls.length).toBeGreaterThanOrEqual(24);
    for (const language of ['sk', 'en', 'es']) {
      expect(urls).toContain(`https://kaptia.app/${language}`);
      expect(urls).toContain(`https://kaptia.app/${language}/pricing`);
      expect(urls).toContain(`https://kaptia.app/${language}/privacy-policy`);
    }
  });

  it('does not list signed-in screens', () => {
    const privatePaths = ['/dashboard', '/expenses', '/transactions', '/admin-watch', '/profile'];
    for (const path of privatePaths) {
      expect(urls.some((url: string) => url.endsWith(path))).toBe(false);
    }
  });

  it('declares hreflang alternates', () => {
    expect(xml).toContain('hreflang="sk"');
    expect(xml).toContain('hreflang="en"');
    expect(xml).toContain('hreflang="es"');
    expect(xml).toContain('hreflang="x-default"');
  });
});
