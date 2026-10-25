import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Every route that reads a request body must validate it — and the list of exceptions may only
 * shrink.
 *
 * "Put zod on every route" is the right goal and the wrong instruction: it cannot be done in one
 * sitting, and a rule nobody can see is a rule that decays. This test reads the source instead.
 * A handler that reads `req.body` without any validation signal fails the build, unless it is on
 * `KNOWN_UNVALIDATED` (today's debt) or `EXEMPT` (webhooks, where the contract is a signature over
 * the raw bytes, not a JSON body).
 *
 * When you validate one of the routes below: delete its line from KNOWN_UNVALIDATED. The stale-entry
 * test fails otherwise, so the list cannot quietly grow old.
 */
const ROOT = path.resolve(__dirname, '..', '..');

function routeFiles(): string[] {
  const out: string[] = [];
  for (const dir of ['server', 'server/routes']) {
    for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.ts')) out.push(path.join(ROOT, dir, entry.name));
    }
  }
  return out;
}

const REGISTRATION = /(?:app|router)\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g;

/**
 * What counts as validating a body: a schema parse (drizzle-zod, inline `z.object`, or the shared
 * helper in server/validation.ts) or one of the pure rules in `@shared/trackingInput`. It is a
 * presence check, not a quality check — a route with a schema that is too loose still passes.
 */
const VALIDATION =
  /safeParse\(|(?:Schema|schema)\.parse\(|parseValue\(|parseBody\(|parseQuery\(|z\.object|clean(?:Positive|NonNegative)?Amount\(|cleanDateValue\(|cleanText\(|cleanId\(/;

interface Handler {
  key: string;
  chunk: string;
}

/** One entry per registered handler that touches `req.body`. */
function bodyHandlers(): Handler[] {
  const handlers: Handler[] = [];

  for (const file of routeFiles()) {
    const relative = path.relative(ROOT, file).replace(/\\/g, '/');
    const text = fs.readFileSync(file, 'utf8');
    const registrations = Array.from(text.matchAll(REGISTRATION));

    registrations.forEach((match, index) => {
      const start = match.index ?? 0;
      const end = registrations[index + 1]?.index ?? text.length;
      const chunk = text.slice(start, end);
      if (!/req\.body/.test(chunk)) return;
      handlers.push({ key: `${relative} ${match[1].toUpperCase()} ${match[2]}`, chunk });
    });
  }

  return handlers;
}

/** Body-carrying endpoints whose contract is not a JSON schema, and why. */
const EXEMPT: Record<string, string> = {
  'server/routes/stripeRoutes.ts POST /api/stripe-webhook':
    'Stripe signs the exact bytes; the handler verifies the signature over the raw body',
  'server/routes/mercadoPagoRoutes.ts POST /api/mercadopago/webhook':
    'MercadoPago signs the notification; verified against the raw body',
};

/**
 * Handlers that read a body with no validation signal today. Ordered as the scan finds them.
 * Delete an entry when you validate the route — never add one.
 */
const KNOWN_UNVALIDATED = new Set<string>([
  // Admin analytics: writes limits, overrides and plan changes.
  'server/routes/adminRoutes.ts PUT /api/admin-analytics/users/:userId/plan',
  'server/routes/adminRoutes.ts PUT /api/admin-analytics/users/:userId',
  'server/routes/adminRoutes.ts POST /api/admin-analytics/ai-functions/limits',
  'server/routes/adminRoutes.ts POST /api/admin-analytics/ai-functions/user-overrides',
  'server/routes/adminRoutes.ts POST /api/admin-analytics/blocked-countries',
  // AI: prompts and inputs forwarded to a model without a schema.
  'server/routes/aiRoutes.ts POST /api/ai/categorize',
  'server/routes/aiRoutes.ts POST /api/ai/tip',
  'server/routes/aiRoutes.ts POST /api/ai/financial-health-score',
  'server/routes/aiRoutes.ts POST /api/ai/daily-recommendations',
  'server/routes/aiRoutes.ts POST /api/mascot/toggle',
  'server/routes/aiRoutes.ts POST /api/ai/expense-predictions',
  'server/routes/aiRoutes.ts POST /api/help-chat',
  'server/routes/aiRoutes.ts POST /api/ai/contextual-financial-tips',
  // Profile and account.
  'server/routes/authRoutes.ts PUT /api/auth/user',
  'server/routes/userRoutes.ts POST /api/account/delete',
  'server/routes/userRoutes.ts POST /api/categories',
  'server/routes/userRoutes.ts PUT /api/categories/:id',
  // Sharing a goal with other people.
  'server/routes/collaborativeGoalRoutes.ts POST /api/friends/request',
  'server/routes/collaborativeGoalRoutes.ts POST /api/collaborative-goals',
  'server/routes/collaborativeGoalRoutes.ts POST /api/collaborative-goals/:id/join',
  'server/routes/collaborativeGoalRoutes.ts PUT /api/collaborative-goals/:id',
  'server/routes/collaborativeGoalRoutes.ts POST /api/collaborative-goals/:id/contribute',
  'server/routes/collaborativeGoalRoutes.ts POST /api/collaborative-goals/:id/invite',
  'server/routes/collaborativeGoalRoutes.ts POST /api/collaborative-goals/:id/contributions',
  'server/routes/collaborativeGoalRoutes.ts POST /api/collaborative-goals/:goalId/messages',
  'server/routes/collaborativeGoalRoutes.ts PUT /api/collaborative-goals/messages/:messageId',
  // Backups, reminders, voice and billing.
  'server/routes/exportRoutes.ts POST /api/restore-backup',
  'server/routes/goalRoutes.ts PUT /api/expense-reminders/:id',
  'server/routes/groqVoiceRoutes.ts POST /parse-text',
  'server/routes/groqVoiceRoutes.ts POST /match-category',
  'server/routes/importRoutes.ts POST /api/import/bank-statement/confirm',
  'server/routes/mercadoPagoRoutes.ts POST /api/mercadopago/subscribe',
  'server/routes/mistralVoiceRoutes.ts POST /parse-text',
  'server/routes/mistralVoiceRoutes.ts POST /match-category',
  'server/routes/pdfRoutes.ts POST /api/generate-trends-pdf',
  'server/routes/realtimeRoutes.ts POST /api/notify',
  'server/routes/stripeRoutes.ts POST /api/create-checkout-session',
  'server/routes/stripeRoutes.ts POST /api/switch-plan',
  'server/routes/stripeRoutes.ts POST /api/change-subscription',
]);

const handlers = bodyHandlers();
const unvalidated = handlers
  .filter((handler) => !VALIDATION.test(handler.chunk))
  .map((handler) => handler.key);

describe('body validation coverage', () => {
  it('finds the handlers it is supposed to scan', () => {
    expect(handlers.length).toBeGreaterThan(50);
    expect(handlers.map((handler) => handler.key)).toEqual(
      expect.arrayContaining(['server/routes/transactionRoutes.ts POST /api/transactions']),
    );
  });

  it('has no unvalidated body handler outside the known list', () => {
    const unexpected = unvalidated.filter((key) => !KNOWN_UNVALIDATED.has(key) && !EXEMPT[key]);
    expect(
      unexpected,
      'validate the body with parseBody/parseValue, or justify an EXEMPT entry',
    ).toEqual([]);
  });

  it('lists no stale entries — remove a route once it validates its body', () => {
    const stale = Array.from(KNOWN_UNVALIDATED).filter((key) => !unvalidated.includes(key));
    expect(stale, 'these routes are validated (or gone) now: delete them from KNOWN_UNVALIDATED').toEqual(
      [],
    );
  });

  it('answers invalid input through the shared helper instead of a generic catch', () => {
    for (const file of ['server/routes/transactionRoutes.ts', 'server/routes/goalRoutes.ts']) {
      const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
      expect(source, `${file} must report validation failures with sendValidationError`).toContain(
        'sendValidationError',
      );
      expect(source, `${file} must not throw its way into the route catch`).not.toMatch(
        /insertTransactionSchema\.parse\(|insertExpenseReminderSchema\.parse\(/,
      );
    }
  });
});

