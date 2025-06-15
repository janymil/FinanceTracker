import puppeteer from 'puppeteer';
import { PDF_TEMPLATE, BUDGETS_SECTION_TEMPLATE, GOALS_SECTION_TEMPLATE } from './pdfTemplate.js';

interface PDFData {
  transactions: Array<{
    id: number;
    amount: string;
    description: string;
    date: string;
    type: 'income' | 'expense';
    categoryId: string | null;
  }>;
  budgets?: Array<{
    id: number;
    name: string;
    amount: string;
    spent: string;
    categoryId: number;
    period: string;
  }>;
  goals?: Array<{
    id: number;
    name: string;
    targetAmount: string;
    currentAmount: string;
    targetDate: string;
  }>;
  summary: {
    totalIncome: number;
    totalExpenses: number;
    netAmount: number;
    transactionCount: number;
    categoryBreakdown: { [key: string]: number };
    month: string;
    year: number;
  };
  userName?: string;
}

export async function generatePdfReport(data: PDFData) {
  const { transactions, budgets, goals, summary, userName } = data;
  
  // Process category data for Google Charts
  const categoryBreakdown: { [key: string]: number } = {};
  transactions.forEach(t => {
    if (t.type === 'expense') {
      const category = t.categoryId || 'Other';
      categoryBreakdown[category] = (categoryBreakdown[category] || 0) + parseFloat(t.amount);
    }
  });

  // Prepare data for Google Charts
  const categoryChartData = Object.entries(categoryBreakdown)
    .map(([category, amount]) => `['${category}', ${amount}]`)
    .join(',\n          ');

  const incomeExpenseData = `
          ['Income', ${summary.totalIncome}],
          ['Expenses', ${summary.totalExpenses}]`;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>FinanzerPro Financial Report</title>
      <script type="text/javascript" src="https://www.gstatic.com/charts/loader.js"></script>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          background: #fff;
        }
        .header {
          text-align: center;
          margin-bottom: 40px;
          border-bottom: 3px solid #4F46E5;
          padding-bottom: 20px;
        }
        .header h1 {
          color: #4F46E5;
          font-size: 2.5rem;
          margin: 0;
          font-weight: 700;
        }
        .header p {
          color: #666;
          font-size: 1.1rem;
          margin: 10px 0 0 0;
        }
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 20px;
          margin: 30px 0;
        }
        .summary-card {
          background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
          padding: 20px;
          border-radius: 12px;
          text-align: center;
          border: 1px solid #e2e8f0;
        }
        .summary-card h3 {
          margin: 0 0 10px 0;
          color: #64748b;
          font-size: 0.9rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .summary-card .amount {
          font-size: 1.6rem;
          font-weight: 700;
          margin: 0;
        }
        .income { color: #10b981; }
        .expense { color: #ef4444; }
        .net { color: #6366f1; }
        .chart-container {
          margin: 40px 0;
          text-align: center;
          page-break-inside: avoid;
        }
        .chart-container h2 {
          color: #374151;
          margin-bottom: 20px;
          font-size: 1.5rem;
        }
        .chart-div {
          width: 100%;
          height: 350px;
          margin: 20px 0;
        }
        .transactions-section {
          margin: 40px 0;
          page-break-inside: avoid;
        }
        .transactions-section h2 {
          color: #374151;
          border-bottom: 2px solid #e5e7eb;
          padding-bottom: 10px;
          font-size: 1.5rem;
        }
        .transaction-table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
        }
        .transaction-table th {
          background: #f8fafc;
          padding: 10px;
          text-align: left;
          font-weight: 600;
          color: #374151;
          border-bottom: 1px solid #e5e7eb;
          font-size: 0.9rem;
        }
        .transaction-table td {
          padding: 10px;
          border-bottom: 1px solid #f1f5f9;
          font-size: 0.85rem;
        }
        .transaction-table tr:last-child td {
          border-bottom: none;
        }
        .transaction-table .amount-income {
          color: #10b981;
          font-weight: 600;
        }
        .transaction-table .amount-expense {
          color: #ef4444;
          font-weight: 600;
        }
        .footer {
          margin-top: 50px;
          text-align: center;
          font-size: 0.85rem;
          color: #9ca3af;
          border-top: 1px solid #e5e7eb;
          padding-top: 20px;
        }
        @media print {
          body { margin: 0; padding: 15px; }
          .chart-div { height: 300px; }
        }
      </style>
      <script>
        google.charts.load('current', {'packages':['corechart']});
        google.charts.setOnLoadCallback(drawCharts);

        function drawCharts() {
          // Income vs Expenses Chart
          var incomeExpenseData = google.visualization.arrayToDataTable([
            ['Type', 'Amount'],
            ${incomeExpenseData}
          ]);

          var incomeExpenseOptions = {
            title: 'Income vs Expenses',
            titleTextStyle: { fontSize: 16, color: '#374151' },
            pieHole: 0.4,
            colors: ['#10b981', '#ef4444'],
            backgroundColor: 'transparent',
            legend: { position: 'bottom', textStyle: { fontSize: 11 } },
            chartArea: { width: '85%', height: '75%' }
          };

          var incomeExpenseChart = new google.visualization.PieChart(document.getElementById('income_expense_chart'));
          incomeExpenseChart.draw(incomeExpenseData, incomeExpenseOptions);

          // Category Breakdown Chart
          ${categoryChartData ? `
          var categoryData = google.visualization.arrayToDataTable([
            ['Category', 'Amount'],
            ${categoryChartData}
          ]);

          var categoryOptions = {
            title: 'Expenses by Category',
            titleTextStyle: { fontSize: 16, color: '#374151' },
            pieHole: 0.4,
            backgroundColor: 'transparent',
            legend: { position: 'bottom', textStyle: { fontSize: 11 } },
            chartArea: { width: '85%', height: '75%' },
            colors: ['#4F46E5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316']
          };

          var categoryChart = new google.visualization.PieChart(document.getElementById('category_chart'));
          categoryChart.draw(categoryData, categoryOptions);
          ` : `
          document.getElementById('category_chart').innerHTML = '<p style="text-align:center;color:#666;padding:40px;">No expense categories to display</p>';
          `}
        }
      </script>
    </head>
    <body>
      <div class="header">
        <h1>FinanzerPro</h1>
        <p>Financial Report • ${summary.month}/${summary.year}</p>
        ${userName ? `<p>Generated for: ${userName}</p>` : ''}
      </div>

      <div class="summary-grid">
        <div class="summary-card">
          <h3>Total Income</h3>
          <p class="amount income">$${summary.totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
        </div>
        <div class="summary-card">
          <h3>Total Expenses</h3>
          <p class="amount expense">$${summary.totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
        </div>
        <div class="summary-card">
          <h3>Net Amount</h3>
          <p class="amount net">$${summary.netAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
        </div>
        <div class="summary-card">
          <h3>Transactions</h3>
          <p class="amount">${summary.transactionCount}</p>
        </div>
      </div>

      <div class="chart-container">
        <h2>Income vs Expenses</h2>
        <div id="income_expense_chart" class="chart-div"></div>
      </div>

      <div class="chart-container">
        <h2>Expenses by Category</h2>
        <div id="category_chart" class="chart-div"></div>
      </div>

      <div class="transactions-section">
        <h2>Recent Transactions</h2>
        <table class="transaction-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Category</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            ${transactions.slice(0, 25).map(t => `
              <tr>
                <td>${new Date(t.date).toLocaleDateString()}</td>
                <td>${t.description.length > 30 ? t.description.substring(0, 30) + '...' : t.description}</td>
                <td>${t.categoryId || 'Other'}</td>
                <td class="amount-${t.type}">
                  ${t.type === 'income' ? '+' : '-'}$${parseFloat(t.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      ${budgets && budgets.length > 0 ? `
      <div class="transactions-section">
        <h2>Budget Status</h2>
        <table class="transaction-table">
          <thead>
            <tr>
              <th>Budget</th>
              <th>Allocated</th>
              <th>Spent</th>
              <th>Remaining</th>
            </tr>
          </thead>
          <tbody>
            ${budgets.map(b => {
              const remaining = parseFloat(b.amount) - parseFloat(b.spent);
              return `
                <tr>
                  <td>${b.name}</td>
                  <td>$${parseFloat(b.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td class="amount-expense">$${parseFloat(b.spent).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td class="${remaining >= 0 ? 'amount-income' : 'amount-expense'}">
                    $${remaining.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      ` : ''}

      ${goals && goals.length > 0 ? `
      <div class="transactions-section">
        <h2>Financial Goals</h2>
        <table class="transaction-table">
          <thead>
            <tr>
              <th>Goal</th>
              <th>Target</th>
              <th>Current</th>
              <th>Progress</th>
              <th>Target Date</th>
            </tr>
          </thead>
          <tbody>
            ${goals.map(g => {
              const progress = (parseFloat(g.currentAmount) / parseFloat(g.targetAmount)) * 100;
              return `
                <tr>
                  <td>${g.name}</td>
                  <td>$${parseFloat(g.targetAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td>$${parseFloat(g.currentAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td>${progress.toFixed(1)}%</td>
                  <td>${new Date(g.targetDate).toLocaleDateString()}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      ` : ''}

      <div class="footer">
        <p>Generated by FinanzerPro on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
        <p>This report contains confidential financial information</p>
      </div>
    </body>
    </html>
  `;

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  
  // Wait for charts to load
  await page.waitForTimeout(3000);

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
  return pdfBuffer;
}