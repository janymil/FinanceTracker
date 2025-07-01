import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Trophy, 
  Star, 
  Clock, 
  Target, 
  BookOpen, 
  CheckCircle2, 
  Lock,
  Lightbulb,
  AlertTriangle,
  Zap,
  ListChecks,
  BarChart3,
  Flame,
  ShoppingCart,
  TrendingUp,
  Award,
  Users,
  CheckCircle,
  ArrowLeft,
  Play
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { COURSE_CONTENT, type CourseModule, type Exercise, type CourseLevel, type ContentBlock } from "@/data/courseContent";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n/i18n";

// Extended types for user progress
interface CourseLevelWithProgress extends CourseLevel {
  isCompleted?: boolean;
  score?: number;
  bestScore?: number;
  attempts?: number;
}

interface CourseModuleWithProgress extends CourseModule {
  levels: CourseLevelWithProgress[];
}

interface LearningStats {
  totalXp: number;
  currentStreak: number;
  longestStreak: number;
  totalLessonsCompleted: number;
  averageScore: string;
}

export default function Courses() {
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [currentLevel, setCurrentLevel] = useState<string | null>(null);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, any>>({});
  const [exerciseStartTime, setExerciseStartTime] = useState<number>(Date.now());
  const [showResults, setShowResults] = useState(false);
  const [viewMode, setViewMode] = useState<'content' | 'exercises'>('content');

  const queryClient = useQueryClient();
  const { t } = useTranslation('courses');

  // Fetch user data to check for special access
  const { data: userData } = useQuery({
    queryKey: ['/api/auth/user'],
    enabled: true
  });

  // Fetch user progress from backend
  const { data: progressData, isLoading: progressLoading } = useQuery({
    queryKey: ['/api/courses/progress'],
    enabled: true
  });

  // Check if current user is Jan Milata (special access)
  const isJanMilata = (userData as any)?.id === 'user_2yYgmUlJG1EBLQqYEg7d64Ex2Zc';

  // Submit exercise completion
  const submitExerciseMutation = useMutation({
    mutationFn: async (exerciseData: any) => {
      return apiRequest('/api/courses/submit-exercise', 'POST', exerciseData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/courses/progress'] });
    }
  });

  // User learning stats from backend
  const stats: LearningStats = (progressData as any)?.stats || {
    totalXp: 0,
    currentStreak: 0,
    longestStreak: 0,
    totalLessonsCompleted: 0,
    averageScore: "0"
  };

  // Get user achievements from backend data
  const userAchievements = (progressData as any)?.achievements || [];

  // Start a lesson
  const startLesson = (moduleId: string, levelId: string) => {
    setSelectedModule(moduleId);
    setCurrentLevel(levelId);
    setCurrentExerciseIndex(0);
    setUserAnswers({});
    setExerciseStartTime(Date.now());
    setShowResults(false);
    setViewMode('content');
  };

  // Handle exercise answer
  const handleAnswer = (exerciseId: string, answer: any) => {
    setUserAnswers(prev => ({
      ...prev,
      [exerciseId]: answer
    }));
  };

  // Complete current exercise and move to next
  const completeExercise = () => {
    // For now, just finish the level since we have basic exercises
    finishLevel();
  };

  // Finish the entire level
  const finishLevel = async () => {
    if (!currentLevel || !selectedModule) return;

    const timeSpent = Math.floor((Date.now() - exerciseStartTime) / 1000);
    const scorePercentage = 85; // Mock score for now

    // Submit to backend
    try {
      await submitExerciseMutation.mutateAsync({
        moduleId: selectedModule,
        levelId: currentLevel,
        score: scorePercentage,
        timeSpent,
        isCompleted: true
      });

      setShowResults(true);
    } catch (error) {
      console.error('Failed to submit exercise:', error);
    }
  };

  // Return to module selection
  const returnToModules = () => {
    setSelectedModule(null);
    setCurrentLevel(null);
    setCurrentExerciseIndex(0);
    setUserAnswers({});
    setShowResults(false);
    setViewMode('content');
  };

  if (progressLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Loading Financial Literacy Courses...</p>
          </div>
        </div>
      </div>
    );
  }

  // Results view
  if (showResults) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Card className="text-center">
          <CardHeader>
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <Trophy className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Lesson Complete!</CardTitle>
            <CardDescription>Great job completing the lesson</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-3xl font-bold text-green-600">85%</div>
              <p className="text-muted-foreground">You scored above the 70% threshold</p>
              <div className="flex gap-4 justify-center">
                <Button onClick={returnToModules}>Back to Courses</Button>
                <Button variant="outline" onClick={() => setShowResults(false)}>
                  Review Lesson
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Content/Exercise view
  if (currentLevel && !showResults) {
    if (viewMode === 'content') {
      return (
        <div className="container mx-auto p-6 max-w-6xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">
                {t(`modules.cash-flow-mastery.levels.${currentLevel}.title`, { defaultValue: 'Cash Flow Mastery Level' })}
              </h1>
              <p className="text-muted-foreground">
                {t('modules.cash-flow-mastery.title', { defaultValue: 'Cash Flow Mastery' })}
              </p>
            </div>
            <Button variant="outline" onClick={returnToModules}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Exit Lesson
            </Button>
          </div>

          {/* Learning Objectives */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Target className="w-5 h-5" />
                {t('common.learningObjectives', { defaultValue: 'Learning Objectives:' })}
              </h3>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>{t(`modules.cash-flow-mastery.levels.${currentLevel}.objectives.0`, { defaultValue: 'Understand cash flow fundamentals' })}</li>
                <li>{t(`modules.cash-flow-mastery.levels.${currentLevel}.objectives.1`, { defaultValue: 'Learn income and expense tracking' })}</li>
                <li>{t(`modules.cash-flow-mastery.levels.${currentLevel}.objectives.2`, { defaultValue: 'Develop financial awareness' })}</li>
              </ul>
            </CardContent>
          </Card>

          {/* Content Tabs */}
          <div className="space-y-8 mb-8">
            {/* Level 1 Content */}
            {currentLevel === 'level1' && (
              <Tabs defaultValue="basics" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="basics">{t('modules.cash-flow-mastery.tabs.basics', { defaultValue: 'Cash Flow Basics' })}</TabsTrigger>
                  <TabsTrigger value="foundation">{t('modules.cash-flow-mastery.tabs.foundation', { defaultValue: 'Foundation' })}</TabsTrigger>
                  <TabsTrigger value="pipeline">{t('modules.cash-flow-mastery.tabs.pipeline', { defaultValue: 'Pipeline System' })}</TabsTrigger>
                </TabsList>

                <TabsContent value="basics" className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BookOpen className="w-5 h-5" />
                        {t('modules.cash-flow-mastery.levels.level1.whatIsCashFlow.title', { defaultValue: 'What is Cash Flow?' })}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4 text-base leading-relaxed">
                        <p>{t('modules.cash-flow-mastery.levels.level1.whatIsCashFlow.content', { 
                          defaultValue: 'Cash flow is the lifeblood of your finances. Simply put, it\'s the money coming in (income) and the money going out (expenses) over a specific period.'
                        })}</p>
                        
                        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r">
                          <div className="flex items-center gap-2 mb-2">
                            <Lightbulb className="w-5 h-5 text-blue-600" />
                            <h3 className="text-lg font-semibold text-blue-800">Case Study: Alex's $200 Monthly Discovery</h3>
                          </div>
                          <div className="text-blue-700 whitespace-pre-line">
                            {t('modules.cash-flow-mastery.levels.level1.caseStudy.content', {
                              defaultValue: `Meet Alex, a 25-year-old marketing professional earning $4,500/month. Alex always felt broke despite having a decent salary.

**The Problem:** Alex had no idea where the money was going.

**The Solution:** Alex spent 30 minutes reviewing bank statements and discovered:
• Netflix: $15/month ✓ (still using)
• Spotify: $10/month ✓ (still using)  
• Adobe Creative: $53/month ✗ (hadn't used in 8 months)
• Gym membership: $89/month ✗ (going once per month)
• Food delivery apps: $312/month ✗ (ordering 4-5 times/week)

**The Result:** By canceling unused subscriptions and cooking 3 more meals per week, Alex freed up $200/month - that's $2,400 per year!

**Alex's words:** "I couldn't believe I was throwing away $200 every month. That money now goes straight to my emergency fund."`
                            })}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="foundation" className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5" />
                        {t('modules.cash-flow-mastery.levels.level1.foundation.title', { defaultValue: 'Building Your Foundation' })}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4 text-base leading-relaxed whitespace-pre-line">
                        {t('modules.cash-flow-mastery.levels.level1.foundation.content', {
                          defaultValue: `**STEP 1: The 3-Minute Money Snapshot**

Think of this like taking your financial "temperature" - quick, essential, and reveals a lot about your financial health.

**Monthly Income:** $______
**Monthly Fixed Expenses:** $______ (rent, car payment, insurance, etc.)
**Monthly Variable Expenses:** $______ (food, entertainment, gas, etc.)
**Money Left Over:** $______ (This is your cash flow!)

**STEP 2: The Truth Test**

Most people think they know their spending... until they actually track it.

**The 48-Hour Challenge:**
• Track every single purchase for 48 hours
• Include coffee, snacks, apps, everything
• Write it down immediately (don't rely on memory)
• Total it up at the end

**Common Surprises:**
• Daily coffee: $6 x 22 working days = $132/month
• Lunch out: $12 x 22 working days = $264/month  
• Random purchases: Often $50-100/month more than expected

**STEP 3: The Power Realization**

Cash flow awareness = Financial control
When you know where every dollar goes, you can redirect them toward your goals instead of wondering where they went.`
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="pipeline" className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Target className="w-5 h-5" />
                        {t('modules.cash-flow-mastery.levels.level1.pipeline.title', { defaultValue: 'Your Cash Flow Pipeline' })}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4 text-base leading-relaxed whitespace-pre-line">
                        {t('modules.cash-flow-mastery.levels.level1.pipeline.content', {
                          defaultValue: `**VISUAL: Cash Flow Pipeline**

\`\`\`
INCOME SOURCES        CASH FLOW           EXPENSE CATEGORIES
                     PIPELINE
💼 Salary         ──┐                    ┌── 🏠 Housing
💰 Side Work      ──┤                    ├── 🚗 Transportation  
📈 Investments    ──┤       💰💰💰       ├── 🍕 Food
🎁 Other Income   ──┘                    ├── 💊 Health
                                         ├── 🎮 Entertainment
                                         └── 💳 Debt Payments
\`\`\`

**The Pipeline Shows:**
• **Width** = Amount of money
• **Color** = Type of category  
• **Flow Direction** = Where your money goes

**Key Insight:** Most people focus on the income side but ignore the expense side. True cash flow mastery requires optimizing BOTH sides of the pipeline.`
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            )}

            {/* Level 2-6 would have similar comprehensive content structures */}
            {currentLevel !== 'level1' && (
              <Card>
                <CardHeader>
                  <CardTitle>Level Content</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 text-base leading-relaxed whitespace-pre-line">
                    {t(`modules.cash-flow-mastery.levels.${currentLevel}.incomeCategories.content`, {
                      defaultValue: 'Comprehensive content for this level is available in the translation files. This includes detailed strategies, case studies, and actionable frameworks.'
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Continue to exercises */}
          <div className="text-center">
            <Button 
              size="lg" 
              onClick={() => setViewMode('exercises')}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
            >
              <Play className="w-4 h-4 mr-2" />
              Start Exercises (1 question)
            </Button>
          </div>
        </div>
      );
    }

    // Exercise view
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Knowledge Check</h1>
            <p className="text-muted-foreground">Test your understanding</p>
          </div>
          <Button variant="outline" onClick={returnToModules}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Exit Lesson
          </Button>
        </div>

        <div className="mb-8">
          <div className="flex justify-between text-sm mb-2">
            <span>Question 1 of 1</span>
            <span>100% Complete</span>
          </div>
          <Progress value={100} className="h-2" />
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-xl">
              {t('modules.cash-flow-mastery.exercises.cashFlowReflection.question', {
                defaultValue: 'What is the most important first step in cash flow management?'
              })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                t('modules.cash-flow-mastery.exercises.cashFlowReflection.options.0', { defaultValue: 'Increase your income immediately' }),
                t('modules.cash-flow-mastery.exercises.cashFlowReflection.options.1', { defaultValue: 'Track and understand your current spending patterns' }),
                t('modules.cash-flow-mastery.exercises.cashFlowReflection.options.2', { defaultValue: 'Cut all unnecessary expenses' }),
                t('modules.cash-flow-mastery.exercises.cashFlowReflection.options.3', { defaultValue: 'Create a complex budget spreadsheet' })
              ].map((option, index) => (
                <Button
                  key={index}
                  variant={userAnswers['question1'] === option ? "default" : "outline"}
                  className="w-full text-left justify-start h-auto p-4"
                  onClick={() => handleAnswer('question1', option)}
                >
                  {option}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="text-center">
          <Button 
            size="lg" 
            onClick={completeExercise}
            disabled={!userAnswers['question1']}
            className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
          >
            Complete Lesson
          </Button>
        </div>
      </div>
    );
  }

  // Module selection view
  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4">
          {t('title', { defaultValue: 'Financial Literacy Courses' })}
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          {t('subtitle', { defaultValue: 'Master essential financial skills through interactive, gamified learning experiences' })}
        </p>
      </div>

      {/* User Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.totalXp}</div>
            <div className="text-sm text-muted-foreground">Total XP</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.currentStreak}</div>
            <div className="text-sm text-muted-foreground">Current Streak</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">{stats.totalLessonsCompleted}</div>
            <div className="text-sm text-muted-foreground">Lessons Complete</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{stats.averageScore}%</div>
            <div className="text-sm text-muted-foreground">Average Score</div>
          </CardContent>
        </Card>
      </div>

      {/* Course Modules */}
      <div className="grid gap-6">
        <Card className="overflow-hidden border-2 hover:border-primary/50 transition-colors">
          <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-6 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">
                    {t('modules.cash-flow-mastery.title', { defaultValue: 'Cash Flow Mastery' })}
                  </h3>
                  <p className="text-emerald-100">
                    {t('modules.cash-flow-mastery.description', { defaultValue: 'Master the art of managing money in and money out' })}
                  </p>
                </div>
              </div>
              <Badge variant="secondary" className="bg-white/20 text-white">
                {t('modules.cash-flow-mastery.difficulty', { defaultValue: 'Beginner' })}
              </Badge>
            </div>
          </div>
          
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                {t('modules.cash-flow-mastery.estimatedTime', { defaultValue: '2 hours' })}
              </div>
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
            </div>

            <div className="space-y-3 mb-6">
              {/* Level 1 */}
              <div 
                className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
                onClick={() => startLesson('cash-flow-mastery', 'level1')}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-semibold text-emerald-600">1</span>
                  </div>
                  <div>
                    <div className="font-medium">
                      {t('modules.cash-flow-mastery.levels.level1.title', { defaultValue: 'Welcome & The Power of Cash Flow Awareness' })}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {t('modules.cash-flow-mastery.levels.level1.description', { defaultValue: 'Learn the fundamentals of cash flow and why it matters' })}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">15 min</Badge>
                  <Button size="sm" variant="outline">
                    Start
                  </Button>
                </div>
              </div>

              {/* Levels 2-6 - Show as locked for non-Jan users */}
              {[2, 3, 4, 5, 6].map((levelNum) => (
                <div 
                  key={levelNum}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    isJanMilata ? 'bg-gray-50 hover:bg-gray-100 cursor-pointer' : 'bg-gray-25 opacity-60'
                  } transition-colors`}
                  onClick={() => isJanMilata && startLesson('cash-flow-mastery', `level${levelNum}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      isJanMilata ? 'bg-emerald-100' : 'bg-gray-200'
                    }`}>
                      {isJanMilata ? (
                        <span className="text-sm font-semibold text-emerald-600">{levelNum}</span>
                      ) : (
                        <Lock className="w-4 h-4 text-gray-500" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium">
                        {t(`modules.cash-flow-mastery.levels.level${levelNum}.title`, { 
                          defaultValue: `Level ${levelNum}: Advanced Concepts` 
                        })}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {isJanMilata ? (
                          t(`modules.cash-flow-mastery.levels.level${levelNum}.description`, { 
                            defaultValue: 'Advanced cash flow strategies and implementation' 
                          })
                        ) : (
                          'Unlock with Premium subscription'
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">20 min</Badge>
                    {isJanMilata ? (
                      <Button size="sm" variant="outline">
                        Start
                      </Button>
                    ) : (
                      <Lock className="w-4 h-4 text-gray-500" />
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {isJanMilata ? '6 levels available' : '1 of 6 levels available'}
              </div>
              {!isJanMilata && (
                <Button variant="outline" size="sm">
                  Upgrade for Full Access
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}