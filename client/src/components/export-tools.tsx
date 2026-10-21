import { useState } from 'react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { saveAs } from 'file-saver';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, FileText } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useClerkUserReady } from '@/hooks/useClerkUserReady';
import { getCurrentMonthDateRange } from '@/lib/dateRangeUtils';

interface MonthlySummary {
  totalIncome: number;
  totalExpenses: number;
  netAmount: number;
  transactionCount: number;
  categoryBreakdown: { [key: string]: number };
  month: string;
  year: number;
}

interface Transaction {
  id: number;
  amount: string;
  description: string;
  date: string;
  type: 'income' | 'expense';
  categoryId: string | null;
}

async function generateExpenseReportPdf(data: MonthlySummary) {
  // Create a new PDFDocument
  const pdfDoc = await PDFDocument.create();
  
  // Embed fonts
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  // Add a page
  const page = pdfDoc.addPage([595, 842]); // A4 size
  const { width, height } = page.getSize();
  
  let yPosition = height - 50;
  
  // Title
  page.drawText(`Kaptia - Expense Report for ${data.month} ${data.year}`, {
    x: 50,
    y: yPosition,
    size: 20,
    font: helveticaBoldFont,
    color: rgb(0.31, 0.27, 0.9), // Kaptia brand color
  });
  
  yPosition -= 40;
  
  // Financial Summary Section
  page.drawText('Financial Summary', {
    x: 50,
    y: yPosition,
    size: 16,
    font: helveticaBoldFont,
    color: rgb(0.31, 0.27, 0.9),
  });
  
  yPosition -= 25;
  
  // Summary details
  const summaryItems = [
    `Total Income: $${data.totalIncome.toFixed(2)}`,
    `Total Expenses: $${data.totalExpenses.toFixed(2)}`,
    `Net Amount: $${data.netAmount.toFixed(2)}`,
    `Total Transactions: ${data.transactionCount}`,
  ];
  
  summaryItems.forEach((item, index) => {
    const color = index === 0 ? rgb(0.06, 0.73, 0.51) : // Green for income
                  index === 1 ? rgb(0.94, 0.27, 0.27) : // Red for expenses
                  index === 2 ? (data.netAmount >= 0 ? rgb(0.06, 0.73, 0.51) : rgb(0.94, 0.27, 0.27)) :
                  rgb(0, 0, 0); // Black for transactions
    
    page.drawText(item, {
      x: 50,
      y: yPosition,
      size: 12,
      font: helveticaFont,
      color,
    });
    yPosition -= 20;
  });
  
  yPosition -= 20;
  
  // Categories Section
  if (Object.keys(data.categoryBreakdown).length > 0) {
    page.drawText('Spending by Category', {
      x: 50,
      y: yPosition,
      size: 16,
      font: helveticaBoldFont,
      color: rgb(0.31, 0.27, 0.9),
    });
    
    yPosition -= 25;
    
    // Table headers
    page.drawText('Category', {
      x: 50,
      y: yPosition,
      size: 12,
      font: helveticaBoldFont,
      color: rgb(0, 0, 0),
    });
    
    page.drawText('Amount', {
      x: 300,
      y: yPosition,
      size: 12,
      font: helveticaBoldFont,
      color: rgb(0, 0, 0),
    });
    
    yPosition -= 20;
    
    // Category rows
    Object.entries(data.categoryBreakdown)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10) // Top 10 categories
      .forEach(([category, amount]) => {
        page.drawText(category || 'Other', {
          x: 50,
          y: yPosition,
          size: 10,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
        
        page.drawText(`$${amount.toFixed(2)}`, {
          x: 300,
          y: yPosition,
          size: 10,
          font: helveticaFont,
          color: rgb(0.94, 0.27, 0.27),
        });
        
        yPosition -= 15;
      });
  }
  
  yPosition -= 30;
  
  // Notes section
  page.drawText('Notes', {
    x: 50,
    y: yPosition,
    size: 16,
    font: helveticaBoldFont,
    color: rgb(0.31, 0.27, 0.9),
  });
  
  yPosition -= 25;
  
  page.drawText('This report was generated automatically by Kaptia.', {
    x: 50,
    y: yPosition,
    size: 10,
    font: helveticaFont,
    color: rgb(0.5, 0.5, 0.5),
  });
  
  yPosition -= 15;
  
  page.drawText(`Generated on: ${new Date().toLocaleDateString()}`, {
    x: 50,
    y: yPosition,
    size: 10,
    font: helveticaFont,
    color: rgb(0.5, 0.5, 0.5),
  });
  
  // Footer
  page.drawText(`Kaptia Financial Report - ${data.month} ${data.year}`, {
    x: 50,
    y: 30,
    size: 8,
    font: helveticaFont,
    color: rgb(0.7, 0.7, 0.7),
  });
  
  return pdfDoc;
}

export function ExportTools() {
  const [isGenerating, setIsGenerating] = useState(false);
  const { isReady, user } = useClerkUserReady();
  
  // Get transactions for chart generation
  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ['/api/transactions'],
    enabled: isReady,
  });
  
  // Get financial summary
  const { data: summary } = useQuery({
    queryKey: ['/api/financial-summary'],
  });
  
  const generatePdfReport = async () => {
    setIsGenerating(true);
    
    try {
      // Process transactions to get monthly summary
      const { startDate, endDate } = getCurrentMonthDateRange();
      const currentMonth = startDate.toLocaleDateString('en-US', { month: 'long' });
      const currentYear = startDate.getFullYear();
      
      // Calculate category breakdown
      const categoryBreakdown: { [key: string]: number } = {};
      
      transactions
        .filter(t => {
          const transactionDate = new Date(t.date);
          return transactionDate >= startDate && 
                 transactionDate <= endDate &&
                 t.type === 'expense';
        })
        .forEach(t => {
          const category = t.categoryId || 'Other';
          categoryBreakdown[category] = (categoryBreakdown[category] || 0) + parseFloat(t.amount);
        });
      
      const typedSummary = summary as { totalIncome?: number; totalExpenses?: number; netAmount?: number; transactionCount?: number } | undefined;
      const monthlySummary: MonthlySummary = {
        totalIncome: typedSummary?.totalIncome || 0,
        totalExpenses: typedSummary?.totalExpenses || 0,
        netAmount: typedSummary?.netAmount || 0,
        transactionCount: typedSummary?.transactionCount || 0,
        categoryBreakdown,
        month: currentMonth,
        year: currentYear,
      };
      
      // Generate chart image (simple canvas-based chart)
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 300;
      const ctx = canvas.getContext('2d');
      
      if (ctx && Object.keys(categoryBreakdown).length > 0) {
        // Simple bar chart
        const categories = Object.entries(categoryBreakdown).sort(([,a], [,b]) => b - a).slice(0, 5);
        const maxAmount = Math.max(...categories.map(([,amount]) => amount));
        
        // Background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Title
        ctx.fillStyle = '#4f46e5';
        ctx.font = 'bold 16px Arial';
        ctx.fillText('Top Spending Categories', 20, 30);
        
        // Bars
        const barWidth = 60;
        const barSpacing = 70;
        const startX = 40;
        const startY = 250;
        const maxBarHeight = 180;
        
        categories.forEach(([category, amount], index) => {
          const barHeight = (amount / maxAmount) * maxBarHeight;
          const x = startX + (index * barSpacing);
          const y = startY - barHeight;
          
          // Bar
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(x, y, barWidth, barHeight);
          
          // Amount label
          ctx.fillStyle = '#000000';
          ctx.font = '10px Arial';
          ctx.fillText(`$${amount.toFixed(0)}`, x, y - 5);
          
          // Category label
          ctx.fillStyle = '#666666';
          ctx.font = '10px Arial';
          const truncatedCategory = category.length > 8 ? category.substring(0, 8) + '...' : category;
          ctx.fillText(truncatedCategory, x, startY + 15);
        });
      }
      
      // Generate PDF
      const pdfDoc = await generateExpenseReportPdf(monthlySummary);
      
      // Add chart image if available
      if (ctx && Object.keys(categoryBreakdown).length > 0) {
        const chartImage = canvas.toDataURL('image/png');
        const pngImageBytes = await fetch(chartImage).then(res => res.arrayBuffer());
        const pngImage = await pdfDoc.embedPng(pngImageBytes);
        
        const pages = pdfDoc.getPages();
        const firstPage = pages[0];
        
        // Add chart to PDF
        firstPage.drawImage(pngImage, {
          x: 350,
          y: 400,
          width: 200,
          height: 150,
        });
      }
      
      // Save PDF
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      saveAs(blob, `kaptia-expense-report-${currentMonth}-${currentYear}.pdf`);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF report. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          PDF Report Generator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Generate a professional PDF report with your financial summary and spending charts.
        </p>
        
        <Button 
          onClick={generatePdfReport} 
          disabled={isGenerating}
          className="w-full"
        >
          <Download className="h-4 w-4 mr-2" />
          {isGenerating ? 'Generating PDF...' : 'Exportar PDF'}
        </Button>
      </CardContent>
    </Card>
  );
}