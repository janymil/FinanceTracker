import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { maskBoxes, resolveOcrLanguages, shouldMaskLine } from '../../server/imageAnonymizer';

/**
 * The privacy promise for images is now: "identifying lines are blacked out before the
 * image leaves the server". These tests pin the two halves of that promise — which lines
 * are chosen, and that the pixels really are black afterwards.
 */
describe('shouldMaskLine', () => {
  it('masks identifier-bearing lines', () => {
    expect(shouldMaskLine('IBAN SK89 0200 0000 0000 1234 5678 9012')).toBe(true);
    expect(shouldMaskLine('RUC 20123456789')).toBe(true);
    expect(shouldMaskLine('DNI: 12345678')).toBe(true);
    expect(shouldMaskLine('tel +421 903 123 456')).toBe(true);
    expect(shouldMaskLine('mail jan@example.com')).toBe(true);
    expect(shouldMaskLine('4111 1111 1111 1111')).toBe(true);
    expect(shouldMaskLine('Cuenta: 0011-0234-5678901234')).toBe(true);
  });

  it('masks label lines even when the value is not recognised', () => {
    expect(shouldMaskLine('Titular: JUAN PEREZ GARCIA')).toBe(true);
    expect(shouldMaskLine('CLIENTE: A B C')).toBe(true);
    expect(shouldMaskLine('Dirección: Av. Larco 1234')).toBe(true);
    expect(shouldMaskLine('Account holder  J. Novak')).toBe(true);
    expect(shouldMaskLine('Adresa: Mlynské nivy 5')).toBe(true);
  });

  it('masks the signed-in user name even without a label', () => {
    expect(shouldMaskLine('Ján Novák 12,00 EUR', { names: ['Ján Novák'] })).toBe(true);
    expect(shouldMaskLine('kaptia.e2e@example.com', { email: 'kaptia.e2e@example.com' })).toBe(true);
  });

  it('keeps what the parser needs', () => {
    expect(shouldMaskLine('SUPERMERCADOS PERU S.A.C.')).toBe(false);
    expect(shouldMaskLine('03/10/2026')).toBe(false);
    expect(shouldMaskLine('TOTAL: S/ 53.00')).toBe(false);
    expect(shouldMaskLine('LECHE GLORIA 1L 5.90')).toBe(false);
    expect(shouldMaskLine('FECHA: 23/10/2026 18:42')).toBe(false);
  });

  it('never masks a money row that merely starts with a bank-ish word', () => {
    expect(shouldMaskLine('BANK FEE 5.00')).toBe(false);
    expect(shouldMaskLine('BANK TRANSFER FEE 12.00')).toBe(false);
    expect(shouldMaskLine('Account maintenance 12.00')).toBe(false);
    expect(shouldMaskLine('CUENTA AHORROS 1500.00')).toBe(false);
    expect(shouldMaskLine('PAGO TARJETA VISA 120.50')).toBe(false);
  });

  it('ignores empty or very short lines', () => {
    expect(shouldMaskLine('')).toBe(false);
    expect(shouldMaskLine('  ')).toBe(false);
    expect(shouldMaskLine('12')).toBe(false);
  });
});

describe('maskBoxes', () => {
  it('paints the masked rectangles black and leaves the rest untouched', async () => {
    const image = await sharp({
      create: { width: 100, height: 60, channels: 3, background: { r: 255, g: 255, b: 255 } },
    })
      .png()
      .toBuffer();

    const masked = await maskBoxes(image, [{ x0: 10, y0: 10, x1: 60, y1: 25 }], { padding: 0 });
    const { data, info } = await sharp(masked).raw().toBuffer({ resolveWithObject: true });
    const pixel = (x: number, y: number) => {
      const offset = (y * info.width + x) * info.channels;
      return [data[offset], data[offset + 1], data[offset + 2]];
    };

    expect(pixel(20, 15)).toEqual([0, 0, 0]);
    expect(pixel(59, 24)).toEqual([0, 0, 0]);
    expect(pixel(80, 50)).toEqual([255, 255, 255]);
    expect(pixel(5, 50)).toEqual([255, 255, 255]);
  });

  it('returns the original image when there is nothing to mask', async () => {
    const image = await sharp({
      create: { width: 20, height: 20, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })
      .png()
      .toBuffer();

    const result = await maskBoxes(image, [], {});
    expect(result).toBe(image);
  });
});

describe('resolveOcrLanguages', () => {
  it('falls back to English when the data folder cannot be read', () => {
    expect(resolveOcrLanguages('/nonexistent-reader-dir')).toBe('eng');
  });

  it('uses the languages whose data actually ships with the app', () => {
    // The repository ships eng.traineddata; the answer must never name a language whose
    // data is missing, because tesseract would then try to download it during a request.
    const languages = resolveOcrLanguages().split('+');
    expect(languages).toContain('eng');
    expect(languages.every((language) => ['eng', 'spa', 'slk'].includes(language))).toBe(true);
  });
});
