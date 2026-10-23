/**
 * Minimal stand-in for the external PDF service (`pdf-processor.formatika.dev`).
 *
 * Why this exists: the PDF is produced by the **server** calling that service, so
 * `page.route()` (browser-only) can never intercept it. E2E therefore needs a real local
 * HTTP endpoint plus an app started with `PDF_SERVICE_URL` pointing at it.
 *
 * It also records requests so a test can assert the payload contract end-to-end.
 */
import { createServer, type Server } from 'node:http';

export interface PdfStubRequest {
  url: string;
  method: string;
  apiKey: string | undefined;
  body: unknown;
}

export interface PdfStubHandle {
  port: number;
  url: string;
  requests: PdfStubRequest[];
  close: () => Promise<void>;
}

const PDF_BYTES = Buffer.from('%PDF-1.4\n% E2E stub\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n', 'utf8');

export async function startPdfStubServer(port = 4010): Promise<PdfStubHandle> {
  const requests: PdfStubRequest[] = [];

  const server: Server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');

      let body: unknown = raw;
      try {
        body = JSON.parse(raw);
      } catch {
        // keep the raw string
      }

      requests.push({
        url: req.url ?? '',
        method: req.method ?? '',
        apiKey: typeof req.headers['x-api-key'] === 'string' ? req.headers['x-api-key'] : undefined,
        body,
      });

      if (req.url !== '/generate-pdf' || req.method !== 'POST') {
        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'not found' }));
        return;
      }

      res.writeHead(200, {
        'content-type': 'application/pdf',
        'content-length': String(PDF_BYTES.length),
      });
      res.end(PDF_BYTES);
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve());
  });

  return {
    port,
    url: `http://127.0.0.1:${port}`,
    requests,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
