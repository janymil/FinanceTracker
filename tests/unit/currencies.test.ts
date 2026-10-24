import { describe, expect, it } from 'vitest';
import { CURRENCIES, currencyByCode, formatCurrencyAmount, resolveStoredCurrency } from '../../shared/currencies';

describe('currencies', () => {
  it('has unique ISO codes and covers the Latin American peso family', () => {
    const codes = CURRENCIES.map((currency) => currency.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of ['PEN', 'USD', 'MXN', 'COP', 'CLP', 'ARS', 'BRL', 'UYU', 'BOB']) {
      expect(codes).toContain(code);
    }
  });

  it('tells apart currencies that share the "$" symbol', () => {
    const dollarLike = CURRENCIES.filter((currency) => currency.symbol === '$').map((currency) => currency.code);
    expect(dollarLike).toEqual(expect.arrayContaining(['USD', 'MXN', 'COP', 'CLP', 'ARS']));
    expect(resolveStoredCurrency('MXN')?.code).toBe('MXN');
  });

  it('understands accounts that stored a symbol before ISO codes', () => {
    expect(resolveStoredCurrency('S/')?.code).toBe('PEN');
    expect(resolveStoredCurrency('$')?.code).toBe('USD');
    expect(resolveStoredCurrency('R$')?.code).toBe('BRL');
  });

  it('accepts codes in any case and rejects unknown values', () => {
    expect(resolveStoredCurrency('pen')?.code).toBe('PEN');
    expect(resolveStoredCurrency('')).toBeNull();
    expect(resolveStoredCurrency('XYZ')).toBeNull();
    expect(resolveStoredCurrency(null)).toBeNull();
  });

  it('formats with the right number of decimals', () => {
    expect(formatCurrencyAmount(1234.5, 'PEN', 'es')).toMatch(/S\/\s?1,234\.50/);
    expect(formatCurrencyAmount(1234.5, 'USD', 'en')).toBe('$1,234.50');
    // Chilean pesos have no decimals: 1.234 (not 1.234,50)
    expect(formatCurrencyAmount(1234.5, 'CLP', 'es')).toMatch(/1[.,\s]?23[45]/);
    expect(formatCurrencyAmount(1234.5, 'CLP', 'es')).not.toMatch(/,50|\.50/);
  });

  it('falls back to dollars for an unknown code instead of throwing', () => {
    expect(formatCurrencyAmount(5, 'NOPE', 'en')).toBe('$5.00');
  });

  it('looks up by code', () => {
    expect(currencyByCode('clp')?.decimals).toBe(0);
  });
});
