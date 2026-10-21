import { createRoutedClient, AI_MODELS } from "../lib/aiProvider";

// Routed through lib/aiProvider (gpt-6-luna by default, DeepSeek/Groq fallbacks).
const openai = createRoutedClient();

export interface CourseModule {
  id: string;
  title: string;
  description: string;
  icon: string;
  totalLevels: number;
  estimatedTime: string;
  levels: CourseLevel[];
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

export async function generateFinancialLiteracyCourse(): Promise<CourseModule[]> {
  const prompt = `
Create a comprehensive, gamified Financial Literacy Mini-Course with 3 modules. This content will be used in a Duolingo-style educational platform for financial management. 

CRITICAL REQUIREMENTS:
- Generate content that's engaging, interactive, and designed for micro-learning
- Each module should have 3 levels of increasing difficulty
- Each level should have exactly 5 exercises with different types
- Use practical, real-world examples that users can immediately apply
- Content should be simple but not dumbed down
- Include immediate feedback for motivation

Return the course structure in JSON format with the following structure:

{
  "modules": [
    {
      "id": "budgeting-basics",
      "title": "Budgeting Mastery",
      "description": "Learn to create and manage budgets that actually work",
      "icon": "💰",
      "totalLevels": 3,
      "estimatedTime": "15 min",
      "levels": [
        {
          "id": "budgeting-1",
          "moduleId": "budgeting-basics",
          "levelNumber": 1,
          "title": "Budget Fundamentals",
          "description": "Understanding income vs expenses",
          "xpReward": 50,
          "exercises": [
            {
              "id": "exercise-1",
              "type": "multiple-choice",
              "question": "What percentage of your income should go to housing costs?",
              "options": ["10-15%", "20-25%", "30-35%", "40-45%"],
              "correctAnswer": "30-35%",
              "feedback": {
                "correct": "Exactly! The 30% rule helps ensure housing doesn't overwhelm your budget.",
                "incorrect": "The recommended housing cost is 30-35% of income to maintain financial balance."
              },
              "points": 10
            }
          ]
        }
      ]
    }
  ]
}

Generate 3 modules:
1. "Budgeting Mastery" - Creating and managing effective budgets
2. "Debt Elimination" - Strategies for paying off debt efficiently  
3. "Saving Strategies" - Building emergency funds and long-term savings

Each module should have 3 levels with 5 exercises each. Use different exercise types: multiple-choice, true-false, drag-drop scenarios, matching pairs, and practical scenarios.

Make the content engaging with:
- Real dollar amounts and practical examples
- Immediate actionable tips
- Encouraging feedback messages
- Progressive difficulty that builds knowledge
- Interactive scenarios users can relate to
`;

  try {
    const response = await openai.chat.completions.create({
      model: AI_MODELS.generation,
      messages: [
        {
          role: "system",
          content: "You are an expert financial educator and gamification specialist. Create engaging, practical financial literacy content that teaches real skills through interactive exercises."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.8
    });

    const courseData = JSON.parse(response.choices[0].message.content || '{}');
    return courseData.modules as CourseModule[];
  } catch (error) {
    console.error('Error generating course content:', error);
    throw new Error('Failed to generate course content');
  }
}

// Generate achievement badges
export async function generateAchievementBadges(): Promise<any[]> {
  const prompt = `
Create achievement badges for a financial literacy gamification system. Generate 12 different badges that users can earn through course completion and engagement.

Return JSON with this structure:
{
  "badges": [
    {
      "id": "first-lesson",
      "name": "Getting Started",
      "description": "Completed your first financial lesson",
      "icon": "🌟",
      "rarity": "common",
      "xpRequired": 50,
      "unlockCondition": "complete_first_exercise"
    }
  ]
}

Include badges for:
- First lesson completion
- Module completion (3 badges)
- Streak achievements (7 day, 30 day)
- Perfect scores
- Fast learner
- Knowledge master
- Savings expert
- Budget guru
- Debt destroyer
- Financial hero

Make descriptions motivational and achievements feel rewarding.
`;

  try {
    const response = await openai.chat.completions.create({
      model: AI_MODELS.generation,
      messages: [
        {
          role: "system", 
          content: "You are a gamification expert creating motivational achievement systems for educational platforms."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7
    });

    const badgeData = JSON.parse(response.choices[0].message.content || '{}');
    return badgeData.badges;
  } catch (error) {
    console.error('Error generating badges:', error);
    throw new Error('Failed to generate achievement badges');
  }
}