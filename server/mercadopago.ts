/**
 * MercadoPago — subscriptions paid in Peruvian soles.
 *
 * Stripe keeps handling USD. This module only knows how to create and read a MercadoPago
 * *preapproval* (their recurring-subscription object), so the whole integration is one
 * file with no SDK: two REST calls and a webhook signature check.
 *
 * Everything is inert until MERCADOPAGO_ACCESS_TOKEN is present, so the app keeps working
 * (Stripe only) while the account is being verified.
 */
import crypto from 'crypto';
import { PLAN_PRICES, type BillingInterval, type PlanId } from '../shared/pricing';

const API_BASE = 'https://api.mercadopago.com';

export function isMercadoPagoConfigured(): boolean {
  return Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN);
}

function accessToken(): string {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new Error('MercadoPago is not configured');
  return token;
}

async function mpFetch(path: string, init: RequestInit = {}): Promise<any> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken()}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const message = data?.message || data?.error || `MercadoPago ${response.status}`;
    throw new Error(message);
  }
  return data;
}

export interface CreatePreapprovalInput {
  userId: string;
  plan: PlanId;
  interval: BillingInterval;
  payerEmail: string;
  /** Absolute URL the payer returns to after authorising. */
  backUrl: string;
}

export interface CreatedPreapproval {
  id: string;
  initPoint: string;
}

export async function createPreapproval(input: CreatePreapprovalInput): Promise<CreatedPreapproval> {
  const amount = PLAN_PRICES[input.plan].pen[input.interval];

  const body = {
    reason: `Kaptia ${input.plan}`,
    external_reference: input.userId,
    payer_email: input.payerEmail,
    back_url: input.backUrl,
    status: 'pending',
    auto_recurring: {
      frequency: 1,
      frequency_type: input.interval === 'yearly' ? 'years' : 'months',
      transaction_amount: amount,
      currency_id: 'PEN',
    },
  };

  const data = await mpFetch('/preapproval', { method: 'POST', body: JSON.stringify(body) });

  const initPoint = data?.init_point || data?.sandbox_init_point;
  if (!data?.id || !initPoint) {
    throw new Error('MercadoPago did not return an authorisation URL');
  }

  return { id: String(data.id), initPoint: String(initPoint) };
}

export interface PreapprovalState {
  id: string;
  status: string;
  externalReference: string | null;
  plan: PlanId;
  interval: BillingInterval;
}

function planFromReason(reason: string | undefined): PlanId {
  return String(reason ?? '').toLowerCase().includes('premium') ? 'premium' : 'standard';
}

function intervalFromPreapproval(data: any): BillingInterval {
  const frequencyType = String(data?.auto_recurring?.frequency_type ?? 'months').toLowerCase();
  return frequencyType.startsWith('year') ? 'yearly' : 'monthly';
}

function toState(data: any): PreapprovalState {
  return {
    id: String(data.id),
    status: String(data.status ?? 'unknown'),
    externalReference: data.external_reference ? String(data.external_reference) : null,
    plan: planFromReason(data.reason),
    interval: intervalFromPreapproval(data),
  };
}

export async function getPreapproval(id: string): Promise<PreapprovalState> {
  const data = await mpFetch(`/preapproval/${encodeURIComponent(id)}`);
  return toState(data);
}

/** Most recent preapproval for a user (used when the payer comes back from MercadoPago). */
export async function findPreapprovalForUser(userId: string): Promise<PreapprovalState | null> {
  const data = await mpFetch(`/preapproval/search?external_reference=${encodeURIComponent(userId)}`);
  const results: any[] = Array.isArray(data?.results) ? data.results : [];
  if (results.length === 0) return null;
  const sorted = [...results].sort((a, b) => String(b.date_created ?? '').localeCompare(String(a.date_created ?? '')));
  return toState(sorted[0]);
}

export async function cancelPreapproval(id: string): Promise<void> {
  await mpFetch(`/preapproval/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'cancelled' }),
  });
}

/**
 * MercadoPago signs webhooks as `x-signature: ts=<unix>,v1=<hmac>` over
 * `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` with the webhook secret.
 */
export function verifyWebhookSignature(params: {
  signatureHeader: string | undefined;
  requestId: string | undefined;
  dataId: string | undefined;
  secret: string | undefined;
}): boolean {
  const { signatureHeader, requestId, dataId, secret } = params;
  // Without a configured secret there is nothing to verify; callers still re-read the
  // preapproval from the API, so a forged id cannot upgrade anyone who did not pay.
  if (!secret) return true;
  if (!signatureHeader || !dataId) return false;

  const parts = signatureHeader.split(',').reduce<Record<string, string>>((acc, part) => {
    const [key, value] = part.split('=').map((piece) => piece?.trim());
    if (key && value) acc[key] = value;
    return acc;
  }, {});

  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const manifest = `id:${dataId};request-id:${requestId ?? ''};ts:${ts};`;
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

  const provided = Buffer.from(v1, 'utf8');
  const calculated = Buffer.from(expected, 'utf8');
  return provided.length === calculated.length && crypto.timingSafeEqual(provided, calculated);
}
