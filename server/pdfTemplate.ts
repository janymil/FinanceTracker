export const PDF_TEMPLATE = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>FinanzerPro Financial Report - {{MONTH}} {{YEAR}}</title>
    <style>
        * { box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            margin: 0;
            padding: 0;
            color: #1a202c;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        
        .report-container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            box-shadow: 0 20px 60px rgba(0,0,0,0.1);
        }
        
        .header {
            background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
            color: white;
            padding: 40px;
            position: relative;
            overflow: hidden;
        }
        .header::before {
            content: '';
            position: absolute;
            top: 0;
            right: 0;
            width: 200px;
            height: 200px;
            background: rgba(255,255,255,0.1);
            border-radius: 50%;
            transform: translate(50px, -50px);
        }
        .header h1 {
            margin: 0 0 10px 0;
            font-size: 36px;
            font-weight: 700;
            letter-spacing: -0.5px;
        }
        .header .subtitle {
            font-size: 18px;
            opacity: 0.9;
            margin-bottom: 20px;
        }
        .header .meta {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 20px;
            font-size: 14px;
            opacity: 0.8;
        }
        
        .executive-summary {
            padding: 40px;
            background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
            border-bottom: 1px solid #e2e8f0;
        }
        
        .kpi-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 24px;
            margin-bottom: 40px;
        }
        
        .kpi-card {
            background: white;
            border-radius: 16px;
            padding: 32px 24px;
            text-align: center;
            box-shadow: 0 4px 25px rgba(0,0,0,0.08);
            border: 1px solid rgba(255,255,255,0.8);
            transition: transform 0.2s ease;
            position: relative;
            overflow: hidden;
        }
        .kpi-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: var(--accent-color, #4f46e5);
        }
        .kpi-card.income { --accent-color: #10b981; }
        .kpi-card.expense { --accent-color: #ef4444; }
        .kpi-card.net { --accent-color: #3b82f6; }
        .kpi-card.transactions { --accent-color: #8b5cf6; }
        
        .kpi-card .icon {
            width: 48px;
            height: 48px;
            margin: 0 auto 16px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            background: var(--accent-color);
            color: white;
        }
        .kpi-card h3 {
            margin: 0 0 12px 0;
            color: #64748b;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 1px;
            font-weight: 600;
        }
        .kpi-card .amount {
            font-size: 32px;
            font-weight: 800;
            margin: 0 0 8px 0;
            color: #1e293b;
            line-height: 1;
        }
        .kpi-card .change {
            font-size: 14px;
            font-weight: 600;
            padding: 4px 12px;
            border-radius: 20px;
            display: inline-block;
        }
        .kpi-card .change.positive {
            background: #dcfce7;
            color: #166534;
        }
        .kpi-card .change.negative {
            background: #fee2e2;
            color: #991b1b;
        }
        
        .content-section {
            padding: 40px;
        }
        
        .section-header {
            display: flex;
            align-items: center;
            margin-bottom: 32px;
            padding-bottom: 16px;
            border-bottom: 2px solid #e2e8f0;
        }
        .section-header .icon {
            width: 40px;
            height: 40px;
            border-radius: 8px;
            background: #4f46e5;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 16px;
            font-size: 18px;
        }
        .section-header h2 {
            margin: 0;
            font-size: 24px;
            font-weight: 700;
            color: #1e293b;
            flex: 1;
        }
        
        .charts-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 32px;
            margin-bottom: 40px;
        }
        
        .chart-card {
            background: white;
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 4px 25px rgba(0,0,0,0.08);
            border: 1px solid #e2e8f0;
        }
        .chart-card h3 {
            margin: 0 0 20px 0;
            font-size: 18px;
            font-weight: 600;
            color: #374151;
            text-align: center;
        }
        .chart-container {
            position: relative;
            height: 300px;
            margin-bottom: 16px;
        }
        
        .data-table {
            background: white;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 25px rgba(0,0,0,0.08);
            border: 1px solid #e2e8f0;
            margin-bottom: 32px;
        }
        
        .table-header {
            background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
            padding: 20px 24px;
            border-bottom: 1px solid #e2e8f0;
        }
        .table-header h3 {
            margin: 0;
            font-size: 18px;
            font-weight: 600;
            color: #374151;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
        }
        th, td {
            padding: 16px 24px;
            text-align: left;
            border-bottom: 1px solid #f1f5f9;
        }
        th {
            background: #f8fafc;
            font-weight: 600;
            color: #475569;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        tr:hover {
            background: #f8fafc;
        }
        .amount-cell {
            text-align: right;
            font-weight: 600;
            font-variant-numeric: tabular-nums;
        }
        .income { color: #10b981; }
        .expense { color: #ef4444; }
        
        .category-tag {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;
            background: #e2e8f0;
            color: #475569;
        }
        
        .progress-bar {
            width: 100%;
            height: 8px;
            background: #e2e8f0;
            border-radius: 4px;
            overflow: hidden;
            margin: 8px 0;
        }
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #10b981, #059669);
            border-radius: 4px;
            transition: width 0.3s ease;
        }
        .progress-fill.over-budget {
            background: linear-gradient(90deg, #ef4444, #dc2626);
        }
        
        .insights-section {
            background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
            border-radius: 16px;
            padding: 32px;
            margin: 32px 0;
            border: 1px solid #f59e0b;
        }
        .insights-section h3 {
            color: #92400e;
            margin: 0 0 16px 0;
            font-size: 20px;
            font-weight: 600;
        }
        .insights-list {
            list-style: none;
            padding: 0;
            margin: 0;
        }
        .insights-list li {
            background: rgba(255,255,255,0.6);
            padding: 12px 16px;
            margin-bottom: 8px;
            border-radius: 8px;
            color: #92400e;
            font-weight: 500;
        }
        
        .footer {
            background: #1e293b;
            color: white;
            padding: 40px;
            text-align: center;
        }
        .footer .logo {
            font-size: 24px;
            font-weight: 700;
            margin-bottom: 16px;
            color: #4f46e5;
        }
        .footer p {
            margin: 8px 0;
            opacity: 0.8;
        }
        .footer .disclaimer {
            font-size: 12px;
            opacity: 0.6;
            margin-top: 24px;
            padding-top: 24px;
            border-top: 1px solid #374151;
        }
        
        @media print {
            body { background: white; }
            .report-container { box-shadow: none; }
            .charts-grid { grid-template-columns: 1fr; }
            .chart-container { break-inside: avoid; }
        }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <div class="report-container">
        <!-- Header Section -->
        <div class="header">
            <h1>FinanzerPro Financial Report</h1>
            <div class="subtitle">Comprehensive Financial Analysis & Insights</div>
            <div class="meta">
                <div>Period: {{MONTH}} {{YEAR}}</div>
                <div>{{USER_NAME}}</div>
                <div>Generated: {{GENERATED_DATE}}</div>
            </div>
        </div>

        <!-- Executive Summary -->
        <div class="executive-summary">
            <div class="kpi-grid">
                <div class="kpi-card income">
                    <div class="icon">💰</div>
                    <h3>Total Income</h3>
                    <div class="amount">{{TOTAL_INCOME}}</div>
                    <div class="change {{INCOME_TREND_CLASS}}">{{INCOME_CHANGE}}</div>
                </div>
                <div class="kpi-card expense">
                    <div class="icon">💸</div>
                    <h3>Total Expenses</h3>
                    <div class="amount">{{TOTAL_EXPENSES}}</div>
                    <div class="change {{EXPENSE_TREND_CLASS}}">{{EXPENSE_CHANGE}}</div>
                </div>
                <div class="kpi-card net">
                    <div class="icon">📊</div>
                    <h3>Net Amount</h3>
                    <div class="amount">{{NET_AMOUNT}}</div>
                    <div class="change {{NET_TREND_CLASS}}">{{NET_CHANGE}}</div>
                </div>
                <div class="kpi-card transactions">
                    <div class="icon">📝</div>
                    <h3>Transactions</h3>
                    <div class="amount">{{TRANSACTION_COUNT}}</div>
                    <div class="change">{{TRANSACTION_FREQUENCY}}</div>
                </div>
            </div>

            <div class="insights-section">
                <h3>💡 Key Financial Insights</h3>
                <ul class="insights-list">
                    {{FINANCIAL_INSIGHTS}}
                </ul>
            </div>
        </div>

        <!-- Charts Section -->
        <div class="content-section">
            <div class="section-header">
                <div class="icon">📈</div>
                <h2>Financial Analysis</h2>
            </div>
            
            <div class="charts-grid">
                <div class="chart-card">
                    <h3>Spending by Category</h3>
                    <div class="chart-container">
                        <canvas id="categoryChart"></canvas>
                    </div>
                </div>
                <div class="chart-card">
                    <h3>Income vs Expenses Trend</h3>
                    <div class="chart-container">
                        <canvas id="trendChart"></canvas>
                    </div>
                </div>
            </div>

            <div class="charts-grid">
                <div class="chart-card">
                    <h3>Daily Transaction Volume</h3>
                    <div class="chart-container">
                        <canvas id="dailyChart"></canvas>
                    </div>
                </div>
                <div class="chart-card">
                    <h3>Top Expense Categories</h3>
                    <div class="chart-container">
                        <canvas id="topCategoriesChart"></canvas>
                    </div>
                </div>
            </div>
        </div>

        <!-- Transactions Section -->
        <div class="content-section">
            <div class="section-header">
                <div class="icon">📋</div>
                <h2>Transaction Details</h2>
            </div>
            
            <div class="data-table">
                <div class="table-header">
                    <h3>All Transactions ({{TRANSACTION_COUNT}} total)</h3>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Description</th>
                            <th>Category</th>
                            <th>Type</th>
                            <th>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {{TRANSACTIONS_TABLE}}
                    </tbody>
                </table>
            </div>
        </div>

        {{BUDGETS_SECTION}}

        {{GOALS_SECTION}}

        <!-- Footer -->
        <div class="footer">
            <div class="logo">FinanzerPro</div>
            <p>Your Personal Finance Management Solution</p>
            <p>Visit us at finanzerpro.com</p>
            <div class="disclaimer">
                This report contains confidential financial information. Handle with care and store securely.
                <br>Generated automatically by FinanzerPro on {{GENERATED_DATE}}.
            </div>
        </div>
    </div>

    <script>
        // Chart.js configuration
        Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        Chart.defaults.font.size = 12;
        
        // Color palette
        const colors = [
            '#4f46e5', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', 
            '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#6366f1', 
            '#14b8a6', '#f43f5e', '#64748b', '#0ea5e9', '#8b5cf6'
        ];

        // Category Doughnut Chart
        const categoryCtx = document.getElementById('categoryChart').getContext('2d');
        const categoryData = {{CATEGORY_CHART_DATA}};
        
        new Chart(categoryCtx, {
            type: 'doughnut',
            data: {
                labels: categoryData.labels,
                datasets: [{
                    data: categoryData.values,
                    backgroundColor: colors.slice(0, categoryData.labels.length),
                    borderWidth: 3,
                    borderColor: '#ffffff',
                    hoverBorderWidth: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true,
                            font: { size: 11 },
                            generateLabels: function(chart) {
                                const data = chart.data;
                                if (data.labels.length && data.datasets.length) {
                                    return data.labels.map((label, i) => {
                                        const value = data.datasets[0].data[i];
                                        const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
                                        const percentage = ((value / total) * 100).toFixed(1);
                                        return {
                                            text: label + ' (' + percentage + '%)',
                                            fillStyle: data.datasets[0].backgroundColor[i],
                                            pointStyle: 'circle'
                                        };
                                    });
                                }
                                return [];
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.parsed;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return context.label + ': $' + value.toLocaleString() + ' (' + percentage + '%)';
                            }
                        }
                    }
                },
                animation: false
            }
        });

        // Income vs Expenses Trend Chart
        const trendCtx = document.getElementById('trendChart').getContext('2d');
        const trendData = {{TREND_CHART_DATA}};
        
        new Chart(trendCtx, {
            type: 'line',
            data: {
                labels: trendData.labels,
                datasets: [{
                    label: 'Income',
                    data: trendData.income,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.4,
                    fill: true
                }, {
                    label: 'Expenses',
                    data: trendData.expenses,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '$' + value.toLocaleString();
                            }
                        }
                    }
                },
                animation: false
            }
        });

        // Daily Transaction Volume Chart
        const dailyCtx = document.getElementById('dailyChart').getContext('2d');
        const dailyData = {{DAILY_CHART_DATA}};
        
        new Chart(dailyCtx, {
            type: 'bar',
            data: {
                labels: dailyData.labels,
                datasets: [{
                    label: 'Transaction Count',
                    data: dailyData.values,
                    backgroundColor: '#4f46e5',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true }
                },
                animation: false
            }
        });

        // Top Categories Bar Chart
        const topCategoriesCtx = document.getElementById('topCategoriesChart').getContext('2d');
        const topCategoriesData = {{TOP_CATEGORIES_CHART_DATA}};
        
        new Chart(topCategoriesCtx, {
            type: 'bar',
            data: {
                labels: topCategoriesData.labels,
                datasets: [{
                    label: 'Amount Spent',
                    data: topCategoriesData.values,
                    backgroundColor: colors.slice(0, topCategoriesData.labels.length),
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        ticks: {
                            callback: function(value) {
                                return '$' + value.toLocaleString();
                            }
                        }
                    }
                },
                animation: false
            }
        });
    </script>
</body>
</html>
`;

export const BUDGETS_SECTION_TEMPLATE = `
        <div class="content-section">
            <div class="section-header">
                <div class="icon">🎯</div>
                <h2>Budget Performance</h2>
            </div>
            
            <div class="data-table">
                <div class="table-header">
                    <h3>Budget Overview & Progress</h3>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Budget Name</th>
                            <th>Allocated</th>
                            <th>Spent</th>
                            <th>Remaining</th>
                            <th>Progress</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {{BUDGETS_TABLE}}
                    </tbody>
                </table>
            </div>
        </div>
`;

export const GOALS_SECTION_TEMPLATE = `
        <div class="content-section">
            <div class="section-header">
                <div class="icon">🏆</div>
                <h2>Financial Goals</h2>
            </div>
            
            <div class="data-table">
                <div class="table-header">
                    <h3>Goal Tracking & Progress</h3>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Goal Name</th>
                            <th>Target Amount</th>
                            <th>Current Amount</th>
                            <th>Progress</th>
                            <th>Target Date</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {{GOALS_TABLE}}
                    </tbody>
                </table>
            </div>
        </div>
`;