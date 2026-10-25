// Debug script to test financial summary
import { storage } from '../../server/storage.js';

async function testFinancialSummary() {
  try {
    const userId = 'user_2yYgmUlJG1EBLQqYEg7d64Ex2Zc';
    const startDate = new Date('2025-06-01');
    const endDate = new Date('2025-06-30T23:59:59.999Z');
    
    console.log('Testing financial summary for:');
    console.log('User ID:', userId);
    console.log('Start Date:', startDate.toISOString());
    console.log('End Date:', endDate.toISOString());
    
    const summary = await storage.getUserFinancialSummary(userId, startDate, endDate);
    
    console.log('\nFinancial Summary Result:');
    console.log(JSON.stringify(summary, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  process.exit(0);
}

testFinancialSummary();