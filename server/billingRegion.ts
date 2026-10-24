import type { Express, Request } from 'express';
import { regionForCountry, type BillingRegion } from '../shared/billingRegion';

/**
 * Country the request comes from, as reported by Cloudflare. Only that header is read:
 * the origin accepts Cloudflare traffic only (ops/cloudflare-origin-firewall), so a visitor
 * cannot set it, whereas any other country header could be typed by the caller.
 */
function countryFromRequest(req: Request): string | undefined {
  const header = req.headers['cf-ipcountry'];
  return Array.isArray(header) ? header[0] : header;
}

export function regionForRequest(req: Request): BillingRegion {
  const language = req.header('x-user-language') || String(req.query.lang ?? '');
  return regionForCountry(countryFromRequest(req), language);
}

export function registerBillingRegionRoute(app: Express) {
  /** Tells the pricing and checkout pages which gateway and currency to show. */
  app.get('/api/billing-region', (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.json(regionForRequest(req));
  });
}
