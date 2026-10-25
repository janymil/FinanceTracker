#!/usr/bin/env node
/**
 * Phase 4 of docs/stripe-sandbox-rehearsal.md: the notification path, against a scratch
 * database and the sandbox keys.
 *
 *   set -a; . ./.env.stripe-sandbox; set +a
 *   export STRIPE_WEBHOOK_SECRET=whsec_rehearsal_local
 *   export DATABASE_URL="$(node scripts/rehearsal-scratch-db.mjs)"
 *   node scripts/rehearsal-stripe-webhook.mjs
 *
 * Signs the payloads locally with the sandbox key (no Stripe CLI needed) and prints what the
 * database says after each step. Never prints a secret. It DELETES the `webhook_events` rows
 * of the scratch database at the start so the run can be repeated; that is why the database
 * must be the scratch one.
 */
import Stripe from 'stripe';
import pg from 'pg';

const secret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_rehearsal_local';
const base = process.env.REHEARSAL_URL || 'http://127.0.0.1:5066';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function send(id, type, object) {
  const payload = JSON.stringify({ id, object: 'event', type, data: { object } });
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret });
  const response = await fetch(`${base}/api/stripe-webhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'stripe-signature': signature },
    body: payload,
  });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

await client.query(
  `insert into users (id, email) values ('user_rehearsal', 'rehearsal@example.com')
   on conflict (id) do update set plan = 'free', billing_interval = 'monthly',
     stripe_customer_id = null, stripe_subscription_id = null`,
);
await client.query('delete from webhook_events');

const checkout = {
  id: 'cs_test_rehearsal',
  object: 'checkout.session',
  payment_status: 'paid',
  customer: 'cus_rehearsal',
  subscription: 'sub_rehearsal',
  metadata: { userId: 'user_rehearsal', plan: 'standard-yearly' },
};

console.log('checkout, first delivery :', await send('evt_rehearsal_1', 'checkout.session.completed', checkout));
console.log('checkout, same event again:', await send('evt_rehearsal_1', 'checkout.session.completed', checkout));

const afterCheckout = await client.query(
  `select plan, billing_interval, stripe_customer_id, stripe_subscription_id
     from users where id = 'user_rehearsal'`,
);
console.log('after checkout            :', afterCheckout.rows[0]);

const refund = {
  id: 'ch_rehearsal',
  object: 'charge',
  customer: 'cus_rehearsal',
  amount: 9990,
  amount_refunded: 9990,
  refunded: true,
};
console.log('full refund               :', await send('evt_rehearsal_2', 'charge.refunded', refund));

const afterRefund = await client.query(
  `select plan, billing_interval, stripe_subscription_id from users where id = 'user_rehearsal'`,
);
console.log('after refund              :', afterRefund.rows[0]);

const events = await client.query(
  'select source, event_key, event_type from webhook_events order by received_at',
);
console.log('recorded notifications    :', events.rows);

await client.end();
