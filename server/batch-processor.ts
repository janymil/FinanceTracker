
import { storage } from "./storage";
import { runAI } from "../lib/aiProcessor";
// Cache system removed

// Track users who need batch processing
const batchQueue = new Set<string>();
const processingInProgress = new Set<string>();

// Schedule a user for batch processing
export function scheduleBatchProcessing(userId: string) {
  batchQueue.add(userId);
}

// Export batch processor interface
export const batchProcessor = {
  scheduleUser: scheduleBatchProcessing
};

// Process batched AI operations for users with new data
async function processBatchedOperations() {
  if (batchQueue.size === 0) return;
  
  
  // Process users one by one to avoid rate limits
  for (const userId of Array.from(batchQueue)) {
    if (processingInProgress.has(userId)) continue;
    
    try {
      processingInProgress.add(userId);
      batchQueue.delete(userId);
      
      const user = await storage.getUser(userId);
      if (!user || user.plan === 'free') continue;
      
      // Get recent transactions to check if cache needs updating
      const transactions = await storage.getUserTransactions(userId, 100);
      if (transactions.length === 0) continue;
      
      // Check if we need to update insights (only if data changed significantly)
      const shouldUpdateInsights = await shouldProcessInsights(userId, transactions);
      
      if (shouldUpdateInsights) {
        
        // Pre-generate and cache insights for faster dashboard loading
        if (user.plan === 'premium') {
          const insights = await runAI('spending-insights', userId, {
            transactions: transactions.map(t => ({
              description: t.description,
              amount: parseFloat(t.amount),
              date: t.date.toISOString(),
              categoryName: t.categoryId?.toString() || 'Uncategorized',
              type: t.type
            }))
          });
          
          // Cache insights with transaction hash
          // Cache system removed
        }
        
        // Generate financial tips if user has enough data
        if (transactions.length > 5) {
          const startDate = new Date();
          startDate.setDate(1);
          const endDate = new Date();
          
          const financialSummary = await storage.getUserFinancialSummary(userId, startDate, endDate);
          
          const financialData = {
            totalIncome: financialSummary.totalIncome,
            totalExpenses: financialSummary.totalExpenses,
            transactionsByCategory: financialSummary.transactionsByCategory,
            recentTransactions: transactions.slice(0, 20).map(t => ({
              description: t.description,
              amount: parseFloat(t.amount),
              date: t.date.toISOString(),
              categoryName: t.categoryId?.toString() || 'Uncategorized'
            }))
          };
          
          const tips = await runAI('financial-tips', userId, financialData);
          // Cache system removed
        }
        
      }
      
    } catch (error) {
    } finally {
      processingInProgress.delete(userId);
    }
    
    // Small delay to respect API rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

// Check if insights need updating based on transaction changes
async function shouldProcessInsights(userId: string, transactions: any[]): Promise<boolean> {
  // Check if user has significant new transactions since last processing
  const recentTransactions = transactions.filter(t => {
    const transactionDate = new Date(t.date);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return transactionDate > oneDayAgo;
  });
  
  // Process if there are 3+ new transactions or significant amount changes
  if (recentTransactions.length >= 3) return true;
  
  const significantAmount = recentTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
  return significantAmount > 100; // Process if $100+ in new transactions
}

// Start batch processing interval (every 5 minutes)
setInterval(processBatchedOperations, 5 * 60 * 1000);

// Initial cleanup on startup
setTimeout(processBatchedOperations, 30000); // Run after 30 seconds of startup

