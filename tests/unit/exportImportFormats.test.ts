import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';

/**
 * Every export format and every import format, over HTTP, with storage and the PDF service
 * stubbed. This is the answer to "do all the other formats work?" — a table of results instead
 * of an opinion.
 *
 * Not covered here (needs a real file and a model): the PDF bank-statement import, and the
 * bank-file preview/confirm flow that reads spreadsheets in the browser.
 */

const storage = vi.hoisted(() => ({
  getUser: vi.fn(),
  getUserTimeZone: vi.fn(),
  getUserTransactions: vi.fn(),
  getUserBudgets: vi.fn(),
  getUserGoals: vi.fn(),
  getCategories: vi.fn(),
  countUserTransactions: vi.fn(),
  createTransaction: vi.fn(),
  createCategory: vi.fn(),
  createBudget: vi.fn(),
  createGoal: vi.fn(),
  getUserImportLogs: vi.fn(),
  createImportLog: vi.fn(),
  updateBackupSettings: vi.fn(),
  getUserBackupSettings: vi.fn(),
}));

vi.mock('../../server/storage', () => ({ storage }));
vi.mock('../../server/clerkAuth', () => ({
  isAuthenticated: (_req: unknown, _res: unknown, next: () => void) => next(),
  getUserId: () => 'user_1',
}));
vi.mock('../../server/realtime', () => ({ notifyDataChange: vi.fn() }));
vi.mock('../../server/autoCategorize', () => ({ autoCategorizeTransaction: vi.fn() }));
vi.mock('../../server/batch-processor', () => ({ batchProcessor: { scheduleUser: vi.fn() } }));

const backupFiles = vi.hoisted(() => [] as Array<Record<string, unknown>>);
vi.mock('../../server/cloudStorage', () => ({
  cloudStorage: {
    createBackup: async () => 'backup-2026-10-28.json',
    getUserBackups: async () => backupFiles,
    restoreBackup: async () => ({ data: {} }),
    downloadFile: async () => '{}',
    deleteFile: async () => undefined,
  },
  storageInfo: () => ({ provider: 'Cloudflare R2', region: 'Global', bucket: 'kaptia-app', configured: true }),
}));

const requestPdf = vi.hoisted(() => vi.fn(async (_payload: unknown) => Buffer.from('%PDF-1.4 report')));
vi.mock('../../server/pdfProcessorClient', () => ({
  buildMonthlyPayload: vi.fn((input: unknown) => input),
  requestPdf,
  PdfProcessorError: class extends Error {},
}));

let server: Server;
let baseUrl: string;

const premium = { id: 'user_1', plan: 'premium', timezone: 'America/Lima', email: 'a@example.com', currency: 'S/' };

const rows = [
  { id: 1, date: new Date('2026-10-01T12:00:00Z'), description: 'October first', amount: '25.00', type: 'expense', categoryName: 'Food' },
  { id: 2, date: new Date('2026-10-02T12:00:00Z'), description: 'Coffee', amount: '8.50', type: 'expense', categoryName: 'Food' },
];

async function call(method: string, path: string, body?: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const bytes = new Uint8Array(await response.clone().arrayBuffer());
  const text = await response.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  return { status: response.status, text, bytes, json, contentType: response.headers.get('content-type') || '' };
}

beforeAll(async () => {
  const { registerExportRoutes } = await import('../../server/routes/exportRoutes');
  const { registerImportRoutes } = await import('../../server/routes/importRoutes');
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  registerExportRoutes(app);
  registerImportRoutes(app);
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

beforeEach(() => {
  vi.clearAllMocks();
  backupFiles.length = 0;
  storage.getUser.mockResolvedValue(premium);
  storage.getUserTimeZone.mockResolvedValue('America/Lima');
  storage.getUserTransactions.mockResolvedValue(rows);
  storage.getUserBudgets.mockResolvedValue([]);
  storage.getUserGoals.mockResolvedValue([]);
  storage.getCategories.mockResolvedValue([{ id: 5, name: 'Food', type: 'expense', userId: null }]);
  storage.countUserTransactions.mockResolvedValue(0);
  storage.createTransaction.mockResolvedValue({ id: 99 });
  storage.createCategory.mockResolvedValue({ id: 6 });
  storage.createBudget.mockResolvedValue({ id: 7 });
  storage.createGoal.mockResolvedValue({ id: 8 });
  storage.getUserImportLogs.mockResolvedValue([]);
  storage.createImportLog.mockResolvedValue({ id: 1 });
  storage.updateBackupSettings.mockResolvedValue(undefined);
  storage.getUserBackupSettings.mockResolvedValue({ retentionDays: 30 });
});


describe('export — every format the screen offers', () => {
  it('json: the whole account', async () => {
    const response = await call('GET', '/api/export?format=json&dateRange=all&includeTransactions=true');
    expect(response.status).toBe(200);
    expect(response.contentType).toContain('application/json');
    expect(response.json.account).toBeDefined();
    expect(response.json.transactions).toHaveLength(2);
  });

  it('csv: the header the importer reads', async () => {
    const response = await call('GET', '/api/export?format=csv&dateRange=all&includeTransactions=true');
    expect(response.status).toBe(200);
    expect(response.contentType).toContain('text/csv');
    expect(response.text).toContain('dataType,date,description,amount,transactionType,category');
    expect(response.text).toContain('transaction,2026-10-01');
  });

  it('excel: a real .xlsx workbook', async () => {
    const response = await call(
      'GET',
      '/api/export?format=excel&dateRange=all&includeTransactions=true&includeBudgets=true&includeGoals=true',
    );
    expect(response.status).toBe(200);
    expect(response.contentType).toContain('spreadsheetml');
    // A zip archive, which is what an .xlsx is.
    expect(response.bytes.subarray(0, 2)).toEqual(new Uint8Array([0x50, 0x4b]));
  });

  it('pdf: the report, rendered by the processor', async () => {
    const response = await call('GET', '/api/export?format=pdf&dateRange=all&includeTransactions=true');
    expect(response.status).toBe(200);
    expect(response.contentType).toBe('application/pdf');
    expect(response.text).toContain('%PDF-');
    expect(requestPdf).toHaveBeenCalledTimes(1);
    // The report gets every row, the totals and a month series — not a sample.
    const payload: any = requestPdf.mock.calls[0][0];
    expect(payload.transactions).toHaveLength(2);
    expect(payload.totals).toEqual({ income: 0, expenses: 33.5 });
    expect(payload.monthly?.[0]?.period).toBe('2026-10');
    expect(payload.range).toBeUndefined();
  });

  it('pdf stays Premium; the data formats do not', async () => {
    storage.getUser.mockResolvedValue({ ...premium, plan: 'free' });

    expect((await call('GET', '/api/export?format=pdf&dateRange=all&includeTransactions=true')).status).toBe(403);
    expect((await call('GET', '/api/export?format=csv&dateRange=all&includeTransactions=true')).status).toBe(200);
    expect((await call('GET', '/api/export?format=json&dateRange=all&includeTransactions=true')).status).toBe(200);
  });
});

describe('import — every format the dialog offers', () => {
  it('csv: a file this app exported, back in', async () => {
    const exported = await call('GET', '/api/export?format=csv&dateRange=all&includeTransactions=true');
    const response = await call('POST', '/api/import-data', { content: exported.text, format: 'csv' });

    expect(response.status).toBe(200);
    expect(response.json.summary.expenses).toBe(2);
    expect(storage.createTransaction).toHaveBeenCalledTimes(2);
  });

  it('json: a file this app exported, back in', async () => {
    const exported = await call('GET', '/api/export?format=json&dateRange=all&includeTransactions=true');
    const backup = { incomes: [], expenses: exported.json.transactions, budgets: [], goals: [] };

    const response = await call('POST', '/api/import-data', { content: JSON.stringify(backup), format: 'json' });

    expect(response.status).toBe(200);
    expect(response.json.summary.expenses).toBe(2);
  });

  it('excel: refused by name, because a spreadsheet is read by the bank-file flow', async () => {
    const response = await call('POST', '/api/import-data', { content: 'PK', format: 'excel' });
    expect(response.status).toBe(400);
    expect(response.json.message).toContain("Use 'json' or 'csv'");
  });

  it('csv with an unreadable row: the answer names the row', async () => {
    const response = await call('POST', '/api/import-data', {
      content: 'date,description,amount,type\n2026-10-01,Coffee,not-a-number,expense\n',
      format: 'csv',
    });
    expect(response.status).toBe(400);
    expect(response.json.message).toContain('Row 2: amount');
  });
});

describe('cloud backup — one provider, and the tab reports it', () => {
  it('says where the files are, from the provider itself', async () => {
    backupFiles.push({
      ObjectName: 'backup-2026-10-28.json',
      DateCreated: '2026-10-28T02:00:00.000Z',
      Length: 2048,
    });

    const response = await call('GET', '/api/backup/status');

    expect(response.status).toBe(200);
    expect(response.json.info.provider).toBe('Cloudflare R2');
    expect(response.json.info.region).toBe('Global');
    expect(response.json.info.configured).toBe(true);
    expect(response.json.realUsage.files).toBe(1);
    expect(response.json.lastBackup.filename).toBe('backup-2026-10-28.json');
    // No provider name is hardcoded into the payload any more.
    expect(JSON.stringify(response.json)).not.toMatch(/bunny|b-cdn/i);
  });
});
