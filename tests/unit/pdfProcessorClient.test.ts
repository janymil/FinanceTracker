import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Module 6 of step 4: the external PDF service contract (blueprint 04).
 *
 * The service (pdf-processor.formatika.dev) is ALWAYS stubbed here — no network, no key.
 * Only one opt-in smoke test may ever call it for real.
 */

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));

vi.mock('node-fetch', () => ({ default: fetchMock }));

import {
  PdfProcessorError,
  buildMonthlyPayload,
  buildTrendsPayload,
  requestPdf,
  type ProcessorPayload,
} from '../../server/pdfProcessorClient';

const basePayload: ProcessorPayload = {
  userData: { firstName: 'Jana', lastName: 'Nováková', email: 'jana@example.com' },
  transactions: [],
  categories: [],
  language: 'sk',
  period: '2026-03',
  currency: '€',
};

const okResponse = (bytes = '%PDF-1.4 fake') => ({
  ok: true,
  status: 200,
  text: async () => '',
  arrayBuffer: async () => Buffer.from(bytes),
});

const errorResponse = (status: number, body = 'boom') => ({
  ok: false,
  status,
  text: async () => body,
  arrayBuffer: async () => Buffer.alloc(0),
});

const originalEnv = { ...process.env };

/** Runs requestPdf and returns the rejection as a typed PdfProcessorError. */
async function capturePdfError(): Promise<PdfProcessorError> {
  try {
    await requestPdf(basePayload);
  } catch (error) {
    return error as PdfProcessorError;
  }
  throw new Error('expected requestPdf to reject, but it resolved');
}

beforeEach(() => {
  fetchMock.mockReset();
  process.env.PDF_SERVICE_URL = 'https://pdf.example.test';
  process.env.PDF_API_KEY = 'test-key';
  delete process.env.PDF_SERVICE_TIMEOUT_MS;
});

afterEach(() => {
  vi.restoreAllMocks();
  process.env = { ...originalEnv };
});

describe('requestPdf — happy path', () => {
  it('posts the payload to /generate-pdf and returns a Buffer', async () => {
    fetchMock.mockResolvedValueOnce(okResponse());

    const pdf = await requestPdf(basePayload);

    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://pdf.example.test/generate-pdf');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.headers['x-api-key']).toBe('test-key');
    expect(JSON.parse(init.body)).toEqual(basePayload);
  });

  it('trims a trailing slash from the configured service URL', async () => {
    process.env.PDF_SERVICE_URL = 'https://pdf.example.test///';
    fetchMock.mockResolvedValueOnce(okResponse());

    await requestPdf(basePayload);

    expect(fetchMock.mock.calls[0][0]).toBe('https://pdf.example.test/generate-pdf');
  });

  it('omits the api key header when none is configured', async () => {
    delete process.env.PDF_API_KEY;
    fetchMock.mockResolvedValueOnce(okResponse());

    await requestPdf(basePayload);

    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('x-api-key');
  });

  it('always sets an abort signal', async () => {
    fetchMock.mockResolvedValueOnce(okResponse());
    await requestPdf(basePayload);
    expect(fetchMock.mock.calls[0][1].signal).toBeDefined();
  });
});

describe('requestPdf — failures are always PdfProcessorError(502)', () => {
  it('maps a 500 from the service and keeps details under 500 characters', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(500, 'e'.repeat(900)));

    const error = await capturePdfError();
    expect(error).toBeInstanceOf(PdfProcessorError);
    expect(error.statusCode).toBe(502);
    expect(error.details).toHaveLength(500);
  });

  it('reports 401/403 from the service as 502 to the client', async () => {
    for (const status of [401, 403]) {
      fetchMock.mockResolvedValueOnce(errorResponse(status, 'nope'));
      const error = await capturePdfError();
      expect(error).toBeInstanceOf(PdfProcessorError);
      expect(error.statusCode).toBe(502);
      expect(error.details).toBe('nope');
    }
  });

  it('wraps an unreachable service', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const error = await capturePdfError();
    expect(error).toBeInstanceOf(PdfProcessorError);
    expect(error.message).toContain('PDF processor unreachable');
    expect(error.details).toBe('ECONNREFUSED');
  });

  it('wraps a timeout/abort', async () => {
    process.env.PDF_SERVICE_TIMEOUT_MS = '10';
    const abort = new Error('The operation was aborted due to timeout');
    abort.name = 'TimeoutError';
    fetchMock.mockRejectedValueOnce(abort);

    const error = await capturePdfError();
    expect(error).toBeInstanceOf(PdfProcessorError);
    expect(error.message).toContain('unreachable');
  });

  it('survives a service that cannot even produce an error body', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => {
        throw new Error('stream closed');
      },
      arrayBuffer: async () => Buffer.alloc(0),
    });

    const error = await capturePdfError();
    expect(error).toBeInstanceOf(PdfProcessorError);
    expect(error.statusCode).toBe(502);
  });
});

describe('payload builders — pure contract', () => {
  it('builds the trends payload with a symbol currency and mapped transactions', () => {
    const payload = buildTrendsPayload({
      userName: 'Jana Nováková',
      email: 'jana@example.com',
      language: 'sk',
      period: '2026-03',
      currency: '€',
      monthly: [{ period: '2026-03', income: 3500, expenses: 1286.08, netBalance: 2213.92 }],
      categories: [{ name: 'Bývanie', amount: 648.5 }],
      transactions: [
        { date: '2026-03-02T10:00:00.000Z', description: 'Lidl', amount: '84.30', type: 'expense', categoryName: 'Potraviny' },
        { date: '2026-03-01T08:00:00.000Z', description: 'Mzda', amount: '2450.00', type: 'income', categoryName: 'Mzda' },
      ],
    });

    expect(payload.userData).toEqual({ firstName: 'Jana', lastName: 'Nováková', email: 'jana@example.com' });
    expect(payload.currency).toBe('€');
    expect(payload.period).toBe('2026-03');
    expect(payload.transactions).toHaveLength(2);
    expect(payload.transactions[0]).toMatchObject({
      month: '2026-03',
      balance: 2213.92,
      type: 'expense',
      categoryName: 'Potraviny',
      amount: 84.3,
    });
    expect(payload.transactions[1].type).toBe('income');
  });

  it('states the two facts the report prints in words, in no language of its own', () => {
    const payload = buildTrendsPayload({
      userName: 'Test User',
      language: 'en-us',
      period: '2026-03',
      currency: '$',
      monthly: [{ period: '2026-03', income: 1000, expenses: 400, netBalance: 600 }],
      categories: [{ name: 'Rent', amount: 300, percentage: 75 }],
      transactions: [],
    });

    // Numbers, not English sentences: the processor writes them in the reader's language.
    expect(payload.metrics?.savingsRate).toBeCloseTo(60, 5);
    expect(payload.metrics?.topCategory).toMatchObject({ name: 'Rent', amount: 300 });
    expect(payload.metrics?.topCategory?.percentage).toBeCloseTo(75, 5);
    expect(payload.insights).toBeUndefined();
  });

  it('builds the monthly payload with every row, the totals and one point per month', () => {
    const payload = buildMonthlyPayload({
      userName: 'Jana',
      language: 'sk',
      period: '2026-03',
      currency: '€',
      totals: { income: 3500, expenses: 1286.08 },
      monthly: [
        { period: '2026-02', income: 1000, expenses: 200 },
        { period: '2026-03', income: 2500, expenses: 1086.08 },
      ],
      transactions: [
        { date: '2026-03-02T10:00:00.000Z', description: 'Lidl', amount: '84.30', type: 'expense' },
      ],
      categories: [{ name: 'Potraviny', amount: 84.3 }],
      budgets: [{ categoryName: 'Potraviny', amount: '200.00', spent: 84.3 }],
      goals: [{ name: 'Dovolenka', targetAmount: '1000.00', currentAmount: '250.00' }],
    });

    expect(payload.userData.firstName).toBe('Jana');
    // The three numbers a financial report exists for.
    expect(payload.totals).toEqual({ income: 3500, expenses: 1286.08, net: 2213.92 });
    // The chart is the period, not a sample of it: every month, oldest first.
    expect(payload.monthly).toEqual([
      { period: '2026-02', income: 1000, expenses: 200, net: 800 },
      { period: '2026-03', income: 2500, expenses: 1086.08, net: 1413.92 },
    ]);
    // Every row is sent; the report used to print only the first twelve.
    expect(payload.transactions).toHaveLength(1);
    expect(payload.transactions[0]).toMatchObject({ month: '2026-03', amount: 84.3, type: 'expense' });
    // The category carries its share of the spending, so the legend can show a percentage.
    expect(payload.categories[0]).toMatchObject({ name: 'Potraviny', amount: 84.3 });
    expect(payload.categories[0].percentage).toBeCloseTo((84.3 / 1286.08) * 100, 5);
    expect(payload.budgets?.[0]).toEqual({ categoryName: 'Potraviny', amount: 200, spent: 84.3 });
    expect(payload.goals?.[0]).toEqual({ name: 'Dovolenka', targetAmount: 1000, currentAmount: 250 });
  });

  it('keeps a pre-worded period out of the payload when the caller has none', () => {
    const payload = buildMonthlyPayload({
      userName: 'Jana',
      language: 'es-pe',
      totals: { income: 10, expenses: 5 },
      transactions: [],
      categories: [],
    });

    // No `period`: the report prints the dates, or "todo el periodo", in the reader's language.
    expect(payload.period).toBeUndefined();
  });

  it('truncates the display currency to 5 characters', () => {
    const payload = buildMonthlyPayload({
      userName: 'X',
      language: 'sk',
      period: '2026-03',
      currency: 'EUROS',
      totals: { income: 0, expenses: 0 },
      transactions: [],
      categories: [],
    });

    expect(payload.currency).toBe('EUROS');
    expect(payload.currency?.length ?? 0).toBeLessThanOrEqual(5);
  });

  it('falls back to a $ symbol when currency is missing', () => {
    const payload = buildMonthlyPayload({
      userName: 'X',
      language: 'en-us',
      period: '2026-03',
      totals: { income: 0, expenses: 0 },
      transactions: [],
      categories: [],
    });

    expect(payload.currency).toBe('$');
  });

  it('falls back to "Kaptia User" when the name is missing', () => {
    const payload = buildMonthlyPayload({
      userName: null,
      language: 'en-us',
      period: '2026-03',
      totals: { income: 0, expenses: 0 },
      transactions: [],
      categories: [],
    });

    expect(payload.userData).toMatchObject({ firstName: 'Kaptia', lastName: 'User' });
  });
});
