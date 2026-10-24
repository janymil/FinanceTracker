import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { inspect } from 'node:util';
import { z } from 'zod';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { describeZodError } from '../../server/zodInspect';

/**
 * Logging a ZodError used to throw inside the route's own catch block on current Node versions:
 * the response was never sent (the request hung) and an unhandled rejection was left behind.
 */
vi.mock('../../server/clerkAuth.js', () => ({
  isAuthenticated: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock('../../server/middleware/rateLimit.js', () => ({
  rateLimit: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock('../../lib/merchantLookup', () => ({ lookupMerchant: vi.fn(async () => null) }));

function aZodError() {
  const result = z.object({ amount: z.number(), note: z.string().min(1) }).safeParse({ amount: 'x', note: '' });
  if (result.success) throw new Error('expected a validation failure');
  return result.error;
}

describe('logging validation errors', () => {
  it('can be inspected without throwing, and says what was wrong', () => {
    const text = inspect(aZodError());
    expect(text).toContain('amount');
    expect(text).toContain('note');
  });

  it('console.error with a ZodError does not throw', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => console.error('Error creating something:', aZodError())).not.toThrow();
    spy.mockRestore();
  });

  it('describes issues compactly', () => {
    expect(describeZodError(aZodError())).toMatch(/^ZodError: amount: .*; note: /);
  });
});

describe('POST /api/voice/parse with invalid input', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const { registerVoiceRoutes } = await import('../../server/routes/voiceRoutes');
    const app = express();
    app.use(express.json());
    registerVoiceRoutes(app);
    server = app.listen(0);
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => {
    server.close();
  });

  const post = (body: unknown) =>
    fetch(`${baseUrl}/api/voice/parse`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5_000), // the old behaviour was to never answer
    });

  it('answers 400 straight away for an empty or blank transcript', async () => {
    for (const transcript of ['', '   ']) {
      const response = await post({ transcript, userLanguage: 'sk' });
      expect(response.status).toBe(400);
      expect((await response.json()).success).toBe(false);
    }
  });

  it('answers 400 for a missing or non-text transcript', async () => {
    expect((await post({})).status).toBe(400);
    expect((await post({ transcript: 42 })).status).toBe(400);
  });
});
