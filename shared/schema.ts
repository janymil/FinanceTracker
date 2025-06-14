import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  decimal,
  boolean,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (required for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  plan: varchar("plan", { length: 20 }).default("free").notNull(),
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  settings: text("settings"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Categories for transactions and budgets
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  icon: varchar("icon", { length: 50 }).notNull(),
  color: varchar("color", { length: 20 }).notNull(),
  type: varchar("type", { length: 20 }).notNull(), // 'income' or 'expense'
});

// Financial transactions
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  categoryId: integer("category_id").references(() => categories.id),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description").notNull(),
  type: varchar("type", { length: 20 }).notNull(), // 'income' or 'expense'
  date: timestamp("date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  // Recurring transaction fields
  isRecurring: boolean("is_recurring").default(false),
  recurringFrequency: varchar("recurring_frequency", { length: 20 }), // 'weekly', 'monthly', 'yearly'
  recurringEndDate: timestamp("recurring_end_date"),
  parentTransactionId: integer("parent_transaction_id"),
  // Smart Bill Assistant fields
  paymentUrl: text("payment_url"),
  referenceNote: text("reference_note"),
});

// Recurring transactions table (separate for cleaner implementation)
export const recurringTransactions = pgTable("recurring_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  categoryId: integer("category_id").references(() => categories.id),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description").notNull(),
  type: varchar("type", { length: 20 }).notNull(), // 'income' or 'expense'
  frequency: varchar("frequency", { length: 20 }).notNull(), // 'weekly', 'monthly', 'yearly'
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  isActive: boolean("is_active").default(true),
  lastProcessed: timestamp("last_processed"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Budget categories
export const budgets = pgTable("budgets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  categoryId: integer("category_id").references(() => categories.id),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  period: varchar("period", { length: 20 }).notNull(), // 'monthly', 'yearly'
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Expense reminders for future and recurring payments
export const expenseReminders = pgTable("expense_reminders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  categoryId: integer("category_id").references(() => categories.id),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  amount: decimal("amount", { precision: 12, scale: 2 }),
  dueDate: timestamp("due_date").notNull(),
  isRecurring: boolean("is_recurring").default(false),
  recurringFrequency: varchar("recurring_frequency", { length: 20 }), // 'weekly', 'monthly', 'yearly'
  recurringEndDate: timestamp("recurring_end_date"),
  reminderDaysBefore: integer("reminder_days_before").default(1), // Days before due date to remind
  isActive: boolean("is_active").default(true),
  isCompleted: boolean("is_completed").default(false),
  lastReminded: timestamp("last_reminded"),
  // Smart Bill Assistant fields
  paymentUrl: text("payment_url"), // URL where user can pay the bill
  referenceNote: text("reference_note"), // Account number or other reference info
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Financial goals
export const goals = pgTable("goals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  targetAmount: decimal("target_amount", { precision: 12, scale: 2 }).notNull(),
  currentAmount: decimal("current_amount", { precision: 12, scale: 2 }).default("0.00").notNull(),
  targetDate: timestamp("target_date").notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  status: varchar("status", { length: 50 }).default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Backup settings for cloud storage
export const backupSettings = pgTable("backup_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  autoBackup: boolean("auto_backup").default(true),
  frequency: varchar("frequency", { length: 20 }).default("daily"), // daily, weekly, monthly
  retentionDays: integer("retention_days").default(7), // 7, 14, 30
  includeAttachments: boolean("include_attachments").default(true),
  encryptBackups: boolean("encrypt_backups").default(true),
  lastBackupDate: timestamp("last_backup_date"),
  nextBackupDate: timestamp("next_backup_date"),
  totalBackups: integer("total_backups").default(0),
  totalSize: varchar("total_size", { length: 50 }).default("0 MB"),
  status: varchar("status", { length: 20 }).default("active"), // active, paused, error
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Friend connections for collaborative features
export const friendships = pgTable("friendships", {
  id: serial("id").primaryKey(),
  requesterId: varchar("requester_id").notNull().references(() => users.id),
  recipientId: varchar("recipient_id").notNull().references(() => users.id),
  status: varchar("status", { length: 20 }).default("pending").notNull(), // pending, accepted, blocked
  createdAt: timestamp("created_at").defaultNow(),
  acceptedAt: timestamp("accepted_at"),
});

// Collaborative savings goal challenges
export const collaborativeGoals = pgTable("collaborative_goals", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  targetAmount: decimal("target_amount", { precision: 12, scale: 2 }).notNull(),
  currentAmount: decimal("current_amount", { precision: 12, scale: 2 }).default("0.00").notNull(),
  targetDate: timestamp("target_date").notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  challengeType: varchar("challenge_type", { length: 50 }).notNull(), // 'collaborative', 'competitive', 'milestone'
  status: varchar("status", { length: 50 }).default("active").notNull(), // active, completed, cancelled
  createdBy: varchar("created_by").notNull().references(() => users.id),
  isPublic: boolean("is_public").default(false), // Whether non-participants can view
  joinCode: varchar("join_code", { length: 20 }), // Optional join code for easy sharing
  milestoneRewards: jsonb("milestone_rewards"), // JSON array of milestone rewards
  competitionRules: jsonb("competition_rules"), // Rules for competitive challenges
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Participants in collaborative goals
export const collaborativeGoalParticipants = pgTable("collaborative_goal_participants", {
  id: serial("id").primaryKey(),
  goalId: integer("goal_id").notNull().references(() => collaborativeGoals.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  personalTarget: decimal("personal_target", { precision: 12, scale: 2 }), // Individual target within group goal
  currentContribution: decimal("current_contribution", { precision: 12, scale: 2 }).default("0.00").notNull(),
  role: varchar("role", { length: 20 }).default("participant").notNull(), // creator, participant, viewer
  status: varchar("status", { length: 20 }).default("active").notNull(), // active, left, removed
  joinedAt: timestamp("joined_at").defaultNow(),
  lastContribution: timestamp("last_contribution"),
});

// Contributions to collaborative goals
export const goalContributions = pgTable("goal_contributions", {
  id: serial("id").primaryKey(),
  goalId: integer("goal_id").notNull().references(() => collaborativeGoals.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description"),
  contributionType: varchar("contribution_type", { length: 50 }).default("manual").notNull(), // manual, automatic, milestone
  transactionId: integer("transaction_id").references(() => transactions.id), // Link to actual transaction
  createdAt: timestamp("created_at").defaultNow(),
});

// Challenge activities and updates
export const challengeActivities = pgTable("challenge_activities", {
  id: serial("id").primaryKey(),
  goalId: integer("goal_id").notNull().references(() => collaborativeGoals.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  activityType: varchar("activity_type", { length: 50 }).notNull(), // contribution, milestone, comment, achievement
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  amount: decimal("amount", { precision: 12, scale: 2 }), // For contribution activities
  metadata: jsonb("metadata"), // Additional activity data
  isPublic: boolean("is_public").default(true), // Whether other participants can see
  createdAt: timestamp("created_at").defaultNow(),
});

// Milestone achievements
export const milestoneAchievements = pgTable("milestone_achievements", {
  id: serial("id").primaryKey(),
  goalId: integer("goal_id").notNull().references(() => collaborativeGoals.id),
  userId: varchar("user_id").references(() => users.id), // NULL for group milestones
  milestoneType: varchar("milestone_type", { length: 50 }).notNull(), // personal, group, percentage
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  targetAmount: decimal("target_amount", { precision: 12, scale: 2 }).notNull(),
  achievedAmount: decimal("achieved_amount", { precision: 12, scale: 2 }).notNull(),
  rewardType: varchar("reward_type", { length: 50 }), // badge, points, custom
  rewardData: jsonb("reward_data"), // Reward details
  achievedAt: timestamp("achieved_at").defaultNow(),
});

// Schema exports
export type InsertUser = typeof users.$inferInsert;
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export type InsertTransaction = typeof transactions.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;

export type InsertRecurringTransaction = typeof recurringTransactions.$inferInsert;
export type RecurringTransaction = typeof recurringTransactions.$inferSelect;

export type InsertBudget = typeof budgets.$inferInsert;
export type Budget = typeof budgets.$inferSelect;

export type InsertGoal = typeof goals.$inferInsert;
export type Goal = typeof goals.$inferSelect;

export type InsertExpenseReminder = typeof expenseReminders.$inferInsert;
export type ExpenseReminder = typeof expenseReminders.$inferSelect;

export type InsertBackupSettings = typeof backupSettings.$inferInsert;
export type BackupSettings = typeof backupSettings.$inferSelect;

export type Category = typeof categories.$inferSelect;

// Collaborative features types
export type InsertFriendship = typeof friendships.$inferInsert;
export type Friendship = typeof friendships.$inferSelect;

export type InsertCollaborativeGoal = typeof collaborativeGoals.$inferInsert;
export type CollaborativeGoal = typeof collaborativeGoals.$inferSelect;

export type InsertCollaborativeGoalParticipant = typeof collaborativeGoalParticipants.$inferInsert;
export type CollaborativeGoalParticipant = typeof collaborativeGoalParticipants.$inferSelect;

export type InsertGoalContribution = typeof goalContributions.$inferInsert;
export type GoalContribution = typeof goalContributions.$inferSelect;

export type InsertChallengeActivity = typeof challengeActivities.$inferInsert;
export type ChallengeActivity = typeof challengeActivities.$inferSelect;

export type InsertMilestoneAchievement = typeof milestoneAchievements.$inferInsert;
export type MilestoneAchievement = typeof milestoneAchievements.$inferSelect;

// Insert schemas
export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
});

export const insertBudgetSchema = createInsertSchema(budgets).omit({
  id: true,
  createdAt: true,
});

export const insertGoalSchema = createInsertSchema(goals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRecurringTransactionSchema = createInsertSchema(recurringTransactions).omit({
  id: true,
  createdAt: true,
  lastProcessed: true,
});

export const insertExpenseReminderSchema = createInsertSchema(expenseReminders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastReminded: true,
});

// Collaborative features insert schemas
export const insertFriendshipSchema = createInsertSchema(friendships).omit({
  id: true,
  createdAt: true,
  acceptedAt: true,
});

export const insertCollaborativeGoalSchema = createInsertSchema(collaborativeGoals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCollaborativeGoalParticipantSchema = createInsertSchema(collaborativeGoalParticipants).omit({
  id: true,
  joinedAt: true,
  lastContribution: true,
});

export const insertGoalContributionSchema = createInsertSchema(goalContributions).omit({
  id: true,
  createdAt: true,
});

export const insertChallengeActivitySchema = createInsertSchema(challengeActivities).omit({
  id: true,
  createdAt: true,
});

export const insertMilestoneAchievementSchema = createInsertSchema(milestoneAchievements).omit({
  id: true,
  achievedAt: true,
});