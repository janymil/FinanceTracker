import crypto from 'crypto';
import type { Express, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { log } from '../logger';
import { isAuthenticated, getUserId } from '../clerkAuth';
import { adminAuth } from '../adminAuth';
import { storage } from '../storage';
import { db } from '../db';
import { billingProfiles, manualPayments } from '../../shared/schema';
import { PLAN_PRICES, type BillingInterval, type PlanId } from '../../shared/pricing';
import {
  listBillingDocumentsForUser,
  listPendingBillingDocuments,
  markBillingDocumentIssued,
  periodEnd,
  recordBillingDocument,
} from '../billingDocuments';
import { sendEmail } from '../emailService';
import { rateLimit } from '../middleware/rateLimit';
import { parseBody, sendValidationError } from '../validation';

/**
 * The Peruvian side of paying: which document the customer needs, and the wallet/transfer path.
 *
 * Two facts shape this file:
 *
 *  1. A subscription that renews by itself can only run on a card. MercadoPago's "pagos
 *     automáticos" list is cards only, and Yape's approval token is single-use by design. So
 *     Yape, Plin and bank transfer are **one-shot**: a period is bought, it does not renew, and
 *     the customer is told so.
 *  2. Nothing in MercadoPago can confirm a transfer, so the row is a claim until a human
 *     confirms it. The confirmation is a signed link in the notification e-mail — no shared
 *     admin password travels through an inbox, and no admin screen has to exist for a payment
 *     to be approved.
 *
 * Boletas and facturas are still typed into SUNAT by hand; what this file guarantees is that
 * the data, the amount and the period are already recorded when the operator gets there.
 */

const TEAM_ADDRESS = process.env.EMAIL_TO || 'info@kaptia.app';
const NO_REPLY_ADDRESS =
  process.env.EMAIL_NO_REPLY || process.env.EMAIL_FROM || 'no-reply@kaptia.app';

const METHOD_LABELS: Record<string, string> = {
  yape: 'Yape',
  plin: 'Plin',
  transfer: 'Transferencia bancaria',
};

const PLAN_LABELS: Record<string, string> = {
  standard: 'Standard',
  premium: 'Premium',
};

/**
 * The key the approval link is signed with.
 *
 * A dedicated value is preferred; otherwise an existing server secret is reused, because a
 * link that cannot be verified is worse than no link at all (it would either be ignored or —
 * worse — accepted). When nothing is available the mail goes out without links and the row
 * waits for someone to approve it by hand.
 */
function reviewSecret(): string | null {
  return (
    process.env.PAYMENTS_REVIEW_SECRET ||
    process.env.ADMIN_PASSWORD ||
    process.env.STRIPE_SECRET_KEY ||
    process.env.MERCADOPAGO_ACCESS_TOKEN ||
    null
  );
}

const LINK_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export function signManualPaymentReview(
  id: number,
  decision: 'approve' | 'reject',
  expiresAt: number,
): string | null {
  const secret = reviewSecret();
  if (!secret) return null;
  const digest = crypto
    .createHmac('sha256', secret)
    .update(`manual-payment:${id}:${decision}:${expiresAt}`)
    .digest('hex');
  return `${expiresAt}.${digest}`;
}

function reviewTokenValid(
  id: number,
  decision: 'approve' | 'reject',
  token: string | undefined,
): boolean {
  const secret = reviewSecret();
  if (!secret || !token) return false;
  const [expiresRaw, digest] = token.split('.');
  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`manual-payment:${id}:${decision}:${expiresAt}`)
    .digest('hex');
  const provided = Buffer.from(digest ?? '', 'utf8');
  const calculated = Buffer.from(expected, 'utf8');
  return provided.length === calculated.length && crypto.timingSafeEqual(provided, calculated);
}

/**
 * The approve/reject link for one claim.
 *
 * Exported so the operator tool (`scripts/demo-paid-account.ts`) and, in the future, an admin
 * screen can build the same link without copying the signing rule. Two copies of a signature
 * formula is how a link that "should work" silently stops working.
 */
export function manualPaymentReviewUrl(
  base: string,
  id: number,
  decision: 'approve' | 'reject' = 'approve',
): string | null {
  const expiresAt = Date.now() + LINK_TTL_MS;
  const token = signManualPaymentReview(id, decision, expiresAt);
  if (!token) return null;
  return `${base.replace(/\/+$/, '')}/api/payments/manual/${id}/review?decision=${decision}&token=${encodeURIComponent(token)}`;
}

function reviewUrl(req: Request, id: number, decision: 'approve' | 'reject'): string | null {
  const base =
    (process.env.APP_URL || process.env.BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
  return manualPaymentReviewUrl(base, id, decision);
}

/** Soles in cents — the same table the payment page quoted from. */
function priceInCents(plan: PlanId, interval: BillingInterval): number {
  return Math.round(PLAN_PRICES[plan].pen[interval] * 100);
}

function soles(cents: number): string {
  return `S/ ${(cents / 100).toFixed(2)}`;
}


const profileSchema = z
  .object({
    kind: z.enum(['boleta', 'factura']),
    documentType: z.enum(['dni', 'ruc']),
    documentNumber: z.string().trim().regex(/^[0-9]{8,11}$/),
    businessName: z.string().trim().max(160).optional().or(z.literal('')),
    fiscalAddress: z.string().trim().max(240).optional().or(z.literal('')),
    email: z.string().trim().max(160).email().optional().or(z.literal('')),
  })
  .refine((data) => data.documentType !== 'dni' || /^\d{8}$/.test(data.documentNumber), {
    path: ['documentNumber'],
    message: 'A DNI is eight digits',
  })
  .refine((data) => data.kind !== 'factura' || data.documentType === 'ruc', {
    path: ['documentType'],
    message: 'A factura needs a RUC',
  })
  .refine((data) => data.documentType !== 'ruc' || /^\d{11}$/.test(data.documentNumber), {
    path: ['documentNumber'],
    message: 'A RUC is eleven digits',
  })
  .refine((data) => data.kind !== 'factura' || Boolean(data.businessName), {
    path: ['businessName'],
    message: 'A factura needs the razón social',
  })
  .refine((data) => data.kind !== 'factura' || Boolean(data.fiscalAddress), {
    path: ['fiscalAddress'],
    message: 'A factura needs the fiscal address',
  });

const manualPaymentSchema = z.object({
  plan: z.enum(['standard', 'premium']),
  interval: z.enum(['monthly', 'yearly']),
  method: z.enum(['yape', 'plin', 'transfer']),
  operationNumber: z.string().trim().min(3).max(64),
  payerName: z.string().trim().max(160).optional().or(z.literal('')),
  note: z.string().trim().max(500).optional().or(z.literal('')),
});

/** What SUNAT gives back for one issued document. */
const issueSchema = z.object({
  series: z.string().trim().min(1).max(12),
  number: z.string().trim().min(1).max(20),
});

export function registerBillingAccountRoutes(app: Express) {
  /** The fiscal data the customer wants on their document (null until they fill it in). */
  app.get('/api/billing-profile', isAuthenticated, async (req: any, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    try {
      const [profile] = await db
        .select()
        .from(billingProfiles)
        .where(eq(billingProfiles.userId, userId))
        .limit(1);
      return res.json({ profile: profile ?? null });
    } catch (error) {
      log.error('[Billing] could not read the tax profile:', error instanceof Error ? error.message : error);
      return res.status(503).json({ error: 'Billing is not available yet', code: 'billing_not_migrated' });
    }
  });

  /** Saves it. Validated against SUNAT's shapes: DNI 8 digits, RUC 11, razón social for a factura. */
  app.put('/api/billing-profile', isAuthenticated, async (req: any, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid billing data',
        fields: parsed.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    const data = parsed.data;
    const values = {
      userId,
      kind: data.kind,
      documentType: data.documentType,
      documentNumber: data.documentNumber,
      businessName: data.businessName || null,
      fiscalAddress: data.fiscalAddress || null,
      email: data.email || null,
      updatedAt: new Date(),
    };

    try {
      const [profile] = await db
        .insert(billingProfiles)
        .values(values)
        .onConflictDoUpdate({ target: billingProfiles.userId, set: values })
        .returning();
      return res.json({ success: true, profile });
    } catch (error) {
      log.error('[Billing] could not save the tax profile:', error instanceof Error ? error.message : error);
      return res.status(503).json({ error: 'Billing is not available yet', code: 'billing_not_migrated' });
    }
  });

  /** The documents issued (or waiting) for this account. */
  app.get('/api/billing-documents', isAuthenticated, async (req: any, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    try {
      const documents = await listBillingDocumentsForUser(userId);
      return res.json({ documents });
    } catch (error) {
      log.error('[Billing] could not list documents:', error instanceof Error ? error.message : error);
      return res.status(503).json({ error: 'Billing is not available yet', code: 'billing_not_migrated' });
    }
  });

  /**
   * A wallet or transfer payment the customer says they made.
   *
   * Nothing here grants access. The row is a claim with the operation number, and the team gets
   * an approve/reject link. The customer is told plainly that this payment does not renew —
   * Yape, Plin and transfers cannot be charged again by themselves.
   */
  app.post(
    '/api/payments/manual',
    isAuthenticated,
    rateLimit({ windowMs: 60 * 60 * 1000, max: 5, keyPrefix: 'manual-payments' }),
    async (req: any, res: Response) => {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: 'Authentication required' });

      const parsed = manualPaymentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: 'Invalid payment details',
          fields: parsed.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        });
      }

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ error: 'User not found' });

      // One subscription at a time: a card subscription must be cancelled first, otherwise the
      // same access would be paid for twice.
      if (user.plan !== 'free' && (user.stripeSubscriptionId || user.mpPreapprovalId)) {
        return res.status(409).json({
          error: 'You already have an active subscription. Cancel it before paying another way.',
          code: 'already_subscribed',
        });
      }

      const { plan, interval, method, operationNumber, payerName, note } = parsed.data;
      const amountCents = priceInCents(plan, interval);

      try {
        const [row] = await db
          .insert(manualPayments)
          .values({
            userId,
            plan,
            interval,
            amountCents,
            currency: 'pen',
            method,
            operationNumber,
            payerName: payerName || null,
            note: note || null,
            status: 'pending',
          })
          .returning();

        const approve = reviewUrl(req, row.id, 'approve');
        const reject = reviewUrl(req, row.id, 'reject');
        const lines = [
          `Pago pendiente de confirmar — Kaptia`,
          ``,
          `Cliente: ${user.firstName || ''} ${user.lastName || ''}`.trim(),
          `Cuenta: ${userId}`,
          `Correo: ${user.email || '-'}`,
          `Plan: ${PLAN_LABELS[plan]} ${interval === 'yearly' ? 'anual' : 'mensual'}`,
          `Monto: ${soles(amountCents)}`,
          `Método: ${METHOD_LABELS[method]}`,
          `Número de operación: ${operationNumber}`,
          payerName ? `Pagador: ${payerName}` : '',
          note ? `Nota: ${note}` : '',
          ``,
          approve
            ? `Confirmar el pago: ${approve}`
            : 'Sin enlaces de confirmación: PAYMENTS_REVIEW_SECRET no está configurado.',
          reject ? `Rechazar: ${reject}` : '',
          ``,
          `Al confirmar, el plan se activa por ${interval === 'yearly' ? 'un año' : 'un mes'} y la`,
          `boleta o factura entra en la cola de documentos.`,
        ].filter(Boolean);

        const [notified] = await Promise.all([
          sendEmail({
            to: TEAM_ADDRESS,
            from: NO_REPLY_ADDRESS,
            subject: `[Kaptia] Pago ${METHOD_LABELS[method]} pendiente — ${soles(amountCents)}`,
            text: lines.join('\n'),
          }),
        ]);

        log.info(
          `[Billing] manual payment ${row.id} (${method}, ${soles(amountCents)}) claimed by ${userId}; team notified: ${notified}`,
        );
        return res.status(201).json({
          success: true,
          id: row.id,
          status: 'pending',
          amountCents,
          message:
            'We received your payment details. Access is activated once the payment is confirmed, ' +
            'usually within one working day. This payment does not renew automatically.',
        });
      } catch (error) {
        log.error('[Billing] could not record the manual payment:', error instanceof Error ? error.message : error);
        return res.status(503).json({ error: 'Payments are not available yet', code: 'billing_not_migrated' });
      }
    },
  );


  /**
   * The approve/reject link from the notification e-mail.
   *
   * The token is the credential: it names one payment and one decision, expires in two weeks,
   * and cannot be replayed into a different row. Pressing the link twice changes nothing —
   * a payment is reviewed once.
   */
  app.get('/api/payments/manual/:id/review', async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const decision = String(req.query.decision ?? '');
    const token = typeof req.query.token === 'string' ? req.query.token : undefined;

    if (!Number.isInteger(id) || (decision !== 'approve' && decision !== 'reject')) {
      return res.status(400).type('html').send(reviewPage('Enlace no válido', 'Falta el identificador del pago o la decisión.'));
    }
    if (!reviewTokenValid(id, decision, token)) {
      return res
        .status(401)
        .type('html')
        .send(reviewPage('Enlace caducado o inválido', 'Este enlace no se puede usar. Revisa el pago desde el panel de administración.'));
    }

    try {
      const [row] = await db.select().from(manualPayments).where(eq(manualPayments.id, id)).limit(1);
      if (!row) {
        return res.status(404).type('html').send(reviewPage('Pago no encontrado', `No existe el pago #${id}.`));
      }
      if (row.status !== 'pending') {
        return res
          .type('html')
          .send(reviewPage('Ya revisado', `El pago #${id} ya está ${row.status === 'approved' ? 'confirmado' : 'rechazado'}.`));
      }

      const reviewedAt = new Date();
      const user = await storage.getUser(row.userId);

      if (decision === 'reject') {
        await db
          .update(manualPayments)
          .set({ status: 'rejected', reviewedAt, updatedAt: reviewedAt })
          .where(eq(manualPayments.id, id));

        if (user?.email) {
          await sendEmail({
            to: user.email,
            from: NO_REPLY_ADDRESS,
            subject: 'No pudimos confirmar tu pago — Kaptia',
            text: [
              `Hola ${user.firstName || ''}`.trim(),
              '',
              `No pudimos confirmar el pago de ${soles(row.amountCents)} por ${METHOD_LABELS[row.method] || row.method}.`,
              'No se activó ningún plan y no se realizó ningún cobro.',
              'Escríbenos a info@kaptia.app con tu número de operación si crees que es un error.',
            ].join('\n'),
          }).catch(() => undefined);
        }

        log.info(`[Billing] manual payment ${id} rejected`);
        return res
          .type('html')
          .send(reviewPage('Pago rechazado', `El pago #${id} quedó rechazado y el cliente fue avisado.`));
      }

      const startsAt = reviewedAt;
      const endsAt = periodEnd(startsAt, row.interval as BillingInterval);

      await storage.updateUserPlan(row.userId, row.plan as PlanId, row.interval as BillingInterval);
      // A wallet payment buys one period and does not renew: `paidUntil` is what ends it.
      await storage.updateUser(row.userId, { paidUntil: endsAt } as any);
      await db
        .update(manualPayments)
        .set({ status: 'approved', reviewedAt, updatedAt: reviewedAt })
        .where(eq(manualPayments.id, id));

      await recordBillingDocument({
        userId: row.userId,
        plan: row.plan as PlanId,
        interval: row.interval as BillingInterval,
        currency: 'pen',
        provider: 'manual',
        providerReference: `manual:${id}`,
        periodStart: startsAt,
        periodEnd: endsAt,
        amountCents: row.amountCents,
      });

      if (user?.email) {
        await sendEmail({
          to: user.email,
          from: NO_REPLY_ADDRESS,
          subject: 'Tu plan de Kaptia está activo',
          text: [
            `Hola ${user.firstName || ''}`.trim(),
            '',
            `Confirmamos tu pago de ${soles(row.amountCents)} y tu plan ${PLAN_LABELS[row.plan] || row.plan} ya está activo.`,
            `Vale hasta el ${endsAt.toISOString().slice(0, 10)}.`,
            '',
            'Este pago no se renueva automáticamente: te avisaremos antes de que termine el periodo.',
            'Tu boleta o factura se emite en las siguientes horas hábiles.',
          ].join('\n'),
        }).catch(() => undefined);
      }

      log.info(
        `[Billing] manual payment ${id} approved; ${row.userId} has ${row.plan} until ${endsAt.toISOString()}`,
      );
      return res
        .type('html')
        .send(
          reviewPage(
            'Pago confirmado',
            `El pago #${id} quedó aprobado. El plan vale hasta el ${endsAt.toISOString().slice(0, 10)}.`,
          ),
        );
    } catch (error) {
      log.error('[Billing] review link failed:', error instanceof Error ? error.message : error);
      return res.status(503).type('html').send(reviewPage('No se pudo procesar', 'Inténtalo de nuevo en unos minutos.'));
    }
  });


  /**
   * Where to send a Yape, Plin or transfer payment.
   *
   * The account holder and the numbers are configuration, not code: the Peruvian entity is still
   * being constituted, and the day its account exists the details change without a deploy.
   */
  app.get('/api/payments/manual/instructions', isAuthenticated, (_req: Request, res: Response) => {
    return res.json({
      legalName: process.env.PAYMENTS_LEGAL_NAME || 'Kaptia',
      yape: process.env.PERU_YAPE_NUMBER || null,
      plin: process.env.PERU_PLIN_NUMBER || null,
      bank: {
        name: process.env.PERU_BANK_NAME || null,
        account: process.env.PERU_BANK_ACCOUNT || null,
        cci: process.env.PERU_BANK_CCI || null,
        holder: process.env.PERU_BANK_HOLDER || null,
      },
      // Says plainly what the customer is buying: one period, no automatic renewal.
      renewsAutomatically: false,
    });
  });

  /** Which claims are waiting for a human, and which documents are waiting for SUNAT. */
  app.get('/api/admin/manual-payments', adminAuth, async (_req: Request, res: Response) => {
    try {
      const rows = await db
        .select()
        .from(manualPayments)
        .where(eq(manualPayments.status, 'pending'))
        .limit(200);
      return res.json({ payments: rows });
    } catch (error) {
      log.error('[Billing] could not list manual payments:', error instanceof Error ? error.message : error);
      return res.status(503).json({ error: 'Billing is not available yet', code: 'billing_not_migrated' });
    }
  });

  app.get('/api/admin/billing-documents', adminAuth, async (_req: Request, res: Response) => {
    try {
      const documents = await listPendingBillingDocuments();
      return res.json({ documents });
    } catch (error) {
      log.error('[Billing] could not list pending documents:', error instanceof Error ? error.message : error);
      return res.status(503).json({ error: 'Billing is not available yet', code: 'billing_not_migrated' });
    }
  });

  /** Records the series and number SUNAT gave the operator. */
  app.post('/api/admin/billing-documents/:id/issue', adminAuth, async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const parsed = parseBody(req, issueSchema);
    if (!parsed.ok) {
      return sendValidationError(res, parsed.issues, 'Invalid document data');
    }
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Invalid document id' });
    }

    const series = parsed.data.series.toUpperCase();
    const number = parsed.data.number;

    try {
      const outcome = await markBillingDocumentIssued({ id, series, number });
      if (outcome === 'missing') return res.status(404).json({ error: 'Document not found' });
      if (outcome === 'already') {
        return res.status(409).json({ error: 'This document is already marked as issued', code: 'already_issued' });
      }
      return res.json({ success: true });
    } catch (error) {
      log.error('[Billing] could not record the issued document:', error instanceof Error ? error.message : error);
      return res.status(500).json({ error: 'Could not record the document' });
    }
  });
}

/** A tiny page for the person who clicked the link in their inbox. Input is never echoed. */
function reviewPage(title: string, message: string): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:3rem auto;padding:0 1rem;line-height:1.5">
<h1 style="font-size:1.25rem">${title}</h1><p>${message}</p>
<p><a href="/es">Ir a Kaptia</a></p></body></html>`;
}

