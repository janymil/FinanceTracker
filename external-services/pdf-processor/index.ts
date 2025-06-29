import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import puppeteer from 'puppeteer';
import { generateTrendsChart, generateCategoryChart, TrendsChartData, CategoryData } from './chartGenerator';
import { generateHTMLTemplate, PDFData } from './htmlTemplate';

dotenv.config();

const app = express();
const port = parseInt(process.env.PORT || '8080', 10);

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'PDF Processor',
    timestamp: new Date().toISOString()
  });
});

// PDF generation endpoint
app.post('/generate-pdf', async (req, res) => {
  let browser: any = null;
  
  try {
    console.log('Starting PDF generation...');
    
    // Validate required data
    const { data } = req.body;
    if (!data) {
      return res.status(400).json({ error: 'Missing PDF data' });
    }

    const pdfData: PDFData = {
      user: data.user || { name: 'Unknown User', email: '' },
      period: data.period || 'Current Period',
      language: data.language || 'en-us',
      totalIncome: data.totalIncome || 0,
      totalExpenses: data.totalExpenses || 0,
      netBalance: data.netBalance || 0,
      currency: data.currency || '$',
      trends: data.trends || [],
      categories: data.categories || [],
      aiInsights: data.aiInsights,
      forecasts: data.forecasts,
      webUrl: data.webUrl || '',
      generatedAt: new Date()
    };

    console.log('Generating charts...');
    
    // Generate chart images
    let trendsChartBuffer: Buffer | null = null;
    let categoryChartBuffer: Buffer | null = null;

    // Generate trends chart if data exists
    if (pdfData.trends.length > 0) {
      try {
        trendsChartBuffer = await generateTrendsChart(
          pdfData.trends as TrendsChartData[], 
          pdfData.currency, 
          pdfData.language
        );
        console.log('Trends chart generated successfully');
      } catch (chartError) {
        console.error('Trends chart generation failed:', chartError);
      }
    }

    // Generate category chart if data exists
    if (pdfData.categories.length > 0) {
      try {
        categoryChartBuffer = await generateCategoryChart(
          pdfData.categories as CategoryData[], 
          pdfData.currency, 
          pdfData.language
        );
        console.log('Category chart generated successfully');
      } catch (chartError) {
        console.error('Category chart generation failed:', chartError);
      }
    }

    console.log('Generating HTML template...');
    
    // Generate HTML template
    let htmlContent = await generateHTMLTemplate(pdfData);

    // Embed chart images as data URLs
    if (trendsChartBuffer) {
      const trendsDataUrl = `data:image/png;base64,${trendsChartBuffer.toString('base64')}`;
      htmlContent = htmlContent.replace(
        '<div id="trends-chart-placeholder" style="height: 300px; background: #f3f4f6; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #6b7280;">[Trends Chart Will Be Inserted Here]</div>',
        `<img src="${trendsDataUrl}" alt="Financial Trends Chart" class="chart-image" style="max-width: 100%; height: auto;">`
      );
    }

    if (categoryChartBuffer) {
      const categoryDataUrl = `data:image/png;base64,${categoryChartBuffer.toString('base64')}`;
      htmlContent = htmlContent.replace(
        '<div id="category-chart-placeholder" style="height: 250px; background: #f3f4f6; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #6b7280;">[Category Chart Will Be Inserted Here]</div>',
        `<img src="${categoryDataUrl}" alt="Category Breakdown Chart" class="chart-image" style="max-width: 100%; height: auto;">`
      );
    }

    console.log('Launching Puppeteer...');

    // Launch Puppeteer
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    
    // Set viewport for consistent rendering
    await page.setViewport({ width: 1200, height: 800 });

    console.log('Converting HTML to PDF...');

    // Load HTML content
    await page.setContent(htmlContent, { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      },
      displayHeaderFooter: false,
      preferCSSPageSize: true
    });

    await browser.close();
    browser = null;

    console.log('PDF generated successfully');

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="financial-report-${Date.now()}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    // Send PDF
    res.send(pdfBuffer);

  } catch (error) {
    console.error('PDF generation error:', error);
    
    // Clean up browser if still open
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('Browser cleanup error:', closeError);
      }
    }
    
    res.status(500).json({ 
      error: 'PDF generation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`PDF Processor running on port ${port}`);
});