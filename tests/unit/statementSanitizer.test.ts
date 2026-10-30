import { describe, expect, it } from 'vitest';
import { countRedactions, sanitizeStatementText } from '../../shared/textSanitizer';

/**
 * The statement consent screen promises that identifiers are removed before an AI provider reads
 * the file. These are the cases that promise was failing on, written as the statement lines people
 * actually upload — plus the cases where the old patterns did the opposite and destroyed the
 * merchant name the categoriser needs.
 */
describe('sanitizeStatementText', () => {
  it('removes the account holder name when it is printed in capitals', () => {
    const { sanitized } = sanitizeStatementText('Titular: JUAN PEREZ GARCIA\nSaldo: 1200', {
      holderNames: ['Juan Perez Garcia'],
    });

    expect(sanitized).not.toContain('JUAN');
    expect(sanitized).toContain('[NAME_REDACTED]');
  });

  it('matches the holder name without diacritics as printed by the bank', () => {
    const { sanitized } = sanitizeStatementText('Klient: JAN NOVAK\n', {
      holderNames: ['Ján Novák'],
    });

    expect(sanitized).not.toContain('NOVAK');
  });

  it('removes a name that follows a header label even when the account name is unknown', () => {
    const { sanitized } = sanitizeStatementText('Account holder: MARIA LOPEZ RAMOS\nMovimientos');

    expect(sanitized).not.toContain('MARIA');
    expect(sanitized).toContain('[NAME_REDACTED]');
  });

  it('removes an IBAN printed in groups', () => {
    const { sanitized } = sanitizeStatementText('IBAN: SK68 1100 0000 0026 1234 5678');

    expect(sanitized).not.toContain('1234 5678');
    expect(sanitized).toContain('[IBAN_REDACTED]');
  });

  it('removes an IBAN printed without spaces', () => {
    const { sanitized } = sanitizeStatementText('IBAN SK6811000000002612345678');

    expect(sanitized).not.toContain('SK6811000000002612345678');
  });

  it('removes a card number printed with spaces', () => {
    const { sanitized } = sanitizeStatementText('Tarjeta: 4111 1111 1111 1111');

    expect(sanitized).not.toContain('4111');
    expect(sanitized).toContain('[CARD_REDACTED]');
  });

  it('removes a card number printed with dashes', () => {
    const { sanitized } = sanitizeStatementText('CARD 4111-1111-1111-1111');

    expect(sanitized).not.toContain('4111');
  });

  it('removes the Central-European birth number', () => {
    const { sanitized } = sanitizeStatementText('Rodne cislo 900101/1234');

    expect(sanitized).not.toContain('900101');
    expect(sanitized).toContain('[SSN_REDACTED]');
  });

  it('keeps merchant names intact so the categoriser can read them', () => {
    const { sanitized } = sanitizeStatementText(
      ['04/03 Tesco Stores Bratislava  -12,40 EUR', 'Kaufland Slovakia  -45,10 EUR', 'UBER TRIP  S/ 24.50'].join('\n'),
    );

    expect(sanitized).toContain('Tesco Stores');
    expect(sanitized).toContain('Kaufland Slovakia');
    expect(sanitized).toContain('UBER TRIP');
  });

  it('keeps amounts intact, including long ones', () => {
    const { sanitized } = sanitizeStatementText('Pago  12345678.90\nCargo  -12,40');

    expect(sanitized).toContain('12345678.90');
    expect(sanitized).toContain('-12,40');
  });

  it('never reports a readable identifier in the examples it returns', () => {
    const { detectedData } = sanitizeStatementText('IBAN: SK68 1100 0000 0026 1234 5678');

    const examples = detectedData.flatMap((hit) => hit.examples).join(' ');
    expect(examples).not.toContain('SK68');
  });

  it('counts every redaction it made', () => {
    const { detectedData } = sanitizeStatementText(
      'Tarjeta: 4111 1111 1111 1111\nIBAN: SK68 1100 0000 0026 1234 5678',
    );

    expect(countRedactions(detectedData)).toBeGreaterThanOrEqual(2);
  });
});
