# Peru checkout: one dialog after "Suscribirse", with the account and the comprobante

Date: 2026-10-29 · Owner instruction: "analyze libro de reclamaciones and apply the same to
kaptia" (its Yape/Plin/transfer + boleta/factura flow opens as a popup after the subscribe
button, not as a form under the price cards).

## Goal

1. Clicking a plan on `/subscribe` opens a popup that carries the plan and period that was
   clicked — no second "which plan?" select, no scrolling below the cards.
2. The popup offers the two ways Peru actually pays: card through MercadoPago (auto-renew)
   and Yape / Plin / bank transfer (one period, no auto-renew).
3. The wallet path shows **where** to send the money (number, account, CCI, holder, exact
   amount) from `/api/payments/manual/instructions`, then records the operation number. Today
   the form asks for an operation number while never showing an account.
4. The boleta/factura block is a real one: boleta or factura chosen first, DNI 8 / RUC 11,
   name on the document, fiscal address for a factura, e-mail, and it is saved **before** the
   payment starts, because a document cannot be re-issued to another RUC.
5. The wallet form disappears from the bottom of the page; the payment attempt of a customer
   who already paid a period opens the same dialog instead of scrolling to it.

## Out of scope

- Automatic SUNAT emission and the IGV breakdown (no tax module exists here; adding one is a
  pricing decision, not a layout one).
- RUC lookup against SUNAT (needs an external service and its credentials).
- Stripe: its hosted page already collects the card, so the dialog is only for the
  MercadoPago / soles path.
- Database changes. The name on a boleta is stored in the existing `business_name` column,
  which already means "the name printed on the document".

## Files

- `shared/peruCheckout.ts` (new): comprobante draft + validation, profile prefill, and the
  rows that describe the destination account. Pure, so it can be tested.
- `client/src/components/checkout/ComprobanteFields.tsx` (new): the document block.
- `client/src/components/checkout/PeruCheckoutDialog.tsx` (new): the popup.
- `client/src/pages/subscribe.tsx`: remove `PeruPayments`, open the dialog.
- `client/public/locales/{en-us,es-pe,sk-sk}/translation.json`: new keys under
  `subscribe.peru`.
- `tests/unit/peruCheckout.test.ts` (new), `tests/e2e/subscribe.spec.ts` (one new case).

## The risk

- A payment that used to be reachable now needs one more click. If the dialog fails to open,
  a Peruvian customer cannot pay by wallet at all — the e2e case pins the open → claim path.
- Requiring a valid comprobante blocks payment until the data is right. That is the point
  (the alternative is a document that cannot be corrected), but a bug in the validation
  blocks sales, so the rules are plain and unit-tested.
- Saving the tax profile before a card payment now happens on a path where it did not
  before; if `PUT /api/billing-profile` fails the payment stops with a message instead of
  buying access with no document.

## Revision — 2026-10-29, after the owner's question

Requiring a DNI for every boleta was **stricter than Peruvian law**: SUNAT accepts a boleta to
"clientes varios" with no name and no number (ceiling S/ 700 per document, and every plan is
below it). The block now offers three cards — boleta with DNI, boleta without details, factura —
and the third one asks for nothing. The server accepts `documentType: 'none'` and stores
SUNAT's `00000000` placeholder (`server/billingProfileInput.ts`), so the operator still gets a
row for a document that must be issued.

## How it is proven

- `tests/unit/peruCheckout.test.ts`: DNI/RUC/name/address rules, kind switching, profile
  prefill, destination rows including the "not configured" case.
- `tests/e2e/subscribe.spec.ts`: with the region stubbed to MercadoPago, clicking a plan
  opens the dialog, the Yape number is shown, and confirming posts plan + interval + method
  + operation number to `/api/payments/manual`.
- `./verify.sh` green in this session.
