/**
 * The id of the request being served, for outbound calls to our own services.
 *
 * Without it a slow PDF render or a failed AI call cannot be followed from our access log into
 * the log of the service that actually did the work: both sides had their own ids, and nothing
 * linked them. `AsyncLocalStorage` carries the id through every await, so the helpers below do not
 * have to take it as a parameter from each of their callers.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

const storage = new AsyncLocalStorage<string>();

export function runWithRequestId<T>(requestId: string, fn: () => T): T {
  return storage.run(requestId, fn);
}

export function currentRequestId(): string | undefined {
  return storage.getStore();
}

/** Headers for an outbound call: empty when there is no request in progress (a job, say). */
export function requestIdHeaders(): Record<string, string> {
  const id = storage.getStore();
  return id ? { 'x-request-id': id } : {};
}
