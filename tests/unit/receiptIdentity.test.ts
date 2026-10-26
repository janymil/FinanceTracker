import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';

/**
 * Who owns a receipt scan.
 *
 * The handler used to read `x-internal-auth: <user id>` and treat it as the caller's identity.
 * Any signed-in person could send someone else's id and spend that account's plan and monthly AI
 * allowance. Identity must come from the verified session only.
 */
const checkAiAccess = vi.hoisted(() => vi.fn(async (_userId: string) => ({ allowed: true, plan: 'premium' })));
const getAiQuota = vi.hoisted(() => vi.fn(async () => ({ state: { state: 'ok' } })));
const recordAIUsage = vi.hoisted(() => vi.fn(async (_row: Record<string, unknown>) => undefined));
const uploadFile = vi.hoisted(() => vi.fn(async (_path: string) => 'https://cdn.example/receipt.jpg'));

vi.mock('../../server/clerkAuth', () => ({ getUserId: () => 'session_user' }));
vi.mock('../../server/aiAccess', () => ({ checkAiAccess, denyAi: vi.fn(), getAiQuota }));
vi.mock('../../server/storage', () => ({
  storage: {
    getUser: vi.fn(async () => ({ firstName: 'Ana', lastName: 'Owner', email: 'ana@example.com' })),
    recordAIUsage,
  },
}));
vi.mock('../../server/imageAnonymizer', () => ({
  anonymizeImageForAI: vi.fn(async () => ({ image: Buffer.from('clean'), detectedWords: 4 })),
}));
vi.mock('../../server/ocr', () => ({
  performOCR: vi.fn(async () => 'ACME STORE\nTotal 12.50'),
}));
vi.mock('../../server/receiptExtraction', () => ({
  extractStructuredData: vi.fn(async () => ({ amount: 12.5, date: '2026-10-01', vendor: 'ACME STORE' })),
}));
vi.mock('../../server/openai', () => ({
  categorizeExpense: vi.fn(async () => ({ category: 'Groceries', failed: false })),
}));
vi.mock('../../server/cloudStorage', () => ({ cloudStorage: { uploadFile } }));
// Error Guard reaches for the database at import time; a unit test must not open a connection.
vi.mock('../../server/errorGuard/report.js', () => ({
  reportInvariant: vi.fn(),
  reportSwallowed: vi.fn(),
  reportServerError: vi.fn(),
  reportHttpServerError: vi.fn(),
}));

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const { uploadReceiptHandler } = await import('../../server/uploadReceipt');
  const app = express();
  app.post('/upload-receipt', uploadReceiptHandler as any);
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

async function upload(headers: Record<string, string> = {}) {
  const form = new FormData();
  form.append('receipt', new Blob([Buffer.from('fake image bytes')], { type: 'image/jpeg' }), 'receipt.jpg');

  const response = await fetch(`${baseUrl}/upload-receipt`, { method: 'POST', headers, body: form });
  const body: any = await response.json();
  return { status: response.status, body };
}

describe('POST /api/upload-receipt identity', () => {
  it('charges the scan to the signed-in account, never to a header', async () => {
    checkAiAccess.mockClear();
    recordAIUsage.mockClear();
    uploadFile.mockClear();

    const { status } = await upload({ 'x-internal-auth': 'victim_user' });

    expect(status).toBe(200);
    expect(checkAiAccess).toHaveBeenCalledWith('session_user');
    expect(checkAiAccess).not.toHaveBeenCalledWith('victim_user');
    expect(recordAIUsage.mock.calls[0][0]).toMatchObject({ userId: 'session_user' });
    // The object is stored under the owner's folder with a random name, and the read goes through
    // an owner-only route — a wrong id here is both a data-integrity bug and a privacy one.
    expect(uploadFile.mock.calls[0][0]).toContain('receipts/session_user/');
  });

  it('takes the same identity when no extra header is sent', async () => {
    checkAiAccess.mockClear();

    const { status } = await upload();

    expect(status).toBe(200);
    expect(checkAiAccess).toHaveBeenCalledWith('session_user');
  });
});
