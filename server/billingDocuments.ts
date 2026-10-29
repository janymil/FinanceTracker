import { and, asc, desc, eq, isNotNull, lte } from 'drizzle-orm';
import { db } from './db';
import { billingDocuments, billingProfiles, users } from '../shared/schema';
import { log } from './logger';
import { PLAN_PRICES, type BillingInterval, type PlanId } from '../shared/pricing';

/**
 * The Peruvian tax-document queue.
 *
 * Boletas and facturas are issued by hand in SUNAT clave sol — no CPE automation, by decision.
 * What the app owes the operator is therefore not a document but a **row**: who paid, how much,
 * for which plan and period, with the fiscal data the customer submitted. That row is written
 * the moment money is confirmed, before anything else can go wrong, and it is the only place
 * the series and number of the issued document are recorded afterwards.
 *
 * Nothing here may fail a payment: a missing profile or a duplicate charge is logged, not thrown
 * into the checkout path.
 */

export interface BillingDocumentInput {
  userId: string;
  plan: PlanId;
  interval: BillingInterval;
  currency: 'pen' | 'usd';
  provider: 'mercadopago' | 'stripe' | 'manual';
  /** The charge this document belongs to (payment id, preapproval + period, manual payment id). */
  providerReference: string | null;
  periodStart: Date;
  /** Overrides the computed period end (a manual payment already knows the date it buys). */
  periodEnd?: Date;
  amountCents?: number;
}

/** One month or one year after `start`, in UTC — the same arithmetic the providers use. */
export function periodEnd(start: Date, interval: BillingInterval): Date {
  const end = new Date(start.getTime());
  if (interval === 'yearly') {
    end.setUTCFullYear(end.getUTCFullYear() + 1);
  } else {
    end.setUTCMonth(end.getUTCMonth() + 1);
  }
  return end;
}

/**
 * The identity of a charge, as one key: `preapprovalId#2026-10`.
 *
 * MercadoPago reports the first payment twice — once as the subscription being authorised and
 * once as the charge it produced — and a retried notification reports the same charge again. A
 * key of the subscription alone would merge every renewal into one document; a key of the charge
 * alone would queue two documents for the first payment. Subscription + month is unique per
 * period and identical for both notices, which is exactly what "one charge, one document" means.
 */
export function chargeReference(providerReference: string, at: Date): string {
  const month = `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, '0')}`;
  return `${providerReference}#${month}`;
}

/**
 * Writes the pending document for a confirmed charge.
 *
 * Returns the row id, or null when the customer has not asked for a Peruvian document yet (no
 * profile) — in that case there is nothing the operator could issue, and inventing a row with
 * an empty RUC would be worse than an empty queue.
 */
export async function recordBillingDocument(input: BillingDocumentInput): Promise<number | null> {
  try {
    const [profile] = await db
      .select()
      .from(billingProfiles)
      .where(eq(billingProfiles.userId, input.userId))
      .limit(1);

    if (!profile) {
      log.info(
        `[Billing] ${input.userId} paid ${input.plan}/${input.interval} with no tax profile: no document queued`,
      );
      return null;
    }

    const periodStart = input.periodStart;
    const periodEndAt = input.periodEnd ?? periodEnd(periodStart, input.interval);
    const amountCents =
      input.amountCents ?? Math.round(PLAN_PRICES[input.plan][input.currency][input.interval] * 100);

    const [row] = await db
      .insert(billingDocuments)
      .values({
        userId: input.userId,
        kind: profile.kind,
        documentType: profile.documentType,
        documentNumber: profile.documentNumber,
        businessName: profile.businessName,
        fiscalAddress: profile.fiscalAddress,
        email: profile.email,
        amountCents,
        currency: input.currency,
        plan: input.plan,
        interval: input.interval,
        provider: input.provider,
        providerReference: input.providerReference,
        periodStart,
        periodEnd: periodEndAt,
        status: 'pending',
      })
      .onConflictDoNothing()
      .returning({ id: billingDocuments.id });

    if (!row) {
      // The same charge was already queued: a webhook delivered twice, or the return trip and the
      // notification racing. One charge, one document.
      log.info(`[Billing] document for ${input.provider}:${input.providerReference} already queued`);
      return null;
    }

    log.info(
      `[Billing] queued ${profile.kind} ${amountCents / 100} ${input.currency} for ${input.userId} (${input.plan}/${input.interval})`,
    );
    return row.id;
  } catch (error) {
    // A payment must never fail because the document queue could not be written.
    log.error(
      '[Billing] could not queue the tax document:',
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}


/** A customer's own documents, newest first (their profile page). */
export async function listBillingDocumentsForUser(userId: string) {
  return db
    .select()
    .from(billingDocuments)
    .where(eq(billingDocuments.userId, userId))
    .orderBy(desc(billingDocuments.createdAt))
    .limit(100);
}

/** Everything waiting for a human in clave sol. */
export async function listPendingBillingDocuments(limit = 200) {
  return db
    .select()
    .from(billingDocuments)
    .where(eq(billingDocuments.status, 'pending'))
    .orderBy(asc(billingDocuments.createdAt))
    .limit(limit);
}

/**
 * Records what SUNAT gave back: series, number and the day it was issued.
 *
 * Refuses to mark an already issued document twice: two documents with one number is exactly
 * the mistake this table exists to prevent.
 */
export async function markBillingDocumentIssued(params: {
  id: number;
  series: string;
  number: string;
  issuedAt?: Date;
  notes?: string | null;
}): Promise<'issued' | 'missing' | 'already'> {
  const [row] = await db
    .select({ id: billingDocuments.id, status: billingDocuments.status })
    .from(billingDocuments)
    .where(eq(billingDocuments.id, params.id))
    .limit(1);

  if (!row) return 'missing';
  if (row.status === 'issued') return 'already';

  await db
    .update(billingDocuments)
    .set({
      status: 'issued',
      series: params.series,
      number: params.number,
      issuedAt: params.issuedAt ?? new Date(),
      notes: params.notes ?? null,
      updatedAt: new Date(),
    })
    .where(eq(billingDocuments.id, params.id));

  return 'issued';
}

/** Which account a preapproval belongs to (renewal notifications name the charge, not the user). */
export async function findUserByPreapproval(preapprovalId: string) {
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.mpPreapprovalId, preapprovalId))
    .limit(1);
  return row ?? null;
}

/** Accounts whose requested downgrade has come due. Empty list when none, never a throw. */
export async function listDuePendingPlanChanges(now: Date = new Date()) {
  return db
    .select()
    .from(users)
    .where(
      and(
        isNotNull(users.pendingPlan),
        isNotNull(users.pendingChangeAt),
        lte(users.pendingChangeAt, now),
      ),
    );
}
