// High-quality, engaging financial literacy course content
// Comprehensive educational content following modern edtech principles and gamification best practices

export interface ContentBlock {
  id: string;
  type: 'text' | 'example' | 'tip' | 'warning' | 'scenario' | 'interactive';
  title?: string;
  content: string;
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
}

export interface CourseLevel {
  id: string;
  title: string;
  description: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  estimatedTime: string;
  xpReward: number;
  learningObjectives: string[];
  tabs: TabSection[];
  exercises: Exercise[];
}

export interface CourseModule {
  id: string;
  title: string;
  description: string;
  icon: string;
  estimatedTime: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  totalLevels: number;
  levels: CourseLevel[];
}

export const COURSE_CONTENT: CourseModule[] = [
  {
    id: "budgeting-basics",
    title: "Budgeting Basics",
    description: "Master the fundamentals of personal budgeting with real-world strategies that actually work",
    icon: "Calculator",
    estimatedTime: "15 minutes",
    difficulty: "Beginner",
    totalLevels: 1,
    levels: [
      {
        id: "level-1",
        title: "Foundation - Understanding Your Money Flow",
        description: "Learn to track and categorize your financial flow like a pro",
        difficulty: "Beginner",
        estimatedTime: "5 minutes",
        xpReward: 50,
        learningObjectives: [
          "Identify all sources of income, including hidden ones",
          "Categorize expenses into needs vs wants effectively", 
          "Understand cash flow patterns and timing",
          "Recognize money leaks that drain your budget"
        ],
        tabs: [
          {
            id: "income-tracking",
            title: "Income Tracking",
            icon: "💰",
            content: [
              {
                id: "income-intro",
                type: "text",
                title: "Beyond Your Paycheck: The Complete Income Picture",
                content: "Most people think income is just their salary. Wrong! Let's discover ALL the money flowing into your life.\n\nTrue income includes: your main job, side hustles, freelance work, rental income, investment dividends, cash gifts, tax refunds, cashback rewards, and even money you find in old coat pockets.\n\nWhy does this matter? Because tracking only your main salary gives you an incomplete picture. You might have $300 more per month than you realize!"
              },
              {
                id: "income-example",
                type: "example", 
                title: "Sarah's Income Discovery",
                content: "Sarah thought she made $3,200/month from her job. After tracking everything for one month, she discovered:\n\n• Main job: $3,200\n• Weekend tutoring: $320\n• Cashback rewards: $45\n• Tax refund (monthly avg): $150\n• Selling old items: $80\n\nTotal: $3,795/month - that's $595 more than she thought! This extra money completely changed her budget strategy."
              },
              {
                id: "income-tip",
                type: "tip",
                title: "The 30-Day Income Challenge",
                content: "For the next 30 days, track EVERY dollar that enters your life. Use your phone's notes app or a simple notebook. Include:\n\n✓ Paychecks and freelance payments\n✓ Cash from friends (even $5 for coffee)\n✓ Refunds and cashback\n✓ Money from selling items\n✓ Gift money\n\nAt month's end, you'll be amazed at your real income number!"
              },
              {
                id: "income-warning",
                type: "warning",
                title: "The Irregular Income Trap",
                content: "If your income varies monthly (freelancers, commission workers, seasonal jobs), NEVER budget based on your best month. Instead:\n\n• Calculate your lowest 3 months average\n• Use that as your baseline budget\n• Treat higher months as bonus money for savings/debt payoff\n\nThis prevents the feast-or-famine cycle that destroys budgets."
              }
            ]
          },
          {
            id: "expense-categories",
            title: "Expense Categories",
            icon: "🏷️",
            content: [
              {
                id: "expense-intro",
                type: "text",
                title: "The Smart Way to Categorize Your Spending",
                content: "Most budgeting advice gives you 20+ categories that overwhelm and confuse. We're going simple with the 4-Category System that actually works:\n\n1. **Fixed Needs** (rent, insurance, debt minimums)\n2. **Variable Needs** (groceries, gas, utilities)\n3. **Wants** (entertainment, dining out, hobbies)\n4. **Future You** (savings, investments, extra debt payments)\n\nThis system is simple enough to follow but detailed enough to control your money."
              },
              {
                id: "expense-scenario",
                type: "scenario",
                title: "The Latte Factor Myth",
                content: "You've heard 'skip the $5 latte and save $1,800/year.' But what if I told you that advice misses the point?\n\nThe real question isn't whether you can afford a latte. It's whether you're spending intentionally.\n\nIf you budget $50/month for coffee and genuinely enjoy it, buy the latte! But if you're mindlessly spending $150/month on coffee while struggling to save, that's the real problem.\n\nThink about it: What's one expense you spend on automatically without really enjoying it anymore?"
              },
              {
                id: "expense-interactive",
                type: "interactive",
                title: "Quick Category Challenge",
                content: "Look at your last 5 purchases (check your phone's payment apps). For each one, ask:\n\n1. Which category does this fit?\n2. Did I plan this purchase?\n3. Did it bring me joy or value?\n4. Would I buy it again?\n\nThis quick exercise reveals your spending patterns instantly. Most people discover they have 2-3 'autopilot' expenses they don't even enjoy anymore."
              },
              {
                id: "expense-tip",
                type: "tip",
                title: "The 24-Hour Rule for Wants",
                content: "Before buying anything in the 'Wants' category over $50, wait 24 hours. Put the item in your online cart but don't buy it.\n\nReturn the next day and ask: 'Do I still want this? Do I have space for it? Does it align with my goals?'\n\nThis simple pause prevents 70% of impulse purchases. Your future self will thank you!"
              }
            ]
          },
          {
            id: "cash-flow-basics",
            title: "Cash Flow Analysis",
            icon: "📊",
            content: [
              {
                id: "cashflow-intro",
                type: "text",
                title: "Cash Flow: The Secret to Never Being Broke",
                content: "Cash flow isn't about how much you make - it's about WHEN money comes in versus when it goes out. Master this, and you'll never stress about money timing again.\n\nCash flow timing matters because:\n• Rent is due on the 1st, but you get paid on the 15th\n• Annual insurance payments hit all at once\n• Holiday spending clusters in December\n• Car repairs never happen at convenient times\n\nGood cash flow management means having money available when you need it, not just overall."
              },
              {
                id: "cashflow-example",
                type: "example",
                title: "Mike's Cash Flow Nightmare (And Solution)",
                content: "Mike earns $4,000/month but was always broke by month-end. His problem? Terrible cash flow timing:\n\n**Old Pattern:**\n• Gets paid on 15th and 30th ($2,000 each)\n• Rent due 1st ($1,200)\n• Always short for first 2 weeks\n\n**Solution:**\n• Opened a 'Bill Pay' savings account\n• Automatically saves $1,500 each payday\n• Bills get paid from this account\n• No more cash flow stress!\n\nNow Mike's money flows smoothly all month long."
              },
              {
                id: "cashflow-tip",
                type: "tip",
                title: "The Cash Flow Calendar Trick",
                content: "Create a simple calendar showing:\n\n📅 When money comes IN (paychecks, freelance payments)\n💸 When money goes OUT (rent, bills, subscriptions)\n\nLook for gaps where expenses exceed incoming money. These are your 'danger zones' where you need extra cash available.\n\nPro tip: If you get paid twice monthly, save half your rent from the first paycheck. This eliminates the biggest cash flow challenge most people face!"
              },
              {
                id: "cashflow-warning",
                type: "warning",
                title: "The Annual Expense Ambush",
                content: "Annual expenses destroy budgets because they feel like emergencies but aren't. Common annual ambushes:\n\n• Car registration and insurance renewals\n• Holiday and birthday gifts\n• Tax preparation fees\n• Amazon Prime renewals\n• Vacation costs\n\nSolution: Calculate your total annual expenses, divide by 12, and save that amount monthly in a separate 'Annual Expenses' account. When these 'surprise' bills hit, you're ready!"
              }
            ]
          }
        ],
        exercises: [
          {
            id: "ex-1-income",
            type: "multiple-choice",
            question: "Sarah discovers she has $595 more monthly income than she thought. What's the smartest first move with this extra money?",
            options: [
              "Increase her fun spending by $595",
              "Save $400 and increase fun spending by $195", 
              "Put it all toward debt payoff immediately",
              "Ignore it since it's not guaranteed"
            ],
            correctAnswer: "Save $400 and increase fun spending by $195",
            explanation: "A balanced approach works best. Save most of the 'found' money (it builds good habits) but allow some lifestyle improvement to stay motivated.",
            feedback: {
              correct: "Exactly! The 70/30 split (save most, enjoy some) creates sustainable financial habits.",
              incorrect: "Not quite. The best approach balances saving with enjoyment to maintain motivation."
            },
            points: 10
          },
          {
            id: "ex-2-categories",
            type: "matching",
            question: "Match each expense to the correct category in our 4-Category System:",
            options: ["Rent payment", "Netflix subscription", "Emergency fund contribution", "Grocery shopping"],
            correctAnswer: ["Fixed Needs", "Wants", "Future You", "Variable Needs"],
            explanation: "Fixed Needs don't change month to month. Variable Needs fluctuate but are necessary. Wants are optional. Future You is money for your future self.",
            feedback: {
              correct: "Perfect! You understand how to categorize expenses for effective budgeting.",
              incorrect: "Review the 4-Category System. Think about whether each expense is necessary and whether the amount changes monthly."
            },
            points: 15
          },
          {
            id: "ex-3-cashflow",
            type: "true-false", 
            question: "True or False: If you earn $3,000/month and spend $2,800/month, you have good cash flow management.",
            correctAnswer: "False",
            explanation: "Earning more than you spend is great, but cash flow management is about TIMING. You need money available when bills are due, not just a positive monthly balance.",
            feedback: {
              correct: "Correct! Cash flow is about timing, not just the total amounts.",
              incorrect: "Remember: cash flow management is about having money available when you need it, not just earning more than you spend overall."
            },
            points: 10
          }
        ]
      }
    ]
  },
  
  {
    id: "debt-management",
    title: "Debt Management",
    description: "Strategic approaches to eliminate debt and build financial freedom",
    icon: "TrendingUp",
    estimatedTime: "12 minutes",
    difficulty: "Beginner",
    totalLevels: 1,
    levels: [
      {
        id: "debt-level-1",
        title: "Understanding Your Debt",
        description: "Get a clear picture of your debt situation and create an action plan",
        difficulty: "Beginner",
        estimatedTime: "4 minutes", 
        xpReward: 40,
        learningObjectives: [
          "Calculate your true debt picture",
          "Understand different types of debt",
          "Learn debt prioritization strategies",
          "Identify quick wins for debt reduction"
        ],
        tabs: [
          {
            id: "debt-assessment",
            title: "Debt Assessment",
            icon: "📋",
            content: [
              {
                id: "debt-intro",
                type: "text",
                title: "Your Debt Reality Check",
                content: "Most people avoid looking at their total debt because it's scary. But here's the truth: the number doesn't change whether you look at it or not. What changes is your power to do something about it.\n\nWe're going to face your debt head-on and create a plan that works. No shame, no judgment - just clear action steps.\n\nFirst, gather these documents:\n• Credit card statements\n• Student loan details\n• Car loan information\n• Personal loan documents\n• Any money owed to family/friends"
              },
              {
                id: "debt-example",
                type: "example",
                title: "Jessica's Debt Wake-Up Call",
                content: "Jessica avoided checking her debt for months. When she finally faced it:\n\n• Credit Card 1: $3,200 (22% APR)\n• Credit Card 2: $1,800 (18% APR)\n• Student Loan: $18,000 (6% APR)\n• Car Loan: $12,000 (4% APR)\n\nTotal: $35,000\n\nScary? Yes. But now she had a clear target. Within 2 years, she paid off both credit cards and made serious progress on other debts. The first step was just knowing the numbers."
              },
              {
                id: "debt-tip",
                type: "tip",
                title: "The Debt Inventory Method",
                content: "Create a simple list with 4 columns:\n\n1. Debt Name (which card/loan)\n2. Balance Owed\n3. Interest Rate (APR)\n4. Minimum Payment\n\nThen calculate:\n• Total debt amount\n• Total minimum payments\n• Average interest rate\n\nThis 5-minute exercise gives you complete clarity on your debt situation. Knowledge is power!"
              }
            ]
          }
        ],
        exercises: [
          {
            id: "debt-ex-1",
            type: "multiple-choice",
            question: "If you have limited extra money for debt payoff, which debt should you typically pay off first?",
            options: [
              "The largest balance",
              "The debt with the highest interest rate",
              "The debt with the lowest balance",
              "Student loans because they're 'good debt'"
            ],
            correctAnswer: "The debt with the highest interest rate",
            explanation: "Paying off high-interest debt first saves you the most money in interest charges over time. This is called the 'avalanche method.'",
            feedback: {
              correct: "Correct! High-interest debt costs you the most money, so eliminating it first saves you more.",
              incorrect: "While there are different strategies, paying off high-interest debt first typically saves the most money in the long run."
            },
            points: 10
          }
        ]
      }
    ]
  },

  {
    id: "smart-saving-strategies", 
    title: "Smart Saving Strategies",
    description: "Transform from broke to wealthy with psychologically proven saving systems that work on autopilot",
    icon: "ShoppingCart",
    estimatedTime: "45 minutes",
    difficulty: "Intermediate",
    totalLevels: 3,
    levels: [
      {
        id: "saving-psychology-mastery",
        title: "💰 The Savings Psychology Revolution",
        description: "Hack your brain to make saving money feel as addictive as spending it",
        difficulty: "Beginner",
        estimatedTime: "12 minutes",
        xpReward: 100,
        learningObjectives: [
          "Master the psychology triggers that make saving effortless and exciting",
          "Identify and eliminate your personal money leaks that drain $300-800 monthly",
          "Build neural pathways that make saving feel like winning a game",
          "Create your personalized savings identity transformation"
        ],
        tabs: [
          {
            id: "psychology-mastery",
            title: "Psychology Mastery",
            icon: "🧠",
            content: [
              {
                id: "savings-revolution-intro",
                type: "text",
                title: "🚀 Welcome to the Savings Revolution!",
                content: "You're about to discover why 95% of people fail at saving (and how to join the successful 5%). This isn't about willpower or cutting out coffee - it's about rewiring your brain to crave wealth building.\n\nBy the end of this lesson, saving money will feel like leveling up in your favorite video game. You'll actually get excited about watching your money grow!"
              },
              {
                id: "successful-saver-psychology",
                type: "example",
                title: "🎯 The Millionaire Mindset Secret",
                content: "Research from Harvard Business School reveals successful savers think completely differently:\n\n**Average Person Thinks:**\n❌ 'I'm giving up something I want'\n❌ 'Saving is boring and restrictive'\n❌ 'I'll start saving when I earn more'\n❌ 'Small amounts don't matter'\n\n**Millionaire Mindset:**\n✅ 'I'm buying my future freedom'\n✅ 'Saving is exciting wealth building'\n✅ 'I pay myself first, always'\n✅ 'Every dollar is a wealth seed'\n\nThe difference? Millionaires see saving as the most profitable investment they'll ever make - investing in themselves!"
              },
              {
                id: "psychology-hacks",
                type: "interactive",
                title: "🎮 Brain Hacking Challenge",
                content: "Try this 2-minute psychology experiment:\n\n1. **Close your eyes** and imagine yourself 10 years from now, financially free\n2. **Feel the emotions** - no money stress, unlimited options, true choice\n3. **Open your eyes** and look at any item you're considering buying\n4. **Ask:** 'Is this item worth delaying my financial freedom?'\n\nMost people discover 70% of their purchases suddenly feel less important. Your brain just experienced the power of future-focused thinking!\n\n💡 **Pro Tip:** Do this exercise before any purchase over $50. Watch your spending transform instantly."
              },
              {
                id: "instant-vs-future-battle",
                type: "scenario",
                title: "⚔️ The Internal Money War",
                content: "Every spending decision is a battle between two versions of yourself:\n\n**🔥 Instant You (The Spender):**\n• Wants everything NOW\n• Ignores consequences\n• Uses emotions to justify purchases\n• Thinks 'I deserve this'\n• Lives paycheck to paycheck\n\n**💎 Future You (The Wealth Builder):**\n• Thinks 10 years ahead\n• Values long-term happiness\n• Makes logical money decisions\n• Invests in appreciation\n• Builds generational wealth\n\nWho's winning your money war? Every dollar you save is a victory for Future You. Every impulse purchase is Instant You stealing from your dreams.\n\nWhich version of yourself do you want to strengthen?"
              }
            ]
          },
          {
            id: "money-leak-detective",
            title: "Money Leak Detective",
            icon: "🕵️",
            content: [
              {
                id: "money-leak-intro",
                type: "text",
                title: "🕵️ Become a Money Leak Detective",
                content: "The average person hemorrhages $400-800 monthly in 'money leaks' - small expenses that provide zero value but drain wealth. We're going to find YOUR leaks and redirect that money toward building your dreams!\n\nMoney leaks are sneaky because they:\n• Feel small individually ($5 here, $15 there)\n• Happen automatically (subscriptions, habits)\n• Provide minimal joy or value\n• Add up to massive wealth theft over time\n\nReady to catch these financial criminals in action?"
              },
              {
                id: "common-money-leaks",
                type: "warning",
                title: "🚨 The Wealth Killer List",
                content: "**The Big 5 Money Leaks:**\n\n💸 **Subscription Creep** ($50-150/month)\n• Streaming services you forgot about\n• Apps with auto-renewing subscriptions\n• Gym memberships you never use\n• Software subscriptions gathering digital dust\n\n☕ **Convenience Addiction** ($80-200/month)\n• Daily coffee shop visits\n• Food delivery fees and tips\n• Convenience store price markups\n• Gas station snacks and drinks\n\n🛒 **Impulse Shopping** ($100-300/month)\n• Amazon 'quick purchases'\n• Checkout line additions\n• Sale items you don't need\n• Emotional spending during stress\n\n🚗 **Transportation Waste** ($50-150/month)\n• Uber/Lyft for walkable distances\n• Premium gas when regular works fine\n• Expensive parking when free options exist\n• Car washes you could do yourself\n\n📱 **Digital Drain** ($30-80/month)\n• In-app purchases and upgrades\n• Premium features you rarely use\n• Multiple music/video subscriptions\n• Cloud storage you don't need"
              },
              {
                id: "leak-audit-challenge",
                type: "interactive",
                title: "🔍 The 7-Day Money Leak Audit",
                content: "**Your Mission:** Track every expense for 7 days and identify your personal money leaks.\n\n**Day 1-3: Investigation Phase**\n✓ Photo every receipt (even $1 purchases)\n✓ Log every digital transaction immediately\n✓ Note your emotions when spending\n✓ Track time and location of purchases\n\n**Day 4-5: Pattern Recognition**\n✓ Group similar expenses together\n✓ Calculate weekly totals by category\n✓ Identify your biggest spending triggers\n✓ Spot recurring 'autopilot' purchases\n\n**Day 6-7: Wealth Recovery**\n✓ Circle expenses that provided zero value\n✓ Calculate potential monthly/yearly savings\n✓ Choose 3 leaks to eliminate immediately\n✓ Set up automatic transfers for saved money\n\n**Expected Result:** Most people find $200-500 in monthly money leaks they can redirect to wealth building!"
              },
              {
                id: "value-based-spending",
                type: "tip",
                title: "💎 The Value Filter System",
                content: "Stop cutting randomly! Align spending with your core values:\n\n**Step 1: Define Your Values**\nList your top 5 life values (examples: family, freedom, health, travel, security)\n\n**Step 2: Apply the Value Filter**\nBefore any purchase over $25, ask: 'Does this support my core values?'\n\n**Step 3: Redirect Non-Value Spending**\n✅ Value-aligned: Spend guilt-free and enjoy fully\n❌ Non-aligned: Redirect money to savings with excitement\n\n**Real Example:**\nSarah values travel and health. She:\n• CUT: $200/month on clothes (not value-aligned)\n• KEPT: $150/month gym + healthy food (health value)\n• ADDED: $150/month travel fund (travel value)\n• RESULT: Same spending, perfect alignment, plus $50/month extra savings!\n\nValue-based spending doesn't feel like sacrifice - it feels like investing in what matters most."
              }
            ]
          },
          {
            id: "habit-engineering",
            title: "Habit Engineering",
            icon: "⚙️",
            content: [
              {
                id: "habit-science",
                type: "text",
                title: "⚙️ The Science of Unbreakable Savings Habits",
                content: "Forget willpower - it's unreliable and exhausting! We're going to engineer your environment so saving becomes as automatic as brushing your teeth.\n\nHabit science reveals:\n• 45% of daily actions are habits, not decisions\n• Environmental design beats willpower 10-to-1\n• Small habits compound into massive life changes\n• Automation eliminates decision fatigue\n\nYou're about to build a savings system that works even when motivation disappears!"
              },
              {
                id: "habit-loop-mastery",
                type: "example",
                title: "🔄 The Millionaire Habit Loop",
                content: "Every powerful habit follows the same 3-step loop. Master this pattern and saving becomes effortless:\n\n**1. CUE (Trigger) →**\n• Payday notification arrives\n• Weekly money check-in alarm\n• Morning coffee routine\n• End-of-month budget review\n\n**2. ROUTINE (Action) →**\n• Transfer money to savings\n• Review and adjust goals\n• Celebrate progress made\n• Plan next month's targets\n\n**3. REWARD (Feeling) →**\n• Pride in growing wealth\n• Peace of mind about future\n• Excitement about goals\n• Sense of control and power\n\n**Real Example:**\nTom's Million-Dollar Habit:\n• **CUE:** Friday morning coffee\n• **ROUTINE:** Transfer $100 to investments while drinking coffee\n• **REWARD:** Checks account balance and feels wealthy\n\nAfter 2 months, Tom craved his 'wealth building coffee time.' The habit became addictive!"
              },
              {
                id: "environment-design",
                type: "interactive",
                title: "🏗️ Design Your Wealth Environment",
                content: "**Your 24-Hour Environment Makeover:**\n\n**REMOVE SPENDING FRICTION:**\n□ Delete shopping apps from phone\n□ Unsubscribe from promotional emails\n□ Remove saved credit cards from browsers\n□ Set up waiting periods for large purchases\n\n**ADD SAVING FRICTION:**\n□ Set up automatic transfers (make saving effortless)\n□ Use separate banks for checking vs. savings\n□ Set savings goals as phone wallpaper\n□ Join online savings communities for support\n\n**CREATE VISUAL REMINDERS:**\n□ Progress chart on bathroom mirror\n□ Goal photos on refrigerator\n□ Savings thermometer in workspace\n□ Wealth affirmations as phone lock screen\n\n**Psychological Principle:** Make good choices easier and bad choices harder. Your environment should guide you toward wealth building without willpower."
              },
              {
                id: "micro-habits",
                type: "tip",
                title: "🌱 Micro-Habits That Create Millionaires",
                content: "Start impossibly small to build unstoppable momentum:\n\n**Week 1:** Save $1 per day ($7 total)\n**Week 2:** Save $2 per day ($14 total)\n**Week 3:** Save $3 per day ($21 total)\n**Week 4:** Save $5 per day ($35 total)\n\nBy month 2, you're naturally saving $150/month!\n\n**The Science:** Small wins create confidence. Confidence creates bigger actions. Bigger actions create life transformation.\n\n**Advanced Micro-Habits:**\n• Round up every purchase to the nearest dollar, save the difference\n• Save every $5 bill you receive\n• Put loose change in a jar daily\n• Save the amount of any avoided impulse purchase\n\nThese tiny actions feel effortless but compound into wealth-building momentum!"
              }
            ]
          }
        ],
        exercises: [
          {
            id: "psychology-mastery-quiz",
            type: "multiple-choice",
            question: "According to the millionaire mindset research, what's the key difference between successful savers and everyone else?",
            options: [
              "They earn significantly more money",
              "They see saving as buying their future freedom, not giving up something",
              "They never spend money on anything fun",
              "They use complicated investment strategies"
            ],
            correctAnswer: "They see saving as buying their future freedom, not giving up something",
            explanation: "The mindset shift from 'sacrifice' to 'investment in freedom' is the foundation of effortless saving. When you see every saved dollar as buying future options, saving becomes exciting instead of restrictive.",
            feedback: {
              correct: "🎯 Exactly! This psychology shift transforms saving from painful to powerful.",
              incorrect: "The key is mindset, not income level or restriction. Successful savers get excited about building their future freedom."
            },
            points: 25
          },
          {
            id: "money-leak-detection",
            type: "scenario",
            question: "Alex tracks expenses and finds: $120/month unused subscriptions, $85/month convenience store purchases, $150/month impulse online shopping. What's the best strategy?",
            options: [
              "Cancel everything immediately and save all $355/month",
              "Cancel subscriptions ($120), reduce convenience spending by half ($42.50), redirect impulse money to goals",
              "Keep everything the same to avoid feeling deprived",
              "Only cancel subscriptions since they're the easiest to eliminate"
            ],
            correctAnswer: "Cancel subscriptions ($120), reduce convenience spending by half ($42.50), redirect impulse money to goals",
            explanation: "Strategic reduction works better than dramatic cuts. Cancel subscriptions (zero value), reduce convenience spending gradually, and redirect impulse money to exciting goals. This creates sustainable change without feeling deprived.",
            feedback: {
              correct: "🕵️ Perfect detective work! Strategic reduction creates lasting change without deprivation.",
              incorrect: "The best approach balances immediate savings with sustainable lifestyle changes."
            },
            points: 30
          },
          {
            id: "habit-loop-application",
            type: "multiple-choice",
            question: "Using the Habit Loop science, what would be the most effective CUE to trigger automatic saving behavior?",
            options: [
              "Hoping to remember to save when you feel motivated",
              "Setting up a payday notification that triggers an automatic transfer",
              "Waiting until the end of the month to see if there's money left",
              "Only saving when you have extra money after all expenses"
            ],
            correctAnswer: "Setting up a payday notification that triggers an automatic transfer",
            explanation: "A consistent, reliable cue (payday notification) paired with an automatic action (transfer) eliminates decision fatigue and builds the habit naturally. The best savers automate the routine so it happens without thinking.",
            feedback: {
              correct: "⚙️ Brilliant! You understand that automation beats motivation every time.",
              incorrect: "Remember: successful habits need consistent, reliable cues that trigger automatic actions."
            },
            points: 25
          },
          {
            id: "value-alignment-challenge",
            type: "true-false",
            question: "True or False: The Value Filter System means you should cut all non-essential spending to maximize savings.",
            correctAnswer: "False",
            explanation: "The Value Filter System means spending intentionally on what matters most to you while cutting spending that doesn't align with your values. It's about optimization, not elimination.",
            feedback: {
              correct: "💎 Correct! Value-based spending is about alignment, not restriction.",
              incorrect: "The Value Filter isn't about cutting everything - it's about spending intentionally on what truly matters to you."
            },
            points: 20
          }
        ]
      },
      {
        id: "emergency-fund-game-changer",
        title: "🛡️ Emergency Fund Game-Changer",
        description: "Build your financial force field that turns crises into minor inconveniences",
        difficulty: "Beginner",
        estimatedTime: "15 minutes",
        xpReward: 125,
        learningObjectives: [
          "Calculate your personalized emergency fund target using life situation analysis",
          "Choose optimal account strategies that maximize growth while maintaining instant access",
          "Implement rapid building systems that create financial security in months, not years",
          "Master the psychology of emergency preparedness without paranoia"
        ],
        tabs: [
          {
            id: "emergency-strategy",
            title: "Emergency Strategy",
            icon: "🎯",
            content: [
              {
                id: "emergency-fund-power",
                type: "text",
                title: "🛡️ Your Financial Force Field",
                content: "An emergency fund isn't just money in an account - it's your financial superpower! It's the difference between a crisis and a minor inconvenience, between panic and peace.\n\nWith an emergency fund, you're not just surviving - you're thriving with options:\n• Job loss becomes a career opportunity (time to find the RIGHT job)\n• Medical bills get handled calmly without debt\n• Car repairs don't derail your budget\n• Home emergencies get fixed immediately\n• You sleep peacefully knowing you're prepared\n\nWelcome to financial confidence!"
              },
              {
                id: "without-vs-with-fund",
                type: "example",
                title: "💥 The Tale of Two Emergencies",
                content: "**WITHOUT Emergency Fund:**\n\n*Sarah's car needs $800 repair*\n❌ Panics about finding the money\n❌ Puts repair on credit card (18% interest)\n❌ Minimum payments add $150 to total cost\n❌ Stress affects work and relationships\n❌ One emergency creates a debt spiral\n\n**WITH Emergency Fund:**\n\n*Maria's car needs $800 repair*\n✅ Calmly pays cash from emergency fund\n✅ No debt, no interest, no stress\n✅ Focuses on getting back to normal life\n✅ Rebuilds emergency fund over next 2 months\n✅ Emergency handled like a pro\n\nSame problem, completely different outcomes. Which story do you want to be yours?"
              },
              {
                id: "fund-size-calculator",
                type: "interactive",
                title: "🧮 Your Personal Emergency Fund Formula",
                content: "One size does NOT fit all! Calculate your ideal emergency fund:\n\n**STEP 1: Calculate Monthly Essentials**\n• Housing (rent/mortgage, utilities)\n• Food and groceries\n• Transportation (car payment, insurance, gas)\n• Insurance premiums\n• Debt minimums\n• Basic personal care\n\n**STEP 2: Choose Your Multiplier**\n• 3 months = Stable job, good support system\n• 6 months = Average stability, some concerns\n• 9 months = Variable income, single income household\n• 12 months = High-risk job, health concerns\n\n**STEP 3: Your Target**\nMonthly Essentials × Multiplier = Your Emergency Fund Goal\n\n**Example:**\n$2,500 monthly essentials × 6 months = $15,000 target\n\nWhat's your number? Write it down - this is your financial freedom target!"
              },
              {
                id: "speed-building-system",
                type: "tip",
                title: "⚡ The Emergency Fund Speed-Building System",
                content: "**PHASE 1: Starter Fund ($1,000) - Month 1-2**\n• Sell items you don't need (furniture, electronics, clothes)\n• Take temporary side gigs (delivery, freelance, odd jobs)\n• Use tax refund or bonuses\n• Temporarily pause non-essential spending\n\n**PHASE 2: Build to 3-Month Target - Month 3-8**\n• Automate 10-15% of income to emergency fund\n• Apply all money leak savings (from previous lesson)\n• Use birthday/holiday money\n• Consider temporary spending freeze challenges\n\n**PHASE 3: Full Fund Completion - Month 9-18**\n• Maintain automatic contributions\n• Add windfalls (raises, bonuses, gifts)\n• Review and adjust for life changes\n• Celebrate major milestones\n\n**Pro Tip:** The first $1,000 is the hardest. After that, momentum builds naturally!"
              }
            ]
          },
          {
            id: "account-optimization",
            title: "Account Optimization",
            icon: "💰",
            content: [
              {
                id: "account-strategy",
                type: "text",
                title: "🏦 The Ultimate Account Strategy",
                content: "Your emergency fund needs to be accessible BUT not too accessible (prevent temptation). It needs to earn interest BUT remain stable (no market risk).\n\nThe perfect emergency fund account:\n• Earns 4-5% interest (beats inflation)\n• FDIC insured (government protected)\n• Available within 24-48 hours (true emergency access)\n• Separate from daily banking (reduces temptation)\n• No penalties for withdrawals (unlike CDs)\n\nLet's find your perfect emergency fund home!"
              },
              {
                id: "account-showdown",
                type: "scenario",
                title: "📊 Emergency Fund Account Championship",
                content: "**🏆 HIGH-YIELD SAVINGS (THE CHAMPION)**\n✅ 4-5% APY (as of 2024)\n✅ FDIC insured up to $250,000\n✅ Available 24-48 hours\n✅ No minimums at best banks\n✅ Perfect balance of growth + safety\n\n**🥈 MONEY MARKET (STRONG CONTENDER)**\n✅ 3-4% APY typical\n✅ Often includes check-writing\n✅ Same-day access options\n⚠️ Usually requires higher minimums\n\n**🥉 CERTIFICATES OF DEPOSIT (LADDER STRATEGY)**\n✅ 4-5% APY but locked up\n✅ Good for portion of large emergency funds\n⚠️ Penalties for early withdrawal\n💡 Use 3-month CDs for part of fund\n\n**❌ REGULAR SAVINGS (AVOID)**\n❌ 0.01% APY (terrible return)\n❌ Your money loses value to inflation\n❌ Banks profit while you lose purchasing power"
              },
              {
                id: "account-setup-guide",
                type: "interactive",
                title: "🛠️ 24-Hour Account Setup Challenge",
                content: "**Today's Mission:** Set up your emergency fund account\n\n**STEP 1: Research (30 minutes)**\n□ Compare rates: Marcus, Ally, Capital One 360, Discover\n□ Check minimum requirements\n□ Read reviews for customer service\n□ Confirm FDIC insurance\n\n**STEP 2: Open Account (30 minutes)**\n□ Choose bank DIFFERENT from your checking\n□ Name it clearly: 'Emergency Fund - Do Not Touch'\n□ Don't request debit card (prevent temptation)\n□ Set up low balance alerts\n\n**STEP 3: Automate Funding (15 minutes)**\n□ Link to your checking account\n□ Set up automatic transfer for payday\n□ Start with comfortable amount\n□ Schedule first transfer within 48 hours\n\n**STEP 4: Track Progress (5 minutes)**\n□ Create visual progress tracker\n□ Set milestone celebrations\n□ Share goal with accountability partner\n□ Plan your 'fully funded' celebration\n\n**Completion Reward:** You've just taken the biggest step toward financial security!"
              },
              {
                id: "advanced-strategies",
                type: "tip",
                title: "🎯 Advanced Emergency Fund Strategies",
                content: "**THE CD LADDER (For Large Funds)**\n• Keep 1-2 months in high-yield savings\n• Put remaining months in 3, 6, and 12-month CDs\n• Higher returns on most of your fund\n• Stagger maturity dates for regular access\n\n**THE TWO-TIER SYSTEM**\n• Tier 1: $2,500 in checking (instant access)\n• Tier 2: Remaining in high-yield savings\n• Ultimate convenience + growth optimization\n\n**THE CREDIT LINE BACKUP**\n• Establish unused credit line as backup\n• Only for true emergencies + immediate payoff\n• Buys time while accessing emergency fund\n• Not recommended as primary strategy\n\n**THE INVESTMENT HYBRID (Advanced)**\n• Emergency fund in savings\n• 'Extended emergency fund' in conservative investments\n• Only for those with stable incomes\n• Provides growth potential with acceptable risk"
              }
            ]
          },
          {
            id: "real-world-scenarios",
            title: "Real-World Mastery",
            icon: "🎭",
            content: [
              {
                id: "emergency-scenarios",
                type: "text",
                title: "🎭 Emergency Fund Scenarios: Choose Your Adventure",
                content: "Life will test your emergency fund. Here's how to handle real emergencies like a financial ninja, plus what counts as a true emergency (and what doesn't)."
              },
              {
                id: "scenario-breakdown",
                type: "example",
                title: "🚨 Real Emergency Response Guide",
                content: "**SCENARIO 1: Job Loss 💼**\n*Timeline: Could last 2-6 months*\n\n✅ **DO:**\n• Use emergency fund to maintain essential expenses only\n• File for unemployment benefits immediately\n• Take time to find quality job (not just any job)\n• Network strategically instead of panic-applying\n• Negotiate better package with time leverage\n\n❌ **DON'T:**\n• Maintain full lifestyle during search\n• Accept first offer out of desperation\n• Raid retirement accounts (penalties + taxes)\n\n**SCENARIO 2: Medical Emergency 🏥**\n*Cost: $500-$5,000+ after insurance*\n\n✅ **DO:**\n• Pay upfront to avoid payment plans/interest\n• Negotiate cash discounts (often 10-20% off)\n• Use fund to focus on healing, not finances\n• Research costs before non-emergency procedures\n\n**SCENARIO 3: Home Emergency 🏠**\n*Examples: Roof leak, heating failure, plumbing disaster*\n\n✅ **DO:**\n• Get multiple quotes for major repairs\n• Fix promptly to prevent bigger problems\n• Consider DIY for minor issues\n• Document for insurance claims\n\n**Key Principle:** Emergency funds buy you options and peace of mind!"
              },
              {
                id: "real-vs-fake-emergencies",
                type: "warning",
                title: "⚠️ Emergency vs. Poor Planning",
                content: "**REAL EMERGENCIES (Use Your Fund):**\n✅ Unexpected medical bills\n✅ Job loss or sudden income reduction\n✅ Essential car repairs needed for work\n✅ Critical home repairs (heating, plumbing, roof)\n✅ Family emergencies requiring travel\n✅ Pet medical emergencies\n\n**NOT EMERGENCIES (Use Other Budget Categories):**\n❌ Holiday gifts you forgot to plan for\n❌ Vacation opportunities (even 'amazing deals')\n❌ Sale items you don't want to miss\n❌ Wanting to upgrade phone/car/computer\n❌ Wedding, birthday, or graduation gifts\n❌ Home improvements and upgrades\n❌ Investment opportunities\n\n**The 48-Hour Rule:**\nIf you can wait 48 hours to decide, it's probably not an emergency. True emergencies demand immediate action.\n\n**Remember:** Emergency funds are for unexpected necessities, not unexpected opportunities."
              },
              {
                id: "replenishment-strategy",
                type: "interactive",
                title: "🔄 The Rapid Replenishment Protocol",
                content: "**What to do AFTER using your emergency fund:**\n\n**IMMEDIATE (Within 24 hours):**\n□ Calculate exactly how much you used\n□ Assess if emergency is ongoing\n□ Temporarily pause other financial goals\n□ Feel proud you handled crisis without debt!\n\n**SHORT-TERM (Within 1 week):**\n□ Double your emergency fund contribution temporarily\n□ Redirect money from entertainment/dining out\n□ Consider temporary side income if large withdrawal\n□ Create replenishment timeline\n\n**ONGOING (Until fully restored):**\n□ Maintain accelerated rebuilding schedule\n□ Pause other savings goals if necessary\n□ Look for lesson learned to prevent future occurrences\n□ Celebrate when fund is fully restored\n\n**Average Replenishment Time:**\n• $500 withdrawal: 1-2 months\n• $2,000 withdrawal: 3-6 months\n• $5,000+ withdrawal: 6-12 months\n\n**Remember:** Using your emergency fund for a real emergency is a SUCCESS, not a failure!"
              }
            ]
          }
        ],
        exercises: [
          {
            id: "emergency-fund-formula",
            type: "multiple-choice",
            question: "Maria has $2,800 in monthly essential expenses. She's self-employed with variable income and no spouse. What's her ideal emergency fund target?",
            options: [
              "$8,400 (3 months)",
              "$16,800 (6 months)",
              "$25,200 (9 months)",
              "$33,600 (12 months)"
            ],
            correctAnswer: "$25,200 (9 months)",
            explanation: "Self-employed individuals with variable income need larger emergency funds due to income uncertainty. 9-12 months is recommended for this situation, making $25,200 the appropriate target.",
            feedback: {
              correct: "🛡️ Perfect calculation! Self-employed individuals need larger emergency funds for income stability.",
              incorrect: "Consider Maria's self-employment status and variable income - this requires a larger safety net."
            },
            points: 30
          },
          {
            id: "account-optimization-quiz",
            type: "multiple-choice",
            question: "You have $12,000 for emergency fund. Where should you keep it for best balance of growth and accessibility?",
            options: [
              "Regular savings account (0.1% APY)",
              "High-yield savings account (4.5% APY)",
              "Stock market index fund (historical 10% but volatile)",
              "5-year CD (5% APY but locked up)"
            ],
            correctAnswer: "High-yield savings account (4.5% APY)",
            explanation: "High-yield savings accounts provide the optimal balance of growth (4.5% APY) and accessibility (24-48 hour access) needed for emergency funds.",
            feedback: {
              correct: "💰 Excellent choice! High-yield savings balances growth with the accessibility emergency funds require.",
              incorrect: "Emergency funds need to balance earning potential with quick access when crises hit."
            },
            points: 25
          },
          {
            id: "emergency-scenario-response",
            type: "scenario",
            question: "Your furnace breaks in winter, repair costs $1,800. You have a $10,000 emergency fund. What's the smartest approach?",
            options: [
              "Put it on credit card to preserve emergency fund",
              "Use emergency fund and immediately start replenishing it",
              "Finance half through repair company, pay half from fund",
              "Delay repair and use space heaters to save money"
            ],
            correctAnswer: "Use emergency fund and immediately start replenishing it",
            explanation: "This is exactly what emergency funds are for - unexpected essential expenses. Use the fund to avoid debt, then focus on rebuilding it quickly.",
            feedback: {
              correct: "🔥 Perfect emergency response! This is exactly why you built that fund.",
              incorrect: "This is a textbook emergency - unexpected, necessary, and time-sensitive. Use the fund!"
            },
            points: 30
          },
          {
            id: "emergency-vs-opportunity",
            type: "true-false",
            question: "True or False: Finding a great deal on vacation packages qualifies as an emergency fund use if it expires soon.",
            correctAnswer: "False",
            explanation: "Vacation deals, no matter how good or time-sensitive, are opportunities, not emergencies. Emergency funds are for unexpected necessities, not unexpected opportunities.",
            feedback: {
              correct: "🎯 Correct! Emergency funds are for necessities, not opportunities (even great ones).",
              incorrect: "Remember the definition: emergencies are unexpected necessities. Vacations are wants, not needs."
            },
            points: 20
          }
        ]
      },
      {
        id: "goal-crushing-system",
        title: "🎯 Goal-Crushing Savings System",
        description: "Transform impossible dreams into mathematical certainties with proven achievement engineering",
        difficulty: "Intermediate",
        estimatedTime: "18 minutes",
        xpReward: 150,
        learningObjectives: [
          "Engineer SMART savings goals using psychological triggers that make success inevitable",
          "Master compound growth strategies that turn small amounts into massive wealth",
          "Build gamified milestone systems that make saving feel like winning a video game",
          "Create unstoppable momentum with science-based motivation techniques"
        ],
        tabs: [
          {
            id: "smart-goals-engineering",
            title: "SMART Goals Mastery",
            icon: "🎯",
            content: [
              {
                id: "smart-goals-power",
                type: "text",
                title: "🎯 Goal Engineering: From Dreams to Certainties",
                content: "Harvard Business School research proves it: People with specific, written goals are 10X more likely to achieve them than those with vague intentions.\n\nBut we're going beyond basic goal setting. We're engineering success using:\n• Psychological trigger points that make goals irresistible\n• Mathematical certainty that removes doubt\n• Behavioral science that builds unstoppable momentum\n• Gamification that makes the journey addictive\n\nYou're about to transform from someone who 'hopes to save' to someone who 'engineers wealth.'"
              },
              {
                id: "smart-formula-breakdown",
                type: "example",
                title: "🔬 The SMART Goals Success Formula",
                content: "**SPECIFIC: Laser-Focused Clarity**\n❌ Vague: 'Save money for vacation'\n✅ SMART: 'Save $4,500 for 10-day Italy trip including flights, hotels, food, and activities'\n🔑 Test: Could a stranger understand your goal completely?\n\n**MEASURABLE: Track Progress Objectively**\n❌ Vague: 'Save more than last year'\n✅ SMART: 'Save $375 per month for 12 months = $4,500'\n🔑 Create weekly/monthly checkpoints you can measure\n\n**ACHIEVABLE: Challenging but Possible**\n❌ Unrealistic: 'Save $50,000 on $30,000 salary'\n✅ SMART: 'Save $4,500 (15% of $30,000 annual income)'\n🔑 Aim for 80% confidence level - challenging but doable\n\n**RELEVANT: Aligned with Life Values**\n❌ Random: Saving for things you don't actually want\n✅ SMART: Goals supporting your core values (family, freedom, security)\n🔑 Connect every goal to a deeper 'why'\n\n**TIME-BOUND: Clear Deadline Pressure**\n❌ Someday: 'Save for Italy eventually'\n✅ SMART: 'Complete Italy fund by September 15, 2025'\n🔑 Work backward from deadline to create monthly targets"
              },
              {
                id: "goal-categories-system",
                type: "interactive",
                title: "🗂️ The 4-Category Goal System",
                content: "**Successful savers balance 4 types of goals simultaneously:**\n\n**🛡️ SECURITY GOALS (Foundation)**\n• Emergency fund (3-6 months expenses)\n• Insurance optimization\n• Debt elimination milestones\n*Timeline: 6 months - 3 years*\n\n**🎉 LIFESTYLE GOALS (Joy)**\n• Dream vacations\n• Home improvements\n• Technology upgrades\n• Experience investments\n*Timeline: 3 months - 2 years*\n\n**📈 WEALTH GOALS (Growth)**\n• Investment accounts\n• Real estate down payments\n• Business capital\n• Retirement acceleration\n*Timeline: 1 year - 30 years*\n\n**🌟 LEGACY GOALS (Impact)**\n• Children's education\n• Charitable giving\n• Family financial security\n• Community investments\n*Timeline: 5 years - lifetime*\n\n**The Magic Balance:** Always have 1-2 active goals from each category. This keeps you motivated across all time horizons!"
              },
              {
                id: "goal-psychology-hacks",
                type: "tip",
                title: "🧠 Advanced Goal Psychology Hacks",
                content: "**HACK #1: The Visualization Immersion**\n• Create vivid mental movie of achieving your goal\n• Include all 5 senses and emotions\n• Watch your 'success movie' for 2 minutes daily\n• Studies show 35% higher achievement rates\n\n**HACK #2: Public Commitment Power**\n• Share specific goal with 3-5 important people\n• Social pressure increases completion by 65%\n• Ask them to check your progress monthly\n• Celebrate milestones together\n\n**HACK #3: Implementation Intentions**\n• Create 'if-then' statements that trigger automatic behavior\n• Example: 'If it's payday, then I immediately transfer $300 to Italy fund'\n• Removes decision fatigue and builds habits\n• Increases achievement by 200-300%\n\n**HACK #4: The Progress Celebration System**\n• Celebrate every 25% milestone with small reward\n• Document progress with photos/screenshots\n• Share wins on social media for reinforcement\n• Create 'achievement wall' of completed goals"
              }
            ]
          },
          {
            id: "compound-acceleration",
            title: "Compound Acceleration",
            icon: "🚀",
            content: [
              {
                id: "compound-magic",
                type: "text",
                title: "🚀 The Compound Growth Secret",
                content: "Here's where saving becomes truly exciting! Compound growth means your money makes money, which then makes more money. Understanding this concept will transform how you think about every dollar.\n\nCompound interest is called 'the eighth wonder of the world' for good reason:\n• Small amounts today become massive wealth tomorrow\n• Time is more powerful than amount\n• Starting early beats starting with more money\n• Patience creates millionaires\n\nYou're about to see why Einstein called compound interest 'the most powerful force in the universe.'"
              },
              {
                id: "compound-showdown",
                type: "example",
                title: "⚡ The Compound Growth Showdown",
                content: "**Three friends start saving at different times. Who ends up richest?**\n\n**👑 EARLY BIRD EMMA**\n• Saves $200/month from age 25-35 (10 years)\n• Total invested: $24,000\n• Stops saving at 35, lets it grow\n• Value at 65: $525,000\n\n**🐢 STEADY STEVEN**\n• Saves $200/month from age 35-65 (30 years)\n• Total invested: $72,000\n• Consistent saver for entire career\n• Value at 65: $490,000\n\n**😰 LATE LARRY**\n• Saves $400/month from age 45-65 (20 years)\n• Total invested: $96,000\n• Doubles the monthly amount\n• Value at 65: $385,000\n\n**The Shocking Result:**\nEmma invested the LEAST money but ended up RICHEST!\n\n**The Lesson:** Time beats timing. Time beats amount. Start NOW, even small."
              },
              {
                id: "acceleration-strategies",
                type: "interactive",
                title: "⚡ Compound Acceleration Strategies",
                content: "**STRATEGY 1: Front-Loading Power**\n□ Save aggressively in first 2-3 years of any goal\n□ Every early dollar has maximum time to compound\n□ Example: Save 40% in year 1, 35% in year 2, 25% in year 3\n\n**STRATEGY 2: Windfall Maximizer**\n□ Immediately invest any unexpected money\n□ Tax refunds, bonuses, gifts, raises\n□ These lump sums have outsized final impact\n□ Never let windfalls sit in checking accounts\n\n**STRATEGY 3: Rate Optimizer**\n□ Constantly seek higher-yielding safe investments\n□ 1% additional return = 20% more wealth over 30 years\n□ Review accounts every 6 months\n□ Switch banks for better rates\n\n**STRATEGY 4: Escalation Protocol**\n□ Increase savings rate by 1% annually\n□ Use raises/promotions to boost savings\n□ Small increases compound into massive differences\n□ Automate the increases to remove decisions\n\n**Pro Tip:** Combine all four strategies for maximum wealth acceleration!"
              },
              {
                id: "interest-rate-impact",
                type: "scenario",
                title: "💰 The Interest Rate Game-Changer",
                content: "**How much difference can interest rates really make?**\n\n*Saving $300/month for 25 years:*\n\n**💸 0.1% (Regular Savings)**\nTotal: $90,225\nInterest earned: $225\n\n**💰 3% (Conservative)**\nTotal: $128,289\nInterest earned: $38,289\n\n**🚀 5% (High-Yield)**\nTotal: $152,037\nInterest earned: $62,037\n\n**🏆 7% (Conservative Investing)**\nTotal: $189,129\nInterest earned: $99,129\n\n**📈 10% (Stock Market Historical)**\nTotal: $265,528\nInterest earned: $175,528\n\n**Mind-Blowing Insight:**\nThe difference between 0.1% and 7% is $98,904 - that's like getting an extra $329/month for free for 25 years!\n\n**Key Takeaway:** Small rate differences create massive wealth differences. Always optimize for the highest safe return."
              }
            ]
          },
          {
            id: "milestone-gamification",
            title: "Milestone Gamification",
            icon: "🏆",
            content: [
              {
                id: "gamification-psychology",
                type: "text",
                title: "🎮 The Gamification Advantage",
                content: "Your brain is wired to love games, progress bars, achievements, and rewards. We're going to hijack these psychological triggers to make saving money feel like your favorite video game!\n\nGamefication works because it triggers:\n• Dopamine releases from progress\n• Social recognition from achievements\n• Competitive drive from leaderboards\n• Completion satisfaction from milestones\n\nWhen reaching financial goals feels like winning a game, you'll actually crave saving money!"
              },
              {
                id: "milestone-achievement-system",
                type: "example",
                title: "🏆 The Achievement System",
                content: "**Transform boring savings into exciting achievements:**\n\n**🥉 BRONZE MILESTONES (25% of goal)**\n🎉 Reward: Small celebration ($20-50)\n📸 Action: Progress photo for motivation\n🎯 Psychology: Proves you can do this\n💪 Example: $2,500 of $10,000 vacation fund\n\n**🥈 SILVER MILESTONES (50% of goal)**\n🎉 Reward: Medium celebration ($50-100)\n📊 Action: Reassess timeline and strategy\n🎯 Psychology: Momentum is building strong\n💪 Example: Halfway point - $5,000 saved\n\n**🥇 GOLD MILESTONES (75% of goal)**\n🎉 Reward: Significant celebration ($100-200)\n🚀 Action: Plan for goal completion\n🎯 Psychology: Victory is within reach\n💪 Example: $7,500 saved - almost there!\n\n**💎 PLATINUM ACHIEVEMENT (100% of goal)**\n🎉 Reward: Major celebration (5-10% of goal)\n🏆 Action: Set next bigger goal immediately\n🎯 Psychology: You're a proven achiever\n💪 Example: Full $10,000 goal achieved!"
              },
              {
                id: "visual-tracking-methods",
                type: "interactive",
                title: "📊 Visual Progress Tracking Methods",
                content: "**Choose your visual motivation method:**\n\n**📈 METHOD 1: The Savings Thermometer**\n□ Draw thermometer with goal at top\n□ Color in progress each week\n□ Display where you'll see it daily\n□ Psychological boost: Visual progress feels amazing\n\n**🔗 METHOD 2: The Progress Chain**\n□ Create paper chain with links = daily/weekly targets\n□ Remove one link each time you save\n□ Watch chain shrink as you approach goal\n□ Bonus: Kids love helping with this\n\n**📱 METHOD 3: Digital Progress Tracking**\n□ Monthly screenshots of account balances\n□ Create digital album showing growth\n□ Share major milestones on social media\n□ Use apps with achievement notifications\n\n**📋 METHOD 4: The Milestone Map**\n□ Create visual map with milestone markers\n□ Mark achievements with stickers/stamps\n□ Include photos of your goal destination\n□ Track both progress and excitement\n\n**🏆 METHOD 5: The Achievement Wall**\n□ Display completed goal certificates\n□ Before/after account balance photos\n□ Celebration pictures from milestones\n□ Build visual proof of your success pattern"
              },
              {
                id: "momentum-builders",
                type: "tip",
                title: "⚡ Unstoppable Momentum Builders",
                content: "**THE MOMENTUM KILLERS TO AVOID:**\n🚫 Perfectionism (missing one month ruins everything)\n🚫 Comparison (someone else's journey isn't yours)\n🚫 Impatience (wealth building takes time)\n🚫 Lifestyle inflation (spending grows with income)\n🚫 Analysis paralysis (waiting for 'perfect' plan)\n\n**THE MOMENTUM BUILDERS TO EMBRACE:**\n✅ Consistency over perfection (small regular beats big sporadic)\n✅ Progress celebration (acknowledge every milestone)\n✅ Flexibility (adjust goals as life changes)\n✅ Community support (surround yourself with goal-achievers)\n✅ Systems over motivation (automation beats willpower)\n\n**ULTIMATE MOMENTUM SECRET:**\nMomentum isn't about motivation - it's about systems. Build systems that work even when motivation disappears.\n\n**The Compound Effect of Momentum:**\nSuccess → Confidence → Bigger Goals → Greater Success → Stronger Confidence → Even Bigger Goals\n\nOnce you complete your first major savings goal, every future goal becomes easier!"
              }
            ]
          }
        ],
        exercises: [
          {
            id: "smart-goals-mastery",
            type: "multiple-choice",
            question: "Which goal follows ALL five SMART criteria most effectively?",
            options: [
              "Save money for retirement",
              "Build emergency fund this year",
              "Save $15,000 for house down payment by December 2026 through $625 monthly transfers",
              "Save more than I spent last year"
            ],
            correctAnswer: "Save $15,000 for house down payment by December 2026 through $625 monthly transfers",
            explanation: "This goal is Specific ($15,000 for house), Measurable ($625/month), Achievable (reasonable timeline), Relevant (major life goal), and Time-bound (December 2026).",
            feedback: {
              correct: "🎯 Perfect! This goal has crystal clear specificity, measurability, and timeline.",
              incorrect: "Look for the goal with specific amount, clear timeline, and practical action steps."
            },
            points: 35
          },
          {
            id: "compound-growth-mastery",
            type: "scenario",
            question: "Based on the Early Bird vs. Late Larry example, what's the most important factor in building wealth through saving?",
            options: [
              "Saving the highest monthly amount possible",
              "Starting early to maximize compound time",
              "Finding the perfect investment strategy",
              "Waiting until you earn more money to start"
            ],
            correctAnswer: "Starting early to maximize compound time",
            explanation: "Emma saved the least total money ($24,000) but ended richest because she started earliest. Time is the most powerful factor in compound growth.",
            feedback: {
              correct: "🚀 Brilliant! You understand that time beats timing and time beats amount in wealth building.",
              incorrect: "Review the Early Bird Emma example - she invested the least but ended richest due to starting early."
            },
            points: 40
          },
          {
            id: "interest-rate-optimization",
            type: "multiple-choice",
            question: "If you save $300/month for 25 years, approximately how much extra wealth do you build by earning 7% instead of 0.1%?",
            options: [
              "$38,000",
              "$62,000",
              "$99,000",
              "$175,000"
            ],
            correctAnswer: "$99,000",
            explanation: "At 7%, you'd have $189,129. At 0.1%, you'd have $90,225. The difference is $98,904, approximately $99,000 in extra wealth just from interest rate optimization.",
            feedback: {
              correct: "💰 Amazing calculation! That's nearly $100,000 extra just from choosing better interest rates.",
              incorrect: "Compare the 7% result ($189,129) with the 0.1% result ($90,225) from the interest rate example."
            },
            points: 35
          },
          {
            id: "milestone-psychology",
            type: "true-false",
            question: "True or False: According to the Achievement System, you should only celebrate when you reach 100% of your savings goal.",
            correctAnswer: "False",
            explanation: "The Achievement System recommends celebrating at 25%, 50%, 75%, and 100% milestones to maintain motivation and momentum throughout the journey.",
            feedback: {
              correct: "🏆 Correct! Regular milestone celebrations maintain motivation and build momentum.",
              incorrect: "The Achievement System uses Bronze, Silver, Gold, and Platinum milestones - celebrate progress, not just completion!"
            },
            points: 25
          },
          {
            id: "goal-categories-balance",
            type: "multiple-choice",
            question: "According to the 4-Category Goal System, what's the recommended approach for balanced goal setting?",
            options: [
              "Focus on one category at a time until complete",
              "Always prioritize Security goals over all others",
              "Have 1-2 active goals from each category simultaneously",
              "Only set Wealth goals since they create the most money"
            ],
            correctAnswer: "Have 1-2 active goals from each category simultaneously",
            explanation: "Balanced goal setting across Security, Lifestyle, Wealth, and Legacy categories keeps you motivated across all time horizons and life priorities.",
            feedback: {
              correct: "🎯 Perfect balance! This approach maintains motivation across short-term and long-term priorities.",
              incorrect: "The magic is in balance - having goals across different categories and timeframes keeps you motivated."
            },
            points: 30
          }
        ]
      }
    ]
  }
];

export default COURSE_CONTENT;