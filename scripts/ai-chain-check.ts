/**
 * End-to-end check of the AI path, with no keys and no money: Kaptia's real `routeChat`
 * -> the real ai-processor gateway -> a fake "OpenAI" served from this process.
 *
 *   npm run ai:chain-check                       # gateway checked out at ./ai-processor
 *   GATEWAY_DIR=/opt/ai-processor npm run ai:chain-check
 *
 * It proves what the unit tests can only mock: a prompt is anonymised before it leaves, usage
 * and cost come back from the gateway, a dead gateway falls back to the direct providers, and
 * a request the app gives up on is cancelled upstream (nothing is billed for an unread answer).
 * Exit code 0 = every check passed.
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

// A fake "OpenAI": records what it receives, can hang on request.
let hang = false;
const received: Array<{ body: any; closedAt?: number; at: number }> = [];

const upstream = http.createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    const entry: { body: any; closedAt?: number; at: number } = { body: JSON.parse(raw || '{}'), at: Date.now() };
    received.push(entry);
    res.on('close', () => { if (!res.writableFinished) entry.closedAt = Date.now(); });
    if (hang) return; // never answer
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({
      id: 'chatcmpl-test', object: 'chat.completion', model: entry.body.model,
      choices: [{ index: 0, message: { role: 'assistant', content: '{"answer":"from-upstream"}' } }],
      usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
    }));
  });
});
await new Promise<void>((r) => upstream.listen(0, '127.0.0.1', r));
const upstreamPort = (upstream.address() as AddressInfo).port;

// Hermetic: only the fake upstream below may be reachable, whatever .env files exist. Setting a
// variable (even to '') before the modules load stops dotenv from filling it in from a real file.
for (const key of ['DEEPSEEK_API_KEY', 'GROQ_API_KEY', 'MISTRAL_API_KEY']) process.env[key] = '';
process.env.OPENAI_BASE_URL = `http://127.0.0.1:${upstreamPort}/v1`;
process.env.OPENAI_API_KEY = 'sk-test';
process.env.AI_PROCESSOR_API_KEY = 'gw-secret';
process.env.AI_REQUEST_TIMEOUT_MS = '1500';

const GW = pathToFileURL(path.resolve(process.env.GATEWAY_DIR ?? 'ai-processor')).href;
const APP = pathToFileURL(process.cwd()).href;
const { createApp } = await import(`${GW}/app.ts`);
const { routeChat, collectAIUsage, resetAIBreakers } = await import(`${APP}/lib/aiProvider.ts`);

const gateway = createApp().listen(0, '127.0.0.1');
await new Promise((r) => gateway.once('listening', r));
const gatewayPort = (gateway.address() as AddressInfo).port;

process.env.AI_PROCESSOR_ENABLED = 'true';
process.env.AI_PROCESSOR_URL = `http://127.0.0.1:${gatewayPort}`;
process.env.AI_PROCESSOR_API_KEY = 'gw-secret';

const results: Array<[string, boolean, string]> = [];
const check = (name: string, ok: boolean, detail = '') => {
  results.push([name, ok, detail]);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

const request = (extra: Record<string, unknown> = {}) => ({
  model: 'gpt-6-luna',
  task: 'chain-check',
  messages: [
    { role: 'system', content: 'Answer in JSON.' },
    { role: 'user', content: 'Refund to ana.novak@example.com, IBAN CH9300762011623852957, 12.50' },
  ],
  ...extra,
});

// 1. gateway up ------------------------------------------------------------------
resetAIBreakers();
{
  const { result, records } = await collectAIUsage(() => routeChat(request()));
  check('1a answer comes back through the gateway', result.choices[0].message.content.includes('from-upstream'));
  check('1b exactly one call reached the provider', received.length === 1, `got ${received.length}`);
  const sent = JSON.stringify(received[0]?.body.messages);
  check('1c e-mail and IBAN never reached the provider', !sent.includes('ana.novak@example.com') && !sent.includes('CH9300762011623852957'));
  check('1d the router-only `task` field was not forwarded', received[0]?.body.task === undefined);
  check('1e usage is tagged as gateway with real tokens and cost',
    records[0]?.via === 'gateway' && records[0].inputTokens === 100 && records[0].costUsd > 0,
    JSON.stringify(records[0]));
}

// 2. gateway process gone -> direct ----------------------------------------------
resetAIBreakers();
received.length = 0;
await new Promise<void>((r) => gateway.close(() => r()));
{
  const started = Date.now();
  const { result, records } = await collectAIUsage(() => routeChat(request()));
  check('3a a dead gateway still yields an answer', result.choices[0].message.content.includes('from-upstream'));
  check('3b served directly', records[0]?.via === 'direct' && records[0].fallback === true);
  check('3c and quickly', Date.now() - started < 3000, `${Date.now() - started}ms`);
}

// 4. abort propagation: slow upstream, app times out, gateway must stop the upstream call
resetAIBreakers();
received.length = 0;
const gateway2 = createApp().listen(0, '127.0.0.1');
await new Promise((r) => gateway2.once('listening', r));
process.env.AI_PROCESSOR_URL = `http://127.0.0.1:${(gateway2.address() as AddressInfo).port}`;
process.env.AI_PROCESSOR_TIMEOUT_MS = '600';
hang = true;
{
  const started = Date.now();
  let failed = false;
  try { await routeChat(request()); } catch { failed = true; }
  const elapsed = Date.now() - started;
  await new Promise((r) => setTimeout(r, 300)); // let the close events land
  check('4a with everything hanging the call ends in an error, not a hang', failed, `${elapsed}ms`);

  const viaGateway = received[0];
  check('4b the gateway forwarded the slow request upstream', Boolean(viaGateway));
  check('4c the gateway CLOSED that upstream request when the app gave up (no wasted spend)',
    Boolean(viaGateway?.closedAt) && viaGateway.closedAt! - viaGateway.at < 1500,
    viaGateway?.closedAt ? `closed after ${viaGateway.closedAt - viaGateway.at}ms` : 'never closed');
}

gateway2.close();
upstream.closeAllConnections?.();
upstream.close();

const failedChecks = results.filter(([, ok]) => !ok);
console.log(`\n${results.length - failedChecks.length}/${results.length} checks passed`);
process.exit(failedChecks.length ? 1 : 0);
