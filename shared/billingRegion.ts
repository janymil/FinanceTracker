import { currencyForLanguage, type BillingCurrency } from './pricing';

/**
 * Which payment gateway a customer may use.
 *
 * Peru pays in soles through MercadoPago; every other country pays in dollars through
 * Stripe. The country comes from the request IP (the server reads it from the CDN header).
 * When the country is unknown (local dev, no CDN) the page language is the fallback.
 */
export type PaymentGateway = 'stripe' | 'mercadopago';

export interface BillingRegion {
  country: string | null;
  gateway: PaymentGateway;
  currency: BillingCurrency;
}

export function regionForCountry(country: string | null | undefined, language?: string | null): BillingRegion {
  const code = String(country ?? '').trim().toUpperCase();
  // Cloudflare uses XX (unknown) and T1 (Tor) for addresses it cannot place.
  const known = /^[A-Z]{2}$/.test(code) && code !== 'XX' && code !== 'T1';

  const currency: BillingCurrency = known
    ? (code === 'PE' ? 'pen' : 'usd')
    : currencyForLanguage(language);

  return {
    country: known ? code : null,
    currency,
    gateway: currency === 'pen' ? 'mercadopago' : 'stripe',
  };
}
