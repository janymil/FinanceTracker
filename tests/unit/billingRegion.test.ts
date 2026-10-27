import { describe, expect, it } from 'vitest';
import { regionForCountry } from '../../shared/billingRegion';

describe('regionForCountry', () => {
  it('sends Peru to MercadoPago in soles, whatever the page language', () => {
    expect(regionForCountry('PE', 'en')).toMatchObject({ gateway: 'mercadopago', currency: 'pen', country: 'PE' });
    expect(regionForCountry('pe', 'sk')).toMatchObject({ gateway: 'mercadopago' });
  });

  it('sends every other country to Stripe in dollars, even on a Spanish page', () => {
    expect(regionForCountry('US', 'es')).toMatchObject({ gateway: 'stripe', currency: 'usd' });
    expect(regionForCountry('MX', 'es')).toMatchObject({ gateway: 'stripe', currency: 'usd' });
  });

  it('falls back to the page language when the country is unknown', () => {
    expect(regionForCountry(null, 'es')).toMatchObject({ gateway: 'mercadopago', country: null });
    expect(regionForCountry('XX', 'en')).toMatchObject({ gateway: 'stripe', country: null });
    expect(regionForCountry('T1', 'es')).toMatchObject({ gateway: 'mercadopago' });
  });

  it('offers MercadoPago in every country, and keeps Stripe out of Peru only', () => {
    // Peru: soles, MercadoPago only — Stripe is the restricted side now.
    expect(regionForCountry('PE', 'en')).toMatchObject({
      gateway: 'mercadopago',
      gateways: ['mercadopago'],
      stripeBlocked: true,
    });

    // Everywhere else both are offered, Stripe first. This is what a Peruvian abroad needs:
    // the browser says Spain or the US, and their MercadoPago account still works.
    for (const country of ['SK', 'US', 'ES', 'MX']) {
      expect(regionForCountry(country, 'sk')).toMatchObject({
        gateway: 'stripe',
        gateways: ['stripe', 'mercadopago'],
        stripeBlocked: false,
      });
    }
  });

  it('never removes Stripe on a guess', () => {
    // No country to go on: the language still picks the price shown first, but nothing is
    // blocked — locking a paying customer out of a method is worse than offering one extra.
    expect(regionForCountry(null, 'es')).toMatchObject({
      currency: 'pen',
      gateway: 'mercadopago',
      gateways: ['stripe', 'mercadopago'],
      stripeBlocked: false,
    });
    expect(regionForCountry('XX', 'sk').stripeBlocked).toBe(false);
    expect(regionForCountry('T1', 'es').stripeBlocked).toBe(false);
  });
});
