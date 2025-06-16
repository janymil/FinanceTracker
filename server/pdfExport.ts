import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

interface TransactionData {
  id: number;
  amount: string;
  description: string;
  date: string;
  type: 'income' | 'expense';
  categoryName?: string;
}

interface PdfData {
  user: {
    name?: string;
    email?: string;
  };
  period: string;
  summary: {
    totalIncome: number;
    totalExpenses: number;
    netIncome: number;
    transactionCount: number;
  };
  transactions: TransactionData[];
  categoryBreakdown: Array<{
    category: string;
    amount: number;
    type: 'income' | 'expense';
  }>;
}

export async function generatePdfReport(data: PdfData): Promise<Buffer> {
  try {
    // Create a new PDF document
    const pdfDoc = await PDFDocument.create();
    
    // Embed fonts
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // Add a page
    const page = pdfDoc.addPage([595, 842]); // A4 size
    const { width, height } = page.getSize();
    
    let yPosition = height - 50;
    
    // Header
    page.drawText('FinanzerPro Financial Report', {
      x: 50,
      y: yPosition,
      size: 24,
      font: helveticaBoldFont,
      color: rgb(0.15, 0.11, 0.56), // FinanzerPro brand color
    });
    
    yPosition -= 40;
    
    // Report Details
    page.drawText('Report Details', {
      x: 50,
      y: yPosition,
      size: 16,
      font: helveticaBoldFont,
      color: rgb(0.12, 0.16, 0.22),
    });
    
    yPosition -= 25;
    
    page.drawText(`Period: ${data.period}`, {
      x: 50,
      y: yPosition,
      size: 12,
      font: helveticaFont,
      color: rgb(0.22, 0.26, 0.32),
    });
    
    yPosition -= 20;
    
    if (data.user.name) {
      page.drawText(`User: ${data.user.name}`, {
        x: 50,
        y: yPosition,
        size: 12,
        font: helveticaFont,
        color: rgb(0.22, 0.26, 0.32),
      });
      yPosition -= 20;
    }
    
    page.drawText(`Generated: ${new Date().toLocaleDateString()}`, {
      x: 50,
      y: yPosition,
      size: 12,
      font: helveticaFont,
      color: rgb(0.22, 0.26, 0.32),
    });
    
    yPosition -= 40;
    
    // Financial Summary
    page.drawText('Financial Summary', {
      x: 50,
      y: yPosition,
      size: 16,
      font: helveticaBoldFont,
      color: rgb(0.12, 0.16, 0.22),
    });
    
    yPosition -= 25;
    
    const summaryItems = [
      { label: 'Total Income:', value: `$${data.summary.totalIncome.toFixed(2)}`, color: rgb(0.02, 0.53, 0.41) },
      { label: 'Total Expenses:', value: `$${data.summary.totalExpenses.toFixed(2)}`, color: rgb(0.86, 0.16, 0.16) },
      { label: 'Net Income:', value: `$${data.summary.netIncome.toFixed(2)}`, color: data.summary.netIncome >= 0 ? rgb(0.02, 0.53, 0.41) : rgb(0.86, 0.16, 0.16) },
      { label: 'Total Transactions:', value: data.summary.transactionCount.toString(), color: rgb(0.12, 0.16, 0.22) },
    ];
    
    summaryItems.forEach(item => {
      page.drawText(item.label, {
        x: 50,
        y: yPosition,
        size: 12,
        font: helveticaFont,
        color: rgb(0.22, 0.26, 0.32),
      });
      
      page.drawText(item.value, {
        x: 200,
        y: yPosition,
        size: 12,
        font: helveticaBoldFont,
        color: item.color,
      });
      
      yPosition -= 20;
    });
    
    yPosition -= 20;
    
    // Category Breakdown
    if (data.categoryBreakdown.length > 0) {
      page.drawText('Category Breakdown', {
        x: 50,
        y: yPosition,
        size: 16,
        font: helveticaBoldFont,
        color: rgb(0.12, 0.16, 0.22),
      });
      
      yPosition -= 25;
      
      // Show top 10 categories
      const topCategories = data.categoryBreakdown.slice(0, 10);
      
      topCategories.forEach(category => {
        const categoryColor = category.type === 'expense' ? rgb(0.86, 0.16, 0.16) : rgb(0.02, 0.53, 0.41);
        
        page.drawText(`${category.category} (${category.type}):`, {
          x: 50,
          y: yPosition,
          size: 11,
          font: helveticaFont,
          color: rgb(0.22, 0.26, 0.32),
        });
        
        page.drawText(`$${category.amount.toFixed(2)}`, {
          x: 350,
          y: yPosition,
          size: 11,
          font: helveticaBoldFont,
          color: categoryColor,
        });
        
        yPosition -= 18;
      });
      
      yPosition -= 20;
    }
    
    // Recent Transactions
    page.drawText('Recent Transactions', {
      x: 50,
      y: yPosition,
      size: 16,
      font: helveticaBoldFont,
      color: rgb(0.12, 0.16, 0.22),
    });
    
    yPosition -= 25;
    
    // Table headers
    page.drawText('Date', {
      x: 50,
      y: yPosition,
      size: 10,
      font: helveticaBoldFont,
      color: rgb(0.12, 0.16, 0.22),
    });
    
    page.drawText('Description', {
      x: 130,
      y: yPosition,
      size: 10,
      font: helveticaBoldFont,
      color: rgb(0.12, 0.16, 0.22),
    });
    
    page.drawText('Amount', {
      x: 450,
      y: yPosition,
      size: 10,
      font: helveticaBoldFont,
      color: rgb(0.12, 0.16, 0.22),
    });
    
    yPosition -= 15;
    
    // Show recent transactions (max 15 to fit on page)
    const recentTransactions = data.transactions.slice(0, 15);
    
    recentTransactions.forEach(transaction => {
      const transactionColor = transaction.type === 'expense' ? rgb(0.86, 0.16, 0.16) : rgb(0.02, 0.53, 0.41);
      
      // Date
      page.drawText(new Date(transaction.date).toLocaleDateString(), {
        x: 50,
        y: yPosition,
        size: 9,
        font: helveticaFont,
        color: rgb(0.42, 0.45, 0.50),
      });
      
      // Description (truncate if too long)
      const description = transaction.description.length > 30 
        ? transaction.description.substring(0, 30) + '...' 
        : transaction.description;
      
      page.drawText(description, {
        x: 130,
        y: yPosition,
        size: 9,
        font: helveticaFont,
        color: rgb(0.12, 0.16, 0.22),
      });
      
      // Category if available
      if (transaction.categoryName) {
        page.drawText(`(${transaction.categoryName})`, {
          x: 280,
          y: yPosition,
          size: 8,
          font: helveticaFont,
          color: rgb(0.50, 0.54, 0.60),
        });
      }
      
      // Amount
      const prefix = transaction.type === 'expense' ? '-' : '+';
      page.drawText(`${prefix}$${parseFloat(transaction.amount).toFixed(2)}`, {
        x: 450,
        y: yPosition,
        size: 9,
        font: helveticaBoldFont,
        color: transactionColor,
      });
      
      yPosition -= 15;
    });
    
    if (data.transactions.length > 15) {
      yPosition -= 10;
      page.drawText(`Showing 15 of ${data.transactions.length} total transactions`, {
        x: 50,
        y: yPosition,
        size: 8,
        font: helveticaFont,
        color: rgb(0.50, 0.54, 0.60),
      });
    }
    
    // Footer
    page.drawText('Generated by FinanzerPro - Personal Finance Management', {
      x: 50,
      y: 30,
      size: 8,
      font: helveticaFont,
      color: rgb(0.42, 0.45, 0.50),
    });
    
    // Generate PDF bytes
    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF report');
  }
}