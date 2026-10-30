import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';
import {
  digitsOnly,
  selectionOf,
  withComprobanteSelection,
  type ComprobanteDraft,
  type ComprobanteIssue,
  type ComprobanteSelection,
} from '@shared/peruCheckout';

/**
 * The boleta / factura block, taken BEFORE the money moves.
 *
 * Two cards, because Peru has two documents — and inside the boleta the DNI and the name are
 * **optional fields that say so**. Left empty, the boleta is printed to «clientes varios»,
 * which is what a boleta normally looks like; SUNAT only forces identification from S/ 700 per
 * document, and that is the one case where the DNI turns required (`dniRequired`).
 *
 * The factura keeps every field required: it cannot be re-issued to another RUC afterwards.
 */
const SELECTIONS: readonly ComprobanteSelection[] = ['boleta', 'factura'];

export function ComprobanteFields({
  value,
  onChange,
  issues,
  showIssues,
  dniRequired,
}: {
  value: ComprobanteDraft;
  onChange: (next: ComprobanteDraft) => void;
  issues: ComprobanteIssue[];
  /** Errors appear only after the first attempt, so the form is not red before it is used. */
  showIssues: boolean;
  /** True only when the amount is above SUNAT's ceiling and a boleta must identify the buyer. */
  dniRequired: boolean;
}) {
  const { t } = useTranslation();
  const current = selectionOf(value);
  const isFactura = current === 'factura';

  const numberLabel = isFactura
    ? 'RUC'
    : dniRequired
      ? t('subscribe.peru.doc_dni_required', 'DNI (obligatorio para este monto)')
      : t('subscribe.peru.doc_dni_optional', 'DNI (opcional)');

  const nameLabel = isFactura
    ? t('subscribe.peru.doc_name_factura', 'Razón social')
    : t('subscribe.peru.doc_name_optional', 'Nombre completo (opcional)');

  return (
    <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800" data-testid="comprobante-fields">
      <p className="text-sm font-semibold">{t('subscribe.peru.tax_title', 'Tu boleta o factura')}</p>
      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
        {t(
          'subscribe.peru.tax_hint',
          'Elige factura si necesitas sustentar el gasto con RUC; boleta si pagas como persona.',
        )}
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {SELECTIONS.map((selection) => {
          const selected = current === selection;
          return (
            <button
              key={selection}
              type="button"
              aria-pressed={selected}
              data-testid={`comprobante-kind-${selection}`}
              onClick={() => onChange(withComprobanteSelection(value, selection))}
              className={[
                'rounded-lg border p-3 text-left text-sm transition-colors',
                selected
                  ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200 dark:bg-emerald-900/20'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800/40',
              ].join(' ')}
            >
              <span className="font-medium">{t(`subscribe.peru.${selection}`, selection)}</span>
              <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                {t(`subscribe.peru.${selection}_hint`, '')}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          {numberLabel}
          <Input
            className="mt-1"
            inputMode="numeric"
            aria-label={isFactura ? 'RUC' : 'DNI'}
            maxLength={isFactura ? 11 : 8}
            value={value.documentNumber}
            data-testid="comprobante-number"
            placeholder={isFactura ? '20123456789' : '12345678'}
            onChange={(event) => onChange({ ...value, documentNumber: digitsOnly(event.target.value) })}
          />
        </label>

        <label className="text-sm">
          {nameLabel}
          <Input
            className="mt-1"
            maxLength={160}
            value={value.documentName}
            data-testid="comprobante-name"
            onChange={(event) => onChange({ ...value, documentName: event.target.value })}
          />
        </label>

        {isFactura && (
          <label className="text-sm sm:col-span-2">
            {t('subscribe.peru.fiscal_address', 'Domicilio fiscal')}
            <Input
              className="mt-1"
              maxLength={240}
              value={value.fiscalAddress}
              data-testid="comprobante-address"
              onChange={(event) => onChange({ ...value, fiscalAddress: event.target.value })}
            />
          </label>
        )}
      </div>

      <label className="mt-3 block text-sm">
        {t('subscribe.peru.doc_email', 'Correo para el comprobante')}
        <Input
          className="mt-1"
          type="email"
          maxLength={160}
          value={value.email}
          data-testid="comprobante-email"
          placeholder="tu@correo.com"
          onChange={(event) => onChange({ ...value, email: event.target.value })}
        />
        <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
          {t('subscribe.peru.doc_email_hint', 'Aquí te enviamos la boleta o la factura.')}
        </span>
      </label>

      {showIssues && issues.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-red-600" role="alert" data-testid="comprobante-errors">
          {issues.map((issue) => (
            <li key={`${issue.field}-${issue.code}`}>
              {t(`subscribe.peru.err_${issue.code}`, issue.code)}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400" data-testid="comprobante-note">
        {isFactura
          ? t(
              'subscribe.peru.tax_note',
              'Tu factura se emite en SUNAT y se envía a tu correo. Revisa tus datos: una factura con RUC equivocado no se puede corregir.',
            )
          : dniRequired
            ? t(
                'subscribe.peru.boleta_note_required',
                'Desde S/ 700 SUNAT pide el DNI en la boleta, así que este monto lo necesita.',
              )
            : t(
                'subscribe.peru.boleta_note',
                'Si dejas el DNI y el nombre en blanco, la boleta sale a «clientes varios» y no sirve para sustentar gastos.',
              )}
      </p>
    </div>
  );
}
