# 02 — Receipt OCR & AI extraction

> Status: **IMPLEMENTED** (step 3), with one honest caveat:
> the fixture set is `source: "synthetic"` until someone runs `npm run capture:ai -- --yes`
> against a real provider. Every test, script and validator for that capture exists.
> Prerequisite: `shared/money.ts` from step 1 (money contract).

---

## 1. Scope

**In scope**

| Artifact | Role today |
|---|---|
| `server/uploadReceipt.ts:84` `performOCR(imageBuffer)` | Mistral OCR first, **Google Cloud Vision fallback** (`textDetection`) |
| `server/uploadReceipt.ts:146` `extractStructuredData(ocrText)` | **one function** that calls OpenAI *and* normalizes the reply |
| `server/uploadReceipt.ts:60` `getUserPlan(userId)` | upload is plan-gated — tests must set the plan |
| `server/openai.ts` `categorizeExpense` / `categorizeExpenseWithUserCategories` | maps vendor → category |
| `external-services/ai-processor` (`/execute-gpt-task`, task `categorizeExpense`) | optional proxy, enabled by `AI_PROCESSOR_ENABLED=true` |

**Out of scope:** cloud upload (`cloudStorage.ts`, Bunny), image resizing, plan/billing enforcement,
`tesseract.js` (present in `node_modules` but not on the active path).

---

## 2. Contracts

- Money: OCR produces `"1 234,56 €"` / `"12,50"` / `"12.50"` → **always** through
  `parseAmountToCents`. The draft type carries `amountInCents`, never a float.
- Sign: a receipt amount is non-negative; the type is `expense` unless the text says otherwise.
- Time: extracted dates normalize to `YYYY-MM-DD` **without** timezone shifting.
  Do not hand `12.03.2026` to `new Date()`: V8 parses it as **3 December 2026** (US `m/d/y`),
  silently, without an error — the previous implementation did exactly that and stored a wrong month.
- Locale: vendor/category names are returned as found in the text; no translation in this layer.

---

## 3. The refactor this blueprint requires (blocker)

`extractStructuredData` mixed an LLM call (`openai.chat.completions.create`) with pure
normalization. It is now split into three testable pieces, **without changing the wire shape**:

```ts
// shared/receiptExtraction.ts — PURE, no SDK, no keys. This is what the tests import.
export interface ReceiptExtractionDraft {
  amountInCents: Cents | null;
  date: string | null;            // YYYY-MM-DD
  vendor: string | null;          // <= 100 chars
  raw: unknown;                   // untouched model reply, for recorded fixtures
  provider?: string;
  model?: string;
  error?: string;
}

export function normalizeReceiptExtraction(raw: unknown, meta?): ReceiptExtractionDraft;
export function normalizeReceiptAmount(input: unknown): Cents | null;
export function normalizeReceiptDate(input: unknown): string | null;
export function normalizeReceiptVendor(input: unknown): string | null;
export function toLegacyExtractedReceipt(draft): { amount?: number; date?: string; vendor?: string };
export function applyRegexFallback(legacy, ocrText): LegacyExtractedReceipt;   // opt-in only

// server/receiptExtraction.ts — IMPURE: the single place that talks to a model.
export async function extractReceiptWithAI(ocrText: string): Promise<ReceiptExtractionDraft>;
export async function extractStructuredData(ocrText): Promise<LegacyExtractedReceipt & { error?: string }>;
```

`server/uploadReceipt.ts` keeps `extractStructuredData` as a re-export, so
`mobileUploadRoutes.ts` and the upload handler are untouched (356 → 241 lines, dead regex
helpers moved and exported).

**Why the pure half lives in `shared/`:** a unit test that imports `server/receiptExtraction.ts`
would pull in the OpenAI SDK. Tests must never need a provider dependency to assert arithmetic.

Behaviour preserved (and now asserted):

| Current rule | Test |
|---|---|
| `amount` must be `> 0`, else omitted | `normalizeReceiptExtraction({ amount: 0 })` → `amountInCents: null` |
| `Number(result.amount)` | `"1.234,56"` must become `123456`, not `1.234` → **this was a live bug** (`Number()` → `NaN` → amount silently dropped) |
| date already `YYYY-MM-DD` passes through | `{ date: '2026-03-12' }` → `'2026-03-12'` |
| other dates: explicit EU/US parsing | `{ date: '12.03.2026' }` → `'2026-03-12'` (**old code stored `2026-12-03`** — V8 read it as US `m/d/y`) |
| vendor trimmed, `1..100` chars | 101 chars → `null` |
| API/DB shape unchanged | `toLegacyExtractedReceipt` returns `{ amount: 24.89, … }`, nulls omitted |

---

## 4. Ground truth

Committed (one file per capture, validated by `shared/aiFixture.ts`):

```
tests/ai/recorded/openai/receipt-lidl-01.json        SK receipt, EU amount, EU date
tests/ai/recorded/openai/receipt-invoice-02.json     "1 234,56" invoice
tests/ai/recorded/openai/receipt-restaurant-03.json  "12,50 EUR"
tests/ai/recorded/openai/receipt-blurry-04.json      nothing readable -> all nulls
tests/ai/recorded/openai/receipt-zero-05.json        "0,00" -> no amount, date+vendor kept
tests/ai/recorded/openai/receipt-non-json-06.json    model answered with prose
tests/ai/recorded/openai/receipt-long-vendor-07.json 120-char vendor -> null
tests/ai/recorded/openai/receipt-us-format-08.json   "1,234.56 USD", "12/25/2026"
tests/ai/recorded/mistral-ocr/lidl-01.json           raw Mistral OCR pages payload
```

All nine are `"source": "synthetic"` today: they model documented reply shapes so the
replay harness and the validator can be trusted before any money is spent. The moment a
real capture lands (`npm run capture:ai`), that file says `"source": "captured"` and the
replay test starts covering the real provider output. The fixture test asserts both
values are legal and that synthetic ones are labelled as such.

Metadata block (validated, not decorative):

```json
{
  "meta": {
    "provider": "openai",
    "model": "gpt-6-luna",
    "task": "receipt-extraction",
    "promptVersion": "receipt-extract@1",
    "ocrSource": "mistral",
    "capturedAt": "2026-10-22T09:00:00Z",
    "source": "captured"
  },
  "input": "…raw OCR text…",
  "output": { "amount": 24.89, "date": "2026-03-12", "vendor": "Lidl" },
  "expected": { "amountInCents": 2489, "date": "2026-03-12", "vendor": "Lidl" }
}
```

`source: "captured"` without `ocrSource`, an unknown `task`, or a non-ISO `capturedAt`
throws `AiFixtureError` at load time — provenance cannot be fabricated.

Target for real captures: 20–30 documents — 5 crumpled Lidl receipts, 5 restaurant
receipts, 5 PDF invoices, 5 low-quality phone photos. **Anonymize** before committing
(no card PAN, no full name, no IBAN).

---

## 5. Expected output

| Recorded sample | `amountInCents` | `date` | `vendor` |
|---|---|---|---|
| `lidl_01` (`"SPOLU 24,89 €"`) | `2489` | `2026-03-12` | `Lidl` |
| `restaurant_03` (`"12.50"`) | `1250` | `2026-03-14` | `Bistro` |
| `invoice_05` (`"1 234,56"`) | `123456` | `2026-03-02` | `Alza` |
| `blurry_02` (no readable total) | `null` | `null` | `null` |

---

## 6. Edge cases (minimum)

1. Amount written EU-style `"1.234,56"` → `123456` (today `Number('1.234,56')` is `NaN` → dropped).
2. `"12,50 €"` → `1250`.
3. Zero / negative total (`"0,00"`, `"-5,00"`) → `null` (keep the current `> 0` rule).
4. No total at all (only items listed) → `null`, never a guess.
5. Date formats `12.03.2026`, `2026-03-12`, `12/03/2026` → the same `date`.
6. Vendor longer than 100 chars (multi-line header) → `null`.
7. Model returns a string instead of JSON, or `{}` → empty draft, no throw.
8. OCR text of 100 kB garbage → all `null`, bounded response time.
9. Vision fallback used (`ocrSource: "vision"`) → same expectations, separate recorded set.
10. Upload by a `free`-plan user → rejected by the plan gate **before** OCR.

---

## 7. Runner skeleton

```ts
// tests/unit/receiptExtraction.test.ts — deterministic, no network
import { normalizeReceiptExtraction } from '../../server/receiptExtraction';

it('parses EU-format totals from the model reply', () => {
  const draft = normalizeReceiptExtraction({ amount: '1.234,56', date: '12.03.2026', vendor: ' Alza ' });
  expect(draft.amountInCents).toBe(123456);
  expect(draft.date).toBe('2026-03-12');
  expect(draft.vendor).toBe('Alza');
});

it('keeps zero totals out', () => {
  expect(normalizeReceiptExtraction({ amount: 0 }).amountInCents).toBeNull();
});
```

```ts
// tests/ai/receiptReplay.test.ts — replays recorded replies through the impure path
const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));
vi.mock('../../server/openaiClient', () => ({ openai: { chat: { completions: { create: createMock } } } }));

for (const { file, fixture } of cases) {
  it(`replays ${file}`, async () => {
    createMock.mockResolvedValueOnce({
      choices: [{ message: { content: asContent(fixture.output) } }],
    });

    const draft = await extractReceiptWithAI(fixture.input);
    expect({ amountInCents: draft.amountInCents, date: draft.date, vendor: draft.vendor })
      .toEqual(fixture.expected);
  });
}
```

Commands:

```bash
npm run test          # all: 117 tests, no keys, no network
npm run test:ai       # only the replay suite
npm run capture:ai -- --image tests/ai/images/lidl-01.jpg --name lidl-01 --yes
npm run benchmark:ocr -- --yes --include-synthetic
```

---

## 8. Determinism

- **Phase 1 (CI):** recorded OCR + recorded model replies only. No key, no cost, no flakiness.
- **Phase 2 (scheduled, not CI):** `npm run benchmark:ocr` sends the 20–30 documents live and writes
  `testing-blueprint/reports/ocr-YYYY-MM-DD.json`. The report records which provider/model actually
  answered, because `lib/aiProvider.ts` falls back openai → deepseek → groq → mistral.
- A live accuracy threshold **must not** fail a PR build. If accuracy drops, the scheduled job opens
  an issue / sends an email (`server/emailService.ts`).
- `temperature: 0.1` is set today; recorded fixtures still carry `promptVersion`, so a prompt change
  invalidates the replay deliberately instead of silently.

---

## 9. Implementation log (step 3, done)

| Artifact | Lines | What it does |
|---|---|---|
| `shared/receiptExtraction.ts` | 225 | pure: amount→cents, EU/US date parsing, vendor rules, legacy shape, regex fallback |
| `server/receiptExtraction.ts` | 88 | the only model call, `RECEIPT_PROMPT_VERSION`, legacy wrapper |
| `server/ocr.ts` | 158 | Mistral primary + Vision fallback, both injectable; lazy GCP SDK import |
| `server/uploadReceipt.ts` | 157 (was 356) | multer + plan gate + cloud upload + handler; OCR/extraction re-exported |
| `shared/aiFixture.ts` | 140 | fixture schema + provenance validation |
| `scripts/capture-ai-fixture.ts` | 155 | writes a validated fixture, refuses production, needs `--yes` |
| `scripts/benchmark-ocr.ts` | 190 | live per-field accuracy + JSON report, never in CI |
| `tests/unit/receiptExtraction.test.ts` | 24 tests | pure normalization |
| `tests/unit/ocr.test.ts` | 11 tests | provider contract + fallback chain |
| `tests/unit/aiFixture.test.ts` | 10 tests | provenance cannot be faked |
| `tests/ai/receiptReplay.test.ts` | 18 tests | 9 fixtures replayed through the impure path + plumbing |

**Bugs found by this module (both were live in production code):**

1. `Number('1.234,56')` → `NaN` → the amount was silently dropped for any EU-formatted total.
2. `new Date('12.03.2026').toISOString()` → `2026-12-03` (V8 reads it as US `m/d/y`), so a receipt
   dated 12 March was stored as 3 December.

**Deliberate behaviour changes:**

- `RECEIPT_REGEX_FALLBACK=1` is the only way the regex fallback runs; default is off because a regex
  over OCR text picks up line items instead of the total.
- Numeric dates with a day > 12 are accepted in US order (`12/25/2026`); ambiguous `03/12/2026`
  stays EU (3 December). Documented, tested, and it cannot silently flip an existing EU path.

**Still out of scope for this step**

- `categorizeExpense` / `categorizeExpenseWithUserCategories` (`server/openai.ts`) — lives inside an
  82 KB module with DB and provider dependencies; needs its own extraction before it is testable.
- The multer handler itself (file size limit, plan gate, cloud upload fallback) — integration test
  with a Neon branch, step 4.
- Real captures: 0 of the 20–30 target documents. Run `npm run capture:ai` on a machine with keys.

