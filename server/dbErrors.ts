/**
 * True when Postgres refused an insert because the row already exists.
 *
 * Drizzle wraps the driver error in a `DrizzleQueryError` whose message is only
 * "Failed query: ...", and keeps the real Postgres error (with `code: '23505'`) in `cause`.
 * Looking at the top-level error alone misses it, which turned two simultaneous first
 * requests from a new person into a 500 for one of them.
 */
export function isUniqueViolation(error: any): boolean {
  for (let current = error, depth = 0; current && depth < 5; current = current.cause, depth++) {
    if (current.code === '23505' || /duplicate key/i.test(current.message ?? '')) return true;
  }
  return false;
}
