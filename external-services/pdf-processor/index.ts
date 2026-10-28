import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { timingSafeEqual } from 'node:crypto';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import QRCode from 'qrcode';
import { FinancialReportDocument } from './reportDocument.js';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '8082', 10);
const HOST = process.env.HOST || '0.0.0.0';
const APP_URL = process.env.APP_URL || 'https://kaptia.app';

/**
 * Allowed API keys (`PDF_API_KEY`, comma-separated to allow several consumers).
 * When the variable is empty the endpoint stays open, which is only meant for
 * local development.
 */
const API_KEYS = (process.env.PDF_API_KEY || '')
  .split(',')
  .map((key) => key.trim())
  .filter(Boolean);

app.disable('x-powered-by');
app.set('trust proxy', true);
app.use(cors());
app.use(express.json({ limit: '50mb' }));

function keysMatch(candidate: string, expected: string): boolean {
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function requireApiKey(req: Request, res: Response, next: NextFunction) {
  if (API_KEYS.length === 0) return next();

  const headerKey = (req.headers['x-api-key'] as string | undefined) || (req.headers['x-api-token'] as string | undefined);
  const bearer = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice('Bearer '.length).trim()
    : undefined;
  const provided = headerKey || bearer;

  if (!provided || !API_KEYS.some((key) => keysMatch(provided, key))) {
    return res.status(401).json({
      error: 'Unauthorized: invalid or missing API key. Provide it via the x-api-key header or Authorization: Bearer <key>.',
    });
  }

  return next();
}

app.get('/', (_req, res) => {
  res.json({
    service: 'kaptia-pdf-processor',
    version: '1.0.0',
    engine: '@react-pdf/renderer',
    authRequired: API_KEYS.length > 0,
    endpoints: ['GET /health', 'POST /generate-pdf'],
  });
});

app.post('/generate-pdf', requireApiKey, async (req, res) => {
  const startedAt = Date.now();
  try {
    const {
      userData,
      transactions = [],
      categories = [],
      budgets = [],
      goals = [],
      insights = [],
      language = 'en-us',
      period = '',
      currency = '$',
      totals,
      monthly = [],
      range,
      metrics,
    } = req.body;

    // Generate QR code as Base64 Data URL (pure JS, zero native dependencies)
    let qrCodeDataUrl: string | undefined;
    try {
      qrCodeDataUrl = await QRCode.toDataURL(APP_URL, {
        margin: 1,
        width: 120,
        color: {
          dark: '#1E293B',
          light: '#FFFFFF',
        },
      });
    } catch (qrErr) {
      console.warn('Failed to generate QR code, continuing without it:', qrErr);
    }

    // Render PDF buffer using @react-pdf/renderer (pure vector rendering in memory)
    const documentElement = React.createElement(FinancialReportDocument, {
      userData,
      transactions,
      categories,
      budgets,
      goals,
      insights,
      qrCodeDataUrl,
      language,
      period,
      currency,
      totals,
      monthly,
      range,
      metrics,
    });

    const pdfBuffer = await renderToBuffer(documentElement);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=financial-report.pdf');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);

    console.log(
      `[pdf] report generated in ${Date.now() - startedAt}ms ` +
        `(${pdfBuffer.length} bytes, ${transactions.length} transactions, ${categories.length} categories)`
    );
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({
      error: 'PDF generation failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'kaptia-pdf-processor',
    engine: '@react-pdf/renderer',
    authRequired: API_KEYS.length > 0,
    timestamp: new Date().toISOString(),
  });
});

// Graceful error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

const server = app.listen(PORT, HOST, () => {
  console.log(`PDF processor (@react-pdf/renderer) listening on http://${HOST}:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(
    API_KEYS.length > 0
      ? `API key auth: enabled (${API_KEYS.length} key${API_KEYS.length === 1 ? '' : 's'})`
      : 'API key auth: DISABLED (set PDF_API_KEY to protect /generate-pdf)'
  );
});

server.on('error', (error) => {
  console.error('Server error:', error);
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => process.exit(0));
});
