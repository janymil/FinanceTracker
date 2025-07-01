// Financial Literacy Course Content - Structure Only
// Actual content comes from translation files

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

// Course structure - titles and content come from translation files
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
        tabs: [],
        exercises: []
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
        tabs: [],
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
        tabs: [],
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
        tabs: [],
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
        tabs: [],
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
        tabs: [],
        exercises: []
      }
    ]
  }
];