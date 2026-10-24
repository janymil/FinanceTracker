import { describe, expect, it } from 'vitest';
import {
  contextualFallbackTips,
  detectLanguage,
  emptyStateCopy,
  financialTipsFallback,
  healthFallbackCopy,
  progressTipFallback,
} from '../../shared/aiFallbacks';

/**
 * What a person sees when there is no data yet, or the model could not be reached. It is
 * written out in all three languages (never English on a Slovak screen) and follows the house
 * copy rule: nothing that suggests a licensed financial service.
 */
const LANGUAGES = ['en-us', 'es-pe', 'sk-sk'] as const;

// Whole-word stems in the three languages: bank, loan, credit, invest, advisor.
const FORBIDDEN = /\b(bank|loan|credit|invest|advis[eo]r|banc|pr[eé]stamo|cr[eé]dito|invers|asesor|banka|banky|[uú]ver|invest[ií]|poradc)/i;

function everyString(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(everyString);
  if (value && typeof value === 'object') return Object.values(value).flatMap(everyString);
  return [];
}

describe('fallback copy', () => {
  const all = (language: string) => [
    financialTipsFallback(language),
    progressTipFallback(language),
    emptyStateCopy(language),
    healthFallbackCopy(language),
    contextualFallbackTips(language, { totalIncome: 0, totalExpenses: 0, transactionCount: 0, budgetCount: 0 }),
    contextualFallbackTips(language, { totalIncome: 100, totalExpenses: 300, transactionCount: 4, budgetCount: 0 }),
    contextualFallbackTips(language, { totalIncome: 500, totalExpenses: 100, transactionCount: 4, budgetCount: 1 }),
    contextualFallbackTips(language, { totalIncome: 0, totalExpenses: 0, transactionCount: 3, budgetCount: 2 }),
  ];

  it.each(LANGUAGES)('has non-empty text in %s', (language) => {
    for (const text of everyString(all(language))) {
      expect(text.trim().length).toBeGreaterThan(3);
    }
  });

  it.each(LANGUAGES)('avoids the words a licensed financial service would use (%s)', (language) => {
    for (const text of everyString(all(language))) {
      expect(text, text).not.toMatch(FORBIDDEN);
    }
  });

  it('really is different text in each language', () => {
    const en = JSON.stringify(all('en-us'));
    expect(JSON.stringify(all('es-pe'))).not.toBe(en);
    expect(JSON.stringify(all('sk-sk'))).not.toBe(en);
    expect(JSON.stringify(all('es-pe'))).not.toBe(JSON.stringify(all('sk-sk')));
  });

  it('reads as the language it is labelled with', () => {
    const description = (language: string) => emptyStateCopy(language).firstTipDescription;
    expect(detectLanguage(description('es-pe'))).toBe('es');
    expect(detectLanguage(description('sk-sk'))).toBe('sk');
    expect(detectLanguage(description('en-us'))).toBe('en');
  });

  it('falls back to English for an unknown language, never to nothing', () => {
    expect(emptyStateCopy('fr-fr')).toEqual(emptyStateCopy('en-us'));
    expect(emptyStateCopy('')).toEqual(emptyStateCopy('en-us'));
  });

  it('keeps the Spanish and Slovak variants together (es-ES, sk)', () => {
    expect(emptyStateCopy('es-ES')).toEqual(emptyStateCopy('es-pe'));
    expect(emptyStateCopy('sk')).toEqual(emptyStateCopy('sk-sk'));
  });
});

describe('contextualFallbackTips', () => {
  const ids = (facts: Parameters<typeof contextualFallbackTips>[1]) =>
    contextualFallbackTips('en-us', facts).map((tip) => tip.id);

  it('asks for a first budget only when there are expenses and no budget', () => {
    expect(ids({ totalIncome: 0, totalExpenses: 50, transactionCount: 2, budgetCount: 0 })).toContain('fallback_budget');
    expect(ids({ totalIncome: 0, totalExpenses: 50, transactionCount: 2, budgetCount: 1 })).not.toContain('fallback_budget');
  });

  it('praises a surplus and warns about a deficit', () => {
    expect(ids({ totalIncome: 500, totalExpenses: 100, transactionCount: 3, budgetCount: 1 })).toEqual(['fallback_savings']);
    expect(ids({ totalIncome: 100, totalExpenses: 500, transactionCount: 3, budgetCount: 1 })).toEqual(['fallback_spending']);
  });

  it('asks to start tracking when there are no transactions', () => {
    expect(ids({ transactionCount: 0 })).toContain('fallback_tracking');
  });

  it('always returns at least one tip, and tolerates missing or junk numbers', () => {
    expect(ids({ totalIncome: 100, totalExpenses: 100, transactionCount: 5, budgetCount: 1 })).toEqual(['fallback_general']);
    expect(ids({ totalIncome: NaN as any, totalExpenses: undefined, transactionCount: 1 }).length).toBeGreaterThan(0);
  });
});
