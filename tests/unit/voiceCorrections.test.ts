import { describe, expect, it } from 'vitest';
import {
  SPANISH_AMOUNT_PATTERNS,
  applyAmountCorrections,
  findAmountCorrection,
} from '../../shared/voiceCorrections';

/**
 * Module 5 of step 4: deterministic amount corrections that used to be inline in
 * `server/mistralTransactionParser.ts`. These run regardless of the model's answer.
 */

describe('findAmountCorrection', () => {
  it('detects every hardcoded Spanish pattern', () => {
    expect(findAmountCorrection('cinco ochenta')?.expectedAmount).toBe('5.80');
    expect(findAmountCorrection('dos cincuenta')?.expectedAmount).toBe('2.50');
    expect(findAmountCorrection('tres veinte')?.expectedAmount).toBe('3.20');
  });

  it('is case-insensitive', () => {
    expect(findAmountCorrection('CINCO OCHENTA')?.expectedAmount).toBe('5.80');
    expect(findAmountCorrection('Dos   Cincuenta')?.expectedAmount).toBe('2.50');
  });

  it('returns null for unrelated transcripts', () => {
    expect(findAmountCorrection('compré pan por 2 soles')).toBeNull();
    expect(findAmountCorrection('')).toBeNull();
  });

  it('exposes the pattern list for documentation', () => {
    expect(SPANISH_AMOUNT_PATTERNS).toHaveLength(3);
  });
});

describe('applyAmountCorrections', () => {
  it('overrides a wrong model answer', () => {
    expect(applyAmountCorrections('cinco ochenta de pan', '580')).toEqual({
      amount: '5.80',
      corrected: true,
      label: 'cinco ochenta',
    });
  });

  it('leaves a correct answer untouched', () => {
    expect(applyAmountCorrections('cinco ochenta', '5.80')).toEqual({
      amount: '5.80',
      corrected: false,
      label: 'cinco ochenta',
    });
  });

  it('keeps the original value when no pattern applies', () => {
    expect(applyAmountCorrections('café 2,50', '2.50')).toEqual({ amount: '2.50', corrected: false });
  });

  it('normalises non-string / missing amounts', () => {
    expect(applyAmountCorrections('café', undefined).amount).toBe('');
    expect(applyAmountCorrections('café', null).amount).toBe('');
    expect(applyAmountCorrections('café', 2.5).amount).toBe('2.5');
  });

  it('corrects even when the model returned nothing', () => {
    expect(applyAmountCorrections('dos cincuenta', '').amount).toBe('2.50');
    expect(applyAmountCorrections('dos cincuenta', undefined).corrected).toBe(true);
  });
});
