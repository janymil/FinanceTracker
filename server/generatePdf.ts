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

function getWeekKey(date: Date): string {
  const startOfWeek = new Date(date);
  startOfWeek.setDate(date.getDate() - date.getDay());
  return startOfWeek.toISOString().split('T')[0];
}

function formatWeekLabel(weekKey: string): string {
  const date = new Date(weekKey);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function generateFinancialInsights(transactions: any[], summary: any): string[] {
  const insights = [];
  
  // Income vs Expenses analysis
  if (summary.netAmount > 0) {
    insights.push(`Positive cash flow of $${summary.netAmount.toLocaleString()} this month`);
  } else {
    insights.push(`Negative cash flow of $${Math.abs(summary.netAmount).toLocaleString()} - consider reducing expenses`);
  }
  
  // Transaction frequency
  const avgDaily = summary.transactionCount / 30;
  if (avgDaily > 3) {
    insights.push(`High transaction frequency (${avgDaily.toFixed(1)}/day) - good financial activity tracking`);
  }
  
  // Category analysis
  const topCategory = Object.entries(summary.categoryBreakdown)
    .sort(([,a], [,b]) => (b as number) - (a as number))[0];
  
  if (topCategory) {
    insights.push(`Highest spending category: ${topCategory[0]} ($${(topCategory[1] as number).toLocaleString()})`);
  }
  
  return insights;
}

function generateTransactionsTable(transactions: any[]): string {
  const sortedTransactions = transactions
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 20); // Show last 20 transactions

  return sortedTransactions.map(t => `
    <tr>
      <td>${new Date(t.date).toLocaleDateString()}</td>
      <td>${t.description}</td>
      <td class="${t.type}">${t.type === 'income' ? '+' : '-'}$${parseFloat(t.amount).toLocaleString()}</td>
      <td>${t.categoryId || 'Other'}</td>
    </tr>
  `).join('');
}

function generateBudgetsTable(budgets: any[]): string {
  return budgets.map(b => {
    const allocated = parseFloat(b.amount);
    const spent = parseFloat(b.spent);
    const remaining = allocated - spent;
    const progress = (spent / allocated * 100).toFixed(1);
    const status = spent > allocated ? 'Over Budget' : remaining < allocated * 0.1 ? 'Nearly Spent' : 'On Track';
    
    return `
      <tr>
        <td>${b.name}</td>
        <td>$${allocated.toLocaleString()}</td>
        <td>$${spent.toLocaleString()}</td>
        <td>$${remaining.toLocaleString()}</td>
        <td>${progress}%</td>
        <td class="${status.toLowerCase().replace(' ', '-')}">${status}</td>
      </tr>
    `;
  }).join('');
}

function generateGoalsTable(goals: any[]): string {
  return goals.map(g => {
    const target = parseFloat(g.targetAmount);
    const current = parseFloat(g.currentAmount);
    const progress = (current / target * 100).toFixed(1);
    const remaining = target - current;
    const targetDate = new Date(g.targetDate);
    const daysLeft = Math.ceil((targetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const status = current >= target ? 'Achieved' : daysLeft < 0 ? 'Overdue' : daysLeft < 30 ? 'Due Soon' : 'On Track';
    
    return `
      <tr>
        <td>${g.name}</td>
        <td>$${target.toLocaleString()}</td>
        <td>$${current.toLocaleString()}</td>
        <td>${progress}%</td>
        <td>${targetDate.toLocaleDateString()}</td>
        <td class="${status.toLowerCase().replace(' ', '-')}">${status}</td>
      </tr>
    `;
  }).join('');
}

export async function generatePdfReport(data: PDFData): Promise<Buffer> {
  const { transactions, budgets, goals, summary, userName } = data;
  
  // Generate comprehensive chart data
  const categoryBreakdown: { [key: string]: number } = {};
  const dailyData: { [key: string]: number } = {};
  const trendData: { labels: string[], income: number[], expenses: number[] } = {
    labels: [],
    income: [],
    expenses: []
  };
  
  // Process transactions for various charts
  transactions.forEach(t => {
    const amount = parseFloat(t.amount);
    const date = new Date(t.date);
    const dayKey = date.toISOString().split('T')[0];
    
    // Category breakdown for doughnut chart
    if (t.type === 'expense') {
      const category = t.categoryId || 'Other';
      categoryBreakdown[category] = (categoryBreakdown[category] || 0) + amount;
    }
    
    // Daily transaction count
    dailyData[dayKey] = (dailyData[dayKey] || 0) + 1;
  });
  
  // Generate trend data (weekly aggregation)
  const weeklyData: { [key: string]: { income: number, expenses: number } } = {};
  transactions.forEach(t => {
    const amount = parseFloat(t.amount);
    const date = new Date(t.date);
    const weekKey = getWeekKey(date);
    
    if (!weeklyData[weekKey]) {
      weeklyData[weekKey] = { income: 0, expenses: 0 };
    }
    
    if (t.type === 'income') {
      weeklyData[weekKey].income += amount;
    } else {
      weeklyData[weekKey].expenses += amount;
    }
  });
  
  // Sort and format trend data
  const sortedWeeks = Object.keys(weeklyData).sort();
  trendData.labels = sortedWeeks.map(week => formatWeekLabel(week));
  trendData.income = sortedWeeks.map(week => weeklyData[week].income);
  trendData.expenses = sortedWeeks.map(week => weeklyData[week].expenses);
  
  // Prepare chart data objects
  const categoryChartData = {
    labels: Object.keys(categoryBreakdown),
    values: Object.values(categoryBreakdown)
  };
  
  const dailyChartData = {
    labels: Object.keys(dailyData).sort().map(d => new Date(d).toLocaleDateString()),
    values: Object.keys(dailyData).sort().map(d => dailyData[d])
  };
  
  const topCategoriesData = {
    labels: Object.keys(categoryBreakdown).slice(0, 5),
    values: Object.values(categoryBreakdown).slice(0, 5)
  };

  // Generate financial insights
  const insights = generateFinancialInsights(transactions, summary);

  // Generate trend indicators
  const prevMonthIncome = summary.totalIncome * 0.9; // Mock previous data for comparison
  const prevMonthExpenses = summary.totalExpenses * 1.1;
  const incomeChange = ((summary.totalIncome - prevMonthIncome) / prevMonthIncome * 100).toFixed(1);
  const expenseChange = ((summary.totalExpenses - prevMonthExpenses) / prevMonthExpenses * 100).toFixed(1);
  const netChange = ((summary.netAmount - (prevMonthIncome - prevMonthExpenses)) / Math.abs(prevMonthIncome - prevMonthExpenses) * 100).toFixed(1);

  // Format data for template replacement
  const templateData = {
    // Basic info
    MONTH: summary.month,
    YEAR: summary.year.toString(),
    USER_NAME: userName || 'User',
    GENERATED_DATE: new Date().toLocaleDateString(),

    // Financial KPIs
    TOTAL_INCOME: `$${summary.totalIncome.toLocaleString()}`,
    TOTAL_EXPENSES: `$${summary.totalExpenses.toLocaleString()}`,
    NET_AMOUNT: `$${summary.netAmount.toLocaleString()}`,
    TRANSACTION_COUNT: summary.transactionCount.toString(),

    // Trend indicators
    INCOME_CHANGE: `${incomeChange}%`,
    EXPENSE_CHANGE: `${expenseChange}%`,
    NET_CHANGE: `${netChange}%`,
    INCOME_TREND_CLASS: parseFloat(incomeChange) >= 0 ? 'positive' : 'negative',
    EXPENSE_TREND_CLASS: parseFloat(expenseChange) <= 0 ? 'positive' : 'negative',
    NET_TREND_CLASS: parseFloat(netChange) >= 0 ? 'positive' : 'negative',
    TRANSACTION_FREQUENCY: `${(summary.transactionCount / 30).toFixed(1)}/day`,

    // Chart data (JSON format for JavaScript)
    CATEGORY_CHART_DATA: JSON.stringify(categoryChartData),
    TREND_CHART_DATA: JSON.stringify(trendData),
    DAILY_CHART_DATA: JSON.stringify(dailyChartData),
    TOP_CATEGORIES_CHART_DATA: JSON.stringify(topCategoriesData),

    // Financial insights
    FINANCIAL_INSIGHTS: insights.map(insight => `<li>${insight}</li>`).join(''),

    // Tables
    TRANSACTIONS_TABLE: generateTransactionsTable(transactions),
    BUDGETS_SECTION: budgets && budgets.length > 0 ? 
      BUDGETS_SECTION_TEMPLATE.replace('{{BUDGETS_TABLE}}', generateBudgetsTable(budgets)) : '',
    GOALS_SECTION: goals && goals.length > 0 ? 
      GOALS_SECTION_TEMPLATE.replace('{{GOALS_TABLE}}', generateGoalsTable(goals)) : ''
  };

  // Replace all placeholders in template
  let html = PDF_TEMPLATE;
  Object.entries(templateData).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    html = html.replace(regex, value);
  });

  // Generate PDF using Puppeteer
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });

    // Wait for charts to load
    await page.waitForTimeout(3000);

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      }
    });

    return pdfBuffer;
  } finally {
    await browser.close();
  }
}