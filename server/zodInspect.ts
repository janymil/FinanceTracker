import { ZodError } from 'zod';

/**
 * `console.error('...', zodError)` throws "Cannot read properties of undefined (reading 'value')"
 * inside Node's inspector on current Node versions. The throw happens inside the route's own
 * `catch`, so the response is never sent (the request hangs) and an unhandled rejection is left
 * behind. Every route that validates with zod and logs what it caught is exposed to it.
 *
 * A custom inspect function makes logging a ZodError safe everywhere, including error reporting.
 */
const inspect = Symbol.for('nodejs.util.inspect.custom');

export function describeZodError(error: ZodError): string {
  const issues = error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`);
  return `ZodError: ${issues.join('; ') || 'invalid input'}`;
}

if (!(ZodError.prototype as any)[inspect]) {
  Object.defineProperty(ZodError.prototype, inspect, {
    value: function (this: ZodError) {
      return describeZodError(this);
    },
    configurable: true,
    writable: true,
  });
}
