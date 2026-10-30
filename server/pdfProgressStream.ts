import crypto from 'crypto';
import { log } from './logger';

/**
 * The "what is it doing now?" stream for statement imports.
 *
 * Three things were wrong with the first version, and all three looked the same on screen — a
 * progress bar frozen at 0% telling the person it was connected:
 *
 *  1. `EventSource` cannot send an `Authorization` header. The stream required a Clerk session
 *     header, so the browser opened it unauthenticated and the server answered 401. Nothing was
 *     ever delivered. A short-lived ticket in the query string replaces that: it names one
 *     account and one session, it cannot read anything, and it is not a session token.
 *  2. Events published before the browser connected were dropped on the floor (`if (connection)`),
 *     and the first events — validation, extraction — always fire before the stream is open. The
 *     last events are now buffered and replayed to whoever connects.
 *  3. A silent stream was indistinguishable from a dead one. A heartbeat now proves the
 *     connection is alive, so the screen can honestly say "still working" instead of freezing.
 */

export interface PdfProgressPayload {
  stage: string;
  percentage: number;
  message: string;
  transactionsProcessed?: number;
  totalTransactions?: number;
  overallProgress?: number;
}

/** The part of an HTTP response this module needs; keeps it usable from a test without Express. */
export interface ProgressSink {
  write: (chunk: string) => unknown;
  writeHead?: (status: number, headers: Record<string, string>) => unknown;
  flushHeaders?: () => void;
  on?: (event: string, listener: () => void) => unknown;
  end?: () => void;
}

interface SessionState {
  userId: string;
  sessionId: string;
  sink: ProgressSink | null;
  buffer: Array<{ seq: number; at: number; payload: PdfProgressPayload }>;
  seq: number;
  updatedAt: number;
  heartbeat: ReturnType<typeof setInterval> | null;
}

interface TicketState {
  userId: string;
  sessionId: string;
  expiresAt: number;
}

/** Enough to replay a whole import, small enough that a stuck session cannot grow forever. */
const MAX_BUFFERED_EVENTS = 60;
const SESSION_TTL_MS = 30 * 60 * 1000;
const TICKET_TTL_MS = 15 * 60 * 1000;
const HEARTBEAT_MS = 15 * 1000;

const sessions = new Map<string, SessionState>();
const tickets = new Map<string, TicketState>();

const sessionKey = (userId: string, sessionId: string) => `${userId}:${sessionId}`;

function prune(now = Date.now()) {
  sessions.forEach((session, key) => {
    const idle = now - session.updatedAt;
    if (idle > SESSION_TTL_MS && (!session.sink || idle > SESSION_TTL_MS * 2)) {
      if (session.heartbeat) clearInterval(session.heartbeat);
      sessions.delete(key);
    }
  });
  tickets.forEach((state, ticket) => {
    if (state.expiresAt <= now) tickets.delete(ticket);
  });
}

/**
 * A one-session, short-lived credential for the stream.
 *
 * The alternative — putting the Clerk token in the query string — writes a real credential into
 * proxy access logs and browser history. This value can only ask "what is my import doing".
 */
export function issueProgressTicket(userId: string, sessionId: string): string {
  prune();
  const ticket = crypto.randomBytes(24).toString('hex');
  tickets.set(ticket, { userId, sessionId, expiresAt: Date.now() + TICKET_TTL_MS });
  return ticket;
}

/**
 * Read a ticket. It is not deleted on use: `EventSource` reconnects by itself after a network
 * blip and would otherwise be locked out in the middle of the import.
 */
export function redeemProgressTicket(ticket: string): { userId: string; sessionId: string } | null {
  const state = tickets.get(ticket);
  if (!state) return null;
  if (state.expiresAt <= Date.now()) {
    tickets.delete(ticket);
    return null;
  }
  return { userId: state.userId, sessionId: state.sessionId };
}

function getSession(userId: string, sessionId: string): SessionState {
  const key = sessionKey(userId, sessionId);
  const existing = sessions.get(key);
  if (existing) return existing;

  const created: SessionState = {
    userId,
    sessionId,
    sink: null,
    buffer: [],
    seq: 0,
    updatedAt: Date.now(),
    heartbeat: null,
  };
  sessions.set(key, created);
  return created;
}

/**
 * Publish one step of the import.
 *
 * Buffered even when nobody is listening: the stream opens a moment after the upload starts, and
 * the first steps are exactly the ones people need to see.
 */
export function publishProgress(userId: string, sessionId: string, payload: PdfProgressPayload) {
  prune();
  const session = getSession(userId, sessionId);
  session.seq += 1;
  session.updatedAt = Date.now();

  const event = { seq: session.seq, at: session.updatedAt, payload };
  session.buffer.push(event);
  if (session.buffer.length > MAX_BUFFERED_EVENTS) session.buffer.shift();

  if (!session.sink) return;
  try {
    session.sink.write(`data: ${JSON.stringify({ ...payload, seq: event.seq, at: event.at })}\n\n`);
  } catch (error) {
    // The person closed the tab. Keep the buffer: a reconnect should still show the work.
    log.warn('[PDF Progress] Could not write to the progress stream:', (error as Error).message);
    session.sink = null;
  }
}

/** Replay everything this session has published so far, oldest first. */
export function replayProgress(userId: string, sessionId: string, sink: ProgressSink): number {
  const session = sessions.get(sessionKey(userId, sessionId));
  if (!session) return 0;
  let sent = 0;
  for (const event of session.buffer) {
    try {
      sink.write(`data: ${JSON.stringify({ ...event.payload, seq: event.seq, at: event.at })}\n\n`);
      sent += 1;
    } catch {
      break;
    }
  }
  return sent;
}

/**
 * Attach an HTTP response to a session: headers, the events that already happened, a heartbeat
 * and cleanup on disconnect.
 */
export function openProgressStream(userId: string, sessionId: string, sink: ProgressSink) {
  const session = getSession(userId, sessionId);
  session.sink = sink;
  session.updatedAt = Date.now();

  if (sink.writeHead) {
    sink.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      // Proxies that see this stop buffering the stream until it closes.
      'X-Accel-Buffering': 'no',
    });
  }
  sink.flushHeaders?.();

  const replayed = replayProgress(userId, sessionId, sink);
  log.info(`[PDF Progress] Stream open for ${sessionId}; replayed ${replayed} event(s)`);

  if (session.heartbeat) clearInterval(session.heartbeat);
  session.heartbeat = setInterval(() => {
    try {
      sink.write(': ping\n\n');
    } catch {
      // handled by the close listener below
    }
  }, HEARTBEAT_MS);

  sink.on?.('close', () => {
    if (session.heartbeat) clearInterval(session.heartbeat);
    session.heartbeat = null;
    if (session.sink === sink) session.sink = null;
    session.updatedAt = Date.now();
  });
}

/** Test/ops helper: forget every session. Never called from a request. */
export function resetProgressState() {
  sessions.forEach((session) => {
    if (session.heartbeat) clearInterval(session.heartbeat);
  });
  sessions.clear();
  tickets.clear();
}

