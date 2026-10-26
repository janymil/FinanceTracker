import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The two prompts that touch money directly: a receipt photo and a bank statement.
 *
 * These are not style tests. Each assertion is a rule that, when the prompt lacked it, produced a
 * wrong amount, a wrong date or a translated merchant name in the person's records. If a future
 * edit drops one, this file says which consequence comes back with it.
 */
const create = vi.hoisted(() => vi.fn());

vi.mock('../../lib/aiProvider', () => ({
  AI_MODELS: { default: 'gpt-6-luna', voice: 'mistral-small-latest', generation: 'gpt-6-luna', parsing: 'gpt-6-luna', classification: 'gpt-6-luna' },
  MODEL_CATALOG: { 'gpt-6-luna': { provider: 'openai', model: 'gpt-6-luna', inputPricePerM: 0.1, outputPricePerM: 0.5 } },
  createRoutedClient: () => ({ chat: { completions: { create } } }),
  stripCodeFences: (value: string) => value,
}));

vi.mock('../../lib/unifiedAICache', () => ({
  UnifiedAICache: class {
    get = async () => null;
    set = async () => undefined;
  },
}));

import { RECEIPT_PROMPT_VERSION, RECEIPT_SYSTEM_PROMPT } from '../../server/receiptExtraction';
import { parseBankStatement } from '../../server/openai';

const reply = (value: unknown) => ({
  choices: [{ message: { content: typeof value === 'string' ? value : JSON.stringify(value) } }],
});
const systemOf = () => create.mock.calls[0][0].messages.find((m: any) => m.role === 'system').content as string;

beforeEach(() => {
  create.mockReset();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('the receipt prompt', () => {
  it('is versioned, so a stored fixture says which prompt produced it', () => {
    expect(RECEIPT_PROMPT_VERSION).toBe('receipt-extract@2');
  });

  it('asks for the total paid, never a line item, a subtotal or the tax figure', () => {
    expect(RECEIPT_SYSTEM_PROMPT).toMatch(/FINAL TOTAL/);
    expect(RECEIPT_SYSTEM_PROMPT).toMatch(/line item/i);
    expect(RECEIPT_SYSTEM_PROMPT).toMatch(/subtotal/i);
    expect(RECEIPT_SYSTEM_PROMPT).toMatch(/tax figure alone/i);
  });

  it('asks for the purchase date, not a print date or a card expiry', () => {
    expect(RECEIPT_SYSTEM_PROMPT).toMatch(/day the purchase happened/);
    expect(RECEIPT_SYSTEM_PROMPT).toMatch(/card expiry/);
    expect(RECEIPT_SYSTEM_PROMPT).toMatch(/YYYY-MM-DD/);
  });

  it('keeps the shop name as printed and returns null instead of guessing', () => {
    expect(RECEIPT_SYSTEM_PROMPT).toMatch(/Do not translate/);
    expect(RECEIPT_SYSTEM_PROMPT).toMatch(/street address/);
    expect(RECEIPT_SYSTEM_PROMPT).toMatch(/Never invent a field/);
    expect(RECEIPT_SYSTEM_PROMPT).toMatch(/return null/);
  });
});

describe('the bank statement prompt', () => {
  it('does not ask for merchant names to be translated into the app language', async () => {
    create.mockResolvedValueOnce(reply({ transactions: [] }));
    await parseBankStatement('x', 'sk-sk');

    const prompt = systemOf();
    // The app language is named, but explicitly not as a translation instruction.
    expect(prompt).toContain('Slovak');
    expect(prompt).toMatch(/must NOT\s+change/i);
    expect(prompt).toMatch(/as printed/i);
  });

  it('names the lines that are not money movements', async () => {
    create.mockResolvedValueOnce(reply({ transactions: [] }));
    await parseBankStatement('x', 'en-us');

    const prompt = systemOf();
    expect(prompt).toMatch(/running balance/i);
    expect(prompt).toMatch(/Opening balance/i);
    expect(prompt).toMatch(/page headers/i);
  });

  it('asks the model to count its own rows, and warns when the count disagrees', async () => {
    create.mockResolvedValueOnce(reply({
      count: 3,
      transactions: [{ date: '2026-10-01', description: 'Coop', amount: '12.5', type: 'expense' }],
    }));

    const { transactions } = await parseBankStatement('x', 'en-us');

    expect(systemOf()).toContain('"count"');
    expect(transactions).toHaveLength(1);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('rows but counted 3'));
  });

  it('still returns a plain transaction list, so the importer keeps its shape', async () => {
    create.mockResolvedValueOnce(reply({ transactions: [{ date: '2026-10-01', description: 'Coop', amount: '12.5' }] }));
    const result = await parseBankStatement('x', 'en-us');

    expect(Object.keys(result)).toEqual(['transactions']);
    expect(result.transactions[0]).toMatchObject({ type: 'expense', category: null });
  });
});
