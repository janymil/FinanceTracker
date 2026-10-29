import { log } from './logger';
import { storage } from './storage';
import { sendGraceExpiryWarning, sendAccountDowngradedNotification } from './emailService';
import { withJobRun } from './errorGuard/jobs.js';
import { listDuePendingPlanChanges } from './billingDocuments';

class GraceProcessor {
  private isRunning = false;

  // A cancelled subscription whose paid period has now run out.
  //
  // This is not a failed payment: MercadoPago preapprovals cannot be cancelled "at period end",
  // so the cancellation route remembers the date and the plan is kept until it passes. There is
  // no further notification from MercadoPago to act on, which is why this sweep exists.
  private async downgradeExpiredPaidPeriods(): Promise<void> {
    const expired = await storage.getUsersWithExpiredPaidUntil();
    if (expired.length === 0) return;

    log.info(`Found ${expired.length} cancelled subscriptions whose paid period has ended`);

    for (const user of expired) {
      try {
        await storage.updateUser(user.id, { plan: 'free', paidUntil: null } as any);
        log.info(`Downgraded ${user.id} to free: the paid period of a cancelled subscription ended`);

        if (user.email) {
          const sent = await sendAccountDowngradedNotification(user.email, user.firstName || 'User');
          log.info(`Downgrade notification after cancellation sent to ${user.email}: ${sent}`);
        }
      } catch (error) {
        log.error(`Error ending the paid period of ${user.id}:`, error);
      }
    }
  }

  /**
   * Plan changes the customer already asked for, whose charge date has arrived.
   *
   * MercadoPago cannot schedule a downgrade, so the request is stored with the date of the charge
   * it belongs to. `subscription_authorized_payment` applies it when the notification arrives;
   * this sweep is the safety net for a notification that never came. Applying it twice is
   * harmless — the second run finds nothing pending.
   */
  private async applyScheduledPlanChanges(): Promise<void> {
    const due = await listDuePendingPlanChanges();
    if (due.length === 0) return;

    log.info(`Applying ${due.length} scheduled plan change(s)`);

    for (const user of due) {
      try {
        const plan = user.pendingPlan as 'standard' | 'premium';
        const interval = (user.pendingInterval ?? 'monthly') as 'monthly' | 'yearly';
        await storage.updateUserPlan(user.id, plan, interval);
        await storage.updateUser(user.id, {
          pendingPlan: null,
          pendingInterval: null,
          pendingChangeAt: null,
        } as any);
        log.info(`${user.id} moved to the scheduled ${plan}/${interval}`);
      } catch (error) {
        log.error(`Error applying the scheduled plan change of ${user.id}:`, error);
      }
    }
  }

  // Process users in grace period for warnings and downgrades
  async processGracePeriods(): Promise<void> {
    if (this.isRunning) {
      log.info('Grace period processor already running, skipping...');
      return;
    }

    try {
      this.isRunning = true;
      log.info('Starting grace period processing...');

      await this.downgradeExpiredPaidPeriods();
      await this.applyScheduledPlanChanges();

      // Get users with expired grace periods for downgrade
      const expiredUsers = await storage.getUsersWithExpiredGrace();
      log.info(`Found ${expiredUsers.length} users with expired grace periods`);
      // Downgrade expired users
      for (const user of expiredUsers) {
        try {
          log.info(`Downgrading user ${user.id} to free plan (grace period expired)`);
          
          // Update user plan to free
          await storage.updateUser(user.id, {
            plan: 'free',
            gracePeriodActive: false,
            graceExpiresAt: null,
            paymentFailureCount: 0
          });

          // Send downgrade notification
          if (user.email) {
            const sent = await sendAccountDowngradedNotification(
              user.email,
              user.firstName || 'User'
            );
            log.info(`Downgrade notification sent to ${user.email}: ${sent}`);
          }

          log.info(`Successfully downgraded user ${user.id}`);
        } catch (error) {
          log.error(`Error downgrading user ${user.id}:`, error);
        }
      }

      // Get users still in grace period for warnings
      const graceUsers = await storage.getUsersInGracePeriod();
      log.info(`Found ${graceUsers.length} users still in grace period`);

      // Send warnings to users approaching grace expiry
      for (const user of graceUsers) {
        try {
          if (!user.graceExpiresAt || !user.email) continue;

          const now = new Date();
          const hoursRemaining = Math.round((user.graceExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60));
          
          // Send warning if less than 24 hours remaining and no recent notification
          const shouldWarn = hoursRemaining <= 24 && hoursRemaining > 0;
          const recentlyNotified = user.lastPaymentFailureNotified && 
            (now.getTime() - user.lastPaymentFailureNotified.getTime()) < (6 * 60 * 60 * 1000); // 6 hours

          if (shouldWarn && !recentlyNotified) {
            log.info(`Sending grace expiry warning to user ${user.id} (${hoursRemaining}h remaining)`);
            
            const sent = await sendGraceExpiryWarning(
              user.email,
              user.firstName || 'User',
              hoursRemaining
            );

            if (sent) {
              // Update notification timestamp
              await storage.updateUser(user.id, {
                lastPaymentFailureNotified: now
              });
              log.info(`Grace warning sent to ${user.email}`);
            }
          }
        } catch (error) {
          log.error(`Error processing grace warning for user ${user.id}:`, error);
        }
      }

      log.info('Grace period processing completed');
    } catch (error) {
      log.error('Error in grace period processor:', error);
    } finally {
      this.isRunning = false;
    }
  }

  // Start the grace period processor with interval
  start(): void {
    log.info('Grace period processor initialized - running every 12 hours');
    
    // Run immediately, then every 12 hours. Both are recorded as job runs.
    void withJobRun('grace-period', () => this.processGracePeriods());

    setInterval(() => {
      void withJobRun('grace-period', () => this.processGracePeriods());
    }, 12 * 60 * 60 * 1000); // 12 hours
  }
}

export const graceProcessor = new GraceProcessor();