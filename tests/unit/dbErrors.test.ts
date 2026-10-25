import { describe, expect, it } from 'vitest';
import { isUniqueViolation } from '../../server/dbErrors';

describe('isUniqueViolation', () => {
  it('sees a plain Postgres error', () => {
    expect(isUniqueViolation({ code: '23505', message: 'x' })).toBe(true);
  });

  it('sees the Postgres error that Drizzle wraps in `cause`', () => {
    const wrapped = Object.assign(new Error('Failed query: insert into "users" ...'), {
      cause: Object.assign(new Error('duplicate key value violates unique constraint "users_pkey"'), { code: '23505' }),
    });
    expect(isUniqueViolation(wrapped)).toBe(true);
  });

  it('ignores other errors and empty values', () => {
    expect(isUniqueViolation(new Error('connection reset'))).toBe(false);
    expect(isUniqueViolation({ code: '23503', cause: { code: '42P01' } })).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
  });
});
