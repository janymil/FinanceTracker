import QRCode from 'qrcode';

export interface PDFData {
  user: {
    name: string;
    email: string;
  };
  period: string;
  language: string;
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  currency: string;
  trends: {
    income: number;
    expenses: number;
    netBalance: number;
    period: string;
  }[];
  categories: {
    name: string;
    amount: number;
    percentage: number;
    color: string;
  }[];
  aiInsights?: {
    insights: string[];
    recommendations: string[];
    riskFactors: string[];
  };
  forecasts?: {
    nextMonthExpenses: number;
    expectedSavings: number;
    budgetVariance: number;
    confidence: number;
  };
  webUrl: string;
  generatedAt: Date;
}

// Generate QR code for web version link
export async function generateQRCode(url: string): Promise<string> {
  try {
    return await QRCode.toDataURL(url, {
      width: 150,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });
  } catch (error) {
    console.error('QR code generation failed:', error);
    return '';
  }
}

// Translation helper
function getTranslation(key: string, language: string): string {
  const translations: Record<string, Record<string, string>> = {
    'Financial Report': { 'en-us': 'Financial Report', 'es-pe': 'Reporte Financiero', 'sk-sk': 'Finančná správa' },
    'Executive Summary': { 'en-us': 'Executive Summary', 'es-pe': 'Resumen Ejecutivo', 'sk-sk': 'Výkonné súhrn' },
    'Total Income': { 'en-us': 'Total Income', 'es-pe': 'Ingresos Totales', 'sk-sk': 'Celkový príjem' },
    'Total Expenses': { 'en-us': 'Total Expenses', 'es-pe': 'Gastos Totales', 'sk-sk': 'Celkové výdavky' },
    'Net Balance': { 'en-us': 'Net Balance', 'es-pe': 'Saldo Neto', 'sk-sk': 'Čistý zostatok' },
    'Category Breakdown': { 'en-us': 'Category Breakdown', 'es-pe': 'Desglose por Categoría', 'sk-sk': 'Rozdelenie podľa kategórií' },
    'AI Insights': { 'en-us': 'AI Insights', 'es-pe': 'Perspectivas IA', 'sk-sk': 'AI poznatky' },
    'Key Insights': { 'en-us': 'Key Insights', 'es-pe': 'Perspectivas Clave', 'sk-sk': 'Kľúčové poznatky' },
    'Recommendations': { 'en-us': 'Recommendations', 'es-pe': 'Recomendaciones', 'sk-sk': 'Odporúčania' },
    'Risk Factors': { 'en-us': 'Risk Factors', 'es-pe': 'Factores de Riesgo', 'sk-sk': 'Rizikové faktory' },
    'Financial Forecasts': { 'en-us': 'Financial Forecasts', 'es-pe': 'Pronósticos Financieros', 'sk-sk': 'Finančné prognózy' },
    'Next Month Expenses': { 'en-us': 'Next Month Expenses', 'es-pe': 'Gastos del Próximo Mes', 'sk-sk': 'Výdavky budúci mesiac' },
    'Expected Savings': { 'en-us': 'Expected Savings', 'es-pe': 'Ahorros Esperados', 'sk-sk': 'Očakávané úspory' },
    'Budget Variance': { 'en-us': 'Budget Variance', 'es-pe': 'Variación Presupuestal', 'sk-sk': 'Rozpočtová odchýlka' },
    'Confidence Level': { 'en-us': 'Confidence Level', 'es-pe': 'Nivel de Confianza', 'sk-sk': 'Úroveň spoľahlivosti' },
    'Generated on': { 'en-us': 'Generated on', 'es-pe': 'Generado el', 'sk-sk': 'Vygenerované dňa' },
    'View Interactive Version': { 'en-us': 'View Interactive Version', 'es-pe': 'Ver Versión Interactiva', 'sk-sk': 'Zobraziť interaktívnu verziu' },
    'Scan QR code to access': { 'en-us': 'Scan QR code to access live dashboard', 'es-pe': 'Escanea el código QR para acceder al panel en vivo', 'sk-sk': 'Naskenujte QR kód pre prístup k živému panelu' }
  };
  
  return translations[key]?.[language] || translations[key]?.['en-us'] || key;
}

// Format date for display
function formatDate(date: Date, language: string): string {
  const options: Intl.DateTimeFormatOptions = { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  };
  
  const locale = language === 'es-pe' ? 'es-ES' : language === 'sk-sk' ? 'sk-SK' : 'en-US';
  return date.toLocaleDateString(locale, options);
}

// Generate complete HTML template
export async function generateHTMLTemplate(data: PDFData): Promise<string> {
  const t = (key: string) => getTranslation(key, data.language);
  const qrCodeDataUrl = await generateQRCode(data.webUrl);
  
  return `
<!DOCTYPE html>
<html lang="${data.language}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${t('Financial Report')} - ${data.user.name}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            color: #1e293b;
            background: #ffffff;
        }
        
        .container {
            max-width: 210mm;
            margin: 0 auto;
            padding: 20mm;
        }
        
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 3px solid #2563eb;
        }
        
        .header-left h1 {
            font-size: 28px;
            color: #1e40af;
            margin-bottom: 5px;
            font-weight: bold;
        }
        
        .header-left .subtitle {
            font-size: 14px;
            color: #64748b;
        }
        
        .header-right {
            text-align: right;
        }
        
        .header-right .date {
            font-size: 12px;
            color: #64748b;
        }
        
        .qr-section {
            display: flex;
            align-items: center;
            margin-top: 10px;
        }
        
        .qr-code {
            width: 60px;
            height: 60px;
            margin-right: 10px;
        }
        
        .qr-text {
            font-size: 10px;
            color: #64748b;
            max-width: 120px;
        }
        
        .section {
            margin-bottom: 30px;
            page-break-inside: avoid;
        }
        
        .section-title {
            font-size: 18px;
            font-weight: bold;
            color: #374151;
            margin-bottom: 15px;
            padding-left: 15px;
            border-left: 4px solid #3b82f6;
        }
        
        .metrics-grid {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 20px;
            margin-bottom: 25px;
        }
        
        .metric-card {
            background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
            padding: 20px;
            border-radius: 12px;
            border: 1px solid #e2e8f0;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .metric-label {
            font-size: 12px;
            color: #64748b;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .metric-value {
            font-size: 24px;
            font-weight: bold;
            color: #1e293b;
        }
        
        .metric-positive {
            color: #059669;
        }
        
        .metric-negative {
            color: #dc2626;
        }
        
        .chart-container {
            margin: 25px 0;
            text-align: center;
            page-break-inside: avoid;
        }
        
        .chart-title {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 15px;
            color: #374151;
        }
        
        .chart-image {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }
        
        .category-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
        }
        
        .category-item {
            display: flex;
            align-items: center;
            padding: 12px;
            background: #f9fafb;
            border-radius: 8px;
            border-left: 4px solid var(--category-color);
        }
        
        .category-color {
            width: 16px;
            height: 16px;
            border-radius: 50%;
            margin-right: 12px;
            background-color: var(--category-color);
        }
        
        .category-info {
            flex: 1;
        }
        
        .category-name {
            font-size: 13px;
            font-weight: 600;
            color: #374151;
            margin-bottom: 2px;
        }
        
        .category-amount {
            font-size: 12px;
            color: #64748b;
        }
        
        .insights-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 20px;
        }
        
        .insight-section {
            background: #f8fafc;
            padding: 20px;
            border-radius: 12px;
            border-left: 4px solid var(--accent-color);
        }
        
        .insight-title {
            font-size: 14px;
            font-weight: bold;
            color: #374151;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
        }
        
        .insight-icon {
            width: 20px;
            height: 20px;
            margin-right: 8px;
            border-radius: 50%;
            background-color: var(--accent-color);
        }
        
        .insight-list {
            list-style: none;
        }
        
        .insight-item {
            margin-bottom: 8px;
            padding-left: 20px;
            position: relative;
            font-size: 12px;
            line-height: 1.5;
        }
        
        .insight-item:before {
            content: '•';
            position: absolute;
            left: 8px;
            color: var(--accent-color);
            font-weight: bold;
        }
        
        .forecast-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
        }
        
        .forecast-item {
            background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
            padding: 15px;
            border-radius: 10px;
            border: 1px solid #bfdbfe;
        }
        
        .forecast-label {
            font-size: 11px;
            color: #1e40af;
            margin-bottom: 5px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .forecast-value {
            font-size: 18px;
            font-weight: bold;
            color: #1e293b;
        }
        
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 10px;
            color: #9ca3af;
        }
        
        .page-break {
            page-break-before: always;
        }
        
        @media print {
            .container {
                padding: 15mm;
            }
            
            .section {
                page-break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <div class="header-left">
                <h1>${t('Financial Report')}</h1>
                <div class="subtitle">${data.user.name} • ${data.period}</div>
            </div>
            <div class="header-right">
                <div class="date">${t('Generated on')} ${formatDate(data.generatedAt, data.language)}</div>
                ${qrCodeDataUrl ? `
                <div class="qr-section">
                    <img src="${qrCodeDataUrl}" alt="QR Code" class="qr-code">
                    <div class="qr-text">
                        <div><strong>${t('View Interactive Version')}</strong></div>
                        <div>${t('Scan QR code to access')}</div>
                    </div>
                </div>
                ` : ''}
            </div>
        </div>

        <!-- Executive Summary -->
        <div class="section">
            <h2 class="section-title">${t('Executive Summary')}</h2>
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-label">${t('Total Income')}</div>
                    <div class="metric-value metric-positive">
                        ${data.currency}${data.totalIncome.toLocaleString()}
                    </div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">${t('Total Expenses')}</div>
                    <div class="metric-value metric-negative">
                        ${data.currency}${data.totalExpenses.toLocaleString()}
                    </div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">${t('Net Balance')}</div>
                    <div class="metric-value ${data.netBalance >= 0 ? 'metric-positive' : 'metric-negative'}">
                        ${data.currency}${data.netBalance.toLocaleString()}
                    </div>
                </div>
            </div>
        </div>

        <!-- Trends Chart Placeholder -->
        <div class="section">
            <div class="chart-container">
                <div class="chart-title">Financial Trends</div>
                <div id="trends-chart-placeholder" style="height: 300px; background: #f3f4f6; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #6b7280;">
                    [Trends Chart Will Be Inserted Here]
                </div>
            </div>
        </div>

        <!-- Category Breakdown -->
        <div class="section">
            <h2 class="section-title">${t('Category Breakdown')}</h2>
            <div class="category-grid">
                ${data.categories.map(category => `
                    <div class="category-item" style="--category-color: ${category.color};">
                        <div class="category-color"></div>
                        <div class="category-info">
                            <div class="category-name">${category.name}</div>
                            <div class="category-amount">
                                ${data.currency}${category.amount.toLocaleString()} (${category.percentage.toFixed(1)}%)
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>

        <!-- Category Chart Placeholder -->
        <div class="section">
            <div class="chart-container">
                <div id="category-chart-placeholder" style="height: 250px; background: #f3f4f6; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #6b7280;">
                    [Category Chart Will Be Inserted Here]
                </div>
            </div>
        </div>

        ${data.aiInsights ? `
        <!-- AI Insights -->
        <div class="section page-break">
            <h2 class="section-title">${t('AI Insights')}</h2>
            <div class="insights-grid">
                ${data.aiInsights.insights.length > 0 ? `
                <div class="insight-section" style="--accent-color: #3b82f6;">
                    <div class="insight-title">
                        <div class="insight-icon"></div>
                        ${t('Key Insights')}
                    </div>
                    <ul class="insight-list">
                        ${data.aiInsights.insights.map(insight => `
                            <li class="insight-item">${insight}</li>
                        `).join('')}
                    </ul>
                </div>
                ` : ''}

                ${data.aiInsights.recommendations.length > 0 ? `
                <div class="insight-section" style="--accent-color: #10b981;">
                    <div class="insight-title">
                        <div class="insight-icon"></div>
                        ${t('Recommendations')}
                    </div>
                    <ul class="insight-list">
                        ${data.aiInsights.recommendations.map(rec => `
                            <li class="insight-item">${rec}</li>
                        `).join('')}
                    </ul>
                </div>
                ` : ''}

                ${data.aiInsights.riskFactors.length > 0 ? `
                <div class="insight-section" style="--accent-color: #ef4444;">
                    <div class="insight-title">
                        <div class="insight-icon"></div>
                        ${t('Risk Factors')}
                    </div>
                    <ul class="insight-list">
                        ${data.aiInsights.riskFactors.map(risk => `
                            <li class="insight-item">${risk}</li>
                        `).join('')}
                    </ul>
                </div>
                ` : ''}
            </div>
        </div>
        ` : ''}

        ${data.forecasts ? `
        <!-- Financial Forecasts -->
        <div class="section">
            <h2 class="section-title">${t('Financial Forecasts')}</h2>
            <div class="forecast-grid">
                <div class="forecast-item">
                    <div class="forecast-label">${t('Next Month Expenses')}</div>
                    <div class="forecast-value">
                        ${data.currency}${data.forecasts.nextMonthExpenses.toLocaleString()}
                    </div>
                </div>
                <div class="forecast-item">
                    <div class="forecast-label">${t('Expected Savings')}</div>
                    <div class="forecast-value">
                        ${data.currency}${data.forecasts.expectedSavings.toLocaleString()}
                    </div>
                </div>
                <div class="forecast-item">
                    <div class="forecast-label">${t('Budget Variance')}</div>
                    <div class="forecast-value">
                        ${data.forecasts.budgetVariance >= 0 ? '+' : ''}${data.forecasts.budgetVariance.toFixed(1)}%
                    </div>
                </div>
                <div class="forecast-item">
                    <div class="forecast-label">${t('Confidence Level')}</div>
                    <div class="forecast-value">
                        ${data.forecasts.confidence.toFixed(1)}%
                    </div>
                </div>
            </div>
        </div>
        ` : ''}

        <!-- Footer -->
        <div class="footer">
            <div>FinanzerPro - Smart Financial Analysis</div>
            <div>${data.user.email}</div>
        </div>
    </div>
</body>
</html>
  `;
}