import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * The Peru legal copy, pinned to facts rather than to wording.
 *
 * Each assertion below is a claim a customer (or INDECOPI, or the data-protection authority)
 * can check against reality. They exist because the copy was wrong in five specific ways:
 *
 *   • the privacy policy cited D.S. 003-2013-JUS after D.S. 016-2024-JUS had replaced it;
 *   • it answered ARCO requests "between 8 and 20 business days" — the 8 appears in no
 *     Peruvian rule, and the regulation sets two different deadlines (20 for access, 10 for
 *     rectification, cancellation, portability and objection);
 *   • it said everything sent to an AI provider was anonymised, while a recorded voice note
 *     goes to the speech-to-text service exactly as recorded, and masking identifiers is
 *     pseudonymisation;
 *   • it named 7 of the 14 providers that actually receive personal data;
 *   • the terms sent Peruvian consumers exclusively to Bernalillo County and capped liability
 *     with no carve-out for dolo or culpa inexcusable.
 *
 * The wording stays free to change; a change that makes one of these false turns this red.
 */
const LOCALES = ['en-us', 'es-pe', 'sk-sk'] as const;
type Locale = (typeof LOCALES)[number];

const translations = Object.fromEntries(
  LOCALES.map((locale) => [
    locale,
    JSON.parse(
      fs.readFileSync(path.resolve('client/public/locales', locale, 'translation.json'), 'utf8')
    ) as Record<string, unknown>,
  ])
) as Record<Locale, Record<string, unknown>>;

/** One dotted key, as the pages read it. */
function copy(locale: Locale, key: string): string {
  const value = key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], translations[locale]);
  return String(value ?? '');
}

/** Every string in one language, for the invariants that must hold everywhere. */
const everything = (locale: Locale) => JSON.stringify(translations[locale]);

/** The providers that actually receive personal data, checked against the code. */
const RECIPIENTS = [
  'Neon', // server/db.ts — the database
  'Cloudflare', // server/cloudStorage.ts — R2 receipt images
  'Clerk', // server/clerkAuth.ts — accounts and sign-in
  'Stripe', // server/routes/stripeRoutes.ts — card payments
  'Mercado Pago', // server/mercadopago.ts — Peru payments
  'SendGrid', // server/emailService.ts — transactional e-mail
  'OpenAI', // lib/aiProvider.ts — chat fallback, OCR vision
  'Mistral', // server/mistralClient.ts — chat, OCR, speech to text
  'DeepSeek', // lib/aiProvider.ts — chat fallback
  'Groq', // server/groqClient.ts — speech to text
  'Google Vision', // server/ocr.ts — OCR fallback
  'GeoJS', // server/middleware/countryBlocking.ts — IP country
  'ipapi', // lib/geolocation.ts — IP country
  'Google Analytics', // client/src/lib/analytics.ts — only with analytics consent
];

const CARVE_OUT: Record<Locale, RegExp> = {
  'es-pe': /dolo o culpa inexcusable/,
  'en-us': /wilful misconduct or gross negligence/,
  'sk-sk': /hrubej nedbanlivosti/,
};

describe('Peru legal copy', () => {
  for (const locale of LOCALES) {
    describe(locale, () => {
      it('cites the regulation that is in force and never the repealed one', () => {
        expect(everything(locale)).not.toContain('003-2013');
        expect(copy(locale, 'privacy.peru.intro')).toContain('016-2024-JUS');
      });

      it('gives the two ARCO deadlines the regulation sets, and invents no range', () => {
        const deadlines = copy(locale, 'privacy.peru.exercise_desc');
        expect(deadlines).toMatch(/\b20\b/);
        expect(deadlines).toMatch(/\b10\b/);
        expect(deadlines).toMatch(/días hábiles|business days|pracovných dní/);
        expect(deadlines).not.toMatch(/entre 8 y 20|between 8 and 20|od 8 do 20/);
      });

      it('offers portability with the other rights', () => {
        expect(copy(locale, 'privacy.peru.right_portability')).not.toBe('');
      });

      it('describes the voice note instead of calling everything anonymised', () => {
        // `hlasov`, not `hlas`: Slovak "súhlas" (consent) contains "hlas" and would match for free.
        expect(copy(locale, 'privacy.peru.consent_desc')).toMatch(/voz|voice|hlasov/i);
        expect(copy(locale, 'privacy.section3.no_personal_data.description')).toMatch(/voz|voice|hlasov/i);
        expect(copy(locale, 'privacy.section3.ai_provider.description')).not.toMatch(/anonimiz|anonymised|anonymizovan/i);
      });

      it('names every provider that receives personal data', () => {
        const transfers = copy(locale, 'privacy.peru.transfers_desc');
        for (const recipient of RECIPIENTS) {
          expect(transfers, `${locale} does not name ${recipient}`).toContain(recipient);
        }
      });

      it('keeps a Peru forum and a non-waivable-rights carve-out for consumers', () => {
        expect(copy(locale, 'terms.governing_law_desc')).toContain('INDECOPI');
        expect(copy(locale, 'terms.liability_cap')).toMatch(CARVE_OUT[locale]);
      });

      it('does not sell the processor e-mail as a Peruvian tax receipt', () => {
        expect(copy(locale, 'terms.receipts_desc')).toContain('SUNAT');
      });

      it('carries the mandatory notice in the complaints book', () => {
        const note = copy(locale, 'reclamaciones.note');
        expect(note).toContain('INDECOPI');
        expect(note).toMatch(/\b15\b/);
        expect(note).toMatch(/improrrogable|non-extendable|nepredĺžiteľn/i);
      });

      it('describes every record it keeps, not only the convenient ones', () => {
        // Complaints, invitations and tax documents were missing from the retention table: the
        // three records most likely to outlive the account, and the three nobody had thought about.
        for (const record of ['complaints', 'invitations', 'tax_documents']) {
          expect(copy(locale, `privacy.section6.table.${record}`), `${locale}:${record}`).not.toBe('');
          expect(copy(locale, `privacy.section6.table.${record}_retention`), `${locale}:${record} retention`).not.toBe('');
          expect(copy(locale, `privacy.section6.table.${record}_desc`), `${locale}:${record} purpose`).not.toBe('');
        }
      });

      it('asks about AI in the signup dialog in every language', () => {
        for (const key of ['aiConsent.title', 'aiConsent.body', 'aiConsent.allow', 'aiConsent.decline']) {
          expect(copy(locale, key), `${locale}:${key}`).not.toBe('');
        }
      });
    });
  }
});
