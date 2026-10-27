import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';

/**
 * Core tracking over HTTP with storage mocked: ranges follow the person's time zone, exports
 * answer the way the export page calls them, and bad input is refused instead of saved.
 */
const storage = vi.hoisted(() => ({
  getUser: vi.fn(),
  getUserTimeZone: vi.fn(),
  getUserFinancialSummary: vi.fn(),
  getUserTransactions: vi.fn(),
  getTransactionsByDateRange: vi.fn(),
  getUserBudgets: vi.fn(),
  getUserGoals: vi.fn(),
  getCategories: vi.fn(),
  countUserTransactions: vi.fn(),
  createTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  createBudget: vi.fn(),
}));

vi.mock('../../server/storage', () => ({ storage }));
vi.mock('../../server/clerkAuth', () => ({
  isAuthenticated: (_req: unknown, _res: unknown, next: () => void) => next(),
  getUserId: () => 'user_1',
}));
vi.mock('../../server/realtime', () => ({ notifyDataChange: vi.fn() }));
vi.mock('../../server/autoCategorize', () => ({ autoCategorizeTransaction: vi.fn() }));
vi.mock('../../server/batch-processor', () => ({ batchProcessor: { scheduleUser: vi.fn() } }));
vi.mock('../../server/cloudStorage', () => ({ cloudStorage: null }));
vi.mock('../../server/pdfProcessorClient', () => ({
  buildMonthlyPayload: vi.fn(),
  requestPdf: vi.fn(),
  PdfProcessorError: class extends Error {},
}));

let server: Server;
let baseUrl: string;

const premiumLima = { id: 'user_1', plan: 'premium', timezone: 'America/Lima', email: 'a@example.com' };
const tx = (id: number, date: string, description: string, amount = '10.00') => ({
  id, date: new Date(date), description, amount, type: 'expense', categoryName: 'Food',
});

async function call(method: string, path: string, body?: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const bytes = new Uint8Array(await response.clone().arrayBuffer());
  const text = await response.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: response.status, text, bytes, json, headers: response.headers };
}

beforeAll(async () => {
  const { registerTransactionRoutes } = await import('../../server/routes/transactionRoutes');
  const { registerExportRoutes } = await import('../../server/routes/exportRoutes');
  const { registerBudgetRoutes } = await import('../../server/routes/budgetRoutes');
  const app = express();
  app.use(express.json());
  registerTransactionRoutes(app);
  registerExportRoutes(app);
  registerBudgetRoutes(app);
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

beforeEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  storage.getUser.mockResolvedValue(premiumLima);
  storage.getUserTimeZone.mockResolvedValue('America/Lima');
  storage.getCategories.mockResolvedValue([{ id: 5, name: 'Food' }]);
  storage.getUserBudgets.mockResolvedValue([]);
  storage.getUserGoals.mockResolvedValue([]);
  storage.countUserTransactions.mockResolvedValue(0);
  storage.getUserFinancialSummary.mockResolvedValue({ transactionsByCategory: [], totalExpenses: 0 });
  storage.getTransactionsByDateRange.mockResolvedValue([]);
});

describe('financial summary', () => {
  it('reads plain dates as whole days in the person\'s time zone', async () => {
    const response = await call('GET', '/api/financial-summary?startDate=2026-10-01&endDate=2026-10-31');
    expect(response.status).toBe(200);
    const [, start, end] = storage.getUserFinancialSummary.mock.calls[0];
    expect(start.toISOString()).toBe('2026-10-01T05:00:00.000Z');
    expect(end.toISOString()).toBe('2026-11-01T04:59:59.999Z');
  });

  it('keeps exact timestamps from the browser untouched', async () => {
    await call('GET', '/api/financial-summary?startDate=2026-10-01T05:00:00.000Z&endDate=2026-11-01T04:59:59.999Z');
    const [, start, end] = storage.getUserFinancialSummary.mock.calls[0];
    expect(start.toISOString()).toBe('2026-10-01T05:00:00.000Z');
    expect(end.toISOString()).toBe('2026-11-01T04:59:59.999Z');
  });

  it('refuses missing, invalid and reversed ranges', async () => {
    expect((await call('GET', '/api/financial-summary')).status).toBe(400);
    expect((await call('GET', '/api/financial-summary?startDate=x&endDate=y')).status).toBe(400);
    expect((await call('GET', '/api/financial-summary?startDate=2026-10-31&endDate=2026-10-01')).status).toBe(400);
    expect(storage.getUserFinancialSummary).not.toHaveBeenCalled();
  });

  it('sends the period\'s newest transactions for the tips prompt', async () => {
    // The tips card asks the model to name the figure it rests on. That field was declared in the
    // client's type and never filled, so the prompt said "Transaction Count: 0".
    storage.getUserFinancialSummary.mockResolvedValue({
      transactionsByCategory: [{ categoryName: 'Food', amount: 20, type: 'expense' }],
      totalExpenses: 20,
      totalIncome: 0,
      netBalance: -20,
    });
    storage.getTransactionsByDateRange.mockResolvedValue([
      tx(1, '2026-10-02T17:00:00Z', 'Groceries — Wong'),
      tx(2, '2026-10-20T17:00:00Z', 'Groceries — Metro'),
    ]);

    const response = await call('GET', '/api/financial-summary?startDate=2026-10-01&endDate=2026-10-31');

    expect(response.status).toBe(200);
    expect(response.json.recentTransactions).toHaveLength(2);
    expect(response.json.recentTransactions[0].description).toBe('Groceries — Metro');
    expect(response.json.recentTransactions[0].categoryName).toBe('Food');
  });
});

describe('export', () => {
  const rows = [
    tx(1, '2026-09-30T23:00:00.000Z', 'September dinner'), // 18:00 Sep 30 in Lima
    tx(2, '2026-10-01T05:30:00.000Z', 'October first'), // 00:30 Oct 1 in Lima
    tx(3, '2026-11-01T03:00:00.000Z', '=HYPERLINK("http://evil")', '25'), // 22:00 Oct 31 in Lima
    tx(4, '2026-11-01T05:30:00.000Z', 'November first'), // 00:30 Nov 1 in Lima
  ];

  beforeEach(() => {
    storage.getUserTransactions.mockResolvedValue(rows);
  });

  it('answers the GET the export page sends and filters a custom range by local days', async () => {
    const response = await call(
      'GET',
      '/api/export?format=csv&dateRange=custom&startDate=2026-10-01&endDate=2026-10-31&includeTransactions=true&includeBudgets=false&includeGoals=false',
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/csv');
    // The BOM keeps accents readable in Excel; fetch hides it from .text(), so check the raw bytes.
    expect(Array.from(response.bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(response.text).toContain('Date,Description,Amount,Type,Category\r\n');
    expect(response.text).toContain('October first');
    expect(response.text).toContain('25.00');
    expect(response.text).not.toContain('September dinner');
    expect(response.text).not.toContain('November first');
  });

  it('defuses formulas in the CSV', async () => {
    const response = await call('GET', '/api/export?format=csv&dateRange=all&includeTransactions=true');
    expect(response.text).toContain(`"'=HYPERLINK(""http://evil"")"`);
    expect(response.text).not.toMatch(/,"=HYPERLINK/);
  });

  it('"this month" is the month in the person\'s zone, not UTC\'s', async () => {
    // 03:00 UTC on Nov 1 is still Oct 31 in Lima.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-01T03:00:00.000Z'));
    const response = await call('GET', '/api/export?format=json&dateRange=month&includeTransactions=true');
    vi.useRealTimers();
    expect(response.status).toBe(200);
    expect(response.json.transactions.map((t: any) => t.id).sort()).toEqual([2, 3]);
    expect(response.json.userId).toBeUndefined();
  });

  it('does the same for someone in Bratislava', async () => {
    storage.getUser.mockResolvedValue({ ...premiumLima, timezone: 'Europe/Bratislava' });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-01T03:00:00.000Z'));
    const response = await call('GET', '/api/export?format=json&dateRange=month&includeTransactions=true');
    vi.useRealTimers();
    expect(response.json.transactions.map((t: any) => t.id).sort()).toEqual([3, 4]);
  });

  it('gives every plan its own data, and still refuses the paid report', async () => {
    // A copy of your own data is a legal right, not a paid feature: CSV/JSON/Excel are available
    // to a free account. The generated PDF report remains Premium.
    storage.getUser.mockResolvedValue({ ...premiumLima, plan: 'free' });
    expect((await call('GET', '/api/export?format=csv&includeTransactions=true')).status).toBe(200);
    expect((await call('GET', '/api/export?format=pdf&includeTransactions=true')).status).toBe(403);
    storage.getUser.mockResolvedValue(premiumLima);
    expect((await call('GET', '/api/export?format=csv&dateRange=custom&startDate=2026-10-31&endDate=2026-10-01&includeTransactions=true')).status).toBe(400);
    expect((await call('GET', '/api/export?format=docx&includeTransactions=true')).status).toBe(400);
  });
});

describe('transactions', () => {
  const valid = { amount: 12.5, date: '2026-10-24T12:00:00.000Z', type: 'expense', description: 'Coffee', categoryId: 5 };

  it('refuses a transaction without a description or with an unknown category', async () => {
    expect((await call('POST', '/api/transactions', { ...valid, description: '   ' })).status).toBe(400);
    expect((await call('POST', '/api/transactions', { ...valid, categoryId: 99 })).status).toBe(400);
    expect((await call('POST', '/api/transactions', { ...valid, amount: 'abc' })).status).toBe(400);
    expect(storage.createTransaction).not.toHaveBeenCalled();
  });

  it('answers 404 when deleting something that is not there, 400 for a junk id', async () => {
    storage.deleteTransaction.mockResolvedValue(false);
    expect((await call('DELETE', '/api/transactions/42')).status).toBe(404);
    expect((await call('DELETE', '/api/transactions/abc')).status).toBe(400);
    storage.deleteTransaction.mockResolvedValue(true);
    expect((await call('DELETE', '/api/transactions/42')).status).toBe(200);
  });
});

describe('budgets', () => {
  const valid = { categoryId: 5, amount: 300, startDate: '2026-10-01', endDate: '2026-10-31' };

  it('refuses reversed dates, bad amounts and someone else\'s category', async () => {
    expect((await call('POST', '/api/budgets', { ...valid, endDate: '2026-09-01' })).status).toBe(400);
    expect((await call('POST', '/api/budgets', { ...valid, amount: -5 })).status).toBe(400);
    expect((await call('POST', '/api/budgets', { ...valid, categoryId: 77 })).status).toBe(400);
    expect(storage.createBudget).not.toHaveBeenCalled();
  });

  it('saves a valid budget with the amount as a decimal string', async () => {
    storage.createBudget.mockImplementation(async (budget: unknown) => budget);
    const response = await call('POST', '/api/budgets', valid);
    expect(response.status).toBe(200);
    expect(storage.createBudget.mock.calls[0][0]).toMatchObject({ userId: 'user_1', categoryId: 5, amount: '300.00', period: 'monthly' });
  });
});
