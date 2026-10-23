# 03 — Voice-to-expense

> Status: **IMPLEMENTED** (step 4) with one honest caveat:
> the phrase matrix has 100 sentences (SK 50 / EN 30 / ES 20), and the audio smoke test is
> not written because no `.m4a` samples exist in the repo yet.
> Prerequisite: money contract (`shared/money.ts`) + blueprint 02 (shared draft type).

---

## 1. Scope

**In scope**

| Artifact | Role today |
|---|---|
| `server/routes/voiceRoutes.ts:8` `parseVoiceInput(transcript, userLanguage)` | **pure rule-based** amount/merchant/date parser. Unexported, untyped, no tests |
| `lib/merchantLookup.ts` `lookupMerchant` | merchant → canonical name used by the parser |
| `server/groqClient.ts:12` `transcribeAudioWithGroq` | STT, `whisper-large-v3-turbo` |
| `server/groqClient.ts:31` `parseTransactionWithGroq` | LLM extraction (Groq + `gpt-oss-*`) |
| `server/mistralClient.ts:54` `transcribeAudio` | STT, `voxtral-mini-transcribe-3` |
| `server/mistralTransactionParser.ts` | LLM extraction + **hardcoded amount corrections** (Spanish) |
| `server/openai.ts:2080` `voiceExtraction` | third extraction path |
| `server/routes/{voiceRoutes,groqVoiceRoutes,mistralVoiceRoutes,ttsRoutes}.ts` | HTTP surface |

**Out of scope:** ElevenLabs TTS (`server/elevenLabs.ts`) — output only, no financial data.
Microphone permission UX, waveform rendering, browser Speech API fallback.

---

## 2. Contracts

- Money: the parser emits **`amountInCents`** (integer). Speech produces `"12:50"`, `"12.50"`,
  `"dvanásť päťdesiat"`, `"1 234,56"` — all go through `parseAmountToCents` plus explicit rules for
  the colon and split-decimal forms.
- Sign: the utterance implies direction. `"kúpil som"`, `"zaplatil"` → `expense`; `"dostal som"`,
  `"výplata"` → `income`. Ambiguous → `expense` (current behaviour) + `needsReview: true`.
- Time: relative words (`dnes`, `včera`, `today`, `yesterday`, `ayer`) resolve to an ISO **date**
  against a frozen "now" injected into the parser. The parser must never call `new Date()` itself.
- Locale: `sk`, `en-us`, `es-pe`. One matrix per language; never machine-translated.

---

## 3. Refactor required (blocker)

`parseVoiceInput` is 300+ lines inside a route file and is not importable. Move it out unchanged:

```ts
// shared/voiceParser.ts (new) — PURE, no fs, no network, no model
export interface VoiceParseResult {
  amount: string;               // legacy "12.50", or "" when nothing was found
  amountInCents: number | null; // source of truth
  description: string;          // first capitalised token, or "Transaction"
  type: 'income' | 'expense';
  date: string;                 // YYYY-MM-DD (local calendar) or ""
  needsReview: boolean;         // no amount, or more than one numeric candidate
  note: string;                 // original transcript
}

export function parseVoiceInput(
  transcript: string,
  language: string,
  now: Date,                    // injected — never `new Date()` inside
): VoiceParseResult;

// shared/voiceCorrections.ts (new) — PURE, extracted from mistralTransactionParser.ts
export function findAmountCorrection(transcript: string): AmountCorrection | null;
export function applyAmountCorrections(
  transcript: string,
  extractedAmount: unknown,
): { amount: string; corrected: boolean; label?: string };
```

**Merchant and category are NOT part of this parser.** They were never in it: the route calls
`lookupMerchant()` (`lib/merchantLookup.ts`), which reads country JSON from disk and may call
an LLM. That stays in the route; the pure parser only handles amount/type/date/description.

`parseTransactionWithMistral` also carries deterministic post-processing (amount corrections around
lines 116–155). Extract that as `applyAmountCorrections(transcript, extracted)` and unit-test it
**without any LLM call**.

---

## 4. Ground truth — phrase matrix

`tests/fixtures/voice-phrases.sk.json`, `.en.json`, `.es.json` — **100 sentences**
(SK 50, EN 30, ES 20). Each file carries `language`, a frozen `now`, and per-phrase expectations.

```json
[
  { "text": "Kúpil som naftu na Slovnafte za 60 eur", "expected": { "amountInCents": 6000, "type": "expense", "merchant": "Slovnaft", "categoryHint": "Doprava" } },
  { "text": "Obed včera dvanásť päťdesiat",           "expected": { "amountInCents": 1250, "type": "expense", "date": "yesterday", "categoryHint": "Stravovanie" } },
  { "text": "Stovka do sporenia",                    "expected": { "amountInCents": 10000, "type": "expense", "categoryHint": "Úspory" } },
  { "text": "Dostal som výplatu 2450 eur",           "expected": { "amountInCents": 245000, "type": "income" } },
  { "text": "Káva 2,50 a croissant 3,20",            "expected": { "amountInCents": null, "needsReview": true } }
]
```

`"date": "yesterday"` is resolved by the runner against a fixed `now`
(`2026-03-15T10:00:00` local) → `2026-03-14`.

---

## 5. Expected output rules

| Input shape | Result |
|---|---|
| `"5.50"`, `"5,50"`, `"5:50"` | `550` |
| `"dvanásť päťdesiat"` (two numbers) | `1250` — split-decimal rule that already exists |
| `"60 eur"` / `"60 €"` / `"60 dollars"` | `6000` (currency word skipped) |
| `"včera"`, `"today"`, `"ayer"` | resolved date against the injected `now` |
| No number at all | `amountInCents: null`, `needsReview: true` — never `0`, never a guess |

---

## 6. Edge cases (minimum)

1. Word-number `"stovka"`, `"tisíc"`, `"five hundred"` → **known gap today** (only digits are
   handled). Decide explicitly: implement in the parser, or route to the LLM path.
2. Two amounts in one utterance (`"káva 2,50 a croissant 3,20"`) → `needsReview: true`.
3. Amount `0` / `"nula"` → `needsReview: true`.
4. Refund phrasing (`"vrátili mi 20 eur"`) → `income`, not expense.
5. Empty transcript / whitespace only → `amountInCents: null`, no throw.
6. 10-minute transcript (2 000 words) → bounded time, no catastrophic backtracking.
7. Mixed language (`"paid 12 eur"`) → parses; category language follows the user setting.
8. Currency symbol with spaces (`"12 , 50"`) → `1250`.
9. Decimal comma + thousands dot (`"1.234,56"`) → `123456`.
10. STT returns digits as words (`"twelve fifty"`) → covered by the split-decimal rule.

---

## 7. Runner skeleton

```ts
// tests/unit/voiceParser.test.ts — no audio, no network
const NOW = new Date(2026, 2, 15, 10, 0, 0); // local, frozen

for (const phrase of phrasesSk) {
  it(`parses "${phrase.text}"`, () => {
    const result = parseVoiceInput(phrase.text, 'sk', NOW);
    expect(result.amountInCents).toBe(phrase.expected.amountInCents);
    expect(result.type).toBe(phrase.expected.type);
    if (phrase.expected.date) {
      expect(result.date).toBe(resolveExpectedDate(phrase.expected.date, NOW));
    }
  });
}
```

Audio (opt-in only, costs money):

```ts
// tests/ai/voiceAudio.test.ts
const runAudio = process.env.RUN_AUDIO_TESTS === '1';
(runAudio ? describe : describe.skip)('STT smoke (3 samples)', () => { /* … */ });
```

---

## 8. Determinism

- The parser under test is **pure** (`transcript`, `language`, `now` → result). No clock, no network.
- LLM paths (`parseTransactionWithGroq`, `parseTransactionWithMistral`, `voiceExtraction`) are tested
  like 02: recorded replies with `{ provider, model, promptVersion }`.
- Each provider gets its **own** expectations — Groq and Mistral formats differ (Mistral sometimes
  returns `amount` as a string, Groq as a number).
- Audio tests run only with `RUN_AUDIO_TESTS=1`, never in PR CI.

---

## 9. Implementation log (step 4, done)

| Artifact | Lines | What it does |
|---|---|---|
| `shared/voiceParser.ts` | 150 | pure parser; `now` injected; `amountInCents` + `needsReview` |
| `shared/voiceCorrections.ts` | 47 | Spanish spoken-number corrections (was inline in the Mistral parser) |
| `server/routes/voiceRoutes.ts` | **214 → 92** | route only: zod validation, merchant lookup, response |
| `server/mistralTransactionParser.ts` | unchanged size | now calls `findAmountCorrection` / `applyAmountCorrections` |
| `tests/fixtures/voice-phrases.{sk,en,es}.json` | 100 phrases | SK/EN/ES matrix with frozen `now` |
| `tests/unit/voiceParser.test.ts` | 120 tests | 100 matrix cases + 20 behaviour/regression tests |
| `tests/unit/voiceCorrections.test.ts` | 9 tests | pattern detection + override rules |

**Bug found and fixed (live in production):**

`text.includes('plat')` classified **"Zaplatil som 15.75"** (= "I paid") as **income**, because
"zaplatil" contains "plat". Replaced with word-boundary `/\bplat\b/` plus `/\bvýplat/` so
"výplata" (salary) still works. Both directions are pinned by tests.

**Second fix:** `new Date().toISOString().split('T')[0]` for "today"/"yesterday" returned
*yesterday* for a user at 00:30 in a UTC+ timezone. Now the local calendar date is used.

**Known limits (tested, not hidden):**

- Word numbers ("stovka", "five hundred") are not parsed — the LLM path handles them.
- Space-separated thousands ("1 500") are read as two tokens → `needsReview: true`.
- `description` is the first capitalised token, which for "Kúpil som naftu…" is "Kúpil".
  This is existing behaviour, pinned by a test, and the reason the LLM path exists.
- The audio smoke test is not written: `tests/ai/audio/` is empty. When three `.m4a` samples
  exist, add them behind `RUN_AUDIO_TESTS=1` (priced, so never in PR CI).
