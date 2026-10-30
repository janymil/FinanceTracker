import { useEffect, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, CreditCard, Landmark, Smartphone } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ComprobanteFields } from '@/components/checkout/ComprobanteFields';
import { trackEvent } from '@/lib/analytics';
import { amountFor, formatMoney, type BillingInterval, type PlanId } from '@shared/pricing';
import {
  EMPTY_COMPROBANTE,
  boletaSinDatosAllowed,
  comprobanteFromProfile,
  comprobanteIssues,
  documentTypeOf,
  isComprobanteComplete,
  kindOf,
  paymentTarget,
  type BillingProfileLike,
  type ComprobanteDraft,
  type PeruPaymentDetails,
  type PeruWalletMethod,
} from '@shared/peruCheckout';

/**
 * The Peru checkout, as a popup after "Suscribirse".
 *
 * It replaces a form that sat *below* the price cards: the visitor had to scroll past the
 * plans to find the only payment method that needed explaining, re-answer "which plan?" in a
 * select, and type an operation number without ever being shown an account to pay into.
 *
 * Both routes to a paid period live here, next to the document:
 *   * card, through MercadoPago — a preapproval that renews by itself;
 *   * Yape, Plin or a bank transfer — the account to send to, then a claim a person confirms.
 *
 * The comprobante is asked first and saved before either one starts, because a factura cannot
 * be re-issued to another RUC.
 */

type PayMethod = 'card' | PeruWalletMethod;

const WALLET_METHODS: readonly PeruWalletMethod[] = ['yape', 'plin', 'transfer'];

/** Clerk token plus the language the server uses in its e-mails. */
async function authHeaders(lang: string): Promise<Record<string, string>> {
  const token = await window.Clerk?.session?.getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    'x-user-language': lang,
  };
}

/**
 * A request with a deadline.
 *
 * The dialog refuses to close while it is busy, which is right — closing on top of a payment
 * in flight would hide its outcome. But that also means a request the server never answers
 * would leave the button disabled and the popup unclosable. Twenty-five seconds, then the
 * ordinary error path runs and the customer can try again or close.
 */
async function boundedFetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export interface PeruCheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: PlanId;
  interval: BillingInterval;
  lang: string;
  /** The account e-mail, used when the saved profile has none. */
  accountEmail: string;
  /** True when this account already paid a whole period by wallet: the note says so. */
  alreadyPaidPeriod: boolean;
}

export function PeruCheckoutDialog({
  open,
  onOpenChange,
  plan,
  interval,
  lang,
  accountEmail,
  alreadyPaidPeriod,
}: PeruCheckoutDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [method, setMethod] = useState<PayMethod>('card');
  const [draft, setDraft] = useState<ComprobanteDraft>({ ...EMPTY_COMPROBANTE });
  const [draftTouched, setDraftTouched] = useState(false);
  const [showIssues, setShowIssues] = useState(false);
  const [operationNumber, setOperationNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ reference: string; message: string } | null>(null);

  const profileQuery = useQuery<{ profile: BillingProfileLike | null }>({
    queryKey: ['/api/billing-profile'],
    queryFn: async () => {
      const response = await fetch('/api/billing-profile', { headers: await authHeaders(lang) });
      if (!response.ok) throw new Error('billing profile unavailable');
      return response.json();
    },
    enabled: open,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const instructionsQuery = useQuery<PeruPaymentDetails>({
    queryKey: ['/api/payments/manual/instructions'],
    queryFn: async () => {
      const response = await fetch('/api/payments/manual/instructions', {
        headers: await authHeaders(lang),
      });
      if (!response.ok) throw new Error('payment instructions unavailable');
      return response.json();
    },
    enabled: open,
    // The account number changes when the company does, not between two clicks.
    staleTime: 10 * 60_000,
    retry: false,
  });

  // A new opening must not show the previous attempt.
  useEffect(() => {
    if (!open) return;
    setMethod('card');
    setDraft({ ...EMPTY_COMPROBANTE, email: accountEmail });
    setDraftTouched(false);
    setShowIssues(false);
    setOperationNumber('');
    setBusy(false);
    setError(null);
    setSent(null);
  }, [open, accountEmail]);

  // Prefill from the saved profile, unless the customer already started typing.
  useEffect(() => {
    if (!open || draftTouched || profileQuery.isLoading) return;
    setDraft(comprobanteFromProfile(profileQuery.data?.profile ?? null, accountEmail));
  }, [open, draftTouched, profileQuery.isLoading, profileQuery.data, accountEmail]);

  const amountCents = Math.round(amountFor(plan, interval, 'pen') * 100);
  const price = formatMoney(amountCents / 100, 'pen');
  const planName = t(plan === 'standard' ? 'plans.standard' : 'plans.premium');
  const periodLabel = t(
    interval === 'yearly' ? 'subscribe.billing.yearly' : 'subscribe.billing.monthly',
  );

  const issues = comprobanteIssues(draft, { amountCents });
  const walletMethod: PeruWalletMethod | null = method === 'card' ? null : method;
  const target = walletMethod ? paymentTarget(instructionsQuery.data, walletMethod) : null;


  /**
   * The document is saved before the payment starts on both paths. Without a stored profile
   * the server queues no document at all (`recordBillingDocument` returns null), which is how
   * a card customer could pay and never receive a factura.
   */
  const saveProfile = async (headers: Record<string, string>): Promise<boolean> => {
    const response = await boundedFetch('/api/billing-profile', {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        kind: kindOf(draft),
        // Derived from what is in the form: a RUC, a complete DNI, or nothing at all.
        documentType: documentTypeOf(draft),
        // A boleta to clientes varios has no number: the server stores SUNAT's placeholder.
        documentNumber: draft.documentNumber.trim() || undefined,
        businessName: draft.documentName.trim() || undefined,
        fiscalAddress: draft.documentType === 'ruc' ? draft.fiscalAddress.trim() || undefined : undefined,
        email: draft.email.trim() || undefined,
      }),
    });
    if (response.ok) {
      // Keep the prefill honest: without this, reopening the dialog would restore the data
      // from before the customer corrected it.
      const saved = await response.json().catch(() => null);
      if (saved?.profile) {
        queryClient.setQueryData(['/api/billing-profile'], { profile: saved.profile });
      }
      return true;
    }
    const data = await response.json().catch(() => ({}));
    setError(data?.error || t('subscribe.peru.tax_error', 'Revisa los datos del comprobante.'));
    return false;
  };

  const startCard = async () => {
    if (!isComprobanteComplete(draft, { amountCents })) {
      setShowIssues(true);
      setError(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const headers = await authHeaders(lang);
      if (!(await saveProfile(headers))) return;

      trackEvent('begin_checkout', 'subscription', `${plan}-${interval}-mercadopago`);
      const response = await boundedFetch('/api/mercadopago/subscribe', {
        method: 'POST',
        headers,
        body: JSON.stringify({ plan, interval }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data?.init_point) {
        window.location.href = data.init_point;
        return;
      }
      setError(data?.error || t('subscribe.payment_error', 'No pudimos iniciar el pago.'));
    } catch {
      setError(t('subscribe.payment_error', 'No pudimos iniciar el pago.'));
    } finally {
      setBusy(false);
    }
  };

  const submitWallet = async () => {
    if (!walletMethod) return;
    if (!isComprobanteComplete(draft, { amountCents })) {
      setShowIssues(true);
      setError(null);
      return;
    }
    const operation = operationNumber.trim();
    if (operation.length < 3) {
      setError(t('subscribe.peru.err_operation', 'Escribe el número de operación que te dio la app.'));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const headers = await authHeaders(lang);
      if (!(await saveProfile(headers))) return;

      const response = await boundedFetch('/api/payments/manual', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          plan,
          interval,
          method: walletMethod,
          operationNumber: operation,
          payerName: draft.documentName.trim() || undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data?.error || t('subscribe.payment_error', 'No pudimos registrar el pago.'));
        return;
      }
      trackEvent('purchase', 'subscription', `${plan}-${interval}-${walletMethod}`);
      setSent({
        reference: operation,
        message: t(
          'subscribe.peru.sent',
          'Recibimos los datos de tu pago. Activamos el plan cuando lo confirmemos, normalmente en un día hábil.',
        ),
      });
      setOperationNumber('');
    } catch {
      setError(t('subscribe.payment_error', 'No pudimos registrar el pago.'));
    } finally {
      setBusy(false);
    }
  };

  /** One selectable way to pay, with the promise it makes and the one it does not. */
  const methodOption = (
    id: PayMethod,
    label: string,
    hint: string,
    icon: ReactNode,
    disabled = false,
  ) => {
    const selected = method === id;
    return (
      <button
        key={id}
        type="button"
        aria-pressed={selected}
        disabled={disabled}
        data-testid={`peru-method-${id}`}
        onClick={() => {
          setMethod(id);
          setError(null);
        }}
        className={[
          'flex items-start gap-3 rounded-lg border p-3 text-left text-sm transition-colors',
          selected
            ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200 dark:bg-emerald-900/20'
            : 'hover:bg-gray-50 dark:hover:bg-gray-800/40',
          disabled ? 'cursor-not-allowed opacity-60' : '',
        ].join(' ')}
      >
        <span className="mt-0.5 text-gray-600 dark:text-gray-300">{icon}</span>
        <span>
          <span className="font-medium">{label}</span>
          <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{hint}</span>
        </span>
      </button>
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
    >
      <DialogContent
        className="max-h-[90vh] max-w-2xl overflow-y-auto"
        data-testid="peru-checkout-dialog"
      >
        <DialogHeader>
          <DialogTitle>
            {t('subscribe.peru.dialog_title', 'Pagar {{plan}}', { plan: planName })}
          </DialogTitle>
          <DialogDescription>
            {periodLabel} · {price}
            {method === 'card'
              ? ` · ${t('subscribe.peru.card_description', 'cobro automático, puedes cancelar cuando quieras')}`
              : ` · ${t('subscribe.peru.wallet_description', 'un periodo, sin renovación automática')}`}
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4">
              <p className="flex items-center gap-2 font-medium text-emerald-900">
                <CheckCircle2 className="h-5 w-5" />
                {t('subscribe.peru.sent_title', 'Pago registrado')}
              </p>
              <p className="mt-1 text-sm text-emerald-900">{sent.message}</p>
              <p className="mt-2 text-sm text-emerald-900">
                {t('subscribe.peru.sent_reference', 'Tu número de operación: {{reference}}', {
                  reference: sent.reference,
                })}
              </p>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {t(
                'subscribe.peru.sent_no_renew',
                'Este pago no se renueva automáticamente: te avisamos antes de que termine.',
              )}
            </p>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)} data-testid="peru-checkout-close">
                {t('subscribe.peru.close', 'Cerrar')}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            {alreadyPaidPeriod && (
              <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                {t(
                  'subscribe.change_wallet',
                  'Tu plan se pagó por un periodo. Este pago compra otro periodo.',
                )}
              </p>
            )}

            <div>
              <p className="text-sm font-semibold">
                {t('subscribe.peru.choose_method', '¿Cómo quieres pagar?')}
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {methodOption(
                  'card',
                  t('subscribe.peru.card', 'Tarjeta'),
                  t('subscribe.peru.card_hint', 'Cobro automático: se renueva cada periodo.'),
                  <CreditCard className="h-4 w-4" />,
                )}
                {WALLET_METHODS.map((id) =>
                  methodOption(
                    id,
                    t(`subscribe.peru.${id}`, id === 'transfer' ? 'Transferencia' : id),
                    t(`subscribe.peru.${id}_hint`, ''),
                    id === 'transfer' ? (
                      <Landmark className="h-4 w-4" />
                    ) : (
                      <Smartphone className="h-4 w-4" />
                    ),
                  ),
                )}
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {t(
                  'subscribe.peru.wallet_note',
                  'Yape, Plin y transferencia compran un periodo: no se renuevan automáticamente.',
                )}
              </p>
            </div>

            {target && (
              <div
                className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20"
                data-testid="peru-destination"
              >
                <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                  {t('subscribe.peru.send_exact', 'Envía exactamente {{amount}} a:', { amount: price })}
                </p>

                {instructionsQuery.isLoading ? (
                  <p className="mt-2 text-sm text-emerald-800 dark:text-emerald-300" data-testid="peru-destination-loading">
                    {t('subscribe.peru.loading_details', 'Cargando la cuenta de abono…')}
                  </p>
                ) : target.available ? (
                  <dl className="mt-2 space-y-1 text-sm">
                    {target.rows.map((row) => (
                      <div key={row.key} className="flex justify-between gap-4">
                        <dt className="text-emerald-800 dark:text-emerald-300">
                          {t(`subscribe.peru.${row.key}`, row.key)}
                        </dt>
                        <dd className="font-mono font-semibold text-emerald-950 dark:text-emerald-100">
                          {row.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="mt-2 flex items-start gap-2 text-sm text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    {t(
                      'subscribe.peru.missing_details',
                      'Todavía no podemos mostrarte la cuenta de abono. Escríbenos a info@kaptia.app y te la enviamos, o paga con tarjeta.',
                    )}
                  </p>
                )}

                <label className="mt-4 block text-sm font-medium text-emerald-900 dark:text-emerald-200">
                  {t('subscribe.peru.operation', 'Número de operación')}
                  <Input
                    className="mt-1 bg-white"
                    required
                    maxLength={64}
                    value={operationNumber}
                    data-testid="peru-operation-number"
                    placeholder={t('subscribe.peru.operation_hint', 'El código que te dio tu app')}
                    onChange={(event) => setOperationNumber(event.target.value)}
                  />
                </label>
                <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-300">
                  {t(
                    'subscribe.peru.operation_help',
                    'Primero paga, luego copia aquí el número que te dio la app.',
                  )}
                </p>
              </div>
            )}

            {method === 'card' && (
              <p className="rounded-lg border border-gray-200 p-3 text-sm text-gray-600 dark:border-gray-800 dark:text-gray-300">
                {t(
                  'subscribe.peru.card_note',
                  'Te llevamos a MercadoPago para autorizar el cobro automático. El plan se activa cuando el pago queda confirmado.',
                )}
              </p>
            )}

            <ComprobanteFields
              value={draft}
              issues={issues}
              showIssues={showIssues}
              dniRequired={!boletaSinDatosAllowed(amountCents)}
              onChange={(next) => {
                setDraft(next);
                setDraftTouched(true);
              }}
            />

            {error && (
              <p className="text-sm text-red-600" role="alert" data-testid="peru-checkout-error">
                {error}
              </p>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                {t('subscribe.peru.close', 'Cerrar')}
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                disabled={busy}
                data-testid="peru-checkout-submit"
                onClick={() => void (walletMethod ? submitWallet() : startCard())}
              >
                {busy
                  ? t('subscribe.processing')
                  : walletMethod
                    ? t('subscribe.peru.confirm_paid', 'Ya pagué — confirmar')
                    : t('subscribe.peru.subscribe_card', 'Suscribirme · {{price}}', { price })}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
