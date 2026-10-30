# 2026-10-29 — the Peru legal pages stop saying things that are not true

## Goal

Every statement a Peruvian customer reads about their data, their rights and their forum is
true: the regulation cited is the one in force, the response deadlines are the real ones, the
recipients are the ones that actually receive data, and a recorded voice note is not described
as anonymised.

## Out of scope

- Appointing a representative in Peru, obtaining an RUC, registering the nine bancos de datos,
  writing the Documento de Seguridad / ROPA / DPAs. Those are documents and filings, not copy.
- Turning `users.ai_enabled` off by default for new accounts. That is a product decision with
  a visible cost (voice, receipt scanning and categorisation stop working at signup) and the
  owner has to choose it, not the code.
- The RUC and the IGV statement in the footer and the complaints book: the value does not exist
  yet, so the copy cannot carry it. Placeholder values are worse than an honest gap.
- Rewriting the Libre de Reclamaciones form itself (it is already compliant in shape).

## Files that will change

- `client/public/locales/{es-pe,en-us,sk-sk}/translation.json` — `privacy.peru.*`,
  `privacy.section3.*`, `data_transfers.ai`, `terms.{receipts_desc,liability_cap,governing_law_desc}`,
  `reclamaciones.note`, `privacy.last_updated`.
- `tests/unit/peruLegalCopy.test.ts` — new; pins each of those claims.
- `legal/` — the documentary starter kit that this change unblocks (see below).

## The risk

Over-correcting the copy can promise something the code does not do: if the new text says the
voice note is deleted after transcription and the code keeps it, the policy becomes a second
lie. Every sentence added here was checked against `server/groqClient.ts`,
`server/mistralClient.ts`, `server/ocr.ts`, `server/middleware/countryBlocking.ts`,
`lib/geolocation.ts` and `server/emailService.ts` first. Second risk: three languages edited by
hand drift apart — the new test compares all three against the same claims.

## How it is proven

- Test: `tests/unit/peruLegalCopy.test.ts` — the repealed decree is gone, `016-2024-JUS` is
  cited, both deadlines are present and the "8 y 20" wording is not, the voice-note exception is
  described, every provider that receives data is named, the consumer forum carve-out exists and
  the complaints book carries the mandatory notice. Reverting the copy turns it red.
- Gate: `DATABASE_URL=postgresql://ci:ci@127.0.0.1:5432/dummy ./verify.sh --all`

## Steps

1. Correct the nine claims in Spanish, then mirror them in English and Slovak.
2. Add the test.
3. Add `legal/` starter kit: bank inventory (ROPA), ficha template, missing-document list.
4. Run the gate.

## Review — filled in after building, by the reviewer pass

- [x] Q1 · plain sentence a non-developer can read: the Peru pages now describe what actually
      happens — the right regulation, the real deadlines, the companies that really receive
      data, and a voice note is no longer called anonymous.
- [x] Q2 · the test that fails without this change: `tests/unit/peruLegalCopy.test.ts`. Proved
      against `git show HEAD:` copies of the three locale files — the old copy fails the
      repealed-decree check, the "8 to 20 days" check, the voice check (es/en), the recipient
      check, the portability check and the terms carve-out check. One assertion was found to pass
      for the wrong reason in Slovak (`súhlas` contains `hlas`) and was tightened to `hlasov`.
- [x] Q3 · `./verify.sh` — result: see the report; `checks`, `tests`, `graph`, `build` all green on
      the final tree.
- [x] Q4 · the risk, named: the copy now promises the 20/10 deadlines, so an ARCO request that
      goes unanswered makes the policy itself the evidence; and the recipient list is only true
      while no new provider is wired in. Both are cheaper to hold than the previous statements.
- [ ] Q5 · the reviewer read the diff (who, when): **not done** — the author and the reviewer
      would be the same pass. This is the honest gap in this change.
- [x] `lessons.md` updated — two lines, both surprises from this change.

