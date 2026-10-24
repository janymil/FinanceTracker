import { describe, expect, it } from 'vitest';
import {
  detectLanguage,
  financialTipsFallback,
  isTextInLanguage,
  progressTipFallback,
  simpleLanguage,
} from '../../shared/aiFallbacks';

/**
 * The observed production bug: a Slovak tips card titled "Track Your Expenses".
 * These tests pin the two defences — language detection and localised fallbacks.
 */
describe('AI language safety', () => {
  it('normalises every locale the app ships', () => {
    expect(simpleLanguage('sk-sk')).toBe('sk');
    expect(simpleLanguage('es-pe')).toBe('es');
    expect(simpleLanguage('en-us')).toBe('en');
    expect(simpleLanguage(undefined)).toBe('en');
  });

  it('detects the three languages from ordinary sentences', () => {
    expect(detectLanguage('Sledujte svoje výdavky a rozpočet každý mesiac')).toBe('sk');
    expect(detectLanguage('Registra tus gastos y tu presupuesto cada mes')).toBe('es');
    expect(detectLanguage('Track your expenses and your budget each month')).toBe('en');
  });

  it('treats a short or neutral label as acceptable (no false alarms)', () => {
    expect(detectLanguage('Potraviny')).toBeNull();
    expect(isTextInLanguage('Potraviny', 'sk-sk')).toBe(true);
    expect(isTextInLanguage('Lidl', 'es-pe')).toBe(true);
  });

  it('rejects English text for a Slovak audience', () => {
    expect(isTextInLanguage('Track Your Expenses', 'sk-sk')).toBe(false);
    expect(isTextInLanguage('Start by categorizing all your expenses', 'es-pe')).toBe(false);
  });

  it('never returns the English fallback to a Slovak or Spanish screen', () => {
    for (const language of ['sk-sk', 'sk', 'es-pe', 'es']) {
      const tip = financialTipsFallback(language);
      expect(isTextInLanguage(`${tip.title} ${tip.description}`, language)).toBe(true);
      const progress = progressTipFallback(language);
      expect(isTextInLanguage(`${progress.title} ${progress.description}`, language)).toBe(true);
    }
  });

  it('keeps the fallback text actually translated', () => {
    expect(financialTipsFallback('sk-sk').title).not.toBe(financialTipsFallback('en-us').title);
    expect(financialTipsFallback('es-pe').title).not.toBe(financialTipsFallback('en-us').title);
    expect(progressTipFallback('sk-sk').description).not.toBe(progressTipFallback('en-us').description);
  });
});
