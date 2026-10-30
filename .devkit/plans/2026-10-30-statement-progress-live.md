# 2026-10-30 — the statement screen shows the work happening instead of a frozen 0%

## Goal

A person uploading a statement sees which step is running, how long it has been running,
and that the app is still alive — for the whole few minutes, including the long AI step.

## Out of scope

- Making the processing itself faster.
- The consent wording and the redaction rules (separate plan).

## Files that will change

- `server/routes/importRoutes.ts` — the stream stops requiring a header the browser cannot
  send (`EventSource` sends no `Authorization`), replays the events that were emitted before
  the browser connected, and sends a heartbeat so a silent stream is distinguishable from a
  dead one.
- `client/src/components/PDFProcessingProgress.tsx` — opens the stream with a short-lived
  ticket, keeps counting time while nothing arrives, and stops calling a slow step a failure.
- `client/public/locales/{es-pe,en-us,sk-sk}/translation.json` — the new "still working" lines.

## The risk

- A ticket is a bearer credential in a URL: it is short-lived, bound to one account and one
  session, and cannot read anything. If the expiry is too short the stream 401s mid-import —
  set it generously (15 min) and never log it.
- Replaying buffered events must not resurrect a finished session for the next upload; the
  buffer is keyed by account+session and expires with it.
- Talking about "a few minutes" sets an expectation. If the AI step takes longer than the
  estimate the copy still holds because it never promises a finish time.

## How it is proven

- Test `tests/unit/pdfProgressStream.test.ts`: connecting with a valid ticket and **no**
  authorization header receives the events emitted before the connection opened, and an
  unknown ticket is refused. Fails today, where the route requires `isAuthenticated`.
- Gate: `./verify.sh`

## Steps

1. Ticket store + `POST /api/import/pdf-progress-ticket`.
2. SSE route: ticket auth, replay buffer, heartbeat, `flushHeaders`.
3. Client component: ticket fetch, elapsed timer, stall message, retry instead of fatal error.
4. Translation keys in three locales.
5. Test, then `./verify.sh`.

## Review — filled in after building, by the reviewer pass

- [x] Q1 · plain sentence a non-developer can read: while a statement is being read, the page now
      shows which step is running, a timer, and says "still working" when a step is slow.
- [x] Q2 · the test that fails without this change: `tests/unit/pdfProgressStream.test.ts` — the
      first case publishes two steps before anything is connected and asserts both arrive; the old
      code wrote only to an existing connection, so it delivered nothing.
- [x] Q3 · `./verify.sh` — `checks` passes; `tests` 1299 pass, 9 files fail to collect for a
      missing `DATABASE_URL` in this shell (pre-existing).
- [x] Q4 · the risk, named: the ticket travels in a URL, so it can appear in logs; it is bound to
      one account and one import, expires in 15 minutes, and grants nothing but this stream. If
      the replay buffer leaked across sessions an import could show another import's steps, so it
      is keyed by account + session and pruned. The copy now mentions "a few minutes": if a future
      import takes an hour the screen is still honest because it never promises a finish time.
- [ ] Q5 · the reviewer read the diff (who, when): same session as the author — a second pair of
      eyes is still owed on the component behaviour in a browser.
- [x] `lessons.md` updated — yes, the `EventSource` line.

