// Helper functions for voice input processing

export function extractAmountFromText(text: string, userCurrency: string = '$'): number | null {
  // Create patterns based on user's currency and common formats
  const currencySymbol = userCurrency.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape special regex chars
  
  const amountPatterns = [
    // PRIORITY 1: User's preferred currency first
    new RegExp(`(\\d+\\.?\\d*)\\s*${currencySymbol}`, 'gi'),  // 25€, 25.50€ (user currency)
    new RegExp(`${currencySymbol}(\\d+\\.?\\d*)`, 'gi'),      // €25, €25.50 (user currency prefix)
    
    // PRIORITY 2: Common currency fallbacks (only if user currency not found)
    /(\d+\.?\d*)\s*\$/gi,           // 25$ 
    /\$(\d+\.?\d*)/gi,              // $25, $25.50
    /(\d+\.?\d*)\s*€/gi,            // 25€
    /€(\d+\.?\d*)/gi,               // €25
    /(\d+\.?\d*)\s*£/gi,            // 25£
    /£(\d+\.?\d*)/gi,               // £25
    /(\d+\.?\d*)\s*¥/gi,            // 25¥
    /¥(\d+\.?\d*)/gi,               // ¥25
    /(\d+\.?\d*)\s*Kč/gi,           // 25Kč
    
    // PRIORITY 3: Text-based currency recognition
    /(\d+\.?\d*)\s*(?:dollars?|euros?|pounds?|yen|czk|eur|usd|gbp|crowns?)/gi,
    
    // PRIORITY 4: Decimal amounts and bare numbers (last resort)
    /(\d+[.,]\d{2})/g,         // 25.50, 25,50 (decimal amounts)
    /(\d+)/g                   // Just numbers as fallback
  ];
  
  for (const pattern of amountPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      // Extract the numeric part
      const numericMatch = matches[0].match(/(\d+[.,]?\d*)/);
      if (numericMatch) {
        const amount = parseFloat(numericMatch[0].replace(',', '.'));
        if (!isNaN(amount) && amount > 0) {
          console.log(`💰 [VoiceAPI] Extracted amount: ${amount} (user currency: ${userCurrency})`);
          return amount;
        }
      }
    }
  }
  
  console.log(`💰 [VoiceAPI] No amount found in: "${text}" (user currency: ${userCurrency})`);
  return null;
}

export function extractVendorFromText(text: string): string | null {
  // Look for common vendor patterns
  const vendorPatterns = [
    /(?:at|from|in|to)\s+([A-Za-z][A-Za-z\s&-]+)(?:\s|$)/gi,  // "at McDonald's"
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g  // Capitalized words
  ];
  
  for (const pattern of vendorPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      // Filter out common non-vendor words
      const filtered = matches.filter(match => 
        !['Today', 'Yesterday', 'Morning', 'Evening', 'Expense', 'Income'].includes(match.trim())
      );
      if (filtered.length > 0) {
        return filtered[0].replace(/^(at|from|in|to)\s+/gi, '').trim();
      }
    }
  }
  
  return null;
}

export function extractDescriptionFromText(text: string): string | null {
  // Extract meaningful description from text
  const cleanText = text.trim();
  
  // If it's just a number, return null (not a description)
  if (/^\d+(\.\d+)?$/.test(cleanText)) {
    return null;
  }
  
  // If it contains amount info, try to extract description part
  const amountMatch = cleanText.match(/\d+(\.\d+)?/);
  if (amountMatch) {
    // Remove amount and currency symbols, keep the rest as description
    let description = cleanText
      .replace(/\d+(\.\d+)?/g, '')
      .replace(/[\$€£¥]/g, '')
      .trim();
    
    if (description.length > 2) {
      return description;
    }
  }
  
  // Return the full text as description if it seems meaningful
  return cleanText.length > 1 ? cleanText : null;
}

export function extractTransactionType(text: string): 'income' | 'expense' | null {
  const lowerText = text.toLowerCase();
  
  // Income indicators
  const incomeKeywords = ['income', 'salary', 'paid', 'earned', 'received', 'got paid', 'payment received'];
  if (incomeKeywords.some(keyword => lowerText.includes(keyword))) {
    return 'income';
  }
  
  // Expense indicators  
  const expenseKeywords = ['spent', 'bought', 'paid for', 'cost', 'expense', 'purchase'];
  if (expenseKeywords.some(keyword => lowerText.includes(keyword))) {
    return 'expense';
  }
  
  return null; // Can't determine from text
}

export function parseDateReference(reference: string, timezone?: string): string {
  const today = new Date();
  const lowerRef = reference.toLowerCase();
  
  // Handle relative dates
  if (lowerRef === 'today') {
    return today.toISOString().split('T')[0];
  } else if (lowerRef === 'yesterday') {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  } else if (lowerRef.includes('last week')) {
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    return lastWeek.toISOString().split('T')[0];
  } else if (lowerRef === 'this morning' || lowerRef === 'this afternoon') {
    return today.toISOString().split('T')[0];
  }
  
  // Default to today if can't parse
  return today.toISOString().split('T')[0];
}

export function calculateConfidence(data: any): number {
  let confidence = 1.0;
  const requiredFields = ['amount', 'type', 'description'];
  
  for (const field of requiredFields) {
    if (!data[field]) {
      confidence -= 0.25;
    }
  }
  
  if (data.ambiguities && data.ambiguities.length > 0) {
    confidence -= 0.1 * data.ambiguities.length;
  }
  
  return Math.max(0, Math.min(1, confidence));
}