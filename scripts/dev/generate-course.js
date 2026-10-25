import OpenAI from 'openai';
import fs from 'fs';

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

const prompt = `Create comprehensive financial literacy course content with educational material and interactive exercises. Generate JSON data for 4 modules, each with 3 detailed levels.

REQUIREMENTS:
- Each level must include educational content blocks (explanations, examples, tips) BEFORE exercises
- Content should be practical, engaging, and use real-world examples
- Include learning objectives for each level
- Exercises should test understanding of the taught content

Generate a JSON object with this structure:
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
            }
          ],
          "exercises": [
            {
              "id": "income-exercise-1",
              "type": "multiple-choice",
              "question": "Which of these is considered income?",
              "options": ["Rent payment", "Salary from job", "Grocery shopping", "Car loan payment"],
              "correctAnswer": "Salary from job",
              "explanation": "Salary is money coming IN to your account, making it income.",
              "feedback": {
                "correct": "Exactly! Salary is money you receive, which makes it income.",
                "incorrect": "Not quite. Remember: income is money coming IN to your account."
              },
              "points": 10
            }
          ]
        }
      ]
    }
  ]
}

Create complete content for all 4 modules:
1. Budgeting Basics (3 levels)
2. Smart Saving Strategies (3 levels)  
3. Debt Management (3 levels)
4. Investment Fundamentals (3 levels)

Each level should have 3-5 educational content blocks and 3-5 exercises.`;

try {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "You are an expert financial educator. Create comprehensive, interactive course content with practical examples and clear explanations."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    response_format: { type: "json_object" },
    max_tokens: 4000
  });

  console.log('Generated content successfully!');
  fs.writeFileSync('course-content-generated.json', response.choices[0].message.content);
  console.log('Saved to course-content-generated.json');
  
} catch (error) {
  console.error('Error:', error);
}