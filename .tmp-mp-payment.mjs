import fs from 'node:fs';

const env = Object.fromEntries(
  fs
    .readFileSync('/var/www/kaptia/.env', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    }),
);

const app = JSON.parse(fs.readFileSync('/tmp/app.json', 'utf8'));
const testToken = app.test_access_token;
const publicKey = env.MERCADOPAGO_PUBLIC_KEY;

const cardTokenRes = await fetch(
  `https://api.mercadopago.com/v1/card_tokens?public_key=${encodeURIComponent(publicKey)}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      card_number: '4509953566233704',
      expiration_month: 11,
      expiration_year: 2030,
      security_code: '123',
      cardholder: { name: 'APRO', identification: { type: 'DNI', number: '12345678' } },
    }),
  },
);
const card = await cardTokenRes.json();
console.log('card token ->', cardTokenRes.status, '| live_mode:', card.live_mode, '| last4:', card.last_four_digits);
if (!card.id) {
  console.log(JSON.stringify(card).slice(0, 500));
  process.exit(1);
}

const payerCandidates = [
  'sandbox@kaptia.app',
  'buyer@example.com',
  'test@test.com',
];

const paymentBody = (payerEmail) => ({
  transaction_amount: 9.9,
  token: card.id,
  description: 'Kaptia sandbox test 9.90 PEN',
  installments: 1,
  payment_method_id: 'visa',
  external_reference: `kaptia-sandbox-${Date.now()}`,
  notification_url: 'https://kaptia.app/api/mercadopago/webhook',
  payer: {
    ...(payerEmail ? { email: payerEmail } : {}),
    identification: { type: 'DNI', number: '12345678' },
  },
});

for (const email of payerCandidates) {
  const res = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${testToken}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': `kaptia-sandbox-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    },
    body: JSON.stringify(paymentBody(email)),
  });
  const body = await res.json();
  console.log(`\npayment with payer ${email} ->`, res.status);
  console.log('  id:', body.id, '| status:', body.status, '| detail:', body.status_detail);
  console.log('  live_mode:', body.live_mode, '| amount:', body.transaction_amount, body.currency_id);
  console.log('  method:', body.payment_method_id, body.payment_type_id);
  if (body.message || body.error || body.cause) {
    console.log('  error:', JSON.stringify(body.message || body.error), JSON.stringify(body.cause || '').slice(0, 300));
  }
  if (['approved', 'in_process', 'pending', 'authorized'].includes(String(body.status))) break;
}
