/**
 * Playwright global setup: starts the PDF stub when E2E is enabled.
 *
 * The app under test must be started with `PDF_SERVICE_URL` pointing at this stub —
 * `playwright.config.ts` does that in the managed `webServer` block.
 */
import { startPdfStubServer } from './support/pdf-stub-server';

export default async function globalSetup(): Promise<(() => Promise<void>) | void> {
  if (process.env.E2E_ENABLED !== '1') return;

  const port = Number(process.env.E2E_PDF_STUB_PORT ?? 4010);
  const stub = await startPdfStubServer(port);
  console.log(`[e2e] PDF stub listening on ${stub.url}`);

  return async () => {
    await stub.close();
    console.log('[e2e] PDF stub stopped');
  };
}
