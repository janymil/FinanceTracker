# 2026-10-30 — One boleta with optional DNI and name, instead of three cards

## Goal

Ask for **boleta or factura** only, and show the DNI and the name as optional fields on the
boleta, because "boleta sin datos" is not a third document: it is the same boleta printed for
«clientes varios».

## Out of scope

- No change to SUNAT's S/ 700 ceiling: it stays as the rule that turns the DNI from optional
  into required (`boletaSinDatosAllowed`).
- No database change: the stored shapes stay `dni` / `ruc` / `none` plus the name.
- No change to the wallet, transfer or card flows.
- The AI-consent copy is a separate change in the same sitting (its own file, its own test).

## Files that will change

- `shared/peruCheckout.ts` — two selections, `documentTypeOf()` derives what the server stores,
  the identifier rules move from "type" to "what was typed".
- `client/src/components/checkout/ComprobanteFields.tsx` — two cards, optional fields labelled.
- `client/src/components/checkout/PeruCheckoutDialog.tsx` — sends the derived document type.
- `server/billingProfileInput.ts` — a boleta keeps the name the buyer typed; still drops the
  fiscal address, which a boleta does not have.
- `client/public/locales/{es-pe,en-us,sk-sk}/translation.json` — the new copy; old keys removed
  from all three so locale parity holds.
- `tests/unit/peruCheckout.test.ts`, `tests/unit/billingProfileInput.test.ts`,
  `tests/e2e/subscribe.spec.ts` — the three-card cases become the two documents.

## The risk

A wrong derivation sends `documentType: 'dni'` with no number (an old server answers
"Invalid billing data" and the sale stops), or prints a razón social on a boleta. Noticed at
checkout, by the customer, immediately — and by the operator when typing the document into
SUNAT, a day later.

## How it is proven

- Test: `tests/unit/peruCheckout.test.ts` — a boleta with nothing typed is complete and derives
  `none`; with an 8-digit DNI derives `dni`; a half-typed DNI is refused; above S/ 700 the DNI
  is required. `tests/unit/billingProfileInput.test.ts` — a boleta stores the name it was given.
- Gate: `./verify.sh`

## Steps

1. `shared/peruCheckout.ts`: two selections, `documentTypeOf`, new issue rules.
2. `ComprobanteFields.tsx` + `PeruCheckoutDialog.tsx`.
3. `server/billingProfileInput.ts` + its test.
4. Locales ×3.
5. Unit tests, then the gate.

## Review — filled in after building, by the reviewer pass

- [x] Q1 · plain sentence a non-developer can read: At checkout the customer now chooses only
      boleta or factura, and on the boleta the DNI and the name say they are optional, so nobody
      has to look for a third option called "sin datos".
- [x] Q2 · the test that fails without this change: `tests/unit/peruCheckout.test.ts` —
      "is complete with both boxes empty: the boleta to «clientes varios»" (before: `selectionOf`
      had no `boleta`, and a boleta without a name was refused), and
      `tests/unit/billingProfileInput.test.ts` — "keeps the name typed on the boleta and drops
      the fiscal address".
- [x] Q3 · `./verify.sh` — `VERIFY OK — 4 step(s) in 127s: checks tests graph build`.
- [x] Q4 · the risk, named: if `documentTypeOf` derived the wrong shape, the sale stops at
      checkout with the server's "Invalid billing data" (customer notices immediately); if a
      razón social leaked onto a boleta, the operator notices a day later when typing it into
      SUNAT. The second is why switching back to a boleta now clears the name and the address.
- [x] Q5 · the reviewer read the diff (who, when): the same session, after the gate, re-reading
      the diff as a reviewer — no second person was available tonight; this is the honest gap.
- [x] `lessons.md` updated — yes: the "Invalid billing data" report was a stale process, not a
      validator bug, and checking `ps -o lstart` against the build's mtime is the one command
      that proves it.
