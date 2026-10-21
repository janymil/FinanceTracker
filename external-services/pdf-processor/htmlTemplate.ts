export interface TemplateData {
  userData: {
    firstName: string;
    lastName: string;
    email: string;
  };
  trendChart: string;
  categoryChart: string;
  qrCodeDataUrl: string;
  insights: any[];
  transactions: any[];
  budgets: any[];
  goals: any[];
  language: string;
  period: string;
}

export function generateHTMLTemplate(data: TemplateData): string {
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

  return `
    <!DOCTYPE html>
    <html lang="${language}">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Financial Report</title>
      <style>
        body {
          font-family: 'Arial', sans-serif;
          margin: 0;
          padding: 20px;
          background: #f8f9fa;
          color: #2d3748;
          line-height: 1.6;
        }
        
        .container {
          max-width: 800px;
          margin: 0 auto;
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 40px 30px;
          text-align: center;
        }
        
        .header h1 {
          margin: 0 0 10px 0;
          font-size: 2.5em;
          font-weight: 300;
        }
        
        .header p {
          margin: 0;
          opacity: 0.9;
          font-size: 1.1em;
        }
        
        .content {
          padding: 40px 30px;
        }
        
        .section {
          margin-bottom: 40px;
        }
        
        .section h2 {
          color: #4a5568;
          border-bottom: 2px solid #e2e8f0;
          padding-bottom: 10px;
          margin-bottom: 25px;
          font-size: 1.8em;
          font-weight: 600;
        }
        
        .user-info {
          background: #f7fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 25px;
          margin-bottom: 30px;
        }
        
        .user-info h3 {
          margin: 0 0 15px 0;
          color: #2d3748;
          font-size: 1.3em;
        }
        
        .user-info p {
          margin: 8px 0;
          color: #4a5568;
        }
        
        .chart-container {
          text-align: center;
          margin: 30px 0;
          padding: 20px;
          background: #f7fafc;
          border-radius: 8px;
        }
        
        .chart-container img {
          max-width: 100%;
          height: auto;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        
        .insights-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 20px;
          margin: 25px 0;
        }
        
        .insight-card {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }
        
        .insight-card h4 {
          margin: 0 0 10px 0;
          color: #2d3748;
          font-size: 1.1em;
        }
        
        .insight-card p {
          margin: 0;
          color: #4a5568;
          font-size: 0.95em;
        }
        
        .transactions-table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }
        
        .transactions-table th {
          background: #4a5568;
          color: white;
          padding: 15px 12px;
          text-align: left;
          font-weight: 600;
        }
        
        .transactions-table td {
          padding: 12px;
          border-bottom: 1px solid #e2e8f0;
        }
        
        .transactions-table tr:last-child td {
          border-bottom: none;
        }
        
        .transactions-table tr:nth-child(even) {
          background: #f7fafc;
        }
        
        .amount-positive {
          color: #38a169;
          font-weight: 600;
        }
        
        .amount-negative {
          color: #e53e3e;
          font-weight: 600;
        }
        
        .qr-section {
          text-align: center;
          padding: 30px;
          background: #f7fafc;
          border-radius: 8px;
          margin: 30px 0;
        }
        
        .qr-section img {
          margin: 15px 0;
          border-radius: 8px;
        }
        
        .footer {
          background: #2d3748;
          color: white;
          padding: 30px;
          text-align: center;
          margin-top: 40px;
        }
        
        .footer p {
          margin: 5px 0;
          opacity: 0.8;
        }
        
        .budget-item, .goal-item {
          background: #f7fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 15px;
          margin: 10px 0;
        }
        
        .budget-item h4, .goal-item h4 {
          margin: 0 0 8px 0;
          color: #2d3748;
        }
        
        .progress-bar {
          background: #e2e8f0;
          border-radius: 10px;
          height: 8px;
          margin: 8px 0;
          overflow: hidden;
        }
        
        .progress-fill {
          background: linear-gradient(90deg, #48bb78, #38a169);
          height: 100%;
          border-radius: 10px;
          transition: width 0.3s ease;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Kaptia</h1>
          <p>Financial Report for ${userData.firstName} ${userData.lastName}</p>
          <p>Report Period: ${period}</p>
        </div>
        
        <div class="content">
          <div class="section">
            <div class="user-info">
              <h3>Account Information</h3>
              <p><strong>Name:</strong> ${userData.firstName} ${userData.lastName}</p>
              <p><strong>Email:</strong> ${userData.email}</p>
              <p><strong>Report Generated:</strong> ${new Date().toLocaleDateString()}</p>
            </div>
          </div>
          
          <div class="section">
            <h2>Financial Trends</h2>
            <div class="chart-container">
              <img src="${trendChart}" alt="Financial Trends Chart" />
            </div>
          </div>
          
          <div class="section">
            <h2>Spending by Category</h2>
            <div class="chart-container">
              <img src="${categoryChart}" alt="Category Spending Chart" />
            </div>
          </div>
          
          ${insights && insights.length > 0 ? `
          <div class="section">
            <h2>AI Financial Insights</h2>
            <div class="insights-grid">
              ${insights.map(insight => `
                <div class="insight-card">
                  <h4>${insight.title || 'Financial Insight'}</h4>
                  <p>${insight.description || insight.insight || 'No description available'}</p>
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}
          
          ${budgets && budgets.length > 0 ? `
          <div class="section">
            <h2>Budget Overview</h2>
            ${budgets.map(budget => `
              <div class="budget-item">
                <h4>${budget.categoryName || 'Budget'}</h4>
                <p>Budgeted: $${budget.amount} | Spent: $${budget.spent || 0}</p>
                <div class="progress-bar">
                  <div class="progress-fill" style="width: ${Math.min((budget.spent || 0) / budget.amount * 100, 100)}%"></div>
                </div>
              </div>
            `).join('')}
          </div>
          ` : ''}
          
          ${goals && goals.length > 0 ? `
          <div class="section">
            <h2>Financial Goals</h2>
            ${goals.map(goal => `
              <div class="goal-item">
                <h4>${goal.name || 'Financial Goal'}</h4>
                <p>Target: $${goal.targetAmount} | Current: $${goal.currentAmount || 0}</p>
                <div class="progress-bar">
                  <div class="progress-fill" style="width: ${Math.min((goal.currentAmount || 0) / goal.targetAmount * 100, 100)}%"></div>
                </div>
              </div>
            `).join('')}
          </div>
          ` : ''}
          
          ${transactions && transactions.length > 0 ? `
          <div class="section">
            <h2>Recent Transactions</h2>
            <table class="transactions-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                ${transactions.slice(0, 20).map(transaction => `
                  <tr>
                    <td>${new Date(transaction.date).toLocaleDateString()}</td>
                    <td>${transaction.description}</td>
                    <td>${transaction.categoryName || 'Uncategorized'}</td>
                    <td class="${transaction.type === 'income' ? 'amount-positive' : 'amount-negative'}">
                      ${transaction.type === 'income' ? '+' : '-'}$${Math.abs(parseFloat(transaction.amount)).toFixed(2)}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ` : ''}
          
          <div class="qr-section">
            <h3>Access Your Dashboard</h3>
            <p>Scan this QR code to quickly access your Kaptia dashboard</p>
            <img src="${qrCodeDataUrl}" alt="Dashboard QR Code" />
          </div>
        </div>
        
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Kaptia - Smart Financial Management</p>
          <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}