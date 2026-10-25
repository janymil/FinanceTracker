// Generate Financial Literacy Course Content using GPT-4o
import OpenAI from "openai";
import fs from 'fs';

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY
});

async function generateCourseContent() {
  console.log("🎓 Generating Financial Literacy Course Content with GPT-4o...");
  
  const prompt = `
Create a comprehensive, gamified Financial Literacy Mini-Course with 3 modules for a Duolingo-style educational platform. This will be embedded as static content in a React application.

CRITICAL REQUIREMENTS:
- Generate engaging, interactive content designed for micro-learning
- Each module should have 3 levels of increasing difficulty
- Include diverse exercise types: multiple-choice, true-false, scenario-based
- Provide immediate feedback with explanations
- Award XP points for motivation (25-50 XP per level)
- Use real-world scenarios and practical examples
- Content should be accessible to beginners but progressively challenging

STRUCTURE NEEDED:
Module 1: Budgeting Basics
- Level 1: Understanding Income vs Expenses (Beginner)
- Level 2: Creating Your First Budget (Intermediate) 
- Level 3: Budget Optimization Strategies (Advanced)

Module 2: Smart Spending
- Level 1: Needs vs Wants (Beginner)
- Level 2: Comparison Shopping (Intermediate)
- Level 3: Avoiding Impulse Purchases (Advanced)

Module 3: Saving & Investing
- Level 1: Emergency Fund Basics (Beginner)
- Level 2: Savings Goals & Strategies (Intermediate)
- Level 3: Investment Fundamentals (Advanced)

EXERCISE REQUIREMENTS:
- Each level should have 4-6 exercises
- Mix of question types: multiple-choice, true-false, scenario-based
- Provide detailed explanations for both correct and incorrect answers
- Include practical tips and real-world applications
- Assign appropriate XP rewards (5-15 points per exercise)

RESPONSE FORMAT:
Return valid JSON with this exact structure:
{
  "modules": [
    {
      "id": "budgeting-basics",
      "title": "Budgeting Basics",
      "description": "Learn the fundamentals of budgeting",
      "icon": "Calculator",
      "totalLevels": 3,
      "estimatedTime": "20 minutes",
      "levels": [
        {
          "id": "level-1",
          "moduleId": "budgeting-basics",
          "levelNumber": 1,
          "title": "Understanding Income vs Expenses",
          "description": "Master the basics of income and expenses",
          "xpReward": 25,
          "exercises": [
            {
              "id": "ex-1",
              "type": "multiple-choice",
              "question": "What is the difference between gross and net income?",
              "options": ["Option A", "Option B", "Option C", "Option D"],
              "correctAnswer": "Option B",
              "feedback": {
                "correct": "Correct! Net income is what you take home after taxes and deductions.",
                "incorrect": "Not quite. Net income is your take-home pay after taxes and deductions are removed from gross income."
              },
              "points": 10
            }
          ]
        }
      ]
    }
  ]
}

Generate comprehensive, educational content that will genuinely help users improve their financial literacy. Make it engaging and practical with real-world scenarios.
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a financial education expert creating gamified learning content. Generate comprehensive, accurate, and engaging educational material in valid JSON format."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 4000
    });

    const courseContent = JSON.parse(response.choices[0].message.content);
    
    // Save as TypeScript file for frontend
    const tsContent = `// Generated Financial Literacy Course Content
// Generated on: ${new Date().toISOString()}
// Source: GPT-4o

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

export const COURSE_CONTENT: CourseModule[] = ${JSON.stringify(courseContent.modules, null, 2)};

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
    xpRequired: 75,
    badgeColor: "bg-green-500"
  },
  {
    id: "smart-spender",
    title: "Smart Spender",
    description: "Complete the Smart Spending module",
    icon: "ShoppingCart",
    requirement: "Complete Smart Spending module",
    xpRequired: 150,
    badgeColor: "bg-purple-500"
  },
  {
    id: "future-planner",
    title: "Future Planner",
    description: "Complete the Saving & Investing module",
    icon: "TrendingUp",
    requirement: "Complete Saving & Investing module",
    xpRequired: 225,
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
  }
];
`;

    fs.writeFileSync('client/src/data/courseContent.ts', tsContent);
    console.log("✅ Course content generated and saved to client/src/data/courseContent.ts");
    
    // Log summary
    console.log(`📊 Generated ${courseContent.modules.length} modules:`);
    courseContent.modules.forEach(module => {
      console.log(`  - ${module.title}: ${module.levels.length} levels, ${module.levels.reduce((total, level) => total + level.exercises.length, 0)} exercises`);
    });
    
  } catch (error) {
    console.error("❌ Error generating course content:", error);
  }
}

// Run the generation
generateCourseContent();