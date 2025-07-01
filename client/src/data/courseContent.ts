// Financial Literacy Course Content
// This file contains the complete course structure based on translation files

export interface ContentItem {
  id: string;
  type: "text" | "example" | "tip" | "warning" | "scenario" | "interactive" | "tool" | "challenge";
  title: string;
  content: string;
}

export interface Tab {
  id: string;
  title: string;
  icon: string;
  content: ContentItem[];
}

export interface Exercise {
  id: string;
  type: "multiple-choice" | "true-false" | "drag-drop" | "scenario" | "matching" | "calculator";
  title: string;
  description: string;
  question?: string;
  options?: string[];
  correctAnswer?: string | number;
  explanation?: string;
  feedback?: {
    correct: string;
    incorrect: string;
  };
  questions?: Array<{
    id: string;
    text: string;
    type?: string;
    options?: string[];
    points?: number;
  }>;
}

export interface Level {
  id: string;
  title: string;
  description: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  estimatedTime: string;
  xpReward: number;
  learningObjectives: string[];
  tabs: Tab[];
  exercises?: Exercise[];
}

export interface Course {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  estimatedTime: string;
  xpReward: number;
  unlockLevel: number;
  totalLevels: number;
  levels: Level[];
}

// Type aliases for compatibility with Courses.tsx
export type CourseModule = Course;
export type CourseLevel = Level;
export type ContentBlock = ContentItem;

export const COURSE_CONTENT: Course[] = [
  {
    id: "cashflow-mastery",
    title: "Cash Flow Mastery",
    description: "Master the art of money management with advanced budgeting and cash flow systems",
    category: "Financial Management",
    difficulty: "Beginner",
    estimatedTime: "60 minutes",
    xpReward: 300,
    unlockLevel: 1,
    totalLevels: 6,
    levels: [
      {
        id: "cashflow-level-1",
        title: "💡 Welcome & The Power of Cash Flow Awareness",
        description: "Discover how cash flow awareness gives you control over your financial life",
        difficulty: "Beginner",
        estimatedTime: "10 minutes",
        xpReward: 50,
        learningObjectives: [
          "Understand what cash flow is and why it matters",
          "Recognize how tracking cash flow helps you spot financial leaks",
          "Develop awareness of your current financial situation"
        ],
        tabs: [
          {
            id: "cash-flow-basics",
            title: "Cash Flow Basics",
            icon: "💰",
            content: [
              {
                id: "what-is-cash-flow",
                type: "text",
                title: "💰 What is Cash Flow?",
                content: "Cash flow is the lifeblood of your finances. Simply put, it's money coming in (income) and money going out (expenses) over a specific period.\n\nThink of it like a river:\n• **Money FLOWING IN** = tributaries feeding the river (salary, side gigs, investments)\n• **Money FLOWING OUT** = water flowing downstream (rent, groceries, entertainment)\n• **Cash Flow** = the net result of this flow\n\nWhen more money flows in than out, you have positive cash flow. When more flows out than in, you have negative cash flow - and that's when financial stress begins."
              },
              {
                id: "alex-case-study",
                type: "example",
                title: "🎯 Case Study: Alex's $200 Monthly Discovery",
                content: "Meet Alex, a 28-year-old marketing professional earning $4,500 per month. Alex always felt broke despite having a decent salary.\n\n**The Problem:** Alex had no idea where the money was going.\n\n**The Solution:** Alex spent 30 minutes reviewing bank statements and discovered:\n• Netflix: $15/month ✓ (still using it)\n• Spotify: $10/month ✓ (still using it)\n• Adobe Creative: $53/month ❌ (hadn't used it in 8 months)\n• Gym membership: $89/month ❌ (went once a month)\n• Food delivery apps: $312/month ❌ (ordering 4-5 times per week)\n\n**The Result:** By canceling unused subscriptions and cooking 3 more meals per week, Alex freed up $200 per month - that's $2,400 per year!\n\n**Alex's Words:** \"I couldn't believe I was throwing away $200 every month. Now that money goes straight to my emergency fund.\""
              },
              {
                id: "cash-flow-diagram",
                type: "tool",
                title: "📊 Your Cash Flow Pipeline",
                content: "**VISUAL: Cash Flow Pipeline**\n\n```\nINCOME SOURCES        CASH FLOW           EXPENSE CATEGORIES\n                      PIPELINE\n💼 Salary         ──┐                    ┌── 🏠 Housing\n💰 Side Work      ──┤                    ├── 🚗 Transportation\n📈 Investments    ──┤       💰💰💰       ├── 🍕 Food\n🎁 Other Income   ──┘                    ├── 💊 Health\n                                         ├── 🎮 Entertainment\n                                         └── 💳 Debt Payments\n```\n\n**The Pipeline Shows:**\n• **Width** = Amount of money\n• **Color** = Type of category\n• **Flow Direction** = Where your money goes\n\n**Key Insight:** Most people focus on the income side but ignore the expense side. True cash flow mastery requires optimizing BOTH sides of the pipeline."
              }
            ]
          }
        ],
        exercises: [
          {
            id: "cash-flow-reflection",
            type: "true-false",
            title: "Cash Flow Understanding Check",
            description: "Test your understanding of cash flow basics",
            question: "Cash flow is only about tracking income, not expenses.",
            correctAnswer: "false",
            explanation: "Cash flow tracks both money coming in (income) AND money going out (expenses). You need to monitor both sides to understand your complete financial picture.",
            feedback: {
              correct: "🎯 Correct! Cash flow is about both income AND expenses - the complete picture of your money movement.",
              incorrect: "Cash flow includes both income and expenses. It's the complete picture of money flowing in and out of your life."
            }
          }
        ]
      },
      {
        id: "cashflow-level-2",
        title: "🔍 Income Source Identification and Mapping",
        description: "Learn to identify every income source, including hidden earnings",
        difficulty: "Beginner",
        estimatedTime: "15 minutes",
        xpReward: 50,
        learningObjectives: [
          "Map all your current income sources completely",
          "Discover hidden income streams you may have overlooked",
          "Learn strategies to optimize existing income sources"
        ],
        tabs: [
          {
            id: "income-mapping",
            title: "Income Mapping",
            icon: "🔍",
            content: [
              {
                id: "income-categories",
                type: "text",
                title: "🔍 The Complete Income Map",
                content: "**PRIMARY INCOME SOURCES (The Obvious Ones):**\n• 💼 Salary or wages from your job\n• 🏢 Business or freelance income\n• 📈 Investment returns (dividends, interest)\n• 🏠 Rental income from properties\n• 💰 Pension or retirement income\n\n**HIDDEN INCOME SOURCES (Often Forgotten):**\n• 💳 Credit card cashback and rewards\n• 🎁 Tax refunds (average $2,800 annually)\n• 👨‍👩‍👧‍👦 Gifts from family or friends\n• 📦 Money from selling unused items\n• 🚗 Gig economy earnings (Uber, DoorDash)\n• 📱 App-based income (surveys, cashback apps)\n• 🔄 Refunds from canceled subscriptions\n• 🛡️ Insurance claim payouts\n• 🎓 Scholarship or grant money\n• 💼 Side consulting or tutoring\n\n**INCOME AUDIT CHECKLIST:**\n□ Review last 3 months of bank statements\n□ Check all deposit sources\n□ Include one-time payments\n□ Count irregular income\n□ Don't forget cash payments\n□ Include bartering or trade value"
              },
              {
                id: "income-optimization",
                type: "interactive",
                title: "🚀 Income Optimization Strategies",
                content: "**MAXIMIZE YOUR PRIMARY INCOME:**\n\n1. **Annual Salary Review:**\n   • Research market rates for your position\n   • Document your achievements and quantify results\n   • Schedule regular check-ins with your manager\n   • Present a clear case with specific numbers\n\n2. **Skill Development ROI:**\n   • Identify high-value skills in your industry\n   • Calculate potential income increase per skill\n   • Invest in certifications that employers value\n   • Track completion rates and apply immediately\n\n3. **Performance Metrics:**\n   • Exceed targets by 10-20% consistently\n   • Take on additional responsibilities\n   • Mentor junior team members\n   • Lead cross-functional projects\n\n**ACTIVATE HIDDEN INCOME SOURCES:**\n\n• **Credit Card Optimization:** Switch to cards with 2-5% cashback in your top spending categories\n• **Tax Strategy:** Contribute to 401k/IRA to increase refund potential\n• **Cashback Apps:** Use Rakuten, Honey, Capital One Shopping for all online purchases\n• **Selling Strategy:** List unused items on Facebook Marketplace, eBay, or Poshmark\n• **Referral Programs:** Leverage employer, bank, and service referral bonuses"
              }
            ]
          }
        ]
      },
      {
        id: "cashflow-level-3",
        title: "⚖️ Active vs. Passive Income",
        description: "Understand the key differences between active and passive income",
        difficulty: "Intermediate",
        estimatedTime: "12 minutes",
        xpReward: 50,
        learningObjectives: [
          "Distinguish between active and passive income types",
          "Learn the transition strategy from active to passive income",
          "Understand the wealth-building power of passive income"
        ],
        tabs: [
          {
            id: "active-vs-passive",
            title: "Active vs Passive",
            icon: "⚖️",
            content: [
              {
                id: "active-vs-passive-breakdown",
                type: "text",
                title: "⚡ Active vs Passive Income Mastery",
                content: "**ACTIVE INCOME (Trade Time for Money):**\n• Salary from employment\n• Freelance project payments\n• Consulting fees\n• Service-based business income\n• Commission-based sales\n\n**Characteristics:**\n✓ Immediate and predictable\n✓ Higher control over income timing\n✗ Limited by hours available\n✗ Income stops when you stop working\n\n**PASSIVE INCOME (Money Works for You):**\n• Dividend-paying stocks\n• Rental property income\n• Royalties from intellectual property\n• Interest from high-yield savings\n• Peer-to-peer lending returns\n\n**Characteristics:**\n✓ Generates income while you sleep\n✓ Scalable without trading more time\n✗ Requires upfront investment or work\n✗ May take time to generate significant income\n\n**THE TRANSITION STRATEGY:**\n\n**Phase 1 (Months 1-6):** Optimize Active Income\n• Negotiate salary increase\n• Develop high-value skills\n• Take on profitable side projects\n• Save 20-30% of increased income\n\n**Phase 2 (Months 7-18):** Build Passive Foundation\n• Invest saved money in dividend ETFs\n• Research real estate investment options\n• Create digital products or courses\n• Explore peer-to-peer lending\n\n**Phase 3 (18+ Months):** Scale Passive Streams\n• Reinvest passive income returns\n• Add new income streams quarterly\n• Automate income collection processes\n• Track passive income growth vs active income"
              }
            ]
          }
        ]
      },
      {
        id: "cashflow-level-4",
        title: "🤖 Automating Income Tracking",
        description: "Set up automated systems to track income and expenses efficiently",
        difficulty: "Intermediate",
        estimatedTime: "15 minutes",
        xpReward: 50,
        learningObjectives: [
          "Set up automated income and expense tracking systems",
          "Learn the 'set and forget' automation philosophy",
          "Build systems that manage cash flow without daily intervention"
        ],
        tabs: [
          {
            id: "automation-tools",
            title: "Automation Tools",
            icon: "🤖",
            content: [
              {
                id: "automation-mastery",
                type: "tool",
                title: "🤖 Cash Flow Automation Mastery",
                content: "**AUTOMATED INCOME COLLECTION:**\n\n1. **Direct Deposit Optimization:**\n   • Set up automatic salary splits: 70% checking, 20% savings, 10% investment\n   • Configure automatic retirement contributions (increase by 1% annually)\n   • Enable automatic tax refund direct deposit to high-yield savings\n\n2. **Investment Automation:**\n   • Dollar-cost averaging into index funds ($500/month)\n   • Automatic dividend reinvestment (DRIP)\n   • Round-up investing apps (Acorns, Stash) for spare change\n   • Automatic rebalancing quarterly\n\n3. **Passive Income Automation:**\n   • High-yield savings account with automatic transfers\n   • CD laddering with automatic renewals\n   • Automatic rent collection via property management software\n   • Royalty collection through automated licensing platforms\n\n**AUTOMATED EXPENSE MANAGEMENT:**\n\n1. **Bill Automation:**\n   • All fixed expenses on autopay (rent, utilities, insurance)\n   • Credit cards on autopay (full balance to avoid interest)\n   • Subscription management tools (Truebill, Honey) to cancel unused services\n   • Annual insurance reviews with automatic renewal alerts\n\n2. **Smart Spending Controls:**\n   • Banking alerts for spending over $100\n   • Daily spending limit notifications\n   • Automatic savings when spending goals are met\n   • Freeze cards for specific merchant categories\n\n**THE 'SET AND FORGET' CASH FLOW SYSTEM:**\n\n**Week 1:** Set up income automation\n**Week 2:** Automate fixed expenses\n**Week 3:** Configure investment automation\n**Week 4:** Implement spending controls\n\n**Monthly Review (15 minutes):**\n• Check automated savings progress\n• Review expense categories for optimization\n• Adjust automatic transfer amounts\n• Verify all automations are working correctly"
              }
            ]
          }
        ]
      },
      {
        id: "cashflow-level-5",
        title: "🚀 Strategies to Boost Income by 20-50%",
        description: "Learn actionable strategies to significantly increase your income within 12 months",
        difficulty: "Advanced",
        estimatedTime: "20 minutes",
        xpReward: 50,
        learningObjectives: [
          "Master salary negotiation techniques",
          "Learn high-ROI side hustle strategies",
          "Understand how to scale income systematically"
        ],
        tabs: [
          {
            id: "salary-negotiation",
            title: "Salary Negotiation",
            icon: "💰",
            content: [
              {
                id: "salary-negotiation-mastery",
                type: "text",
                title: "💰 Salary Negotiation Mastery",
                content: "**PREPARATION PHASE (4-6 weeks before negotiation):**\n\n1. **Market Research:**\n   • Use Glassdoor, PayScale, Salary.com for salary ranges\n   • Network with industry contacts for insider information\n   • Factor in location cost-of-living adjustments\n   • Research total compensation (benefits, bonuses, equity)\n\n2. **Value Documentation:**\n   • Quantify achievements with specific numbers and percentages\n   • List new skills acquired and certifications earned\n   • Document additional responsibilities taken on\n   • Gather positive feedback from clients/colleagues\n\n3. **Timing Strategy:**\n   • Schedule after successful project completion\n   • Avoid busy periods or company financial stress\n   • Allow 2-3 weeks after annual reviews\n   • Consider fiscal year budget planning cycles\n\n**NEGOTIATION EXECUTION:**\n\n**Opening Statement:**\n'Based on my research and performance over the past year, I'd like to discuss adjusting my compensation to better reflect my current contributions and market value.'\n\n**Key Talking Points:**\n• Specific accomplishments with measurable results\n• Additional value you bring beyond job description\n• Market research supporting your request\n• Future commitment and growth plans\n\n**Negotiation Tactics:**\n• Start 10-20% above your target to allow negotiation room\n• Consider total package, not just base salary\n• Be prepared to negotiate start date for increases\n• Have backup options (additional PTO, professional development budget)\n\n**ALTERNATIVE INCOME BOOST STRATEGIES:**\n\n1. **Side Hustle Scaling:**\n   • Freelance in your expertise area (2-5 hours/week = $500-2000/month)\n   • Online tutoring or coaching ($30-100/hour)\n   • Digital product creation (courses, templates)\n   • Affiliate marketing in your network\n\n2. **Skill-Based Income:**\n   • High-demand certifications (Google Ads, Salesforce, AWS)\n   • Language skills for translation work\n   • Technical writing for businesses\n   • Social media management for small businesses"
              }
            ]
          },
          {
            id: "side-hustles",
            title: "Side Hustles",
            icon: "🚀",
            content: [
              {
                id: "side-hustle-optimization",
                type: "interactive",
                title: "🚀 Side Hustle Revenue Optimization",
                content: "**HIGH-ROI SIDE HUSTLES BY TIME INVESTMENT:**\n\n**1-3 Hours/Week ($200-800/month):**\n• Food delivery driving during peak hours\n• Online tutoring in your expertise\n• Social media management for 2-3 small businesses\n• Virtual assistant services\n• Stock photography submissions\n\n**5-10 Hours/Week ($800-2500/month):**\n• Freelance writing or graphic design\n• Online course creation\n• Drop-shipping or e-commerce\n• Pet sitting/dog walking in affluent neighborhoods\n• Bookkeeping for small businesses\n\n**10+ Hours/Week ($2500+/month):**\n• Consulting in your professional field\n• Real estate investing (flipping or rentals)\n• YouTube channel or podcast monetization\n• SaaS product development\n• Local service business (cleaning, handyman)\n\n**SIDE HUSTLE SUCCESS FRAMEWORK:**\n\n**Phase 1: MVP (Minimum Viable Product)**\n• Start with skills you already have\n• Test market demand with 5-10 potential customers\n• Price low initially to gain testimonials\n• Perfect your service delivery process\n\n**Phase 2: Scale and Systematize**\n• Raise prices based on demand\n• Create templates and processes\n• Outsource repetitive tasks\n• Build recurring revenue streams\n\n**Phase 3: Automate or Exit**\n• Build systems that run without you\n• Hire team members or virtual assistants\n• Consider selling the business\n• Reinvest profits into passive income streams\n\n**MONTHLY OPTIMIZATION CHECKLIST:**\n□ Track time spent vs income generated\n□ Analyze which activities generate highest ROI\n□ Eliminate low-value tasks\n□ Reinvest profits strategically\n□ Test one new income stream quarterly"
              }
            ]
          }
        ]
      },
      {
        id: "cashflow-level-6",
        title: "📋 Create Your Personalized Cash Flow Plan",
        description: "Bring everything together into a comprehensive 12-month cash flow plan",
        difficulty: "Advanced",
        estimatedTime: "25 minutes",
        xpReward: 50,
        learningObjectives: [
          "Create a comprehensive 12-month cash flow action plan",
          "Set quarterly milestones and review checkpoints",
          "Build systems for long-term cash flow optimization"
        ],
        tabs: [
          {
            id: "plan-creation",
            title: "Your Plan",
            icon: "📋",
            content: [
              {
                id: "annual-action-plan",
                type: "tool",
                title: "📋 Your 12-Month Cash Flow Action Plan",
                content: "**MONTH 1-3: FOUNDATION BUILDING**\n\n**Income Foundation:**\n• Complete comprehensive income audit\n• Set up automated savings transfers\n• Research salary negotiation timing\n• Identify 3 potential side hustle opportunities\n\n**Expense Foundation:**\n• Track all expenses for 30 days\n• Cancel unused subscriptions and services\n• Automate all fixed expenses\n• Set up spending alerts and limits\n\n**Key Metrics:**\n• Monthly savings rate: 20%\n• Emergency fund: $1,000\n• Subscription audit savings: $100+/month\n\n**MONTH 4-6: OPTIMIZATION PHASE**\n\n**Income Growth:**\n• Launch first side hustle\n• Schedule salary negotiation meeting\n• Begin skill development for income boost\n• Optimize credit card rewards strategy\n\n**Cash Flow Automation:**\n• Implement full automation system\n• Set up investment account with auto-transfers\n• Create expense category budgets\n• Establish monthly financial review routine\n\n**Key Metrics:**\n• Side hustle income: $500+/month\n• Automated investment: $300+/month\n• Emergency fund: $3,000\n• Positive cash flow: $800+/month\n\n**MONTH 7-9: ACCELERATION PHASE**\n\n**Multiple Income Streams:**\n• Scale successful side hustle\n• Launch second income stream\n• Invest in skill development courses\n• Network for opportunities\n\n**Investment Building:**\n• Increase investment contributions by 25%\n• Research real estate opportunities\n• Consider peer-to-peer lending\n• Build dividend-focused portfolio\n\n**Key Metrics:**\n• Total monthly income increase: 30%\n• Investment portfolio: $5,000+\n• Emergency fund: 6 months expenses\n• Net worth growth: $10,000+\n\n**MONTH 10-12: MASTERY PHASE**\n\n**Advanced Strategies:**\n• Implement tax optimization strategies\n• Consider real estate investment\n• Build passive income to $500+/month\n• Create systems for long-term wealth building\n\n**Wealth Building:**\n• Diversify investment portfolio\n• Explore business acquisition opportunities\n• Set up estate planning basics\n• Plan next year's financial goals\n\n**Key Metrics:**\n• Total income increase: 50%+\n• Passive income: $500+/month\n• Net worth: $25,000+ increase\n• Financial independence timeline: Clear path\n\n**QUARTERLY REVIEW CHECKPOINTS:**\n\n**Q1 Review:**\n□ Emergency fund fully funded?\n□ Automation systems working?\n□ Side hustle generating income?\n□ Expense optimization complete?\n\n**Q2 Review:**\n□ Salary negotiation completed?\n□ Investment strategy implemented?\n□ Second income stream launched?\n□ Financial goals on track?\n\n**Q3 Review:**\n□ Income growth targets met?\n□ Passive income developing?\n□ Investment portfolio diversified?\n□ Tax optimization implemented?\n\n**Q4 Review:**\n□ Annual financial goals achieved?\n□ Next year's plan developed?\n□ Wealth building accelerated?\n□ Financial independence timeline updated?"
              }
            ]
          }
        ]
      }
    ]
  }
];