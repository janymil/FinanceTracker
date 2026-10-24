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
vi.mock('../../server/openai', () => openai);
vi.mock('../../lib/aiProcessor', () => ({ runAI }));
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

  it('POST /api/ai/financial-health-score', async () => {
    runAI.mockResolvedValueOnce(FAILURE);
    const { status, json } = await call('POST', '/api/ai/financial-health-score', { summary: { totalIncome: 1 }, budgets: [] });
    expect(status).toBe(503);
    expect(json.code).toBe('ai_unavailable');
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('POST /api/ai/daily-recommendations', async () => {
    runAI.mockResolvedValueOnce(FAILURE);
    const { status } = await call('POST', '/api/ai/daily-recommendations', {
      transactions: [{ id: 1, amount: '1', description: 'x', date: '2026-10-01', type: 'expense' }],
      summary: { totalIncome: 1, totalExpenses: 1 },
      budgets: [],
    });
    expect(status).toBe(503);
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('POST /api/ai/tip', async () => {
    runAI.mockResolvedValueOnce(FAILURE);
    const { status } = await call('POST', '/api/ai/tip', { financialData: { totalIncome: 1, totalExpenses: 1, categories: [], transactions: [] } });
    expect(status).toBe(503);
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('POST /api/ai/categorize answers 503 for a failed categorisation, not "Other"', async () => {
    openai.categorizeExpenseWithUserCategories.mockResolvedValueOnce({ suggestedCategory: 'Other', confidence: 0.1, reasoning: 'x', failed: true });
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

  it('categorize returns the person\'s category', async () => {
    openai.categorizeExpenseWithUserCategories.mockResolvedValueOnce({ categoryId: 1, confidence: 0.9, reasoning: 'ok' });
    const { status, json } = await call('POST', '/api/ai/categorize', { description: 'Migros', amount: 4 });
    expect(status).toBe(200);
    expect(json).toMatchObject({ categoryId: 1, confidence: 0.9 });
  });
});

describe('POST /api/ai/tip in fetch_cached mode', () => {
  const entry = (language?: string) => ({ outputJson: [{ title: 'cached tip' }], inputJson: language ? { language } : {} });

  it('returns the last tip when it is in the language on screen', async () => {
    (storage as any).getRecentAICacheEntry = vi.fn().mockResolvedValue(entry('sk-sk'));
    const { json } = await call('POST', '/api/ai/tip', { mode: 'fetch_cached' }, { 'x-user-language': 'sk-sk' });
    expect(json.tip).toEqual([{ title: 'cached tip' }]);
  });

  it('does not show a tip that was written in another language', async () => {
    (storage as any).getRecentAICacheEntry = vi.fn().mockResolvedValue(entry('en-us'));
    const { json } = await call('POST', '/api/ai/tip', { mode: 'fetch_cached' }, { 'x-user-language': 'sk-sk' });
    expect(json.tip).toBeNull();
  });

  it('still shows an older tip that has no language recorded', async () => {
    (storage as any).getRecentAICacheEntry = vi.fn().mockResolvedValue(entry());
    const { json } = await call('POST', '/api/ai/tip', { mode: 'fetch_cached' }, { 'x-user-language': 'sk-sk' });
    expect(json.tip).not.toBeNull();
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

describe('POST /api/ai/contextual-financial-tips', () => {
  const body = () => ({
    transactions: [{ description: 'Migros', amount: 40, categoryName: 'Food', type: 'expense', date: '2026-10-01' }],
    summary: { totalIncome: 100, totalExpenses: 300, netBalance: -200 },
    budgets: [],
    selectedMonth: '2026-10',
  });
  const SLOVAK_REVIEW = 'Skontrolujte svoje výdavky';

  it('on an AI failure answers with rule-based tips in the person\'s language and caches nothing', async () => {
    runAI.mockResolvedValueOnce(FAILURE);
    const { status, json } = await call('POST', '/api/ai/contextual-financial-tips', body(), { 'x-user-language': 'sk-sk' });

    expect(status).toBe(200);
    expect(json.tips.map((t: any) => t.title)).toContain(SLOVAK_REVIEW);
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('does the same when the AI call throws', async () => {
    runAI.mockRejectedValueOnce(new Error('network'));
    const { json } = await call('POST', '/api/ai/contextual-financial-tips', body(), { 'x-user-language': 'es-pe' });
    expect(json.tips.map((t: any) => t.title)).toContain('Revisa tus gastos');
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('does not cache or show tips that have no title or text: the fallback takes their place', async () => {
    runAI.mockResolvedValueOnce({ tips: [{ id: 'x', title: '', description: 'only text' }, { title: 'only title' }] });
    const { json } = await call('POST', '/api/ai/contextual-financial-tips', body(), { 'x-user-language': 'sk-sk' });

    expect(json.tips.map((t: any) => t.id)).toContain('fallback_spending');
    expect(JSON.stringify(json)).not.toMatch(/Financial Tip|No description available/);
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('caches and returns real tips', async () => {
    runAI.mockResolvedValueOnce({ tips: [{ id: 'a', title: 'Zníž výdavky', description: 'Pozri potraviny', category: 'spending', priority: 'high', actionable: true }] });
    const { json } = await call('POST', '/api/ai/contextual-financial-tips', body(), { 'x-user-language': 'sk-sk' });

    expect(json.tips).toHaveLength(1);
    expect(json.tips[0].title).toBe('Zníž výdavky');
    expect(cache.set).toHaveBeenCalledTimes(1);
  });

  it('gives a free plan an empty list without calling the model', async () => {
    storage.getUser.mockResolvedValue({ ...premium, plan: 'free' });
    const { json } = await call('POST', '/api/ai/contextual-financial-tips', body());
    expect(json).toEqual({ tips: [] });
    expect(runAI).not.toHaveBeenCalled();
  });
});

describe('what the routes log', () => {
  it('never prints a transaction or an AI answer', async () => {
    const log = vi.spyOn(console, 'log');
    runAI.mockResolvedValueOnce({ recommendations: [{ title: 'SECRET-TIP' }], insights: [] });
    await call('POST', '/api/ai/daily-recommendations', {
      transactions: [{ id: 1, amount: '1', description: 'SECRET-MERCHANT', date: '2026-10-01', type: 'expense' }],
      summary: { totalIncome: 1, totalExpenses: 1 },
      budgets: [],
    });
    await call('POST', '/api/ai/contextual-financial-tips', {
      transactions: [{ description: 'SECRET-MERCHANT', amount: 9, categoryName: 'Food', type: 'expense', date: '2026-10-01' }],
      summary: { totalIncome: 1, totalExpenses: 1, netBalance: 0 },
      budgets: [{ categoryName: 'SECRET-BUDGET', amount: 5, spent: 1, remaining: 4 }],
      selectedMonth: '2026-10',
    });

    const printed = JSON.stringify(log.mock.calls);
    expect(printed).not.toContain('SECRET-MERCHANT');
    expect(printed).not.toContain('SECRET-TIP');
    expect(printed).not.toContain('SECRET-BUDGET');
  });
});
