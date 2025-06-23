"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.insertContextualFinancialTipsSchema = exports.insertRedeemCodeSchema = exports.insertMilestoneAchievementSchema = exports.insertChallengeActivitySchema = exports.insertGoalContributionSchema = exports.insertCollaborativeGoalParticipantSchema = exports.insertCollaborativeGoalSchema = exports.insertFriendshipSchema = exports.insertExpenseReminderSchema = exports.insertRecurringTransactionSchema = exports.insertGoalSchema = exports.insertBudgetSchema = exports.insertTransactionSchema = exports.importLogs = exports.dailyRecommendations = exports.aiCache = exports.redeemCodes = exports.financialMascots = exports.contextualFinancialTips = exports.milestoneAchievements = exports.challengeActivities = exports.goalContributions = exports.collaborativeGoalParticipants = exports.collaborativeGoals = exports.friendships = exports.backupSettings = exports.goals = exports.expenseReminders = exports.budgets = exports.recurringTransactions = exports.transactions = exports.categories = exports.users = exports.sessions = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_zod_1 = require("drizzle-zod");
const zod_1 = require("zod");
exports.sessions = (0, pg_core_1.pgTable)("sessions", {
    sid: (0, pg_core_1.varchar)("sid").primaryKey(),
    sess: (0, pg_core_1.jsonb)("sess").notNull(),
    expire: (0, pg_core_1.timestamp)("expire").notNull(),
}, (table) => [(0, pg_core_1.index)("IDX_session_expire").on(table.expire)]);
exports.users = (0, pg_core_1.pgTable)("users", {
    id: (0, pg_core_1.varchar)("id").primaryKey().notNull(),
    email: (0, pg_core_1.varchar)("email").unique(),
    firstName: (0, pg_core_1.varchar)("first_name"),
    lastName: (0, pg_core_1.varchar)("last_name"),
    profileImageUrl: (0, pg_core_1.varchar)("profile_image_url"),
    phone: (0, pg_core_1.varchar)("phone"),
    website: (0, pg_core_1.varchar)("website"),
    password: (0, pg_core_1.varchar)("password"),
    plan: (0, pg_core_1.varchar)("plan", { length: 20 }).default("free").notNull(),
    billingInterval: (0, pg_core_1.varchar)("billing_interval", { length: 20 }).default("monthly"),
    currency: (0, pg_core_1.varchar)("currency", { length: 5 }),
    stripeCustomerId: (0, pg_core_1.varchar)("stripe_customer_id"),
    stripeSubscriptionId: (0, pg_core_1.varchar)("stripe_subscription_id"),
    activatedAt: (0, pg_core_1.timestamp)("activated_at"),
    settings: (0, pg_core_1.text)("settings"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
exports.categories = (0, pg_core_1.pgTable)("categories", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    userId: (0, pg_core_1.varchar)("user_id").references(() => exports.users.id),
    name: (0, pg_core_1.varchar)("name", { length: 100 }).notNull(),
    icon: (0, pg_core_1.varchar)("icon", { length: 50 }).notNull(),
    color: (0, pg_core_1.varchar)("color", { length: 20 }).notNull(),
    type: (0, pg_core_1.varchar)("type", { length: 20 }).notNull(),
});
exports.transactions = (0, pg_core_1.pgTable)("transactions", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    userId: (0, pg_core_1.varchar)("user_id").notNull().references(() => exports.users.id),
    categoryId: (0, pg_core_1.integer)("category_id").references(() => exports.categories.id),
    amount: (0, pg_core_1.decimal)("amount", { precision: 12, scale: 2 }).notNull(),
    description: (0, pg_core_1.text)("description").notNull(),
    type: (0, pg_core_1.varchar)("type", { length: 20 }).notNull(),
    date: (0, pg_core_1.timestamp)("date").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    isRecurring: (0, pg_core_1.boolean)("is_recurring").default(false),
    recurringFrequency: (0, pg_core_1.varchar)("recurring_frequency", { length: 20 }),
    recurringEndDate: (0, pg_core_1.timestamp)("recurring_end_date"),
    parentTransactionId: (0, pg_core_1.integer)("parent_transaction_id"),
    paymentUrl: (0, pg_core_1.text)("payment_url"),
    referenceNote: (0, pg_core_1.text)("reference_note"),
    imageUrl: (0, pg_core_1.text)("image_url"),
    ocrText: (0, pg_core_1.text)("ocr_text"),
    ocrVendor: (0, pg_core_1.varchar)("ocr_vendor", { length: 255 }),
    ocrDetectedAmount: (0, pg_core_1.decimal)("ocr_detected_amount", { precision: 12, scale: 2 }),
    ocrDetectedDate: (0, pg_core_1.timestamp)("ocr_detected_date"),
});
exports.recurringTransactions = (0, pg_core_1.pgTable)("recurring_transactions", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    userId: (0, pg_core_1.varchar)("user_id").notNull().references(() => exports.users.id),
    categoryId: (0, pg_core_1.integer)("category_id").references(() => exports.categories.id),
    amount: (0, pg_core_1.decimal)("amount", { precision: 12, scale: 2 }).notNull(),
    description: (0, pg_core_1.text)("description").notNull(),
    type: (0, pg_core_1.varchar)("type", { length: 20 }).notNull(),
    frequency: (0, pg_core_1.varchar)("frequency", { length: 20 }).notNull(),
    startDate: (0, pg_core_1.timestamp)("start_date").notNull(),
    endDate: (0, pg_core_1.timestamp)("end_date"),
    isActive: (0, pg_core_1.boolean)("is_active").default(true),
    lastProcessed: (0, pg_core_1.timestamp)("last_processed"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
exports.budgets = (0, pg_core_1.pgTable)("budgets", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    userId: (0, pg_core_1.varchar)("user_id").notNull().references(() => exports.users.id),
    categoryId: (0, pg_core_1.integer)("category_id").references(() => exports.categories.id),
    amount: (0, pg_core_1.decimal)("amount", { precision: 12, scale: 2 }).notNull(),
    period: (0, pg_core_1.varchar)("period", { length: 20 }).notNull(),
    startDate: (0, pg_core_1.timestamp)("start_date").notNull(),
    endDate: (0, pg_core_1.timestamp)("end_date").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
exports.expenseReminders = (0, pg_core_1.pgTable)("expense_reminders", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    userId: (0, pg_core_1.varchar)("user_id").notNull().references(() => exports.users.id),
    categoryId: (0, pg_core_1.integer)("category_id").references(() => exports.categories.id),
    title: (0, pg_core_1.varchar)("title", { length: 255 }).notNull(),
    description: (0, pg_core_1.text)("description"),
    amount: (0, pg_core_1.decimal)("amount", { precision: 12, scale: 2 }),
    dueDate: (0, pg_core_1.timestamp)("due_date").notNull(),
    isRecurring: (0, pg_core_1.boolean)("is_recurring").default(false),
    recurringFrequency: (0, pg_core_1.varchar)("recurring_frequency", { length: 20 }),
    recurringEndDate: (0, pg_core_1.timestamp)("recurring_end_date"),
    reminderDaysBefore: (0, pg_core_1.integer)("reminder_days_before").default(1),
    isActive: (0, pg_core_1.boolean)("is_active").default(true),
    isCompleted: (0, pg_core_1.boolean)("is_completed").default(false),
    lastReminded: (0, pg_core_1.timestamp)("last_reminded"),
    paymentUrl: (0, pg_core_1.text)("payment_url"),
    referenceNote: (0, pg_core_1.text)("reference_note"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
exports.goals = (0, pg_core_1.pgTable)("goals", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    userId: (0, pg_core_1.varchar)("user_id").notNull().references(() => exports.users.id),
    name: (0, pg_core_1.varchar)("name", { length: 255 }).notNull(),
    description: (0, pg_core_1.text)("description"),
    targetAmount: (0, pg_core_1.decimal)("target_amount", { precision: 12, scale: 2 }).notNull(),
    currentAmount: (0, pg_core_1.decimal)("current_amount", { precision: 12, scale: 2 }).default("0.00").notNull(),
    targetDate: (0, pg_core_1.timestamp)("target_date").notNull(),
    category: (0, pg_core_1.varchar)("category", { length: 100 }).notNull(),
    status: (0, pg_core_1.varchar)("status", { length: 50 }).default("active").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
exports.backupSettings = (0, pg_core_1.pgTable)("backup_settings", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    userId: (0, pg_core_1.varchar)("user_id").notNull().references(() => exports.users.id),
    autoBackup: (0, pg_core_1.boolean)("auto_backup").default(true),
    frequency: (0, pg_core_1.varchar)("frequency", { length: 20 }).default("daily"),
    retentionDays: (0, pg_core_1.integer)("retention_days").default(7),
    includeAttachments: (0, pg_core_1.boolean)("include_attachments").default(true),
    encryptBackups: (0, pg_core_1.boolean)("encrypt_backups").default(true),
    lastBackupDate: (0, pg_core_1.timestamp)("last_backup_date"),
    nextBackupDate: (0, pg_core_1.timestamp)("next_backup_date"),
    totalBackups: (0, pg_core_1.integer)("total_backups").default(0),
    totalSize: (0, pg_core_1.varchar)("total_size", { length: 50 }).default("0 MB"),
    status: (0, pg_core_1.varchar)("status", { length: 20 }).default("active"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
exports.friendships = (0, pg_core_1.pgTable)("friendships", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    requesterId: (0, pg_core_1.varchar)("requester_id").notNull().references(() => exports.users.id),
    recipientId: (0, pg_core_1.varchar)("recipient_id").notNull().references(() => exports.users.id),
    status: (0, pg_core_1.varchar)("status", { length: 20 }).default("pending").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    acceptedAt: (0, pg_core_1.timestamp)("accepted_at"),
});
exports.collaborativeGoals = (0, pg_core_1.pgTable)("collaborative_goals", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    name: (0, pg_core_1.varchar)("name", { length: 255 }).notNull(),
    description: (0, pg_core_1.text)("description"),
    targetAmount: (0, pg_core_1.decimal)("target_amount", { precision: 12, scale: 2 }).notNull(),
    currentAmount: (0, pg_core_1.decimal)("current_amount", { precision: 12, scale: 2 }).default("0.00").notNull(),
    targetDate: (0, pg_core_1.timestamp)("target_date").notNull(),
    category: (0, pg_core_1.varchar)("category", { length: 100 }).notNull(),
    challengeType: (0, pg_core_1.varchar)("challenge_type", { length: 50 }).notNull(),
    status: (0, pg_core_1.varchar)("status", { length: 50 }).default("active").notNull(),
    createdBy: (0, pg_core_1.varchar)("created_by").notNull().references(() => exports.users.id),
    isPublic: (0, pg_core_1.boolean)("is_public").default(false),
    joinCode: (0, pg_core_1.varchar)("join_code", { length: 20 }),
    milestoneRewards: (0, pg_core_1.jsonb)("milestone_rewards"),
    competitionRules: (0, pg_core_1.jsonb)("competition_rules"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
exports.collaborativeGoalParticipants = (0, pg_core_1.pgTable)("collaborative_goal_participants", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    goalId: (0, pg_core_1.integer)("goal_id").notNull().references(() => exports.collaborativeGoals.id),
    userId: (0, pg_core_1.varchar)("user_id").notNull().references(() => exports.users.id),
    personalTarget: (0, pg_core_1.decimal)("personal_target", { precision: 12, scale: 2 }),
    currentContribution: (0, pg_core_1.decimal)("current_contribution", { precision: 12, scale: 2 }).default("0.00").notNull(),
    role: (0, pg_core_1.varchar)("role", { length: 20 }).default("participant").notNull(),
    status: (0, pg_core_1.varchar)("status", { length: 20 }).default("active").notNull(),
    joinedAt: (0, pg_core_1.timestamp)("joined_at").defaultNow(),
    lastContribution: (0, pg_core_1.timestamp)("last_contribution"),
});
exports.goalContributions = (0, pg_core_1.pgTable)("goal_contributions", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    goalId: (0, pg_core_1.integer)("goal_id").notNull().references(() => exports.collaborativeGoals.id),
    userId: (0, pg_core_1.varchar)("user_id").notNull().references(() => exports.users.id),
    amount: (0, pg_core_1.decimal)("amount", { precision: 12, scale: 2 }).notNull(),
    description: (0, pg_core_1.text)("description"),
    contributionType: (0, pg_core_1.varchar)("contribution_type", { length: 50 }).default("manual").notNull(),
    transactionId: (0, pg_core_1.integer)("transaction_id").references(() => exports.transactions.id),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
exports.challengeActivities = (0, pg_core_1.pgTable)("challenge_activities", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    goalId: (0, pg_core_1.integer)("goal_id").notNull().references(() => exports.collaborativeGoals.id),
    userId: (0, pg_core_1.varchar)("user_id").notNull().references(() => exports.users.id),
    activityType: (0, pg_core_1.varchar)("activity_type", { length: 50 }).notNull(),
    title: (0, pg_core_1.varchar)("title", { length: 255 }).notNull(),
    description: (0, pg_core_1.text)("description"),
    amount: (0, pg_core_1.decimal)("amount", { precision: 12, scale: 2 }),
    metadata: (0, pg_core_1.jsonb)("metadata"),
    isPublic: (0, pg_core_1.boolean)("is_public").default(true),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
exports.milestoneAchievements = (0, pg_core_1.pgTable)("milestone_achievements", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    goalId: (0, pg_core_1.integer)("goal_id").notNull().references(() => exports.collaborativeGoals.id),
    userId: (0, pg_core_1.varchar)("user_id").references(() => exports.users.id),
    milestoneType: (0, pg_core_1.varchar)("milestone_type", { length: 50 }).notNull(),
    title: (0, pg_core_1.varchar)("title", { length: 255 }).notNull(),
    description: (0, pg_core_1.text)("description"),
    targetAmount: (0, pg_core_1.decimal)("target_amount", { precision: 12, scale: 2 }).notNull(),
    achievedAmount: (0, pg_core_1.decimal)("achieved_amount", { precision: 12, scale: 2 }).notNull(),
    rewardType: (0, pg_core_1.varchar)("reward_type", { length: 50 }),
    rewardData: (0, pg_core_1.jsonb)("reward_data"),
    achievedAt: (0, pg_core_1.timestamp)("achieved_at").defaultNow(),
});
exports.contextualFinancialTips = (0, pg_core_1.pgTable)("contextual_financial_tips", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    userId: (0, pg_core_1.varchar)("user_id").notNull().references(() => exports.users.id),
    tips: (0, pg_core_1.jsonb)("tips").notNull(),
    dataHash: (0, pg_core_1.varchar)("data_hash", { length: 255 }).notNull(),
    transactionCount: (0, pg_core_1.integer)("transaction_count").notNull(),
    totalIncome: (0, pg_core_1.decimal)("total_income", { precision: 12, scale: 2 }).notNull(),
    totalExpenses: (0, pg_core_1.decimal)("total_expenses", { precision: 12, scale: 2 }).notNull(),
    budgetCount: (0, pg_core_1.integer)("budget_count").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
exports.financialMascots = (0, pg_core_1.pgTable)("financial_mascots", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    userId: (0, pg_core_1.varchar)("user_id").notNull().references(() => exports.users.id),
    imageUrl: (0, pg_core_1.text)("image_url").notNull(),
    healthScore: (0, pg_core_1.integer)("health_score").notNull(),
    mood: (0, pg_core_1.varchar)("mood", { length: 50 }).notNull(),
    generationPrompt: (0, pg_core_1.text)("generation_prompt").notNull(),
    isEnabled: (0, pg_core_1.boolean)("is_enabled").default(true).notNull(),
    lastGenerated: (0, pg_core_1.timestamp)("last_generated").defaultNow(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
exports.redeemCodes = (0, pg_core_1.pgTable)("redeem_codes", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    code: (0, pg_core_1.varchar)("code", { length: 100 }).notNull().unique(),
    redeemed: (0, pg_core_1.boolean)("redeemed").default(false).notNull(),
    userId: (0, pg_core_1.varchar)("user_id").references(() => exports.users.id),
    redeemedAt: (0, pg_core_1.timestamp)("redeemed_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
exports.aiCache = (0, pg_core_1.pgTable)("ai_cache", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    userId: (0, pg_core_1.varchar)("user_id").notNull().references(() => exports.users.id),
    functionName: (0, pg_core_1.varchar)("function_name", { length: 50 }).notNull(),
    month: (0, pg_core_1.varchar)("month", { length: 7 }).notNull(),
    dataHash: (0, pg_core_1.varchar)("data_hash", { length: 32 }).notNull(),
    result: (0, pg_core_1.jsonb)("result").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
exports.dailyRecommendations = (0, pg_core_1.pgTable)("daily_recommendations", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    userId: (0, pg_core_1.text)("user_id").notNull(),
    recommendations: (0, pg_core_1.json)("recommendations").notNull(),
    insights: (0, pg_core_1.json)("insights").notNull(),
    dataHash: (0, pg_core_1.text)("data_hash").notNull(),
    generatedAt: (0, pg_core_1.timestamp)("generated_at").defaultNow().notNull(),
    expiresAt: (0, pg_core_1.timestamp)("expires_at").notNull(),
});
exports.importLogs = (0, pg_core_1.pgTable)("import_logs", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    userId: (0, pg_core_1.varchar)("user_id").notNull().references(() => exports.users.id),
    importedAt: (0, pg_core_1.timestamp)("imported_at").defaultNow().notNull(),
    summary: (0, pg_core_1.jsonb)("summary").notNull(),
    filename: (0, pg_core_1.varchar)("filename", { length: 255 }),
    type: (0, pg_core_1.varchar)("type", { length: 10 }).notNull(),
    status: (0, pg_core_1.varchar)("status", { length: 20 }).default("success").notNull(),
    errorMessage: (0, pg_core_1.text)("error_message"),
});
exports.insertTransactionSchema = (0, drizzle_zod_1.createInsertSchema)(exports.transactions).omit({
    id: true,
    createdAt: true,
}).extend({
    imageUrl: zod_1.z.string().nullable().optional(),
    ocrText: zod_1.z.string().nullable().optional(),
    ocrVendor: zod_1.z.string().nullable().optional(),
    ocrDetectedAmount: zod_1.z.string().nullable().optional(),
    ocrDetectedDate: zod_1.z.date().nullable().optional(),
});
exports.insertBudgetSchema = (0, drizzle_zod_1.createInsertSchema)(exports.budgets).omit({
    id: true,
    createdAt: true,
});
exports.insertGoalSchema = (0, drizzle_zod_1.createInsertSchema)(exports.goals).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
exports.insertRecurringTransactionSchema = (0, drizzle_zod_1.createInsertSchema)(exports.recurringTransactions).omit({
    id: true,
    createdAt: true,
    lastProcessed: true,
});
exports.insertExpenseReminderSchema = (0, drizzle_zod_1.createInsertSchema)(exports.expenseReminders).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    lastReminded: true,
});
exports.insertFriendshipSchema = (0, drizzle_zod_1.createInsertSchema)(exports.friendships).omit({
    id: true,
    createdAt: true,
    acceptedAt: true,
});
exports.insertCollaborativeGoalSchema = (0, drizzle_zod_1.createInsertSchema)(exports.collaborativeGoals).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
exports.insertCollaborativeGoalParticipantSchema = (0, drizzle_zod_1.createInsertSchema)(exports.collaborativeGoalParticipants).omit({
    id: true,
    joinedAt: true,
    lastContribution: true,
});
exports.insertGoalContributionSchema = (0, drizzle_zod_1.createInsertSchema)(exports.goalContributions).omit({
    id: true,
    createdAt: true,
});
exports.insertChallengeActivitySchema = (0, drizzle_zod_1.createInsertSchema)(exports.challengeActivities).omit({
    id: true,
    createdAt: true,
});
exports.insertMilestoneAchievementSchema = (0, drizzle_zod_1.createInsertSchema)(exports.milestoneAchievements).omit({
    id: true,
    achievedAt: true,
});
exports.insertRedeemCodeSchema = (0, drizzle_zod_1.createInsertSchema)(exports.redeemCodes).omit({
    id: true,
    createdAt: true,
    redeemedAt: true,
});
exports.insertContextualFinancialTipsSchema = (0, drizzle_zod_1.createInsertSchema)(exports.contextualFinancialTips).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
