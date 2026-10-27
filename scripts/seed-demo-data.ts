/**
 * Kaptia — fill one account with believable demo data, so every screen has something to show.
 *
 * WHY THIS EXISTS
 * ---------------
 * An account with no history shows empty charts, an empty budget screen and an empty goal list,
 * which tells a person nothing about what the app does. This script writes a household-sized
 * history — six months of income and spending, monthly budgets, personal goals and shared goals —
 * through the app's own storage layer, not by hand-written SQL. That matters for one reason:
 * transaction descriptions and goal names are encrypted at rest (`DataEncryption`), and rows
 * inserted behind its back would be unreadable the moment the app tried to show them.
 *
 * WHAT IT WRITES
 * --------------
 *   categories      twelve of the person's own (Groceries, Rent, … Rental Income, Bonus)
 *   transactions    about a hundred and thirty rows over six months, incomes and expenses
 *   budgets         one row per category per month, so the month switcher has a past
 *   goals           six personal goals at different stages, one already reached
 *   collaborative   three shared goals with two participants, contributions and chat
 *
 * The window is relative to the day it runs: the current month and the five before it. Nothing is
 * ever dated in the future. Re-running it is safe — every row it has already written is
 * recognised and left alone, so a second run only adds what is missing.
 *
 * USAGE
 * -----
 *   npx tsx scripts/seed-demo-data.ts --email jan@example.com             # show the plan only
 *   npx tsx scripts/seed-demo-data.ts --email jan@example.com --confirm   # write it
 *   npx tsx scripts/seed-demo-data.ts --email jan@example.com --confirm --reset
 *
 * `--reset` removes every row this script owns for that account (never the person's own rows:
 * they are recognised by their fixed names and by a `demo-` prefix on the transaction key) and
 * then, if `--confirm` was given too, writes a fresh copy.
 *
 * It talks to the same database the server would: `DATABASE_URL_PROD` with NODE_ENV=production,
 * `DATABASE_URL` otherwise. It refuses to run without a valid ENCRYPTION_KEY, because writing
 * with the development fallback key would produce rows nobody can read again.
 */
import 'dotenv/config';
import { storage } from '../server/storage';
import { db, closePool } from '../server/db';
import * as schema from '@shared/schema';
import { and, eq, like, sql } from 'drizzle-orm';

const USAGE = `
Usage: npx tsx scripts/seed-demo-data.ts --email <address> [--confirm] [--reset]

  --email <address>  the account to fill (it must already exist)
  --confirm          actually write. Without it the script only prints the plan.
  --reset            delete the demo rows this script previously wrote for the account
`;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

/* -------------------------------------------------------------------------- *
 * 1. Guard rails — the argument checks and the refusal to write with a throwaway key
 * -------------------------------------------------------------------------- */

const argv = process.argv.slice(2);
const emailFlag = argv.indexOf('--email');
const targetEmail = emailFlag !== -1 ? (argv[emailFlag + 1] ?? '').trim() : '';
const confirm = argv.includes('--confirm');
const reset = argv.includes('--reset');

if (!targetEmail) fail(USAGE);

/**
 * The development fallback key is generated fresh in every process, so anything written with it
 * becomes unreadable as soon as the command exits. That is invisible at the time — the insert
 * succeeds — and shows up later as "[unreadable: encrypted with a different key]" on screen.
 */
const encryptionKey = process.env.ENCRYPTION_KEY ?? '';
if (!/^[0-9a-fA-F]{64}$/.test(encryptionKey)) {
  fail(
    'ENCRYPTION_KEY must be set to exactly 64 hex characters.\n' +
      'Without it this script would write text with a throwaway key and the app could never read it back.',
  );
}

const databaseUrl =
  (process.env.NODE_ENV === 'production' ? process.env.DATABASE_URL_PROD : process.env.DATABASE_URL) ?? '';
if (!databaseUrl) {
  fail(
    process.env.NODE_ENV === 'production'
      ? 'DATABASE_URL_PROD is not set.'
      : 'DATABASE_URL is not set.',
  );
}

const databaseHost = (() => {
  try {
    return new URL(databaseUrl).hostname;
  } catch {
    return '<unparseable database url>';
  }
})();

/* -------------------------------------------------------------------------- *
 * 2. Dates — Peru has no daylight saving, so a fixed offset is exact
 * -------------------------------------------------------------------------- */

const LIMA_UTC_OFFSET_HOURS = 5;

/** A moment at `hour`:00 in Lima on a given calendar day, as the server would store it. */
function limaDate(year: number, month: number, day: number, hour = 12): Date {
  return new Date(Date.UTC(year, month - 1, day, hour + LIMA_UTC_OFFSET_HOURS, 0, 0));
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const shifted = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1 };
}

/** Today in Lima, from the same clock the app uses to decide where "this month" starts. */
const nowInLima = new Date(Date.now() - LIMA_UTC_OFFSET_HOURS * 3_600_000);
const TODAY = {
  year: nowInLima.getUTCFullYear(),
  month: nowInLima.getUTCMonth() + 1,
  day: nowInLima.getUTCDate(),
};

/** The six months the data covers: five complete ones and the current, partial one. */
const WINDOW = [-5, -4, -3, -2, -1, 0].map((delta) => shiftMonth(TODAY.year, TODAY.month, delta));

/** True when the moment is in the future; nothing is ever written ahead of today. */
const inTheFuture = (date: Date): boolean => date.getTime() > Date.now();

/* -------------------------------------------------------------------------- *
 * 3. Deterministic "randomness" — the same run always produces the same numbers
 * -------------------------------------------------------------------------- */

/**
 * FNV-1a over the seed string, then a cheap xorshift. Fixed seeds mean the demo history does not
 * change between two runs, so screenshots and comparisons stay stable.
 */
function seededRandom(seed: string): () => number {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = Math.imul(hash ^ seed.charCodeAt(index), 16777619) >>> 0;
  }
  return () => {
    hash = Math.imul(hash ^ (hash >>> 15), 2246822507) >>> 0;
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909) >>> 0;
    return hash / 4294967296;
  };
}

/** A two-decimal amount inside a range, stable for a given seed. */
function amountBetween(seed: string, min: number, max: number): number {
  const value = min + seededRandom(seed)() * (max - min);
  return Math.round(value * 100) / 100;
}

/** Decimal columns take strings; the app formats money the same way. */
const money = (value: number): string => value.toFixed(2);

/** A transaction's idempotency key doubles as the marker `--reset` looks for. */
const demoKey = (parts: Array<string | number>): string => `demo-${parts.join('-')}`;

/* -------------------------------------------------------------------------- *
 * 4. Categories
 * -------------------------------------------------------------------------- */

interface CategorySpec {
  name: string;
  icon: string;
  color: string;
  type: 'expense' | 'income';
}

/**
 * Twelve of the person's own categories, on top of the sixteen shared ones the app ships with.
 * Icon names are the keys `client/src/lib/icons-registry.tsx` knows, so every card gets its
 * proper glyph instead of the generic circle fallback.
 */
const DEMO_CATEGORIES: CategorySpec[] = [
  { name: 'Groceries', icon: 'shopping', color: '#22C55E', type: 'expense' },
  { name: 'Rent', icon: 'housing', color: '#0EA5E9', type: 'expense' },
  { name: 'Utilities & Bills', icon: 'utilities', color: '#EAB308', type: 'expense' },
  { name: 'Internet & Phone', icon: 'utilities', color: '#6366F1', type: 'expense' },
  { name: 'Coffee & Snacks', icon: 'food', color: '#A16207', type: 'expense' },
  { name: 'Restaurants', icon: 'food', color: '#F97316', type: 'expense' },
  { name: 'Subscriptions', icon: 'entertainment', color: '#8B5CF6', type: 'expense' },
  { name: 'Gym & Fitness', icon: 'healthcare', color: '#14B8A6', type: 'expense' },
  { name: 'Pets', icon: 'heart', color: '#EC4899', type: 'expense' },
  { name: 'Travel', icon: 'travel', color: '#F59E0B', type: 'expense' },
  { name: 'Rental Income', icon: 'rental', color: '#8B5CF6', type: 'income' },
  { name: 'Bonus', icon: 'gift', color: '#10B981', type: 'income' },
];

const DEMO_CATEGORY_NAMES = new Set(DEMO_CATEGORIES.map((category) => category.name));

/* -------------------------------------------------------------------------- *
 * 5. Transactions
 * -------------------------------------------------------------------------- */

interface MoneyRow {
  category: string;
  description: string;
  type: 'income' | 'expense';
  /** A fixed amount, or a range the seeded generator picks from. */
  amount?: number;
  min?: number;
  max?: number;
}

/** The same bills every month, on the same days: what a real statement looks like. */
const MONTHLY_FIXED: Array<MoneyRow & { day: number }> = [
  { day: 1, category: 'Salary', description: 'Monthly salary — Formatika SAC', type: 'income', amount: 4850 },
  { day: 2, category: 'Rent', description: 'Monthly rent — Miraflores flat', type: 'expense', amount: 1650 },
  { day: 3, category: 'Gym & Fitness', description: 'Smart Fit membership', type: 'expense', amount: 129 },
  { day: 5, category: 'Rental Income', description: 'Rental income — Barranco room', type: 'income', amount: 950 },
  { day: 8, category: 'Pets', description: 'Pet food — Petco', type: 'expense', min: 62, max: 96 },
  { day: 12, category: 'Utilities & Bills', description: 'Luz del Sur + Sedapal', type: 'expense', min: 148, max: 265 },
  { day: 15, category: 'Internet & Phone', description: 'Movistar fibre + mobile', type: 'expense', amount: 129.9 },
  { day: 18, category: 'Subscriptions', description: 'Netflix + Spotify', type: 'expense', amount: 44.9 },
];

interface RunSpec {
  day: number;
  description: string;
  min: number;
  max: number;
}

const GROCERY_RUNS: RunSpec[] = [
  { day: 3, description: 'Groceries — Wong', min: 96, max: 214 },
  { day: 9, description: 'Groceries — Plaza Vea', min: 78, max: 186 },
  { day: 17, description: 'Market run — Surquillo', min: 54, max: 132 },
  { day: 24, description: 'Groceries — Metro', min: 84, max: 198 },
  { day: 29, description: 'Groceries — Tottus', min: 62, max: 148 },
];

const COFFEE_RUNS: RunSpec[] = [
  { day: 4, description: 'Coffee — Origen Tostadores', min: 12, max: 24 },
  { day: 11, description: 'Coffee & pastry — Starbucks', min: 14, max: 28 },
  { day: 19, description: 'Snacks — Tottus', min: 9, max: 22 },
  { day: 26, description: 'Coffee — Café de Lima', min: 11, max: 23 },
];

const RESTAURANT_RUNS: RunSpec[] = [
  { day: 6, description: 'Dinner — Pardos Chicken', min: 62, max: 98 },
  { day: 21, description: 'Lunch — La Mar Cebichería', min: 85, max: 140 },
  { day: 28, description: 'Sushi — Edo', min: 95, max: 155 },
];

const RIDE_RUNS: RunSpec[] = [
  { day: 2, description: 'Uber — home to office', min: 9, max: 18 },
  { day: 13, description: 'Taxi — airport run', min: 32, max: 48 },
  { day: 22, description: 'Uber — dinner out', min: 10, max: 21 },
];

/**
 * How busy each month was, oldest first. Varying the counts is what stops the trends screen from
 * drawing six identical months.
 */
const MONTH_SHAPE = [
  { groceries: 4, coffee: 3, restaurants: 2, rides: 2 },
  { groceries: 5, coffee: 3, restaurants: 3, rides: 2 },
  { groceries: 4, coffee: 4, restaurants: 2, rides: 3 },
  { groceries: 5, coffee: 3, restaurants: 3, rides: 2 },
  { groceries: 4, coffee: 3, restaurants: 2, rides: 2 },
  { groceries: 4, coffee: 3, restaurants: 2, rides: 2 },
];

/** One-off rows: the bonus, the trips, the dentist. `at` is the index into WINDOW. */
const ONE_OFFS: Array<MoneyRow & { at: number; day: number; amount: number }> = [
  { at: 0, day: 11, category: 'Healthcare', description: 'Pharmacy — Inkafarma', type: 'expense', amount: 64.5 },
  { at: 1, day: 20, category: 'Freelance', description: 'Freelance invoice — landing page', type: 'income', amount: 1500 },
  { at: 1, day: 27, category: 'Shopping', description: 'Running shoes — Marathon Sport', type: 'expense', amount: 289 },
  { at: 2, day: 4, category: 'Bonus', description: 'Mid-year bonus', type: 'income', amount: 2400 },
  { at: 2, day: 16, category: 'Travel', description: 'Flights LIM–CUZ for two', type: 'expense', amount: 486 },
  { at: 2, day: 21, category: 'Entertainment', description: 'Cinema — Cineplanet', type: 'expense', amount: 42 },
  { at: 3, day: 9, category: 'Healthcare', description: 'Dentist appointment', type: 'expense', amount: 180 },
  { at: 4, day: 3, category: 'Freelance', description: 'Freelance invoice — app prototype', type: 'income', amount: 900 },
  { at: 4, day: 14, category: 'Travel', description: 'Hotel in Paracas, two nights', type: 'expense', amount: 640 },
  { at: 4, day: 23, category: 'Pets', description: 'Vet visit — annual vaccines', type: 'expense', amount: 185 },
  { at: 5, day: 6, category: 'Freelance', description: 'Freelance invoice — dashboard fixes', type: 'income', amount: 1200 },
  { at: 5, day: 19, category: 'Entertainment', description: 'Concert tickets', type: 'expense', amount: 190 },
];

/* -------------------------------------------------------------------------- *
 * 6. Budgets
 * -------------------------------------------------------------------------- */

interface BudgetSpec {
  category: string;
  amount: number;
}

/**
 * One budget per category per month. Every category is one of the person's own, which is also how
 * `--reset` recognises them: it never touches a budget that points at a shared category.
 */
const MONTHLY_BUDGETS: BudgetSpec[] = [
  { category: 'Groceries', amount: 650 },
  { category: 'Rent', amount: 1700 },
  { category: 'Utilities & Bills', amount: 240 },
  { category: 'Coffee & Snacks', amount: 100 },
  { category: 'Restaurants', amount: 320 },
  { category: 'Subscriptions', amount: 60 },
  { category: 'Gym & Fitness', amount: 140 },
];

/** A travel budget only in the months that actually had a trip. */
const SEASONAL_BUDGETS: Array<BudgetSpec & { at: number }> = [
  { at: 2, category: 'Travel', amount: 800 },
  { at: 4, category: 'Travel', amount: 700 },
];

/* -------------------------------------------------------------------------- *
 * 7. Personal goals
 * -------------------------------------------------------------------------- */

interface GoalSpec {
  name: string;
  description: string;
  /** The value the goals form produces: the category name, lower-cased, spaces as underscores. */
  category: string;
  target: number;
  current: number;
  /** Months from now. Negative means the date has already passed. */
  targetInMonths: number;
  status: string;
}

const DEMO_GOALS: GoalSpec[] = [
  {
    name: 'Emergency Fund',
    description: 'Three months of expenses in a separate account.',
    category: 'emergency_fund',
    target: 18000,
    current: 9200,
    targetInMonths: 9,
    status: 'active',
  },
  {
    name: 'Cusco Family Trip',
    description: 'Flights, hotel and tours for the whole family.',
    category: 'vacation',
    target: 6000,
    current: 2350,
    targetInMonths: 9,
    status: 'active',
  },
  {
    name: 'New Laptop',
    description: 'Replacing the 2017 machine before it dies.',
    category: 'other',
    target: 5200,
    current: 3900,
    targetInMonths: 4,
    status: 'active',
  },
  {
    name: 'Credit Card Payoff',
    description: 'Clearing the BCP Visa balance, highest interest first.',
    category: 'debt_payoff',
    target: 8000,
    current: 5100,
    targetInMonths: 12,
    status: 'active',
  },
  {
    name: 'House Down Payment',
    description: 'Saving towards a flat in Lima.',
    category: 'house_down_payment',
    target: 60000,
    current: 12500,
    targetInMonths: 36,
    status: 'active',
  },
  {
    name: 'Standing Desk',
    description: 'Bought in instalments — reached in the summer.',
    category: 'other',
    target: 1200,
    current: 1200,
    targetInMonths: -2,
    status: 'completed',
  },
];

/* -------------------------------------------------------------------------- *
 * 8. Collaborative goals
 * -------------------------------------------------------------------------- */

/** `owner` is the account being filled; `friend` is the stand-in second participant. */
type Participant = 'owner' | 'friend';

interface ContributionSpec {
  /** Index into WINDOW. */
  at: number;
  day: number;
  who: Participant;
  amount: number;
  note: string;
}

interface MessageSpec {
  at: number;
  day: number;
  who: Participant;
  text: string;
}

interface CollabGoalSpec {
  name: string;
  description: string;
  /** One of the values the shared-goal form offers: vacation, emergency, home, … */
  category: string;
  challengeType: 'collaborative' | 'competitive' | 'milestone';
  target: number;
  targetInMonths: number;
  created: { at: number; day: number };
  goalDetails: Record<string, string>;
  milestoneRewards: Array<{ threshold: number; reward: string }>;
  contributions: ContributionSpec[];
  messages: MessageSpec[];
}

const DEMO_COLLAB_GOALS: CollabGoalSpec[] = [
  {
    name: 'Cusco Trip — Family Challenge',
    description: 'Saving together for the family trip in the dry season.',
    category: 'vacation',
    challengeType: 'collaborative',
    target: 6000,
    targetInMonths: 9,
    created: { at: 1, day: 6 },
    goalDetails: {
      destination: 'Cusco & Machu Picchu, Peru',
      duration: '8 days',
      activities: 'Machu Picchu, Valle Sagrado, Rainbow Mountain',
      accommodation: 'Boutique hotel in the historic centre',
    },
    milestoneRewards: [
      { threshold: 50, reward: 'Dinner paid by the other one' },
      { threshold: 100, reward: 'Extra night in Aguas Calientes' },
    ],
    contributions: [
      { at: 1, day: 10, who: 'owner', amount: 400, note: 'First deposit' },
      { at: 1, day: 24, who: 'friend', amount: 350, note: 'First deposit' },
      { at: 2, day: 8, who: 'owner', amount: 450, note: 'Monthly saving' },
      { at: 2, day: 22, who: 'friend', amount: 300, note: 'Monthly saving' },
      { at: 3, day: 7, who: 'owner', amount: 400, note: 'Monthly saving' },
      { at: 3, day: 23, who: 'friend', amount: 250, note: 'A slower month' },
      { at: 4, day: 9, who: 'owner', amount: 500, note: 'Monthly saving' },
      { at: 4, day: 25, who: 'friend', amount: 300, note: 'Monthly saving' },
      { at: 5, day: 5, who: 'owner', amount: 450, note: 'Monthly saving' },
    ],
    messages: [
      { at: 1, day: 6, who: 'owner', text: 'Starting the trip fund — let us know if 6,000 is realistic.' },
      { at: 2, day: 9, who: 'friend', text: 'Looks right. I found flights for the first week of the month.' },
      { at: 3, day: 24, who: 'owner', text: 'Halfway there. Should we book the hotel now?' },
      { at: 4, day: 26, who: 'friend', text: 'Let us book next month, prices should drop after the holidays.' },
    ],
  },
  {
    name: 'Emergency Fund — Three Months',
    description: 'Three months of shared living costs, kept out of the current account.',
    category: 'emergency',
    challengeType: 'milestone',
    target: 12000,
    targetInMonths: 6,
    created: { at: 0, day: 5 },
    goalDetails: {
      purpose: 'Rent, food and bills if one of us loses work',
      coverage: 'Three months of household spending',
      timeline: 'Full amount before the end of next year',
    },
    milestoneRewards: [
      { threshold: 25, reward: 'Coffee on the other one' },
      { threshold: 50, reward: 'A weekend out of Lima' },
    ],
    contributions: [
      { at: 0, day: 12, who: 'owner', amount: 500, note: 'Opening deposit' },
      { at: 0, day: 20, who: 'friend', amount: 300, note: 'Opening deposit' },
      { at: 1, day: 5, who: 'owner', amount: 600, note: 'Monthly saving' },
      { at: 1, day: 19, who: 'friend', amount: 400, note: 'Monthly saving' },
      { at: 2, day: 6, who: 'owner', amount: 700, note: 'Bonus month' },
      { at: 2, day: 18, who: 'friend', amount: 350, note: 'Monthly saving' },
      { at: 3, day: 8, who: 'owner', amount: 800, note: 'Monthly saving' },
      { at: 3, day: 21, who: 'friend', amount: 450, note: 'Monthly saving' },
      { at: 4, day: 10, who: 'owner', amount: 900, note: 'Freelance month' },
      { at: 4, day: 24, who: 'friend', amount: 500, note: 'Monthly saving' },
      { at: 5, day: 7, who: 'owner', amount: 750, note: 'Monthly saving' },
    ],
    messages: [
      { at: 0, day: 5, who: 'owner', text: 'Let us keep this separate from the trip fund.' },
      { at: 2, day: 7, who: 'friend', text: 'Agreed. The bonus goes straight in this month.' },
      { at: 4, day: 11, who: 'owner', text: 'We passed half. Feels good to have a buffer.' },
    ],
  },
  {
    name: 'New Sofa — Who Saves More',
    description: 'Both of us put something aside each month; the sofa arrives in December.',
    category: 'home',
    challengeType: 'competitive',
    target: 2500,
    targetInMonths: 3,
    created: { at: 3, day: 2 },
    goalDetails: {
      propertyType: 'Living room',
      location: 'Local workshop in Surquillo',
      features: 'Three seats, washable cover',
      timeline: 'Delivered mid-December',
    },
    milestoneRewards: [{ threshold: 100, reward: 'The other one assembles it' }],
    contributions: [
      { at: 3, day: 6, who: 'owner', amount: 250, note: 'August' },
      { at: 3, day: 15, who: 'friend', amount: 200, note: 'August' },
      { at: 4, day: 5, who: 'owner', amount: 300, note: 'September' },
      { at: 4, day: 17, who: 'friend', amount: 250, note: 'September' },
      { at: 5, day: 3, who: 'owner', amount: 200, note: 'October' },
    ],
    messages: [
      { at: 3, day: 2, who: 'owner', text: 'I am ahead this month.' },
      { at: 4, day: 18, who: 'friend', text: 'Not for long — September was my turn.' },
    ],
  },
];

/* -------------------------------------------------------------------------- *
 * 9. Modules
 * -------------------------------------------------------------------------- */

/**
 * The imports above are static, so `server/db` and `server/encryption` are already initialised by
 * the time the ENCRYPTION_KEY check below runs. That is safe in both directions: with a bad key in
 * production the import itself refuses to load, and in development the key is only a throwaway
 * until the first write — and the check runs before the first write, so a throwaway key can never
 * reach a row.
 */

/**
 * The stand-in second participant.
 *
 * A shared goal needs two people before it looks like anything, and the shortest honest way to
 * get there is one clearly-labelled account that never signs in: it has no plan, no reminders and
 * notifications are off, so nothing is ever sent to it. `--reset` removes it again.
 */
const DEMO_FRIEND = {
  id: 'user_demoFriendKaptiaSeed001',
  email: 'demo.friend@kaptia.app',
  firstName: 'Demo',
  lastName: 'Friend',
};

/* -------------------------------------------------------------------------- *
 * 10. Helpers
 * -------------------------------------------------------------------------- */

const slug = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** The calendar day a window slot refers to, at noon in Lima. */
function windowDate(at: number, day: number): Date {
  const month = WINDOW[at];
  if (!month) throw new Error(`WINDOW has no month at index ${at}`);
  return limaDate(month.year, month.month, Math.min(day, daysInMonth(month.year, month.month)));
}

/** The last moment that counts as "today" for the goal dates; never in the future. */
function goalTargetDate(monthsAhead: number): Date {
  const month = shiftMonth(TODAY.year, TODAY.month, monthsAhead);
  return limaDate(month.year, month.month, daysInMonth(month.year, month.month), 23);
}

/* -------------------------------------------------------------------------- *
 * 11. The plan — pure data, so `--dry-run` can print it without touching a row
 * -------------------------------------------------------------------------- */

interface PlannedTransaction {
  key: string;
  date: Date;
  category: string;
  description: string;
  type: 'income' | 'expense';
  amount: number;
}

interface PlannedBudget {
  category: string;
  amount: number;
  startDate: Date;
  endDate: Date;
}

function buildTransactionPlan(): PlannedTransaction[] {
  const planned: PlannedTransaction[] = [];

  const add = (row: PlannedTransaction): void => {
    // Nothing is written ahead of today: the current month is only as complete as it really is.
    if (inTheFuture(row.date)) return;
    planned.push(row);
  };

  WINDOW.forEach((month, index) => {
    const shape = MONTH_SHAPE[index] ?? MONTH_SHAPE[MONTH_SHAPE.length - 1];
    const tag = `${month.year}-${String(month.month).padStart(2, '0')}`;
    const lastDay = daysInMonth(month.year, month.month);

    for (const fixed of MONTHLY_FIXED) {
      const seed = `${tag}-${slug(fixed.category)}`;
      const amount =
        fixed.amount ?? amountBetween(seed, fixed.min ?? 0, fixed.max ?? 0);
      add({
        key: demoKey([tag, slug(fixed.category)]),
        date: limaDate(month.year, month.month, Math.min(fixed.day, lastDay)),
        category: fixed.category,
        description: fixed.description,
        type: fixed.type,
        amount,
      });
    }

    const runs: Array<{ category: string; spec: RunSpec }> = [
      ...GROCERY_RUNS.slice(0, shape.groceries).map((spec) => ({ category: 'Groceries', spec })),
      ...COFFEE_RUNS.slice(0, shape.coffee).map((spec) => ({ category: 'Coffee & Snacks', spec })),
      ...RESTAURANT_RUNS.slice(0, shape.restaurants).map((spec) => ({ category: 'Restaurants', spec })),
      ...RIDE_RUNS.slice(0, shape.rides).map((spec) => ({ category: 'Transportation', spec })),
    ];

    runs.forEach(({ category, spec }, runIndex) => {
      const seed = `${tag}-${slug(category)}-${runIndex + 1}`;
      add({
        key: demoKey([tag, slug(category), runIndex + 1]),
        date: limaDate(month.year, month.month, Math.min(spec.day, lastDay)),
        category,
        description: spec.description,
        type: 'expense',
        amount: amountBetween(seed, spec.min, spec.max),
      });
    });
  });

  for (const oneOff of ONE_OFFS) {
    const month = WINDOW[oneOff.at];
    if (!month) continue;
    const tag = `${month.year}-${String(month.month).padStart(2, '0')}`;
    add({
      key: demoKey([tag, slug(oneOff.category), slug(oneOff.description)]),
      date: windowDate(oneOff.at, oneOff.day),
      category: oneOff.category,
      description: oneOff.description,
      type: oneOff.type,
      amount: oneOff.amount,
    });
  }

  return planned.sort((left, right) => left.date.getTime() - right.date.getTime());
}

function buildBudgetPlan(): PlannedBudget[] {
  const planned: PlannedBudget[] = [];

  WINDOW.forEach((month, index) => {
    const lastDay = daysInMonth(month.year, month.month);
    // Midnight in Lima, which is what makes `calendarDaysRange` cover the whole month.
    const startDate = limaDate(month.year, month.month, 1, 0);
    const endDate = limaDate(month.year, month.month, lastDay, 0);
    const specs = [...MONTHLY_BUDGETS, ...SEASONAL_BUDGETS.filter((budget) => budget.at === index)];

    for (const spec of specs) {
      planned.push({ category: spec.category, amount: spec.amount, startDate, endDate });
    }
  });

  return planned;
}

/* -------------------------------------------------------------------------- *
 * 12. Writing — everything below goes through `storage`, never raw INSERTs
 * -------------------------------------------------------------------------- */

async function findOwner(): Promise<{ id: string; email: string | null }> {
  const [owner] = await db
    .select({ id: schema.users.id, email: schema.users.email })
    .from(schema.users)
    .where(sql`lower(${schema.users.email}) = lower(${targetEmail})`)
    .limit(1);

  if (!owner) fail(`No account exists for ${targetEmail}. Sign in once so the app creates it.`);
  return owner;
}

async function ensureDemoFriend(): Promise<string> {
  await storage.upsertUser({
    id: DEMO_FRIEND.id,
    email: DEMO_FRIEND.email,
    firstName: DEMO_FRIEND.firstName,
    lastName: DEMO_FRIEND.lastName,
    plan: 'free',
  });

  // No plan, no mail, the same currency and zone as the account it belongs to.
  await db
    .update(schema.users)
    .set({
      currency: 'S/',
      timezone: 'America/Lima',
      language: 'en',
      emailNotifications: false,
    })
    .where(eq(schema.users.id, DEMO_FRIEND.id));

  return DEMO_FRIEND.id;
}

async function ensureCategories(ownerId: string): Promise<Map<string, number>> {
  const existing = await storage.getCategories(ownerId);
  const byName = new Map<string, number>();
  for (const category of existing) byName.set(category.name.toLowerCase(), category.id);

  let touched = 0;
  for (const spec of DEMO_CATEGORIES) {
    if (byName.has(spec.name.toLowerCase())) continue;
    touched += 1;
    if (!confirm) continue;

    const row = await storage.createCategory({
      userId: ownerId,
      name: spec.name,
      icon: spec.icon,
      color: spec.color,
      type: spec.type,
    });
    byName.set(spec.name.toLowerCase(), row.id);
  }

  console.log(
    `  categories   ${confirm ? 'created' : 'to create'}: ${String(touched).padStart(3)}   (${byName.size} available with the shared ones)`,
  );
  return byName;
}

async function seedTransactions(
  ownerId: string,
  plan: PlannedTransaction[],
  categoryIds: Map<string, number>,
): Promise<void> {
  const alreadyThere = new Set(
    (
      await db
        .select({ key: schema.transactions.clientRequestId })
        .from(schema.transactions)
        .where(
          and(
            eq(schema.transactions.userId, ownerId),
            like(schema.transactions.clientRequestId, 'demo-%'),
          ),
        )
    )
      .map((row) => row.key)
      .filter((key): key is string => Boolean(key)),
  );

  const unknownCategories = new Set<string>();
  let created = 0;
  let skipped = 0;

  for (const row of plan) {
    if (alreadyThere.has(row.key)) {
      skipped += 1;
      continue;
    }

    const categoryId = categoryIds.get(row.category.toLowerCase()) ?? null;
    // A name that is neither in this database nor part of the demo set is a typo in the plan.
    if (categoryId === null && !DEMO_CATEGORY_NAMES.has(row.category)) {
      unknownCategories.add(row.category);
    }

    created += 1;
    if (!confirm) continue;

    // The key is what makes a second run harmless: storage answers with the row the first run
    // created instead of writing a duplicate, and the `demo-` prefix is what `--reset` finds.
    await storage.createTransaction(
      {
        userId: ownerId,
        categoryId,
        amount: money(row.amount),
        description: row.description,
        type: row.type,
        date: row.date,
      },
      row.key,
    );
  }

  if (unknownCategories.size > 0) {
    console.log(`  ! no category found for: ${Array.from(unknownCategories).join(', ')}`);
  }
  console.log(
    `  transactions ${confirm ? 'created' : 'to create'}: ${String(created).padStart(3)}   (already present: ${skipped})`,
  );
}

async function seedBudgets(
  ownerId: string,
  plan: PlannedBudget[],
  categoryIds: Map<string, number>,
): Promise<void> {
  const existing = await db
    .select({ categoryId: schema.budgets.categoryId, startDate: schema.budgets.startDate })
    .from(schema.budgets)
    .where(eq(schema.budgets.userId, ownerId));

  const dayKey = (date: Date): string => date.toISOString().slice(0, 10);
  const existingKeys = new Set(existing.map((row) => `${row.categoryId}|${dayKey(row.startDate)}`));

  let created = 0;
  let skipped = 0;

  for (const row of plan) {
    const categoryId = categoryIds.get(row.category.toLowerCase()) ?? null;

    // In a dry run the demo categories have not been created yet; the rows still count.
    if (categoryId === null) {
      if (confirm) continue;
      created += 1;
      continue;
    }

    const key = `${categoryId}|${dayKey(row.startDate)}`;
    if (existingKeys.has(key)) {
      skipped += 1;
      continue;
    }

    created += 1;
    if (!confirm) continue;

    await storage.createBudget({
      userId: ownerId,
      categoryId,
      amount: money(row.amount),
      period: 'monthly',
      startDate: row.startDate,
      endDate: row.endDate,
    });
  }

  console.log(
    `  budgets      ${confirm ? 'created' : 'to create'}: ${String(created).padStart(3)}   (already present: ${skipped})`,
  );
}

async function seedGoals(ownerId: string): Promise<void> {
  // Goal names are encrypted, so the comparison has to happen after decryption — `getUserGoals`
  // is the only read that does that.
  const existing = new Set((await storage.getUserGoals(ownerId)).map((goal) => goal.name));

  let created = 0;
  let skipped = 0;

  for (const spec of DEMO_GOALS) {
    if (existing.has(spec.name)) {
      skipped += 1;
      continue;
    }

    created += 1;
    if (!confirm) continue;

    await storage.createGoal({
      userId: ownerId,
      name: spec.name,
      description: spec.description,
      targetAmount: money(spec.target),
      currentAmount: money(spec.current),
      targetDate: goalTargetDate(spec.targetInMonths),
      category: spec.category,
      status: spec.status,
    });
  }

  console.log(
    `  goals        ${confirm ? 'created' : 'to create'}: ${String(created).padStart(3)}   (already present: ${skipped})`,
  );
}

/* -------------------------------------------------------------------------- *
 * 13. Collaborative goals
 * -------------------------------------------------------------------------- */

interface DatedContribution extends Omit<ContributionSpec, 'at' | 'day'> {
  when: Date;
}

/** A contribution only exists if its day has already happened. */
function datedContributions(spec: CollabGoalSpec): DatedContribution[] {
  return spec.contributions
    .map((contribution) => {
      const when = pastDate(contribution.at, contribution.day);
      return when
        ? { who: contribution.who, amount: contribution.amount, note: contribution.note, when }
        : null;
    })
    .filter((row): row is DatedContribution => row !== null)
    .sort((left, right) => left.when.getTime() - right.when.getTime());
}

function pastDate(at: number, day: number): Date | null {
  const date = windowDate(at, day);
  return inTheFuture(date) ? null : date;
}

/**
 * Contributions are written directly instead of through `storage.addGoalContribution`, for one
 * reason: that method stamps `now` on the row, and a history where every deposit happened today
 * is exactly what this script exists to avoid. The two totals it maintains are recalculated here
 * from the rows themselves, the same way it does.
 *
 * Each row also gets its own activity, so the goal's timeline reads in the right order.
 */
async function seedContributions(
  goalId: number,
  ownerId: string,
  friendId: string,
  spec: CollabGoalSpec,
): Promise<DatedContribution[]> {
  const rows = datedContributions(spec);
  if (rows.length === 0) return rows;

  const lastContribution = new Map<string, Date>();

  for (const row of rows) {
    const userId = row.who === 'owner' ? ownerId : friendId;

    await db.insert(schema.goalContributions).values({
      goalId,
      userId,
      amount: money(row.amount),
      description: row.note,
      contributionType: 'manual',
      createdAt: row.when,
    });

    await db.insert(schema.challengeActivities).values({
      goalId,
      userId,
      activityType: 'contribution',
      title: 'Made a contribution',
      description: row.note,
      amount: money(row.amount),
      createdAt: row.when,
    });

    lastContribution.set(userId, row.when);
  }

  const totalFor = async (userId?: string): Promise<string> => {
    const [total] = await db
      .select({ total: sql<string>`COALESCE(SUM(${schema.goalContributions.amount}), 0)` })
      .from(schema.goalContributions)
      .where(
        userId
          ? and(
              eq(schema.goalContributions.goalId, goalId),
              eq(schema.goalContributions.userId, userId),
            )
          : eq(schema.goalContributions.goalId, goalId),
      );
    return total?.total ?? '0.00';
  };

  const goalTotal = await totalFor();
  await db
    .update(schema.collaborativeGoals)
    .set({ currentAmount: goalTotal, updatedAt: rows[rows.length - 1].when })
    .where(eq(schema.collaborativeGoals.id, goalId));

  for (const userId of [ownerId, friendId]) {
    await db
      .update(schema.collaborativeGoalParticipants)
      .set({
        currentContribution: await totalFor(userId),
        lastContribution: lastContribution.get(userId) ?? null,
      })
      .where(
        and(
          eq(schema.collaborativeGoalParticipants.goalId, goalId),
          eq(schema.collaborativeGoalParticipants.userId, userId),
        ),
      );
  }

  return rows;
}

async function seedMessages(
  goalId: number,
  ownerId: string,
  friendId: string,
  spec: CollabGoalSpec,
): Promise<void> {
  for (const message of spec.messages) {
    const when = pastDate(message.at, message.day);
    if (!when) continue;

    await db.insert(schema.goalMessages).values({
      goalId,
      userId: message.who === 'owner' ? ownerId : friendId,
      message: message.text,
      messageType: 'text',
      createdAt: when,
      updatedAt: when,
    });
  }
}

/**
 * Milestones are awarded by `storage.checkAndCreateMilestones`, which is the code that decides
 * when one is due — but it stamps `achievedAt` with the current time. The row is right, the date
 * is not: a goal that crossed 50% in June did not cross it today. This finds the deposit that
 * crossed each threshold and moves the achievement, and its activity, to that day.
 */
async function alignMilestoneDates(goalId: number, spec: CollabGoalSpec): Promise<void> {
  const rows = datedContributions(spec);
  const crossing = new Map<number, Date>();
  let running = 0;

  for (const row of rows) {
    running += row.amount;
    const percentage = (running / spec.target) * 100;
    for (const threshold of [25, 50, 75, 100]) {
      if (percentage >= threshold && !crossing.has(threshold)) crossing.set(threshold, row.when);
    }
  }

  for (const [threshold, when] of Array.from(crossing.entries())) {
    const amountAtThreshold = money((spec.target * threshold) / 100);

    await db
      .update(schema.milestoneAchievements)
      .set({ achievedAt: when })
      .where(
        and(
          eq(schema.milestoneAchievements.goalId, goalId),
          eq(schema.milestoneAchievements.milestoneType, 'percentage'),
          eq(schema.milestoneAchievements.targetAmount, amountAtThreshold),
        ),
      );

    await db
      .update(schema.challengeActivities)
      .set({ createdAt: when })
      .where(
        and(
          eq(schema.challengeActivities.goalId, goalId),
          eq(schema.challengeActivities.title, `Milestone Achieved: ${threshold}% Complete!`),
        ),
      );
  }
}

async function seedCollaborativeGoals(ownerId: string, friendId: string): Promise<void> {
  const existing = new Set(
    (await storage.getUserCollaborativeGoals(ownerId)).map((goal) => goal.name),
  );

  let created = 0;
  let skipped = 0;

  for (const spec of DEMO_COLLAB_GOALS) {
    if (existing.has(spec.name)) {
      skipped += 1;
      continue;
    }

    created += 1;
    if (!confirm) continue;

    const createdOn = pastDate(spec.created.at, spec.created.day) ?? new Date();

    const goal = await storage.createCollaborativeGoal({
      name: spec.name,
      description: spec.description,
      targetAmount: money(spec.target),
      currentAmount: '0.00',
      targetDate: goalTargetDate(spec.targetInMonths),
      category: spec.category,
      challengeType: spec.challengeType,
      status: 'active',
      createdBy: ownerId,
      isPublic: false,
      milestoneRewards: spec.milestoneRewards,
      goalDetails: spec.goalDetails,
    });

    // storage stamps "now" on the goal and adds the creator as a participant; the story starts
    // months earlier, so both dates move to the day the goal was really created.
    await db
      .update(schema.collaborativeGoals)
      .set({ createdAt: createdOn, updatedAt: createdOn })
      .where(eq(schema.collaborativeGoals.id, goal.id));

    await storage.joinCollaborativeGoal(goal.id, friendId);
    const friendJoinedOn = pastDate(spec.created.at, spec.created.day + 2) ?? createdOn;

    for (const [userId, joinedAt] of [
      [ownerId, createdOn],
      [friendId, friendJoinedOn],
    ] as const) {
      await db
        .update(schema.collaborativeGoalParticipants)
        .set({ joinedAt })
        .where(
          and(
            eq(schema.collaborativeGoalParticipants.goalId, goal.id),
            eq(schema.collaborativeGoalParticipants.userId, userId),
          ),
        );
    }

    // The join activity `joinCollaborativeGoal` writes is stamped now; move it to the join day.
    await db
      .update(schema.challengeActivities)
      .set({ createdAt: friendJoinedOn })
      .where(
        and(
          eq(schema.challengeActivities.goalId, goal.id),
          eq(schema.challengeActivities.userId, friendId),
          eq(schema.challengeActivities.activityType, 'join'),
        ),
      );

    await seedContributions(goal.id, ownerId, friendId, spec);
    await seedMessages(goal.id, ownerId, friendId, spec);

    // Award whatever the totals have already reached, then correct the dates of those awards.
    await storage.checkAndCreateMilestones(goal.id);
    await alignMilestoneDates(goal.id, spec);

    console.log(`  + ${spec.name}`);
  }

  console.log(
    `  shared goals ${confirm ? 'created' : 'to create'}: ${String(created).padStart(3)}   (already present: ${skipped})`,
  );
}

/* -------------------------------------------------------------------------- *
 * 14. Reset — only the rows this script owns, never the person's own
 * -------------------------------------------------------------------------- */

async function resetDemoData(ownerId: string): Promise<void> {
  const sharedNames = new Set(DEMO_COLLAB_GOALS.map((goal) => goal.name));
  const personalNames = new Set(DEMO_GOALS.map((goal) => goal.name));

  const sharedGoals = (await storage.getUserCollaborativeGoals(ownerId)).filter((goal) =>
    sharedNames.has(goal.name),
  );
  const personalGoals = (await storage.getUserGoals(ownerId)).filter((goal) =>
    personalNames.has(goal.name),
  );

  const ownedCategoryIds = new Set(
    (await storage.getCategories(ownerId))
      .filter((category) => category.userId === ownerId && DEMO_CATEGORY_NAMES.has(category.name))
      .map((category) => category.id),
  );

  const budgetIds = (
    await db
      .select({ id: schema.budgets.id, categoryId: schema.budgets.categoryId })
      .from(schema.budgets)
      .where(eq(schema.budgets.userId, ownerId))
  )
    .filter((row) => row.categoryId !== null && ownedCategoryIds.has(row.categoryId))
    .map((row) => row.id);

  const transactionIds = (
    await db
      .select({ id: schema.transactions.id })
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.userId, ownerId),
          like(schema.transactions.clientRequestId, 'demo-%'),
        ),
      )
  ).map((row) => row.id);

  const [friendRow] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.id, DEMO_FRIEND.id))
    .limit(1);

  console.log('Reset:');
  console.log(`  shared goals to remove : ${sharedGoals.length}`);
  console.log(`  goals to remove        : ${personalGoals.length}`);
  console.log(`  budgets to remove      : ${budgetIds.length}`);
  console.log(`  transactions to remove : ${transactionIds.length}`);
  console.log(`  categories to remove   : ${ownedCategoryIds.size}`);
  console.log(`  stand-in participant   : ${friendRow ? 'yes' : 'no'}`);

  if (!confirm) return;

  // Children first: a category cannot be deleted while a transaction still points at it.
  for (const goal of sharedGoals) await storage.deleteCollaborativeGoal(goal.id, ownerId);
  for (const goal of personalGoals) await storage.deleteGoal(goal.id, ownerId);
  for (const budgetId of budgetIds) await storage.deleteBudget(budgetId, ownerId);
  for (const transactionId of transactionIds) await storage.deleteTransaction(transactionId, ownerId);

  for (const categoryId of Array.from(ownedCategoryIds)) {
    try {
      await storage.deleteCategory(categoryId, ownerId);
    } catch (error) {
      console.log(
        `  ! category ${categoryId} kept: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (friendRow) {
    try {
      await storage.deleteUserCompletely(DEMO_FRIEND.id);
    } catch (error) {
      console.log(
        `  ! stand-in participant kept: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  console.log('');
}

/* -------------------------------------------------------------------------- *
 * 15. What the app will actually show, read back through the same code paths
 * -------------------------------------------------------------------------- */

/** The month a moment falls in, in the account's own time zone. */
function monthKey(date: Date): string {
  const lima = new Date(date.getTime() - LIMA_UTC_OFFSET_HOURS * 3_600_000);
  return `${lima.getUTCFullYear()}-${String(lima.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function printSummary(ownerId: string): Promise<void> {
  const rows = await db
    .select({
      date: schema.transactions.date,
      amount: schema.transactions.amount,
      type: schema.transactions.type,
    })
    .from(schema.transactions)
    .where(eq(schema.transactions.userId, ownerId));

  const months = new Map<string, { income: number; expense: number; count: number }>();
  for (const row of rows) {
    const key = monthKey(row.date);
    const bucket = months.get(key) ?? { income: 0, expense: 0, count: 0 };
    if (row.type === 'income') bucket.income += Number(row.amount);
    else bucket.expense += Number(row.amount);
    bucket.count += 1;
    months.set(key, bucket);
  }

  console.log('\nWhat the app will show:');
  console.log('  month      income     expenses          net   rows');
  for (const key of Array.from(months.keys()).sort()) {
    const bucket = months.get(key);
    if (!bucket) continue;
    const net = bucket.income - bucket.expense;
    console.log(
      `  ${key}  ${bucket.income.toFixed(2).padStart(9)}  ${bucket.expense
        .toFixed(2)
        .padStart(11)}  ${net.toFixed(2).padStart(11)}  ${String(bucket.count).padStart(4)}`,
    );
  }

  const budgets = await storage.getUserBudgets(ownerId);
  const thisMonth = monthKey(new Date());
  const currentBudgets = budgets.filter((budget) => monthKey(budget.startDate) === thisMonth);
  console.log(`\n  budgets: ${budgets.length} in total, ${currentBudgets.length} in ${thisMonth}`);
  for (const budget of currentBudgets) {
    console.log(
      `    ${(budget.categoryName ?? 'No category').padEnd(20)} spent ${Number(budget.spent).toFixed(2).padStart(9)} of ${Number(budget.amount).toFixed(2).padStart(9)}`,
    );
  }

  const goals = await storage.getUserGoals(ownerId);
  console.log(`\n  goals: ${goals.length}`);
  for (const goal of goals) {
    console.log(
      `    ${goal.name.padEnd(24)} ${Number(goal.currentAmount).toFixed(2).padStart(9)} of ${Number(goal.targetAmount).toFixed(2).padStart(9)}`,
    );
  }

  const sharedGoals = await storage.getUserCollaborativeGoals(ownerId);
  console.log(`\n  shared goals: ${sharedGoals.length}`);
  for (const goal of sharedGoals) {
    const target = Number(goal.targetAmount);
    const progress = target > 0 ? (Number(goal.currentAmount) / target) * 100 : 0;
    console.log(
      `    ${goal.name.padEnd(32)} ${progress.toFixed(1).padStart(5)}%   ${goal.participants.length} participant(s)`,
    );
  }

  // The point of writing through storage: an app read must give the words back, not ciphertext.
  const appView = await storage.getUserTransactions(ownerId, 1000);
  const broken = appView.filter((row) => row.description.startsWith('[unreadable'));
  console.log(
    broken.length === 0
      ? '\n  Every description decrypts, so the app reads this data normally.'
      : `\n  ! ${broken.length} description(s) cannot be decrypted with the current ENCRYPTION_KEY.`,
  );
}

/* -------------------------------------------------------------------------- *
 * 16. Entry point
 * -------------------------------------------------------------------------- */

async function main(): Promise<void> {
  const first = WINDOW[0];
  const last = WINDOW[WINDOW.length - 1];
  console.log(`Database : ${databaseHost}`);
  console.log(`Account  : ${targetEmail}`);
  console.log(`Mode     : ${confirm ? 'WRITE' : 'dry run — nothing is written'}`);
  console.log(
    `Window   : ${first.year}-${String(first.month).padStart(2, '0')} .. ${last.year}-${String(last.month).padStart(2, '0')}`,
  );
  console.log('');

  const owner = await findOwner();

  if (reset) await resetDemoData(owner.id);

  const transactionPlan = buildTransactionPlan();
  const budgetPlan = buildBudgetPlan();

  console.log('Seeding:');
  const categoryIds = await ensureCategories(owner.id);
  await seedTransactions(owner.id, transactionPlan, categoryIds);
  await seedBudgets(owner.id, budgetPlan, categoryIds);
  await seedGoals(owner.id);

  if (!confirm) {
    console.log(
      `  shared goals to create: ${String(DEMO_COLLAB_GOALS.length).padStart(3)}   (with one stand-in participant)`,
    );
    console.log('\nDry run: nothing was written. Re-run with --confirm to apply.');
    return;
  }

  const friendId = await ensureDemoFriend();
  await seedCollaborativeGoals(owner.id, friendId);
  await printSummary(owner.id);
}

let exitCode = 0;

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
    exitCode = 1;
  })
  .finally(() => {
    closePool()
      .catch(() => {})
      .finally(() => process.exit(exitCode));
  });













