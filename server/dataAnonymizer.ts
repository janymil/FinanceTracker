
interface AnonymizationResult {
  anonymizedText: string;
  mapping: Map<string, string>;
}

export class DataAnonymizer {
  private static merchantNames = new Set([
    'walmart', 'target', 'amazon', 'starbucks', 'mcdonalds', 'subway', 
    'costco', 'home depot', 'lowes', 'shell', 'exxon', 'chevron',
    'uber', 'lyft', 'netflix', 'spotify', 'apple', 'google'
  ]);

  private static locationPatterns = [
    /\b\d{1,5}\s+[a-zA-Z\s]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr)\b/gi,
    /\b[a-zA-Z\s]+,\s*[A-Z]{2}\s*\d{5}\b/gi, // City, ST 12345
    /\b[a-zA-Z\s]+\s+\d{5}\b/gi // City 12345
  ];

  static anonymizeForAI(description: string, amount: number): AnonymizationResult {
    const mapping = new Map<string, string>();
    let anonymized = description.toLowerCase();

    // Replace specific merchant names with generic categories
    for (const merchant of this.merchantNames) {
      if (anonymized.includes(merchant)) {
        const category = this.getMerchantCategory(merchant);
        anonymized = anonymized.replace(new RegExp(`\\b${merchant}\\b`, 'gi'), category);
        mapping.set(merchant, category);
      }
    }

    // Remove/anonymize addresses and locations
    for (const pattern of this.locationPatterns) {
      anonymized = anonymized.replace(pattern, '[LOCATION]');
    }

    // Remove potential account numbers or IDs
    anonymized = anonymized.replace(/\b\d{4,}\b/g, '[ID]');
    
    // Remove email addresses
    anonymized = anonymized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');
    
    // Remove phone numbers
    anonymized = anonymized.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]');

    // Round amount to nearest $5 to reduce precision
    const roundedAmount = Math.round(amount / 5) * 5;

    return {
      anonymizedText: anonymized.trim(),
      mapping
    };
  }

  private static getMerchantCategory(merchant: string): string {
    const categories: Record<string, string> = {
      'walmart': 'GROCERY_STORE',
      'target': 'RETAIL_STORE', 
      'amazon': 'ONLINE_RETAILER',
      'starbucks': 'COFFEE_SHOP',
      'mcdonalds': 'FAST_FOOD',
      'subway': 'FAST_FOOD',
      'costco': 'WAREHOUSE_STORE',
      'home depot': 'HOME_IMPROVEMENT',
      'lowes': 'HOME_IMPROVEMENT',
      'shell': 'GAS_STATION',
      'exxon': 'GAS_STATION',
      'chevron': 'GAS_STATION',
      'uber': 'RIDESHARE',
      'lyft': 'RIDESHARE',
      'netflix': 'STREAMING_SERVICE',
      'spotify': 'MUSIC_SERVICE',
      'apple': 'TECH_COMPANY',
      'google': 'TECH_COMPANY'
    };
    return categories[merchant.toLowerCase()] || 'MERCHANT';
  }

  static anonymizeFinancialSummary(data: any): any {
    // For financial summaries, we can use statistical ranges instead of exact amounts
    return {
      incomeRange: this.getAmountRange(data.totalIncome),
      expenseRange: this.getAmountRange(data.totalExpenses),
      transactionCount: data.transactionsByCategory?.length || 0,
      topCategories: data.transactionsByCategory?.slice(0, 5).map((cat: any) => ({
        category: cat.categoryName,
        amountRange: this.getAmountRange(cat.amount)
      })) || []
    };
  }

  private static getAmountRange(amount: number): string {
    if (amount < 100) return 'under_100';
    if (amount < 500) return '100_500';
    if (amount < 1000) return '500_1000';
    if (amount < 2500) return '1000_2500';
    if (amount < 5000) return '2500_5000';
    return 'over_5000';
  }
}
