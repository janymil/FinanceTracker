# Kaptia — Implementation plan for 19 new functions

**Status:** draft for the product owner. Nothing here is built yet.
**Scope:** every idea from the brainstorming session, plus the full subscription manager.
**Assumption:** one developer working with the owner's review, roughly 5–6 months end to end.

---

## How to read this

Each phase is written as one short block for the owner ("what the customer gets") and one technical
block for the build ("what changes"). The technical block is what a developer needs: tables, screens,
rules, tests, and the traps that will bite.

Every phase ends with:

- **Size** — S (2–3 days), M (3–5), L (5–8), XL (10–14).
- **Done when** — the sentence that has to be true before it ships.
- **Depends on** — what must exist first.

---

## The one-page version

| # | Phase | What the customer gets | Size |
|---|---|---|---|
| 1 | Accounts and wallets | "How much money do I actually have, and where?" | L |
| 2 | Transfers recognised | Moving money between your own accounts stops counting as spending | M |
| 3 | A month that starts on payday | The month matches how they are actually paid, including irregular income | M |
| 4 | **Subscriptions** | Every subscription, its price history, next payment, and what it costs per year | XL |
| 5 | Debts | What the debt really costs and one order to pay it off | L |
| 6 | Fast capture | Cash in two taps, a pasted payment notice becomes a transaction, works offline | L |
| 7 | Shared household money | Two people, one book: shared budgets, who paid, who owes whom | XL |
| 8 | Multi-currency | A dollar pot with the real rate on the day, gain or loss in soles | L |
| 9 | Ask your own data | "How much did I spend in Cusco in March?" with the rows behind the answer | L |
| 10 | Receipts by item | "Your basket costs 12% more than in June" — personal inflation | L |
| 11 | The watchdog | "Electricity is 40% above your usual" — the day it happens | M |
| 12 | What-if | "If I cut restaurants 30%, the laptop arrives in September" | M |
| 13 | Negotiation helper | The message to send to keep a bill down, and the saving recorded | S–M |
| 14 | Tax helper (Peru, then Slovakia) | Deductible expenses collected, deadline warned, limit shown | L |
| 15 | Retention layer | Weekly digest, wait-before-you-buy, lessons linked to tools | M |

Order matters for two reasons only: **accounts** must come first because everything else measures
money *somewhere*, and **subscriptions** must come before the subscription hunter, the watchdog's bill
alerts and the negotiation helper, because all three read it.

Rough total: **75–100 working days**. That is 5 months of focused work, or 6 with review time. The
release plan in section 6 spreads it over nine releases so each one is worth announcing.

---

## 1. What exists today

So this plan does not rebuild what is already there.

**Money in and out:** transactions (income/expense, with receipt image and OCR text attached),
categories, merchant learning, recurring transactions, bill reminders, budgets by category and period,
goals, shared goals with friends, contributions, goals chat.

**Looking at it:** dashboard (score, adviser, snapshot, budgets, breakdown), transactions, expenses,
income, reports, trends, expense prediction, spending insights, streaks, achievements, courses.

**Getting money in:** manual entry, voice, receipt photo with OCR, bank statement import, mobile
upload by QR from the phone.

**Around it:** three languages, three plans, AI quotas per plan, admin analytics, complaints book
(Peru), export to CSV and PDF, encrypted text fields.

### The four structural gaps this plan closes

1. **There are no accounts.** One balance for everything. The app cannot answer "how much do I have in
   the bank" because it does not know there is a bank.
2. **A transfer is counted twice.** Moving money between your own places is stored as an expense plus
   an income, so every total, chart, budget and the health score are overstated.
3. **The month is always the calendar month**, while many people are paid on the 15th or by the job.
4. **One currency per person**, with a single field, so a dollar saving cannot exist next to soles.

Everything in section 2 and 3 is built on top of these four.

---

## 2. Ground rules for every phase

These are not optional extras; they are how this app is already built and kept honest.

- **Schema first.** `shared/schema.ts` → `npm run db:generate` → read the SQL → `db:migrate:prod` →
  deploy. The deploy refuses code whose tables or columns production does not have yet.
- **Text is encrypted at rest.** Names, descriptions and notes go through the storage layer, never raw
  SQL. Any new text column must use the same helpers.
- **Three languages, always.** Every new string lands in `en-us`, `es-pe`, `sk-sk`. No English leaking
  into a Spanish screen.
- **Every panel explains itself.** A `?` help tooltip on anything that shows a number the customer
  could misread (convention is in `CLAUDE.md`).
- **Money is summed in cents**, never with floating point. Amounts are `decimal(12,2)` in the database
  and converted once, at the edge.
- **The app computes, the model writes.** Any AI sentence that contains a figure gets that figure from
  the server. A model that invents a number is a failed answer.
- **One advice surface.** Advice lives in the adviser only. Everything else that speaks is an *alert*
  about a fact (section 3, phase 11) — not a second opinion.
- **A refusal is not an empty result.** A panel that could not load says so and offers to retry; it
  never shows "nothing to show" for a request that failed.
- **Plan gates are decided before the screen is built**, not after (section 5).

---

## 3. The phases

### Phase 1 — Accounts and wallets · Size L · Nothing depends on it, everything depends on it

**What the customer gets.** A screen called *Where my money is*: cash in the wallet, the bank account,
the Yape balance, the savings pot. Each with its own balance, and one total. When they add a
transaction they pick where it happened, and that becomes the default next time.

**Why first.** Every other phase in this document measures money *somewhere*. Without accounts, phase
7 (multi-currency) has nothing to attach a currency to, phase 6 (cash) has no pot to reconcile, and
phase 7 (household) cannot say whose bank the money left from.

**What changes.**

```
accounts
  id, user_id
  name                     "BCP soles", "Efectivo", "Yape"
  kind                     cash | bank | wallet | savings | credit
  currency                 PEN, USD, EUR
  opening_balance          decimal(12,2)   — the day the person started using the app
  opened_on                date            — for the chart, not for the maths
  is_archived              boolean
  display_order            integer
  created_at, updated_at

transactions.account_id    integer null   — null during migration only, then backfilled
transfers
  id, user_id
  from_account_id, to_account_id
  amount, currency
  fee                      decimal(12,2) default 0   — a transfer that costs 3 soles
  date, note
  source                   manual | suggested | imported
  created_at
```

**Rules that must be written down, because they are where this feature goes wrong.**

- A **transfer moves money and changes no total**. It is neither income nor expense. It does not touch
  budgets, the health score, the adviser, or the category charts.
- A transfer **with a fee** writes two rows: the transfer, plus a small expense in a "Bank fees"
  category. The fee is real spending; the transfer is not.
- **A credit account is allowed to be negative.** Its balance is what is owed, and it links to phase 5.
- **Opening balance is not income.** It sets where the person starts; it never appears in a month's
  totals.
- Deleting an account with history is not allowed. It is **archived**: hidden from the picker, still in
  old reports. Deleting is offered only for an account with no transactions.
- One account is the default for new transactions (`users.default_account_id`), set automatically the
  first time an account is created.

**Migration of existing data (one-time, in this order).**

1. Create one account per existing user: name "Main account", kind `bank` if the user has income
   entries, `cash` otherwise, currency = the user's current `currency` field.
2. `update transactions set account_id = <that account> where user_id = …`.
3. Make the column `not null` only after the backfill is verified. Two migrations, not one.
4. `budgets`, `goals` and `shared goals` are untouched in this phase.

**Screens.** Accounts list with balances and a total; account detail (balance, this month in and out,
recent rows); a picker in the add-transaction form and the import flow; "Move money" as a first-class
action next to "Add expense" and "Add income".

**Endpoints.** `GET/POST /api/accounts`, `PATCH/DELETE /api/accounts/:id`, `POST /api/transfers`,
`GET /api/accounts/:id/summary`. All behind `isAuthenticated`; accounts are visible on every plan
(money location is not a premium feature — hiding it would make the free plan's numbers wrong).

**Traps.**

- Every existing query that sums transactions for a *month* must now decide whether it means "spending"
  (expense only), "income", or "movement". A transfer must be excluded from the first two.
- `GET /api/financial-summary` feeds the score, the adviser, the charts and the export. It is the
  single riskiest place in this phase: change it once, carefully, with tests.
- The export (CSV/PDF) gains an account column; the accountant will ask for it.

**Done when.** A user with three accounts sees a total that equals the sum of their balances, a
transfer leaves every total unchanged, and the twelve-month history of an existing user is identical
before and after the migration.

---

### Phase 2 — Transfers recognised, not entered · Size M · Depends on phase 1

**What the customer gets.** The app finds the pairs the person already entered by hand — 500 out on
Tuesday, 500 in on Tuesday, same person, opposite directions — and offers, in one place,
*"these two look like a transfer; join them?"*. Accept all, and last month's inflated totals correct
themselves.

**Why it is not a small feature.** Existing users have months of history where transfers were recorded
as income and expense. Without this, their reports keep lying even after phase 1 ships, and they will
not fix it by hand.

**How the match is proposed (computed, not guessed).**

```
score = amount equal (100) or within 1% (60)
      + dates within 3 days
      + descriptions share a word, or one is empty
      + both were not already part of a transfer
```

Pairs above a threshold appear in a review list; nothing is joined without the person accepting it.
The AI is used only to write the one-line reason and to say "this looks like a withdrawal to yourself".

**Also in this phase:** a one-time *history repair* screen that shows what would change
("your March expenses drop from 2,140 to 1,640") before anything is applied. Run it per user, on
demand — never silently.

**Done when.** A March with a 500 transfer, once repaired, shows the same expenses on the dashboard,
the reports, the health score and the export, and the change is visible before it is applied.

---

### Phase 3 — A month that starts on payday · Size M · Depends on phase 1

**What the customer gets.** One setting: *"my month starts on the 15th"*. From then on the dashboard,
budgets, reports and the adviser all describe the 15th to the 14th — which is the month the person
actually lives in. For someone paid by the job, a second setting: *"my income is irregular"*, and the
app stops pretending there is a salary and starts showing a buffer.

**Why it is cheap and important.** One setting fixes the most common complaint about every budget app:
half a salary in one month, then a spike. The work is not the setting, it is making *every* period
calculation read from one place instead of four.

**What changes.**

```
users.pay_cycle_start_day      integer default 1      — 1..28
users.income_style             'fixed' | 'irregular'  default 'fixed'
users.buffer_target_months     numeric default 1      — how many quiet months to cover
```

**The one function.** Today period maths lives in several helpers (`presetRange`, `rangeStartFrom`,
`healthPeriod`, the client's date utilities, the dashboard's month switching). This phase introduces a
single server-side `periodFor(user, requestedRange)` and a matching client helper, and rewires the
health score, budgets, reports, insights, export and the adviser to it. Any place that still builds a
calendar month by hand is a bug in this phase.

**Irregular income.** With `income_style = 'irregular'` the dashboard shows *"you can safely take
X this month"*: the last six months of income, smoothed, minus fixed costs, with the buffer held back.
It is deliberately conservative and it says so in one line, with a `?` that explains the calculation.

**Done when.** Changing the day to the 15th changes every screen at once, the monthly totals of the
*first* month after the change are marked as partial, and the score for a shifted month is the same as
the score the adviser sees.


---

### Phase 4 — Subscriptions · Size XL · Depends on phases 1 and 3

This is the big one, and it contains a product decision: the app already has three overlapping ideas —
recurring transactions (rows created on a schedule), bill reminders (a due date and a nudge), and now
subscriptions. **The plan is not to add a fourth.** Subscriptions become the place the customer thinks
about repeating charges; the other two keep their jobs underneath.

| Concept | Keeps doing | Relationship |
|---|---|---|
| Subscriptions | the customer's list: what it is, what it costs, when it started, when it charges, when it ends | new — the front door |
| Recurring transactions | creates the row on the day, so nothing is forgotten | a subscription may own one (`subscription_id`) |
| Bill reminders | a due date for something that varies (rent, electricity) | unchanged; subscriptions do not replace variable bills |

**What the customer gets.**

- One screen: every subscription, the next payment date, the monthly and yearly total, and a strip of
  *what goes out in the next 14 days*.
- Each subscription: when it started, what it has cost over time, when it renews, when a free trial
  turns into a charge, and when it ends (or "never").
- "I cancelled it" — the app records the end date, stops forecasting and asks for the last charge, so
  the list matches reality.
- A small built-in catalogue — Netflix, Spotify, Disney+, Max, Prime, YouTube, Apple, Google, iCloud,
  Office, Adobe, ChatGPT, Canva, Duolingo, gyms — so adding one is two taps and the name is spelled the
  same way every month. That is what makes the total trustworthy later.

**What changes.**

```
subscriptions
  id, user_id
  account_id               where it is charged
  category_id              what it counts as
  name                     "Netflix"                 (customer-facing, editable)
  merchant_key             normalised vendor key     "netflix"
  plan_label               "Premium 4K"
  amount                   decimal(12,2)
  currency                 PEN | USD | EUR
  billing_cycle            weekly | monthly | quarterly | yearly
  anchor_day               integer null   — day of month, for monthly
  anchor_date              date null      — exact date, for yearly or quarterly
  started_on               date
  trial_ends_on            date null
  ends_on                  date null      — a known end, or null when open-ended
  status                   active | paused | trial | cancelled | ended
  auto_renew               boolean default true
  creates_transactions     boolean default true
  reminder_days_before     integer default 2
  payment_url              text null
  shared_with              integer null   — how many people use it
  notes                    text null      (encrypted)
  created_at, updated_at

subscription_prices        — the price history, one row per change
  id, subscription_id, amount, currency, valid_from, source (manual | detected), created_at

recurring_transactions.subscription_id   integer null
transactions.subscription_id             integer null   — which charge this was
```


**The rules, written down before the code.**

- **A subscription is a plan, not a payment.** Netflix costs 44.90 a month; the payments are charges
  against it. Cancelling never deletes history.
- **Next payment is computed**, never stored: `billing_cycle` + anchor. Pausing stops it; resuming
  recalculates from the resume day.
- **A monthly figure for a yearly subscription** is `amount / 12`, always shown with "≈", because it is a
  smoothing and not a charge. The yearly total is exact.
- **A trial is a subscription** with `status = trial` and `trial_ends_on`. The alert before it becomes a
  charge is the whole point of tracking it.
- **Price changes are history, not edits.** A charge with a different amount proposes a new
  `subscription_prices` row. Old months keep their old price, so "what did this cost me over two years"
  stays true.
- **Deleting** is only for a subscription created by mistake and never charged; everything else is
  cancelled or ended.
- **Currency lives on the subscription**, not only on the account, so a dollar subscription on a soles
  card keeps both numbers.
- **Cost per person**: with `shared_with` set, the detail shows the split ("44.90 for 4 people =
  11.23 each"). Small, and most apps do not do it.

**How subscriptions are found (this is where the AI earns its place).**

1. **Detected from history.** Group past transactions by normalised merchant name and look for a
   repeating amount on a repeating gap (28–31 days, 7 days, 3 months, 12 months). Two occurrences is a
   *suggestion*; three is a strong one. The suggestion list says what it found and how confident it is.
2. **Name normalised.** "NETFLIX.COM 8441", "Netflix Lima" and "NFLX" become one `merchant_key`. This is
   a small dictionary plus the model for the unknown ones; the dictionary is the part that makes totals
   correct, and it grows as the app sees more.
3. **Price changes detected.** When a charge for a known subscription arrives at a different amount, the
   app asks once: *"Netflix went from 39.90 to 49.90 — update the price?"* — and keeps the history.
4. **Duplicate and dead detection.** Two subscriptions on the same `merchant_key`, or an active
   subscription with no charge for two cycles, both appear as a question in the list header, not as a
   silent assumption.

**Screens.** Subscription list (grouped: next 7 days, this month, later, paused, cancelled); detail with
price history and a small timeline (started → trial → renewals → ends); add flow with the catalogue;
suggestions inbox; "what I cancelled" summary that adds up the money not spent.

**Endpoints.** `GET/POST /api/subscriptions`, `PATCH/DELETE /api/subscriptions/:id`,
`POST /api/subscriptions/:id/cancel`, `POST /api/subscriptions/:id/pause`, `POST /api/subscriptions/:id/resume`,
`GET /api/subscriptions/upcoming`, `GET /api/subscriptions/suggestions`,
`POST /api/subscriptions/from-suggestion`.

**Plan gates (proposal, owner confirms).**

| | Free | Standard | Premium |
|---|---|---|---|
| Detected subscriptions, read only | 3 | all | all |
| Add and track | — | unlimited | unlimited |
| Reminder before a charge | — | yes | yes |
| Price history and increases | — | — | yes |
| Trial-ending alert | — | — | yes |
| "Cancel this and save X a year" | — | — | yes |

**Traps.**

- A yearly subscription paid in one month will make that month look like a disaster in every budget. The
  subscription detail says so ("this is your annual charge month") and the budget view can show an
  "annual charges" line — otherwise the customer will think the app is broken.
- Double creation: a subscription with `creates_transactions` plus the person entering the charge by
  hand gives two rows. The charge is matched to its subscription and the manual duplicate is offered for
  removal, not silently deleted.
- Time zones: a charge on the 1st at 23:00 in Lima is the 2nd in UTC. Anchors are day-of-month in the
  person's zone, exactly like budgets today.
- Currency: a subscription in dollars charged to a soles account must not silently add to a soles total
  without the rate of the day (phase 8 covers this properly; until then, show the two numbers apart).

**Done when.** Ten subscriptions entered in three minutes; the yearly total matches the sum of their
charges; a price increase appears as history and not as an edit; a cancelled subscription stops
appearing in "next 14 days" and still shows in the year's total.

---

### Phase 5 — Debts · Size L · Depends on phase 1

**What the customer gets.** A place for what they owe: the credit card, the car loan, the money borrowed
from a cousin. For each: how much is left, what the interest really costs per month, and one clear order
to pay them — *"card first: you save 480 in interest and are free in 14 months instead of 31"*.

**Why it is not optional.** This app tracks saving well and owing not at all. In this market the debt is
often bigger than the savings, and paying only the minimum is the normal behaviour that keeps people
poor. A goal can describe a holiday; only a debt screen describes a way out.

**What changes.**

```
debts
  id, user_id
  account_id               null for a loan from a person
  kind                     credit_card | loan | informal
  name                     "Visa BCP"
  principal                decimal(12,2)   — what was borrowed, for the record
  current_balance          decimal(12,2)
  interest_rate            numeric(5,2)    — yearly, 0 allowed
  minimum_payment          decimal(12,2)
  due_day                  integer
  currency, notes (encrypted), is_active
  created_at, updated_at

debt_payments   id, debt_id, transaction_id null, amount, principal_part, interest_part, paid_on
```

**The plan is arithmetic, not AI.** Avalanche (highest rate first) and snowball (smallest balance first)
are both offered with the cost of each in money and months; the AI writes one sentence explaining the
difference ("avalanche saves 380 but the first debt clears three months later"). Everything else is
computed, so the numbers can be checked.

**Also in this phase.** A debt payment recorded from the app splits into principal and interest, so the
month's expenses stop being wrong: paying 500 on a card is not 500 of spending.

**Done when.** A card with a 4,000 balance at 45% shows the real monthly interest, the payoff date with
minimums only, and a shorter date with an extra 200 — and the difference is a number the customer can
repeat by hand.

---

### Phase 6 — Fast capture: cash, pasted notices, offline · Size L · Depends on phase 1

**What the customer gets.** Three ways to record money without a form:

1. **Cash in two taps.** A keypad first, details later: "5", "taxi" → done. It lands in the cash pot.
2. **Paste a notice.** Copy a Yape, Plin or bank message, or share it to the app; it becomes a
   transaction with amount, date and who. The original text stays attached to the row, so a wrong guess
   can be corrected against the source.
3. **Offline.** Everything above works with no signal and syncs when the connection returns, without
   duplicates (the app already has an idempotency key on transactions; this phase uses it).

**Why in this order.** Cash and notices are how most money moves here. Without this, the app is accurate
about bank spending and blind to everything else — and the reports quietly become wrong in a way the
customer cannot see.

**What changes.** `transactions.source` (`manual | voice | receipt | statement | notice | cash_quick`),
a `capture` screen as the default action on mobile, a share-target handler, and a local queue in the
client. The paste parser is a small set of patterns per bank plus the model for the rest, and it always
shows what it understood before saving.

**Traps.** The parser must never invent a merchant. If the message is ambiguous it asks, or it saves with
"unknown" and the original text attached — never a guessed name that will pollute the categories later.

**Done when.** A week of real cash and Yape messages is recorded in under a minute a day, and a duplicate
sync (same notice delivered twice) creates one row.

---

### Phase 7 — Shared household money · Size XL · Depends on phases 1, 2 and 4

**What the customer gets.** Two people, one book. Shared budgets (food, rent, children), shared expenses
with *who paid*, and at the end of the month one line: *"Ana paid 340 more than her share; settle 340"*.

**Why it is the retention feature.** The shared goals you already have prove the appetite: people plan
together. But they track separately, so one of them always gives up. Nothing else in the app brings a
second paying customer in like a household.

**What changes.**

```
households            id, name, created_by, currency, created_at
household_members     household_id, user_id, role (owner | member), joined_at, share_rule
shared_budgets        household_id, category_id null, amount, period (mirrors budgets)
transaction_shares    transaction_id, household_id, paid_by, split  (equal | shares | custom)
settlements           household_id, from_user, to_user, amount, date, transaction_id null
```

**Rules.** Sharing is per transaction, never blanket: the rest of a person's money stays private, and
the household sees only what was tagged. A settlement is not spending — it follows the transfer rule.
Leaving a household keeps the history and stops new sharing.

**Traps.** This is the phase where privacy mistakes are expensive: one query that forgets the household
filter shows a stranger's salaries. Every household read goes through one access helper, and the tests
include "member of household A cannot read household B".

**Done when.** Two accounts share three budgets for a month, every expense shows who paid, the settle-up
figure matches a hand calculation, and neither person can see the other's private rows.

---

### Phase 8 — Multi-currency · Size L · Depends on phase 1

**What the customer gets.** A dollar saving pot next to the soles account. Each entry keeps the rate of
the day it happened, so the pot shows *"you put in 1,000 dollars; in soles that is 3,720 today, 180 more
than the day you put it in"*.

**Why it matters here.** Saving in dollars is normal in Peru for anything big, and the app currently has
one currency field for the whole person. A single rate across all history would be a lie; the rate has to
be stored per entry.

**What changes.**

```
accounts.currency                 already added in phase 1
transactions.currency             varchar(3)            — defaults to the account's
transactions.fx_rate_to_base      numeric(12,6)         — frozen with the entry
transactions.amount_in_base       decimal(12,2)         — what totals use
users.base_currency               varchar(3) default 'PEN'
exchange_rates                    date, from_currency, to_currency, rate, source
```

**Rules.** Totals are always in the base currency, computed from `amount_in_base`, never by multiplying a
month-old amount by today's rate. A rate that cannot be fetched is shown as "rate not available" and the
entry waits, rather than silently using 1. The rate source is stored on every row so an accountant can
see where a number came from.

**Traps.** The whole plan's numbers (score, budgets, adviser) must read `amount_in_base`. A single
remaining place that sums `amount` directly will mix currencies into a meaningless total — this phase ends
with a search for every `sum(amount)` in the codebase and a test per route.

**Done when.** A soles month containing a dollar subscription and a dollar transfer reports one coherent
total in soles, the dollar pot shows its own gain, and the two reconcile by hand.

---

### Phase 9 — Ask your own data · Size L · Depends on phases 1, 3 and 4 · Premium

**What the customer gets.** A question box on the reports screen: *"how much did I spend in Cusco in
March?"*, *"which month was worst for restaurants?"*, *"how much do I pay for subscriptions per year?"*
It answers with a number, a sentence and the rows it used.

**Why the design must be careful.** This is the feature most likely to produce a confident wrong number.
The rule for the whole phase: **the model never writes a query and never does arithmetic on the customer's
data.** It chooses from a fixed menu of prepared questions, the server computes, and the model only
phrases the result.

**How it works.**

1. A menu of ~14 prepared measures (spend by category, by month, by account, by merchant, top movers,
   subscription totals, goal pace, cash position, average transaction, weekday pattern, month over month,
   currency totals, budget adherence, biggest single day).
2. The question is parsed into `{measure, filters, period}` — filters limited to a whitelist: category,
   account, merchant, month, amount range.
3. The server runs it with the person's own rows only.
4. The model writes one sentence around the computed figure and adds nothing else.
5. The answer shows the rows behind it, so a wrong answer is visibly wrong.

**Gates.** Premium (it costs a model call per question). A small number of questions per day per plan, and
the menu question answered without a model call when it is a simple repeat.

**Done when.** Twenty real questions in Spanish and English return numbers that match a hand filter, the
answer always shows its rows, and a question outside the menu says what it can answer instead of guessing.

---

### Phase 10 — Receipts by item, and your own inflation · Size L · Depends on phase 6 · Premium

**What the customer gets.** Receipts are already photographed and read. This phase reads the **lines**:
milk, rice, chicken, each with a quantity and a unit price. Then: *"your basket costs 12% more than in
June"*, *"the chicken you buy went from 11.90 to 13.50"*, *"you buy this every 9 days"*.

**Why it is unique.** Official inflation describes an average country, not a person. Nobody in this
market reads the receipt line by line, and it turns a feature people abandon (scanning) into a reason to
scan.

**What changes.**

```
receipt_items
  id, transaction_id, user_id
  raw_name            as printed
  item_key            normalised ("leche entera")
  quantity, unit      numeric, varchar
  unit_price, line_total
  category_id null    — food subcategory later
  created_at

item_prices           — the price history used for the index
  item_key, user_id null, store_key null, unit_price, observed_on, transaction_id
```

**How it stays honest.** Item names are normalised with a dictionary plus the model; the dictionary is
reviewed, and unmatched names are shown as "not yet grouped" rather than guessed into a group. The index
is computed only from items seen at least twice, in the same unit, and it says how many items it covers
("based on 34 items you bought at least twice"). A thin basket never produces a confident percentage.

**Done when.** Twenty receipts produce a basket index with its coverage stated, a price change on one
item is visible with the dates, and nothing is grouped without the person being able to see and fix it.

---

### Phase 11 — The watchdog · Size M · Depends on phases 3, 4 and 8

**What the customer gets.** Short, specific alerts the day something looks wrong: *"electricity is 40%
above your usual"*, *"you paid rent twice this month"*, *"Disney+ charges 49.90 in 2 days — the trial
ends"*, *"your card payment is 3 days past due"*.

**Why a separate thing from the adviser.** The adviser is one considered answer about the plan, once a
month. The watchdog is a fact, the day it happens. Mixing them is what made the old panels repeat each
other; keeping them apart is the whole design decision.

**How it works.** Rules are computed server-side, cheap, and run on a schedule:

| Rule | Fires when |
|---|---|
| Category spike | a category is >40% above the same category's 3-month average and >20 in money |
| Duplicate charge | same merchant, same amount, within 3 days |
| Missing subscription | active subscription has no charge for 2 cycles |
| Trial ending | `trial_ends_on` within `reminder_days_before` |
| Budget pace | a budget will be exceeded at the current daily pace, with days left |
| Price increase | a known subscription charges more than its last price |
| Cash low | the cash pot is below two days of average spending |

The model writes one sentence per alert, in the person's language, from the computed figures. No model,
no alert lost: if the model fails, the alert still appears with a plain templated sentence.

**Screens.** A bell with a count and an alerts inbox (unread, read, dismissed). Email or push for the three
that matter (trial ending, duplicate, card past due), configurable.

**Gates.** Standard gets the inbox and the budget/cash rules; Premium gets subscription and price rules.

**Done when.** A test charge duplicated on purpose produces exactly one alert with the right amounts, and
dismissing it keeps it dismissed.

---

### Phase 12 — What-if · Size M · Depends on phases 4, 5 and 9

**What the customer gets.** Sliders on their own numbers: *"restaurants −30%"*, *"extra 200 to the card"*,
*"cancel Disney+"*. The answer is a date and an amount: *"the laptop arrives in September instead of
January"*, *"debt-free four months earlier"*.

**Design.** This is the inverse of the adviser: the customer moves the number, the app recomputes, and
nothing is invented. The engine is deterministic (reuse the goal-pace and debt maths from phases 4–6);
the model is used only for the one closing sentence and only if it can quote the computed figures.

**Why it earns its place.** It makes advice testable. A person who moves a slider and sees January become
September believes the app; a person told "spend less" does not.

**Done when.** Three sliders produce three coherent dates, the arithmetic matches a spreadsheet, and
nothing in the screen is a stored prediction that could go stale.

---

### Phase 13 — Negotiation helper · Size S–M · Depends on phase 4

**What the customer gets.** For a bill or a subscription that went up: a short message to send ("I have
been with you four years; the new price is 25% above what I pay — is there a retention plan?"), the phone
number or the chat link, and a place to record the result. When it works, the app records the new price as
history and says how much a year it saved.

**Why it is rare.** Apps tell people what they spend. Very few help them *change the price*, which is the
cheapest money in the whole product.

**Rules.** Templates per country and language, never sent automatically, never claiming a fact about the
provider. The saving is only shown once the person confirms the new price.

**Done when.** Ten saved cancellations or discounts are recorded with their yearly value, and the summary
adds up.

---

### Phase 14 — Tax helper (Peru first, Slovakia later) · Size L · Depends on phase 10

**What the customer gets.** Every expense that can be deducted, collected automatically from what they
already record, with the year's limit and the deadline: *"you have 2,100 of this year's limit in
deductible expenses; the deadline is in 61 days"*, and a one-click file of receipts for the accountant.

**Why local depth is the moat.** No global app knows this. For anyone issuing receipts in Peru this is
real money back, and the limit is expressed in UIT, so it changes every year and has to be maintained —
which is exactly the sort of work a local product can do and a foreign one will not.

**Design rules.** Country rules live in one configuration file (`shared/tax/{pe,sk}.ts`): which categories
count, the yearly cap, the deadlines, the documents needed. Nothing about a country is hard-coded in a
screen. **The app never files anything** — it prepares and reminds, and says so plainly. The current
year's UIT and rates are configuration, reviewed once a year, not code.

**Confirm before building.** The two official pages I checked returned navigation only, so the exact
current limits and deadlines must be verified against SUNAT (and the Slovak financial administration)
before this phase starts.

**Done when.** A year of receipts produces a total, a limit, a deadline and a folder, and changing the
configuration file changes the numbers with no code edit.

---

### Phase 15 — The retention layer · Size M · Depends on phases 3, 4 and 11

Three small things that decide whether any of the above is used in month four.

**15a. The weekly message.** One short email (or WhatsApp, if the owner wants the extra work) every Monday:
*"Last week: 412 spent, 2 budgets close to the limit, Netflix charges Thursday, one thing to do."* Built
from what the dashboard already knows; no AI needed for the numbers, one sentence for the tone. Every
message has one link that opens the right screen.

**15b. Wait before you buy.** A wish list with a cooling-off timer: *"S/ 800 is 2.1 months of your laptop
pace — still want it on Friday?"* When the timer ends the app asks one question: bought, or dropped?
Dropped purchases are counted, and that number is the feature's proof ("this saved you 1,840 this year").

**15c. Lessons that open the tool.** The courses page already exists and nobody expects it. Each lesson gets
one button that opens the matching tool with the lesson's example filled in: the debt lesson opens the debt
plan, the emergency-fund lesson opens the buffer target, the subscription lesson opens the hunter. This is
the cheapest differentiation available — the education and the tool in the same place.

**Done when.** The weekly message arrives and opens the right screen, a dropped wish-list item is counted
with its value, and every lesson has a working hand-off.

---

## 4. Release plan

Nine releases, each one worth announcing. Two to three phases per release at most; more than that and
review becomes the bottleneck.

| Release | Phases | The sentence on the changelog | Weeks |
|---|---|---|---|
| R1 | 1, 2 | "You can now see where your money is — and moving it between your own accounts no longer counts as spending." | 1–4 |
| R2 | 3 | "Your month can start on your payday." | 5–6 |
| R3 | 4 | "Every subscription in one place: what it costs, when it charges, when it ends." | 7–10 |
| R4 | 5 | "What your debt really costs, and one order to clear it." | 11–13 |
| R5 | 11 | "Your app now warns you the day something looks wrong." | 14–15 |
| R6 | 6 | "Cash in two taps, and a pasted Yape message becomes a transaction." | 16–19 |
| R7 | 8, 13 | "Save in dollars next to your soles, and a message to send when a price goes up." | 20–23 |
| R8 | 9, 10 | "Ask your own data a question, and see how your own basket's prices moved." | 24–28 |
| R9 | 7, 14, 15 | "Two people, one book; deductible expenses collected; a weekly summary." | 29–34 |

**Why this order.** R1 fixes wrong numbers, which is the only thing that cannot wait. R3 is the biggest
value per week of work, so it comes as early as it safely can. R5 (the watchdog) is cheap and makes the app
feel alive while bigger work continues. Households come last because they are the biggest build and the
most dangerous for privacy — worth doing once everything under them is steady.

---

## 5. Cross-cutting work (not optional)

| Area | What every phase must do |
|---|---|
| Languages | Every string in `en-us`, `es-pe`, `sk-sk`. A missing translation is a bug, not a backlog item. |
| Money | Sum in cents; `decimal(12,2)` in the database; one rounding helper used everywhere. |
| Privacy | New text columns go through the encryption helpers; household and shared reads go through one access helper. |
| Plan gates | Decided in this document before the screen is built, and enforced twice: in the route (403 with a code) and in the UI (a lock, never an empty panel). |
| AI | Every new AI feature declares a task, a plan limit and a cache rule. The model writes sentences, never figures. |
| Help | A `?` tooltip on every new number that could be misread, using the existing `help.*` keys. |
| Tests | Unit tests for every calculation (payoff, pace, index, split), route tests for every endpoint, and one test per rule that says "this is right", not "this runs". |
| Indexes | Every new per-user list gets its index in the same migration: accounts by user, subscriptions by user and status, alerts by user and read state, receipt items by transaction. |
| Speed | The dashboard must not grow one request per feature. New panels read one prepared summary. |
| Analytics | Before a release, decide the two numbers that say it works (subscriptions: how many created per user, how many price changes detected) and put them in admin. |

---

## 6. Data migration rules

1. **Nothing is deleted.** Old columns stay until a phase is finished; a separate migration removes them
   after a backup.
2. **Backfill before `not null`.** Two migrations per new required column: add nullable, fill it, then
   constrain.
3. **Existing transactions get an account** in phase 1 — one per user, named "Main account".
4. **Existing recurring transactions are not converted into subscriptions automatically.** The customer is
   shown a suggestion list instead, so nobody's screen fills with guesses.
5. **History repair (phase 2) is opt-in**, shown as a preview, never applied silently.
6. **Every migration is reversible** or has a documented restore. The repo keeps a rollback copy of the
   build; the database needs the same discipline.
7. **Order:** migration to production first, then the release. The deploy already refuses code whose tables
   production does not have.
8. **Text and money checks** after each migration: a spot check that three existing users' descriptions are
   still readable and three months of totals are unchanged.

---

## 7. Risks, and what to do about them

| Risk | Why it is serious | Mitigation |
|---|---|---|
| The account migration touches every read path | The dashboard, score, adviser, export and reports all sum transactions | Change the summary once, behind tests that assert the same totals before and after; ship it alone in R1 |
| Four overlapping repeating-money concepts | The app already has three; a fourth would confuse both the customer and the code | Subscriptions own the list; reminders and recurring rows keep their jobs (phase 4 table) |
| Currency mixing | One missed sum silently produces a meaningless total | Phase 8 ends with a search for every sum and a test per route |
| Ask-your-data wrong numbers | A confident wrong figure destroys trust faster than a missing feature | Fixed menu of measures, the model never computes, the rows are always shown |
| Household privacy | One missing filter exposes a stranger's salary | One access helper; tests that read across households and must fail |
| Scope | 19 features is 5–6 months; shipping half-built is worse than shipping fewer | Nine releases, each shippable; nothing starts before its dependencies are steady |
| AI cost | New AI features multiply calls | Per-plan quota per task, cache by input, and no model call when arithmetic answers |

### Not in this plan, on purpose

- **Automatic bank connections.** There is no open banking here, screen-scraping banks breaks monthly, and
  to a customer it looks like a security problem. Paste and share is the honest version.
- **Investment or credit-score advice.** Regulated: a wrong sentence becomes a liability.
- **Crypto.**
- **Filing taxes for the customer.** Prepare and remind, never file.

---

## 8. Decisions needed from the owner

1. **Plan split.** The proposal above puts money location and basic subscriptions on Standard, and
   everything predictive or AI on Premium. Confirm or change before R1, because it shapes the pricing page.
2. **Subscriptions: track or create?** Should a subscription write the charge automatically on the day, or
   only forecast it and wait for the customer to record it? *Recommendation: create by default, with a
   switch — forecasting alone makes the totals depend on the customer's discipline.*
3. **Household scope.** Couples only, or any group (flatmates, family with children)? Any group is more work
   and more support.
4. **Languages in the first releases.** Do R1–R3 ship in all three languages, or Spanish and English until
   the Slovak copy is reviewed?
5. **Currencies.** Soles and dollars at first, or euros too (Slovak customers)?
6. **Tax helper order.** Peru first and Slovakia when the market asks, or both together?
7. **The weekly message.** Email only, or WhatsApp as well (needs a provider and a phone verification flow)?
8. **Do we merge bill reminders into subscriptions?** *Recommendation: no — rent and electricity vary, a
   subscription does not. Two concepts, clearly named in the interface.*

---

## 9. How to start (if R1 is approved)

The first week, concretely:

1. Write the `accounts` and `transfers` tables, generate the migration, read it, run it locally.
2. Backfill every existing user into one account; verify three real accounts by hand.
3. Change the financial summary to exclude transfers, with tests that pin the numbers of a real month.
4. Build the accounts screen and the "Move money" action.
5. Ship normally, then compare the first day's dashboard against a screenshot taken before the release.

Everything after that follows the release table in section 4. Each release starts by reading its phase
block here, and ends by making its "Done when" sentence true.
