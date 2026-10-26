import { Router } from "express";
import { storage } from "./storage.js";
import { isAuthenticated, getUserId } from "./clerkAuth.js";
import { z } from "zod";
import { log } from './logger';

const router = Router();

/**
 * Content and badges are served from this file's static definitions (below / in the client),
 * not generated per request.
 *
 * `GET /content` and `GET /badges` used to call GPT-4o on every request with no login, no rate
 * limit and no cache. Nothing in the app called either one, so any stranger could repeat the
 * request and bill an AI call each time. The generator module was deleted with them.
 */

// Get user's course progress
router.get("/progress", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    const progress = await storage.getUserCourseProgress(userId);
    const stats = await storage.getUserLearningStats(userId);
    const achievements = await storage.getUserCourseAchievements(userId);
    
    // Enrich achievements with proper titles and descriptions
    const enrichedAchievements = achievements.map(achievement => {
      const definition = ACHIEVEMENT_DEFINITIONS[achievement.badgeId as keyof typeof ACHIEVEMENT_DEFINITIONS];
      return {
        ...achievement,
        title: definition?.title || achievement.badgeId,
        description: definition?.description || 'Achievement unlocked!',
        icon: definition?.icon || 'Trophy'
      };
    });
    
    res.json({ 
      progress: progress || [],
      stats: stats || {
        totalXp: 0,
        currentStreak: 0,
        longestStreak: 0,
        totalLessonsCompleted: 0,
        totalTimeSpent: 0,
        averageScore: 0
      },
      achievements: enrichedAchievements || []
    });
  } catch (error) {
    log.error("Error fetching user progress:", error);
    res.status(500).json({ error: "Failed to fetch course progress" });
  }
});

// Submit exercise completion
const submitExerciseSchema = z.object({
  moduleId: z.string(),
  levelId: z.string(),
  score: z.number().min(0).max(100),
  timeSpent: z.number().min(0), // seconds
  isCompleted: z.boolean()
});

router.post("/submit-exercise", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }
    const data = submitExerciseSchema.parse(req.body);
    
    // Update course progress
    await storage.updateCourseProgress(userId, {
      moduleId: data.moduleId,
      levelId: data.levelId,
      score: data.score,
      timeSpent: data.timeSpent,
      isCompleted: data.isCompleted,
      completedAt: data.isCompleted ? new Date() : null
    });

    // Update learning stats
    await storage.updateLearningStats(userId, {
      xpGained: data.score,
      timeSpent: data.timeSpent,
      lessonCompleted: data.isCompleted
    });

    // Check for new achievements
    const newBadges = await checkForNewAchievements(userId);
    
    res.json({ 
      success: true, 
      xpGained: data.score,
      newBadges: newBadges || []
    });
  } catch (error) {
    log.error("Error submitting exercise:", error);
    res.status(500).json({ error: "Failed to submit exercise" });
  }
});

// Achievement definitions
const ACHIEVEMENT_DEFINITIONS = {
  'first-steps': {
    title: 'First Steps',
    description: 'Complete your first lesson',
    icon: 'Award',
    check: (stats: any) => (stats.totalLessonsCompleted || 0) >= 1
  },
  'learning-streak-7': {
    title: 'Week Warrior',
    description: 'Maintain a 7-day learning streak',
    icon: 'Flame',
    check: (stats: any) => (stats.currentStreak || 0) >= 7
  },
  'learning-streak-30': {
    title: 'Monthly Master',
    description: 'Maintain a 30-day learning streak',
    icon: 'Flame',
    check: (stats: any) => (stats.currentStreak || 0) >= 30
  },
  'xp-collector-100': {
    title: 'XP Collector',
    description: 'Earn 100 XP points',
    icon: 'Star',
    check: (stats: any) => (stats.totalXp || 0) >= 100
  },
  'xp-collector-500': {
    title: 'XP Master',
    description: 'Earn 500 XP points',
    icon: 'Star',
    check: (stats: any) => (stats.totalXp || 0) >= 500
  },
  'module-master': {
    title: 'Module Master',
    description: 'Complete your first module',
    icon: 'Trophy',
    check: (stats: any, progress: any[]) => {
      const modules = ['budgeting-basics', 'smart-saving-strategies'];
      return modules.some(moduleId => {
        const moduleProgress = progress.filter(p => p.moduleId === moduleId);
        const completedLevels = moduleProgress.filter(p => p.isCompleted).length;
        // Assuming 3 levels per module on average
        return completedLevels >= 3;
      });
    }
  },
  'dedicated-learner': {
    title: 'Dedicated Learner',
    description: 'Complete all financial literacy modules',
    icon: 'Trophy',
    check: (stats: any, progress: any[]) => {
      const modules = ['budgeting-basics', 'smart-saving-strategies'];
      return modules.every(moduleId => {
        const moduleProgress = progress.filter(p => p.moduleId === moduleId);
        const completedLevels = moduleProgress.filter(p => p.isCompleted).length;
        return completedLevels >= 3; // All levels completed
      });
    }
  },
  'high-scorer': {
    title: 'High Scorer',
    description: 'Achieve 90%+ score on any lesson',
    icon: 'Target',
    check: (stats: any, progress: any[]) => {
      return progress.some(p => (p.bestScore || 0) >= 90);
    }
  },
  'perfectionist': {
    title: 'Perfectionist',
    description: 'Achieve 100% score on any lesson',
    icon: 'Award',
    check: (stats: any, progress: any[]) => {
      return progress.some(p => (p.bestScore || 0) >= 100);
    }
  }
};

// Achievement checking logic
async function checkForNewAchievements(userId: string) {
  try {
    const stats = await storage.getUserLearningStats(userId);
    const progress = await storage.getUserCourseProgress(userId);
    const existingAchievements = await storage.getUserCourseAchievements(userId);
    const earnedBadgeIds = new Set(existingAchievements.map(a => a.badgeId));
    
    const newBadges: Array<{id: string, title: string, description: string}> = [];
    
    // Only proceed if stats exist
    if (!stats) {
      return newBadges;
    }
    
    // Check each achievement
    for (const [badgeId, achievement] of Object.entries(ACHIEVEMENT_DEFINITIONS)) {
      if (!earnedBadgeIds.has(badgeId)) {
        let shouldAward = false;
        
        // Always provide both parameters
        shouldAward = achievement.check(stats, progress || []);
        
        if (shouldAward) {
          await storage.awardAchievement(userId, badgeId);
          newBadges.push({
            id: badgeId,
            title: achievement.title,
            description: achievement.description
          });
        }
      }
    }
    
    return newBadges;
  } catch (error) {
    log.error("Error checking achievements:", error);
    return [];
  }
}

export default router;