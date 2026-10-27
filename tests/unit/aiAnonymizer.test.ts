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

  it('never mistakes a drifted float tail for an account number', () => {
    // 0.1 + 0.2 in binary floating point. Summed with `parseFloat` in aiRoutes a total like this
    // reached the model, the account rule matched the 14-digit tail after the point, and the
    // person read "income was 1246.[account]". The card rule had the same hole: the tail passed
    // Luhn, so it became "1246.[card]" instead.
    const drifted = 'income was 1246.30000000000004 and spending 987.6543210000001';
    expect(anonymizeText(drifted).text).toBe(drifted);

    // The rules still do their job: a long run that is not part of a decimal number.
    expect(anonymizeText('cuenta 1234567890123').text).toBe('cuenta [account]');
    // …including when it ends a sentence.
    expect(anonymizeText('ref 1234567890123.').text).toBe('ref [account].');
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

/**
 * Gaps found in the privacy review: these values used to reach the model untouched.
 */
describe('anonymizeText: identifiers that used to slip through', () => {
  it('removes local-format mobiles written without a country code', () => {
    expect(anonymizeText('llamame al 0912 345 678').text).toBe('llamame al [phone]');
    expect(anonymizeText('tel 0903 123 456').text).toBe('tel [phone]');
  });

  it('removes Peruvian account numbers written in groups but keeps dates and invoices', () => {
    expect(anonymizeText('cuenta 0011-0810-0100123456').text).toBe('cuenta [account]');
    expect(anonymizeText('cuenta 193-1234567-0-12').text).toBe('cuenta [account]');
    // A date and a non-card invoice number must survive: the model needs both.
    expect(anonymizeText('movimiento 2026-01-15').text).toBe('movimiento 2026-01-15');
    expect(anonymizeText('invoice 1234 5678 9012 3456').text).toBe('invoice 1234 5678 9012 3456');
  });

  it('removes a third party named in a transfer description', () => {
    expect(anonymizeText('transferencia a nombre de Juan Pérez').text).toBe(
      'transferencia a nombre de [person]',
    );
    expect(anonymizeText('sent to Ana Ruiz').text).toBe('sent to [person]');
    expect(anonymizeText('beneficiario: Ana Ruiz Gómez').text).toBe('beneficiario: [person]');
    // An ordinary phrase is not a person and stays readable.
    expect(anonymizeText('transferencia de alimentos').text).toBe('transferencia de alimentos');
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
