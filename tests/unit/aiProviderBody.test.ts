/**
 * Regression test for the AI router's request body.
 *
 * Found by the Error Guard smoke test: passing `task` (the router's own attribution field)
 * made OpenAI answer `400 Unknown parameter: 'task'`, which failed the whole triage call.
 * The router must strip its control fields before anything leaves the process.
 */
import { describe, expect, it } from 'vitest';
import { AI_MODELS, MODEL_CATALOG, buildBody } from '../../lib/aiProvider';

const messages = [{ role: 'user', content: 'hello' }];

describe('buildBody', () => {
  it('never forwards the router control field `task`', () => {
    const body = buildBody(MODEL_CATALOG[AI_MODELS.default], {
      model: 'ignored-by-router',
      messages,
      task: 'error-triage',
    });
    expect(body.task).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('error-triage');
  });

  it('always uses the routed model, not the requested one', () => {
    const body = buildBody(MODEL_CATALOG['deepseek-flash'], { model: 'gpt-6-luna', messages });
    expect(body.model).toBe('deepseek-flash');
  });

  it('renames max_tokens for OpenAI and keeps it for others', () => {
    const openai = buildBody(MODEL_CATALOG['gpt-6-luna'], { messages, max_tokens: 100 });
    expect(openai.max_completion_tokens).toBe(100);
    expect(openai.max_tokens).toBeUndefined();

    const deepseek = buildBody(MODEL_CATALOG['deepseek-flash'], { messages, max_tokens: 100 });
    expect(deepseek.max_tokens).toBe(100);
  });

  it('disables thinking mode on DeepSeek so short structured tasks return content', () => {
    const body = buildBody(MODEL_CATALOG['deepseek-flash'], { messages });
    expect(body.thinking).toEqual({ type: 'disabled' });
  });

  it('tolerates a missing params object', () => {
    expect(() => buildBody(MODEL_CATALOG[AI_MODELS.default], undefined)).not.toThrow();
  });
});
