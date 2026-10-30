import { z } from 'zod';
import { SIN_DATOS_DOCUMENT_NUMBER } from '../shared/peruCheckout';

/**
 * The buyer's document data, validated the way SUNAT reads it.
 *
 * Peru has two documents, and only one of them needs to be complete:
 *
 *  * a **boleta** — a DNI (8 digits) and a name are *optional* fields. Left empty, the document
 *    is the boleta to «clientes varios» that most boletas in Peru are: no name, no number, and
 *    SUNAT accepts it with the `00000000` placeholder of catalog 06 type 0, up to S/ 700;
 *  * a **factura**, which needs a RUC (11 digits), the razón social and the fiscal address,
 *    because it cannot be re-issued to another RUC once issued.
 *
 * Kept out of the route file so the rules can be tested without a database.
 */

/** Re-exported so callers and tests keep one import for the rule and its placeholder. */
export { SIN_DATOS_DOCUMENT_NUMBER };

export const profileSchema = z
  .object({
    kind: z.enum(['boleta', 'factura']),
    documentType: z.enum(['dni', 'ruc', 'none']),
    /** Required for a DNI or a RUC; ignored for `none`, where the placeholder is stored. */
    documentNumber: z.string().trim().max(24).optional().or(z.literal('')),
    businessName: z.string().trim().max(160).optional().or(z.literal('')),
    fiscalAddress: z.string().trim().max(240).optional().or(z.literal('')),
    email: z.string().trim().max(160).email().optional().or(z.literal('')),
  })
  .refine((data) => data.documentType !== 'dni' || /^\d{8}$/.test(data.documentNumber ?? ''), {
    path: ['documentNumber'],
    message: 'A DNI is eight digits',
  })
  .refine((data) => data.documentType !== 'ruc' || /^\d{11}$/.test(data.documentNumber ?? ''), {
    path: ['documentNumber'],
    message: 'A RUC is eleven digits',
  })
  .refine((data) => data.kind !== 'factura' || data.documentType === 'ruc', {
    path: ['documentType'],
    message: 'A factura needs a RUC',
  })
  .refine((data) => data.documentType !== 'none' || data.kind === 'boleta', {
    path: ['kind'],
    message: 'Only a boleta can be issued without a document number',
  })
  .refine((data) => data.kind !== 'factura' || Boolean(data.businessName), {
    path: ['businessName'],
    message: 'A factura needs the razón social',
  })
  .refine((data) => data.kind !== 'factura' || Boolean(data.fiscalAddress), {
    path: ['fiscalAddress'],
    message: 'A factura needs the fiscal address',
  });

export type ProfileInput = z.infer<typeof profileSchema>;

/**
 * What goes into the row.
 *
 * `none` stores SUNAT's placeholder and drops the fiscal address, which a boleta does not
 * have. The **name is kept**: on the boleta form it is an optional box the buyer fills on
 * purpose, and dropping what someone deliberately typed is how a customer ends up asking why
 * their boleta says "clientes varios" when they wrote their name.
 */
export function profileValues(data: ProfileInput) {
  const anonymous = data.documentType === 'none';
  return {
    kind: data.kind,
    documentType: data.documentType,
    documentNumber: anonymous ? SIN_DATOS_DOCUMENT_NUMBER : String(data.documentNumber ?? ''),
    businessName: data.businessName || null,
    fiscalAddress: data.kind === 'factura' ? data.fiscalAddress || null : null,
    email: data.email || null,
  };
}
