/**
 * Client for the independent PDF processor (`external-services/pdf-processor`),
 * deployed as a standalone app on https://pdf-processor.formatika.dev.
 *
 * The processor owns rendering. This module only builds the payload it expects
 * and streams the returned PDF back. Contract (see the processor's README):
 *
 *   POST {PDF_SERVICE_URL}/generate-pdf
 *   x-api-key: {PDF_API_KEY}
 *   {
 *     userData:    { firstName, lastName, email },
 *     transactions:[{ month, balance, date, description, categoryName, amount, type }],
 *     categories:  [{ name, amount, color? }],
 *     budgets:     [{ categoryName, amount, spent }],
 *     goals:       [{ name, targetAmount, currentAmount }],
 *     insights:    [{ title, description }],
 *     language:    'en-us',
 *     period:      '2026-10',
 *     currency:    '€'            // display symbol, not an ISO code
 *   }
 */
import fetch from 'node-fetch';
import { requestIdHeaders } from './requestContext.js';

const DEFAULT_SERVICE_URL = 'https://pdf-processor.formatika.dev';

export class PdfProcessorError extends Error {
  constructor(message: string, public statusCode = 502, public details?: string) {
    super(message);
    this.name = 'PdfProcessorError';
  }
}

function serviceUrl(): string {
  return (process.env.PDF_SERVICE_URL || DEFAULT_SERVICE_URL).trim().replace(/\/+$/, '');
}

function apiKey(): string {
  return (process.env.PDF_API_KEY || '').trim();
}

function timeoutMs(): number {
  return Number(process.env.PDF_SERVICE_TIMEOUT_MS || 60000);
}

export interface ProcessorTransaction {
  month: string;
  balance: number;
  date: string;
  description: string;
  categoryName?: string;
  amount: number | string;
  type?: 'income' | 'expense';
}

export interface ProcessorMonthlyPoint {
  /** `YYYY-MM` */
  period: string;
  income: number;
  expenses: number;
  net: number;
}

export interface ProcessorPayload {
  userData: { firstName: string; lastName: string; email: string };
  transactions: ProcessorTransaction[];
  categories: Array<{ name: string; amount: number; percentage?: number; color?: string }>;
  budgets?: Array<{ categoryName: string; amount: number; spent: number }>;
  goals?: Array<{ name: string; targetAmount: number; currentAmount: number }>;
  insights?: Array<{ title: string; description: string }>;
  language?: string;
  period?: string;
  /** Display currency symbol (`$`, `€`, `Kč`, …) — not an ISO code. */
  currency?: string;
  /** The three numbers a financial report exists for. */
  totals?: { income: number; expenses: number; net: number };
  /**
   * One point per month the report covers, for the trend chart.
   *
   * The chart used to be drawn from the first ten rows with the same "balance" copied onto every
   * month, which produced a flat line on a report covering a whole year. The monthly series is
   * computed here, from the rows, so the chart is the period and not a sample of it.
   */
  monthly?: ProcessorMonthlyPoint[];
  /** The period as calendar days, so the report can print it in the reader's language. */
  range?: { from?: string; to?: string };
  /** Facts the report states in words; rendered in the reader's language, never pre-translated. */
  metrics?: {
    savingsRate?: number;
    topCategory?: { name: string; amount: number; percentage?: number };
  };
}

/** Sends the payload to the processor and returns the PDF bytes. */
export async function requestPdf(payload: ProcessorPayload): Promise<Buffer> {
  const url = serviceUrl();
  const key = apiKey();

  let response;
  try {
    response = await fetch(`${url}/generate-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(key ? { 'x-api-key': key } : {}),
        // Same id as our access-log line, so a slow render is one search across both services.
        ...requestIdHeaders(),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs()),
    });
  } catch (error) {
    throw new PdfProcessorError(
      `PDF processor unreachable at ${url}`,
      502,
      error instanceof Error ? error.message : String(error)
    );
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new PdfProcessorError(
      `PDF processor responded with ${response.status}`,
      502,
      body.slice(0, 500)
    );
  }

  return Buffer.from(await response.arrayBuffer());
}

/** Splits a display name into first/last for the processor header. */
function splitName(name?: string | null): { firstName: string; lastName: string } {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: 'Kaptia', lastName: 'User' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') || ' ' };
}

/** The processor renders a currency symbol (`$`, `€`, `Kč`), max 5 characters. */
function normalizeCurrency(currency?: string | null): string {
  return (currency || '').trim().slice(0, 5) || '$';
}

interface SourceTransaction {
  date: Date | string;
  description: string;
  amount: string | number;
  type: string;
  categoryName?: string;
}

function mapTransactions(
  rows: SourceTransaction[],
  balanceByMonth: Map<string, number>
): ProcessorTransaction[] {
  return rows.map((t) => {
    const date = typeof t.date === 'string' ? t.date : t.date.toISOString();
    const month = date.slice(0, 7);
    return {
      month,
      balance: balanceByMonth.get(month) ?? 0,
      date,
      description: t.description,
      categoryName: t.categoryName,
      amount: Number(t.amount) || 0,
      type: t.type === 'income' ? ('income' as const) : ('expense' as const),
    };
  });
}

export interface TrendsPayloadInput {
  userName?: string | null;
  email?: string | null;
  language: string;
  period: string;
  currency?: string;
  monthly: Array<{ period: string; income: number; expenses: number; netBalance: number }>;
  categories: Array<{ name: string; amount: number; percentage?: number; color?: string }>;
  transactions: SourceTransaction[];
  budgets?: Array<{ categoryName?: string; amount: string | number; spent?: number }>;
  goals?: Array<{ name: string; targetAmount: string | number; currentAmount?: string | number }>;
}

/** Payload for the Premium "Trends PDF" (`/api/generate-trends-pdf`). */
export function buildTrendsPayload(input: TrendsPayloadInput): ProcessorPayload {
  const { firstName, lastName } = splitName(input.userName);
  const balanceByMonth = new Map(input.monthly.map((m) => [m.period, m.netBalance]));
  const income = input.monthly.reduce((sum, m) => sum + m.income, 0);
  const expenses = input.monthly.reduce((sum, m) => sum + m.expenses, 0);
  const top = [...input.categories].sort((a, b) => b.amount - a.amount)[0];

  return {
    userData: { firstName, lastName, email: input.email || '' },
    transactions: mapTransactions(input.transactions, balanceByMonth),
    categories: input.categories
      .slice()
      .sort((a, b) => b.amount - a.amount)
      .map((c) => ({
        name: c.name,
        amount: c.amount,
        color: c.color,
        ...(expenses > 0 ? { percentage: (c.amount / expenses) * 100 } : {}),
      })),
    budgets: (input.budgets || []).map((b) => ({
      categoryName: b.categoryName || 'Uncategorized',
      amount: Number(b.amount) || 0,
      spent: Number(b.spent) || 0,
    })),
    goals: (input.goals || []).map((g) => ({
      name: g.name,
      targetAmount: Number(g.targetAmount) || 0,
      currentAmount: Number(g.currentAmount) || 0,
    })),
    totals: { income, expenses, net: income - expenses },
    monthly: input.monthly
      .slice()
      .sort((a, b) => a.period.localeCompare(b.period))
      .map((m) => ({ period: m.period, income: m.income, expenses: m.expenses, net: m.netBalance })),
    metrics: {
      ...(income > 0 ? { savingsRate: ((income - expenses) / income) * 100 } : {}),
      ...(top
        ? {
            topCategory: {
              name: top.name,
              amount: top.amount,
              percentage: expenses > 0 ? (top.amount / expenses) * 100 : undefined,
            },
          }
        : {}),
    },
    language: input.language,
    period: input.period,
    currency: normalizeCurrency(input.currency),
  };
}

export interface MonthlyPayloadInput {
  userName?: string | null;
  email?: string | null;
  language: string;
  /** Only when the caller has a readable period label; otherwise the report names it itself. */
  period?: string;
  currency?: string;
  totals: { income: number; expenses: number };
  transactions: SourceTransaction[];
  categories: Array<{ name: string; amount: number }>;
  budgets?: Array<{ categoryName?: string; amount: string | number; spent?: number }>;
  goals?: Array<{ name: string; targetAmount: string | number; currentAmount?: string | number }>;
  /** Month-by-month series, computed from the rows in the person's own zone. */
  monthly?: Array<{ period: string; income: number; expenses: number }>;
  range?: { from?: string; to?: string };
}

/**
 * Payload for the export report (`/api/export?format=pdf`).
 *
 * The report is everything the person asked to export: every row, every category, the totals,
 * one point per month, and the two facts worth writing in a sentence. Nothing is pre-worded here
 * — labels belong to the processor, which knows the reader's language.
 */
export function buildMonthlyPayload(input: MonthlyPayloadInput): ProcessorPayload {
  const { firstName, lastName } = splitName(input.userName);

  const totals = {
    income: input.totals.income,
    expenses: input.totals.expenses,
    net: input.totals.income - input.totals.expenses,
  };

  const monthly = (input.monthly ?? [])
    .slice()
    .sort((a, b) => a.period.localeCompare(b.period))
    .map((m) => ({
      period: m.period,
      income: m.income,
      expenses: m.expenses,
      net: m.income - m.expenses,
    }));

  const balanceByMonth = new Map(monthly.map((m) => [m.period, m.net]));

  const categories = input.categories
    .slice()
    .sort((a, b) => b.amount - a.amount)
    .map((c) => ({
      name: c.name,
      amount: c.amount,
      ...(totals.expenses > 0 ? { percentage: (c.amount / totals.expenses) * 100 } : {}),
    }));

  const top = categories[0];

  return {
    userData: { firstName, lastName, email: input.email || '' },
    // Oldest first: a report reads like a statement, and the table no longer stops at twelve rows.
    transactions: mapTransactions(
      input.transactions.slice().sort((a, b) => +new Date(a.date) - +new Date(b.date)),
      balanceByMonth,
    ),
    categories,
    budgets: (input.budgets || []).map((b) => ({
      categoryName: b.categoryName || 'Uncategorized',
      amount: Number(b.amount) || 0,
      spent: Number(b.spent) || 0,
    })),
    goals: (input.goals || []).map((g) => ({
      name: g.name,
      targetAmount: Number(g.targetAmount) || 0,
      currentAmount: Number(g.currentAmount) || 0,
    })),
    totals,
    monthly,
    ...(input.range ? { range: input.range } : {}),
    metrics: {
      ...(totals.income > 0
        ? { savingsRate: ((totals.income - totals.expenses) / totals.income) * 100 }
        : {}),
      ...(top ? { topCategory: { name: top.name, amount: top.amount, percentage: top.percentage } } : {}),
    },
    language: input.language,
    period: input.period,
    currency: normalizeCurrency(input.currency),
  };
}
