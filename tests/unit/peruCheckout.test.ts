import { describe, expect, it } from 'vitest';
import {
  BOLETA_SIN_DATOS_LIMIT_CENTS,
  EMPTY_COMPROBANTE,
  boletaSinDatosAllowed,
  comprobanteFromProfile,
  comprobanteIssues,
  documentTypeOf,
  isComprobanteComplete,
  kindOf,
  paymentTarget,
  selectionOf,
  withComprobanteSelection,
  type ComprobanteDraft,
} from '../../shared/peruCheckout';

/**
 * The document a Peruvian customer pays for, and the account the money goes to.
 *
 * Both are checked before the money moves, because both are unrecoverable afterwards: a
 * factura cannot be re-issued to another RUC, and a deposit into an account nobody showed the
 * customer cannot be matched to their claim.
 *
 * Peru has **two** documents, and the boleta is one of them — not three. The DNI and the name
 * are optional boxes on that boleta, and leaving them empty is what a boleta normally looks
 * like («clientes varios»). What is pinned here: nothing is required on a boleta, a half-typed
 * DNI is caught before it is printed, and the S/ 700 rule still turns the DNI into a must.
 */

const boleta = (patch: Partial<ComprobanteDraft> = {}): ComprobanteDraft => ({
  ...EMPTY_COMPROBANTE,
  documentType: 'dni',
  documentNumber: '12345678',
  documentName: 'Ana Torres',
  ...patch,
});

/** The same boleta with both optional boxes empty. */
const sinDatos = (patch: Partial<ComprobanteDraft> = {}): ComprobanteDraft => ({
  ...EMPTY_COMPROBANTE,
  documentType: 'dni',
  ...patch,
});

const factura = (patch: Partial<ComprobanteDraft> = {}): ComprobanteDraft => ({
  documentType: 'ruc',
  documentNumber: '20123456789',
  documentName: 'Ana Torres SAC',
  fiscalAddress: 'Av. Arequipa 123, Lima',
  email: '',
  ...patch,
});

const codes = (draft: ComprobanteDraft, rules?: { amountCents?: number }) =>
  comprobanteIssues(draft, rules).map((issue) => issue.code);

describe('boleta — one document, two optional boxes', () => {
  it('is complete with both boxes empty: the boleta to «clientes varios»', () => {
    expect(isComprobanteComplete(sinDatos())).toBe(true);
    expect(kindOf(sinDatos())).toBe('boleta');
    expect(selectionOf(sinDatos())).toBe('boleta');
    expect(documentTypeOf(sinDatos())).toBe('none');
  });

  it('is complete with a DNI, and says so when it is stored', () => {
    expect(isComprobanteComplete(boleta())).toBe(true);
    expect(documentTypeOf(boleta())).toBe('dni');
  });

  it('keeps a name typed without a DNI, and still stores a clientes varios', () => {
    const named = sinDatos({ documentName: 'Ana Torres' });
    expect(isComprobanteComplete(named)).toBe(true);
    expect(documentTypeOf(named)).toBe('none');
  });

  it('does not ask for the name when a DNI was given', () => {
    expect(codes(boleta({ documentName: '   ' }))).toEqual([]);
  });

  it('rejects a half-typed DNI, because it would be printed as an identifier', () => {
    expect(codes(boleta({ documentNumber: '1234567' }))).toEqual(['dni']);
    expect(codes(boleta({ documentNumber: '123456789' }))).toEqual(['dni']);
    expect(codes(sinDatos({ documentNumber: '123' }))).toEqual(['dni']);
  });

  it('strips spaces and dashes instead of rejecting them', () => {
    expect(codes(boleta({ documentNumber: '12 345-678' }))).toEqual([]);
    expect(documentTypeOf(boleta({ documentNumber: '12 345-678' }))).toBe('dni');
  });

  it('does not need a fiscal address', () => {
    expect(codes(boleta({ fiscalAddress: '' }))).toEqual([]);
  });

  it('still refuses a broken e-mail, because that is where the document goes', () => {
    expect(codes(sinDatos({ email: 'ana@' }))).toEqual(['email']);
  });

  it('stays under SUNAT’s ceiling for every plan this app sells', () => {
    expect(boletaSinDatosAllowed(9990)).toBe(true); // standard monthly
    expect(boletaSinDatosAllowed(19990)).toBe(true); // premium yearly
  });

  it('is refused above S/ 700 per document', () => {
    expect(boletaSinDatosAllowed(BOLETA_SIN_DATOS_LIMIT_CENTS)).toBe(true);
    expect(boletaSinDatosAllowed(BOLETA_SIN_DATOS_LIMIT_CENTS + 1)).toBe(false);
  });

  it('needs the DNI above the ceiling, and accepts the same amount once it has one', () => {
    expect(codes(sinDatos(), { amountCents: 19990 })).toEqual([]);
    expect(codes(sinDatos(), { amountCents: BOLETA_SIN_DATOS_LIMIT_CENTS + 1 })).toEqual(['limit']);
    expect(isComprobanteComplete(sinDatos(), { amountCents: BOLETA_SIN_DATOS_LIMIT_CENTS + 1 })).toBe(false);
    expect(codes(boleta(), { amountCents: BOLETA_SIN_DATOS_LIMIT_CENTS + 1 })).toEqual([]);
  });
});


describe('factura — a company, identified by RUC', () => {
  it('accepts eleven digits, razón social and fiscal address', () => {
    expect(isComprobanteComplete(factura())).toBe(true);
    expect(kindOf(factura())).toBe('factura');
    expect(selectionOf(factura())).toBe('factura');
  });

  it('rejects a RUC that is not eleven digits', () => {
    expect(codes(factura({ documentNumber: '2012345678' }))).toEqual(['ruc']);
  });

  it('rejects a factura without razón social or fiscal address', () => {
    expect(codes(factura({ documentName: '' }))).toEqual(['name']);
    expect(codes(factura({ fiscalAddress: '  ' }))).toEqual(['address']);
  });
});

describe('e-mail on the document', () => {
  it('is optional, because the account already has one', () => {
    expect(codes(boleta({ email: '' }))).toEqual([]);
  });

  it('is refused when it is not an address', () => {
    expect(codes(boleta({ email: 'ana.torres' }))).toEqual(['email']);
    expect(codes(boleta({ email: 'ana@kaptia' }))).toEqual(['email']);
    expect(codes(boleta({ email: 'ana@kaptia.app' }))).toEqual([]);
  });
});

describe('switching cards', () => {
  it('never carries a DNI into the RUC box', () => {
    const switched = withComprobanteSelection(boleta(), 'factura');
    expect(switched.documentType).toBe('ruc');
    expect(switched.documentNumber).toBe('');
    // The name survives: the same person is usually still paying.
    expect(switched.documentName).toBe('Ana Torres');
  });

  it('drops the razón social and the address when going back to the boleta', () => {
    const switched = withComprobanteSelection(factura(), 'boleta');
    expect(switched.documentType).toBe('dni');
    expect(switched.documentNumber).toBe('');
    // A company name or a fiscal address on a boleta is a document nobody can use.
    expect(switched.documentName).toBe('');
    expect(switched.fiscalAddress).toBe('');
  });

  it('returns the same object when the card did not change', () => {
    const draft = boleta();
    expect(withComprobanteSelection(draft, 'boleta')).toBe(draft);
  });

  it('leaves a prefilled boleta alone when its card is clicked again', () => {
    const prefilled = comprobanteFromProfile({
      kind: 'boleta',
      documentType: 'none',
      documentNumber: '00000000',
      businessName: 'Ana Torres',
    });
    expect(prefilled.documentType).toBe('dni');
    expect(withComprobanteSelection(prefilled, 'boleta')).toBe(prefilled);
  });
});

describe('prefilling from the saved profile', () => {
  it('starts from an empty boleta when the account has none', () => {
    expect(comprobanteFromProfile(null, 'ana@kaptia.app')).toEqual({
      ...EMPTY_COMPROBANTE,
      email: 'ana@kaptia.app',
    });
  });

  it('restores what was saved last time', () => {
    const restored = comprobanteFromProfile({
      kind: 'factura',
      documentType: 'ruc',
      documentNumber: '20123456789',
      businessName: 'Ana Torres SAC',
      fiscalAddress: 'Av. Arequipa 123, Lima',
      email: 'facturas@kaptia.app',
    });
    expect(restored).toEqual(factura({ email: 'facturas@kaptia.app' }));
  });

  it('remembers the anonymous boleta without showing its placeholder number', () => {
    const restored = comprobanteFromProfile({
      kind: 'boleta',
      documentType: 'none',
      documentNumber: '00000000',
    });
    expect(restored.documentType).toBe('dni');
    expect(restored.documentNumber).toBe('');
  });

  it('repairs a stored factura that carries a DNI', () => {
    const restored = comprobanteFromProfile({
      kind: 'factura',
      documentType: 'dni',
      documentNumber: '12345678',
    });
    expect(restored.documentType).toBe('ruc');
  });
});

describe('where to send a wallet payment', () => {
  const details = {
    legalName: 'Kaptia Peru SAC',
    yape: '987654321',
    plin: null,
    bank: { name: 'BCP', account: '193-1234567-0-11', cci: '00219300123456701150', holder: null },
  };

  it('shows the Yape number and who receives it', () => {
    const target = paymentTarget(details, 'yape');
    expect(target.available).toBe(true);
    expect(target.rows).toEqual([
      { key: 'number', value: '987654321' },
      { key: 'holder', value: 'Kaptia Peru SAC' },
    ]);
  });

  it('says Plin is unavailable when only Yape is configured', () => {
    const target = paymentTarget(details, 'plin');
    expect(target.available).toBe(false);
    expect(target.rows).toEqual([]);
  });

  it('lists the bank fields that exist and skips the empty ones', () => {
    const target = paymentTarget(details, 'transfer');
    expect(target.available).toBe(true);
    expect(target.rows.map((row) => row.key)).toEqual(['bank', 'account', 'cci', 'holder']);
    expect(target.rows.find((row) => row.key === 'holder')?.value).toBe('Kaptia Peru SAC');
  });

  it('is unavailable when no account is configured at all', () => {
    const target = paymentTarget({ legalName: null, yape: null, bank: null }, 'transfer');
    expect(target.available).toBe(false);
    expect(target.rows).toEqual([{ key: 'holder', value: 'Kaptia' }]);
  });

  it('is unavailable when the instructions endpoint could not be read', () => {
    expect(paymentTarget(null, 'yape')).toEqual({ method: 'yape', available: false, rows: [] });
  });
});
