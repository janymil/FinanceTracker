import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'net';
import type { Server } from 'http';

/**
 * Response headers must not be patched.
 *
 * server/index.ts used to wrap `res.setHeader` / `res.writeHead` and swallow the error Node throws
 * when a header is set after the body went out. The wrapper made that bug invisible: the header
 * was dropped, the response still looked fine, and nothing was logged. These tests fail if the
 * wrapper comes back, and pin the behaviour a bug is supposed to produce.
 */
const ROOT = path.resolve(__dirname, '..', '..');

describe('response headers are not patched', () => {
  it('server/index.ts leaves res.setHeader and res.writeHead alone', () => {
    const source = fs.readFileSync(path.join(ROOT, 'server/index.ts'), 'utf8');
    expect(source).not.toMatch(/\bres\.setHeader\s*=/);
    expect(source).not.toMatch(/\bres\.writeHead\s*=/);
  });

  describe('a real response', () => {
    let server: Server;
    let baseUrl: string;
    let ownsSetHeader: boolean | undefined;
    let lateHeaderResult: string | undefined;

    beforeAll(() => {
      const app = express();
      app.get('/probe', (_req, res) => {
        // A wrapper installed by middleware would show up as an own property here.
        ownsSetHeader = Object.prototype.hasOwnProperty.call(res, 'setHeader');
        res.json({ ok: true });
        try {
          res.setHeader('X-Late', '1');
          lateHeaderResult = 'silently-accepted';
        } catch (error: any) {
          lateHeaderResult = error?.code ?? 'threw';
        }
      });
      server = app.listen(0);
      baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    });

    afterAll(() => {
      server.close();
    });

    const probe = async () => {
      const response = await fetch(`${baseUrl}/probe`);
      expect(response.status).toBe(200);
      expect(response.headers.get('x-late')).toBeNull();
      await response.json();
    };

    it('inherits setHeader from the prototype instead of replacing it', async () => {
      await probe();
      expect(ownsSetHeader).toBe(false);
    });

    it('throws ERR_HTTP_HEADERS_SENT rather than dropping the header silently', async () => {
      await probe();
      expect(lateHeaderResult).toBe('ERR_HTTP_HEADERS_SENT');
    });
  });
});
