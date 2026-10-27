import { currencyForLanguage, type BillingCurrency } from './pricing';

/**
 * Which payment methods a customer may use.
 *
 * Stripe charges dollars; MercadoPago charges soles (the account is Peruvian). Both used to be
 * one-or-the-other per country, which meant a Peruvian travelling or living abroad lost the only
 * method their wallet works with. So MercadoPago is now offered in **every** country — the payer
 * either logs in with a Peruvian account or pays by card on the Peruvian checkout, and neither
 * depends on where the browser is.
 *
 * Stripe stays available everywhere except Peru, where soles are the market price and a second
 * card path is a support cost with nothing behind it. That block is decided by the country
 * alone: an unknown location never removes a payment method, because guessing wrong locks a
 * paying customer out.
 */
export type PaymentGateway = 'stripe' | 'mercadopago';

export interface BillingRegion {
  country: string | null;
  /** The method the page opens on for this visitor. */
  gateway: PaymentGateway;
  /** Every method this visitor may use, preferred first. */
  gateways: PaymentGateway[];
  /** True where Stripe must not be offered (Peru). */
  stripeBlocked: boolean;
  /** Currency of `gateway` — what the page quotes until the person picks another method. */
  currency: BillingCurrency;
}

export function regionForCountry(country: string | null | undefined, language?: string | null): BillingRegion {
  const code = String(country ?? '').trim().toUpperCase();
  // Cloudflare uses XX (unknown) and T1 (Tor) for addresses it cannot place.
  const known = /^[A-Z]{2}$/.test(code) && code !== 'XX' && code !== 'T1';

  const currency: BillingCurrency = known
    ? (code === 'PE' ? 'pen' : 'usd')
    : currencyForLanguage(language);

  const stripeBlocked = known && code === 'PE';
  const gateways: PaymentGateway[] = stripeBlocked ? ['mercadopago'] : ['stripe', 'mercadopago'];

  return {
    country: known ? code : null,
    gateway: currency === 'pen' ? 'mercadopago' : 'stripe',
    gateways,
    stripeBlocked,
    currency,
  };
}

