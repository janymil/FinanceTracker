import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import { Chart, registerables } from 'chart.js';
import puppeteer from 'puppeteer';
import QRCode from 'qrcode';

Chart.register(...registerables);

const width = 800;
const height = 400;

interface ChartData {
  type: 'line' | 'bar' | 'doughnut';
  data: {
    labels: string[];
    datasets: Array<{
      label?: string;
      data: number[];
      borderColor?: string;
      backgroundColor?: string | string[];
      fill?: boolean;
      tension?: number;
    }>;
  };
  title: string;
}

async function generateChart(chartData: ChartData): Promise<string> {
  const chartJSNodeCanvas = new ChartJSNodeCanvas({ 
    width, 
    height,
    backgroundColour: 'white'
  });

  const configuration = {
    type: chartData.type,
    data: chartData.data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: chartData.title,
          font: {
            size: 18,
            weight: 'bold' as const
          }
        },
        legend: {
          display: true,
          position: 'bottom' as const
        }
      },
      scales: chartData.type === 'line' || chartData.type === 'bar' ? {
        y: { beginAtZero: true },
        x: {}
      } : undefined
    }
  };

  const imageBuffer = await chartJSNodeCanvas.renderToBuffer(configuration);
  return `data:image/png;base64,${imageBuffer.toString('base64')}`;
}

function generateHTMLTemplate(data: any): string {
  const { userData, trendChart, categoryChart, qrCodeDataUrl, insights, transactions } = data;
  const currentDate = new Date().toLocaleDateString();

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Financial Report</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { font-size: 24px; font-weight: bold; color: #8B5CF6; }
        .section { margin-bottom: 30px; page-break-inside: avoid; }
        .chart { text-align: center; margin: 20px 0; }
        .chart img { max-width: 100%; height: auto; }
        .metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 20px 0; }
        .metric { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; }
        .metric-value { font-size: 24px; font-weight: bold; color: #333; }
        .metric-label { font-size: 12px; color: #666; text-transform: uppercase; }
        .transaction { padding: 10px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; }
        .qr-section { text-align: center; margin-top: 40px; }
        .qr-code { width: 80px; height: 80px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">FinanzerPro</div>
        <h1>Financial Report</h1>
        <p>${userData.firstName} ${userData.lastName} • ${currentDate}</p>
      </div>

      <div class="section">
        <h2>Financial Overview</h2>
        <div class="chart">
          <img src="${trendChart}" alt="Financial Trends">
        </div>
      </div>

      <div class="section">
        <h2>Category Analysis</h2>
        <div class="chart">
          <img src="${categoryChart}" alt="Category Breakdown">
        </div>
      </div>

      <div class="section">
        <h2>Recent Transactions</h2>
        ${transactions.slice(0, 10).map(t => `
          <div class="transaction">
            <div>${t.description || 'Transaction'}</div>
            <div>${t.type === 'income' ? '+' : '-'}$${Math.abs(parseFloat(t.amount)).toFixed(2)}</div>
          </div>
        `).join('')}
      </div>

      <div class="qr-section">
        <img src="${qrCodeDataUrl}" alt="QR Code" class="qr-code">
        <p>Scan to access your dashboard</p>
      </div>
    </body>
    </html>
  `;
}

export async function generatePDF(data: any): Promise<Buffer> {
  // Generate charts
  const trendChart = await generateChart({
    type: 'line',
    data: {
      labels: data.chartData.labels,
      datasets: [{
        label: 'Balance',
        data: data.chartData.values,
        borderColor: '#8B5CF6',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        fill: true,
        tension: 0.4
      }]
    },
    title: 'Financial Trends'
  });

  const categoryChart = await generateChart({
    type: 'doughnut',
    data: {
      labels: data.categoryData.map((c: any) => c.name),
      datasets: [{
        data: data.categoryData.map((c: any) => c.amount),
        backgroundColor: ['#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444']
      }]
    },
    title: 'Spending by Category'
  });

  // Generate QR code
  const qrCodeDataUrl = await QRCode.toDataURL(data.dashboardUrl);

  // Generate HTML
  const html = generateHTMLTemplate({
    ...data,
    trendChart,
    categoryChart,
    qrCodeDataUrl
  });

  // Generate PDF with Puppeteer
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  
  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: {
      top: '20mm',
      right: '20mm',
      bottom: '20mm',
      left: '20mm'
    }
  });

  await browser.close();
  return pdfBuffer;
}