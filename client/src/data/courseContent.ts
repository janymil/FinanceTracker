// Financial Literacy Course Content
// Generated for Duolingo-style gamified learning experience

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

export interface CourseLevel {
  id: string;
  moduleId: string;
  levelNumber: number;
  title: string;
  description: string;
  xpReward: number;
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
    "id": "budgeting-basics",
    "title": "Budgeting Basics",
    "description": "Master the fundamentals of managing your money effectively",
    "icon": "Calculator",
    "totalLevels": 3,
    "estimatedTime": "25 minutes",
    "levels": [
      {
        "id": "budgeting-level-1",
        "moduleId": "budgeting-basics",
        "levelNumber": 1,
        "title": "Understanding Income vs Expenses",
        "description": "Learn the difference between money coming in and going out",
        "xpReward": 30,
        "exercises": [
          {
            "id": "income-types",
            "type": "multiple-choice",
            "question": "Which of these is considered 'gross income'?",
            "options": [
              "Your salary after taxes are deducted",
              "Your salary before any deductions",
              "Only your side hustle earnings",
              "Money you receive as gifts"
            ],
            "correctAnswer": "Your salary before any deductions",
            "feedback": {
              "correct": "Exactly! Gross income is your total earnings before taxes, insurance, and other deductions.",
              "incorrect": "Not quite. Gross income is your total salary/wages before any taxes or deductions are taken out."
            },
            "points": 8
          },
          {
            "id": "fixed-vs-variable",
            "type": "multiple-choice",
            "question": "Your monthly rent payment is an example of what type of expense?",
            "options": [
              "Variable expense",
              "Fixed expense", 
              "Discretionary expense",
              "Emergency expense"
            ],
            "correctAnswer": "Fixed expense",
            "feedback": {
              "correct": "Perfect! Rent is a fixed expense because it's the same amount every month.",
              "incorrect": "Think again. Rent stays the same each month, making it a fixed expense that you can predict and plan for."
            },
            "points": 8
          },
          {
            "id": "expense-tracking",
            "type": "true-false",
            "question": "You should track every single expense, no matter how small.",
            "correctAnswer": "true",
            "feedback": {
              "correct": "Absolutely! Small expenses add up quickly. That daily $5 coffee becomes $150/month.",
              "incorrect": "Actually, small expenses can add up to significant amounts. It's important to track everything to see where your money really goes."
            },
            "points": 7
          },
          {
            "id": "income-scenario",
            "type": "scenario",
            "question": "Sarah earns $4,000/month gross salary. After taxes ($800), health insurance ($200), and retirement savings ($300), what's her net income?",
            "options": [
              "$2,700",
              "$3,200", 
              "$3,500",
              "$4,000"
            ],
            "correctAnswer": "$2,700",
            "feedback": {
              "correct": "Great math! $4,000 - $800 - $200 - $300 = $2,700 net income.",
              "incorrect": "Let's calculate: $4,000 gross - $800 taxes - $200 insurance - $300 retirement = $2,700 net income."
            },
            "points": 10
          }
        ]
      },
      {
        "id": "budgeting-level-2",
        "moduleId": "budgeting-basics",
        "levelNumber": 2,
        "title": "Creating Your First Budget",
        "description": "Build a practical budget using the 50/30/20 rule",
        "xpReward": 35,
        "exercises": [
          {
            "id": "budget-rule",
            "type": "multiple-choice",
            "question": "In the 50/30/20 budgeting rule, what does the 50% represent?",
            "options": [
              "Savings and debt payments",
              "Entertainment and dining out",
              "Needs like rent, groceries, utilities",
              "Investment contributions"
            ],
            "correctAnswer": "Needs like rent, groceries, utilities",
            "feedback": {
              "correct": "Exactly! 50% goes to needs (essentials), 30% to wants, and 20% to savings/debt.",
              "incorrect": "The 50% in 50/30/20 covers your essential needs like housing, food, and utilities."
            },
            "points": 9
          },
          {
            "id": "wants-vs-needs",
            "type": "multiple-choice",
            "question": "Which item would fall under 'wants' in your budget?",
            "options": [
              "Grocery shopping",
              "Rent payment",
              "Netflix subscription",
              "Car insurance"
            ],
            "correctAnswer": "Netflix subscription",
            "feedback": {
              "correct": "Right! Netflix is entertainment - a want, not a necessity for survival.",
              "incorrect": "Netflix is entertainment, which falls under 'wants.' The others are essential needs."
            },
            "points": 8
          },
          {
            "id": "budget-scenario",
            "type": "scenario",
            "question": "Mike has $3,000 net income. Using 50/30/20, how much should he allocate to savings?",
            "options": [
              "$450",
              "$600",
              "$900", 
              "$1,500"
            ],
            "correctAnswer": "$600",
            "feedback": {
              "correct": "Perfect! 20% of $3,000 = $600 for savings and debt repayment.",
              "incorrect": "Remember: 20% for savings. So $3,000 × 0.20 = $600."
            },
            "points": 10
          },
          {
            "id": "budget-adjustment",
            "type": "true-false",
            "question": "You should never adjust your budget once you've created it.",
            "correctAnswer": "false",
            "feedback": {
              "correct": "Exactly! Budgets should be flexible and adjusted as your life changes.",
              "incorrect": "Budgets need regular adjustments for life changes, income changes, and new goals."
            },
            "points": 7
          },
          {
            "id": "emergency-fund",
            "type": "multiple-choice",
            "question": "How many months of expenses should you aim for in an emergency fund?",
            "options": [
              "1-2 months",
              "3-6 months",
              "12 months",
              "24 months"
            ],
            "correctAnswer": "3-6 months",
            "feedback": {
              "correct": "Perfect! 3-6 months covers most emergencies like job loss or major repairs.",
              "incorrect": "Financial experts recommend 3-6 months of expenses for emergencies."
            },
            "points": 9
          }
        ]
      },
      {
        "id": "budgeting-level-3",
        "moduleId": "budgeting-basics", 
        "levelNumber": 3,
        "title": "Budget Optimization Strategies",
        "description": "Advanced techniques to maximize your budget's effectiveness",
        "xpReward": 40,
        "exercises": [
          {
            "id": "zero-based-budget",
            "type": "multiple-choice",
            "question": "What is zero-based budgeting?",
            "options": [
              "Having zero money left over",
              "Starting from zero every month",
              "Assigning every dollar a purpose",
              "Spending nothing on wants"
            ],
            "correctAnswer": "Assigning every dollar a purpose",
            "feedback": {
              "correct": "Exactly! Every dollar gets assigned to a category, leaving no money unaccounted for.",
              "incorrect": "Zero-based budgeting means giving every dollar a job - whether it's expenses, savings, or debt payments."
            },
            "points": 10
          },
          {
            "id": "budget-variance",
            "type": "scenario",
            "question": "You budgeted $300 for groceries but spent $380. What should you do?",
            "options": [
              "Ignore it and move on",
              "Adjust next month's budget",
              "Analyze why you overspent",
              "Both B and C"
            ],
            "correctAnswer": "Both B and C",
            "feedback": {
              "correct": "Smart approach! Understanding why helps prevent it, and adjusting keeps you realistic.",
              "incorrect": "You should both analyze the overspending and adjust your budget based on what you learned."
            },
            "points": 12
          },
          {
            "id": "sinking-funds",
            "type": "multiple-choice",
            "question": "What is a 'sinking fund'?",
            "options": [
              "Money for emergencies only",
              "Saving small amounts for predictable expenses",
              "Money that's losing value",
              "A bad investment"
            ],
            "correctAnswer": "Saving small amounts for predictable expenses",
            "feedback": {
              "correct": "Perfect! Sinking funds help you save gradually for things like car maintenance or holidays.",
              "incorrect": "A sinking fund is money you save bit by bit for predictable future expenses like car repairs or vacation."
            },
            "points": 10
          },
          {
            "id": "budget-frequency",
            "type": "true-false",
            "question": "You should review and update your budget monthly.",
            "correctAnswer": "true",
            "feedback": {
              "correct": "Absolutely! Monthly reviews help you stay on track and make necessary adjustments.",
              "incorrect": "Regular monthly reviews are essential for keeping your budget relevant and effective."
            },
            "points": 8
          }
        ]
      }
    ]
  },
  {
    "id": "smart-spending",
    "title": "Smart Spending",
    "description": "Learn to make informed purchasing decisions and avoid common spending traps",
    "icon": "ShoppingCart",
    "totalLevels": 3,
    "estimatedTime": "20 minutes",
    "levels": [
      {
        "id": "spending-level-1",
        "moduleId": "smart-spending",
        "levelNumber": 1,
        "title": "Needs vs Wants",
        "description": "Master the art of distinguishing between essential and optional purchases",
        "xpReward": 30,
        "exercises": [
          {
            "id": "basic-needs",
            "type": "multiple-choice",
            "question": "Which of these is a basic human need?",
            "options": [
              "Cable TV subscription",
              "Designer clothes",
              "Shelter/Housing",
              "Newest smartphone"
            ],
            "correctAnswer": "Shelter/Housing",
            "feedback": {
              "correct": "Right! Housing is a fundamental need for survival and security.",
              "incorrect": "Housing is a basic need for survival. The others are wants that make life more enjoyable."
            },
            "points": 8
          },
          {
            "id": "want-identification",
            "type": "multiple-choice",
            "question": "You're craving ice cream. This is an example of a:",
            "options": [
              "Need",
              "Want",
              "Emergency",
              "Investment"
            ],
            "correctAnswer": "Want",
            "feedback": {
              "correct": "Exactly! Ice cream is a want - it's nice to have but not necessary for survival.",
              "incorrect": "Ice cream is definitely a want. While tasty, it's not essential for your health or survival."
            },
            "points": 7
          },
          {
            "id": "spending-decision",
            "type": "scenario",
            "question": "Your winter coat is worn out and you live in a cold climate. Buying a new coat is a:",
            "options": [
              "Want - coats are fashion",
              "Need - protection from cold",
              "Luxury - use sweaters instead",
              "Emergency - buy any coat"
            ],
            "correctAnswer": "Need - protection from cold",
            "feedback": {
              "correct": "Absolutely! A coat for cold weather protection is a genuine need for health and safety.",
              "incorrect": "In cold climates, a good coat is essential for health and safety - that makes it a need, not a want."
            },
            "points": 10
          },
          {
            "id": "impulse-recognition",
            "type": "true-false",
            "question": "If you want something immediately, it's probably a need.",
            "correctAnswer": "false",
            "feedback": {
              "correct": "Correct! Immediate wants are usually impulses. True needs can usually wait for planning.",
              "incorrect": "Actually, immediate wants are often impulses. Real needs can typically wait for proper planning and budgeting."
            },
            "points": 8
          }
        ]
      },
      {
        "id": "spending-level-2",
        "moduleId": "smart-spending",
        "levelNumber": 2,
        "title": "Comparison Shopping",
        "description": "Learn strategies to get the best value for your money",
        "xpReward": 35,
        "exercises": [
          {
            "id": "price-comparison",
            "type": "scenario",
            "question": "You need a laptop. Store A: $800, Store B: $750 + $50 shipping, Store C: $780. Which is cheapest?",
            "options": [
              "Store A ($800)",
              "Store B ($750 + $50)",
              "Store C ($780)",
              "They're all the same"
            ],
            "correctAnswer": "Store C ($780)",
            "feedback": {
              "correct": "Right! Store C at $780 beats Store A ($800) and Store B ($800 total with shipping).",
              "incorrect": "Don't forget shipping costs! Store B is $750 + $50 = $800, making Store C at $780 the cheapest."
            },
            "points": 10
          },
          {
            "id": "unit-pricing",
            "type": "multiple-choice",
            "question": "What's the best way to compare prices on groceries?",
            "options": [
              "Look at total price only",
              "Compare price per unit/ounce",
              "Buy the biggest package",
              "Choose based on brand"
            ],
            "correctAnswer": "Compare price per unit/ounce",
            "feedback": {
              "correct": "Perfect! Unit pricing shows true value regardless of package size.",
              "incorrect": "Unit pricing (price per ounce, pound, etc.) gives you the real comparison between different sizes and brands."
            },
            "points": 9
          },
          {
            "id": "timing-purchases",
            "type": "multiple-choice",
            "question": "When is the best time to buy winter clothes?",
            "options": [
              "Right before winter starts",
              "During peak winter",
              "End of winter/early spring",
              "Middle of summer"
            ],
            "correctAnswer": "End of winter/early spring",
            "feedback": {
              "correct": "Smart! End-of-season sales offer the best prices when stores clear inventory.",
              "incorrect": "End-of-season sales (late winter/early spring) offer the deepest discounts on winter clothing."
            },
            "points": 9
          },
          {
            "id": "research-time",
            "type": "true-false",
            "question": "You should spend the same amount of time researching a $20 purchase as a $2,000 purchase.",
            "correctAnswer": "false",
            "feedback": {
              "correct": "Exactly! Spend more time researching expensive purchases - the potential savings are greater.",
              "incorrect": "Spend more research time on expensive purchases. The potential savings make the extra time worthwhile."
            },
            "points": 7
          },
          {
            "id": "online-vs-store",
            "type": "multiple-choice",
            "question": "What's an advantage of shopping in physical stores?",
            "options": [
              "Always cheaper prices",
              "Can touch/try products",
              "No sales tax",
              "Faster delivery"
            ],
            "correctAnswer": "Can touch/try products",
            "feedback": {
              "correct": "Right! Physical stores let you examine quality and fit before buying.",
              "incorrect": "The main advantage of physical stores is being able to touch, try on, and examine products firsthand."
            },
            "points": 8
          }
        ]
      },
      {
        "id": "spending-level-3",
        "moduleId": "smart-spending",
        "levelNumber": 3,
        "title": "Avoiding Impulse Purchases",
        "description": "Master techniques to resist unnecessary spending and stick to your budget",
        "xpReward": 40,
        "exercises": [
          {
            "id": "waiting-period",
            "type": "multiple-choice",
            "question": "What's the '24-hour rule' for purchases?",
            "options": [
              "Shop only during 24-hour stores",
              "Wait 24 hours before buying non-essentials",
              "Spend only 24 hours shopping",
              "Return items within 24 hours"
            ],
            "correctAnswer": "Wait 24 hours before buying non-essentials",
            "feedback": {
              "correct": "Perfect! Waiting 24 hours helps you determine if you really need something.",
              "incorrect": "The 24-hour rule means waiting a day before buying non-essential items to avoid impulse purchases."
            },
            "points": 10
          },
          {
            "id": "shopping-list",
            "type": "true-false",
            "question": "Making a shopping list and sticking to it can prevent impulse purchases.",
            "correctAnswer": "true",
            "feedback": {
              "correct": "Absolutely! Lists keep you focused and help resist unplanned purchases.",
              "incorrect": "Shopping lists are one of the best tools for avoiding impulse buys and staying on budget."
            },
            "points": 8
          },
          {
            "id": "emotional-spending",
            "type": "scenario",
            "question": "You had a bad day and want to buy expensive shoes to feel better. What should you do?",
            "options": [
              "Buy them immediately",
              "Buy cheaper shoes instead",
              "Wait and find free mood boosters",
              "Use a credit card"
            ],
            "correctAnswer": "Wait and find free mood boosters",
            "feedback": {
              "correct": "Smart choice! Exercise, calling friends, or hobbies can boost mood without breaking your budget.",
              "incorrect": "Emotional spending leads to regret. Try free alternatives like exercise, music, or talking to friends first."
            },
            "points": 12
          },
          {
            "id": "marketing-tricks",
            "type": "multiple-choice",
            "question": "Which is a common marketing trick to encourage impulse buying?",
            "options": [
              "Detailed product information",
              "Limited time offers",
              "Price comparisons",
              "Customer reviews"
            ],
            "correctAnswer": "Limited time offers",
            "feedback": {
              "correct": "Exactly! 'Limited time' creates urgency to buy without thinking it through.",
              "incorrect": "'Limited time offers' create artificial urgency to make you buy without proper consideration."
            },
            "points": 9
          },
          {
            "id": "budget-integration",
            "type": "multiple-choice",
            "question": "Before making any purchase, you should:",
            "options": [
              "Check if it fits your budget",
              "Ask friends for opinions",
              "Look for coupons",
              "Buy the most expensive version"
            ],
            "correctAnswer": "Check if it fits your budget",
            "feedback": {
              "correct": "Perfect! Every purchase should align with your budget and financial goals.",
              "incorrect": "Always check your budget first. If it doesn't fit, you shouldn't buy it, regardless of the deal."
            },
            "points": 10
          }
        ]
      }
    ]
  },
  {
    "id": "saving-investing",
    "title": "Saving & Investing",
    "description": "Build wealth through smart saving strategies and basic investment principles",
    "icon": "TrendingUp",
    "totalLevels": 3,
    "estimatedTime": "30 minutes",
    "levels": [
      {
        "id": "saving-level-1",
        "moduleId": "saving-investing",
        "levelNumber": 1,
        "title": "Emergency Fund Basics",
        "description": "Learn why and how to build your financial safety net",
        "xpReward": 35,
        "exercises": [
          {
            "id": "emergency-purpose",
            "type": "multiple-choice",
            "question": "What is the main purpose of an emergency fund?",
            "options": [
              "To buy things you want",
              "To cover unexpected expenses",
              "To invest in stocks",
              "To pay regular bills"
            ],
            "correctAnswer": "To cover unexpected expenses",
            "feedback": {
              "correct": "Exactly! Emergency funds protect you from job loss, medical bills, car repairs, and other surprises.",
              "incorrect": "Emergency funds are specifically for unexpected expenses like job loss, medical emergencies, or major repairs."
            },
            "points": 9
          },
          {
            "id": "emergency-amount",
            "type": "scenario",
            "question": "Lisa's monthly expenses are $2,500. How much should her emergency fund be?",
            "options": [
              "$2,500 (1 month)",
              "$5,000 (2 months)", 
              "$7,500 - $15,000 (3-6 months)",
              "$30,000 (12 months)"
            ],
            "correctAnswer": "$7,500 - $15,000 (3-6 months)",
            "feedback": {
              "correct": "Perfect! 3-6 months of expenses ($7,500-$15,000) is the recommended emergency fund size.",
              "incorrect": "Emergency funds should cover 3-6 months of expenses. For Lisa: $2,500 × 3-6 = $7,500-$15,000."
            },
            "points": 10
          },
          {
            "id": "emergency-access",
            "type": "multiple-choice",
            "question": "Where should you keep your emergency fund?",
            "options": [
              "High-risk stocks",
              "Under your mattress",
              "High-yield savings account",
              "Expensive jewelry"
            ],
            "correctAnswer": "High-yield savings account",
            "feedback": {
              "correct": "Right! High-yield savings accounts are safe, accessible, and earn some interest.",
              "incorrect": "Emergency funds need to be safe and accessible. High-yield savings accounts offer both safety and some growth."
            },
            "points": 9
          },
          {
            "id": "emergency-priority",
            "type": "true-false",
            "question": "You should build your emergency fund before focusing on other savings goals.",
            "correctAnswer": "true",
            "feedback": {
              "correct": "Absolutely! Emergency funds are your financial foundation - build them first.",
              "incorrect": "Emergency funds should be your first priority. They protect all your other financial progress."
            },
            "points": 8
          },
          {
            "id": "emergency-examples",
            "type": "multiple-choice",
            "question": "Which is NOT a good reason to use emergency funds?",
            "options": [
              "Job loss",
              "Major car repair",
              "Vacation to Hawaii",
              "Medical emergency"
            ],
            "correctAnswer": "Vacation to Hawaii",
            "feedback": {
              "correct": "Correct! Vacations are planned expenses, not emergencies. Save separately for fun!",
              "incorrect": "Vacations should be planned and saved for separately. Emergency funds are only for unexpected situations."
            },
            "points": 8
          }
        ]
      },
      {
        "id": "saving-level-2",
        "moduleId": "saving-investing",
        "levelNumber": 2,
        "title": "Savings Goals & Strategies",
        "description": "Set and achieve specific financial goals with proven strategies",
        "xpReward": 40,
        "exercises": [
          {
            "id": "smart-goals",
            "type": "multiple-choice",
            "question": "What makes a savings goal 'SMART'?",
            "options": [
              "Specific, Measurable, Achievable, Relevant, Time-bound",
              "Simple, Money-focused, Automatic, Realistic, Timely",
              "Safe, Modern, Advanced, Reliable, Tested",
              "Strategic, Monthly, Annual, Regular, Targeted"
            ],
            "correctAnswer": "Specific, Measurable, Achievable, Relevant, Time-bound",
            "feedback": {
              "correct": "Perfect! SMART goals are clear, trackable, realistic, meaningful, and have deadlines.",
              "incorrect": "SMART stands for Specific, Measurable, Achievable, Relevant, and Time-bound goals."
            },
            "points": 10
          },
          {
            "id": "savings-calculation",
            "type": "scenario",
            "question": "You want to save $3,600 for vacation in 12 months. How much should you save monthly?",
            "options": [
              "$200",
              "$250",
              "$300",
              "$350"
            ],
            "correctAnswer": "$300",
            "feedback": {
              "correct": "Excellent math! $3,600 ÷ 12 months = $300 per month.",
              "incorrect": "Let's calculate: $3,600 goal ÷ 12 months = $300 per month needed."
            },
            "points": 10
          },
          {
            "id": "automatic-savings",
            "type": "true-false",
            "question": "Setting up automatic transfers to savings helps you save consistently.",
            "correctAnswer": "true",
            "feedback": {
              "correct": "Absolutely! Automation removes the temptation to skip saving and builds consistency.",
              "incorrect": "Automatic savings transfers are one of the most effective ways to save consistently without thinking about it."
            },
            "points": 8
          },
          {
            "id": "pay-yourself-first",
            "type": "multiple-choice",
            "question": "What does 'pay yourself first' mean?",
            "options": [
              "Give yourself a salary raise",
              "Save money before paying any bills",
              "Save money before spending on wants",
              "Pay off debt before saving"
            ],
            "correctAnswer": "Save money before spending on wants",
            "feedback": {
              "correct": "Right! Save for your goals before spending on non-essential items.",
              "incorrect": "'Pay yourself first' means prioritizing savings over discretionary spending, not skipping bills."
            },
            "points": 9
          },
          {
            "id": "savings-motivation",
            "type": "multiple-choice",
            "question": "What's a good way to stay motivated to save?",
            "options": [
              "Ignore your progress",
              "Visualize your goal and track progress",
              "Only save when you feel like it",
              "Save the same amount forever"
            ],
            "correctAnswer": "Visualize your goal and track progress",
            "feedback": {
              "correct": "Perfect! Visualization and progress tracking keep you motivated and on track.",
              "incorrect": "Visualizing your goal and tracking progress helps maintain motivation during the saving journey."
            },
            "points": 9
          }
        ]
      },
      {
        "id": "saving-level-3",
        "moduleId": "saving-investing",
        "levelNumber": 3,
        "title": "Investment Fundamentals",
        "description": "Learn the basics of growing your money through smart investments",
        "xpReward": 45,
        "exercises": [
          {
            "id": "compound-interest",
            "type": "multiple-choice",
            "question": "What is compound interest?",
            "options": [
              "Interest on borrowed money",
              "Interest earned on interest",
              "Interest that compounds problems",
              "Interest paid monthly"
            ],
            "correctAnswer": "Interest earned on interest",
            "feedback": {
              "correct": "Exactly! Compound interest is earning interest on your original money plus previous interest earned.",
              "incorrect": "Compound interest means earning interest on both your original investment and previously earned interest."
            },
            "points": 10
          },
          {
            "id": "risk-return",
            "type": "multiple-choice",
            "question": "What's the general relationship between risk and return in investing?",
            "options": [
              "Higher risk, lower return",
              "Higher risk, higher potential return",
              "Risk and return are unrelated",
              "Lower risk, higher return"
            ],
            "correctAnswer": "Higher risk, higher potential return",
            "feedback": {
              "correct": "Right! Generally, investments with higher risk offer higher potential returns (but also higher potential losses).",
              "incorrect": "In investing, higher risk typically comes with higher potential returns, but also higher potential losses."
            },
            "points": 10
          },
          {
            "id": "diversification",
            "type": "scenario",
            "question": "You have $1,000 to invest. What's the best approach?",
            "options": [
              "Put it all in one stock",
              "Spread it across different investments",
              "Keep it all in cash",
              "Buy only cryptocurrency"
            ],
            "correctAnswer": "Spread it across different investments",
            "feedback": {
              "correct": "Smart! Diversification reduces risk by not putting all your eggs in one basket.",
              "incorrect": "Diversification (spreading investments) reduces risk. Don't put all your money in one investment type."
            },
            "points": 12
          },
          {
            "id": "time-advantage",
            "type": "true-false",
            "question": "Starting to invest early gives you a significant advantage due to compound interest.",
            "correctAnswer": "true",
            "feedback": {
              "correct": "Absolutely! Time is your biggest advantage - the earlier you start, the more compound interest works for you.",
              "incorrect": "Time is crucial in investing. Starting early gives compound interest more time to work its magic."
            },
            "points": 9
          },
          {
            "id": "investment-types",
            "type": "multiple-choice",
            "question": "Which is generally considered the safest investment?",
            "options": [
              "Individual stocks",
              "Cryptocurrency",
              "Government bonds",
              "Commodities"
            ],
            "correctAnswer": "Government bonds",
            "feedback": {
              "correct": "Correct! Government bonds are backed by the government and considered very safe investments.",
              "incorrect": "Government bonds are considered among the safest investments because they're backed by government stability."
            },
            "points": 9
          },
          {
            "id": "investment-timeline",
            "type": "multiple-choice",
            "question": "For long-term goals (10+ years), which investment type typically performs best?",
            "options": [
              "Savings accounts",
              "Stock market investments",
              "Cash under mattress",
              "Certificate of deposits"
            ],
            "correctAnswer": "Stock market investments",
            "feedback": {
              "correct": "Right! Over long periods, stocks historically outperform other investment types despite short-term volatility.",
              "incorrect": "Historically, stock market investments have provided the best long-term returns, despite short-term ups and downs."
            },
            "points": 10
          }
        ]
      }
    ]
  }
];

// Achievement badges
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
    id: "first-lesson",
    title: "Getting Started",
    description: "Complete your first lesson",
    icon: "Star",
    requirement: "Complete 1 lesson",
    xpRequired: 25,
    badgeColor: "bg-blue-500"
  },
  {
    id: "budget-master",
    title: "Budget Master",
    description: "Complete the Budgeting Basics module",
    icon: "Calculator",
    requirement: "Complete Budgeting Basics module",
    xpRequired: 105,
    badgeColor: "bg-green-500"
  },
  {
    id: "smart-spender",
    title: "Smart Spender", 
    description: "Complete the Smart Spending module",
    icon: "ShoppingCart",
    requirement: "Complete Smart Spending module",
    xpRequired: 210,
    badgeColor: "bg-purple-500"
  },
  {
    id: "future-planner",
    title: "Future Planner",
    description: "Complete the Saving & Investing module", 
    icon: "TrendingUp",
    requirement: "Complete Saving & Investing module",
    xpRequired: 330,
    badgeColor: "bg-orange-500"
  },
  {
    id: "streak-3",
    title: "Consistent Learner",
    description: "Maintain a 3-day learning streak",
    icon: "Flame",
    requirement: "3-day streak",
    xpRequired: 100,
    badgeColor: "bg-red-500"
  },
  {
    id: "perfectionist",
    title: "Perfectionist",
    description: "Score 100% on 5 lessons",
    icon: "Award",
    requirement: "Perfect scores on 5 lessons",
    xpRequired: 200,
    badgeColor: "bg-yellow-500"
  },
  {
    id: "dedicated-learner",
    title: "Dedicated Learner",
    description: "Complete all 9 lessons",
    icon: "Trophy",
    requirement: "Complete all modules",
    xpRequired: 330,
    badgeColor: "bg-gold-500"
  }
];