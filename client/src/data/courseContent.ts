// Financial Literacy Course Content
import { TFunction } from 'i18next';

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

// Function to generate course content with translations
export const getCourseContent = (t: TFunction): Course[] => [
  {
    id: "cashflow-mastery",
    title: t('courses.modules.cashflow-mastery.title'),
    description: t('courses.modules.cashflow-mastery.description'),
    category: "Financial Management",
    difficulty: "Beginner",
    estimatedTime: "60 minutes",
    xpReward: 300,
    unlockLevel: 1,
    totalLevels: 6,
    levels: [
      {
        id: "cashflow-level-1",
        title: "Welcome & The Power of Cash Flow Awareness",
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
            id: "introduction",
            title: "Introduction",
            icon: "💡",
            content: [
              {
                id: "welcome",
                type: "text",
                title: "Welcome to Cash Flow Mastery",
                content: "Welcome to your journey toward financial freedom through cash flow mastery. This course will teach you how to track, understand, and optimize your money flow."
              }
            ]
          },
          {
            id: "basics",
            title: "Cash Flow Basics",
            icon: "💰",
            content: [
              {
                id: "understanding",
                type: "text",
                title: "Understanding Cash Flow",
                content: "Cash flow is the movement of money in and out of your accounts. It's the foundation of financial health and wealth building."
              }
            ]
          }
        ],
        exercises: [
          {
            id: "cash-flow-quiz",
            type: "multiple-choice",
            title: "Cash Flow Knowledge Check",
            description: "Test your understanding of cash flow basics",
            question: "What is cash flow?",
            options: [
              "Only money coming into your accounts",
              "Only money going out of your accounts", 
              "The movement of money in and out of your accounts",
              "Your total savings amount"
            ],
            correctAnswer: 2,
            explanation: "Cash flow is the movement of money both in and out of your accounts over time.",
            feedback: {
              correct: "Correct! Cash flow tracks both incoming and outgoing money.",
              incorrect: "Cash flow includes both money coming in and going out of your accounts."
            }
          }
        ]
      },
      {
        id: "cashflow-level-2",
        title: "Income Source Identification and Mapping",
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
            id: "mapping",
            title: "Income Mapping",
            icon: "📊",
            content: [
              {
                id: "sources",
                type: "text",
                title: "Identifying Income Sources",
                content: "Learn to identify and categorize all your income sources, including primary salary, side hustles, investments, and passive income."
              }
            ]
          },
          {
            id: "optimization",
            title: "Optimization",
            icon: "🚀",
            content: [
              {
                id: "strategies",
                type: "tip",
                title: "Income Optimization Strategies",
                content: "Discover practical strategies to maximize your existing income sources and identify new opportunities."
              }
            ]
          }
        ],
        exercises: []
      },
      {
        id: "cashflow-level-3",
        title: "Active vs. Passive Income",
        description: "Understand the key differences between active and passive income",
        difficulty: "Beginner",
        estimatedTime: "12 minutes",
        xpReward: 50,
        learningObjectives: [
          "Distinguish between active and passive income streams",
          "Evaluate your current income mix",
          "Plan strategies to build passive income"
        ],
        tabs: [
          {
            id: "active-passive",
            title: "Active vs Passive",
            icon: "⚡",
            content: [
              {
                id: "comparison",
                type: "text",
                title: "Understanding the Difference",
                content: "Active income requires your time and effort, while passive income generates money with minimal ongoing work."
              }
            ]
          }
        ],
        exercises: []
      },
      {
        id: "cashflow-level-4",
        title: "Automating Income Tracking",
        description: "Set up automated systems to track income and expenses efficiently",
        difficulty: "Intermediate",
        estimatedTime: "20 minutes",
        xpReward: 75,
        learningObjectives: [
          "Set up automated income tracking systems",
          "Connect bank accounts and financial tools",
          "Create automated expense categorization"
        ],
        tabs: [
          {
            id: "automation",
            title: "Automation Setup",
            icon: "🤖",
            content: [
              {
                id: "systems",
                type: "text",
                title: "Setting Up Tracking Systems",
                content: "Learn to automate your financial tracking with modern tools and bank connections."
              }
            ]
          }
        ],
        exercises: []
      },
      {
        id: "cashflow-level-5",
        title: "Strategies to Boost Income by 20-50%",
        description: "Learn actionable strategies to significantly increase your income within 12 months",
        difficulty: "Intermediate",
        estimatedTime: "25 minutes",
        xpReward: 75,
        learningObjectives: [
          "Identify income-boosting opportunities in your current role",
          "Develop side income streams",
          "Master negotiation techniques for salary increases"
        ],
        tabs: [
          {
            id: "boost-strategies",
            title: "Income Boosting",
            icon: "📈",
            content: [
              {
                id: "techniques",
                type: "text",
                title: "Proven Income Strategies",
                content: "Discover actionable strategies to significantly increase your income within 12 months."
              }
            ]
          }
        ],
        exercises: []
      },
      {
        id: "cashflow-level-6",
        title: "Create Your Personalized Cash Flow Plan",
        description: "Bring everything together into a comprehensive 12-month cash flow plan",
        difficulty: "Advanced",
        estimatedTime: "30 minutes",
        xpReward: 100,
        learningObjectives: [
          "Create a comprehensive 12-month cash flow projection",
          "Set realistic income and savings targets",
          "Build contingency plans for financial emergencies"
        ],
        tabs: [
          {
            id: "planning",
            title: "Cash Flow Planning",
            icon: "📋",
            content: [
              {
                id: "plan-creation",
                type: "text",
                title: "Creating Your Personal Plan",
                content: "Bring everything together into a comprehensive 12-month cash flow plan that works for your situation."
              }
            ]
          }
        ],
        exercises: []
      }
    ]
  }
];