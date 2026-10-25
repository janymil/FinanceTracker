import type { Response } from 'express';
import type { z } from 'zod';

/**
 * Validation for routes that accept a body or a query string.
 *
 * Two things were wrong before this existed. Schemas from `@shared/schema` (drizzle-zod) were
 * applied with `.parse()`, so an invalid body threw and was answered by the route's own
 * `catch` — the same generic 400 a database failure got, with no hint about which field was
 * wrong. And most POST/PUT/PATCH handlers had no schema at all: they read `req.body` directly
 * and hand-checked a few fields.
 *
 * Callers keep their own wording in `message` (the client shows it), and the client may read
 * `issues` for per-field detail:
 *
 *   const body = parseBody(req, insertBudgetSchema);
 *   if (!body.ok) return sendValidationError(res, body.issues, 'Failed to create budget');
 *   const budget = await storage.createBudget(body.data);
 *
 * Request bodies and query strings are objects; drizzle-zod schemas strip unknown keys by
 * default, so this also stops a client from smuggling columns the route did not intend to set.
 * Webhooks (raw body, signature-checked) and multipart uploads do not belong here.
 */

export interface ValidationIssue {
  /** Dotted path of the offending field; `(root)` when the whole value is wrong. */
  path: string;
  message: string;
}

export type ParseResult<T> = { ok: true; data: T } | { ok: false; issues: ValidationIssue[] };

function toIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join('.') || '(root)',
    message: issue.message,
  }));
}

/** Validate any value (a request body, a query string, or an object a route composed itself). */
export function parseValue<T>(input: unknown, schema: z.ZodType<T>): ParseResult<T> {
  const result = schema.safeParse(input);
  return result.success ? { ok: true, data: result.data } : { ok: false, issues: toIssues(result.error) };
}

export function parseBody<T>(req: { body?: unknown }, schema: z.ZodType<T>): ParseResult<T> {
  return parseValue(req.body ?? {}, schema);
}

export function parseQuery<T>(req: { query?: unknown }, schema: z.ZodType<T>): ParseResult<T> {
  return parseValue(req.query ?? {}, schema);
}

/**
 * Answers 400 and returns the response, so a caller can `return sendValidationError(...)`.
 * `message` stays the wording the client already shows; field detail travels in `issues`.
 */
export function sendValidationError(
  res: Response,
  issues: ValidationIssue[],
  message = 'Invalid request'
): Response {
  return res.status(400).json({ message, issues });
}
