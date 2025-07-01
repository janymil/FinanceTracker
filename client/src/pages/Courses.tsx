import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
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
  CheckCircle
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
  const [selectedModule, setSelectedModule] = useState<CourseModule | null>(null);
  const [currentLevel, setCurrentLevel] = useState<CourseLevel | null>(null);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, any>>({});
  const [exerciseStartTime, setExerciseStartTime] = useState<number>(Date.now());
  const [showResults, setShowResults] = useState(false);
  const [viewMode, setViewMode] = useState<'content' | 'exercises'>('content');

  const queryClient = useQueryClient();
  const { t } = useTranslation('courses');

  // Icon mapping for modules
  const getIcon = (iconName: string) => {
    const iconMap: Record<string, any> = {
      Calculator: BookOpen,
      ShoppingCart: ShoppingCart,
      TrendingUp: TrendingUp,
      Star: Star,
      Award: Award,
      Trophy: Trophy,
      Flame: Flame
    };
    return iconMap[iconName] || BookOpen;
  };

  // Use static course content
  const modules: CourseModule[] = COURSE_CONTENT;
  
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

  // Calculate completion percentage for a module
  const getModuleProgress = (module: CourseModule): number => {
    if (!module.levels.length) return 0;
    
    const userProgress = (progressData as any)?.progress || [];
    const moduleProgress = userProgress.filter((p: any) => p.moduleId === module.id);
    
    if (moduleProgress.length === 0) return 0;
    
    const completedLevels = moduleProgress.filter((p: any) => p.isCompleted).length;
    return Math.round((completedLevels / module.levels.length) * 100);
  };

  // Start a lesson
  const startLesson = (module: CourseModule, level: CourseLevel) => {
    setSelectedModule(module);
    setCurrentLevel(level);
    setCurrentExerciseIndex(0);
    setUserAnswers({});
    setExerciseStartTime(Date.now());
    setShowResults(false);
    setViewMode('content'); // Always start with content
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
    if (!currentLevel || !currentLevel.exercises || currentExerciseIndex >= currentLevel.exercises.length - 1) {
      finishLevel();
      return;
    }
    setCurrentExerciseIndex(prev => prev + 1);
  };

  // Finish the entire level
  const finishLevel = async () => {
    if (!currentLevel || !selectedModule) return;

    const timeSpent = Math.floor((Date.now() - exerciseStartTime) / 1000);
    let totalScore = 0;
    let correctAnswers = 0;

    // Calculate score based on correct answers
    (currentLevel.exercises || []).forEach(exercise => {
      const userAnswer = userAnswers[exercise.id];
      const isCorrect = Array.isArray(exercise.correctAnswer) 
        ? JSON.stringify(exercise.correctAnswer.sort()) === JSON.stringify(userAnswer?.sort())
        : exercise.correctAnswer === userAnswer;
      
      if (isCorrect) {
        correctAnswers++;
        totalScore += exercise.points;
      }
    });

    const scorePercentage = currentLevel.exercises?.length ? (correctAnswers / currentLevel.exercises.length) * 100 : 0;
    const isCompleted = scorePercentage >= 70; // 70% threshold to pass

    // Submit to backend
    try {
      const result = await submitExerciseMutation.mutateAsync({
        moduleId: selectedModule.id,
        levelId: currentLevel.id,
        score: scorePercentage,
        timeSpent,
        isCompleted
      });

      // Exercise completed successfully

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



  // Content/Exercise view
  if (currentLevel && !showResults) {
    if (viewMode === 'content') {
      // Simple tabbed content view without complex state management
      return (
        <div className="container mx-auto p-6 max-w-6xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">{currentLevel.title}</h1>
              <p className="text-muted-foreground">{selectedModule?.title}</p>
            </div>
            <Button variant="outline" onClick={returnToModules}>
              Exit Lesson
            </Button>
          </div>

          {/* Learning Objectives */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Target className="w-5 h-5" />
                Learning Objectives:
              </h3>
              <ul className="list-disc list-inside text-sm space-y-1">
                {currentLevel.learningObjectives.map((objective, index) => (
                  <li key={index}>{objective}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Display all tabs content in full width without calculators */}
          {currentLevel.tabs && currentLevel.tabs.length > 0 ? (
            <div className="space-y-8 mb-8">
              {currentLevel.tabs.map((tab, tabIndex) => (
                <Card key={tab.id} className="border-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <span>{tab.icon}</span>
                      {tab.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {tab.content.map((block, index) => (
                        <div key={index}>
                          {block.type === 'text' && (
                            <div>
                              {block.title && <h3 className="text-lg font-semibold mb-3">{block.title}</h3>}
                              <div className="text-base leading-relaxed whitespace-pre-line">{block.content}</div>
                            </div>
                          )}
                          
                          {block.type === 'example' && (
                            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r">
                              <div className="flex items-center gap-2 mb-2">
                                <Lightbulb className="w-5 h-5 text-blue-600" />
                                <h3 className="text-lg font-semibold text-blue-800">{block.title}</h3>
                              </div>
                              <div className="text-blue-700 whitespace-pre-line">{block.content}</div>
                            </div>
                          )}
                          
                          {block.type === 'tip' && (
                            <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded-r">
                              <div className="flex items-center gap-2 mb-2">
                                <Zap className="w-5 h-5 text-green-600" />
                                <h3 className="text-lg font-semibold text-green-800">{block.title}</h3>
                              </div>
                              <div className="text-green-700 whitespace-pre-line">{block.content}</div>
                            </div>
                          )}
                          
                          {block.type === 'warning' && (
                            <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-r">
                              <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle className="w-5 h-5 text-red-600" />
                                <h3 className="text-lg font-semibold text-red-800">{block.title}</h3>
                              </div>
                              <div className="text-red-700 whitespace-pre-line">{block.content}</div>
                            </div>
                          )}

                          {block.type === 'scenario' && (
                            <div className="bg-purple-50 border-l-4 border-purple-400 p-4 rounded-r">
                              <div className="flex items-center gap-2 mb-2">
                                <Users className="w-5 h-5 text-purple-600" />
                                <h3 className="text-lg font-semibold text-purple-800">{block.title}</h3>
                              </div>
                              <div className="text-purple-700 whitespace-pre-line">{block.content}</div>
                            </div>
                          )}

                          {block.type === 'interactive' && (
                            <div className="bg-orange-50 border-l-4 border-orange-400 p-4 rounded-r">
                              <div className="flex items-center gap-2 mb-2">
                                <CheckCircle className="w-5 h-5 text-orange-600" />
                                <h3 className="text-lg font-semibold text-orange-800">{block.title}</h3>
                              </div>
                              <div className="text-orange-700 whitespace-pre-line">{block.content}</div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            // Show message if no tabs available
            <div className="text-center py-8">
              <p className="text-gray-600">Content is organized in tabs above. Please select a tab to view the lesson content.</p>
            </div>
          )}

          {/* Continue to exercises */}
          <div className="text-center">
            <Button 
              size="lg" 
              onClick={() => setViewMode('exercises')}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
            >
              Start Exercises ({currentLevel?.exercises?.length || 0} questions)
            </Button>
          </div>
        </div>
      );
    }

    // Exercise view
    const currentExercise = currentLevel?.exercises?.[currentExerciseIndex];
    const progress = currentLevel?.exercises ? ((currentExerciseIndex + 1) / currentLevel.exercises.length) * 100 : 0;

    // Guard clause: if no current exercise, return to content view
    if (!currentExercise) {
      setViewMode('content');
      return null;
    }

    return (
      <div className="container mx-auto p-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">{currentLevel.title}</h1>
            <p className="text-muted-foreground">{selectedModule?.title}</p>
          </div>
          <Button variant="outline" onClick={returnToModules}>
            Exit Lesson
          </Button>
        </div>

        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex justify-between text-sm mb-2">
            <span>Question {currentExerciseIndex + 1} of {currentLevel?.exercises?.length || 0}</span>
            <span>{Math.round(progress)}% Complete</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Exercise content */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-xl">{currentExercise.question}</CardTitle>
          </CardHeader>
          <CardContent>
            {currentExercise.type === 'multiple-choice' && (
              <div className="space-y-3">
                {currentExercise.options?.map((option, index) => (
                  <Button
                    key={index}
                    variant={userAnswers[currentExercise.id] === option ? "default" : "outline"}
                    className="w-full text-left justify-start h-auto p-4"
                    onClick={() => handleAnswer(currentExercise.id, option)}
                  >
                    {option}
                  </Button>
                ))}
              </div>
            )}

            {currentExercise.type === 'true-false' && (
              <div className="flex gap-4">
                <Button
                  variant={userAnswers[currentExercise.id] === 'true' ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => handleAnswer(currentExercise.id, 'true')}
                >
                  True
                </Button>
                <Button
                  variant={userAnswers[currentExercise.id] === 'false' ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => handleAnswer(currentExercise.id, 'false')}
                >
                  False
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action buttons */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => setCurrentExerciseIndex(prev => Math.max(0, prev - 1))}
            disabled={currentExerciseIndex === 0}
          >
            Previous
          </Button>
          <Button
            onClick={completeExercise}
            disabled={!userAnswers[currentExercise.id]}
            className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
          >
            {currentExerciseIndex === (currentLevel?.exercises?.length || 1) - 1 ? 'Finish Lesson' : 'Next Question'}
          </Button>
        </div>
      </div>
    );
  }

  // Results view
  if (showResults && currentLevel) {
    const correctAnswers = (currentLevel?.exercises || []).filter(exercise => {
      const userAnswer = userAnswers[exercise.id];
      return Array.isArray(exercise.correctAnswer) 
        ? JSON.stringify(exercise.correctAnswer.sort()) === JSON.stringify(userAnswer?.sort())
        : exercise.correctAnswer === userAnswer;
    }).length;

    const scorePercentage = currentLevel?.exercises?.length ? (correctAnswers / currentLevel.exercises.length) * 100 : 0;
    const passed = scorePercentage >= 70;

    return (
      <div className="container mx-auto p-6 max-w-2xl">
        <Card className="text-center">
          <CardHeader>
            <div className="mx-auto mb-4">
              {passed ? (
                <CheckCircle2 className="w-16 h-16 text-green-500" />
              ) : (
                <Target className="w-16 h-16 text-orange-500" />
              )}
            </div>
            <CardTitle className="text-2xl">
              {passed ? 'Lesson Complete!' : 'Keep Learning!'}
            </CardTitle>
            <CardDescription>
              You scored {correctAnswers} out of {currentLevel?.exercises?.length || 0} questions correctly
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-3xl font-bold text-primary">
              {Math.round(scorePercentage)}%
            </div>
            
            {passed && (
              <div className="flex items-center justify-center gap-2 text-green-600">
                <Zap className="w-5 h-5" />
                <span>+{currentLevel.xpReward} XP earned!</span>
              </div>
            )}

            <div className="flex gap-4 mt-6">
              <Button onClick={returnToModules} variant="outline" className="flex-1">
                Back to Courses
              </Button>
              {!passed && (
                <Button onClick={() => {
                  setShowResults(false);
                  setCurrentExerciseIndex(0);
                  setUserAnswers({});
                  setExerciseStartTime(Date.now());
                }} className="flex-1">
                  Try Again
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main course overview
  return (
    <div className="container mx-auto p-6">
      {/* Header with stats */}
      <div className="flex flex-col lg:flex-row gap-6 mb-8">
        <div className="flex-1">
          <h1 className="text-3xl font-bold mb-2">{t('courses.title')}</h1>
          <p className="text-muted-foreground">
            {t('courses.subtitle')}
          </p>
        </div>
        
        {/* Stats cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="text-center">
            <CardContent className="p-4">
              <div className="flex items-center justify-center mb-2">
                <Zap className="w-5 h-5 text-yellow-500" />
              </div>
              <div className="text-2xl font-bold">{stats.totalXp}</div>
              <div className="text-xs text-muted-foreground">{t('courses.stats.totalXp')}</div>
            </CardContent>
          </Card>
          
          <Card className="text-center">
            <CardContent className="p-4">
              <div className="flex items-center justify-center mb-2">
                <Flame className="w-5 h-5 text-orange-500" />
              </div>
              <div className="text-2xl font-bold">{stats.currentStreak}</div>
              <div className="text-xs text-muted-foreground">{t('courses.stats.dayStreak')}</div>
            </CardContent>
          </Card>
          
          <Card className="text-center">
            <CardContent className="p-4">
              <div className="flex items-center justify-center mb-2">
                <Trophy className="w-5 h-5 text-gold-500" />
              </div>
              <div className="text-2xl font-bold">{stats.longestStreak}</div>
              <div className="text-xs text-muted-foreground">{t('courses.stats.bestStreak')}</div>
            </CardContent>
          </Card>
          
          <Card className="text-center">
            <CardContent className="p-4">
              <div className="flex items-center justify-center mb-2">
                <BookOpen className="w-5 h-5 text-blue-500" />
              </div>
              <div className="text-2xl font-bold">{stats.totalLessonsCompleted}</div>
              <div className="text-xs text-muted-foreground">{t('courses.stats.lessons')}</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Course modules */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {modules.map((module, index) => {
          const progress = getModuleProgress(module);
          // Jan Milata gets access to all courses, others follow normal progression
          const isLocked = !isJanMilata && index > 0 && getModuleProgress(modules[index - 1]) < 100;
          
          return (
            <Card key={module.id} className={`relative ${isLocked ? 'opacity-60' : 'hover:shadow-lg transition-shadow'}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl flex items-center">
                      {React.createElement(getIcon(module.icon), { className: "h-6 w-6" })}
                    </div>
                    <div>
                      <CardTitle className="text-lg">
                        {t(`courses.modules.${module.id}.title`, module.title)}
                      </CardTitle>
                      <CardDescription className="text-sm">
                        {t(`courses.modules.${module.id}.description`, module.description)}
                      </CardDescription>
                    </div>
                  </div>
                  {isLocked && <Lock className="w-5 h-5 text-muted-foreground" />}
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-4">
                  {/* Progress */}
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Progress</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                  
                  {/* Module info */}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <BookOpen className="w-4 h-4" />
                      <span>{module.totalLevels} lessons</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>{module.estimatedTime}</span>
                    </div>
                  </div>
                  
                  {/* Lessons list */}
                  <div className="space-y-2">
                    {module.levels.slice(0, 3).map((level) => (
                      <div key={level.id} className="flex items-center justify-between">
                        <span className="text-sm truncate">
                          {t(`courses.modules.${module.id}.levels.${level.id}.title`, level.title)}
                        </span>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-xs">+{level.xpReward} XP</Badge>
                        </div>
                      </div>
                    ))}
                    {module.levels.length > 3 && (
                      <div className="text-xs text-muted-foreground">
                        +{module.levels.length - 3} more lessons
                      </div>
                    )}
                  </div>
                  
                  {/* Start button */}
                  <Button 
                    className="w-full"
                    disabled={isLocked}
                    onClick={() => {
                      // Find the first incomplete level or start from the beginning
                      const userProgress = (progressData as any)?.progress || [];
                      const moduleProgress = userProgress.filter((p: any) => p.moduleId === module.id);
                      
                      let levelToStart = module.levels[0]; // Default to first level
                      
                      // Find first incomplete level
                      for (const level of module.levels) {
                        const levelProgress = moduleProgress.find((p: any) => p.levelId === level.id);
                        if (!levelProgress || !levelProgress.isCompleted) {
                          levelToStart = level;
                          break;
                        }
                      }
                      
                      startLesson(module, levelToStart);
                    }}
                  >
                    {isLocked ? 'Locked' : progress === 0 ? 'Start Course' : 'Continue'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Achievements section */}
      {userAchievements.length > 0 && (
        <div className="mt-12">
          <Separator className="mb-6" />
          <h2 className="text-2xl font-bold mb-6">Your Achievements</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {userAchievements.map((achievement: any) => (
              <Card key={achievement.id} className="text-center border-yellow-200 bg-yellow-50">
                <CardContent className="p-4">
                  <div className="text-3xl mb-2 flex justify-center">
                    <Trophy className="h-8 w-8 text-yellow-600" />
                  </div>
                  <CardTitle className="text-lg mb-1">
                    {achievement.title || achievement.badgeId}
                  </CardTitle>
                  <CardDescription className="text-sm mb-2">
                    {achievement.description || 'Achievement unlocked!'}<br/>
                    Earned {new Date(achievement.earnedAt).toLocaleDateString()}
                  </CardDescription>
                  <Badge variant="default" className="text-xs bg-yellow-600">
                    🏆 Achieved
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}