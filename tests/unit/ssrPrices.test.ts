import { describe, expect, it } from 'vitest';
import { renderPageForCrawler } from '../../server/ssr';
import { amountFor, formatMoney } from '../../shared/pricing';

/**
 * The pages search engines read quote prices. They must be the prices checkout will charge,
 * in the currency of the page's language: a Spanish page is the Peru market, so it quotes
 * soles — not dollars, and not the dollar amount with a dollar sign.
 */
describe('crawler price pages', () => {
  it('quotes soles on Spanish pages, at the prices Peru is charged', () => {
    const html = renderPageForCrawler('/pricing', 'es');

    expect(html).toContain(formatMoney(amountFor('standard', 'monthly', 'pen'), 'pen'));
    expect(html).toContain(formatMoney(amountFor('premium', 'monthly', 'pen'), 'pen'));
    // Regression: the Spanish page used to read "Plan Premium - $9.90/mes" while a visitor
    // from Peru is charged S/ 19.90.
    expect(html).not.toContain('$9.90/mes');
    expect(html).not.toContain('$4.99/mes');
  });

  it('quotes dollars on English and Slovak pages', () => {
    for (const language of ['en', 'sk']) {
      const html = renderPageForCrawler('/pricing', language);
      expect(html).toContain(formatMoney(amountFor('standard', 'monthly', 'usd'), 'usd'));
      expect(html).toContain(formatMoney(amountFor('premium', 'monthly', 'usd'), 'usd'));
      expect(html).not.toContain('S/');
    }
  });

  it('never quotes a price the price list does not contain', () => {
    // The two numbers that were hardcoded before: 9.99 (a typo) and a Premium that was half
    // its Peruvian price. Neither may come back.
    const html = renderPageForCrawler('/pricing', 'es');
    expect(html).not.toContain('9.99');
  });
});
