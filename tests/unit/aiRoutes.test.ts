import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';

/**
 * What the AI routes do with what `runAI` hands back: a failure becomes a 503 with a stable
 * code and is never cached; a broken answer becomes localised rule-based tips, never English
 * on a Slovak screen; nothing a person did not get is saved for the next request.
 */
const storage = vi.hoisted(() => ({
  getUser: vi.fn(),
  getUserTransactions: vi.fn(),
  getCategories: vi.fn(),
  getUserBudgets: vi.fn(),
  getUserFinancialSummary: vi.fn(),
  getUserGoals: vi.fn(),
  getTransactionsByDateRange: vi.fn(),
  getUserTimeZone: vi.fn(),
}));
const runAI = vi.hoisted(() => vi.fn());
const cache = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }));
const openai = vi.hoisted(() => ({
  categorizeExpense: vi.fn(),
  categorizeExpenseWithUserCategories: vi.fn(),
  categorizeIncomeWithUserCategories: vi.fn(),
}));

vi.mock('../../server/storage', () => ({ storage }));
vi.mock('../../server/clerkAuth', () => ({
  isAuthenticated: (_req: unknown, _res: unknown, next: () => void) => next(),
  getUserId: () => 'user_1',
}));
// The gate has its own tests; here the person is already through it.
vi.mock('../../server/aiAccess', () => ({ aiGuard: () => (_req: unknown, _res: unknown, next: () => void) => next() }));
vi.mock('../../server/adminAuth', () => ({ adminAuth: (_req: unknown, _res: unknown, next: () => void) => next() }));
vi.mock('../../server/openai', () => ({
  ...openai,
  // The route puts the prompt version in the cache key; the mock has to carry it too.
  FINANCIAL_ADVISOR_PROMPT_VERSION: 'financial-advisor@test',
}));
vi.mock('../../lib/aiProcessor', () => ({ runAI, runMeteredAI: vi.fn() }));
vi.mock('../../lib/aiProvider', () => ({ getAIProviderStatus: () => ({}) }));
vi.mock('../../lib/unifiedAICache', () => ({
  UnifiedAICache: class {
    constructor(public functionKey: string) {}
    get = (input: unknown) => cache.get(this.functionKey, input);
    set = (input: unknown, output: unknown, isError?: boolean, ttl?: number) =>
      cache.set(this.functionKey, input, output, isError, ttl);
  },
}));

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const { registerAIRoutes } = await import('../../server/routes/aiRoutes');
  const app = express();
  app.use(express.json());
  registerAIRoutes(app);
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

const premium = { id: 'user_1', plan: 'premium', aiEnabled: true };
const FAILURE = { error: 'AI service temporarily unavailable', message: 'Unable to process request at this time' };

beforeEach(() => {
  storage.getUser.mockReset().mockResolvedValue(premium);
  storage.getUserTransactions.mockReset().mockResolvedValue([
    { id: 1, description: 'Migros', amount: '40', date: new Date('2026-10-01'), type: 'expense', categoryName: 'Food' },
  ]);
  storage.getCategories.mockReset().mockResolvedValue([{ id: 1, name: 'Food', type: 'expense' }]);
  storage.getUserBudgets.mockReset().mockResolvedValue([]);
  storage.getUserFinancialSummary.mockReset().mockResolvedValue({ totalIncome: 1000, totalExpenses: 400, transactionsByCategory: [] });
  storage.getUserGoals.mockReset().mockResolvedValue([]);
  storage.getTransactionsByDateRange.mockReset().mockResolvedValue([
    { id: 1, description: 'Migros', amount: '40', date: new Date('2026-10-01'), type: 'expense', categoryName: 'Food', isRecurring: false },
  ]);
  storage.getUserTimeZone.mockReset().mockResolvedValue('UTC');
  runAI.mockReset();
  cache.get.mockReset().mockResolvedValue(null);
  cache.set.mockReset().mockResolvedValue(undefined);
  Object.values(openai).forEach((fn) => fn.mockReset());
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: response.status, json, text };
}

describe('a failed AI answer is a 503 and is never cached', () => {
  it('GET /api/ai/insights', async () => {
    runAI.mockResolvedValueOnce(FAILURE);
    const { status, json } = await call('GET', '/api/ai/insights');
    expect(status).toBe(503);
    expect(json.code).toBe('ai_unavailable');
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('GET /api/trend-predictions', async () => {
    runAI.mockResolvedValueOnce(FAILURE);
    const { status, json } = await call('GET', '/api/trend-predictions');
    expect(status).toBe(503);
    expect(json.code).toBe('ai_unavailable');
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('POST /api/ai/categorize answers 503 for a failed categorisation, not "Other"', async () => {
    runAI.mockResolvedValueOnce({ suggestedCategory: 'Other', confidence: 0.1, reasoning: 'x', failed: true });
    const { status, json } = await call('POST', '/api/ai/categorize', { description: 'Migros', amount: 4 });
    expect(status).toBe(503);
    expect(json.code).toBe('ai_unavailable');
  });
});

describe('a real AI answer is returned and cached', () => {
  it('insights', async () => {
    const insights = [{ id: 'i', type: 'trend', title: 'T', description: 'D', impact: 'low', actionable: false }];
    runAI.mockResolvedValueOnce(insights);
    const { status, json } = await call('GET', '/api/ai/insights');

    expect(status).toBe(200);
    expect(json).toEqual(insights);
    expect(cache.set).toHaveBeenCalledTimes(1);
  });

  it('an empty list of insights is an answer, not a failure', async () => {
    runAI.mockResolvedValueOnce([]);
    const { status, json } = await call('GET', '/api/ai/insights');
    expect(status).toBe(200);
    expect(json).toEqual([]);
  });

  it('hands the person\'s language to the model', async () => {
    runAI.mockResolvedValueOnce([]);
    await call('GET', '/api/ai/insights', undefined, { 'x-user-language': 'sk-sk' });
    expect(runAI.mock.calls[0][2].language).toBe('sk-sk');
  });

  it('categorize returns the person\'s category and is metered through runAI', async () => {
    runAI.mockResolvedValueOnce({ categoryId: 1, confidence: 0.9, reasoning: 'ok' });
    const { status, json } = await call('POST', '/api/ai/categorize', { description: 'Migros', amount: 4 });
    expect(status).toBe(200);
    expect(json).toMatchObject({ categoryId: 1, confidence: 0.9 });

    // Owned and metered: the row is written for this person, so the allowance sees the call.
    expect(runAI).toHaveBeenCalledWith(
      'categorizeExpenseWithCategories',
      'user_1',
      expect.objectContaining({ description: 'Migros', amount: 4 }),
      expect.any(String),
    );
  });
});

describe('plan rules still hold', () => {
  it('insights are a Premium feature', async () => {
    storage.getUser.mockResolvedValue({ ...premium, plan: 'standard' });
    const { status } = await call('GET', '/api/ai/insights');
    expect(status).toBe(403);
    expect(runAI).not.toHaveBeenCalled();
  });
});

describe('the adviser is a Premium feature', () => {
  it('refuses a standard account before any AI call', async () => {
    storage.getUser.mockResolvedValue({ ...premium, plan: 'standard' });
    const { status, json } = await call('GET', '/api/financial-health');

    expect(status).toBe(403);
    expect(json.code).toBe('plan_required');
    expect(runAI).not.toHaveBeenCalled();
  });

  it('answers a premium account with advice and the computed score', async () => {
    runAI.mockResolvedValueOnce({
      aiAnalysis: {
        summary: 'Quedaron 600 de 1000.',
        personalizedFactors: ['Food llegó a 400.'],
        recommendations: [{ action: 'Limita comida a 300', reason: 'Food llegó a 400', impact: 'Libera 100', priority: 'high' }],
        riskAssessment: '',
      },
    });
    const { status, json } = await call('GET', '/api/financial-health?startDate=2026-10-01&endDate=2026-10-31');

    expect(status).toBe(200);
    expect(json.category).toBeDefined();
    expect(json.advice[0]).toMatchObject({ action: 'Limita comida a 300', reason: 'Food llegó a 400' });
    expect(json.summary).toBe('Quedaron 600 de 1000.');
  });
});

describe('what the routes log', () => {
  it('never prints a transaction, a goal or an AI answer', async () => {
    const log = vi.spyOn(console, 'log');
    storage.getTransactionsByDateRange.mockResolvedValue([
      { id: 1, description: 'SECRET-MERCHANT', amount: '9', date: new Date('2026-10-01'), type: 'expense', categoryName: 'Food', isRecurring: true },
    ]);
    storage.getUserGoals.mockResolvedValue([{ name: 'SECRET-GOAL', targetAmount: '100', currentAmount: '10', targetDate: '2027-01-01' }]);
    runAI.mockResolvedValueOnce({ aiAnalysis: { recommendations: [{ action: 'SECRET-TIP' }] } });

    await call('GET', '/api/financial-health?startDate=2026-10-01&endDate=2026-10-31');

    const printed = JSON.stringify(log.mock.calls);
    expect(printed).not.toContain('SECRET-MERCHANT');
    expect(printed).not.toContain('SECRET-TIP');
    expect(printed).not.toContain('SECRET-GOAL');
  });
});
