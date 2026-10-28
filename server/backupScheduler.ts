import { log } from './logger';
import type { BackupSettings } from '@shared/schema';
import { storage } from './storage';
import { cloudStorage } from './cloudStorage';
import { withJobRun } from './errorGuard/jobs.js';

interface ScheduledBackup {
  userId: string;
  scheduledTime: Date;
  retryCount: number;
}

class BackupScheduler {
  private scheduledBackups: Map<string, NodeJS.Timeout> = new Map();
  private activeBackups: Set<string> = new Set();
  private readonly RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAY = 5 * 60 * 1000; // 5 minutes

  constructor() {
    // Start the scheduler
    this.initializeScheduler();
  }

  private async initializeScheduler() {
    log.info('Backup scheduler initialized');
    
    // Schedule existing users
    await this.scheduleAllActiveUsers();
    
    // Run every hour to check for missed backups.
    // Wrapped so the run is recorded: a missing row is how a dead scheduler is noticed.
    setInterval(() => {
      void withJobRun('backup-scheduler', () => this.checkMissedBackups());
    }, 60 * 60 * 1000); // 1 hour
  }

  private async scheduleAllActiveUsers() {
    try {
      // Get all users with premium plans and active backup settings
      const activeBackupUsers = await storage.getUsersWithActiveBackups();
      
      for (const user of activeBackupUsers) {
        await this.scheduleUserBackup(user.userId);
      }
      
      log.info(`Scheduled backups for ${activeBackupUsers.length} users`);
    } catch (error) {
      log.error('Failed to schedule active users:', error);
    }
  }

  async scheduleUserBackup(userId: string) {
    try {
      const settings = await storage.getUserBackupSettings(userId);
      if (!settings || !settings.autoBackup) {
        return;
      }

      // Clear existing schedule
      this.clearUserSchedule(userId);

      const nextBackupTime = this.calculateNextBackupTime(settings);
      if (!nextBackupTime) {
        return;
      }

      const delay = nextBackupTime.getTime() - Date.now();
      if (delay <= 0) {
        // Backup is overdue, schedule immediately
        this.performBackup(userId);
        return;
      }

      const timeout = setTimeout(() => {
        this.performBackup(userId);
      }, delay);

      this.scheduledBackups.set(userId, timeout);
      
      // Update next backup date in database
      await storage.updateBackupSettings(userId, {
        nextBackupDate: nextBackupTime
      });

      log.info(`Scheduled backup for user ${userId} at ${nextBackupTime.toISOString()}`);
    } catch (error) {
      log.error(`Failed to schedule backup for user ${userId}:`, error);
    }
  }

  private calculateNextBackupTime(settings: BackupSettings): Date | null {
    const now = new Date();
    const lastBackup = settings.lastBackupDate ? new Date(settings.lastBackupDate) : null;
    
    let nextBackup = new Date();
    
    switch (settings.frequency) {
      case 'daily':
        if (lastBackup) {
          nextBackup = new Date(lastBackup);
          nextBackup.setDate(nextBackup.getDate() + 1);
        } else {
          // First backup - schedule for next day at 2 AM
          nextBackup.setDate(nextBackup.getDate() + 1);
          nextBackup.setHours(2, 0, 0, 0);
        }
        break;
        
      case 'weekly':
        if (lastBackup) {
          nextBackup = new Date(lastBackup);
          nextBackup.setDate(nextBackup.getDate() + 7);
        } else {
          // First backup - schedule for next Sunday at 2 AM
          const daysUntilSunday = (7 - nextBackup.getDay()) % 7 || 7;
          nextBackup.setDate(nextBackup.getDate() + daysUntilSunday);
          nextBackup.setHours(2, 0, 0, 0);
        }
        break;
        
      case 'monthly':
        if (lastBackup) {
          nextBackup = new Date(lastBackup);
          nextBackup.setMonth(nextBackup.getMonth() + 1);
        } else {
          // First backup - schedule for first day of next month at 2 AM
          nextBackup.setMonth(nextBackup.getMonth() + 1, 1);
          nextBackup.setHours(2, 0, 0, 0);
        }
        break;
        
      default:
        return null;
    }
    
    // If the calculated time is in the past, move it forward
    while (nextBackup <= now) {
      switch (settings.frequency) {
        case 'daily':
          nextBackup.setDate(nextBackup.getDate() + 1);
          break;
        case 'weekly':
          nextBackup.setDate(nextBackup.getDate() + 7);
          break;
        case 'monthly':
          nextBackup.setMonth(nextBackup.getMonth() + 1);
          break;
      }
    }
    
    return nextBackup;
  }

  private async performBackup(userId: string, retryCount = 0) {
    if (this.activeBackups.has(userId)) {
      log.info(`Backup already in progress for user ${userId}`);
      return;
    }

    try {
      this.activeBackups.add(userId);
      log.info(`Starting backup for user ${userId} (attempt ${retryCount + 1})`);

      // Check if user still has premium plan
      const user = await storage.getUser(userId);
      if (!user || user.plan !== 'premium') {
        log.info(`User ${userId} no longer has premium plan, skipping backup`);
        return;
      }

      // Get user's data for backup
      const backupData = await this.collectUserData(userId);
      
      // The same provider the manual "Backup now" button and the status tab use, so the two
      // cannot disagree about where a backup went.
      const backupFilename = await cloudStorage.createBackup(userId, backupData);
      
      // Clean up old backups based on retention policy
      const settings = await storage.getUserBackupSettings(userId);
      if (settings && settings.retentionDays) {
        try {
          await cloudStorage.cleanupOldBackups(userId, settings.retentionDays);
        } catch (error) {
          log.error(`Failed to cleanup old backups for user ${userId}:`, error);
          // Don't fail the backup process if cleanup fails
        }
      }
      
      // Update backup status in database
      const backupInfo = await cloudStorage.getBackupInfo(userId);
      await storage.updateBackupSettings(userId, {
        lastBackupDate: new Date(),
        totalBackups: backupInfo.totalBackups,
        totalSize: this.formatFileSize(backupInfo.totalSize),
        status: 'active'
      });

      log.info(`Backup completed successfully for user ${userId}: ${backupFilename}`);
      
      // Schedule next backup
      await this.scheduleUserBackup(userId);
      
    } catch (error) {
      log.error(`Backup failed for user ${userId} (attempt ${retryCount + 1}):`, error);
      
      // Update status to error
      await storage.updateBackupSettings(userId, {
        status: 'error'
      });
      
      // Retry if attempts remain
      if (retryCount < this.RETRY_ATTEMPTS) {
        setTimeout(() => {
          this.performBackup(userId, retryCount + 1);
        }, this.RETRY_DELAY);
      } else {
        log.error(`Backup failed permanently for user ${userId} after ${this.RETRY_ATTEMPTS} attempts`);
      }
    } finally {
      this.activeBackups.delete(userId);
    }
  }

  private async collectUserData(userId: string) {
    const [transactions, budgets, expenseReminders, goals, collaborativeGoals, categories] = await Promise.all([
      storage.getUserTransactions(userId),
      storage.getUserBudgets(userId),
      storage.getUserExpenseReminders(userId),
      storage.getUserGoals(userId),
      storage.getUserCollaborativeGoals(userId),
      storage.getCategories()
    ]);

    return {
      transactions,
      budgets,
      expenseReminders,
      goals,
      collaborativeGoals,
      categories,
      metadata: {
        exportDate: new Date().toISOString(),
        version: '2.0',
        userId,
        dataTypes: ['transactions', 'budgets', 'expenseReminders', 'goals', 'collaborativeGoals', 'categories']
      }
    };
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private clearUserSchedule(userId: string) {
    const existingTimeout = this.scheduledBackups.get(userId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this.scheduledBackups.delete(userId);
    }
  }

  private async checkMissedBackups() {
    try {
      const overdueUsers = await storage.getUsersWithOverdueBackups();
      
      for (const user of overdueUsers) {
        if (!this.activeBackups.has(user.userId) && !this.scheduledBackups.has(user.userId)) {
          log.info(`Found overdue backup for user ${user.userId}, scheduling immediate backup`);
          this.performBackup(user.userId);
        }
      }
    } catch (error) {
      log.error('Failed to check for missed backups:', error);
    }
  }

  // Public methods for manual control
  async triggerManualBackup(userId: string): Promise<void> {
    await this.performBackup(userId);
  }

  async updateUserSchedule(userId: string): Promise<void> {
    await this.scheduleUserBackup(userId);
  }

  async pauseUserBackups(userId: string): Promise<void> {
    this.clearUserSchedule(userId);
    await storage.updateBackupSettings(userId, {
      status: 'paused'
    });
  }

  async resumeUserBackups(userId: string): Promise<void> {
    await storage.updateBackupSettings(userId, {
      status: 'active'
    });
    await this.scheduleUserBackup(userId);
  }

  getScheduledBackups(): string[] {
    return Array.from(this.scheduledBackups.keys());
  }

  getActiveBackups(): string[] {
    return Array.from(this.activeBackups);
  }
}

// Singleton instance
export const backupScheduler = new BackupScheduler();