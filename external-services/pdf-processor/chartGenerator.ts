import { ChartJSNodeCanvas } from 'chartjs-node-canvas';

// Chart.js configuration for PDF generation
const chartJSNodeCanvas = new ChartJSNodeCanvas({ 
  width: 800, 
  height: 400,
  backgroundColour: 'white',
  chartCallback: (ChartJS) => {
    ChartJS.defaults.font.family = 'Arial';
    ChartJS.defaults.font.size = 12;
    ChartJS.defaults.color = '#374151';
  }
});

// Smaller charts for category breakdowns
const smallChartCanvas = new ChartJSNodeCanvas({ 
  width: 600, 
  height: 300,
  backgroundColour: 'white',
  chartCallback: (ChartJS) => {
    ChartJS.defaults.font.family = 'Arial';
    ChartJS.defaults.font.size = 10;
    ChartJS.defaults.color = '#374151';
  }
});

export interface TrendsChartData {
  period: string;
  income: number;
  expenses: number;
  netBalance: number;
}

export interface CategoryData {
  name: string;
  amount: number;
  percentage: number;
  color: string;
}

// Generate trends line chart
export async function generateTrendsChart(
  trendsData: TrendsChartData[], 
  currency: string, 
  language: string
): Promise<Buffer> {
  const months = trendsData.map(item => formatChartMonth(item.period, language));
  
  const config = {
    type: 'line' as const,
    data: {
      labels: months,
      datasets: [
        {
          label: getTranslation('Income', language),
          data: trendsData.map(item => item.income),
          borderColor: '#059669',
          backgroundColor: 'rgba(5, 150, 105, 0.1)',
          fill: false,
          tension: 0.4,
          borderWidth: 3,
        },
        {
          label: getTranslation('Expenses', language),
          data: trendsData.map(item => item.expenses),
          borderColor: '#dc2626',
          backgroundColor: 'rgba(220, 38, 38, 0.1)',
          fill: false,
          tension: 0.4,
          borderWidth: 3,
        },
        {
          label: getTranslation('Net Balance', language),
          data: trendsData.map(item => item.netBalance),
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          fill: false,
          tension: 0.4,
          borderWidth: 3,
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: getTranslation('Financial Trends', language),
          font: { size: 18, weight: 'bold' },
          padding: 20
        },
        legend: {
          position: 'bottom' as const,
          labels: { 
            font: { size: 12 },
            padding: 15
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: '#e5e7eb'
          },
          ticks: {
            callback: function(value: any) {
              return `${currency}${value.toLocaleString()}`;
            }
          }
        },
        x: {
          grid: {
            color: '#e5e7eb'
          }
        }
      }
    }
  };

  return await chartJSNodeCanvas.renderToBuffer(config);
}

// Generate category doughnut chart
export async function generateCategoryChart(
  categories: CategoryData[], 
  currency: string, 
  language: string
): Promise<Buffer> {
  const config = {
    type: 'doughnut' as const,
    data: {
      labels: categories.map(cat => cat.name),
      datasets: [{
        data: categories.map(cat => cat.amount),
        backgroundColor: categories.map(cat => cat.color),
        borderWidth: 3,
        borderColor: '#ffffff'
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: getTranslation('Expenses by Category', language),
          font: { size: 16, weight: 'bold' },
          padding: 20
        },
        legend: {
          position: 'right' as const,
          labels: { 
            font: { size: 11 },
            generateLabels: function(chart: any) {
              const data = chart.data;
              return data.labels.map((label: string, i: number) => ({
                text: `${label}: ${currency}${data.datasets[0].data[i].toLocaleString()}`,
                fillStyle: data.datasets[0].backgroundColor[i],
                strokeStyle: data.datasets[0].backgroundColor[i],
                lineWidth: 0,
                hidden: false,
                index: i
              }));
            }
          }
        }
      }
    }
  };

  return await smallChartCanvas.renderToBuffer(config);
}

// Helper functions
function formatChartMonth(dateString: string, language: string): string {
  const date = new Date(dateString);
  const monthNames = {
    'en-us': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    'es-pe': ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
    'sk-sk': ['Jan', 'Feb', 'Mar', 'Apr', 'Máj', 'Jún', 'Júl', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec']
  };
  
  const months = monthNames[language as keyof typeof monthNames] || monthNames['en-us'];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

function getTranslation(key: string, language: string): string {
  const translations: Record<string, Record<string, string>> = {
    'Income': { 'en-us': 'Income', 'es-pe': 'Ingresos', 'sk-sk': 'Príjem' },
    'Expenses': { 'en-us': 'Expenses', 'es-pe': 'Gastos', 'sk-sk': 'Výdavky' },
    'Net Balance': { 'en-us': 'Net Balance', 'es-pe': 'Saldo Neto', 'sk-sk': 'Čistý zostatok' },
    'Financial Trends': { 'en-us': 'Financial Trends', 'es-pe': 'Tendencias Financieras', 'sk-sk': 'Finančné trendy' },
    'Expenses by Category': { 'en-us': 'Expenses by Category', 'es-pe': 'Gastos por Categoría', 'sk-sk': 'Výdavky podľa kategórie' }
  };
  
  return translations[key]?.[language] || translations[key]?.['en-us'] || key;
}