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

export interface ProcessorPayload {
  userData: { firstName: string; lastName: string; email: string };
  transactions: ProcessorTransaction[];
  categories: Array<{ name: string; amount: number; color?: string }>;
  budgets?: Array<{ categoryName: string; amount: number; spent: number }>;
  goals?: Array<{ name: string; targetAmount: number; currentAmount: number }>;
  insights?: Array<{ title: string; description: string }>;
  language?: string;
  period?: string;
  /** Display currency symbol (`$`, `€`, `Kč`, …) — not an ISO code. */
  currency?: string;
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

function buildInsights(
  totals: { income: number; expenses: number },
  categories: Array<{ name: string; amount: number; percentage?: number }>
): Array<{ title: string; description: string }> {
  const insights: Array<{ title: string; description: string }> = [];

  if (totals.income > 0) {
    const savingsRate = ((totals.income - totals.expenses) / totals.income) * 100;
    insights.push({
      title: 'Savings rate',
      description: `You kept ${savingsRate.toFixed(1)}% of your income (${totals.income.toFixed(2)} in, ${totals.expenses.toFixed(2)} out).`,
    });
  }

  if (categories.length > 0) {
    const top = [...categories].sort((a, b) => b.amount - a.amount)[0];
    insights.push({
      title: 'Largest category',
      description: `${top.name}: ${top.amount.toFixed(2)}${top.percentage != null ? ` (${top.percentage.toFixed(1)}% of expenses)` : ''}.`,
    });
  }

  return insights;
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
  const totals = {
    income: input.monthly.reduce((sum, m) => sum + m.income, 0),
    expenses: input.monthly.reduce((sum, m) => sum + m.expenses, 0),
  };

  return {
    userData: { firstName, lastName, email: input.email || '' },
    transactions: mapTransactions(input.transactions, balanceByMonth),
    categories: input.categories.map((c) => ({ name: c.name, amount: c.amount, color: c.color })),
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
    insights: buildInsights(totals, input.categories),
    language: input.language,
    period: input.period,
    currency: normalizeCurrency(input.currency),
  };
}

export interface MonthlyPayloadInput {
  userName?: string | null;
  email?: string | null;
  language: string;
  period: string;
  currency?: string;
  totals: { income: number; expenses: number };
  transactions: SourceTransaction[];
  categories: Array<{ name: string; amount: number }>;
  budgets?: Array<{ categoryName?: string; amount: string | number; spent?: number }>;
  goals?: Array<{ name: string; targetAmount: string | number; currentAmount?: string | number }>;
}

/** Payload for the monthly report (`/api/export-pdf`). */
export function buildMonthlyPayload(input: MonthlyPayloadInput): ProcessorPayload {
  const { firstName, lastName } = splitName(input.userName);

  // One month per report: every row shares that month's net balance for the chart.
  const monthNet = input.totals.income - input.totals.expenses;
  const balanceByMonth = new Map<string, number>();
  for (const t of input.transactions) {
    const date = typeof t.date === 'string' ? t.date : t.date.toISOString();
    balanceByMonth.set(date.slice(0, 7), monthNet);
  }

  return {
    userData: { firstName, lastName, email: input.email || '' },
    transactions: mapTransactions(input.transactions, balanceByMonth),
    categories: input.categories,
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
    insights: buildInsights(input.totals, input.categories),
    language: input.language,
    period: input.period,
    currency: normalizeCurrency(input.currency),
  };
}
