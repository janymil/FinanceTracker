import { describe, expect, it } from 'vitest';
import {
  SIN_DATOS_DOCUMENT_NUMBER,
  profileSchema,
  profileValues,
} from '../../server/billingProfileInput';

/**
 * What the account's document data may look like when it is stored.
 *
 * The rule that matters here is the one that asks for nothing: a boleta with no DNI and no
 * name. Refusing that payload is what a previous version did, and it locked a natural person
 * out of paying in soles — SUNAT accepts the boleta, so the validator must accept it too and
 * store the placeholder the operator will type.
 */

const parse = (input: unknown) => profileSchema.safeParse(input);

describe('boleta to clientes varios — no name, no number', () => {
  it('is accepted and stored with SUNAT’s placeholder', () => {
    const result = parse({ kind: 'boleta', documentType: 'none' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(profileValues(result.data)).toMatchObject({
      kind: 'boleta',
      documentType: 'none',
      documentNumber: SIN_DATOS_DOCUMENT_NUMBER,
      businessName: null,
      fiscalAddress: null,
    });
  });

  it('keeps the name typed on the boleta and drops the fiscal address', () => {
    const result = parse({
      kind: 'boleta',
      documentType: 'none',
      businessName: 'Ana Torres',
      fiscalAddress: 'Av. Arequipa 123',
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    const values = profileValues(result.data);
    // The name is an optional box the buyer fills on purpose; the address is not a boleta field.
    expect(values.businessName).toBe('Ana Torres');
    expect(values.fiscalAddress).toBeNull();
  });

  it('cannot be a factura: a factura is identified by a RUC', () => {
    expect(parse({ kind: 'factura', documentType: 'none' }).success).toBe(false);
  });
});

describe('boleta with a DNI', () => {
  it('still needs eight digits', () => {
    expect(parse({ kind: 'boleta', documentType: 'dni', documentNumber: '1234567' }).success).toBe(false);
    expect(parse({ kind: 'boleta', documentType: 'dni', documentNumber: '12345678' }).success).toBe(true);
  });

  it('keeps the number as typed', () => {
    const result = parse({ kind: 'boleta', documentType: 'dni', documentNumber: '12345678' });
    if (!result.success) throw new Error('expected a valid boleta');
    expect(profileValues(result.data).documentNumber).toBe('12345678');
  });
});

describe('factura', () => {
  const complete = {
    kind: 'factura',
    documentType: 'ruc',
    documentNumber: '20123456789',
    businessName: 'Ana Torres SAC',
    fiscalAddress: 'Av. Arequipa 123, Lima',
  };

  it('accepts a complete one', () => {
    expect(parse(complete).success).toBe(true);
  });

  it('rejects a RUC that is not eleven digits', () => {
    expect(parse({ ...complete, documentNumber: '2012345678' }).success).toBe(false);
  });

  it('rejects it without razón social or fiscal address', () => {
    expect(parse({ ...complete, businessName: '' }).success).toBe(false);
    expect(parse({ ...complete, fiscalAddress: '' }).success).toBe(false);
  });

  it('rejects a factura typed on a DNI', () => {
    expect(parse({ ...complete, documentType: 'dni', documentNumber: '12345678' }).success).toBe(false);
  });
});
