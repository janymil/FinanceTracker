import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../server/logger', () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import {
  issueProgressTicket,
  openProgressStream,
  publishProgress,
  redeemProgressTicket,
  resetProgressState,
} from '../../server/pdfProgressStream';

/** A stand-in for the HTTP response, recording exactly what the browser would receive. */
function makeSink() {
  const chunks: string[] = [];
  const listeners = new Map<string, () => void>();
  return {
    chunks,
    writeHead: vi.fn(),
    flushHeaders: vi.fn(),
    write: (chunk: string) => {
      chunks.push(chunk);
      return true;
    },
    on: (event: string, listener: () => void) => {
      listeners.set(event, listener);
    },
    end: vi.fn(),
    close: () => listeners.get('close')?.(),
    /** The events, parsed, in the order the browser saw them. */
    events: () =>
      chunks
        .filter((chunk) => chunk.startsWith('data: '))
        .map((chunk) => JSON.parse(chunk.slice('data: '.length))),
  };
}

describe('statement progress stream', () => {
  beforeEach(() => {
    resetProgressState();
    vi.useRealTimers();
  });

  it('delivers the steps that happened before the browser connected', () => {
    // This is the bug on screen: the upload starts, validation and extraction fire before the
    // EventSource is open, and those writes used to be dropped (`if (connection)`), leaving the
    // bar at 0% for the whole import.
    publishProgress('user_1', 'session_1', { stage: 'pdf_validation', percentage: 5, message: 'Validating' });
    publishProgress('user_1', 'session_1', { stage: 'text_extraction', percentage: 15, message: 'Extracting' });

    const sink = makeSink();
    openProgressStream('user_1', 'session_1', sink);

    expect(sink.events().map((event) => event.stage)).toEqual(['pdf_validation', 'text_extraction']);
    expect(sink.events()[1].percentage).toBe(15);
  });

  it('continues after the connection opens', () => {
    const sink = makeSink();
    openProgressStream('user_1', 'session_1', sink);

    publishProgress('user_1', 'session_1', { stage: 'ai_parsing', percentage: 50, message: 'Parsing' });

    expect(sink.events().at(-1)?.stage).toBe('ai_parsing');
  });

  it('replays the steps to a browser that reconnects', () => {
    publishProgress('user_1', 'session_1', { stage: 'ai_parsing', percentage: 50, message: 'Parsing' });

    const first = makeSink();
    openProgressStream('user_1', 'session_1', first);
    first.close();

    const second = makeSink();
    openProgressStream('user_1', 'session_1', second);

    expect(second.events().map((event) => event.stage)).toEqual(['ai_parsing']);
  });

  it('sends a heartbeat so silence can be told apart from a dropped connection', () => {
    vi.useFakeTimers();
    const sink = makeSink();
    openProgressStream('user_1', 'session_1', sink);

    vi.advanceTimersByTime(15_000);

    expect(sink.chunks).toContain(': ping\n\n');
    sink.close();
  });

  it('gives one account and one session a usable ticket, and nobody else', () => {
    const ticket = issueProgressTicket('user_1', 'session_1');

    expect(redeemProgressTicket(ticket)).toEqual({ userId: 'user_1', sessionId: 'session_1' });
    expect(redeemProgressTicket('not-a-ticket')).toBeNull();
  });

  it('stops accepting a ticket after it expires', () => {
    vi.useFakeTimers();
    const ticket = issueProgressTicket('user_1', 'session_1');

    vi.advanceTimersByTime(16 * 60 * 1000);

    expect(redeemProgressTicket(ticket)).toBeNull();
  });

  it('keeps two accounts apart even when they pick the same session id', () => {
    const mine = makeSink();
    openProgressStream('user_1', 'same-id', mine);

    publishProgress('user_2', 'same-id', { stage: 'ai_parsing', percentage: 50, message: 'Someone else' });

    expect(mine.events()).toHaveLength(0);
  });
});
