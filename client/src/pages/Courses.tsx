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
  Flame,
  Zap,
  Calculator,
  ShoppingCart,
  TrendingUp,
  Award
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { COURSE_CONTENT, ACHIEVEMENT_BADGES, type CourseModule, type Achievement, type Exercise, type CourseLevel } from "@/data/courseContent";

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

  const queryClient = useQueryClient();

  // Icon mapping for modules and achievements
  const getIcon = (iconName: string) => {
    const iconMap: Record<string, any> = {
      Calculator: Calculator,
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
  const achievements: Achievement[] = ACHIEVEMENT_BADGES;
  
  // Fetch user progress from backend
  const { data: progressData, isLoading: progressLoading } = useQuery({
    queryKey: ['/api/courses/progress'],
    enabled: true
  });

  // Submit exercise completion
  const submitExerciseMutation = useMutation({
    mutationFn: async (exerciseData: any) => {
      return apiRequest('/api/courses/submit-exercise', 'POST', exerciseData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/courses/progress'] });
    }
  });

  // User learning stats (fallback to demo data for now)
  const stats: LearningStats = (progressData as any)?.stats || {
    totalXp: 125, // Demo value to show progress
    currentStreak: 3,
    longestStreak: 5,
    totalLessonsCompleted: 4,
    averageScore: "87.5"
  };

  // Calculate dynamic achievements based on user progress
  const calculateAchievements = () => {
    const userAchievements = [];
    
    // Achievement: First Steps (Complete first lesson)
    if (stats.totalLessonsCompleted >= 1) {
      userAchievements.push({
        id: "first-steps",
        title: "First Steps",
        description: "Complete your first lesson",
        icon: "BookOpen",
        unlocked: true,
        earnedAt: new Date().toLocaleDateString()
      });
    }
    
    // Achievement: Learning Streak (7 day streak)
    if (stats.currentStreak >= 7) {
      userAchievements.push({
        id: "learning-streak",
        title: "Learning Streak",
        description: "Maintain a 7-day learning streak",
        icon: "Flame",
        unlocked: true,
        earnedAt: new Date().toLocaleDateString()
      });
    }
    
    // Achievement: XP Collector (100+ XP)
    if (stats.totalXp >= 100) {
      userAchievements.push({
        id: "xp-collector",
        title: "XP Collector",
        description: "Earn 100 XP points",
        icon: "Zap",
        unlocked: true,
        earnedAt: new Date().toLocaleDateString()
      });
    }
    
    // Achievement: Module Master (Complete any module) 
    const completedModules = COURSE_CONTENT.filter(module => getModuleProgress(module) === 100).length;
    if (completedModules >= 1) {
      userAchievements.push({
        id: "module-master",
        title: "Module Master",
        description: "Complete your first module",
        icon: "Award",
        unlocked: true,
        earnedAt: new Date().toLocaleDateString()
      });
    }
    
    // Achievement: Dedicated Learner (Complete all modules)
    if (completedModules === COURSE_CONTENT.length) {
      userAchievements.push({
        id: "dedicated-learner",
        title: "Dedicated Learner",
        description: "Complete all financial literacy modules",
        icon: "Trophy",
        unlocked: true,
        earnedAt: new Date().toLocaleDateString()
      });
    }
    
    return userAchievements;
  };
  
  const unlockedAchievements = calculateAchievements();

  // Calculate completion percentage for a module
  const getModuleProgress = (module: CourseModule): number => {
    if (!module.levels.length) return 0;
    // For now, return 0 since we're using static content
    // This will be replaced with actual progress from backend
    return 0;
  };

  // Start a lesson
  const startLesson = (module: CourseModule, level: CourseLevel) => {
    setSelectedModule(module);
    setCurrentLevel(level);
    setCurrentExerciseIndex(0);
    setUserAnswers({});
    setExerciseStartTime(Date.now());
    setShowResults(false);
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
    if (!currentLevel || currentExerciseIndex >= currentLevel.exercises.length - 1) {
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
    currentLevel.exercises.forEach(exercise => {
      const userAnswer = userAnswers[exercise.id];
      const isCorrect = Array.isArray(exercise.correctAnswer) 
        ? JSON.stringify(exercise.correctAnswer.sort()) === JSON.stringify(userAnswer?.sort())
        : exercise.correctAnswer === userAnswer;
      
      if (isCorrect) {
        correctAnswers++;
        totalScore += exercise.points;
      }
    });

    const scorePercentage = (correctAnswers / currentLevel.exercises.length) * 100;
    const isCompleted = scorePercentage >= 70; // 70% threshold to pass

    // Submit to backend
    try {
      await submitExerciseMutation.mutateAsync({
        moduleId: selectedModule.id,
        levelId: currentLevel.id,
        score: scorePercentage,
        timeSpent,
        isCompleted
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

  // Exercise view
  if (currentLevel && !showResults) {
    const currentExercise = currentLevel.exercises[currentExerciseIndex];
    const progress = ((currentExerciseIndex + 1) / currentLevel.exercises.length) * 100;

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
            <span>Question {currentExerciseIndex + 1} of {currentLevel.exercises.length}</span>
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
            {currentExerciseIndex === currentLevel.exercises.length - 1 ? 'Finish Lesson' : 'Next Question'}
          </Button>
        </div>
      </div>
    );
  }

  // Results view
  if (showResults && currentLevel) {
    const correctAnswers = currentLevel.exercises.filter(exercise => {
      const userAnswer = userAnswers[exercise.id];
      return Array.isArray(exercise.correctAnswer) 
        ? JSON.stringify(exercise.correctAnswer.sort()) === JSON.stringify(userAnswer?.sort())
        : exercise.correctAnswer === userAnswer;
    }).length;

    const scorePercentage = (correctAnswers / currentLevel.exercises.length) * 100;
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
              You scored {correctAnswers} out of {currentLevel.exercises.length} questions correctly
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
          <h1 className="text-3xl font-bold mb-2">Financial Literacy Courses</h1>
          <p className="text-muted-foreground">
            Build essential financial skills through interactive, bite-sized lessons powered by AI
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
              <div className="text-xs text-muted-foreground">Total XP</div>
            </CardContent>
          </Card>
          
          <Card className="text-center">
            <CardContent className="p-4">
              <div className="flex items-center justify-center mb-2">
                <Flame className="w-5 h-5 text-orange-500" />
              </div>
              <div className="text-2xl font-bold">{stats.currentStreak}</div>
              <div className="text-xs text-muted-foreground">Day Streak</div>
            </CardContent>
          </Card>
          
          <Card className="text-center">
            <CardContent className="p-4">
              <div className="flex items-center justify-center mb-2">
                <Trophy className="w-5 h-5 text-gold-500" />
              </div>
              <div className="text-2xl font-bold">{stats.longestStreak}</div>
              <div className="text-xs text-muted-foreground">Best Streak</div>
            </CardContent>
          </Card>
          
          <Card className="text-center">
            <CardContent className="p-4">
              <div className="flex items-center justify-center mb-2">
                <BookOpen className="w-5 h-5 text-blue-500" />
              </div>
              <div className="text-2xl font-bold">{stats.totalLessonsCompleted}</div>
              <div className="text-xs text-muted-foreground">Lessons</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Course modules */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {modules.map((module, index) => {
          const progress = getModuleProgress(module);
          const isLocked = index > 0 && getModuleProgress(modules[index - 1]) < 100;
          
          return (
            <Card key={module.id} className={`relative ${isLocked ? 'opacity-60' : 'hover:shadow-lg transition-shadow'}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl flex items-center">
                      {React.createElement(getIcon(module.icon), { className: "h-6 w-6" })}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{module.title}</CardTitle>
                      <CardDescription className="text-sm">{module.description}</CardDescription>
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
                        <span className="text-sm truncate">{level.title}</span>
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
                      // For now, always start with the first level since we don't have progress tracking
                      startLesson(module, module.levels[0]);
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
      {achievements.length > 0 && (
        <div className="mt-12">
          <Separator className="mb-6" />
          <h2 className="text-2xl font-bold mb-6">Available Achievements</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {achievements.map((achievement) => (
              <Card key={achievement.id} className="text-center">
                <CardContent className="p-4">
                  <div className="text-3xl mb-2 flex justify-center">
                    {React.createElement(getIcon(achievement.icon), { className: "h-8 w-8" })}
                  </div>
                  <CardTitle className="text-lg mb-1">{achievement.title}</CardTitle>
                  <CardDescription className="text-sm mb-2">{achievement.description}</CardDescription>
                  <Badge variant="outline" className="text-xs">
                    {achievement.xpRequired} XP Required
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