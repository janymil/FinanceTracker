import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

Chart.register(...registerables);

const width = 800;
const height = 400;

export interface ChartData {
  type: 'line' | 'bar' | 'doughnut' | 'pie';
  data: {
    labels: string[];
    datasets: Array<{
      label?: string;
      data: number[];
      borderColor?: string;
      backgroundColor?: string | string[];
      fill?: boolean;
      tension?: number;
      borderWidth?: number;
    }>;
  };
  title: string;
}

export async function generateChart(chartData: ChartData): Promise<string> {
  const chartJSNodeCanvas = new ChartJSNodeCanvas({ 
    width, 
    height,
    backgroundColor: 'white'
  });

  const configuration: ChartConfiguration = {
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
          },
          padding: 20
        },
        legend: {
          display: true,
          position: 'bottom' as const
        }
      },
      scales: chartData.type === 'line' || chartData.type === 'bar' ? {
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(0,0,0,0.1)'
          }
        },
        x: {
          grid: {
            color: 'rgba(0,0,0,0.1)'
          }
        }
      } : undefined
    }
  };

  try {
    const imageBuffer = await chartJSNodeCanvas.renderToBuffer(configuration);
    const base64Image = imageBuffer.toString('base64');
    return `data:image/png;base64,${base64Image}`;
  } catch (error) {
    console.error('Chart generation error:', error);
    throw new Error('Failed to generate chart');
  }
}

export async function generateTrendChart(data: Array<{month: string, income: number, expenses: number, balance: number}>): Promise<string> {
  return generateChart({
    type: 'line',
    data: {
      labels: data.map(d => d.month),
      datasets: [
        {
          label: 'Income',
          data: data.map(d => d.income),
          borderColor: '#10B981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: false,
          tension: 0.4
        },
        {
          label: 'Expenses', 
          data: data.map(d => d.expenses),
          borderColor: '#EF4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          fill: false,
          tension: 0.4
        },
        {
          label: 'Net Balance',
          data: data.map(d => d.balance),
          borderColor: '#8B5CF6',
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          fill: true,
          tension: 0.4
        }
      ]
    },
    title: 'Financial Trends Over Time'
  });
}

export async function generateCategoryChart(data: Array<{name: string, amount: number}>): Promise<string> {
  const colors = [
    '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444',
    '#6366F1', '#8B5A2B', '#059669', '#DC2626', '#7C3AED', '#DB2777'
  ];

  return generateChart({
    type: 'doughnut',
    data: {
      labels: data.map(d => d.name),
      datasets: [{
        data: data.map(d => d.amount),
        backgroundColor: colors.slice(0, data.length),
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    },
    title: 'Spending by Category'
  });
}