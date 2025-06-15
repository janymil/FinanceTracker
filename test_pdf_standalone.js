import { generatePdfReport } from './server/generatePdf.js';
import fs from 'fs';

// Test data similar to what the application would generate
const testData = {
  transactions: [
    { id: 1, amount: '1200.00', description: 'Salary', date: '2025-06-01', type: 'income', categoryId: 'Salary' },
    { id: 2, amount: '800.00', description: 'Groceries', date: '2025-06-05', type: 'expense', categoryId: 'Food' },
    { id: 3, amount: '300.00', description: 'Gas', date: '2025-06-10', type: 'expense', categoryId: 'Transport' },
    { id: 4, amount: '150.00', description: 'Entertainment', date: '2025-06-15', type: 'expense', categoryId: 'Entertainment' }
  ],
  budgets: [
    { id: 1, name: 'Food Budget', amount: '1000.00', spent: '800.00', categoryId: 1, period: 'monthly' },
    { id: 2, name: 'Transport Budget', amount: '500.00', spent: '300.00', categoryId: 2, period: 'monthly' }
  ],
  goals: [
    { id: 1, name: 'Emergency Fund', targetAmount: '10000.00', currentAmount: '3500.00', targetDate: '2025-12-31' }
  ],
  summary: {
    totalIncome: 1200,
    totalExpenses: 1250,
    netAmount: -50,
    transactionCount: 4,
    categoryBreakdown: {
      'Food': 800,
      'Transport': 300,
      'Entertainment': 150
    },
    month: 'June',
    year: 2025
  },
  userName: 'Test User'
};

async function testPdfGeneration() {
  try {
    console.log('Testing PDF generation with Puppeteer + Google Charts...');
    const pdfBuffer = await generatePdfReport(testData);
    
    fs.writeFileSync('test_pdf_output.pdf', pdfBuffer);
    
    console.log('✓ PDF generated successfully!');
    console.log('✓ File saved as test_pdf_output.pdf');
    console.log(`✓ File size: ${pdfBuffer.length} bytes`);
    
  } catch (error) {
    console.error('✗ PDF generation failed:', error.message);
    console.error('Full error:', error);
  }
}

testPdfGeneration();