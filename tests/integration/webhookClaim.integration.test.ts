import { afterAll, beforeAll, expect, it } from 'vitest';
import { databaseTestUrl as testUrl, describeDb } from './dbTestEnv';

/**
 * Webhook de-duplication is a *lease*, not a tombstone. This is the one property that cannot
 * be tested without Postgres: if the process dies between claiming an event and finishing it,
 * the gateway's retry has to be able to take the claim over. Before this, the retry was
 * answered as a duplicate and the event was lost — a lost cancellation or refund left a paid
 * plan that nothing was paying for.
 *
 *   DATABASE_URL_TEST=postgresql://… npm run test:integration
 */
describeDb('webhook claims are a lease (real database)', () => {
  let storage: typeof import('../../server/storage')['storage'];
  const source = 'stripe';
  const key = `itest_claim_${Date.now()}`;

  beforeAll(async () => {
    process.env.DATABASE_URL = testUrl as string;
    process.env.NODE_ENV = 'test';
    process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'a'.repeat(64);
    ({ storage } = await import('../../server/storage'));
  });

  afterAll(async () => {
    await storage.releaseWebhookEvent(source, key);
  });

  it('lets the first delivery through and refuses a second one while it is being handled', async () => {
    expect(await storage.claimWebhookEvent({ source, key, type: 'checkout.session.completed' })).toBe(true);
    expect(await storage.claimWebhookEvent({ source, key, type: 'checkout.session.completed' })).toBe(false);
  });

  it('lets a retry take over a claim whose owner died', async () => {
    const { db } = await import('../../server/db');
    const { webhookEvents } = await import('../../shared/schema');
    const { and, eq } = await import('drizzle-orm');

    // Back-date the claim: the delivery that owns it never came back.
    await db
      .update(webhookEvents)
      .set({ receivedAt: new Date(Date.now() - 10 * 60 * 1000) })
      .where(and(eq(webhookEvents.source, source), eq(webhookEvents.eventKey, key)));

    expect(await storage.claimWebhookEvent({ source, key })).toBe(true);
  });

  it('forgets a claim that was explicitly released, so an error is retried', async () => {
    await storage.releaseWebhookEvent(source, key);
    expect(await storage.claimWebhookEvent({ source, key })).toBe(true);
  });
});
