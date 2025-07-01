// Financial Literacy Course Content
// Comprehensive educational material with interactive exercises

export interface ContentBlock {
  id: string;
  type: 'text' | 'example' | 'tip' | 'warning' | 'visual' | 'step';
  title?: string;
  content: string;
  visual?: {
    type: 'chart' | 'illustration' | 'comparison';
    data: any;
  };
}

export interface Exercise {
  id: string;
  type: 'multiple-choice' | 'drag-drop' | 'true-false' | 'matching' | 'scenario';
  question: string;
  explanation?: string;
  options?: string[];
  correctAnswer: string | string[];
  feedback: {
    correct: string;
    incorrect: string;
  };
  points: number;
}

export interface TabSection {
  id: string;
  title: string;
  icon: string;
  content: ContentBlock[];
  calculator?: Calculator;
}

export interface Calculator {
  type: "income" | "budget" | "expense" | "savings" | "debt" | "cashflow";
  title: string;
  description: string;
  fields: CalculatorField[];
}

export interface CalculatorField {
  id: string;
  label: string;
  type: "number" | "select" | "percentage";
  placeholder?: string;
  options?: string[];
  required: boolean;
}

export interface CourseLevel {
  id: string;
  moduleId: string;
  levelNumber: number;
  title: string;
  description: string;
  xpReward: number;
  learningObjectives: string[];
  content: ContentBlock[];
  tabs?: TabSection[];
  exercises: Exercise[];
}

export interface CourseModule {
  id: string;
  title: string;
  description: string;
  icon: string;
  totalLevels: number;
  estimatedTime: string;
  levels: CourseLevel[];
}

export const COURSE_CONTENT: CourseModule[] = [
  {
    id: "budgeting-basics",
    title: "Budgeting Basics",
    description: "Master the fundamentals of managing your money effectively",
    icon: "Calculator",
    totalLevels: 3,
    estimatedTime: "25 minutes",
    levels: [
      {
        id: "budgeting-1",
        moduleId: "budgeting-basics",
        levelNumber: 1,
        title: "Understanding Income vs Expenses",
        description: "Learn to identify and categorize your money flow",
        xpReward: 15,
        learningObjectives: [
          "Distinguish between income and expenses",
          "Categorize different types of expenses",
          "Calculate basic cash flow"
        ],
        content: [
          {
            id: "welcome-intro",
            type: "text",
            title: "Welcome to Financial Freedom!",
            content: "You're about to learn the most important financial skill: budgeting. Think of budgeting as your money's GPS - it tells every dollar where to go so you reach your financial destination. By the end of this lesson, you'll know exactly how money flows in and out of your life."
          }
        ],
        tabs: [
          {
            id: "income-basics",
            title: "Income Tracking",
            icon: "💰",
            content: [
              {
                id: "income-deep-dive",
                type: "text",
                title: "Income: Your Financial Fuel",
                content: "Income is ANY money that flows into your accounts. Most people think only about their main job, but successful budgeters track ALL income sources. This includes your salary, freelance work, investment returns, gifts, refunds, cashback rewards, and even that $20 you found in your old jacket!"
              },
              {
                id: "income-types",
                type: "visual",
                title: "Types of Income Sources",
                content: "Discover all the ways money can flow into your life:",
                visual: {
                  type: "comparison",
                  data: {
                    regular: ["💼 Job Salary", "💻 Freelance Work", "🏠 Rental Income", "📈 Investment Dividends"],
                    irregular: ["🎁 Gifts & Bonuses", "💳 Cashback Rewards", "📱 App Earnings", "🔄 Refunds & Returns"]
                  }
                }
              }
            ],
            calculator: {
              type: "income",
              title: "Monthly Income Calculator",
              description: "Calculate your total monthly income from all sources",
              fields: [
                { id: "salary", label: "Monthly Salary", type: "number", placeholder: "4000", required: true },
                { id: "freelance", label: "Freelance Income", type: "number", placeholder: "500", required: false },
                { id: "dividends", label: "Investment Dividends", type: "number", placeholder: "75", required: false },
                { id: "rental", label: "Rental Income", type: "number", placeholder: "200", required: false },
                { id: "cashback", label: "Cashback & Rewards", type: "number", placeholder: "25", required: false },
                { id: "other", label: "Other Income", type: "number", placeholder: "0", required: false }
              ]
            }
          },
          {
            id: "expense-basics",
            title: "Expense Categories",
            icon: "💸",
            content: [
              {
                id: "expense-categories-deep",
                type: "text",
                title: "Expenses: Where Your Money Goes",
                content: "Every expense falls into two categories: FIXED (same amount monthly) or VARIABLE (changes monthly). Knowing the difference is crucial because you can't easily change fixed expenses, but you have control over variable ones."
              },
              {
                id: "expense-breakdown",
                type: "visual",
                title: "🏠 The Expense House",
                content: "Think of your expenses like a house with different rooms. Fixed expenses are like the foundation - stable but hard to change. Variable expenses are like the furniture - you can rearrange them!",
                visual: {
                  type: "comparison",
                  data: {
                    foundation_fixed: [
                      "🏠 Rent/Mortgage: $1,400",
                      "📱 Phone Plan: $85",
                      "🚗 Car Payment: $320",
                      "💊 Insurance: $180",
                      "🎓 Student Loan: $250"
                    ],
                    flexible_variable: [
                      "🛒 Groceries: $300-500",
                      "⛽ Gas: $80-150",
                      "🍿 Entertainment: $100-400",
                      "👕 Clothing: $50-200",
                      "🍕 Dining Out: $150-350"
                    ]
                  }
                }
              }
            ],
            calculator: {
              type: "expense",
              title: "Monthly Expense Calculator",
              description: "Track your fixed and variable expenses",
              fields: [
                { id: "housing", label: "Housing (Rent/Mortgage)", type: "number", placeholder: "1400", required: true },
                { id: "utilities", label: "Utilities", type: "number", placeholder: "150", required: true },
                { id: "phone", label: "Phone Plan", type: "number", placeholder: "85", required: true },
                { id: "insurance", label: "Insurance", type: "number", placeholder: "180", required: true },
                { id: "groceries", label: "Groceries", type: "number", placeholder: "400", required: true },
                { id: "transportation", label: "Transportation", type: "number", placeholder: "300", required: true },
                { id: "entertainment", label: "Entertainment", type: "number", placeholder: "200", required: false },
                { id: "dining", label: "Dining Out", type: "number", placeholder: "250", required: false }
              ]
            }
          },
          {
            id: "cashflow-analysis",
            title: "Cash Flow Analysis",
            icon: "📊",
            content: [
              {
                id: "cash-flow-game",
                type: "example",
                title: "🎮 The Cash Flow Game",
                content: "Let's play with real numbers! Follow Sam's monthly journey:\n\n💰 INCOME: $3,800\n📊 FIXED EXPENSES: $2,100\n📈 VARIABLE EXPENSES: $1,200\n\n🧮 THE MATH:\n$3,800 (income) - $3,300 (total expenses) = +$500 (positive cash flow)\n\n🎉 RESULT: Sam saves $500 monthly! That's $6,000 per year toward goals!"
              },
              {
                id: "danger-signs",
                type: "warning",
                title: "⚠️ Red Flag Warning Signs",
                content: "DANGER ZONE: If your expenses exceed income, you're in negative cash flow. Warning signs: Using credit cards for basic needs, borrowing money monthly, avoiding bank statements, stress about money every week. If this sounds familiar, don't panic - this course will help you fix it!"
              }
            ],
            calculator: {
              type: "cashflow",
              title: "Cash Flow Calculator",
              description: "Calculate your monthly cash flow and see if you're saving or overspending",
              fields: [
                { id: "total_income", label: "Total Monthly Income", type: "number", placeholder: "4000", required: true },
                { id: "fixed_expenses", label: "Total Fixed Expenses", type: "number", placeholder: "2100", required: true },
                { id: "variable_expenses", label: "Total Variable Expenses", type: "number", placeholder: "1200", required: true }
              ]
            }
          }
        ],
        exercises: [
          {
            id: "income-detective-exercise",
            type: "multiple-choice",
            question: "Sarah discovers she has more income sources than she thought! Besides her $4,000 monthly salary, she found $25 in cashback rewards, $50 in dividends, and $200 from her spare room rental. What's her TOTAL monthly income?",
            options: ["$4,000", "$4,075", "$4,275", "$4,325"],
            correctAnswer: "$4,275",
            explanation: "Total income = $4,000 (salary) + $25 (cashback) + $50 (dividends) + $200 (rental) = $4,275. Every dollar counts!",
            feedback: {
              correct: "Perfect! You tracked ALL income sources like a financial detective!",
              incorrect: "Don't forget to include ALL income sources - salary, cashback, dividends, and rental income."
            },
            points: 15
          },
          {
            id: "expense-categorization-challenge",
            type: "multiple-choice",
            question: "Which expense would give you the MOST control to reduce if you needed to save money quickly?",
            options: ["Rent ($1,200/month)", "Student loan payment ($250/month)", "Dining out ($300/month)", "Car insurance ($120/month)"],
            correctAnswer: "Dining out ($300/month)",
            explanation: "Dining out is a variable expense you control daily. Fixed expenses like rent, loans, and insurance are harder to change quickly.",
            feedback: {
              correct: "Smart thinking! Variable expenses give you immediate control over your spending.",
              incorrect: "Look for the variable expense - something you can control day-to-day, not fixed contracts."
            },
            points: 15
          },
          {
            id: "cash-flow-scenario",
            type: "multiple-choice",
            question: "Jordan has $3,800 income, $2,100 fixed expenses, and $1,200 variable expenses. They want to save $6,000 for a vacation in 12 months. What should they do?",
            options: [
              "Impossible - they're already at $0 cash flow",
              "Cut variable expenses by $100/month to save $500/month",
              "Get a second job - their current budget is maxed out",
              "Use credit cards for the vacation"
            ],
            correctAnswer: "Cut variable expenses by $100/month to save $500/month",
            explanation: "Current cash flow: $3,800 - $3,300 = $500/month. They need $6,000 ÷ 12 = $500/month. They're already there! Or cut $100 in variables for extra buffer.",
            feedback: {
              correct: "Excellent math! You calculated their current cash flow and vacation savings goal perfectly.",
              incorrect: "Calculate their current cash flow first: Income - Total Expenses. Then compare to their savings goal."
            },
            points: 20
          },
          {
            id: "money-flow-mastery",
            type: "multiple-choice",
            question: "Using the 'Money Flow' concept from the lesson, which strategy would have the BIGGEST impact on building wealth?",
            options: [
              "Focus only on increasing income (bigger inflow)",
              "Focus only on cutting expenses (smaller outflow)",
              "Increase income by $200 AND cut expenses by $200",
              "Wait until you earn more to start managing money flow"
            ],
            correctAnswer: "Increase income by $200 AND cut expenses by $200",
            explanation: "The combined approach gives you $400 more monthly cash flow ($4,800/year)! Managing both sides of the money flow equation maximizes wealth building.",
            feedback: {
              correct: "Brilliant! You understand that managing both inflow AND outflow creates the biggest wealth-building impact.",
              incorrect: "Think about the total impact on cash flow. What happens when you improve BOTH sides of the money flow equation?"
            },
            points: 20
          },
          {
            id: "financial-awareness-challenge",
            type: "multiple-choice",
            question: "Based on the lesson's 'surprise spending' examples, what's the MOST effective first step to take control of your finances?",
            options: [
              "Immediately cut all fun spending",
              "Track every expense for 7 days to find surprise spending",
              "Set up a complicated budget with 20 categories",
              "Focus only on big expenses like rent"
            ],
            correctAnswer: "Track every expense for 7 days to find surprise spending",
            explanation: "Awareness comes before control! Like Jordan's $539 in surprise spending, you can't manage what you don't measure. Track first, then optimize.",
            feedback: {
              correct: "Perfect! You understand that financial awareness is the foundation of financial control.",
              incorrect: "Remember the lesson about becoming an 'expense detective' - you need to see where money goes before you can control it."
            },
            points: 15
          }
        ]
      },
      {
        id: "budgeting-2",
        moduleId: "budgeting-basics",
        levelNumber: 2,
        title: "Creating Your First Budget",
        description: "Build a practical budget that actually works",
        xpReward: 20,
        learningObjectives: [
          "Learn the 50/30/20 budgeting rule",
          "Create budget categories that work for you",
          "Set realistic spending limits"
        ],
        content: [
          {
            id: "budget-revolution",
            type: "text",
            title: "🚀 The Budget Revolution Starts Here!",
            content: "Forget everything you think you know about budgeting. We're not talking about restricting your life - we're talking about DESIGNING your life! A budget is your financial blueprint that transforms chaos into control, stress into confidence, and dreams into achievable goals."
          },
          {
            id: "budget-myths",
            type: "warning",
            title: "💥 Budget Myths That Keep People Broke",
            content: "MYTH 1: 'Budgets are restrictive' → TRUTH: Budgets give you permission to spend guilt-free!\nMYTH 2: 'Budgets are complicated' → TRUTH: Start with 3 simple categories!\nMYTH 3: 'I don't make enough to budget' → TRUTH: The less you make, the MORE you need a budget!\nMYTH 4: 'Budgets are boring' → TRUTH: Budgets are your ticket to freedom!"
          },
          {
            id: "50-30-20-masterclass",
            type: "visual",
            title: "🎯 The 50/30/20 Rule: Your Financial Foundation",
            content: "This isn't just a rule - it's a lifestyle framework used by millions of successful people worldwide. Here's how to make it work for YOU:",
            visual: {
              type: "chart",
              data: {
                needs_50: {
                  percentage: 50,
                  description: "NEEDS (Survival)",
                  examples: ["🏠 Housing", "🍎 Groceries", "⚡ Utilities", "🚗 Transportation", "📱 Phone"],
                  rule: "If you can't live without it for 30 days, it's a need"
                },
                wants_30: {
                  percentage: 30,
                  description: "WANTS (Lifestyle)",
                  examples: ["🍕 Dining Out", "🎬 Entertainment", "☕ Coffee Shops", "👕 Shopping", "🎮 Hobbies"],
                  rule: "Everything that makes life enjoyable but isn't essential"
                },
                savings_20: {
                  percentage: 20,
                  description: "SAVINGS & DEBT (Future You)",
                  examples: ["💰 Emergency Fund", "🏖️ Vacation Fund", "💳 Debt Payments", "📈 Investments", "🎯 Goals"],
                  rule: "Pay your future self first - this is non-negotiable!"
                }
              }
            }
          },
          {
            id: "budget-builder-interactive",
            type: "example",
            title: "🛠️ Interactive Budget Builder",
            content: "Let's build Maya's budget step-by-step!\n\n💼 MAYA'S SITUATION:\n• Monthly Income: $4,500\n• Age: 26, Marketing Manager\n• Goal: Save for apartment down payment\n\n📊 APPLYING 50/30/20:\n🏠 NEEDS (50% = $2,250):\n• Rent: $1,400\n• Groceries: $350\n• Utilities: $150\n• Phone: $75\n• Car Insurance: $125\n• Gas: $150\n\n🎯 WANTS (30% = $1,350):\n• Restaurants: $400\n• Entertainment: $300\n• Gym: $50\n• Coffee/Treats: $200\n• Shopping: $250\n• Miscellaneous: $150\n\n💰 SAVINGS (20% = $900):\n• Emergency Fund: $300\n• Down Payment: $400\n• Retirement: $200\n\n✨ RESULT: Balanced life + $4,800/year toward apartment!"
          },
          {
            id: "customization-guide",
            type: "step",
            title: "🎨 Customize Your Budget Like a Pro",
            content: "The 50/30/20 rule is your starting point, not your prison! Here's how to adapt it:\n\n📈 HIGH EARNERS: Try 50/20/30 (more savings)\n🏠 HIGH RENT AREAS: Try 60/25/15 (temporarily)\n💸 DEBT PAYOFF MODE: Try 50/20/30 (extra to debt)\n🎓 STUDENTS: Try 70/20/10 (survival mode)\n\n🔑 THE GOLDEN RULES:\n1. Needs should never exceed 60%\n2. Always save SOMETHING (even $25)\n3. Track for 3 months before major changes\n4. Adjust monthly based on reality"
          },
          {
            id: "budgeting-tools",
            type: "tip",
            title: "🔧 Modern Budgeting Tools (Choose Your Weapon!)",
            content: "📱 SMARTPHONE APPS:\n• Mint (Free, automatic tracking)\n• YNAB (You Need A Budget - advanced)\n• EveryDollar (Dave Ramsey's app)\n\n📊 SPREADSHEETS:\n• Google Sheets (free templates)\n• Excel budget templates\n• Custom tracking sheets\n\n📝 OLD SCHOOL:\n• Pen and paper (surprisingly effective!)\n• Envelope method with cash\n• Bullet journal budgeting\n\n🎯 PRO TIP: The best budget is the one you'll actually use!"
          },
          {
            id: "budget-psychology",
            type: "text",
            title: "🧠 The Psychology of Successful Budgeting",
            content: "Your budget isn't just about math - it's about mindset! Successful budgeters think differently. They see a budget as permission to spend, not restriction. They automate what they can, and review what they must. They're not perfect, but they're consistent. Most importantly, they understand that budgeting is a skill that improves with practice."
          },
          {
            id: "first-budget-challenge",
            type: "example",
            title: "🏁 Your First Budget Challenge",
            content: "Ready to create your first budget? Here's your action plan:\n\n📋 WEEK 1: Track everything you spend (use your phone's notes app)\n📊 WEEK 2: Categorize last month's expenses into needs/wants\n🎯 WEEK 3: Apply 50/30/20 to your actual income\n🔄 WEEK 4: Adjust based on reality and set up tracking system\n\n🏆 REWARD: Once you complete this challenge, you'll have a working budget that fits YOUR life!"
          },
          {
            id: "common-mistakes",
            type: "warning",
            title: "⚠️ Budget Killers (Avoid These Traps!)",
            content: "🚫 PERFECTIONISM: Expecting to nail it immediately\n🚫 COMPLEXITY: Making 47 categories for everything\n🚫 INFLEXIBILITY: Never adjusting when life changes\n🚫 GUILT: Beating yourself up for overspending\n🚫 COMPARISON: Using someone else's budget percentages\n\n✅ INSTEAD: Start simple, be flexible, adjust monthly, celebrate progress!"
          }
        ],
        exercises: [
          {
            id: "budget-rule-exercise",
            type: "multiple-choice",
            question: "In the 50/30/20 rule, what percentage goes to wants?",
            options: ["50%", "30%", "20%", "70%"],
            correctAnswer: "30%",
            explanation: "The 50/30/20 rule allocates 30% of your income to wants (entertainment, dining out, hobbies).",
            feedback: {
              correct: "Right! 30% goes to wants - the fun stuff that makes life enjoyable.",
              incorrect: "Remember: 50% needs, 30% wants, 20% savings and debt payment."
            },
            points: 10
          },
          {
            id: "budget-category-exercise",
            type: "multiple-choice",
            question: "Which category does 'rent' belong to in the 50/30/20 rule?",
            options: ["Wants (30%)", "Needs (50%)", "Savings (20%)", "None of these"],
            correctAnswer: "Needs (50%)",
            explanation: "Rent is a necessity for shelter, so it goes in the Needs category (50%).",
            feedback: {
              correct: "Exactly! Rent is a basic need for housing.",
              incorrect: "Think about it: is rent something you need or want?"
            },
            points: 10
          },
          {
            id: "budget-calculation-exercise",
            type: "multiple-choice",
            question: "If you earn $5,000/month, how much should you save using the 50/30/20 rule?",
            options: ["$500", "$750", "$1,000", "$1,500"],
            correctAnswer: "$1,000",
            explanation: "20% of $5,000 = $1,000 should go to savings and debt payment.",
            feedback: {
              correct: "Perfect! $1,000 is 20% of $5,000 for savings.",
              incorrect: "Calculate 20% of $5,000. What's $5,000 × 0.20?"
            },
            points: 15
          }
        ]
      },
      {
        id: "budgeting-3",
        moduleId: "budgeting-basics",
        levelNumber: 3,
        title: "Budget Optimization Strategies",
        description: "Fine-tune your budget for maximum effectiveness",
        xpReward: 25,
        learningObjectives: [
          "Identify areas to cut expenses",
          "Prioritize spending based on values",
          "Adjust budget when life changes"
        ],
        content: [
          {
            id: "optimization-mindset",
            type: "text",
            title: "🎯 Welcome to Budget Mastery Level!",
            content: "You've mastered the basics, now it's time to become a budget optimization ninja! This isn't about cutting everything you enjoy - it's about getting MAXIMUM value from every dollar while still living the life you want. You're about to learn the advanced strategies that separate budget masters from budget beginners."
          },
          {
            id: "expense-detective",
            type: "example",
            title: "🕵️ Become an Expense Detective",
            content: "Time to investigate where your money REALLY goes! Meet Jordan's shocking discovery:\n\n📊 JORDAN'S MONTHLY INVESTIGATION:\n• Coffee shops: $127 (thought it was $50)\n• Subscription services: $89 (forgot half of them)\n• Impulse Amazon purchases: $156\n• Convenience store snacks: $73\n• Rideshare instead of walking: $94\n\n💰 TOTAL SURPRISE SPENDING: $539/month = $6,468/year!\n\nThat's a European vacation Jordan didn't know they were missing!"
          },
          {
            id: "audit-framework",
            type: "step",
            title: "🔍 The 7-Day Money Audit Challenge",
            content: "Transform into a financial detective with this systematic approach:\n\n📱 DAY 1-3: Track EVERYTHING\n• Use your phone to photograph every receipt\n• Note every digital transaction immediately\n• Include cash, cards, apps, subscriptions\n\n📊 DAY 4-5: Categorize & Analyze\n• Group expenses by type (coffee, subscriptions, etc.)\n• Calculate weekly totals for each category\n• Multiply by 4.3 to get monthly estimates\n\n🎯 DAY 6-7: Identify Patterns\n• When do you spend most? (stress, boredom, celebration?)\n• What triggers impulse purchases?\n• Which expenses surprised you most?\n\n🏆 RESULT: Complete money awareness in one week!"
          },
          {
            id: "cutting-strategies",
            type: "visual",
            title: "⚡ Smart Money-Saving Strategies",
            content: "Choose your optimization weapons based on your lifestyle:",
            visual: {
              type: "comparison",
              data: {
                easy_wins: [
                  "🔍 Subscription audit (save $50-200/month)",
                  "📞 Negotiate bills (save $30-100/month)",
                  "🍳 Cook 2 extra meals at home (save $80/month)",
                  "☕ Make coffee at home 3 days/week (save $60/month)",
                  "🚶 Walk/bike short trips (save $40/month)"
                ],
                lifestyle_changes: [
                  "🏠 House-sit for free accommodation",
                  "🚗 Car-share instead of owning",
                  "📚 Library for books/movies/events",
                  "🎯 Buy generic brands (save 20-40%)",
                  "🛒 Shop with lists (avoid impulse buys)"
                ],
                advanced_moves: [
                  "💳 Credit card rewards optimization",
                  "🏦 High-yield savings accounts",
                  "📱 Cashback apps and browser extensions",
                  "🎟️ Employee discounts and perks",
                  "💰 Side hustle for extra income"
                ]
              }
            }
          },
          {
            id: "value-based-spending",
            type: "tip",
            title: "💎 Value-Based Spending: The Secret Sauce",
            content: "Stop cutting randomly! Align spending with your core values:\n\n🎯 THE VALUE FILTER:\n1. List your top 5 life values (family, travel, health, etc.)\n2. Review each expense: 'Does this support my values?'\n3. CUT expenses that don't align\n4. INCREASE spending on value-aligned items\n\n✨ EXAMPLE: Love travel but buying daily lattes?\n• Cut lattes ($150/month) → Travel fund ($1,800/year)\n• Result: European trip funded by coffee shop redirected spending!"
          },
          {
            id: "negotiation-masterclass",
            type: "example",
            title: "💪 Bill Negotiation Masterclass",
            content: "Transform from bill accepter to bill negotiator!\n\n📞 THE NEGOTIATION SCRIPT:\n1. Research competitor prices first\n2. Call during weekday business hours\n3. Be polite but persistent\n4. Ask: 'What's the best rate you can offer?'\n5. Mention you're considering switching\n6. Ask for supervisor if needed\n\n🏆 SUCCESS STORIES:\n• Phone bill: $85 → $45 (saved $480/year)\n• Internet: $70 → $45 (saved $300/year)\n• Insurance: $150 → $110 (saved $480/year)\n• Credit card rate: 18% → 12% (saved hundreds)\n\n💡 PRO TIP: Call annually - companies offer new customer rates to retain you!"
          },
          {
            id: "automation-optimization",
            type: "step",
            title: "🤖 Automate Your Budget Optimization",
            content: "Set up systems that save money while you sleep:\n\n💰 AUTOMATIC SAVINGS INCREASES:\n• Auto-transfer raises (save 50% of any pay increase)\n• Round-up apps (save spare change automatically)\n• Weekly micro-transfers ($25 every Friday)\n\n📱 MONEY-SAVING APPS:\n• Honey/Capital One Shopping (coupon automation)\n• Rakuten (cashback on purchases)\n• Trim (cancels forgotten subscriptions)\n• Mint/YNAB (spending alerts)\n\n🔄 MONTHLY OPTIMIZATION ROUTINE:\n• Review last month's spending (15 minutes)\n• Adjust next month's budget (10 minutes)\n• Check for new bills to negotiate (5 minutes)\n• Celebrate wins and plan improvements (5 minutes)"
          },
          {
            id: "lifestyle-inflation",
            type: "warning",
            title: "⚠️ Beware the Lifestyle Inflation Trap!",
            content: "The #1 budget killer: spending more just because you earn more!\n\n🚨 WARNING SIGNS:\n• Got a raise? Immediately upgraded your lifestyle\n• Income increased but savings stayed the same\n• 'I deserve it' becomes your spending motto\n• Expenses magically match income every month\n\n✅ INFLATION DEFENSE STRATEGIES:\n• Save 50% of every raise before lifestyle changes\n• Wait 6 months before making major upgrades\n• Calculate hourly cost of purchases (that $200 dinner = 5 hours of work?)\n• Practice gratitude for what you already have"
          },
          {
            id: "budget-mastery-challenge",
            type: "example",
            title: "🏆 30-Day Budget Mastery Challenge",
            content: "Ready to become a budget optimization expert?\n\n📅 WEEK 1: Detective Work\n• Complete 7-day money audit\n• Identify top 3 spending surprises\n• Research one bill negotiation opportunity\n\n📅 WEEK 2: Quick Wins\n• Cancel one unused subscription\n• Cook 3 extra meals at home\n• Use cashback app for all purchases\n\n📅 WEEK 3: Value Alignment\n• Define your top 5 life values\n• Redirect one 'non-value' expense to savings\n• Automate one new savings transfer\n\n📅 WEEK 4: Optimization\n• Negotiate one monthly bill\n• Set up automatic budget review system\n• Plan next month's value-based spending\n\n🎁 REWARD: Average participants save $200-400/month!"
          },
          {
            id: "advanced-tips",
            type: "tip",
            title: "🎭 Pro Budget Hacks (Insider Secrets)",
            content: "Ready for the advanced course? Here are insider secrets:\n\n🎯 THE 24-HOUR RULE: Sleep on purchases over $50\n🛒 GROCERY GAME: Shop after meals, use lists, stick to perimeter\n💳 CREDIT CARD CYCLING: Use rewards cards, pay in full monthly\n📊 THE 1% RULE: Improve budget by 1% monthly (compound effect!)\n🎉 CELEBRATION FUND: Budget for fun so you don't feel deprived\n📱 PRICE COMPARISON: Check 3 sources before any purchase over $100\n\n🔮 MINDSET SHIFT: Think in annual costs ($5/day = $1,825/year!)"
          }
        ],
        exercises: [
          {
            id: "expense-cutting-exercise",
            type: "multiple-choice",
            question: "What's the best first step to reduce expenses?",
            options: ["Cut all entertainment", "Cancel unused subscriptions", "Stop eating out completely", "Quit your gym membership"],
            correctAnswer: "Cancel unused subscriptions",
            explanation: "Canceling unused subscriptions is low-impact but saves money immediately. You won't miss services you're not using!",
            feedback: {
              correct: "Smart choice! Easy wins first - cancel what you don't use.",
              incorrect: "Start with easy cuts that don't affect your quality of life."
            },
            points: 10
          },
          {
            id: "coffee-calculation",
            type: "multiple-choice",
            question: "If you buy a $5 coffee every workday, how much do you spend yearly?",
            options: ["$600", "$1,200", "$1,300", "$1,800"],
            correctAnswer: "$1,300",
            explanation: "$5 × 5 days × 52 weeks = $1,300 per year. That's a significant amount that could go toward savings!",
            feedback: {
              correct: "Exactly! Small daily expenses add up to big yearly costs.",
              incorrect: "Calculate: $5 per day × 5 days per week × 52 weeks per year."
            },
            points: 15
          },
          {
            id: "budget-adjustment-exercise",
            type: "multiple-choice",
            question: "When should you update your budget?",
            options: ["Never, once it's set", "Only when you get a new job", "Monthly or when major life changes occur", "Only at the end of the year"],
            correctAnswer: "Monthly or when major life changes occur",
            explanation: "Regular budget reviews help you stay on track. Update when your income, expenses, or priorities change.",
            feedback: {
              correct: "Perfect! Regular updates keep your budget realistic and effective.",
              incorrect: "Budgets need regular attention to stay relevant to your current situation."
            },
            points: 15
          }
        ]
      }
    ]
  },
  {
    id: "smart-saving",
    title: "Smart Saving Strategies",
    description: "Build wealth through strategic saving techniques",
    icon: "PiggyBank",
    totalLevels: 3,
    estimatedTime: "30 minutes",
    levels: [
      {
        id: "saving-1",
        moduleId: "smart-saving",
        levelNumber: 1,
        title: "Emergency Fund Basics",
        description: "Create your financial safety net",
        xpReward: 15,
        learningObjectives: [
          "Understand why emergency funds are crucial",
          "Calculate your emergency fund target",
          "Learn where to keep emergency savings"
        ],
        content: [
          {
            id: "emergency-fund-definition",
            type: "text",
            title: "What is an Emergency Fund?",
            content: "An emergency fund is money set aside for unexpected expenses: job loss, medical bills, car repairs, or home maintenance. It's your financial cushion that prevents you from going into debt when life happens."
          },
          {
            id: "emergency-fund-size",
            type: "visual",
            title: "How Much Do You Need?",
            content: "Start with $1,000 for beginners. Build to 3-6 months of expenses. High earners or single-income families should aim for 6-12 months.",
            visual: {
              type: "chart",
              data: {
                beginner: 1000,
                stable: 15000,
                conservative: 30000
              }
            }
          },
          {
            id: "emergency-example",
            type: "example",
            title: "Emergency Fund in Action",
            content: "Maria's car needs $800 in repairs. Without an emergency fund, she'd put it on a credit card at 18% interest. With her emergency fund, she pays cash and avoids debt. That's financial peace of mind!"
          },
          {
            id: "where-to-save",
            type: "tip",
            title: "Where to Keep Emergency Money",
            content: "Keep emergency funds in a high-yield savings account. It should be easily accessible but separate from your checking account. Don't invest emergency funds - you need stability, not growth."
          }
        ],
        exercises: [
          {
            id: "emergency-fund-purpose",
            type: "multiple-choice",
            question: "What is the main purpose of an emergency fund?",
            options: ["To invest in stocks", "To cover unexpected expenses", "To buy luxury items", "To pay monthly bills"],
            correctAnswer: "To cover unexpected expenses",
            explanation: "Emergency funds are specifically for unexpected costs like medical bills, car repairs, or job loss.",
            feedback: {
              correct: "Exactly! Emergency funds are your safety net for life's surprises.",
              incorrect: "Think about the word 'emergency' - what kind of expenses would that cover?"
            },
            points: 10
          },
          {
            id: "emergency-fund-size-exercise",
            type: "multiple-choice",
            question: "If your monthly expenses are $3,000, what's a good emergency fund target?",
            options: ["$3,000", "$6,000", "$9,000-$18,000", "$50,000"],
            correctAnswer: "$9,000-$18,000",
            explanation: "3-6 months of expenses means $9,000-$18,000 for someone with $3,000 monthly expenses.",
            feedback: {
              correct: "Perfect! 3-6 months of expenses provides good security.",
              incorrect: "Calculate 3-6 months worth of your monthly expenses."
            },
            points: 15
          },
          {
            id: "emergency-fund-location",
            type: "multiple-choice",
            question: "Where should you keep your emergency fund?",
            options: ["Stock market", "High-yield savings account", "Under your mattress", "Cryptocurrency"],
            correctAnswer: "High-yield savings account",
            explanation: "High-yield savings accounts offer easy access, FDIC protection, and some interest growth - perfect for emergency funds.",
            feedback: {
              correct: "Great choice! Safe, accessible, and earns some interest.",
              incorrect: "Emergency funds need to be safe and easily accessible when needed."
            },
            points: 10
          }
        ]
      },
      {
        id: "saving-2",
        moduleId: "smart-saving",
        levelNumber: 2,
        title: "Setting and Achieving Savings Goals",
        description: "Turn dreams into achievable financial targets",
        xpReward: 20,
        learningObjectives: [
          "Set SMART savings goals",
          "Calculate how much to save monthly",
          "Choose the right savings account type"
        ],
        content: [
          {
            id: "smart-goals",
            type: "text",
            title: "SMART Savings Goals",
            content: "Make goals Specific, Measurable, Achievable, Relevant, and Time-bound. Instead of 'save money,' try 'save $5,000 for a vacation to Japan by December 2025.'"
          },
          {
            id: "goal-examples",
            type: "example",
            title: "Real Savings Goals",
            content: "Short-term (1 year): $2,400 for new laptop, $3,000 for vacation. Medium-term (2-5 years): $20,000 for car down payment, $15,000 for wedding. Long-term (5+ years): $50,000 for house down payment, $500,000 for retirement."
          },
          {
            id: "savings-calculation",
            type: "step",
            title: "How Much to Save Monthly",
            content: "1. Set your goal amount 2. Decide your timeline 3. Divide goal by months 4. Example: $6,000 vacation in 12 months = $500/month 5. Add 10% buffer for unexpected delays"
          },
          {
            id: "account-types",
            type: "visual",
            title: "Savings Account Types",
            content: "Regular savings (0.01% APY), High-yield savings (4-5% APY), Money market (3-4% APY), CDs (4-5% APY, locked up)",
            visual: {
              type: "comparison",
              data: {
                regular: "0.01% APY",
                highYield: "4-5% APY", 
                moneyMarket: "3-4% APY",
                cd: "4-5% APY (locked)"
              }
            }
          }
        ],
        exercises: [
          {
            id: "smart-goal-exercise",
            type: "multiple-choice",
            question: "Which is a SMART savings goal?",
            options: ["Save money", "Save more this year", "Save $10,000 for emergency fund by December 2025", "Save a lot for retirement"],
            correctAnswer: "Save $10,000 for emergency fund by December 2025",
            explanation: "This goal is Specific ($10,000), Measurable (can track progress), Achievable (reasonable amount), Relevant (emergency fund), and Time-bound (by December 2025).",
            feedback: {
              correct: "Excellent! This goal has all the SMART criteria.",
              incorrect: "Look for the goal that's specific, measurable, and has a deadline."
            },
            points: 15
          },
          {
            id: "monthly-savings-calculation",
            type: "multiple-choice",
            question: "To save $6,000 in 18 months, how much should you save monthly?",
            options: ["$300", "$333", "$350", "$400"],
            correctAnswer: "$333",
            explanation: "$6,000 ÷ 18 months = $333 per month. Always round up to ensure you meet your goal!",
            feedback: {
              correct: "Perfect calculation! $333 per month gets you to your goal.",
              incorrect: "Divide your total goal by the number of months: $6,000 ÷ 18."
            },
            points: 15
          },
          {
            id: "account-type-exercise", 
            type: "multiple-choice",
            question: "For a vacation fund you'll use in 2 years, what's the best account type?",
            options: ["Regular savings", "High-yield savings", "Stock market", "Checking account"],
            correctAnswer: "High-yield savings",
            explanation: "High-yield savings accounts offer better interest than regular savings while keeping your money safe and accessible for your 2-year timeline.",
            feedback: {
              correct: "Smart choice! High-yield savings balances growth with safety.",
              incorrect: "Consider what offers good interest while keeping your money safe and accessible."
            },
            points: 10
          }
        ]
      },
      {
        id: "saving-3",
        moduleId: "smart-saving",
        levelNumber: 3,
        title: "Automating Your Savings",
        description: "Make saving effortless with automation",
        xpReward: 25,
        learningObjectives: [
          "Set up automatic transfers",
          "Use the pay yourself first strategy",
          "Optimize savings with high-yield accounts"
        ],
        content: [
          {
            id: "automation-benefits",
            type: "text",
            title: "Why Automate Savings?",
            content: "Automation removes the decision and temptation. When savings happen automatically, you can't forget or spend the money elsewhere. It's the #1 strategy successful savers use."
          },
          {
            id: "pay-yourself-first",
            type: "tip",
            title: "Pay Yourself First",
            content: "Set up automatic transfers right after payday, before you have a chance to spend the money. Treat savings like a non-negotiable bill you must pay to yourself."
          },
          {
            id: "automation-setup",
            type: "step",
            title: "Setting Up Automatic Savings",
            content: "1. Open a separate high-yield savings account 2. Calculate your monthly savings amount 3. Set up automatic transfer for payday 4. Start small if needed - even $25/month builds the habit 5. Increase the amount whenever you get a raise"
          },
          {
            id: "round-up-apps",
            type: "example",
            title: "Round-Up Savings Apps",
            content: "Apps like Acorns or Qapital round up your purchases and save the spare change. Buy coffee for $4.35? They save $0.65. Small amounts add up - many people save $50-200/month this way!"
          }
        ],
        exercises: [
          {
            id: "automation-timing",
            type: "multiple-choice",
            question: "When is the best time to set up automatic savings transfers?",
            options: ["End of the month", "Right after payday", "Middle of the month", "Whenever you remember"],
            correctAnswer: "Right after payday",
            explanation: "Right after payday ensures the money is saved before you have a chance to spend it elsewhere. Pay yourself first!",
            feedback: {
              correct: "Exactly! Pay yourself first, right when the money comes in.",
              incorrect: "Think about when you're most likely to have money available to save."
            },
            points: 10
          },
          {
            id: "round-up-calculation",
            type: "multiple-choice",
            question: "If you make 20 purchases per week averaging $0.50 round-ups, how much would you save monthly?",
            options: ["$20", "$30", "$40", "$50"],
            correctAnswer: "$40",
            explanation: "20 purchases × $0.50 round-up × 4 weeks = $40 per month. Round-up savings can really add up!",
            feedback: {
              correct: "Great math! Round-up apps can save significant amounts painlessly.",
              incorrect: "Calculate: 20 purchases × $0.50 × 4 weeks per month."
            },
            points: 15
          },
          {
            id: "savings-increase-strategy",
            type: "multiple-choice",
            question: "What's the best strategy when you get a raise?",
            options: ["Spend it all on lifestyle upgrades", "Save 100% of the raise", "Increase savings by 50% of the raise", "Don't change anything"],
            correctAnswer: "Increase savings by 50% of the raise",
            explanation: "Saving 50% of raises helps you build wealth while still enjoying some lifestyle improvements. It's a balanced approach to wealth building.",
            feedback: {
              correct: "Perfect balance! Build wealth while enjoying some lifestyle improvement.",
              incorrect: "Consider a strategy that builds wealth while still allowing some enjoyment of increased income."
            },
            points: 15
          }
        ]
      }
    ]
  },
  {
    id: "debt-management",
    title: "Debt Management",
    description: "Take control of debt and build a debt-free future",
    icon: "CreditCard",
    totalLevels: 3,
    estimatedTime: "35 minutes",
    levels: [
      {
        id: "debt-1",
        moduleId: "debt-management",
        levelNumber: 1,
        title: "Understanding Different Types of Debt",
        description: "Learn about good debt vs bad debt",
        xpReward: 15,
        learningObjectives: [
          "Distinguish between good and bad debt",
          "Understand interest rates and their impact",
          "Recognize debt warning signs"
        ],
        content: [
          {
            id: "debt-definition",
            type: "text",
            title: "What is Debt?",
            content: "Debt is money you owe to someone else. It includes credit cards, loans, mortgages, and even money borrowed from family. All debt costs money through interest or opportunity cost."
          },
          {
            id: "good-vs-bad-debt",
            type: "visual",
            title: "Good Debt vs Bad Debt",
            content: "Good debt helps you build wealth or generate income: mortgages, student loans, business loans. Bad debt purchases depreciating assets: credit cards, auto loans, personal loans.",
            visual: {
              type: "comparison",
              data: {
                good: ["Mortgage (builds equity)", "Student loans (increases earning potential)", "Business loans (generate income)"],
                bad: ["Credit cards (high interest)", "Auto loans (depreciating asset)", "Personal loans (consumption)"]
              }
            }
          },
          {
            id: "interest-impact",
            type: "example",
            title: "The Power of Interest Rates",
            content: "A $5,000 credit card debt at 18% interest takes 47 years to pay off with minimum payments, costing $13,931 total. The same debt at 6% takes 25 years and costs $7,177. Interest rates matter!"
          },
          {
            id: "debt-warning-signs",
            type: "warning",
            title: "Debt Warning Signs",
            content: "Red flags: Only making minimum payments, using credit for basic needs, borrowing to pay other debts, maxed out credit cards, avoiding looking at statements. If any apply, take action now!"
          }
        ],
        exercises: [
          {
            id: "good-bad-debt-exercise",
            type: "multiple-choice",
            question: "Which of these is typically considered 'good debt'?",
            options: ["Credit card debt", "Auto loan", "Mortgage", "Personal loan"],
            correctAnswer: "Mortgage",
            explanation: "Mortgages are good debt because they help you build equity and wealth through homeownership.",
            feedback: {
              correct: "Right! Mortgages help you build equity and wealth over time.",
              incorrect: "Think about which debt helps you build wealth or assets that appreciate."
            },
            points: 10
          },
          {
            id: "interest-rate-exercise",
            type: "multiple-choice",
            question: "Why do interest rates matter so much with debt?",
            options: ["They don't really matter", "Higher rates mean you pay much more over time", "They only affect monthly payments", "Banks set them randomly"],
            correctAnswer: "Higher rates mean you pay much more over time",
            explanation: "Higher interest rates dramatically increase the total amount you'll pay over the life of the debt.",
            feedback: {
              correct: "Exactly! Interest rates have a huge compound effect over time.",
              incorrect: "Consider how interest accumulates over months and years of payments."
            },
            points: 15
          },
          {
            id: "debt-warning-exercise",
            type: "multiple-choice",
            question: "Which is a major debt warning sign?",
            options: ["Paying off cards monthly", "Having a mortgage", "Only making minimum payments", "Using cash for purchases"],
            correctAnswer: "Only making minimum payments",
            explanation: "Only making minimum payments means you're barely covering interest, and the debt will take decades to pay off.",
            feedback: {
              correct: "Red flag! Minimum payments keep you in debt for years.",
              incorrect: "Look for the behavior that keeps you trapped in debt longer."
            },
            points: 10
          }
        ]
      },
      {
        id: "debt-2",
        moduleId: "debt-management",
        levelNumber: 2,
        title: "Debt Payoff Strategies",
        description: "Learn proven methods to eliminate debt faster",
        xpReward: 20,
        learningObjectives: [
          "Compare debt snowball vs avalanche methods",
          "Calculate debt payoff timelines",
          "Create a debt elimination plan"
        ],
        content: [
          {
            id: "debt-strategies-intro",
            type: "text",
            title: "Two Proven Debt Strategies",
            content: "The Debt Snowball and Debt Avalanche are both effective. Snowball pays smallest debts first for motivation. Avalanche pays highest interest rates first for maximum savings."
          },
          {
            id: "debt-snowball",
            type: "step",
            title: "Debt Snowball Method",
            content: "1. List all debts smallest to largest 2. Pay minimums on all debts 3. Put extra money toward smallest debt 4. When smallest is paid off, roll that payment to next smallest 5. Repeat until debt-free"
          },
          {
            id: "debt-avalanche",
            type: "step",
            title: "Debt Avalanche Method",
            content: "1. List all debts by interest rate (highest first) 2. Pay minimums on all debts 3. Put extra money toward highest interest debt 4. When paid off, roll payment to next highest rate 5. Saves more money mathematically"
          },
          {
            id: "debt-comparison",
            type: "example",
            title: "Snowball vs Avalanche Example",
            content: "Sarah has: Card A: $500 at 15%, Card B: $2,000 at 22%, Card C: $8,000 at 18%. Snowball: Pay Card A first (motivation). Avalanche: Pay Card B first (saves $140/year in interest). Choose based on your personality!"
          }
        ],
        exercises: [
          {
            id: "snowball-method-exercise",
            type: "multiple-choice",
            question: "In the debt snowball method, which debt do you pay off first?",
            options: ["Highest interest rate", "Largest balance", "Smallest balance", "Newest debt"],
            correctAnswer: "Smallest balance",
            explanation: "Debt snowball focuses on smallest balance first to build motivation and momentum through quick wins.",
            feedback: {
              correct: "Right! Snowball is about motivation through quick wins.",
              incorrect: "Remember: snowball method prioritizes psychological wins over math."
            },
            points: 10
          },
          {
            id: "avalanche-method-exercise",
            type: "multiple-choice",
            question: "What's the main advantage of the debt avalanche method?",
            options: ["Faster psychological wins", "Saves the most money in interest", "Easiest to understand", "Works for everyone"],
            correctAnswer: "Saves the most money in interest",
            explanation: "Avalanche method mathematically saves the most money by targeting highest interest rates first.",
            feedback: {
              correct: "Exactly! Avalanche is the mathematically optimal approach.",
              incorrect: "Think about what happens when you eliminate high-interest debt first."
            },
            points: 15
          },
          {
            id: "debt-strategy-choice",
            type: "multiple-choice",
            question: "Which debt strategy should you choose?",
            options: ["Always use snowball", "Always use avalanche", "Choose based on your personality and motivation style", "It doesn't matter"],
            correctAnswer: "Choose based on your personality and motivation style",
            explanation: "The best strategy is the one you'll stick with. If you need motivation, use snowball. If you're motivated by saving money, use avalanche.",
            feedback: {
              correct: "Perfect! The best plan is the one you'll actually follow.",
              incorrect: "Consider that personal psychology matters as much as math in debt payoff."
            },
            points: 15
          }
        ]
      },
      {
        id: "debt-3", 
        moduleId: "debt-management",
        levelNumber: 3,
        title: "Avoiding Future Debt Traps",
        description: "Build habits to stay debt-free long-term",
        xpReward: 25,
        learningObjectives: [
          "Recognize predatory lending practices",
          "Build emergency funds to avoid debt",
          "Use credit cards responsibly"
        ],
        content: [
          {
            id: "predatory-lending",
            type: "warning",
            title: "Avoid Predatory Lending",
            content: "Watch out for: Payday loans (400%+ APR), title loans, rent-to-own stores, and cash advance apps. These trap you in cycles of debt with extremely high costs."
          },
          {
            id: "emergency-fund-debt-prevention",
            type: "tip",
            title: "Emergency Funds Prevent Debt",
            content: "Most debt comes from emergencies without savings. A $1,000 emergency fund prevents most credit card debt. Build it before aggressively paying off debt."
          },
          {
            id: "credit-card-rules",
            type: "step",
            title: "Credit Card Best Practices",
            content: "1. Pay full balance monthly 2. Never spend more than you have in cash 3. Use for rewards/protection, not borrowing 4. Keep utilization under 30% 5. Don't close old cards (hurts credit score)"
          },
          {
            id: "debt-free-mindset",
            type: "text",
            title: "Building a Debt-Free Mindset",
            content: "Think of debt as an emergency, not a tool. Live below your means. If you can't afford it with cash, you can't afford it. Build wealth through saving and investing, not borrowing."
          }
        ],
        exercises: [
          {
            id: "predatory-lending-exercise",
            type: "multiple-choice",
            question: "Which is a sign of predatory lending?",
            options: ["Low interest rates", "400%+ annual interest rates", "Long repayment terms", "Credit checks required"],
            correctAnswer: "400%+ annual interest rates",
            explanation: "Extremely high interest rates (like 400% APR) are a hallmark of predatory lending designed to trap borrowers.",
            feedback: {
              correct: "Red flag! Those rates are designed to trap you in debt.",
              incorrect: "Look for the practice that's clearly designed to exploit borrowers."
            },
            points: 10
          },
          {
            id: "emergency-fund-debt-exercise",
            type: "multiple-choice",
            question: "How does an emergency fund help you avoid debt?",
            options: ["It earns high interest", "It prevents using credit cards for unexpected expenses", "It's required by law", "It increases your credit score"],
            correctAnswer: "It prevents using credit cards for unexpected expenses",
            explanation: "Emergency funds give you cash for unexpected expenses, so you don't need to borrow money or use credit cards.",
            feedback: {
              correct: "Exactly! Cash reserves prevent borrowing in emergencies.",
              incorrect: "Think about what happens when emergencies arise without savings."
            },
            points: 15
          },
          {
            id: "credit-card-usage-exercise",
            type: "multiple-choice",
            question: "What's the best way to use credit cards?",
            options: ["Carry a small balance to build credit", "Pay only the minimum each month", "Pay the full balance monthly", "Use them for emergency loans"],
            correctAnswer: "Pay the full balance monthly",
            explanation: "Paying the full balance monthly gives you the benefits of credit cards (rewards, protection) without interest charges.",
            feedback: {
              correct: "Perfect! Get the benefits without the interest costs.",
              incorrect: "Think about how to get credit card benefits while avoiding interest charges."
            },
            points: 15
          }
        ]
      }
    ]
  },
  {
    id: "investment-fundamentals",
    title: "Investment Fundamentals",
    description: "Start building wealth through smart investing",
    icon: "TrendingUp",
    totalLevels: 3,
    estimatedTime: "40 minutes",
    levels: [
      {
        id: "investment-1",
        moduleId: "investment-fundamentals",
        levelNumber: 1,
        title: "Investment Basics",
        description: "Understand the fundamentals of investing",
        xpReward: 15,
        learningObjectives: [
          "Learn what investing really means",
          "Understand different investment types",
          "Grasp the power of compound interest"
        ],
        content: [
          {
            id: "investing-definition",
            type: "text",
            title: "What is Investing?",
            content: "Investing is putting your money to work to generate more money over time. Instead of just saving, you're buying assets that can grow in value or produce income."
          },
          {
            id: "investment-types",
            type: "visual",
            title: "Types of Investments",
            content: "Stocks (own pieces of companies), Bonds (loan money to companies/governments), Real Estate (physical property), Index Funds (baskets of many stocks)",
            visual: {
              type: "illustration",
              data: {
                stocks: "Ownership in companies",
                bonds: "Loans you make",
                realEstate: "Physical property",
                indexFunds: "Diversified baskets"
              }
            }
          },
          {
            id: "compound-interest",
            type: "example",
            title: "The Magic of Compound Interest",
            content: "Start with $1,000 earning 7% annually. After 10 years: $1,967. After 20 years: $3,870. After 30 years: $7,612. Time is your biggest advantage in investing!"
          },
          {
            id: "investing-vs-saving",
            type: "tip",
            title: "Investing vs Saving",
            content: "Savings accounts protect your money but don't beat inflation. Investing carries risk but historically grows wealth over time. Use both: save for emergencies, invest for long-term goals."
          }
        ],
        exercises: [
          {
            id: "investing-definition-exercise",
            type: "multiple-choice",
            question: "What is the main goal of investing?",
            options: ["Keep money safe", "Generate more money over time", "Avoid paying taxes", "Get rich quick"],
            correctAnswer: "Generate more money over time",
            explanation: "Investing aims to grow your money over time through asset appreciation and income generation.",
            feedback: {
              correct: "Exactly! Investing is about long-term wealth building.",
              incorrect: "Think about why people choose investing over just saving money."
            },
            points: 10
          },
          {
            id: "investment-types-exercise",
            type: "multiple-choice",
            question: "When you buy stock, you are:",
            options: ["Lending money to a company", "Buying physical property", "Becoming a partial owner of a company", "Storing money safely"],
            correctAnswer: "Becoming a partial owner of a company",
            explanation: "Stocks represent ownership shares in companies. When you buy stock, you own a tiny piece of that business.",
            feedback: {
              correct: "Right! Stock ownership makes you a shareholder in the company.",
              incorrect: "Think about what 'stock' or 'shares' represent in relation to companies."
            },
            points: 15
          },
          {
            id: "compound-interest-exercise",
            type: "multiple-choice",
            question: "What makes compound interest so powerful?",
            options: ["High interest rates", "Earning interest on your interest", "Government guarantees", "No risk involved"],
            correctAnswer: "Earning interest on your interest",
            explanation: "Compound interest means you earn returns not just on your original money, but also on all the gains from previous years.",
            feedback: {
              correct: "Perfect! Your money makes money, then that money makes money too.",
              incorrect: "Think about what happens to the interest you earn each year."
            },
            points: 15
          }
        ]
      },
      {
        id: "investment-2",
        moduleId: "investment-fundamentals",
        levelNumber: 2,
        title: "Risk vs Return",
        description: "Learn to balance risk and reward in investing",
        xpReward: 20,
        learningObjectives: [
          "Understand the risk-return relationship",
          "Learn about diversification",
          "Assess your risk tolerance"
        ],
        content: [
          {
            id: "risk-return-relationship",
            type: "text",
            title: "Risk and Return Connection",
            content: "Higher potential returns usually come with higher risk. Safe investments like savings accounts have low returns. Riskier investments like stocks have higher potential returns but can lose money."
          },
          {
            id: "risk-spectrum",
            type: "visual",
            title: "Investment Risk Spectrum",
            content: "Low Risk/Low Return: Savings accounts (1-2%), CDs (3-5%). Medium Risk/Medium Return: Bonds (4-6%), Balanced funds (5-8%). High Risk/High Return: Individual stocks (varies widely), Growth stocks (potentially 10%+ or losses)",
            visual: {
              type: "chart",
              data: {
                low: { risk: "Low", return: "1-2%", example: "Savings" },
                medium: { risk: "Medium", return: "4-8%", example: "Bonds/Funds" },
                high: { risk: "High", return: "10%+ or losses", example: "Individual stocks" }
              }
            }
          },
          {
            id: "diversification",
            type: "tip",
            title: "Don't Put All Eggs in One Basket",
            content: "Diversification means spreading investments across different companies, industries, and asset types. If one investment fails, others can still succeed. Index funds automatically provide diversification."
          },
          {
            id: "risk-tolerance",
            type: "step",
            title: "Assessing Your Risk Tolerance",
            content: "1. Consider your age (younger = more time to recover) 2. Think about your goals timeline 3. Evaluate your emotional comfort with losses 4. Assess your financial situation 5. Start conservative and learn"
          }
        ],
        exercises: [
          {
            id: "risk-return-exercise",
            type: "multiple-choice",
            question: "What's the general relationship between risk and return?",
            options: ["Higher risk = guaranteed higher returns", "Higher risk = potential for higher returns", "Risk doesn't affect returns", "Lower risk = higher returns"],
            correctAnswer: "Higher risk = potential for higher returns",
            explanation: "Higher risk investments offer the potential for higher returns, but they also have the potential for larger losses. Nothing is guaranteed.",
            feedback: {
              correct: "Exactly! Higher risk offers potential, not guarantees.",
              incorrect: "Remember: potential is not the same as guaranteed returns."
            },
            points: 15
          },
          {
            id: "diversification-exercise",
            type: "multiple-choice",
            question: "What is diversification?",
            options: ["Buying only one stock", "Spreading investments across different assets", "Investing only in bonds", "Putting all money in savings"],
            correctAnswer: "Spreading investments across different assets",
            explanation: "Diversification reduces risk by spreading investments across different companies, industries, and types of assets.",
            feedback: {
              correct: "Right! Diversification reduces risk through spreading investments.",
              incorrect: "Think about the saying 'don't put all your eggs in one basket.'"
            },
            points: 10
          },
          {
            id: "risk-tolerance-exercise",
            type: "multiple-choice",
            question: "A 25-year-old saving for retirement should generally:",
            options: ["Take no investment risk", "Take moderate to high risk", "Only invest in bonds", "Avoid investing entirely"],
            correctAnswer: "Take moderate to high risk",
            explanation: "Young investors have 40+ years until retirement, giving them time to recover from market downturns and benefit from long-term growth.",
            feedback: {
              correct: "Smart! Time is on their side for weathering market volatility.",
              incorrect: "Consider how much time they have until retirement and to recover from any losses."
            },
            points: 15
          }
        ]
      },
      {
        id: "investment-3",
        moduleId: "investment-fundamentals",
        levelNumber: 3,
        title: "Getting Started with Investing",
        description: "Take your first steps into the investment world",
        xpReward: 25,
        learningObjectives: [
          "Choose the right investment accounts",
          "Start with index funds and ETFs",
          "Create a simple investment plan"
        ],
        content: [
          {
            id: "investment-accounts",
            type: "visual",
            title: "Types of Investment Accounts",
            content: "Taxable brokerage (access anytime, pay taxes on gains), 401(k) (employer retirement plan, tax benefits), Roth IRA (retirement account, tax-free growth), Traditional IRA (retirement, tax deduction now)",
            visual: {
              type: "comparison",
              data: {
                taxable: "Access anytime, pay taxes",
                "401k": "Employer plan, tax benefits",
                rothIRA: "Tax-free growth in retirement",
                traditionalIRA: "Tax deduction now"
              }
            }
          },
          {
            id: "index-funds-intro",
            type: "text",
            title: "Start with Index Funds",
            content: "Index funds are perfect for beginners. They automatically diversify across hundreds of companies, have low fees, and track market performance. Popular options: S&P 500 index funds, Total Stock Market funds."
          },
          {
            id: "getting-started-steps",
            type: "step",
            title: "Your First Investment Steps",
            content: "1. Build emergency fund first 2. Contribute to 401(k) up to company match 3. Open Roth IRA 4. Start with broad index fund 5. Invest consistently every month 6. Don't check daily - think long-term"
          },
          {
            id: "common-mistakes",
            type: "warning",
            title: "Avoid These Beginner Mistakes",
            content: "Don't try to time the market, don't panic sell during downturns, don't pick individual stocks as a beginner, don't invest money you'll need soon, and don't forget about fees - they compound too!"
          }
        ],
        exercises: [
          {
            id: "investment-account-exercise",
            type: "multiple-choice",
            question: "What's a major benefit of a Roth IRA?",
            options: ["Immediate tax deduction", "Tax-free growth and withdrawals in retirement", "No contribution limits", "Guaranteed returns"],
            correctAnswer: "Tax-free growth and withdrawals in retirement",
            explanation: "Roth IRAs grow tax-free, and you can withdraw money in retirement without paying taxes on the gains.",
            feedback: {
              correct: "Excellent! Tax-free growth is a huge long-term advantage.",
              incorrect: "Think about when you'd pay taxes with a Roth IRA vs other accounts."
            },
            points: 15
          },
          {
            id: "index-fund-exercise",
            type: "multiple-choice", 
            question: "Why are index funds good for beginners?",
            options: ["They guarantee profits", "They automatically provide diversification", "They never lose money", "They beat the market every year"],
            correctAnswer: "They automatically provide diversification",
            explanation: "Index funds spread your investment across hundreds of companies automatically, reducing risk through diversification.",
            feedback: {
              correct: "Right! Instant diversification without picking individual stocks.",
              incorrect: "Think about what index funds do automatically that would be hard for beginners to do themselves."
            },
            points: 15
          },
          {
            id: "investment-priority-exercise",
            type: "multiple-choice",
            question: "What should you do before investing in the stock market?",
            options: ["Buy individual stocks", "Build an emergency fund", "Take out a loan", "Quit your job"],
            correctAnswer: "Build an emergency fund",
            explanation: "Emergency funds ensure you won't need to sell investments during market downturns to cover unexpected expenses.",
            feedback: {
              correct: "Smart! Never invest money you might need for emergencies.",
              incorrect: "Consider what financial foundation you need before taking investment risk."
            },
            points: 10
          }
        ]
      }
    ]
  }
];

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  requirement: string;
  xpRequired: number;
  badgeColor: string;
}

export const ACHIEVEMENT_BADGES: Achievement[] = [
  {
    id: "first-steps",
    title: "First Steps",
    description: "Complete your first lesson",
    icon: "BookOpen",
    requirement: "Complete 1 lesson",
    xpRequired: 15,
    badgeColor: "bg-blue-500"
  },
  {
    id: "learning-streak",
    title: "Learning Streak", 
    description: "Maintain a 7-day learning streak",
    icon: "Flame",
    requirement: "7-day streak",
    xpRequired: 50,
    badgeColor: "bg-orange-500"
  },
  {
    id: "xp-collector",
    title: "XP Collector",
    description: "Earn 100 XP points",
    icon: "Zap",
    requirement: "Earn 100 XP",
    xpRequired: 100,
    badgeColor: "bg-yellow-500"
  },
  {
    id: "module-master",
    title: "Module Master",
    description: "Complete your first module",
    icon: "Award",
    requirement: "Complete any module",
    xpRequired: 60,
    badgeColor: "bg-green-500"
  },
  {
    id: "dedicated-learner",
    title: "Dedicated Learner",
    description: "Complete all financial literacy modules",
    icon: "Trophy",
    requirement: "Complete all modules",
    xpRequired: 240,
    badgeColor: "bg-purple-500"
  }
];