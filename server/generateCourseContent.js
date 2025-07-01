#!/usr/bin/env node

/**
 * Generate Comprehensive Financial Literacy Course Content using GPT-4o
 * Creates rich, interactive lessons with educational content blocks
 */

import OpenAI from 'openai';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

async function generateCourseContent() {
  console.log('🎓 Generating comprehensive financial literacy course content with GPT-4o...');

  const prompt = `Create a comprehensive financial literacy course with interactive content for a Duolingo-style learning app. Generate JSON data for 4 modules, each with 3 detailed levels.

REQUIREMENTS:
- Each level must include educational content blocks (explanations, examples, tips) BEFORE exercises
- Content should be practical, engaging, and use real-world examples
- Include visual elements descriptions for charts/illustrations
- Exercises should test understanding of the taught content
- Focus on practical skills users can immediately apply

STRUCTURE:
{
  "modules": [
    {
      "id": "budgeting-basics",
      "title": "Budgeting Basics",
      "description": "Master the fundamentals of managing your money effectively",
      "icon": "Calculator",
      "totalLevels": 3,
      "estimatedTime": "25 minutes",
      "levels": [
        {
          "id": "budgeting-1",
          "moduleId": "budgeting-basics", 
          "levelNumber": 1,
          "title": "Understanding Income vs Expenses",
          "description": "Learn to identify and categorize your money flow",
          "xpReward": 15,
          "learningObjectives": [
            "Distinguish between income and expenses",
            "Categorize different types of expenses",
            "Calculate basic cash flow"
          ],
          "content": [
            {
              "id": "intro-1",
              "type": "text",
              "title": "What is Income?",
              "content": "Income is all the money you receive regularly. This includes your salary, freelance payments, investment returns, or any other money coming into your accounts."
            },
            {
              "id": "example-1",
              "type": "example",
              "title": "Real Income Examples",
              "content": "Sarah works as a graphic designer. Her income includes: $4,000 monthly salary, $500 freelance projects, $50 dividends from stocks. Total monthly income: $4,550"
            },
            {
              "id": "expenses-intro",
              "type": "text", 
              "title": "Understanding Expenses",
              "content": "Expenses are all the money you spend. There are two main types: Fixed expenses (same amount each month) and Variable expenses (amounts that change)."
            },
            {
              "id": "expenses-visual",
              "type": "visual",
              "title": "Expense Categories",
              "content": "Fixed Expenses: Rent ($1,200), Insurance ($150), Phone ($80). Variable Expenses: Groceries ($400-600), Entertainment ($100-300), Gas ($80-150)",
              "visual": {
                "type": "comparison",
                "data": {
                  "fixed": ["Rent: $1,200", "Insurance: $150", "Phone: $80"],
                  "variable": ["Groceries: $400-600", "Entertainment: $100-300", "Gas: $80-150"]
                }
              }
            },
            {
              "id": "cashflow-tip",
              "type": "tip",
              "title": "Cash Flow Rule",
              "content": "💡 Golden Rule: Income - Expenses = Cash Flow. Positive cash flow means you're saving money. Negative means you're spending more than you earn."
            }
          ],
          "exercises": [
            {
              "id": "income-exercise-1",
              "type": "multiple-choice",
              "question": "Which of these is considered income?",
              "options": ["Rent payment", "Salary from job", "Grocery shopping", "Car loan payment"],
              "correctAnswer": "Salary from job",
              "explanation": "Salary is money coming IN to your account, making it income. The others are expenses (money going OUT).",
              "feedback": {
                "correct": "Exactly! Salary is money you receive, which makes it income.",
                "incorrect": "Not quite. Remember: income is money coming IN to your account."
              },
              "points": 10
            },
            {
              "id": "expense-type-exercise",
              "type": "multiple-choice", 
              "question": "Your monthly rent of $800 is what type of expense?",
              "options": ["Variable expense", "Fixed expense", "Income", "Investment"],
              "correctAnswer": "Fixed expense",
              "explanation": "Rent stays the same amount each month, making it a fixed expense.",
              "feedback": {
                "correct": "Perfect! Fixed expenses stay the same amount each month.",
                "incorrect": "Think about it: does your rent amount change each month?"
              },
              "points": 10
            },
            {
              "id": "cashflow-calculation",
              "type": "multiple-choice",
              "question": "If you earn $3,000 monthly and spend $2,700, what's your cash flow?",
              "options": ["+$300 (positive)", "-$300 (negative)", "$5,700 total", "$0 (breaking even)"],
              "correctAnswer": "+$300 (positive)",
              "explanation": "Cash Flow = Income - Expenses = $3,000 - $2,700 = +$300. Positive cash flow means you're saving!",
              "feedback": {
                "correct": "Excellent! You're saving $300 each month with positive cash flow.",
                "incorrect": "Remember: Cash Flow = Income minus Expenses. Try the calculation again."
              },
              "points": 15
            }
          ]
        }
      ]
    }
  ]
}

Generate complete content for all 4 modules:
1. Budgeting Basics (3 levels: Income vs Expenses, Creating Your First Budget, Budget Optimization)
2. Smart Saving Strategies (3 levels: Emergency Fund Basics, Saving Goals & Methods, Automating Your Savings)  
3. Debt Management (3 levels: Understanding Debt Types, Debt Payoff Strategies, Avoiding Debt Traps)
4. Investment Fundamentals (3 levels: Investment Basics, Risk vs Return, Getting Started with Investing)

Each level should have:
- 3-5 educational content blocks explaining concepts with examples
- 3-5 interactive exercises testing the learned material
- Practical, actionable information users can apply immediately
- Real-world scenarios and calculations

Make it engaging, practical, and comprehensive - like having a personal financial tutor!`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system", 
          content: "You are an expert financial educator creating comprehensive, interactive course content. Focus on practical, actionable knowledge with real examples. Create engaging content that teaches concepts thoroughly before testing knowledge."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 4000
    });

    const courseData = JSON.parse(response.choices[0].message.content);
    
    // Write to course content file
    const outputPath = 'client/src/data/courseContent.ts';
    const fileContent = `// Financial Literacy Course Content
// Generated using GPT-4o for comprehensive interactive learning

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

export interface CourseLevel {
  id: string;
  moduleId: string;
  levelNumber: number;
  title: string;
  description: string;
  xpReward: number;
  learningObjectives: string[];
  content: ContentBlock[];
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

export const COURSE_CONTENT: CourseModule[] = ${JSON.stringify(courseData.modules, null, 2)};

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
`;

    fs.writeFileSync(outputPath, fileContent);
    console.log('✅ Successfully generated comprehensive course content!');
    console.log(`📁 Saved to: ${outputPath}`);
    console.log(`📊 Generated ${courseData.modules.length} modules with rich educational content`);

  } catch (error) {
    console.error('❌ Error generating course content:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateCourseContent();
}

export { generateCourseContent };