// Dynamic configuration for AI help assistant
// This ensures the AI always has current information about the app

export interface AppConfiguration {
  features: FeatureConfig;
  pricing: PricingConfig;
  limits: UserLimits;
  processInfo: ProcessInfo;
}

interface FeatureConfig {
  free: string[];
  standard: string[];
  premium: string[];
}

interface PricingConfig {
  free: { price: string; features: string };
  standard: { monthly: string; yearly: string; features: string };
  premium: { monthly: string; yearly: string; features: string };
}

interface UserLimits {
  free: { transactions: number; budgets: number; goals: number };
  standard: { transactions: number; budgets: string; goals: string };
  premium: { transactions: string; budgets: string; goals: string };
}

interface ProcessInfo {
  gettingStarted: string[];
  commonTasks: string[];
  support: string[];
}

export function getCurrentAppConfig(): AppConfiguration {
  return {
    features: {
      free: [
        "Basic transaction tracking",
        "Manual expense categorization",
        "Simple dashboard view",
        "Up to 100 transactions"
      ],
      standard: [
        "Up to 100 transactions",
        "Receipt OCR scanning with mobile camera support",
        "Mobile QR code upload for cross-device receipt scanning",
        "AI-powered expense categorization",
        "Budget management and tracking with visual progress indicators", 
        "Financial goals setting with collaborative sharing",
        "Transaction reminders for recurring bills and payments",
        "Calendar view of transactions with monthly grid",
        "Financial health analysis with AI-powered recommendations",
        "Basic reports and analytics with filtering options"
      ],
      premium: [
        "Unlimited transactions",
        "AI Financial Tips with personalized recommendations",
        "Financial Mascot - personalized AI companion with mood indicators",
        "Advanced AI insights and trend predictions with forecasting",
        "Automatic cloud backup at 2:00 AM with restore functionality",
        "Data export in PDF, Excel, CSV, and JSON formats",
        "Data import from Mint, QuickBooks, YNAB, Personal Capital, bank exports",
        "Advanced analytics with seasonal patterns and comparative analysis",
        "Cloud receipt storage for all uploaded images",
        "Priority customer support"
      ]
    },
    pricing: {
      free: {
        price: "Free forever",
        features: "Perfect for trying out FinanzerPro with basic expense tracking"
      },
      standard: {
        monthly: "$4.99/month",
        yearly: "$49.90/year (save $9.98)",
        features: "Great for individuals who want comprehensive financial management"
      },
      premium: {
        monthly: "$9.99/month", 
        yearly: "$99.90/year (save $19.98)",
        features: "Best for power users who need advanced analytics and cloud features"
      }
    },
    limits: {
      free: {
        transactions: 100,
        budgets: 0,
        goals: 0
      },
      standard: {
        transactions: 100,
        budgets: "Unlimited",
        goals: "Unlimited"
      },
      premium: {
        transactions: "Unlimited",
        budgets: "Unlimited", 
        goals: "Unlimited"
      }
    },
    processInfo: {
      gettingStarted: [
        "1. Create your free FinanzerPro account",
        "2. Add your first transaction (income or expense)",
        "3. Let AI categorize it automatically (Standard+ plans)",
        "4. Set up budgets for your spending categories (Standard+ plans)",
        "5. Create financial goals to track progress (Standard+ plans)",
        "6. Monitor your progress on the dashboard"
      ],
      commonTasks: [
        "Adding transactions: Use the '+' button in header or 'Add Transaction' on dashboard",
        "Receipt scanning: Click 'Upload Image' on transaction pages for OCR extraction (Standard+)",
        "Mobile QR upload: Click 'Upload Image' → 'Scan with Phone' for cross-device receipt scanning",
        "Editing transactions: Click any transaction in lists or dashboard widgets to modify",
        "Setting budgets: Go to Budgets page and create category-based spending limits (Standard+)",
        "Creating goals: Use Goals page to set savings targets with deadlines (Standard+)",
        "Viewing calendar: Check Calendar page for monthly transaction grid view (Standard+)",
        "Managing categories: Use Categories page to create custom expense/income categories",
        "Checking reports: Reports page shows spending breakdowns and financial analysis",
        "AI predictions: Trends page provides forecasting and pattern analysis (Premium)",
        "Cloud backup: Data Management page for automatic backup and restore (Premium)",
        "Subscription: Profile page for plan upgrades and billing management"
      ],
      support: [
        "Use this AI chat for immediate help with app features",
        "Check the FAQ section below for common questions", 
        "Contact support at info@finanzerpro.com for technical issues",
        "Visit the Help Center for detailed guides and tutorials"
      ]
    }
  };
}

export function formatConfigForAI(config: AppConfiguration): string {
  return `
SUBSCRIPTION PLANS & FEATURES:

FREE PLAN (${config.pricing.free.price}):
${config.features.free.map(f => `- ${f}`).join('\n')}
Limits: ${config.limits.free.transactions} transactions, ${config.limits.free.budgets} budgets, ${config.limits.free.goals} goals

STANDARD PLAN (${config.pricing.standard.monthly} or ${config.pricing.standard.yearly}):
${config.features.standard.map(f => `- ${f}`).join('\n')}
Limits: ${config.limits.standard.transactions} transactions, ${config.limits.standard.budgets} budgets, ${config.limits.standard.goals} goals

PREMIUM PLAN (${config.pricing.premium.monthly} or ${config.pricing.premium.yearly}):
${config.features.premium.map(f => `- ${f}`).join('\n')}
Limits: ${config.limits.premium.transactions} transactions, ${config.limits.premium.budgets} budgets, ${config.limits.premium.goals} goals

GETTING STARTED:
${config.processInfo.gettingStarted.join('\n')}

COMMON TASKS:
${config.processInfo.commonTasks.join('\n')}

SUPPORT OPTIONS:
${config.processInfo.support.join('\n')}

IMPORTANT: Always reference the current pricing and features listed above. If features or pricing change, this information is automatically updated.
`;
}