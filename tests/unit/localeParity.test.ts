import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Every structured (dotted-identifier) translation key must exist in all three languages,
 * so a visitor on /es or /sk never sees raw keys or English fallbacks where we promised copy.
 */
const LOCALES = ['en-us', 'es-pe', 'sk-sk'] as const;

function flatten(value: unknown, prefix = '', out: Record<string, unknown> = {}): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      flatten(child, prefix ? `${prefix}.${key}` : key, out);
    }
  } else if (Array.isArray(value)) {
    value.forEach((child, index) => flatten(child, `${prefix}.${index}`, out));
  } else {
    out[prefix] = value;
  }
  return out;
}

const structured = (key: string) => /^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)+$/.test(key);

const loaded = Object.fromEntries(
  LOCALES.map((locale) => [
    locale,
    flatten(
      JSON.parse(fs.readFileSync(path.resolve('client/public/locales', locale, 'translation.json'), 'utf8'))
    ),
  ])
) as Record<(typeof LOCALES)[number], Record<string, unknown>>;

describe('locale parity', () => {
  const union = new Set(LOCALES.flatMap((locale) => Object.keys(loaded[locale]).filter(structured)));

  for (const locale of LOCALES) {
    it(`${locale} has every structured key`, () => {
      const missing = Array.from(union).filter((key) => !(key in loaded[locale]));
      expect(missing).toEqual([]);
    });
  }

  it('the legal pages keep their Peru and consumer copy in every language', () => {
    for (const locale of LOCALES) {
      for (const key of ['privacy.peru.title', 'privacy.peru.right_access', 'reclamaciones.title', 'terms.consumer_rights_desc', 'checkout.auto_renewal']) {
        expect(String(loaded[locale][key] ?? ''), `${locale}:${key}`).not.toBe('');
      }
    }
  });

  it('never prints a placeholder phone number in the legal copy', () => {
    for (const locale of LOCALES) {
      const text = JSON.stringify(loaded[locale]);
      expect(text).not.toMatch(/555-01\d\d/);
    }
  });
});
