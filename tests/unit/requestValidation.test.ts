import { describe, expect, it } from 'vitest';
import express, { type Express } from 'express';
import { z } from 'zod';
import type { AddressInfo } from 'net';
import { parseBody, parseQuery, parseValue, sendValidationError } from '../../server/validation';

/**
 * The shared request-validation helper: schema in, typed value or a 400 with field detail out.
 * Routes keep their own message (the client shows it) and get `issues` for free.
 */
const budget = z.object({
  amount: z.number().positive(),
  period: z.enum(['weekly', 'monthly']),
});

async function withServer(app: Express, run: (baseUrl: string) => Promise<void>): Promise<void> {
  const server = app.listen(0);
  try {
    await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe('parseBody / parseValue / parseQuery', () => {
  it('returns the parsed value and drops keys the route did not ask for', () => {
    const result = parseBody({ body: { amount: 10, period: 'monthly', userId: 'someone-else' } }, budget);
    expect(result).toEqual({ ok: true, data: { amount: 10, period: 'monthly' } });
  });

  it('names every field that failed instead of throwing', () => {
    const result = parseValue({ amount: -1, period: 'daily' }, budget);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map((issue) => issue.path).sort()).toEqual(['amount', 'period']);
    expect(result.issues.every((issue) => issue.message.length > 0)).toBe(true);
  });

  it('treats a missing body as an empty object rather than crashing the route', () => {
    const result = parseBody({}, budget);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map((issue) => issue.path).sort()).toEqual(['amount', 'period']);
  });

  it('validates query strings, including coerced numbers and defaults', () => {
    const query = z.object({ page: z.coerce.number().int().min(1).default(1) });
    expect(parseQuery({ query: { page: '3' } }, query)).toEqual({ ok: true, data: { page: 3 } });
    expect(parseQuery({}, query)).toEqual({ ok: true, data: { page: 1 } });
    expect(parseQuery({ query: { page: 'x' } }, query).ok).toBe(false);
  });

  it('reports a whole-value failure at the root', () => {
    const result = parseValue('not an object', budget);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0].path).toBe('(root)');
  });
});

describe('sendValidationError', () => {
  it("answers 400 with the caller's message and the field issues", async () => {
    const app = express();
    app.use(express.json());
    app.post('/budget', (req, res) => {
      const parsed = parseBody(req, budget);
      if (!parsed.ok) return sendValidationError(res, parsed.issues, 'Failed to create budget');
      return res.json(parsed.data);
    });

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/budget`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ amount: -1, period: 'daily' }),
      });
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.message).toBe('Failed to create budget');
      expect(body.issues.map((issue: { path: string }) => issue.path).sort()).toEqual(['amount', 'period']);
    });
  });

  it('lets a valid body through unchanged', async () => {
    const app = express();
    app.use(express.json());
    app.post('/budget', (req, res) => {
      const parsed = parseBody(req, budget);
      if (!parsed.ok) return sendValidationError(res, parsed.issues, 'Failed to create budget');
      return res.json(parsed.data);
    });

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/budget`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ amount: 300, period: 'monthly', ignored: true }),
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ amount: 300, period: 'monthly' });
    });
  });
});
