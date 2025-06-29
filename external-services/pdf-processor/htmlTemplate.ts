export interface PDFData {
  userData: {
    firstName: string;
    lastName: string;
    email: string;
  };
  trendChart: string;
  categoryChart: string;
  qrCodeDataUrl: string;
  insights: any;
  transactions: any[];
  budgets: any[];
  goals: any[];
  language: string;
  period: string;
}

export function generateHTMLTemplate(data: PDFData): string {
  const {
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
  } = data;

  const currentDate = new Date().toLocaleDateString();
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const netBalance = totalIncome - totalExpenses;

  return `
    <!DOCTYPE html>
    <html lang="${language}">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Financial Report - ${userData.firstName} ${userData.lastName}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          background: #fff;
        }
        
        .container {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }
        
        .header {
          text-align: center;
          margin-bottom: 40px;
          border-bottom: 3px solid #8B5CF6;
          padding-bottom: 20px;
        }
        
        .logo {
          font-size: 2.5em;
          font-weight: bold;
          color: #8B5CF6;
          margin-bottom: 10px;
        }
        
        .report-title {
          font-size: 1.8em;
          color: #333;
          margin-bottom: 10px;
        }
        
        .report-info {
          color: #666;
          font-size: 1.1em;
        }
        
        .section {
          margin-bottom: 40px;
          break-inside: avoid;
        }
        
        .section-title {
          font-size: 1.5em;
          color: #8B5CF6;
          margin-bottom: 20px;
          border-left: 4px solid #8B5CF6;
          padding-left: 15px;
        }
        
        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          margin-bottom: 30px;
        }
        
        .metric-card {
          background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
          padding: 20px;
          border-radius: 12px;
          text-align: center;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .metric-label {
          font-size: 0.9em;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 8px;
        }
        
        .metric-value {
          font-size: 1.8em;
          font-weight: bold;
          color: #333;
        }
        
        .metric-value.positive {
          color: #10B981;
        }
        
        .metric-value.negative {
          color: #EF4444;
        }
        
        .chart-container {
          text-align: center;
          margin: 30px 0;
          background: #fff;
          padding: 20px;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .chart-image {
          max-width: 100%;
          height: auto;
          border-radius: 8px;
        }
        
        .insights-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
          margin-bottom: 30px;
        }
        
        .insight-card {
          background: #f8fafc;
          padding: 20px;
          border-radius: 12px;
          border-left: 4px solid #8B5CF6;
        }
        
        .insight-title {
          font-weight: bold;
          color: #333;
          margin-bottom: 10px;
          font-size: 1.1em;
        }
        
        .insight-text {
          color: #666;
          line-height: 1.5;
        }
        
        .transaction-list {
          background: #fff;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .transaction-header {
          background: linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%);
          color: white;
          padding: 15px 20px;
          font-weight: bold;
        }
        
        .transaction-item {
          padding: 15px 20px;
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .transaction-item:last-child {
          border-bottom: none;
        }
        
        .transaction-details {
          flex: 1;
        }
        
        .transaction-description {
          font-weight: 500;
          color: #333;
          margin-bottom: 4px;
        }
        
        .transaction-category {
          font-size: 0.9em;
          color: #666;
        }
        
        .transaction-amount {
          font-weight: bold;
          font-size: 1.1em;
        }
        
        .transaction-amount.income {
          color: #10B981;
        }
        
        .transaction-amount.expense {
          color: #EF4444;
        }
        
        .footer {
          margin-top: 60px;
          padding-top: 20px;
          border-top: 2px solid #e5e7eb;
          text-align: center;
        }
        
        .qr-section {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 20px;
          margin-bottom: 20px;
        }
        
        .qr-code {
          width: 100px;
          height: 100px;
        }
        
        .qr-text {
          color: #666;
          line-height: 1.5;
        }
        
        .generated-info {
          color: #999;
          font-size: 0.9em;
        }
        
        @page {
          size: A4;
          margin: 20mm;
        }
        
        @media print {
          .section {
            break-inside: avoid;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <!-- Header -->
        <div class="header">
          <div class="logo">FinanzerPro</div>
          <div class="report-title">Financial Report</div>
          <div class="report-info">
            ${userData.firstName} ${userData.lastName} • ${currentDate} • ${period}
          </div>
        </div>

        <!-- Executive Summary -->
        <div class="section">
          <h2 class="section-title">Executive Summary</h2>
          <div class="metrics-grid">
            <div class="metric-card">
              <div class="metric-label">Total Income</div>
              <div class="metric-value positive">$${totalIncome.toFixed(2)}</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Total Expenses</div>
              <div class="metric-value negative">$${totalExpenses.toFixed(2)}</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Net Balance</div>
              <div class="metric-value ${netBalance >= 0 ? 'positive' : 'negative'}">$${netBalance.toFixed(2)}</div>
            </div>
          </div>
        </div>

        <!-- Financial Trends -->
        <div class="section">
          <h2 class="section-title">Financial Trends</h2>
          <div class="chart-container">
            <img src="${trendChart}" alt="Financial Trends Chart" class="chart-image">
          </div>
        </div>

        <!-- Category Analysis -->
        <div class="section">
          <h2 class="section-title">Spending Analysis</h2>
          <div class="chart-container">
            <img src="${categoryChart}" alt="Category Spending Chart" class="chart-image">
          </div>
        </div>

        <!-- AI Insights -->
        ${insights ? `
        <div class="section">
          <h2 class="section-title">AI Financial Insights</h2>
          <div class="insights-grid">
            ${insights.insights ? insights.insights.slice(0, 4).map((insight: string) => `
              <div class="insight-card">
                <div class="insight-title">Key Insight</div>
                <div class="insight-text">${insight}</div>
              </div>
            `).join('') : ''}
            
            ${insights.recommendations ? insights.recommendations.slice(0, 2).map((rec: string) => `
              <div class="insight-card">
                <div class="insight-title">Recommendation</div>
                <div class="insight-text">${rec}</div>
              </div>
            `).join('') : ''}
          </div>
        </div>
        ` : ''}

        <!-- Recent Transactions -->
        <div class="section">
          <h2 class="section-title">Recent Transactions</h2>
          <div class="transaction-list">
            <div class="transaction-header">Latest Financial Activity</div>
            ${transactions.slice(0, 10).map(transaction => `
              <div class="transaction-item">
                <div class="transaction-details">
                  <div class="transaction-description">${transaction.description || 'Transaction'}</div>
                  <div class="transaction-category">${transaction.categoryName || 'Uncategorized'}</div>
                </div>
                <div class="transaction-amount ${transaction.type}">
                  ${transaction.type === 'income' ? '+' : '-'}$${Math.abs(parseFloat(transaction.amount)).toFixed(2)}
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Footer -->
        <div class="footer">
          <div class="qr-section">
            <img src="${qrCodeDataUrl}" alt="QR Code" class="qr-code">
            <div class="qr-text">
              Scan to access your interactive<br>
              dashboard on FinanzerPro
            </div>
          </div>
          <div class="generated-info">
            Report generated on ${currentDate} by FinanzerPro AI Analytics
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}