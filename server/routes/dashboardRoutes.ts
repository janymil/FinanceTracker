import { log } from '../logger';
import type { Express } from "express";
import { isAuthenticated, getUserId } from "../clerkAuth";
import { storage } from "../storage";
import { getUserLanguage, translateCategoryName } from "../categoryTranslations";
import { localParts, monthRange } from "@shared/timezones";
import {
  buildDashboardOverview,
  overviewWindow,
  parseMonthParam,
  type OverviewBill,
  type OverviewRecurringRule,
} from "@shared/dashboardOverview";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Days of history read for the logging streak when the month on screen is an older one. */
const STREAK_LOOKBACK_DAYS = 120;

/**
 * The redesigned dashboard in one request.
 *
 * Every number on the page comes from `shared/dashboardOverview`, computed here in the person's own
 * time zone from rows the server already has. No AI is called: the adviser stays a separate,
 * Premium-only request, so opening the dashboard never spends anyone's allowance.
 *
 * Budgets, goals and bill reminders are Standard features; a free account gets the month, the
 * categories and the trend, and the response says which plan produced it so the page can offer the
 * upgrade instead of drawing empty panels.
 */
export function registerDashboardRoutes(app: Express) {
  app.get('/api/dashboard/overview', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const timeZone = await storage.getUserTimeZone(userId);
      const now = new Date();
      const today = localParts(now, timeZone);

      const requested = req.query.month === undefined
        ? { year: today.year, month: today.month }
        : parseMonthParam(req.query.month);
      if (!requested) {
        return res.status(400).json({ message: "month must look like 2026-10", code: 'invalid_month' });
      }

      const language = getUserLanguage(req);
      const translate = <T extends { categoryName?: string | null }>(row: T): T =>
        row.categoryName ? { ...row, categoryName: translateCategoryName(row.categoryName, language) } : row;

      const window = overviewWindow(requested.year, requested.month, timeZone);
      const transactions = (await storage.getTransactionsByDateRange(userId, window.start, window.end)).map(translate);

      const isCurrent = requested.year === today.year && requested.month === today.month;
      const streakTransactions = isCurrent
        ? transactions
        : await storage.getTransactionsByDateRange(userId, new Date(now.getTime() - STREAK_LOOKBACK_DAYS * DAY_MS), now);

      const plan = user.plan || 'free';
      const paid = plan !== 'free';

      let budgets: Awaited<ReturnType<typeof storage.getUserBudgets>> = [];
      let goals: Awaited<ReturnType<typeof storage.getUserGoals>> = [];
      const bills: OverviewBill[] = [];
      const recurringRules: OverviewRecurringRule[] = [];

      if (paid) {
        budgets = (await storage.getUserBudgets(userId, timeZone)).map(translate);
        goals = await storage.getUserGoals(userId);

        // The rules that repeat, so the dashboard can show the ones landing in this month.
        for (const rule of await storage.getUserRecurringTransactions(userId)) {
          recurringRules.push({
            id: rule.id,
            description: rule.description,
            amount: rule.amount,
            type: rule.type,
            frequency: rule.frequency,
            startDate: rule.startDate,
            endDate: rule.endDate,
          });
        }

        // Far enough ahead to cover the rest of this month (the money card) and a week (the list).
        const monthEnd = monthRange(today.year, today.month, timeZone).end;
        const daysAhead = Math.max(7, Math.ceil((monthEnd.getTime() - now.getTime()) / DAY_MS));
        const upcoming = await storage.getUpcomingTransactionReminders(userId, daysAhead);
        for (const reminder of upcoming) {
          // Scheduled rows are transactions already; only a recurring rule's next date is not.
          if (reminder.source !== 'recurring_transaction' || reminder.type !== 'expense') continue;
          bills.push({
            id: reminder.id,
            title: reminder.title,
            amount: reminder.amount,
            dueDate: reminder.dueDate,
            source: 'recurring_transaction',
          });
        }

        const manual = await storage.getUpcomingExpenseReminders(userId, 7);
        for (const reminder of manual) {
          bills.push({
            id: `reminder_${reminder.id}`,
            title: reminder.title,
            amount: reminder.amount ?? 0,
            dueDate: reminder.dueDate,
            source: 'expense_reminder',
          });
        }
      }

      const overview = buildDashboardOverview({
        year: requested.year,
        month: requested.month,
        timeZone,
        now,
        transactions,
        streakTransactions,
        budgets,
        goals,
        bills,
        recurringRules,
      });

      // `budgetCount` drives the first-run checklist ("set a monthly budget").
      return res.json({ ...overview, plan, budgetCount: budgets.length });
    } catch (error) {
      log.error("Error building dashboard overview:", error);
      return res.status(500).json({ message: "Failed to load the dashboard" });
    }
  });
}
