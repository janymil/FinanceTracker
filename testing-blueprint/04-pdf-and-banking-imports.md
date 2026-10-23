# 04 — PDF exports & bank statement imports

> Status: **PARTIALLY IMPLEMENTED** (step 4).
> Done: PDF service client contract (payload builders + 6 failure modes, 15 tests).
> Blocked: bank statement parsing — needs anonymized PDFs and a Neon branch.
> Prerequisite: 01 (money contract), 02 (recorded OCR outputs).

---

## 1. Scope

**In scope**

| Artifact | Role today |
|---|---|
| `server/pdfProcessorClient.ts:69` `requestPdf(payload)` | POSTs to the **external** PDF service, returns a `Buffer` |
| `server/pdfProcessorClient.ts:45` `ProcessorPayload` | contract: `userData`, `transactions[]`, `categories[]`, `budgets?`, `goals?`, `insights?`, `language`, `period`, `currency` |
| `server/pdfGenerator.ts` | alternate renderer using **puppeteer**; `server/pdfTemplate.ts` holds the HTML |
| `server/routes/pdfRoutes.ts:11` `POST /api/generate-trends-pdf` | HTTP entry point |
| `server/routes/importRoutes.ts:587` `POST /api/import/pdf-statement` | multer upload + duplicate detection (last 6 months) |
| `server/routes/importRoutes.ts:667` `POST /api/import/bank-statement/confirm` | persists reviewed rows |
| `server/routes/importRoutes.ts:241` `GET /api/import/pdf-progress/:sessionId` | SSE progress |
| `server/openai.ts:2141` `parseBankStatement(text, language)` | LLM extraction from statement text |

**Out of scope:** `external-services/pdf-processor` internals (separate deploy, own tests),
`external-services/ai-processor/generate-pdf`, XLSX/CSV export (`exportRoutes.ts`).

---

## 2. Contracts

- **Currency is a display symbol, ≤ 5 characters.** `normalizeCurrency()` slices to 5 and falls back
  to `'$'`. `"EUR"` is acceptable only as a symbol, never as an ISO code.
- `requestPdf` never throws raw errors: everything becomes `PdfProcessorError` with
  `statusCode = 502` and `details` truncated to 500 chars. A 401/403 from the service is therefore
  reported as 502 to the client — preserve and assert that.
- Timeout is `PDF_SERVICE_TIMEOUT_MS` (default 60 000) via `AbortSignal.timeout`.
- Incoming statement rows carry amounts as **strings** (`decimal(12,2)`), so duplicate detection must
  compare cents, not floats.

---

## 3. Ground truth

```
tests/fixtures/pdf/expected-payload.json          # exact request body for a fixed input
tests/fixtures/bank-statements/tatra-2026-03.pdf  # anonymized
tests/fixtures/bank-statements/slsp-2026-03.pdf
tests/fixtures/bank-statements/vub-2026-03.pdf
tests/fixtures/bank-statements/revolut-2026-03.csv
tests/fixtures/bank-statements/expected-*.json    # { count, rows: [{ date, amountInCents, type }] }
```

Anonymization is mandatory: no real names, no IBANs, no card PANs. Amounts and dates may stay real.

---

## 4. Expected output

**PDF service contract** (asserted with a stubbed `fetch`):

```ts
const payload = buildPayloadFor(fixtureUser, fixtureTransactions, { period: '2026-03', currency: '€' });
expect(payload.currency).toBe('€');          // symbol, not 'EUR'
expect(payload.period).toBe('2026-03');
expect(payload.transactions[0]).toMatchObject({ month: '2026-03', amount: 84.3, type: 'expense' });
expect(payload.userData.firstName).toBeTruthy();
```

**Bank statements** (each file must yield an exact count and sign per row):

| File | Rows | Income | Expense | Net (cents) |
|---|---|---|---|---|
| `tatra-2026-03.pdf` | 24 | 2 | 22 | `-118045` |
| `slsp-2026-03.pdf` | 18 | 1 | 17 | `-64820` |
| `vub-2026-03.pdf` | 31 | 3 | 28 | `-142300` |
| `revolut-2026-03.csv` | 12 | 4 | 8 | `+88400` |

These numbers are **placeholders until the anonymized files exist** — replace them with real values,
computed once and reviewed by a human.

---

## 5. Edge cases (minimum)

1. Service returns `401` / `403` → client sees `PdfProcessorError` with `statusCode: 502`.
2. Service returns `500` with an HTML body → `details` truncated to 500 chars, no stack leak.
3. Service unreachable / DNS failure → `"PDF processor unreachable at <url>"`.
4. Timeout (`PDF_SERVICE_TIMEOUT_MS=50`) → error, not a hung request.
5. `PDF_API_KEY` missing → request is still sent **without** the `x-api-key` header (current behaviour).
6. `currency: null` → payload carries `'$'`; `currency: 'EUR'` → `'EUR'` (4 chars, passes through).
7. Statement PDF with **no text layer** (scan) → OCR path, recorded fixture required.
8. Password-protected PDF → clear error, no partial import.
9. Statement with 500 rows → bounded time, progress events still emitted.
10. Re-import of the same statement → duplicates detected (6-month window), `0` new rows.
11. Multi-currency statement (EUR + USD) → document the chosen rule before asserting anything.
12. `amount: "1.234,56"` in a text statement → `123456` cents, not `1.234`.

---

## 6. Runner skeleton

```ts
// tests/unit/pdfProcessorClient.test.ts
import { requestPdf, PdfProcessorError } from '../../server/pdfProcessorClient';

let captured: { url: string; headers: any; body: any };

beforeEach(() => {
  captured = {} as any;
  vi.stubGlobal('fetch', vi.fn(async (url: any, init: any) => {
    captured = { url: String(url), headers: init.headers, body: JSON.parse(init.body) };
    return new Response(Buffer.from('%PDF-1.4'), { status: 200 });
  }));
});

it('sends the documented payload and header', async () => {
  const pdf = await requestPdf(payload);
  expect(Buffer.isBuffer(pdf)).toBe(true);
  expect(captured.url).toMatch(/\/generate-pdf$/);
  expect(captured.headers['x-api-key']).toBe(process.env.PDF_API_KEY);
  expect(captured.body.currency).toBe('€');
});

it('maps a 500 from the service to PdfProcessorError(502)', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>boom</html>', { status: 500 })));
  await expect(requestPdf(payload)).rejects.toBeInstanceOf(PdfProcessorError);
});
```

```ts
// tests/integration/bankStatements.test.ts — needs DATABASE_URL_TEST (Neon branch)
for (const statement of statements) {
  it(`parses ${statement.file}`, async () => {
    const result = await processBankStatementPDF(readFileSync(statement.path), 'sk', [], () => {}, userId);
    expect(result.transactions).toHaveLength(statement.expected.count);
    expect(sumAmountsToCents(result.transactions.map((t) => t.amount))).toBe(statement.expected.netInCents);
  });
}
```

---

## 7. Determinism

- The external PDF service is **always** stubbed in CI. One opt-in smoke test (`RUN_PDF_SMOKE=1`)
  may hit the real endpoint.
- `puppeteer` rendering is asserted only for text presence, diacritics (`č, š, ž`) and the currency
  symbol, via `pdf-parse`. Font subsetting makes deeper assertions brittle.
- Bank statement parsing goes through an LLM (`parseBankStatement`) → recorded output fixtures with
  `{ provider, model, promptVersion }`, exactly like blueprint 02.
- `pdf-parse@1.1.1` is an old package and touches ESM oddly under `"type": "module"` — keep it in a
  dedicated test file, never in the global setup.

---

## 8. Implementation log (step 4)

**Done — `tests/unit/pdfProcessorClient.test.ts` (15 tests):**

| Area | Asserted |
|---|---|
| Request | `POST {PDF_SERVICE_URL}/generate-pdf`, `Content-Type: application/json`, `x-api-key`, `AbortSignal` present, trailing slashes trimmed |
| Response | returns a `Buffer`, starts with `%PDF-` |
| Failure mapping | 401 / 403 / 500 → `PdfProcessorError` with `statusCode: 502`; body details truncated to 500 chars; unreachable (`ECONNREFUSED`) and timeout (`TimeoutError`) both wrapped |
| Robustness | a service whose `text()` also throws still yields 502 |
| Payload builders (`buildTrendsPayload`, `buildMonthlyPayload`) | user name split, empty-name fallback `Kaptia User`, currency symbol ≤ 5 chars, missing currency → `$`, transaction month/balance/type mapping, budgets/goals numeric coercion, insights text |

**Deliberately not done (and why):**

1. **Bank statement parsing** (`processBankStatementPDF`, `/api/import/pdf-statement`) — needs
   anonymized PDFs for Tatra banka / SLSP / VÚB / Revolut that do not exist in the repo, plus a
   Neon branch for the insert path. Writing the test against invented fixtures would prove nothing.
2. **Duplicate detection** — `detectDuplicateTransactions` + the three similarity helpers were
   extracted from `lib/pdfProcessor.ts` into `shared/duplicateDetection.ts` and covered by
   **16 tests** (`tests/unit/duplicateDetection.test.ts`): exact re-import, OCR typos,
   genuine new rows, multiple matches, threshold behaviour. `lib/pdfProcessor.ts` lost ~160
   lines of untestable code and keeps working via re-import.
3. **`pdfGenerator.ts` (puppeteer) `pdf-parse` roundtrip** — slow (launches Chromium), so it belongs
   in an opt-in test, not the unit suite.
4. **Opt-in smoke against the real service** (`RUN_PDF_SMOKE=1`) — not written; the stub covers the
   contract, and a live smoke belongs next to the staging environment.

