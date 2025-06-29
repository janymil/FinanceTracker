import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import { generateChart } from './chartGenerator';
import { generateHTMLTemplate } from './htmlTemplate';
import QRCode from 'qrcode';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.post('/generate-pdf', async (req, res) => {
  try {
    const {
      userData,
      transactions,
      categories,
      budgets,
      goals,
      insights,
      language = 'en-us',
      period = '6-months'
    } = req.body;

    // Generate charts
    const trendChart = await generateChart({
      type: 'line',
      data: {
        labels: transactions.map((t: any) => t.month),
        datasets: [{
          label: 'Balance Trend',
          data: transactions.map((t: any) => t.balance),
          borderColor: '#8B5CF6',
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          fill: true
        }]
      },
      title: 'Financial Trends'
    });

    const categoryChart = await generateChart({
      type: 'doughnut',
      data: {
        labels: categories.map((c: any) => c.name),
        datasets: [{
          data: categories.map((c: any) => c.amount),
          backgroundColor: [
            '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444'
          ]
        }]
      },
      title: 'Spending by Category'
    });

    // Generate QR code
    const appUrl = process.env.APP_URL || 'https://finanzerpro.com';
    const qrCodeDataUrl = await QRCode.toDataURL(appUrl);

    // Generate HTML
    const htmlContent = generateHTMLTemplate({
      userData,
      trendChart,
      categoryChart,
      qrCodeDataUrl,
      insights,
      transactions,
      budgets,
      goals,
      language,
      period
    });

    // Generate PDF with robust Chrome configuration for containers
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ]
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      }
    });

    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=financial-report.pdf');
    res.send(pdfBuffer);

  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ 
      error: 'PDF generation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Graceful error handling for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start server with error handling
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`PDF processor running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Chrome path: ${process.env.PUPPETEER_EXECUTABLE_PATH}`);
});

server.on('error', (error) => {
  console.error('Server error:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});