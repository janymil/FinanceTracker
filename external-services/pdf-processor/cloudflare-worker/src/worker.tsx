import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import QRCode from 'qrcode';
import { FinancialReportDocument } from './reportDocument';

export interface Env {
  APP_URL?: string;
  AUTH_SECRET?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // Health check endpoint
    if (request.method === 'GET' && (url.pathname === '/health' || url.pathname === '/')) {
      return new Response(
        JSON.stringify({
          status: 'healthy',
          engine: '@react-pdf/renderer on Cloudflare Workers',
          timestamp: new Date().toISOString(),
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // PDF generation endpoint
    if (request.method === 'POST' && url.pathname === '/generate-pdf') {
      try {
        const body = (await request.json()) as any;
        const {
          userData,
          transactions = [],
          categories = [],
          budgets = [],
          goals = [],
          insights = [],
          language = 'en-us',
          period = 'Monthly',
          currency = '$',
        } = body;

        // Generate QR code (pure JS)
        const appUrl = env.APP_URL || 'https://kaptia.app';
        let qrCodeDataUrl: string | undefined;
        try {
          qrCodeDataUrl = await QRCode.toDataURL(appUrl, {
            margin: 1,
            width: 120,
            color: { dark: '#1E293B', light: '#FFFFFF' },
          });
        } catch (e) {
          console.warn('QR code generation failed, continuing without it');
        }

        // Render PDF
        const doc = React.createElement(FinancialReportDocument, {
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
        });

        const pdfBuffer = await renderToBuffer(doc);

        return new Response(pdfBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename=financial-report.pdf',
            'Access-Control-Allow-Origin': '*',
          },
        });
      } catch (err) {
        console.error('Error generating PDF:', err);
        return new Response(
          JSON.stringify({
            error: 'PDF generation failed',
            details: err instanceof Error ? err.message : String(err),
          }),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }
        );
      }
    }

    return new Response('Not Found', { status: 404 });
  },
};

