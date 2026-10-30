# Peru compliance — what exists, what is missing, who does what

This folder holds the paperwork the Peruvian data-protection regime asks for (Ley 29733 and
its regulation D.S. 016-2024-JUS), plus the consumer-law items from Ley 29571. It is a working
folder, not legal advice: the security document, the transfer assessment and the consumer
clauses have to be signed off by a Peruvian lawyer or an external *oficial de datos* (ODP)
before anything is filed.

## Already done, in the product

| Obligation | Where it lives | State |
|---|---|---|
| Account export in a portable format | `client/src/pages/*` export, `server/userExport.ts` | ✅ portability is real, not promised |
| Account and data deletion | `server/routes/*` delete account, cascades | ✅ |
| Analytics only after consent | `client/src/lib/consent.ts` → `analytics.ts` | ✅ nothing loads before the click |
| Libro de Reclamaciones | `client/src/pages/reclamaciones.tsx`, `server/complaints.ts` | ✅ form, code, copy to consumer and team |
| Boleta / factura data capture | `shared/peruCheckout.ts`, `server/billingProfileInput.ts` | ✅ captured; issued by hand in SUNAT |
| Privacy policy and terms, three languages | `client/public/locales/*/translation.json` | ✅ corrected 2026-10-29 (see below) |
| Honest AI wording | same files | ✅ voice notes are no longer described as anonymised |

## Missing, and only the owner can obtain

| Item | Why it blocks | Who |
|---|---|---|
| **RUC** | Prices are in soles, boletas and facturas are issued, so the service is a taxable supply. Nothing in the app can print it until it exists (`PAYMENTS_LEGAL_NAME` is empty in `.env.example`). | Owner + accountant |
| **Peruvian legal entity or a representative in Peru** | The 2024 regulation is expressly extraterritorial and expects a representative for a foreign controller serving people in Peru. | Owner + lawyer |
| **Nine bank registrations** in `sipdp.minjus.gob.pe` | Free, automatic approval, one ficha plus a code per bank. The inventory is `registro-bancos.md`. | Owner (the lawyer can fill the fichas) |
| **Monthly IGV** for digital services | Comes with the RUC. | Accountant |
| **App-store data-safety forms** | Only if a mobile wrapper is shipped. | Owner |

## Missing, and I can draft

| Document | Why it is needed | Status |
|---|---|---|
| Documento de Seguridad (with fecha cierta, bank inventory, access log kept ≥2 years, privilege review every 6 months) | Required of every controller | not started |
| Inventario de tratamientos / ROPA | The basis for the fichas | `registro-bancos.md` is the first draft |
| DPA / contractual clauses with each provider | 14 providers, 13 of them outside Peru | not started |
| Transfer assessment (the US has no adequacy declaration) | Required for the transfers we actually make | not started |
| Incident protocol, 48 h notification, incident log | Required, and untested today | not started |
| ARCO procedure with register and templates (20 days access / 10 days the rest) | The policy now promises these deadlines | not started: `info@kaptia.app` is the only channel |
| Retention and purge policy | Complaints, invitations and tax documents now appear in the table; the exact periods are still the owner's to fix | partly done 2026-10-29 |
| Access control, tested backups, confidentiality commitments | Partly true already (`docs/recovery-runbook.md`, `docs/dr-drill-log.md`) | assemble into one document |
| Consent register | Now real: the answer to the AI question is stored with the server's timestamp (`ai_consent_decided_at`) | ✅ 2026-10-29 |
| Cookie policy with real cookie names | The banner is honest but the policy is generic | not started |

## The AI consent default — decided and shipped

`ai_enabled` used to default to `true` (`migrations/0000_baseline_2026_10.sql:505`), so a new
account had voice, receipt scanning, categorisation and tips switched on before the person chose
anything, while the policy said those functions were optional and consented.

On the owner's instruction the answer is now **asked at signup**:

- `migrations/0008_users_ai_consent.sql` adds `ai_consent_decided_at`, flips the default of
  `ai_enabled` to `false`, and stamps existing accounts with `created_at` so nobody who already
  made a choice is asked again;
- `client/src/components/AiConsentDialog.tsx` asks once, in the language of the page, with the
  honest wording (text and images leave masked; a voice note leaves as recorded);
- `PUT /api/auth/user` records the answer **and** the server's timestamp — a date supplied by the
  browser is refused;
- `server/aiAccess.ts` already blocks every AI route while `ai_enabled` is false, so the safe
  default is also the enforced one.

The same change added the notice inside goal-invitation e-mails (bank 6) and the three missing
retention rows (complaints, invitations, tax documents).

## Order of work

1. RUC and representative (owner).
2. Fill the nine fichas from `registro-bancos.md` and register them (owner, one afternoon).
3. The lawyer writes the Documento de Seguridad, the transfer assessment and the DPA pack,
   using this folder as the fact base.
4. Then the ARCO procedure and the incident protocol get tested once, on purpose, with a real
   request and a drill — a document nobody has run is a document that fails the first time.

## Decisions on record

- **2026-10-29 — ARCO deadlines:** the owner confirms the policy's **20 business days for access
  and 10 business days for the rest**. This is the one number in a customer-facing page that a
  complaint can be built on, so the lawyer should still confirm it against the regulation text
  before the registration is filed. If it is wrong, it is one string in three locale files and
  `tests/unit/peruLegalCopy.test.ts` points straight at it.
- **2026-10-29 — AI consent:** asked at signup, off by default, recorded server-side (above).

