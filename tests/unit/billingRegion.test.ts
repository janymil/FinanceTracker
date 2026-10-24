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
});
