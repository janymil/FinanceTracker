import puppeteer from 'puppeteer';
import fetch from 'node-fetch';

interface TransactionData {
  id: number;
  amount: string;
  description: string;
  date: string;
  type: 'income' | 'expense';
  categoryId: string | null;
}

interface BudgetData {
  id: number;
  name: string;
  amount: string;
  spent: string;
  categoryId: number;
  period: string;
}

interface GoalData {
  id: number;
  name: string;
  targetAmount: string;
  currentAmount: string;
  targetDate: string;
}

interface MonthlySummary {
  totalIncome: number;
  totalExpenses: number;
  netAmount: number;
  transactionCount: number;
  categoryBreakdown: { [key: string]: number };
  month: string;
  year: number;
}

interface PDFData {
  transactions: TransactionData[];
  budgets?: BudgetData[];
  goals?: GoalData[];
  summary: MonthlySummary;
  userName?: string;
}

export class PDFGeneratorService {
  private async generateChartURL(data: any, chartType: string): Promise<string> {
    const baseURL = 'https://quickchart.io/chart';
    
    let chartConfig: any;
    
    switch (chartType) {
      case 'income-expense':
        chartConfig = {
          type: 'doughnut',
          data: {
            labels: ['Income', 'Expenses'],
            datasets: [{
              data: [data.totalIncome, Math.abs(data.totalExpenses)],
              backgroundColor: ['#10B981', '#EF4444'],
              borderWidth: 0
            }]
          },
          options: {
            responsive: true,
            plugins: {
              legend: {
                position: 'bottom'
              },
              title: {
                display: true,
                text: 'Income vs Expenses'
              }
            }
          }
        };
        break;
        
      case 'category-breakdown':
        const categories = Object.keys(data.categoryBreakdown);
        const amounts = Object.values(data.categoryBreakdown);
        chartConfig = {
          type: 'bar',
          data: {
            labels: categories,
            datasets: [{
              label: 'Amount',
              data: amounts,
              backgroundColor: [
                '#3B82F6', '#10B981', '#F59E0B', '#EF4444', 
                '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'
              ]
            }]
          },
          options: {
            responsive: true,
            plugins: {
              legend: {
                display: false
              },
              title: {
                display: true,
                text: 'Spending by Category'
              }
            },
            scales: {
              y: {
                beginAtZero: true
              }
            }
          }
        };
        break;
        
      case 'monthly-trend':
        // Simple trend chart with sample data
        chartConfig = {
          type: 'line',
          data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            datasets: [{
              label: 'Net Amount',
              data: [data.netAmount * 0.8, data.netAmount * 0.9, data.netAmount, 
                     data.netAmount * 1.1, data.netAmount * 0.95, data.netAmount * 1.05],
              borderColor: '#3B82F6',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              tension: 0.4
            }]
          },
          options: {
            responsive: true,
            plugins: {
              title: {
                display: true,
                text: 'Monthly Trend'
              }
            }
          }
        };
        break;
        
      default:
        throw new Error(`Unknown chart type: ${chartType}`);
    }
    
    const params = new URLSearchParams({
      c: JSON.stringify(chartConfig),
      width: '400',
      height: '300',
      format: 'png'
    });
    
    return `${baseURL}?${params.toString()}`;
  }

  private generateHTMLReport(data: PDFData): string {
    const currentDate = new Date().toLocaleDateString();
    
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>FinanzerPro Financial Report</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                margin: 0;
                padding: 40px;
                background: #ffffff;
                color: #1f2937;
                line-height: 1.6;
            }
            
            .header {
                text-align: center;
                margin-bottom: 40px;
                border-bottom: 3px solid #3b82f6;
                padding-bottom: 20px;
            }
            
            .logo {
                font-size: 32px;
                font-weight: bold;
                color: #3b82f6;
                margin-bottom: 10px;
            }
            
            .report-title {
                font-size: 24px;
                color: #1f2937;
                margin: 10px 0;
            }
            
            .report-date {
                color: #6b7280;
                font-size: 14px;
            }
            
            .summary-section {
                display: grid;
                grid-template-columns: 1fr 1fr 1fr;
                gap: 20px;
                margin: 30px 0;
            }
            
            .summary-card {
                background: #f8fafc;
                padding: 20px;
                border-radius: 8px;
                border-left: 4px solid #3b82f6;
                text-align: center;
            }
            
            .summary-card.income {
                border-left-color: #10b981;
            }
            
            .summary-card.expense {
                border-left-color: #ef4444;
            }
            
            .summary-value {
                font-size: 24px;
                font-weight: bold;
                margin-bottom: 5px;
            }
            
            .summary-value.positive {
                color: #10b981;
            }
            
            .summary-value.negative {
                color: #ef4444;
            }
            
            .summary-label {
                color: #6b7280;
                font-size: 14px;
            }
            
            .section {
                margin: 40px 0;
            }
            
            .section-title {
                font-size: 20px;
                font-weight: bold;
                margin-bottom: 20px;
                color: #1f2937;
                border-bottom: 2px solid #e5e7eb;
                padding-bottom: 10px;
            }
            
            .chart-container {
                text-align: center;
                margin: 30px 0;
            }
            
            .chart-container img {
                max-width: 100%;
                border-radius: 8px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            
            .transaction-table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 20px;
            }
            
            .transaction-table th,
            .transaction-table td {
                padding: 12px;
                text-align: left;
                border-bottom: 1px solid #e5e7eb;
            }
            
            .transaction-table th {
                background: #f8fafc;
                font-weight: 600;
                color: #374151;
            }
            
            .transaction-table tr:hover {
                background: #f9fafb;
            }
            
            .amount-positive {
                color: #10b981;
                font-weight: 600;
            }
            
            .amount-negative {
                color: #ef4444;
                font-weight: 600;
            }
            
            .footer {
                margin-top: 60px;
                text-align: center;
                color: #6b7280;
                font-size: 12px;
                border-top: 1px solid #e5e7eb;
                padding-top: 20px;
            }
            
            .page-break {
                page-break-before: always;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="logo">FinanzerPro</div>
            <div class="report-title">Financial Report</div>
            <div class="report-date">Generated on ${currentDate}${data.userName ? ` for ${data.userName}` : ''}</div>
        </div>

        <div class="summary-section">
            <div class="summary-card income">
                <div class="summary-value positive">$${data.summary.totalIncome.toFixed(2)}</div>
                <div class="summary-label">Total Income</div>
            </div>
            <div class="summary-card expense">
                <div class="summary-value negative">$${Math.abs(data.summary.totalExpenses).toFixed(2)}</div>
                <div class="summary-label">Total Expenses</div>
            </div>
            <div class="summary-card">
                <div class="summary-value ${data.summary.netAmount >= 0 ? 'positive' : 'negative'}">
                    $${data.summary.netAmount.toFixed(2)}
                </div>
                <div class="summary-label">Net Amount</div>
            </div>
        </div>

        <div class="section">
            <div class="section-title">Financial Overview</div>
            <div class="chart-container">
                <img src="INCOME_EXPENSE_CHART_URL" alt="Income vs Expenses Chart" />
            </div>
        </div>

        <div class="section">
            <div class="section-title">Spending by Category</div>
            <div class="chart-container">
                <img src="CATEGORY_BREAKDOWN_CHART_URL" alt="Category Breakdown Chart" />
            </div>
        </div>

        <div class="section page-break">
            <div class="section-title">Recent Transactions</div>
            <table class="transaction-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Type</th>
                        <th>Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.transactions.slice(0, 20).map(transaction => `
                        <tr>
                            <td>${new Date(transaction.date).toLocaleDateString()}</td>
                            <td>${transaction.description}</td>
                            <td style="text-transform: capitalize;">${transaction.type}</td>
                            <td class="${transaction.type === 'income' ? 'amount-positive' : 'amount-negative'}">
                                ${transaction.type === 'income' ? '+' : '-'}$${Math.abs(parseFloat(transaction.amount)).toFixed(2)}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        ${data.budgets && data.budgets.length > 0 ? `
        <div class="section">
            <div class="section-title">Budget Status</div>
            <table class="transaction-table">
                <thead>
                    <tr>
                        <th>Budget Name</th>
                        <th>Budget Amount</th>
                        <th>Spent</th>
                        <th>Remaining</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.budgets.map(budget => {
                        const remaining = parseFloat(budget.amount) - parseFloat(budget.spent);
                        return `
                        <tr>
                            <td>${budget.name}</td>
                            <td>$${parseFloat(budget.amount).toFixed(2)}</td>
                            <td class="amount-negative">$${parseFloat(budget.spent).toFixed(2)}</td>
                            <td class="${remaining >= 0 ? 'amount-positive' : 'amount-negative'}">
                                $${remaining.toFixed(2)}
                            </td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
        ` : ''}

        ${data.goals && data.goals.length > 0 ? `
        <div class="section">
            <div class="section-title">Financial Goals</div>
            <table class="transaction-table">
                <thead>
                    <tr>
                        <th>Goal Name</th>
                        <th>Target Amount</th>
                        <th>Current Amount</th>
                        <th>Progress</th>
                        <th>Target Date</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.goals.map(goal => {
                        const progress = (parseFloat(goal.currentAmount) / parseFloat(goal.targetAmount)) * 100;
                        return `
                        <tr>
                            <td>${goal.name}</td>
                            <td>$${parseFloat(goal.targetAmount).toFixed(2)}</td>
                            <td class="amount-positive">$${parseFloat(goal.currentAmount).toFixed(2)}</td>
                            <td>${progress.toFixed(1)}%</td>
                            <td>${new Date(goal.targetDate).toLocaleDateString()}</td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
        ` : ''}

        <div class="footer">
            <p>This report was generated by FinanzerPro - Your Personal Finance Management Solution</p>
            <p>For support and inquiries, visit our website or contact our support team.</p>
        </div>
    </body>
    </html>
    `;
  }

  async generatePDF(data: PDFData): Promise<Buffer> {
    let browser;
    
    try {
      // Generate chart URLs
      const incomeExpenseChartURL = await this.generateChartURL(data.summary, 'income-expense');
      const categoryBreakdownChartURL = await this.generateChartURL(data.summary, 'category-breakdown');
      
      // Generate HTML with chart URLs
      let htmlContent = this.generateHTMLReport(data);
      htmlContent = htmlContent.replace('INCOME_EXPENSE_CHART_URL', incomeExpenseChartURL);
      htmlContent = htmlContent.replace('CATEGORY_BREAKDOWN_CHART_URL', categoryBreakdownChartURL);
      
      // Launch Puppeteer
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
        ]
      });
      
      const page = await browser.newPage();
      
      // Set content and wait for images to load
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      
      // Generate PDF
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
      
      return pdfBuffer;
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw new Error('Failed to generate PDF report');
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}

export const pdfGenerator = new PDFGeneratorService();