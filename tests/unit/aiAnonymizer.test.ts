import { describe, expect, it } from 'vitest';
import {
  anonymizeDeep,
  anonymizeMessages,
  anonymizeText,
  containsIdentifiers,
} from '../../shared/aiAnonymizer';

/**
 * The privacy policy says receipt and expense text is stripped of identifying details
 * before it reaches an AI model. These tests are what keeps that sentence true: if a rule
 * is removed or a new payload shape slips through, the promise breaks here first.
 */
describe('anonymizeText', () => {
  it('removes e-mail addresses', () => {
    const { text, redactions } = anonymizeText('Contact jan.novak@example.com for the invoice');
    expect(text).toBe('Contact [email] for the invoice');
    expect(redactions.email).toBe(1);
  });

  it('removes IBANs in spaced and compact form', () => {
    expect(anonymizeText('IBAN SK89 0200 0000 0000 1234 5678 9012').text).toBe('IBAN [iban]');
    expect(anonymizeText('IBAN SK8902000000000012345678').text).toBe('IBAN [iban]');
  });

  it('removes card numbers but never amounts', () => {
    const card = anonymizeText('card 4111 1111 1111 1111 total 4111.11');
    expect(card.text).toBe('card [card] total 4111.11');
    expect(card.redactions.card).toBe(1);

    // A 16-digit number that fails the Luhn check is not a card (e.g. an invoice id).
    expect(anonymizeText('invoice 1234 5678 9012 3456').text).toContain('1234 5678 9012 3456');
  });

  it('removes phone numbers with and without a country code', () => {
    expect(anonymizeText('tel +421 903 123 456').text).toBe('tel [phone]');
    expect(anonymizeText('tel 903 123 456').text).toBe('tel [phone]');
  });

  it('removes Slovak birth numbers, Spanish DNI/NIE and Peruvian RUC', () => {
    expect(anonymizeText('nar. 900101/1234').text).toBe('nar. [national-id]');
    expect(anonymizeText('DNI 12345678Z').text).toBe('DNI [national-id]');
    expect(anonymizeText('NIE X1234567L').text).toBe('NIE [national-id]');
    expect(anonymizeText('RUC 20123456789').text).toBe('RUC [tax-id]');
  });

  it('removes postal addresses in both orders', () => {
    expect(anonymizeText('ul. Mlynské nivy 5, Bratislava').text).toBe('[address], Bratislava');
    expect(anonymizeText('Calle Los Olivos 123, Lima').text).toBe('[address], Lima');
    expect(anonymizeText('221B Baker Street').text).toBe('[address]');
  });

  it('removes the account holder line but keeps the rest of the line', () => {
    const { text } = anonymizeText('Account holder: Ján Novák, IBAN SK89 0200 0000 0000 1234 5678 9012');
    expect(text).toBe('Account holder: [person], IBAN [iban]');
  });

  it('removes long account/reference numbers', () => {
    expect(anonymizeText('account 1234567890123456').text).toBe('account [account]');
  });

  it('removes the signed-in user name and e-mail when supplied', () => {
    const { text } = anonymizeText('Ján Novák paid 12,00 EUR', {
      names: ['Ján Novák'],
      email: 'jan@example.com',
    });
    expect(text).toBe('[removed] paid 12,00 EUR');
  });

  it('removes the customer name and document number on a Peruvian receipt', () => {
    expect(anonymizeText('CLIENTE: JUAN PEREZ GARCIA').text).toBe('CLIENTE: [person]');
    expect(anonymizeText('DNI: 12345678').text).toBe('DNI: [national-id]');
    expect(anonymizeText('PAGO CON TARJETA **** 4321').text).toBe('PAGO CON TARJETA [card]');
  });

  it('keeps what the model needs: merchant, amount, date, category', () => {
    const input = 'Lidl Bratislava 2026-10-23 23,50 EUR groceries';
    expect(anonymizeText(input).text).toBe(input);
  });

  it('is idempotent', () => {
    const once = anonymizeText('mail jan@example.com tel +421 903 123 456').text;
    expect(anonymizeText(once).text).toBe(once);
    expect(containsIdentifiers(once)).toBe(false);
  });
});

describe('anonymizeDeep', () => {
  it('scrubs strings, drops account identifiers and keeps amounts as they are', () => {
    const { value } = anonymizeDeep({
      userId: 'user_2abc',
      transactions: [
        {
          id: 'tx1',
          description: 'Payment to Ján Novák, IBAN SK89 0200 0000 0000 1234 5678 9012',
          amount: '23.50',
          date: '2026-10-23',
          email: 'jan@example.com',
        },
      ],
    } as any);

    expect(value.userId).toBeUndefined();
    expect(value.transactions[0].description).toBe('Payment to Ján Novák, IBAN [iban]');
    expect(value.transactions[0].amount).toBe('23.50');
    expect(value.transactions[0].date).toBe('2026-10-23');
    expect(value.transactions[0].email).toBeUndefined();
    // A merchant-like personal name without a "holder" label is left alone on purpose:
    // removing every capitalised word would destroy merchant names.
    expect(value.transactions[0].description).toContain('Ján Novák');
  });
});

describe('anonymizeMessages', () => {
  it('scrubs string content and multimodal text parts', () => {
    const messages = anonymizeMessages([
      { role: 'system', content: 'You are a parser' },
      { role: 'user', content: 'Café in Lima, receipt for jan@example.com' },
      {
        role: 'user',
        content: [{ type: 'text', text: 'tel +51 987 654 321' }],
      },
    ] as any);

    expect(messages[1].content).toBe('Café in Lima, receipt for [email]');
    expect((messages[2].content as any)[0].text).toBe('tel [phone]');
  });
});
