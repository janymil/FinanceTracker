/**
 * Paying in Peru, as rules and as rows — no React, no network.
 *
 * Four facts shape this file:
 *
 *  1. Peru has **two** documents: boleta and factura. A factura needs a RUC (11 digits), the
 *     razón social and a fiscal address that SUNAT will match, and it **cannot be re-issued to
 *     another RUC** afterwards. So the data is checked before the money moves.
 *  2. A boleta is one document, not three. The DNI and the name are **optional fields on it**:
 *     left empty, the boleta is printed to "clientes varios", which is what nearly every
 *     boleta in Peru carries. SUNAT only forces identification from S/ 700 per document
 *     (`boletaSinDatosAllowed`), and every plan here is far below that.
 *  3. A wallet payment (Yape, Plin, transfer) needs an account to send to. Asking for an
 *     operation number without ever showing the number to send to is not a payment flow.
 *  4. A wallet payment cannot renew itself: MercadoPago's subscriptions take cards, and
 *     Yape's approval token is single-use. One period is bought, and the customer is told so.
 */
export type ComprobanteKind = 'boleta' | 'factura';
/** `none` = a boleta to clientes varios: the buyer gives no name and no number. */
export type DocumentType = 'dni' | 'ruc' | 'none';
export type PeruWalletMethod = 'yape' | 'plin' | 'transfer';

/** The two cards the buyer picks from — the two documents SUNAT has. */
export type ComprobanteSelection = 'boleta' | 'factura';

export interface ComprobanteDraft {
  documentType: DocumentType;
  documentNumber: string;
  /**
   * The name printed on the document: razón social for a factura, full name for a boleta.
   * Stored in the existing `business_name` column, which is read by whoever types the
   * document into SUNAT.
   */
  documentName: string;
  fiscalAddress: string;
  email: string;
}

export const EMPTY_COMPROBANTE: ComprobanteDraft = {
  documentType: 'dni',
  documentNumber: '',
  documentName: '',
  fiscalAddress: '',
  email: '',
};

/**
 * A factura is identified by a RUC; every other document is a boleta.
 *
 * Derived from the type and never stored beside it: the server refuses a factura without a
 * RUC, and two fields that must agree eventually do not.
 */
/**
 * A factura is identified by a RUC; every other document is a boleta.
 *
 * Derived from the type and never stored beside it: the server refuses a factura without a
 * RUC, and two fields that must agree eventually do not.
 */
export function kindOf(draft: Pick<ComprobanteDraft, 'documentType'>): ComprobanteKind {
  return draft.documentType === 'ruc' ? 'factura' : 'boleta';
}

/** Which of the two cards this draft belongs to. */
export function selectionOf(draft: Pick<ComprobanteDraft, 'documentType'>): ComprobanteSelection {
  return draft.documentType === 'ruc' ? 'factura' : 'boleta';
}

/**
 * What the server stores, derived from what is actually in the form.
 *
 * A RUC is a factura. A complete DNI identifies the boleta. Anything else — no DNI, or a name
 * with no DNI — is the boleta to «clientes varios» that SUNAT expects (`00000000`). It is
 * derived here and nowhere else, so a number typed for one document can never be sent as the
 * other, and an empty box can never be sent as an identifier.
 */
export function documentTypeOf(draft: ComprobanteDraft): DocumentType {
  if (draft.documentType === 'ruc') return 'ruc';
  return /^\d{8}$/.test(digitsOnly(draft.documentNumber)) ? 'dni' : 'none';
}

/**
 * SUNAT's ceiling for a boleta issued without identifying the buyer: S/ 700 per document.
 *
 * Every plan this app sells is far below it (the dearest is S/ 199.90), but the rule is
 * encoded instead of assumed, so a future price change cannot silently produce a document
 * SUNAT will reject.
 */
export const BOLETA_SIN_DATOS_LIMIT_CENTS = 70_000;

export function boletaSinDatosAllowed(amountCents: number): boolean {
  return amountCents <= BOLETA_SIN_DATOS_LIMIT_CENTS;
}


/** Codes, not sentences: the component decides the language. */
export type ComprobanteIssueCode = 'dni' | 'ruc' | 'name' | 'address' | 'email' | 'limit';

export interface ComprobanteIssue {
  field: keyof ComprobanteDraft;
  code: ComprobanteIssueCode;
}

/** What the rules need to know beyond the draft itself. */
export interface ComprobanteRules {
  /** Soles in cents about to be charged. Omitted = do not check SUNAT's ceiling. */
  amountCents?: number;
}

/** Everything a person types into a document field is digits; spaces and dashes are noise. */
export function digitsOnly(value: string): string {
  return String(value ?? '').replace(/\D/g, '');
}

/**
 * What is still wrong with this document, in the order it appears on screen.
 *
 * Mirrors `profileSchema` in `server/billingProfileInput.ts` — the server stays the authority —
 * and adds the rule the server leaves optional: a half-typed e-mail must not be sent.
 *
 * A boleta asks for **nothing**: no DNI, no name. That is the normal case in Peru, not an
 * edge case. The two things that do stop a boleta are a half-typed DNI (it would be printed as
 * an identifier) and an amount above SUNAT's S/ 700 ceiling, where identification is required.
 */
export function comprobanteIssues(
  draft: ComprobanteDraft,
  rules: ComprobanteRules = {},
): ComprobanteIssue[] {
  const issues: ComprobanteIssue[] = [];
  const number = digitsOnly(draft.documentNumber);

  if (draft.documentType === 'ruc') {
    if (!/^\d{11}$/.test(number)) issues.push({ field: 'documentNumber', code: 'ruc' });
    if (!draft.documentName.trim()) issues.push({ field: 'documentName', code: 'name' });
    if (!draft.fiscalAddress.trim()) issues.push({ field: 'fiscalAddress', code: 'address' });
  } else {
    // Optional, but not free-form: four digits are not a DNI and would be printed as one.
    if (number && !/^\d{8}$/.test(number)) issues.push({ field: 'documentNumber', code: 'dni' });
    // Above SUNAT's ceiling a boleta without identification is not a valid document.
    if (!number && rules.amountCents !== undefined && !boletaSinDatosAllowed(rules.amountCents)) {
      issues.push({ field: 'documentNumber', code: 'limit' });
    }
  }

  const email = draft.email.trim();
  // Empty is allowed: the account e-mail is already on file. A typo is not.
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    issues.push({ field: 'email', code: 'email' });
  }

  return issues;
}

export function isComprobanteComplete(draft: ComprobanteDraft, rules: ComprobanteRules = {}): boolean {
  return comprobanteIssues(draft, rules).length === 0;
}

/**
 * Switching the card switches the document with it.
 *
 * A number typed for another kind of document is not a number for this one: an 8-digit DNI
 * left in a RUC box is exactly how a factura ends up issued against the wrong taxpayer. Going
 * back to a boleta also drops the razón social and the address, because a company name on a
 * boleta is a document the buyer cannot deduct and the operator cannot use. A name typed on
 * the boleta itself stays: it is theirs and it is optional.
 */
export function withComprobanteSelection(
  draft: ComprobanteDraft,
  selection: ComprobanteSelection,
): ComprobanteDraft {
  const documentType: DocumentType = selection === 'factura' ? 'ruc' : 'dni';

  // A draft read from an older stored profile still says `none`: that is the boleta form with
  // empty boxes, and clicking "boleta" must not wipe what was just prefilled.
  if (documentType === draft.documentType || (documentType === 'dni' && draft.documentType === 'none')) {
    return draft;
  }

  return {
    ...draft,
    documentType,
    documentNumber: '',
    documentName: documentType === 'dni' ? '' : draft.documentName,
    fiscalAddress: documentType === 'ruc' ? draft.fiscalAddress : '',
  };
}



/** The stored profile, as far as this module cares about it. */
export interface BillingProfileLike {
  kind?: string | null;
  documentType?: string | null;
  documentNumber?: string | null;
  businessName?: string | null;
  fiscalAddress?: string | null;
  email?: string | null;
}

/**
 * SUNAT catalog 06, type 0 ("doc. trib. no dom. sin RUC"): the number a boleta to «clientes
 * varios» carries. Stored, never shown to the buyer and never sent back as if it were a DNI.
 */
export const SIN_DATOS_DOCUMENT_NUMBER = '00000000';

/**
 * Opening the dialog a second time must not ask for data the account already gave.
 *
 * A stored RUC means a factura (also when the stored kind says `boleta`, because a RUC is what
 * identifies a factura and the number is the fact that cannot be retyped). Everything else is
 * the boleta form. The stored `00000000` placeholder is not an identifier: it opens the boleta
 * with both optional boxes empty.
 */
export function comprobanteFromProfile(
  profile: BillingProfileLike | null | undefined,
  fallbackEmail = '',
): ComprobanteDraft {
  if (!profile) return { ...EMPTY_COMPROBANTE, email: fallbackEmail };

  const documentType: DocumentType =
    profile.documentType === 'ruc' || profile.kind === 'factura' ? 'ruc' : 'dni';

  const storedNumber = digitsOnly(profile.documentNumber ?? '');
  const identified = documentType === 'ruc' || storedNumber !== SIN_DATOS_DOCUMENT_NUMBER;

  return {
    documentType,
    documentNumber: identified ? storedNumber : '',
    documentName: String(profile.businessName ?? ''),
    fiscalAddress: String(profile.fiscalAddress ?? ''),
    email: String(profile.email ?? '') || fallbackEmail,
  };
}


/** What the server answers at `/api/payments/manual/instructions`. */
export interface PeruPaymentDetails {
  legalName?: string | null;
  yape?: string | null;
  plin?: string | null;
  bank?: {
    name?: string | null;
    account?: string | null;
    cci?: string | null;
    holder?: string | null;
  } | null;
}

export type PaymentTargetRowKey = 'holder' | 'number' | 'bank' | 'account' | 'cci';

export interface PaymentTargetRow {
  key: PaymentTargetRowKey;
  value: string;
}

export interface PaymentTarget {
  method: PeruWalletMethod;
  /** False when the account for this method is not configured on the server. */
  available: boolean;
  rows: PaymentTargetRow[];
}

/**
 * What to show under "send the money here".
 *
 * `available` is deliberately about the *number*, not about the holder name: without a number
 * there is nothing to pay into, and pretending otherwise would produce a claim nobody can
 * match against a deposit. Empty rows are dropped instead of printed as "null".
 */
export function paymentTarget(
  details: PeruPaymentDetails | null | undefined,
  method: PeruWalletMethod,
): PaymentTarget {
  const clean = (value: string | null | undefined) => String(value ?? '').trim();
  const holder = clean(details?.legalName) || 'Kaptia';

  if (!details) return { method, available: false, rows: [] };

  if (method === 'yape' || method === 'plin') {
    const number = clean(method === 'yape' ? details.yape : details.plin);
    if (!number) return { method, available: false, rows: [] };
    return {
      method,
      available: true,
      rows: [
        { key: 'number', value: number },
        { key: 'holder', value: holder },
      ],
    };
  }

  const bank = details.bank ?? {};
  const rows: PaymentTargetRow[] = [];
  if (clean(bank.name)) rows.push({ key: 'bank', value: clean(bank.name) });
  if (clean(bank.account)) rows.push({ key: 'account', value: clean(bank.account) });
  if (clean(bank.cci)) rows.push({ key: 'cci', value: clean(bank.cci) });
  rows.push({ key: 'holder', value: clean(bank.holder) || holder });

  return { method, available: Boolean(clean(bank.account) || clean(bank.cci)), rows };
}
