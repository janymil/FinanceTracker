import { storage } from './storage';
import { bunnyStorage } from './bunnyStorage';

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
    console.log('Backup scheduler initialized');
    
    // Schedule existing users
    await this.scheduleAllActiveUsers();
    
    // Run every hour to check for missed backups
    setInterval(() => {
      this.checkMissedBackups();
    }, 60 * 60 * 1000); // 1 hour
  }

  private async scheduleAllActiveUsers() {
    try {
      // Get all users with premium plans and active backup settings
      const activeBackupUsers = await storage.getUsersWithActiveBackups();
      
      for (const user of activeBackupUsers) {
        await this.scheduleUserBackup(user.userId);
      }
      
      console.log(`Scheduled backups for ${activeBackupUsers.length} users`);
    } catch (error) {
      console.error('Failed to schedule active users:', error);
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

      console.log(`Scheduled backup for user ${userId} at ${nextBackupTime.toISOString()}`);
    } catch (error) {
      console.error(`Failed to schedule backup for user ${userId}:`, error);
    }
  }

  private calculateNextBackupTime(settings: any): Date | null {
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
      console.log(`Backup already in progress for user ${userId}`);
      return;
    }

    try {
      this.activeBackups.add(userId);
      console.log(`Starting backup for user ${userId} (attempt ${retryCount + 1})`);

      // Check if user still has premium plan
      const user = await storage.getUser(userId);
      if (!user || user.plan !== 'premium') {
        console.log(`User ${userId} no longer has premium plan, skipping backup`);
        return;
      }

      // Get user's data for backup
      const backupData = await this.collectUserData(userId);
      
      // Upload to Bunny.net
      const backupFilename = await bunnyStorage.createBackup(userId, backupData);
      
      // Clean up old backups based on retention policy
      const settings = await storage.getUserBackupSettings(userId);
      if (settings && settings.retentionDays) {
        try {
          await bunnyStorage.cleanupOldBackups(userId, settings.retentionDays);
        } catch (error) {
          console.error(`Failed to cleanup old backups for user ${userId}:`, error);
          // Don't fail the backup process if cleanup fails
        }
      }
      
      // Update backup status in database
      const backupInfo = await bunnyStorage.getBackupInfo(userId);
      await storage.updateBackupSettings(userId, {
        lastBackupDate: new Date(),
        totalBackups: backupInfo.totalBackups,
        totalSize: this.formatFileSize(backupInfo.totalSize),
        status: 'active'
      });

      console.log(`Backup completed successfully for user ${userId}: ${backupFilename}`);
      
      // Schedule next backup
      await this.scheduleUserBackup(userId);
      
    } catch (error) {
      console.error(`Backup failed for user ${userId} (attempt ${retryCount + 1}):`, error);
      
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
        console.error(`Backup failed permanently for user ${userId} after ${this.RETRY_ATTEMPTS} attempts`);
      }
    } finally {
      this.activeBackups.delete(userId);
    }
  }

  private async collectUserData(userId: string) {
    const [transactions, budgets, expenseReminders, goals] = await Promise.all([
      storage.getUserTransactions(userId),
      storage.getUserBudgets(userId),
      storage.getUserExpenseReminders(userId),
      // Goals would need to be implemented in storage
      []
    ]);

    return {
      transactions,
      budgets,
      expenseReminders,
      goals,
      metadata: {
        exportDate: new Date().toISOString(),
        version: '1.0',
        userId
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
          console.log(`Found overdue backup for user ${user.userId}, scheduling immediate backup`);
          this.performBackup(user.userId);
        }
      }
    } catch (error) {
      console.error('Failed to check for missed backups:', error);
    }
  }

  // Public methods for manual control
  async triggerManualBackup(userId: string): Promise<void> {
    await this.performBackup(userId);
  }

  async updateUserSchedule(userId: number): Promise<void> {
    await this.scheduleUserBackup(userId);
  }

  async pauseUserBackups(userId: number): Promise<void> {
    this.clearUserSchedule(userId);
    await storage.updateBackupSettings(userId, {
      status: 'paused'
    });
  }

  async resumeUserBackups(userId: number): Promise<void> {
    await storage.updateBackupSettings(userId, {
      status: 'active'
    });
    await this.scheduleUserBackup(userId);
  }

  getScheduledBackups(): number[] {
    return Array.from(this.scheduledBackups.keys());
  }

  getActiveBackups(): number[] {
    return Array.from(this.activeBackups);
  }
}

// Singleton instance
export const backupScheduler = new BackupScheduler();