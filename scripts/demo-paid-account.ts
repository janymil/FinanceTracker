/**
 * Creates a demo account and gives it a paid period through the app's own payment flow.
 *
 * Every step goes through the real endpoints — no database writes of its own:
 *   1. ensures the person exists in the sign-in service, with a verified address and a password;
 *   2. asks the service for a session token for that person, so the API treats the calls below
 *      as that customer's own;
 *   3. `GET /api/auth/user` — creates the account row exactly like a first login;
 *   4. `PUT /api/billing-profile` — the boleta/factura data;
 *   5. `POST /api/payments/manual` — a Yape / Plin / transfer claim, the way the page sends it;
 *   6. opens the signed approve link that the notification e-mail carries;
 *   7. reads the result back: plan, period end, queued document.
 *
 * It is an operator tool: the approve link is normally clicked by a human from the e-mail, and
 * this is the same link, signed with the same secret by the same function.
 *
 * There is no card charge anywhere in this path, and it does not set a provider subscription id:
 * a subscription needs a real card, and a fake id would make the cancellation and renewal logic
 * lie about money that was never taken.
 *
 *   npx tsx scripts/demo-paid-account.ts \
 *     --email demo@kaptia.app --password 'DemoKaptia!2026' \
 *     --plan premium --interval yearly --method yape --operation DEMO-001
 */
import { config } from 'dotenv';
config({ path: '.env' });

import { manualPaymentReviewUrl } from '../server/routes/billingAccountRoutes';

const APP = (process.env.APP_URL || 'http://127.0.0.1:5000').replace(/\/+$/, '');
const CLERK = 'https://api.clerk.com/v1';
const SECRET = process.env.CLERK_SECRET_KEY;

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  const value = index !== -1 ? process.argv[index + 1] : undefined;
  return value || fallback;
}

async function clerkCall(path: string, init: RequestInit = {}) {
  const response = await fetch(`${CLERK}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${SECRET}`,
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      `Clerk ${init.method ?? 'GET'} ${path} → ${response.status}: ${JSON.stringify(data).slice(0, 300)}`,
    );
  }
  return data;
}

async function main() {
  if (!SECRET) throw new Error('CLERK_SECRET_KEY is required');

  const email = arg('email', 'demo@kaptia.app');
  const password = arg('password', 'DemoKaptia!2026');
  const plan = arg('plan', 'premium');
  const interval = arg('interval', 'yearly');
  const method = arg('method', 'yape');
  const operation = arg('operation', `DEMO-${Date.now()}`);

  // 1. The person.
  const found = await clerkCall(`/users?email_address=${encodeURIComponent(email)}`);
  let user = found?.data?.[0];
  if (!user) {
    user = await clerkCall('/users', {
      method: 'POST',
      body: JSON.stringify({
        email_address: [email],
        password,
        first_name: 'Demo',
        last_name: 'Cliente',
        skip_password_checks: true,
        // This instance requires recorded consent for every new user.
        legal_accepted_at: new Date().toISOString(),
      }),
    });
    console.log(`created account ${user.id}`);
  } else {
    console.log(`reusing account ${user.id}`);
  }

  // A sign-in with an unverified address is refused, so the address is marked verified. It is a
  // demo mailbox that receives nothing, and nobody else can use it to reach the account.
  const primary =
    user.email_addresses?.find((entry: any) => entry.id === user.primary_email_address_id) ??
    user.email_addresses?.[0];
  if (primary && primary.verification?.status !== 'verified') {
    await clerkCall(`/email_addresses/${primary.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ verified: true }),
    });
    console.log('marked the demo address verified so the account can sign in');
  }

  // 2. A session token: the API is called as this customer, not as an administrator.
  const session = await clerkCall('/sessions', {
    method: 'POST',
    body: JSON.stringify({ user_id: user.id }),
  });
  const token = (await clerkCall(`/sessions/${session.id}/tokens`, { method: 'POST' })).jwt;
  if (!token) throw new Error('no session token was issued');

  const call = async (path: string, init: RequestInit = {}) => {
    const response = await fetch(`${APP}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'x-user-language': 'es',
        ...(init.headers ?? {}),
      },
    });
    const body = await response.json().catch(() => ({}));
    return { status: response.status, body };
  };

  // 3. First login: creates the account row.
  const me = await call('/api/auth/user');
  console.log(`account row: ${me.status} ${me.body?.email ?? ''} plan=${me.body?.plan ?? '?'}`);

  // 4. The tax document the customer would ask for.
  const profile = await call('/api/billing-profile', {
    method: 'PUT',
    body: JSON.stringify({ kind: 'boleta', documentType: 'dni', documentNumber: '12345678', email }),
  });
  console.log(`billing profile: ${profile.status}`);

  // 5. The claim, exactly as the payment page sends it.
  const claim = await call('/api/payments/manual', {
    method: 'POST',
    body: JSON.stringify({ plan, interval, method, operationNumber: operation, payerName: 'Demo Cliente' }),
  });
  if (claim.status !== 201) throw new Error(`claim failed: ${claim.status} ${JSON.stringify(claim.body)}`);
  console.log(`claim #${claim.body.id} for ${claim.body.amountCents / 100} PEN (${method})`);

  // 6. The link the team would click in the notification e-mail.
  const approveUrl = manualPaymentReviewUrl(APP, claim.body.id, 'approve');
  if (!approveUrl) throw new Error('PAYMENTS_REVIEW_SECRET is not configured, so no link can be signed');
  const approved = await fetch(approveUrl);
  const page = await approved.text();
  console.log(`approve link: ${approved.status} ${/Pago confirmado/.test(page) ? 'confirmed' : page.slice(0, 120)}`);

  // 7. What the customer sees now.
  const after = await call('/api/auth/user');
  const documents = await call('/api/billing-documents');
  const document = documents.body?.documents?.[0];

  console.log('');
  console.log('--- result ---');
  console.log(`user        ${after.body?.id}`);
  console.log(`email       ${after.body?.email}`);
  console.log(`plan        ${after.body?.plan} / ${after.body?.billingInterval}`);
  console.log(`paid until  ${after.body?.paidUntil}`);
  console.log(
    `renews      ${
      after.body?.mpPreapprovalId || after.body?.stripeSubscriptionId
        ? 'yes (provider subscription)'
        : 'no — one period, no card'
    }`,
  );
  console.log(
    `document    ${
      document ? `${document.kind} ${document.amountCents / 100} ${document.currency} ${document.status}` : 'none'
    }`,
  );
  console.log(`password    ${password}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

