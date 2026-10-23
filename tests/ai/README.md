# `tests/ai` — recorded AI outputs

Nothing in this folder may require an API key, network or money. Tests here replay
**captured** provider responses, exactly as blueprint `02-receipt-ocr-ai.md` describes.

## Why

`lib/aiProvider.ts` routes across **openai → deepseek → groq → mistral** with automatic
fallback. Without a recorded answer, an "accuracy" number is meaningless and a test would
cost money on every run.

## Layout

```
tests/ai/
  README.md                  # this file
  recorded/
    openai/                  # provider name
      receipt-lidl-01.json
    mistral-ocr/
      lidl-01.json           # raw OCR provider response
  images/                    # optional source images (anonymized, no PII)
  receiptReplay.test.ts      # replays the fixtures through the impure extraction path
```

`vitest.config.ts` includes `tests/ai/**/*.test.ts` and excludes `tests/ai/images/**`.

## Mandatory record format

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

| Field | Meaning |
|---|---|
| `output` | **verbatim** provider reply. Object when the model returned JSON, string when it returned prose |
| `expected` | what normalization must produce (`amountInCents` is an integer) |
| `source` | `captured` (real run) or `synthetic` (hand-written from a documented reply shape) |
| `ocrSource` | `mistral` / `vision` / `text` / `ai-processor`; **required** when `source: "captured"` |

`shared/aiFixture.ts` validates this at load time. A fixture claiming `captured` without
`ocrSource` (or with a broken `capturedAt`) fails the test run — provenance cannot be faked.

## Privacy rules (non-negotiable)

- No names, no IBANs, no card PANs, no addresses, no e-mail/phone numbers.
- Amounts and dates may stay real — they are needed for the assertions.
- When in doubt, redact: a fixture with a redacted name still tests the amount parsing.

## Capturing a new fixture

```bash
# spends real API credit; requires MISTRAL_API_KEY and/or Google Vision credentials
npm run capture:ai -- --image tests/ai/images/lidl-01.jpg --name lidl-01 --yes
npm run capture:ai -- --text "Lidl / SPOLU 24,89 EUR" --name manual-01 --yes
```

The script validates the fixture with `parseAiFixture` before writing it, so a broken capture
fails at capture time and never reaches CI. It refuses to run with `NODE_ENV=production`
and requires `--yes`.

## Benchmarking accuracy (opt-in, never in CI)

```bash
npm run benchmark:ocr -- --yes                      # only source: "captured"
npm run benchmark:ocr -- --yes --include-synthetic  # also the synthetic contract set
npm run benchmark:ocr -- --yes --fail-under 90      # manual gate, not used by CI
```

Writes `testing-blueprint/reports/ocr-YYYY-MM-DD.json` with per-field accuracy
(amount / date / vendor) and the provider+model that actually answered. Without
`--fail-under` it always exits 0: an accuracy drop opens an issue, it does not break a PR.
