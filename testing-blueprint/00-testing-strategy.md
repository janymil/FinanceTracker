# 00 — Testovacia stratégia Kaptia

> Stav: **krok 1 a krok 2 hotové** (test runner, money/calculations extrakcia, golden dataset,
> napojenie produkčného kódu, blueprinty 01–05).
> Dátum: 2026-10-22 · Repo: `kaptia` (alias `/var/www/finanzerpro`) · Commit bázy: `f107979a`
>
> Tento dokument je záväzný pre všetky blueprinty v `testing-blueprint/`.
> Ak sa kód a tento dokument rozídu, **dokument sa aktualizuje v tom istom PR** —
> inak vznikne presne tá divergencia, ktorej sa snažíme vyhnúť.

---

## 0. TL;DR

1. **Testy sú dnes 0.** Žiadny Vitest/Jest/Playwright, žiadny `npm test`, žiadne CI.
   Testy sa dokonca **vylučovali z typechecku** (`tsconfig.json` mal `**/*.test.ts` v `exclude`).
2. **Čistá vrstva výpočtov neexistovala.** Matematika bola na dvoch miestach naraz:
   SQL v `server/storage.ts` a ~40 inline `reduce` v React komponentoch.
   Preto krok 1 nie je „testy štatistík", ale **extrakcia + testy**.
3. **Peniaze nikdy neporovnávame cez `toBe(1420.50)`.** Zdroj pravdy sú **integer centy**.
4. **Live AI nikdy neblokuje PR build.** Deterministický parser áno.
5. **Produkčná DB sa v testoch nepoužíva nikdy** — ani na čítanie.

---

## 1. Východiskový stav (merané, nie odhadované)

| Zistenie | Dôkaz |
|---|---|
| Žiadny test runner ani `test` script | `package.json` — iba `check`, `audit:flows`, `db:*`, `auth:*` |
| 0 testovacích súborov v aplikácii | `find` na `*.test.*` / `*.spec.*` nájde len `external-services/*/node_modules` |
| Testy vylúčené z typechecku | pôvodný `tsconfig.json`: `"exclude": [..., "**/*.test.ts"]` |
| Žiadne CI | chýba `.github/` |
| Deploy bez brány | `deploy-prod.sh` → `drizzle-kit push` na produkciu + `NODE_ENV=production npm run dev` |
| Peniaze ako `decimal(12,2)` → v JS **string** | `shared/schema.ts:84` (`transactions.amount`), `scripts/audit-flows.ts` porovnáva `'100.50'` |
| Sumy sa sčítavajú cez `parseFloat` | `client/src/pages/expenses.tsx:267`, `transactions.tsx:393`, `calendar.tsx:127`, `trends.tsx:274`, `budget.tsx:297`, `ai-insights.tsx:87`, `quick-financial-snapshot.tsx:57` … |
| Agregácia na serveri je zlepená s DB | `server/storage.ts:972` `getUserFinancialSummary()` — SQL `sum()` + `Number()` |
| Znamienko je v `type`, nie v sume | `shared/schema.ts:86`, ale kód miestami robí `Math.abs()` (`transactionRoutes.ts:345`) |
| Mena je **symbol**, nie ISO kód | `shared/schema.ts:40` (`varchar(5)`), `server/pdfProcessorClient.ts` komentár `currency: '€'` |
| Kategórie sú lokalizované stringy | `server/categoryTranslations.ts`, `lib/merchantLearning.ts`, `lib/merchantLookup.ts` |
| 4 AI providery s fallbackom | `lib/aiProvider.ts` — openai / deepseek / groq / mistral |
| OCR má 3–4 cesty | `server/uploadReceipt.ts`: Mistral OCR → Google Vision fallback → `AI_PROCESSOR_ENABLED` → `tesseract.js` |
| Voice má 3 STT + TTS + post-processing | `groqClient.ts` (whisper-large-v3-turbo), `mistralClient.ts` (voxtral-mini-transcribe-3), `elevenLabs.ts`, `openai.ts:2080`, `mistralTransactionParser.ts` |
| PDF renderujú 4 rôzne veci | externá služba `pdfProcessorClient.ts`, `pdfGenerator.ts` (puppeteer), `@react-pdf/renderer`, `pdf-lib` |
| Žiadny Sentry / OpenTelemetry | grep na `sentry\|opentelemetry` = 0 zásahov v `client/server/shared` |
| Healthcheck existuje | `server/routes/index.ts:43` → `GET /api/health` |
| Alerting kanál existuje | `server/emailService.ts` (SendGrid / SMTP) |
| Kód: 240 `.ts/.tsx`, 2,71 MB ≈ **600–700 k tokenov** | `wc -c` nad `client/src server shared` |

---

## 2. Rozhodnutia o nástrojoch

| Vrstva | Nástroj | Poznámka |
|---|---|---|
| Unit + integračné | **Vitest 3.2.7** | `vitest@5` žiada `@types/node@^22`, repo má `^20` → pin na 3.x. Konfig: `vitest.config.ts` |
| Mockovanie HTTP (AI, PDF služba) | `vi.stubGlobal('fetch')` / `nock` (krok 3) | MSW pridáme len ak vznikne reálna potreba; zbytočná abstrakcia nad `fetch` je dnes drahšia než úžitok |
| DB integrácia | **Neon branch** + `DATABASE_URL_TEST` (krok 4) | copy-on-write vetva; produkcia sa nikdy nepoužije |
| E2E | **Playwright** (krok 5) | `puppeteer` už v deps kvôli PDF; dva browser stacky sú vedomá daň |
| Typecheck testov | `npm run check` (tsc) | `tests/**/*` je v `tsconfig.json` od kroku 1 |

**Čo sa vedome NEPRIDÁVA v kroku 1:** coverage thresholds, mutation testing, `jsdom`.
Dôvod: nemáme čo pokrývať, kým neexistuje vrstva, ktorá je hodná coverage.

---

## 3. Štyri zmluvy (Contracts)

Toto musí rešpektovať **každý** blueprint aj každý worker v orchestrátorovanej generácii.
Bez nich si 5 nezávislých AI úloh vyrobí 5 protichodných fixtures.

### 3.1 Money contract — `shared/money.ts`

```ts
parseAmountToCents('84.30')            // 8430   (DB formát)
parseAmountToCents('12,50 €')          // 1250   (OCR / voice)
parseAmountToCents('1 234,56')         // 123456 (EU tisíce)
parseAmountToCents('1,234.56')         // 123456 (US tisíce)
parseAmountToCents('1.005')            // 101    (half away from zero)
parseAmountToCents(null)               // 0      (voliteľný stĺpec)
sumAmountsToCents(['0.10', '0.20'])    // 30     (nie 0.30000000000000004)
centsToDecimalString(8430)             // '84.30'
assertCents(12.5)                      // throws RangeError
```

Pravidlá:
- Vnútri sa **počíta v centoch** (`Cents = integer`), nikdy vo `float`.
- `decimal(12,2)` rozsah je vynútený: `|hodnota| ≤ 9 999 999 999.99`.
- Zaokrúhľovanie je komerčné „half away from zero".
- **Test nikdy neasertuje peniaze cez `toBe(12.34)`** — len `*InCents` alebo `toBeCloseTo`.

### 3.2 Sign contract

- `amount` je **vždy nezáporné**; znamienko nesie `type` (`'income' | 'expense'`).
- **Refundácia** = `income` riadok s `parentTransactionId`.
  Počíta sa do `totalIncome` (historické správanie appky), ale je reportovaná zvlášť
  (`refundsInCents`) a **vylúčená z `netIncome`**. Toto je jediná povolená definícia.
- `Math.abs()` na sume, ktorej znamienko je významné, je **bug**.

### 3.3 Time contract

- Mesiace sa buckujú **lokálne** (`getMonthKey` → `'2026-03'`), rovnako ako grafy v UI.
- Rozsah je **inkluzívny** na oboch koncoch (`gte` / `lte`), prvý aj posledný milisekundu mesiaca.
- Fixtures používajú **lokálny wall-clock** (`2026-03-02T10:15:00`, bez `Z`), aby bol výsledok
  rovnaký na každom CI runneri. UTC (`...Z`) formát z produkcie má vlastný test.
- `getMonthBounds('2026-13')` a `getMonthKey('not-a-date')` **hádžu `RangeError`** — nikdy tichý `Invalid Date`.

### 3.4 Locale / currency contract

- Kategórie sú **opaque stringy**. `shared/calculations.ts` ich nikdy neprekladá a nikdy neparsuje.
  Test preto nesmie asertovať `'Potraviny'` ako konštantu doménovej logiky, ale ako **dáta z fixtures**.
- `users.currency` je **symbol** (`'€'`, `'$'`), nie ISO kód. Fixture s `"currency": "EUR"` je nesprávna.
- Jazyky: `sk`, `en-us`, `es-pe` (viď `client/src/lib/dateUtils.ts:16-22`). Fixtures sú per-jazyk;
  prekladové varianty sa negenerujú strojovo, ale ukladajú sa ako samostatné golden súbory.

---

## 4. Layout repozitára

```
tests/
  fixtures/                      # golden dáta — ručne overené, commitnuté, nikdy generované AI
    transactions-march-2026.sk.json
  unit/                          # node env, žiadna DB, žiadna sieť (krok 1)
    money.test.ts
    calculations.test.ts
  integration/                   # Postgres (Neon branch) — guard cez DATABASE_URL_TEST (krok 4)
  ai/                            # nahraté OCR/LLM výstupy + deterministické parsery (krok 3)
  e2e/                           # Playwright (krok 5)
shared/
  money.ts                       # money contract
  calculations.ts                # čisté agregácie (summary, monthly, categories)
testing-blueprint/
  00-testing-strategy.md         # tento dokument
  01-financial-calculations.md   # hotové (krok 2) — blueprint + záznam implementácie
  02-receipt-ocr-ai.md           # krok 3
  03-voice-expenses.md           # krok 4
  04-pdf-and-banking-imports.md  # krok 4
  05-e2e-critical-flows.md       # krok 5
  06-observability-and-deploy.md # krok 6
  07-mini-error-tracker.md       # BLUEPRINT ONLY — own error tracker, not implemented
  reports/                       # výstupy live benchmarkov (nie v CI)
```

`vitest.config.ts` include: `tests/unit/**/*.test.ts`, `tests/integration/**/*.test.ts`.
`tests/e2e/**` a `external-services/**` sú z runnera vylúčené (majú vlastný lifecycle).

---

## 5. Pyramída pre Kaptiu (upravené pomery)

Pôvodný návrh hovoril 70/20/10. Pre **tento** repo to nie je realistické, pretože
až do kroku 1 neexistovala žiadna izolovaná logika — všetko bolo UI alebo SQL.
Cieľové pomery po kroku 4:

| Vrstva | Podiel | Čo tam patrí v Kaptii |
|---|---|---|
| Unit (pure) | ~60 % | `shared/money.ts`, `shared/calculations.ts`, `lib/merchantLearning.ts`, `lib/importHelpers.ts`, `server/mistralTransactionParser.ts` (deterministická časť), `lib/aiCostCalculator.ts` |
| Integration | ~25 % | `server/storage.ts` na Neon branchi, `GET /api/financial-summary`, `POST /api/transactions`, import bankových PDF, `scripts/audit-flows.ts` ako seed harness |
| E2E | ~15 % | 3 toky, nie 10: prihlásenie → pridať transakciu → číslo na dashboarde; voice → potvrdenie; export PDF |
| Produkcia | mimo | Sentry + syntetický check na `/api/health` (krok 6) |

**Prečo nie viac E2E:** Clerk + `/:lang/` prefix + SSR + country blocking robia z každého
E2E toku drahú a krehkú vec. Lacnejšie je mať 3 stabilné toky než 10 nestabilných.

---

## 6. Päť blueprintov — poradie a závislosti

| # | Blueprint | Závisí na | Prečo v tomto poradí |
|---|---|---|---|
| 01 | `01-financial-calculations.md` | krok 1 (hotový) | Najlacnejší, najrýchlejší, odhalí divergenciu server/klient. **Obsahuje aj prepájanie** UI na `shared/calculations.ts`. |
| 02 | `02-receipt-ocr-ai.md` | 01 (money contract) | Najväčšie riziko peňazí: OCR sumy. Dvojfázové: nahraté výstupy → parser. |
| 03 | `03-voice-expenses.md` | 01, 02 | Zdieľa money contract; deterministický post-processing testovateľný bez audia. |
| 04 | `04-pdf-and-banking-imports.md` | 01, 02 | Kontrakt externej PDF služby + parser bankových výpisov. |
| 05 | `05-e2e-critical-flows.md` | 01–04 | Až keď čísla sedia, má zmysel overovať, či ich UI zobrazuje. |

**Blocker, ktorý musí byť vyriešený pred 02:** `server/uploadReceipt.ts` nemá oddelenú
funkciu „text → dáta". Kým sa nevytiahne, test by musel volať Google Vision / Mistral.
Súčasťou blueprintu 02 je preto refaktor na `normalizeReceiptExtraction(raw)` (pure) +
`extractReceiptWithAI(ocrText)` (impure) — presne ako to špecifikuje `02-receipt-ocr-ai.md` §3.

---

## 7. Povinná šablóna blueprintu

Každý `testing-blueprint/0X-*.md` má presne týchto 7 sekcií. Bez výnimky, bez „úvodu do problematiky".

```markdown
## 1. Scope
Presné funkcie/endpointy v scope + zoznam toho, čo je VYLABOVANÉ mimo scope.
Príklad: "V scope: calculateFinancialSummary, groupTransactionsByMonth.
Mimo scope: PDF rendering, Stripe."

## 2. Contracts
Ktoré zmluvy zo sekcie 3 sa uplatňujú (money / sign / time / locale)
a čím sa tento modul od nich odchyľuje (ak vôbec).

## 3. Ground truth (fixtures)
Cesta k JSON + presný počet riadkov + ako boli dáta získané
(ručne / anonymizovaný reálny súbor / nahratý výstup providera).
NIKDY necommituj reálne meno, IBAN, adresu ani celé číslo karty.

## 4. Expected output
Presné hodnoty v `*InCents` / basis pointoch. Ak sa číslo nedá vyjadriť
integerom, používa sa `toBeCloseTo` s uvedením presnosti.

## 5. Edge cases (povinné minimum 6)
Nulová suma · chýbajúci dátum · neznáma mena · záporná refundácia ·
prázdne obdobie · DST prechod · duplicitný riadok · suma na hranici decimal(12,2).

## 6. Runner skeleton
Reálny (nie pseudokód) Vitest/Playwright kód, ktorý po vložení prejde.

## 7. Determinizmus
Ktoré externé závislosti sú mockované, ktorý model/provider je pinovaný,
a čo sa stane, keď provider zlyhá (fallback musí byť testovaný zvlášť).
```

---

## 8. AI / OCR / Voice — pravidlá, ktoré sa v tomto repe líšia od generického návodu

### 8.1 Provider musí byť pinovaný

`lib/aiProvider.ts` robí fallback medzi **openai → deepseek → groq → mistral**.
Ak benchmark nezafixuje providera a model, nameraná „accuracy" je bezcenná —
jeden beh môže ísť na `gpt-6-luna`, druhý na `deepseek-flash`.
Preto: každý AI test dostane `AI_PROVIDER` + `AI_MODEL` explicitne a do reportu zapíše,
kto reálne odpovedal (`lib/aiUsageTracker.ts` to už eviduje).

### 8.2 Dvojfázové testovanie (áno, presne ako v pôvodnom návrhu)

- **Fáza 1 (deterministická, v CI):** nahratý surový výstup uložíme ako
  `tests/ai/recorded/<provider>/<file>.json` **spolu s metadátami**:
  `{ provider, model, capturedAt, promptVersion, ocrSource: 'mistral' | 'vision' | 'ai-processor' }`.
  Testy parsujú tento súbor. Žiadne sieťové volanie, žiadne náklady.
- **Fáza 2 (live benchmark, scheduled):** 20–30 súborov, beží **mimo PR CI** (týždenne),
  produkuje report + trend. **Nezlyháva build.**
  Ak accuracy padne pod prah, vytvorí sa issue / e-mail, nie červený PR.

### 8.3 OCR nie je jedna cesta

`server/uploadReceipt.ts` má poradie **Mistral OCR → Google Vision fallback → (voliteľne) ai-processor**.
Záznam preto musí obsahovať `ocrSource`. Test pre jeden zdroj nesmie predstierať, že pokrýva druhý.
Navyše upload je **plan-gated** (`getUserPlan`) — integračný test musí nastaviť plán používateľa.

### 8.4 Voice: testuj najprv deterministickú časť

`server/mistralTransactionParser.ts` obsahuje ručné korekcie (napr. oprava španielskych súm).
To je **pure logika** a patrí do unit testov skôr než LLM. Až potom frázová matica (100+ viet)
proti `voiceExtraction` / `parseTransactionWithGroq` / `parseTransactionWithMistral`
— pre každý provider zvlášť, lebo výstupy sa líšia.

### 8.5 Audio

Pre STT stačia 3 krátke vzorky (`tests/ai/audio/*.m4a`) v samostatnom opt-in teste,
ktorý sa v CI nespúšťa (`RUN_AUDIO_TESTS=1`). Whisper/Groq je platené a nedeterministické.

---

## 9. PDF — čo je v Kaptii iné

Pôvodný návod hovoril „vygeneruj PDF do buffera a parsuj `pdf-parse`". V Kaptii to nestačí:

| Cesta | Ako testovať |
|---|---|
| Externá služba `pdf-processor.formatika.dev` (`server/pdfProcessorClient.ts`) | **Kontrakt payloadu**: mock HTTP, assert presného JSON telohlavičky (`userData`, `transactions`, `currency` ako symbol) + 1 opt-in smoke proti reálnej službe |
| `server/pdfGenerator.ts` (puppeteer) | render → `pdf-parse` → assert text + diakritika `č, š, ž` + menový symbol |
| `@react-pdf/renderer` / `pdf-lib` | len ak sa použijú; dnes nie sú primárna cesta |

Pravidlo: **`pdf-parse` je dôkaz o našom rendereri, nie o cudzom.** Font subsetting
a encoding v externej službe nám nepatria do testu — tam testujeme kontrakt.
`pdf-parse@1.1.1` je zároveň starý package citlivý na ESM (`"type": "module"`), takže
import patrí do samostatného testovacieho súboru, nie do globálneho setupu.

---

## 10. E2E — špecifické prekážky tohto projektu

| Prekážka | Riešenie |
|---|---|
| Clerk auth | Testovacia Clerk instancia + e-maily s `+clerk_test` (kód `424242`). **Nikdy** produkčný Clerk. |
| `/:lang/` prefix v každej URL (59 route v `client/src/App.tsx`) | Playwright `baseURL` + konštanta `LOCALE_PREFIX = '/sk'`; test nikdy nehardkóduje cestu bez prefixu |
| SSR (`server/ssr.ts`, 43 KB) | `waitForLoadState('networkidle')` až po hydratácii; asserty na text, nie na hydration markery |
| `countryBlockingMiddleware` (`server/middleware/countryBlocking.ts`) | CI runner môže dostať 403 podľa geo IP. V test prostredí vypnúť (env flag) alebo používať self-hosted runner v EÚ |
| Žiadny rate limiting v appke | dnes to nie je problém; ak sa pridá, E2E musí mať vlastný bucket |
| Video/screenshot pri páde | `trace: 'on-first-retry'`, `video: 'retain-on-failure'` do `test-results/` |

Povolené toky (max 3): prihlásenie → pridať transakciu → overiť číslo na dashboarde;
voice → potvrdenie formulára; export PDF → súbor sa stiahol a má > 0 bajtov.

---

## 11. Izolácia databázy

- **Nikdy** `DATABASE_URL_PROD`, ani na čítanie.
- Integračné testy bežia len ak je nastavené `DATABASE_URL_TEST`; inak sa `describe.skip`
  s hláškou „set DATABASE_URL_TEST to run integration tests" (nie tiché preskočenie).
- Odporúčaný model: **Neon branch** (`staging` branch → vetva na PR).
  Dôvod: `scripts/audit-flows.ts` robí reálne `INSERT` aj `deleteUserCompletely`,
  takže proti zdieľanej DB by vedel zmazať cudzie dáta.
- `scripts/audit-flows.ts` je legitímny **seed + assert harness**. Zachovať jeho guard
  (`NODE_ENV === 'production'` → exit 1) a doplniť guard na `DATABASE_URL_TEST`.
- Fixtures pre integračné testy sa vkladajú cez `storage` vrstvu (nie surovým SQL),
  aby sa uplatnila aj šifra popisov (`DataEncryption`). Sumy šifrované nie sú
  (`server/storage.ts` — komentár „amount stays as numeric - NOT encrypted"),
  takže money fixtures sú priamo použiteľné.

---

## 12. Observability a PII

Sentry dnes **nie je nainštalovaný** — toto je nová práca, nie „best practice, ktorú už máme".

Pravidlá, bez ktorých Sentry v tomto projekte nenasadiť:

1. `sendDefaultPii: false` + `beforeSend` scrubber.
2. **Zakázané polia v breadcrumbs/events:** `description`, `referenceNote`, `ocrText`,
   `email`, `phone`, `stripeCustomerId`, akýkoľvek text prepisu hlasu.
   Dôvod: `server/groqClient.ts` dnes loguje prvých 100 znakov prepisu a
   `server/routes/transactionRoutes.ts:296` loguje celý finančný summary.
   Bez scrubbera by Sentry dostal transkripty a financie používateľa.
3. Frontend: `beforeBreadcrumb` filtruje fetch URL s query parametrami.
4. Synthetic monitoring: `GET /api/health` (`server/routes/index.ts:43`) každých 15 min
   z **EÚ regiónu**, alert cez `server/emailService.ts` (SendGrid/SMTP).
   Slack v projekte nie je — nezavádzať ho kvôli alertom.

---

## 13. CI/CD

Dnes `.github/` neexistuje, takže „build zlyhá" nebolo možné. Krok 1 pridáva
`.github/workflows/test.yml` s bránami v tomto poradí:

1. `npm ci`
2. `npm run check` (tsc — **testy sú súčasťou**)
3. `npm run test` (unit, bez DB a bez API kľúčov)
4. `npm run build`

Integračné testy (krok 4) pribudnú ako samostatný job s `DATABASE_URL_TEST` a Neon branchou;
E2E (krok 5) ako tretí job s Playwright image.

**Live AI benchmark sa do CI nepridáva nikdy.** Maximálne scheduled workflow s `continue-on-error`.

`deploy-prod.sh` dnes spúšťa `NODE_ENV=production npm run dev` — kým sa to nezmení na
`npm run build && npm start`, žiadna testovacia brána reálne nechráni produkciu.

---

## 14. Krok 1–6 — čo je hotové (a čo zámerne nie)

### Pridané súbory

| Súbor | Obsah |
|---|---|
| `vitest.config.ts` | node env, include `tests/unit` + `tests/integration`, exclude `external-services`, `tests/e2e` |
| `shared/money.ts` | money contract: `parseAmountToCents`, `sumAmountsToCents`, `centsToDecimalString`, `assertCents`, `shareOfTotalInBasisPoints`, `percentOrZero` … |
| `shared/calculations.ts` | `calculateFinancialSummary`, `groupTransactionsByMonth`, `groupByCategory`, `pickTopExpenseCategory`, `percentChange`, `getMonthKey`, `getMonthBounds`, `filterByDateRange` + UI wrappers `sumTransactionAmounts*`, `sumAmountsByCategoryName`, `sumAmountsByMonthKey` |
| `tests/fixtures/transactions-march-2026.sk.json` | golden dataset: 15 výdavkov, 3 príjmy, 1 refundácia, 2 februárové riadky, očakávané hodnoty v centoch |
| `tests/unit/money.test.ts` | 20 testov money contractu |
| `tests/unit/calculations.test.ts` | 34 testov agregácií + edge cases + UI wrappers |
| `shared/receiptExtraction.ts` | pure OCR normalizácia (amount → centy, dátumy bez `Date()` pasce, vendor) + regex fallbacky |
| `server/receiptExtraction.ts` | jediné AI volanie (`extractReceiptWithAI`) + legacy wrapper |
| `server/ocr.ts` | Mistral OCR → Google Vision fallback, oba injectable (testy bez kľúčov) |
| `shared/aiFixture.ts` | validátor recorded fixtures + ochrana proti falošnej proveniencii |
| `scripts/capture-ai-fixture.ts` | `npm run capture:ai` — zapíše validovaný fixture, len s `--yes` |
| `scripts/benchmark-ocr.ts` | `npm run benchmark:ocr` — live accuracy report, nikdy v CI |
| `tests/unit/receiptExtraction.test.ts` | 24 testov OCR normalizácie |
| `tests/unit/ocr.test.ts` | 11 testov provider kontraktu + fallback reťazca |
| `tests/unit/aiFixture.test.ts` | 10 testov schémy fixtures |
| `tests/ai/receiptReplay.test.ts` | 18 testov replay + plumbing AI volania |
| `shared/voiceParser.ts` | pure hlasový parser (`now` injectable, `amountInCents`, `needsReview`) |
| `shared/voiceCorrections.ts` | deterministické opravy španielskych čísloviek |
| `tests/fixtures/voice-phrases.{sk,en,es}.json` | 41 viet s očakávaniami |
| `tests/unit/voiceParser.test.ts` | 61 testov (matica + regresie) |
| `tests/unit/voiceCorrections.test.ts` | 9 testov |
| `tests/unit/pdfProcessorClient.test.ts` | 15 testov (kontrakt PDF služby + payload buildery) |
| `playwright.config.ts` | E2E konfigurácia (2 projekty, trace/video, locale/timezone pinning) |
| `tests/e2e/**` | `add-expense.spec.ts`, `voice-parse.api.spec.ts`, `export-pdf.spec.ts` (fixme), podporné helpery + README |
| `client/src/pages/expenses.tsx` | `data-testid` hooky pre E2E (`add-expense`, `save-expense`, `expenses-total`) |
| `shared/piiScrubber.ts` | redakcia polí a vzorov pred odoslaním do Sentry |
| `shared/healthcheck.ts` | pure vyhodnotenie health odpovede |
| `server/observability.ts` | server Sentry (dynamický import, `dataCollection` off, scrubované hooky) |
| `client/src/lib/observability.ts` | klientsky Sentry (gated na `VITE_SENTRY_DSN`) |
| `scripts/healthcheck.ts` | `npm run healthcheck` — cron monitor, exit 0/1, `--json` |
| `deploy-prod.sh` | prepísaný deploy gate (testy a build pred migráciou) |
| `tests/unit/piiScrubber.test.ts` | 20 testov |
| `tests/unit/healthcheck.test.ts` | 11 testov |
| `shared/duplicateDetection.ts` | pure detekcia duplikátov (extrahované z `lib/pdfProcessor.ts`) |
| `tests/unit/duplicateDetection.test.ts` | 16 testov |
| `tests/unit/legacyEquivalence.test.ts` | 5 testov — stará `parseFloat` cesta vs nová, rovnaké čísla |
| `tests/integration/financialSummary.integration.test.ts` | reálna DB cez `DATABASE_URL_TEST` (bez nej skip) |
| `tests/e2e/support/pdf-stub-server.ts` + `tests/e2e/global-setup.ts` | lokálny stub PDF služby pre E2E-3 |
| `tests/ai/README.md` | formát fixtures, privacy pravidlá, capture a benchmark postupy |
| `testing-blueprint/00…05` | stratégia + 5 blueprintov |
| `.github/workflows/test.yml` | typecheck → unit testy → build |
| `package.json` | `test`, `test:watch`, `test:unit` |
| `tsconfig.json` | `tests/**/*` v `include`, `**/*.test.ts` odstránené z `exclude` |

### Overenie (lokálne)

```bash
npm run test     # 313 passed | 3 skipped (14 files) ~10 s
npm run check    # tsc --noEmit, čisté
npm run build    # vite + esbuild, exit 0
grep -rn "+ parseFloat(\|reduce((sum.*parseFloat" client/src   # 0 zásahov
```

### Napojené na produkčný kód (krok 2)

`server/storage.ts` (`getUserFinancialSummary` → centy + `*InCents`), `server/routes/transactionRoutes.ts`,
`expenses.tsx`, `income.tsx`, `transactions.tsx`, `trends.tsx`, `calendar.tsx`, `budget.tsx`,
`ai-insights.tsx`, `quick-financial-snapshot.tsx`, `trends-chart.tsx`, `budget-overview.tsx`,
`financial-health-score.tsx`, `export-tools.tsx`. Detail: `01-financial-calculations.md` §8.

### Čo krok 2 ZÁMERNE nerobí

- `parseFloat(formData.amount)` vo formulároch **zostáva** — ide o jeden vstup, nie o akumuláciu.
- `expense-prediction.tsx` a `interactive-chart.tsx` sa nemenili: pracujú s číslami z AI odpovede /
  props, nie s peňažnými stringmi.
- Žiadny integračný test `getUserFinancialSummary` — vyžaduje Neon branch (krok 4).

---

## 15. Roadmap a acceptance criteria

### Krok 2 — `01-financial-calculations.md` + prepájanie — **HOTOVO**

- [x] `getUserFinancialSummary` počíta cez `shared/money.ts` (`sum()` ostáva, konverzia cez `parseAmountToCents`) + vracia `*InCents`
- [x] Dashboard / expenses / income / trends / calendar / budget čítajú z jedného zdroja
- [x] CI gate: `grep -rn "+ parseFloat(\|reduce((sum.*parseFloat" client/src` = 0
- [ ] Golden testy pre EN dataset (druhý fixture súbor) — **zostáva**
- [ ] Existujúce čísla sa nezmenili — dôkaz: export JSON pred/po na rovnakom fixturi — **zostáva**

### Krok 3 — `02-receipt-ocr-ai.md` — **HOTOVO** (s jednou výhradou)

- [x] `normalizeReceiptExtraction(raw)` + `extractReceiptWithAI(ocrText)` vyextrahované z `server/uploadReceipt.ts`
      (pure časť v `shared/receiptExtraction.ts`, AI volanie v `server/receiptExtraction.ts`, `uploadReceipt.ts` **356 → 157** riadkov)
- [x] OCR providery vyextrahované do `server/ocr.ts` (Mistral → Vision fallback, oba injectable)
- [x] Deterministické testy: `receiptExtraction` (24), `ocr` (11), `aiFixture` (10), `receiptReplay` (18)
- [x] Odhalené 2 reálne bugy: `Number('1.234,56')` → `NaN` (suma sa ticho zahodila) a `new Date('12.03.2026')` → **3. december** namiesto 12. marca
- [x] 9 fixtures s metadátami (`tests/ai/recorded/**`) + validátor `shared/aiFixture.ts`, ktorý nedovolí falošnú provenienciu
- [x] `scripts/capture-ai-fixture.ts` (`npm run capture:ai`, vyžaduje `--yes`, odmieta produkciu)
- [x] `scripts/benchmark-ocr.ts` (`npm run benchmark:ocr`, per-field accuracy + report, nikdy v CI)
- [ ] **Reálne zachytenie** 20–30 dokumentov — vyžaduje API kľúče a bločky; fixtures sú zatiaľ `source: "synthetic"`

**Mimo scope kroku 3 (dôvod):** `categorizeExpense` sedí v 82 KB `server/openai.ts` s DB závislosťami — potrebuje vlastnú extrakciu; multer handler (limit veľkosti, plan gate, cloud upload) patrí do integračných testov kroku 4.

### Krok 4 — `03-voice-expenses.md`, `04-pdf-and-banking-imports.md` — **ČIASTOČNE HOTOVO**

**Voice — hotovo:**
- [x] `parseVoiceInput` vyextrahovaný do `shared/voiceParser.ts` (pure, `now` injectable), route **214 → 92** riadkov
- [x] `applyAmountCorrections` vyextrahované do `shared/voiceCorrections.ts` a otestované (9 testov)
- [x] Frázová matica SK/EN/ES — **41 viet** (cieľ 100+) + 61 testov, deterministické, bez audia
- [x] 2 bugy: „zaplatil" sa klasifikoval ako **income** (`includes('plat')`); „dnes" o 00:30 dávalo včerajší dátum
- [x] 100 viet (SK 50/EN 30/ES 20) · [ ] audio smoke test (chýbajú `.m4a` vzorky)

**PDF — hotovo:**
- [x] Kontrakt `pdfProcessorClient.ts`: request, hlavičky, `AbortSignal`, návratový `Buffer`
- [x] Chybové stavy 401 / 403 / 500 / unreachable / timeout → `PdfProcessorError(502)`, `details` ≤ 500 znakov
- [x] Pure payload buildery (`buildTrendsPayload`, `buildMonthlyPayload`) — 15 testov

**PDF — zostáva:**
- [ ] Anonymizované bankové výpisy (Tatra, SLSP, VÚB, Revolut) — v repe neexistujú
- [x] Duplicate detection: `detectDuplicateTransactions` + similarity helpers vyextrahované do `shared/duplicateDetection.ts`, 16 testov
- [ ] Integračné testy proti Neon branchi (`DATABASE_URL_TEST`)
- [ ] Puppeteer + `pdf-parse` roundtrip a opt-in smoke `RUN_PDF_SMOKE=1`

### Krok 5 — `05-e2e-critical-flows.md` — **HARNESS HOTOVÝ, BEH NIE**

- [x] `playwright.config.ts` (2 projekty, trace/video/screenshot, locale + timezone pinning)
- [x] `tests/e2e/support/env.ts` — gate, locale `path()`, `monthRange()`, `fetchSummary()` (cent oracle)
- [x] `tests/e2e/pages/expenses-page.ts` + `data-testid` hooky (`add-expense`, `save-expense`, `expenses-total`)
- [x] E2E-1 `add-expense.spec.ts` — 50,00 € → API delta **5000**, dvojklik → presne jeden riadok
- [x] E2E-2 `voice-parse.api.spec.ts` — HTTP level (centy, typ, `needsReview`, prázdny transcript → 400)
- [x] `npx playwright test --list` → **9 testov / 3 súbory**; `tsc` čisté; vitest nezasiahnutý (202)
- [x] E2E-3 PDF export — stub server (`tests/e2e/support/pdf-stub-server.ts`) + `globalSetup`, test ide cez reálny server
- [ ] **Reálny beh** — chýba Clerk test instancia + seeded testovací používateľ (`E2E_ENABLED=1`)

### Krok 6 — `06-observability-and-deploy.md` — **HOTOVO (kód), aktivácia na tebe**

- [x] `shared/piiScrubber.ts` + 20 testov — mená polí, e-maily, IBAN, karty, telefóny, hĺbka/array capy
- [x] `server/observability.ts` + `client/src/lib/observability.ts` — Sentry s `dataCollection` off a scrubovanými hookmi
- [x] `server/index.ts` — init pred routami, Sentry handler pred vlastným, **odstránené `throw err` po odpovedi**
- [x] `GET /api/health/deep` — `SELECT 1`, 503 bez úniku detailov
- [x] `shared/healthcheck.ts` + `scripts/healthcheck.ts` + 11 testov, `npm run healthcheck`
- [x] `deploy-prod.sh` prepísaný: `--yes` guard, testy a build **pred** migráciou, voliteľný `pg_dump`
- [x] `DISABLE_COUNTRY_BLOCKING` reálne implementovaný (v produkcii ignorovaný)
- [ ] Sentry **DSN** + projekt (nedá sa vytvoriť z kódu)
- [ ] cron/systemd timer pre `npm run healthcheck -- --deep` (beží na serveri, nie tu)

---

## 16. Zakázané praktiky (anti-patterns)

1. `expect(summary.totalExpenses).toBe(1420.50)` — float equality na peniazoch.
2. Live AI volanie v PR CI.
3. Test proti produkčnej DB (aj read-only).
4. `as any` na obídenie typu transakcie v novom kóde testov.
5. Fixture vygenerovaná AI bez ručného overenia — potom testujeme halucináciu.
6. `Math.abs(amount)` v novej logike; znamienko patrí do `type`.
7. Hardkódovaná slovenská kategória ako doménová konštanta (patrí do fixtures).
8. Nová závislosť (`msw`, `jsdom`, `faker`) bez konkrétneho use-case v tom istom PR.
9. `--force` / `--legacy-peer-deps` pri inštalácii test tooling (zamaskuje konflikt,
   ktorý sa vráti pri ďalšom upgrade). Rieši sa pinovaním verzie, ako pri Vitest 3.

---

## 17. Stav po kroku 6 — čo je hotové a čo nie

| Oblasť | Stav | Ak treba akciu, koho |
|---|---|---|
| Unit + replay testy | ✅ **313 testov** / 13 súborov (+3 integračné skip), bez DB, bez kľúčov, bez siete | — |
| Money & agregácie (krok 1–2) | ✅ napojené, 0× `parseFloat` akumulácia | — |
| OCR (krok 3) | ✅ normalizácia + provider kontrakt + capture/benchmark skripty | reálne fixtures = majiteľ kľúčov |
| Voice (krok 4) | ✅ parser + **100 viet** (SK 50/EN 30/ES 20) + corrections | 3 audio vzorky |
| PDF klient (krok 4) | ✅ kontrakt + 6 chybových stavov | — |
| Bankové importy | 🟡 duplicate detection ✅ (16 testov); samotné parsovanie ⛔ | anonymizované PDF (Tatra/SLSP/VÚB/Revolut) |
| E2E harness (krok 5) | ✅ 9 testov listovaných, **E2E-1/2/3 implementované** (E2E-3 so stub serverom) | Clerk test instancia + seeded DB na beh |
| Observability (krok 6) | ✅ kód + 31 testov, PII scrubber | Sentry DSN + projekt |
| Syntetický monitoring | ✅ skript + `/api/health/deep` | cron/systemd na serveri |
| Deploy gate | ✅ `deploy-prod.sh` prepísaný | spustenie na serveri |
| Integračné testy (Neon branch) | ✅ harness hotový, bez `DATABASE_URL_TEST` skipuje s hláškou | Neon branch + `DATABASE_URL_TEST` |
| Equivalence (krok 2) | ✅ stará `parseFloat` vs nová cesta na tom istom fixtures | — |

**Zásada do budúcna:** každý nový bug v peniazoch → najprv test v `tests/unit`, potom fix.
Každá nová AI cesta → recorded fixture, nie live volanie v CI.
