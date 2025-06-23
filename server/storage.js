"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storage = exports.DatabaseStorage = void 0;
const schema_1 = require("@shared/schema");
const db_1 = require("./db");
const encryption_1 = require("./encryption");
const drizzle_orm_1 = require("drizzle-orm");
class DatabaseStorage {
    async getUser(id) {
        const [user] = await db_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, id));
        return user;
    }
    async getUserByEmail(email) {
        const [user] = await db_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.email, email));
        return user;
    }
    async createUser(user) {
        const [newUser] = await db_1.db
            .insert(schema_1.users)
            .values(user)
            .returning();
        return newUser;
    }
    async upsertUser(userData) {
        try {
            const [newUser] = await db_1.db
                .insert(schema_1.users)
                .values({
                id: userData.id,
                email: userData.email || `${userData.id}@clerk.user`,
                firstName: userData.firstName,
                lastName: userData.lastName,
                profileImageUrl: userData.profileImageUrl,
                plan: userData.plan || 'free',
                currency: userData.currency,
                stripeCustomerId: userData.stripeCustomerId,
                stripeSubscriptionId: userData.stripeSubscriptionId,
                settings: userData.settings,
                createdAt: new Date(),
                updatedAt: new Date()
            })
                .returning();
            return newUser;
        }
        catch (error) {
            if (error.code === '23505' || error.message?.includes('duplicate key')) {
                const [existingUser] = await db_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, userData.id));
                if (existingUser) {
                    if (!existingUser.email || existingUser.email.endsWith('@clerk.user')) {
                        const emailToUse = userData.email || `${userData.id}@clerk.user`;
                        const [updatedUser] = await db_1.db
                            .update(schema_1.users)
                            .set({
                            email: emailToUse,
                            firstName: userData.firstName || existingUser.firstName,
                            lastName: userData.lastName || existingUser.lastName,
                            profileImageUrl: userData.profileImageUrl || existingUser.profileImageUrl,
                            updatedAt: new Date()
                        })
                            .where((0, drizzle_orm_1.eq)(schema_1.users.id, userData.id))
                            .returning();
                        return updatedUser;
                    }
                    return existingUser;
                }
            }
            throw error;
        }
    }
    async updateUserStripeInfo(userId, customerId, subscriptionId) {
        const [user] = await db_1.db
            .update(schema_1.users)
            .set({
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(schema_1.users.id, userId))
            .returning();
        return user;
    }
    async updateUserPlan(userId, plan, billingInterval = 'monthly') {
        const updatedUsers = await db_1.db
            .update(schema_1.users)
            .set({
            plan,
            billingInterval,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(schema_1.users.id, userId))
            .returning();
        if (updatedUsers.length === 0) {
            throw new Error('User not found');
        }
        return updatedUsers[0];
    }
    async updateUserPremiumStatus(userId, isPremium) {
        const plan = isPremium ? 'premium' : 'free';
        return await this.updateUserPlan(userId, plan);
    }
    async createTransaction(transaction) {
        const encryptedTransaction = {
            ...transaction,
            amount: encryption_1.DataEncryption.encryptAmount(transaction.amount),
            description: encryption_1.DataEncryption.encryptDescription(transaction.description),
            referenceNote: transaction.referenceNote ? encryption_1.DataEncryption.encrypt(transaction.referenceNote) : null
        };
        const [newTransaction] = await db_1.db.insert(schema_1.transactions).values(encryptedTransaction).returning();
        if (transaction.isRecurring && transaction.recurringFrequency) {
            try {
                await db_1.db.insert(schema_1.recurringTransactions).values({
                    userId: transaction.userId,
                    categoryId: transaction.categoryId,
                    description: transaction.description,
                    amount: transaction.amount,
                    type: transaction.type,
                    frequency: transaction.recurringFrequency,
                    startDate: transaction.date,
                    endDate: transaction.recurringEndDate,
                    isActive: true,
                    lastProcessed: transaction.date,
                });
            }
            catch (error) {
                console.error('Error creating recurring transaction record:', error);
            }
        }
        return {
            ...newTransaction,
            amount: encryption_1.DataEncryption.decryptAmount(newTransaction.amount),
            description: encryption_1.DataEncryption.decryptDescription(newTransaction.description),
            referenceNote: newTransaction.referenceNote ? encryption_1.DataEncryption.decrypt(newTransaction.referenceNote) : null
        };
    }
    async getUserTransactions(userId, limit) {
        let query = db_1.db
            .select({
            id: schema_1.transactions.id,
            userId: schema_1.transactions.userId,
            categoryId: schema_1.transactions.categoryId,
            amount: schema_1.transactions.amount,
            description: schema_1.transactions.description,
            date: schema_1.transactions.date,
            type: schema_1.transactions.type,
            createdAt: schema_1.transactions.createdAt,
            isRecurring: schema_1.transactions.isRecurring,
            recurringFrequency: schema_1.transactions.recurringFrequency,
            recurringEndDate: schema_1.transactions.recurringEndDate,
            parentTransactionId: schema_1.transactions.parentTransactionId,
            paymentUrl: schema_1.transactions.paymentUrl,
            referenceNote: schema_1.transactions.referenceNote,
            categoryName: schema_1.categories.name,
            categoryIcon: schema_1.categories.icon,
            categoryColor: schema_1.categories.color,
        })
            .from(schema_1.transactions)
            .leftJoin(schema_1.categories, (0, drizzle_orm_1.eq)(schema_1.transactions.categoryId, schema_1.categories.id))
            .where((0, drizzle_orm_1.eq)(schema_1.transactions.userId, userId))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.transactions.date));
        if (limit) {
            query = query.limit(limit);
        }
        const userTransactions = await query;
        return userTransactions.map(transaction => ({
            ...transaction,
            amount: encryption_1.DataEncryption.decryptAmount(transaction.amount),
            description: encryption_1.DataEncryption.decryptDescription(transaction.description),
            referenceNote: transaction.referenceNote ? encryption_1.DataEncryption.decrypt(transaction.referenceNote) : null
        }));
    }
    async updateTransaction(id, transaction) {
        const updateFields = {};
        if (transaction.amount !== undefined) {
            updateFields.amount = transaction.amount;
        }
        if (transaction.description !== undefined) {
            updateFields.description = transaction.description;
        }
        if (transaction.referenceNote !== undefined) {
            updateFields.referenceNote = transaction.referenceNote;
        }
        if (transaction.categoryId !== undefined) {
            updateFields.categoryId = transaction.categoryId;
        }
        if (transaction.date !== undefined) {
            updateFields.date = transaction.date;
        }
        if (transaction.type !== undefined) {
            updateFields.type = transaction.type;
        }
        if (transaction.isRecurring !== undefined) {
            updateFields.isRecurring = transaction.isRecurring;
        }
        if (transaction.recurringFrequency !== undefined) {
            updateFields.recurringFrequency = transaction.recurringFrequency;
        }
        if (transaction.recurringEndDate !== undefined) {
            updateFields.recurringEndDate = transaction.recurringEndDate;
        }
        if (transaction.paymentUrl !== undefined) {
            updateFields.paymentUrl = transaction.paymentUrl;
        }
        const [updatedTransaction] = await db_1.db
            .update(schema_1.transactions)
            .set(updateFields)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.transactions.id, id), (0, drizzle_orm_1.eq)(schema_1.transactions.userId, transaction.userId)))
            .returning();
        return {
            ...updatedTransaction,
            amount: updatedTransaction.amount,
            description: updatedTransaction.description,
            referenceNote: updatedTransaction.referenceNote
        };
    }
    async deleteTransaction(id, userId) {
        await db_1.db
            .delete(schema_1.transactions)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.transactions.id, id), (0, drizzle_orm_1.eq)(schema_1.transactions.userId, userId)));
    }
    async clearUserTransactions(userId) {
        await db_1.db
            .delete(schema_1.transactions)
            .where((0, drizzle_orm_1.eq)(schema_1.transactions.userId, userId));
    }
    async createBudget(budget) {
        const [newBudget] = await db_1.db
            .insert(schema_1.budgets)
            .values(budget)
            .returning();
        return newBudget;
    }
    async getUserBudgets(userId) {
        const budgetData = await db_1.db
            .select({
            id: schema_1.budgets.id,
            userId: schema_1.budgets.userId,
            categoryId: schema_1.budgets.categoryId,
            amount: schema_1.budgets.amount,
            startDate: schema_1.budgets.startDate,
            endDate: schema_1.budgets.endDate,
            period: schema_1.budgets.period,
            createdAt: schema_1.budgets.createdAt,
            categoryName: schema_1.categories.name,
            categoryIcon: schema_1.categories.icon,
            categoryColor: schema_1.categories.color,
        })
            .from(schema_1.budgets)
            .leftJoin(schema_1.categories, (0, drizzle_orm_1.eq)(schema_1.budgets.categoryId, schema_1.categories.id))
            .where((0, drizzle_orm_1.eq)(schema_1.budgets.userId, userId))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.budgets.createdAt));
        const budgetsWithSpending = await Promise.all(budgetData.map(async (budget) => {
            const spendingResult = await db_1.db
                .select({
                totalSpent: (0, drizzle_orm_1.sql) `COALESCE(SUM(ABS(CAST(${schema_1.transactions.amount} AS DECIMAL))), 0)`
            })
                .from(schema_1.transactions)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.transactions.userId, userId), (0, drizzle_orm_1.eq)(schema_1.transactions.categoryId, budget.categoryId), (0, drizzle_orm_1.eq)(schema_1.transactions.type, 'expense'), (0, drizzle_orm_1.gte)(schema_1.transactions.date, budget.startDate), (0, drizzle_orm_1.lte)(schema_1.transactions.date, budget.endDate)));
            const totalSpent = Number(spendingResult[0]?.totalSpent || 0);
            const budgetAmount = parseFloat(budget.amount);
            const remaining = budgetAmount - totalSpent;
            const percentage = budgetAmount > 0 ? (totalSpent / budgetAmount) * 100 : 0;
            return {
                ...budget,
                spent: totalSpent,
                remaining: remaining,
                percentage: percentage
            };
        }));
        return budgetsWithSpending;
    }
    async updateBudget(id, budget) {
        const existingBudget = await db_1.db
            .select()
            .from(schema_1.budgets)
            .where((0, drizzle_orm_1.eq)(schema_1.budgets.id, id))
            .limit(1);
        if (!existingBudget.length || existingBudget[0].userId !== budget.userId) {
            throw new Error("Budget not found or unauthorized access");
        }
        const [updatedBudget] = await db_1.db
            .update(schema_1.budgets)
            .set(budget)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.budgets.id, id), (0, drizzle_orm_1.eq)(schema_1.budgets.userId, budget.userId)))
            .returning();
        return updatedBudget;
    }
    async deleteBudget(id, userId) {
        await db_1.db
            .delete(schema_1.budgets)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.budgets.id, id), (0, drizzle_orm_1.eq)(schema_1.budgets.userId, userId)));
    }
    async getBudget(id) {
        const result = await db_1.db
            .select()
            .from(schema_1.budgets)
            .where((0, drizzle_orm_1.eq)(schema_1.budgets.id, id))
            .limit(1);
        return result[0];
    }
    async clearUserBudgets(userId) {
        await db_1.db
            .delete(schema_1.budgets)
            .where((0, drizzle_orm_1.eq)(schema_1.budgets.userId, userId));
    }
    async createGoal(goal) {
        const [newGoal] = await db_1.db
            .insert(schema_1.goals)
            .values(goal)
            .returning();
        return newGoal;
    }
    async getUserGoals(userId) {
        return await db_1.db
            .select()
            .from(schema_1.goals)
            .where((0, drizzle_orm_1.eq)(schema_1.goals.userId, userId))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.goals.createdAt));
    }
    async getGoal(id, userId) {
        const result = await db_1.db
            .select()
            .from(schema_1.goals)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.goals.id, id), (0, drizzle_orm_1.eq)(schema_1.goals.userId, userId)))
            .limit(1);
        return result[0];
    }
    async updateGoal(id, goal) {
        const existingGoal = await db_1.db
            .select()
            .from(schema_1.goals)
            .where((0, drizzle_orm_1.eq)(schema_1.goals.id, id))
            .limit(1);
        if (!existingGoal.length || existingGoal[0].userId !== goal.userId) {
            throw new Error("Goal not found or unauthorized access");
        }
        const [updatedGoal] = await db_1.db
            .update(schema_1.goals)
            .set(goal)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.goals.id, id), (0, drizzle_orm_1.eq)(schema_1.goals.userId, goal.userId)))
            .returning();
        return updatedGoal;
    }
    async deleteGoal(id, userId) {
        await db_1.db
            .delete(schema_1.goals)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.goals.id, id), (0, drizzle_orm_1.eq)(schema_1.goals.userId, userId)));
    }
    async clearUserGoals(userId) {
        await db_1.db
            .delete(schema_1.goals)
            .where((0, drizzle_orm_1.eq)(schema_1.goals.userId, userId));
    }
    async getCategories(userId) {
        if (userId) {
            return await db_1.db.select().from(schema_1.categories).where((0, drizzle_orm_1.or)((0, drizzle_orm_1.isNull)(schema_1.categories.userId), (0, drizzle_orm_1.eq)(schema_1.categories.userId, userId)));
        }
        return await db_1.db.select().from(schema_1.categories);
    }
    async createCategory(category) {
        const [newCategory] = await db_1.db
            .insert(schema_1.categories)
            .values({
            userId: category.userId,
            name: category.name,
            icon: category.icon,
            color: category.color,
            type: category.type,
        })
            .returning();
        return newCategory;
    }
    async updateCategory(categoryId, userId, updateData) {
        const existingCategory = await db_1.db
            .select()
            .from(schema_1.categories)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.categories.id, categoryId), (0, drizzle_orm_1.eq)(schema_1.categories.userId, userId)))
            .limit(1);
        if (existingCategory.length === 0) {
            throw new Error("Category not found or access denied");
        }
        const [category] = await db_1.db
            .update(schema_1.categories)
            .set(updateData)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.categories.id, categoryId), (0, drizzle_orm_1.eq)(schema_1.categories.userId, userId)))
            .returning();
        if (!category) {
            throw new Error("Category not found");
        }
        return category;
    }
    async deleteCategory(categoryId, userId) {
        const userCategory = await db_1.db
            .select()
            .from(schema_1.categories)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.categories.id, categoryId), (0, drizzle_orm_1.eq)(schema_1.categories.userId, userId)))
            .limit(1);
        if (userCategory.length === 0) {
            throw new Error("Category not found or access denied");
        }
        const transactionsUsingCategory = await db_1.db
            .select({ count: (0, drizzle_orm_1.sql) `count(*)` })
            .from(schema_1.transactions)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.transactions.categoryId, categoryId), (0, drizzle_orm_1.eq)(schema_1.transactions.userId, userId)));
        if (transactionsUsingCategory[0].count > 0) {
            throw new Error("Cannot delete category that is in use by transactions");
        }
        const [deletedCategory] = await db_1.db
            .delete(schema_1.categories)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.categories.id, categoryId), (0, drizzle_orm_1.eq)(schema_1.categories.userId, userId)))
            .returning();
        if (!deletedCategory) {
            throw new Error("Category not found");
        }
        return deletedCategory;
    }
    async getUserFinancialSummary(userId, startDate, endDate) {
        const incomeResult = await db_1.db
            .select({
            total: (0, drizzle_orm_1.sum)(schema_1.transactions.amount),
            count: (0, drizzle_orm_1.count)(schema_1.transactions.id),
        })
            .from(schema_1.transactions)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.transactions.userId, userId), (0, drizzle_orm_1.eq)(schema_1.transactions.type, 'income'), (0, drizzle_orm_1.gte)(schema_1.transactions.date, startDate), (0, drizzle_orm_1.lte)(schema_1.transactions.date, endDate)));
        const expenseResult = await db_1.db
            .select({
            total: (0, drizzle_orm_1.sum)(schema_1.transactions.amount),
            count: (0, drizzle_orm_1.count)(schema_1.transactions.id),
        })
            .from(schema_1.transactions)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.transactions.userId, userId), (0, drizzle_orm_1.eq)(schema_1.transactions.type, 'expense'), (0, drizzle_orm_1.gte)(schema_1.transactions.date, startDate), (0, drizzle_orm_1.lte)(schema_1.transactions.date, endDate)));
        const categoryResults = await db_1.db
            .select({
            categoryName: schema_1.categories.name,
            amount: (0, drizzle_orm_1.sum)(schema_1.transactions.amount),
            type: schema_1.transactions.type,
        })
            .from(schema_1.transactions)
            .leftJoin(schema_1.categories, (0, drizzle_orm_1.eq)(schema_1.transactions.categoryId, schema_1.categories.id))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.transactions.userId, userId), (0, drizzle_orm_1.gte)(schema_1.transactions.date, startDate), (0, drizzle_orm_1.lte)(schema_1.transactions.date, endDate)))
            .groupBy(schema_1.categories.name, schema_1.transactions.type);
        const totalIncome = Number(incomeResult[0]?.total || 0);
        const totalExpenses = Number(expenseResult[0]?.total || 0);
        const incomeTransactionCount = Number(incomeResult[0]?.count || 0);
        const expenseTransactionCount = Number(expenseResult[0]?.count || 0);
        const netBalance = totalIncome - totalExpenses;
        const transactionsByCategory = categoryResults.map(result => ({
            categoryName: result.categoryName || 'Uncategorized',
            amount: Number(result.amount || 0),
            type: result.type,
        }));
        return {
            totalIncome,
            totalExpenses,
            netBalance,
            incomeTransactionCount,
            expenseTransactionCount,
            totalTransactionCount: incomeTransactionCount + expenseTransactionCount,
            transactionsByCategory,
        };
    }
    async createExpenseReminder(reminder) {
        const [result] = await db_1.db.insert(schema_1.expenseReminders).values(reminder).returning();
        return result;
    }
    async getUserExpenseReminders(userId) {
        const results = await db_1.db
            .select()
            .from(schema_1.expenseReminders)
            .where((0, drizzle_orm_1.eq)(schema_1.expenseReminders.userId, userId))
            .orderBy(schema_1.expenseReminders.dueDate);
        return results;
    }
    async getUpcomingExpenseReminders(userId, daysBefore = 7) {
        const now = new Date();
        const futureDate = new Date();
        futureDate.setDate(now.getDate() + daysBefore);
        const results = await db_1.db
            .select()
            .from(schema_1.expenseReminders)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.expenseReminders.userId, userId), (0, drizzle_orm_1.eq)(schema_1.expenseReminders.isActive, true), (0, drizzle_orm_1.eq)(schema_1.expenseReminders.isCompleted, false), (0, drizzle_orm_1.gte)(schema_1.expenseReminders.dueDate, now), (0, drizzle_orm_1.lte)(schema_1.expenseReminders.dueDate, futureDate)))
            .orderBy(schema_1.expenseReminders.dueDate);
        return results;
    }
    async getUserRecurringTransactions(userId) {
        const results = await db_1.db
            .select({
            id: schema_1.recurringTransactions.id,
            userId: schema_1.recurringTransactions.userId,
            categoryId: schema_1.recurringTransactions.categoryId,
            description: schema_1.recurringTransactions.description,
            amount: schema_1.recurringTransactions.amount,
            type: schema_1.recurringTransactions.type,
            frequency: schema_1.recurringTransactions.frequency,
            startDate: schema_1.recurringTransactions.startDate,
            endDate: schema_1.recurringTransactions.endDate,
            isActive: schema_1.recurringTransactions.isActive,
            lastProcessed: schema_1.recurringTransactions.lastProcessed,
            createdAt: schema_1.recurringTransactions.createdAt,
            categoryName: schema_1.categories.name,
            categoryIcon: schema_1.categories.icon,
            categoryColor: schema_1.categories.color,
        })
            .from(schema_1.recurringTransactions)
            .leftJoin(schema_1.categories, (0, drizzle_orm_1.eq)(schema_1.recurringTransactions.categoryId, schema_1.categories.id))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.recurringTransactions.userId, userId), (0, drizzle_orm_1.eq)(schema_1.recurringTransactions.isActive, true)))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.recurringTransactions.createdAt));
        return results;
    }
    async getUpcomingTransactionReminders(userId, daysAhead = 7) {
        const now = new Date();
        const futureDate = new Date();
        futureDate.setDate(now.getDate() + daysAhead);
        const reminders = [];
        const futureTransactions = await db_1.db
            .select({
            id: schema_1.transactions.id,
            description: schema_1.transactions.description,
            amount: schema_1.transactions.amount,
            date: schema_1.transactions.date,
            type: schema_1.transactions.type,
            categoryName: schema_1.categories.name,
            isRecurring: schema_1.transactions.isRecurring,
        })
            .from(schema_1.transactions)
            .leftJoin(schema_1.categories, (0, drizzle_orm_1.eq)(schema_1.transactions.categoryId, schema_1.categories.id))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.transactions.userId, userId), (0, drizzle_orm_1.gte)(schema_1.transactions.date, now), (0, drizzle_orm_1.lte)(schema_1.transactions.date, futureDate)))
            .orderBy(schema_1.transactions.date);
        futureTransactions.forEach(transaction => {
            reminders.push({
                id: `future_${transaction.id}`,
                title: transaction.description,
                description: `${transaction.type === 'expense' ? 'Payment' : 'Income'} scheduled`,
                amount: transaction.amount,
                dueDate: transaction.date,
                type: transaction.type,
                categoryName: transaction.categoryName || 'Uncategorized',
                isRecurring: transaction.isRecurring || false,
                source: 'future_transaction'
            });
        });
        const activeRecurringTransactions = await db_1.db
            .select({
            id: schema_1.transactions.id,
            description: schema_1.transactions.description,
            amount: schema_1.transactions.amount,
            type: schema_1.transactions.type,
            recurringFrequency: schema_1.transactions.recurringFrequency,
            date: schema_1.transactions.date,
            recurringEndDate: schema_1.transactions.recurringEndDate,
            categoryName: schema_1.categories.name,
        })
            .from(schema_1.transactions)
            .leftJoin(schema_1.categories, (0, drizzle_orm_1.eq)(schema_1.transactions.categoryId, schema_1.categories.id))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.transactions.userId, userId), (0, drizzle_orm_1.eq)(schema_1.transactions.isRecurring, true), (0, drizzle_orm_1.or)((0, drizzle_orm_1.isNull)(schema_1.transactions.recurringEndDate), (0, drizzle_orm_1.gte)(schema_1.transactions.recurringEndDate, now))));
        console.log(`Found ${activeRecurringTransactions.length} active recurring transactions for user ${userId}`);
        activeRecurringTransactions.forEach(recurring => {
            console.log(`Processing recurring transaction: ${recurring.id}, date: ${recurring.date}, frequency: ${recurring.recurringFrequency}`);
            const nextOccurrence = this.calculateNextOccurrence(recurring.date, recurring.recurringFrequency || 'monthly', recurring.recurringEndDate);
            console.log(`Next occurrence calculated: ${nextOccurrence}, within window: ${nextOccurrence && nextOccurrence <= futureDate && nextOccurrence >= now}`);
            if (nextOccurrence && nextOccurrence <= futureDate && nextOccurrence >= now) {
                const reminder = {
                    id: `recurring_${recurring.id}`,
                    title: recurring.description,
                    description: `Recurring ${recurring.type} (${recurring.recurringFrequency})`,
                    amount: recurring.amount,
                    dueDate: nextOccurrence,
                    type: recurring.type,
                    categoryName: recurring.categoryName || 'Uncategorized',
                    isRecurring: true,
                    source: 'recurring_transaction'
                };
                console.log(`Adding reminder: ${JSON.stringify(reminder)}`);
                reminders.push(reminder);
            }
        });
        return reminders.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
    }
    calculateNextOccurrence(lastDate, frequency, endDate) {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const next = new Date(lastDate);
        next.setHours(0, 0, 0, 0);
        console.log(`Calculating next occurrence: lastDate=${lastDate.toISOString()}, frequency=${frequency}, now=${now.toISOString()}`);
        if (next.getTime() === now.getTime()) {
            console.log(`Transaction date is today, calculating next occurrence for frequency: ${frequency}`);
            switch (frequency.toLowerCase()) {
                case 'weekly':
                    next.setDate(next.getDate() + 7);
                    break;
                case 'monthly':
                    next.setMonth(next.getMonth() + 1);
                    break;
                case 'yearly':
                    next.setFullYear(next.getFullYear() + 1);
                    break;
                default:
                    console.log(`Unknown frequency: ${frequency}, returning null`);
                    return null;
            }
            console.log(`Next occurrence for today's transaction: ${next.toISOString()}`);
        }
        else if (next > now) {
            console.log(`Transaction date is in future, using: ${next.toISOString()}`);
            if (endDate && next > endDate) {
                console.log(`Date exceeds end date, returning null`);
                return null;
            }
            return next;
        }
        while (next <= now) {
            switch (frequency.toLowerCase()) {
                case 'weekly':
                    next.setDate(next.getDate() + 7);
                    console.log(`Added 7 days: ${next.toISOString()}`);
                    break;
                case 'monthly':
                    next.setMonth(next.getMonth() + 1);
                    console.log(`Added 1 month: ${next.toISOString()}`);
                    break;
                case 'yearly':
                    next.setFullYear(next.getFullYear() + 1);
                    console.log(`Added 1 year: ${next.toISOString()}`);
                    break;
                default:
                    console.log(`Unknown frequency: ${frequency}, returning null`);
                    return null;
            }
        }
        if (endDate && next > endDate) {
            console.log(`Final date ${next.toISOString()} exceeds end date ${endDate.toISOString()}, returning null`);
            return null;
        }
        console.log(`Calculated next occurrence: ${next.toISOString()}`);
        return next;
    }
    async updateExpenseReminder(id, reminder) {
        const existingReminder = await db_1.db
            .select()
            .from(schema_1.expenseReminders)
            .where((0, drizzle_orm_1.eq)(schema_1.expenseReminders.id, id))
            .limit(1);
        if (!existingReminder.length || existingReminder[0].userId !== reminder.userId) {
            throw new Error("Expense reminder not found or unauthorized access");
        }
        const [result] = await db_1.db
            .update(schema_1.expenseReminders)
            .set({ ...reminder, updatedAt: new Date() })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.expenseReminders.id, id), (0, drizzle_orm_1.eq)(schema_1.expenseReminders.userId, reminder.userId)))
            .returning();
        return result;
    }
    async deleteExpenseReminder(id, userId) {
        await db_1.db
            .delete(schema_1.expenseReminders)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.expenseReminders.id, id), (0, drizzle_orm_1.eq)(schema_1.expenseReminders.userId, userId)));
    }
    async markExpenseReminderCompleted(id, userId) {
        await db_1.db
            .update(schema_1.expenseReminders)
            .set({ isCompleted: true, updatedAt: new Date() })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.expenseReminders.id, id), (0, drizzle_orm_1.eq)(schema_1.expenseReminders.userId, userId)));
    }
    async clearUserExpenseReminders(userId) {
        await db_1.db
            .delete(schema_1.expenseReminders)
            .where((0, drizzle_orm_1.eq)(schema_1.expenseReminders.userId, userId));
    }
    async getUserBackupSettings(userId) {
        const settings = await db_1.db
            .select()
            .from(schema_1.backupSettings)
            .where((0, drizzle_orm_1.eq)(schema_1.backupSettings.userId, userId))
            .limit(1);
        return settings[0];
    }
    async createBackupSettings(settings) {
        const result = await db_1.db
            .insert(schema_1.backupSettings)
            .values(settings)
            .returning();
        return result[0];
    }
    async updateBackupSettings(userId, settings) {
        const result = await db_1.db
            .update(schema_1.backupSettings)
            .set({ ...settings, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(schema_1.backupSettings.userId, userId))
            .returning();
        return result[0];
    }
    async getUsersWithActiveBackups() {
        const result = await db_1.db
            .select({ userId: schema_1.backupSettings.userId })
            .from(schema_1.backupSettings)
            .innerJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.backupSettings.userId, schema_1.users.id))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.backupSettings.autoBackup, true), (0, drizzle_orm_1.eq)(schema_1.backupSettings.status, 'active'), (0, drizzle_orm_1.eq)(schema_1.users.plan, 'premium')));
        return result;
    }
    async getUsersWithOverdueBackups() {
        const now = new Date();
        const result = await db_1.db
            .select({ userId: schema_1.backupSettings.userId })
            .from(schema_1.backupSettings)
            .innerJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.backupSettings.userId, schema_1.users.id))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.backupSettings.autoBackup, true), (0, drizzle_orm_1.eq)(schema_1.backupSettings.status, 'active'), (0, drizzle_orm_1.eq)(schema_1.users.plan, 'premium'), (0, drizzle_orm_1.or)((0, drizzle_orm_1.isNull)(schema_1.backupSettings.nextBackupDate), (0, drizzle_orm_1.lte)(schema_1.backupSettings.nextBackupDate, now))));
        return result;
    }
    async updateUserProfile(userId, profileData) {
        const updateData = {
            firstName: profileData.firstName,
            lastName: profileData.lastName,
            email: profileData.email,
            phone: profileData.phone || null,
            website: profileData.website || null,
            updatedAt: new Date()
        };
        const result = await db_1.db.update(schema_1.users).set(updateData).where((0, drizzle_orm_1.eq)(schema_1.users.id, userId));
        if (!result) {
            throw new Error('Failed to update user profile in database');
        }
    }
    async updateUserPassword(userId, hashedPassword) {
        await db_1.db.update(schema_1.users).set({
            password: hashedPassword,
            updatedAt: new Date()
        }).where((0, drizzle_orm_1.eq)(schema_1.users.id, userId));
    }
    async getUserSettings(userId) {
        const user = await this.getUser(userId);
        return user?.settings ? JSON.parse(user.settings) : null;
    }
    async updateUserSettings(userId, settings) {
        await db_1.db.update(schema_1.users).set({ settings: JSON.stringify(settings) }).where((0, drizzle_orm_1.eq)(schema_1.users.id, userId));
    }
    async getAllUsers() {
        return await db_1.db.select().from(schema_1.users).orderBy(schema_1.users.createdAt);
    }
    async updateUser(userId, userData) {
        try {
            const validFields = {
                email: userData.email,
                firstName: userData.firstName,
                lastName: userData.lastName,
                profileImageUrl: userData.profileImageUrl,
                phone: userData.phone,
                website: userData.website,
                plan: userData.plan,
                billingInterval: userData.billingInterval,
                currency: userData.currency,
                stripeCustomerId: userData.stripeCustomerId,
                stripeSubscriptionId: userData.stripeSubscriptionId,
                settings: userData.settings,
                updatedAt: new Date(),
            };
            const cleanData = Object.fromEntries(Object.entries(validFields).filter(([_, value]) => value !== undefined));
            const [updatedUser] = await db_1.db
                .update(schema_1.users)
                .set(cleanData)
                .where((0, drizzle_orm_1.eq)(schema_1.users.id, userId))
                .returning();
            if (!updatedUser) {
                throw new Error('User not found');
            }
            return updatedUser;
        }
        catch (error) {
            console.error('Failed to update user in database:', error);
            throw new Error('Failed to update user profile in database');
        }
    }
    async deleteUserCompletely(userId) {
        console.log(`Starting complete deletion of user: ${userId}`);
        try {
            const existingUser = await this.getUser(userId);
            if (!existingUser) {
                throw new Error(`User ${userId} not found`);
            }
            const deletedTransactions = await db_1.db.delete(schema_1.transactions).where((0, drizzle_orm_1.eq)(schema_1.transactions.userId, userId)).execute();
            console.log(`Deleted transactions for user: ${userId}`);
            const deletedCategories = await db_1.db.delete(schema_1.categories).where((0, drizzle_orm_1.eq)(schema_1.categories.userId, userId)).execute();
            console.log(`Deleted categories for user: ${userId}`);
            const deletedBudgets = await db_1.db.delete(schema_1.budgets).where((0, drizzle_orm_1.eq)(schema_1.budgets.userId, userId)).execute();
            console.log(`Deleted budgets for user: ${userId}`);
            const deletedGoals = await db_1.db.delete(schema_1.goals).where((0, drizzle_orm_1.eq)(schema_1.goals.userId, userId)).execute();
            console.log(`Deleted goals for user: ${userId}`);
            const deletedExpenseReminders = await db_1.db.delete(schema_1.expenseReminders).where((0, drizzle_orm_1.eq)(schema_1.expenseReminders.userId, userId)).execute();
            console.log(`Deleted expense reminders for user: ${userId}`);
            const deletedCollaborativeGoalParticipants = await db_1.db.delete(schema_1.collaborativeGoalParticipants).where((0, drizzle_orm_1.eq)(schema_1.collaborativeGoalParticipants.userId, userId)).execute();
            console.log(`Deleted collaborative goal participants for user: ${userId}`);
            const deletedGoalContributions = await db_1.db.delete(schema_1.goalContributions).where((0, drizzle_orm_1.eq)(schema_1.goalContributions.userId, userId)).execute();
            console.log(`Deleted goal contributions for user: ${userId}`);
            const deletedChallengeActivities = await db_1.db.delete(schema_1.challengeActivities).where((0, drizzle_orm_1.eq)(schema_1.challengeActivities.userId, userId)).execute();
            console.log(`Deleted challenge activities for user: ${userId}`);
            const deletedMilestoneAchievements = await db_1.db.delete(schema_1.milestoneAchievements).where((0, drizzle_orm_1.eq)(schema_1.milestoneAchievements.userId, userId)).execute();
            console.log(`Deleted milestone achievements for user: ${userId}`);
            const deletedFinancialMascots = await db_1.db.delete(schema_1.financialMascots).where((0, drizzle_orm_1.eq)(schema_1.financialMascots.userId, userId)).execute();
            console.log(`Deleted financial mascots for user: ${userId}`);
            const deletedFriendships = await db_1.db.delete(schema_1.friendships).where((0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(schema_1.friendships.requesterId, userId), (0, drizzle_orm_1.eq)(schema_1.friendships.recipientId, userId))).execute();
            console.log(`Deleted friendships for user: ${userId}`);
            const deletedCollaborativeGoals = await db_1.db.delete(schema_1.collaborativeGoals).where((0, drizzle_orm_1.eq)(schema_1.collaborativeGoals.createdBy, userId)).execute();
            console.log(`Deleted collaborative goals for user: ${userId}`);
            const deletedRedeemCodes = await db_1.db.delete(schema_1.redeemCodes).where((0, drizzle_orm_1.eq)(schema_1.redeemCodes.userId, userId)).execute();
            console.log(`Deleted redeem codes for user: ${userId}`);
            const deletedUser = await db_1.db.delete(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, userId)).execute();
            console.log(`Deleted user record: ${userId}`);
            console.log(`Successfully completed deletion of user: ${userId}`);
        }
        catch (error) {
            console.error(`Error deleting user ${userId}:`, error);
            throw new Error(`Failed to delete user ${userId}: ${error.message}`);
        }
    }
    async getAdminStats() {
        const userStats = await db_1.db
            .select({
            plan: schema_1.users.plan,
            count: (0, drizzle_orm_1.sql) `count(*)`,
        })
            .from(schema_1.users)
            .groupBy(schema_1.users.plan);
        const [transactionCount] = await db_1.db
            .select({
            count: (0, drizzle_orm_1.sql) `count(*)`,
        })
            .from(schema_1.transactions);
        const stats = {
            totalUsers: 0,
            activeUsers: 0,
            freeUsers: 0,
            standardUsers: 0,
            premiumUsers: 0,
            totalTransactions: transactionCount?.count || 0,
            totalRevenue: 0,
        };
        userStats.forEach(stat => {
            const count = Number(stat.count);
            stats.totalUsers += count;
            if (stat.plan === 'free') {
                stats.freeUsers = count;
            }
            else if (stat.plan === 'standard') {
                stats.standardUsers = count;
                stats.totalRevenue += count * 4.99;
            }
            else if (stat.plan === 'premium') {
                stats.premiumUsers = count;
                stats.totalRevenue += count * 9.99;
            }
        });
        stats.activeUsers = stats.standardUsers + stats.premiumUsers;
        return stats;
    }
    async getUserDataSummary(userId) {
        const [transactionCount] = await db_1.db
            .select({
            count: (0, drizzle_orm_1.sql) `count(*)`,
        })
            .from(schema_1.transactions)
            .where((0, drizzle_orm_1.eq)(schema_1.transactions.userId, userId));
        const [budgetCount] = await db_1.db
            .select({
            count: (0, drizzle_orm_1.sql) `count(*)`,
        })
            .from(schema_1.budgets)
            .where((0, drizzle_orm_1.eq)(schema_1.budgets.userId, userId));
        const [goalCount] = await db_1.db
            .select({
            count: (0, drizzle_orm_1.sql) `count(*)`,
        })
            .from(schema_1.goals)
            .where((0, drizzle_orm_1.eq)(schema_1.goals.userId, userId));
        const [lastTransaction] = await db_1.db
            .select({
            date: schema_1.transactions.date,
        })
            .from(schema_1.transactions)
            .where((0, drizzle_orm_1.eq)(schema_1.transactions.userId, userId))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.transactions.date))
            .limit(1);
        return {
            transactionCount: Number(transactionCount?.count || 0),
            budgetCount: Number(budgetCount?.count || 0),
            goalCount: Number(goalCount?.count || 0),
            dataSize: "Encrypted",
            lastActivity: lastTransaction?.date || null,
        };
    }
    async sendFriendRequest(requesterId, recipientEmail) {
        const [recipient] = await db_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.email, recipientEmail));
        if (!recipient) {
            throw new Error("User not found with that email address");
        }
        const existingFriendship = await db_1.db
            .select()
            .from(schema_1.friendships)
            .where((0, drizzle_orm_1.or)((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.friendships.requesterId, requesterId), (0, drizzle_orm_1.eq)(schema_1.friendships.recipientId, recipient.id)), (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.friendships.requesterId, recipient.id), (0, drizzle_orm_1.eq)(schema_1.friendships.recipientId, requesterId))));
        if (existingFriendship.length > 0) {
            throw new Error("Friendship request already exists or you are already friends");
        }
        const [friendship] = await db_1.db
            .insert(schema_1.friendships)
            .values({
            requesterId,
            recipientId: recipient.id,
            status: "pending",
        })
            .returning();
        return friendship;
    }
    async acceptFriendRequest(friendshipId, userId) {
        const [friendship] = await db_1.db
            .update(schema_1.friendships)
            .set({
            status: "accepted",
            acceptedAt: new Date()
        })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.friendships.id, friendshipId), (0, drizzle_orm_1.eq)(schema_1.friendships.recipientId, userId), (0, drizzle_orm_1.eq)(schema_1.friendships.status, "pending")))
            .returning();
        if (!friendship) {
            throw new Error("Friend request not found or already processed");
        }
        return friendship;
    }
    async rejectFriendRequest(friendshipId, userId) {
        await db_1.db
            .delete(schema_1.friendships)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.friendships.id, friendshipId), (0, drizzle_orm_1.eq)(schema_1.friendships.recipientId, userId), (0, drizzle_orm_1.eq)(schema_1.friendships.status, "pending")));
    }
    async getUserFriends(userId) {
        const friends = await db_1.db
            .select({
            friendship: schema_1.friendships,
            friend: schema_1.users,
        })
            .from(schema_1.friendships)
            .innerJoin(schema_1.users, (0, drizzle_orm_1.or)((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.friendships.requesterId, userId), (0, drizzle_orm_1.eq)(schema_1.users.id, schema_1.friendships.recipientId)), (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.friendships.recipientId, userId), (0, drizzle_orm_1.eq)(schema_1.users.id, schema_1.friendships.requesterId))))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(schema_1.friendships.requesterId, userId), (0, drizzle_orm_1.eq)(schema_1.friendships.recipientId, userId)), (0, drizzle_orm_1.eq)(schema_1.friendships.status, "accepted")));
        return friends.map(f => ({ ...f.friendship, friend: f.friend }));
    }
    async getPendingFriendRequests(userId) {
        const requests = await db_1.db
            .select({
            friendship: schema_1.friendships,
            requester: schema_1.users,
        })
            .from(schema_1.friendships)
            .innerJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.friendships.requesterId, schema_1.users.id))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.friendships.recipientId, userId), (0, drizzle_orm_1.eq)(schema_1.friendships.status, "pending")));
        return requests.map(r => ({ ...r.friendship, requester: r.requester }));
    }
    async createCollaborativeGoal(goal) {
        const [createdGoal] = await db_1.db
            .insert(schema_1.collaborativeGoals)
            .values({
            ...goal,
            joinCode: this.generateJoinCode(),
        })
            .returning();
        await db_1.db.insert(schema_1.collaborativeGoalParticipants).values({
            goalId: createdGoal.id,
            userId: goal.createdBy,
            role: "creator",
            status: "active",
        });
        return createdGoal;
    }
    generateJoinCode() {
        return Math.random().toString(36).substring(2, 10).toUpperCase();
    }
    async getUserCollaborativeGoals(userId) {
        const goals = await db_1.db
            .select({
            goal: schema_1.collaborativeGoals,
            creator: schema_1.users,
        })
            .from(schema_1.collaborativeGoals)
            .innerJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.collaborativeGoals.createdBy, schema_1.users.id))
            .innerJoin(schema_1.collaborativeGoalParticipants, (0, drizzle_orm_1.eq)(schema_1.collaborativeGoals.id, schema_1.collaborativeGoalParticipants.goalId))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.collaborativeGoalParticipants.userId, userId), (0, drizzle_orm_1.eq)(schema_1.collaborativeGoalParticipants.status, "active")));
        const result = [];
        for (const { goal, creator } of goals) {
            const participantsWithUsers = await db_1.db
                .select({
                participant: schema_1.collaborativeGoalParticipants,
                user: schema_1.users,
            })
                .from(schema_1.collaborativeGoalParticipants)
                .innerJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.collaborativeGoalParticipants.userId, schema_1.users.id))
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.collaborativeGoalParticipants.goalId, goal.id), (0, drizzle_orm_1.eq)(schema_1.collaborativeGoalParticipants.status, "active")));
            const participants = participantsWithUsers.map(({ participant, user }) => ({
                ...participant,
                user,
            }));
            result.push({ ...goal, participants, creator });
        }
        return result;
    }
    async getCollaborativeGoal(goalId, userId) {
        const [participant] = await db_1.db
            .select()
            .from(schema_1.collaborativeGoalParticipants)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.collaborativeGoalParticipants.goalId, goalId), (0, drizzle_orm_1.eq)(schema_1.collaborativeGoalParticipants.userId, userId), (0, drizzle_orm_1.eq)(schema_1.collaborativeGoalParticipants.status, "active")));
        if (!participant) {
            return undefined;
        }
        const [goalWithCreator] = await db_1.db
            .select({
            goal: schema_1.collaborativeGoals,
            creator: schema_1.users,
        })
            .from(schema_1.collaborativeGoals)
            .innerJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.collaborativeGoals.createdBy, schema_1.users.id))
            .where((0, drizzle_orm_1.eq)(schema_1.collaborativeGoals.id, goalId));
        if (!goalWithCreator) {
            return undefined;
        }
        const participants = await db_1.db
            .select({
            participant: schema_1.collaborativeGoalParticipants,
            user: schema_1.users,
        })
            .from(schema_1.collaborativeGoalParticipants)
            .innerJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.collaborativeGoalParticipants.userId, schema_1.users.id))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.collaborativeGoalParticipants.goalId, goalId), (0, drizzle_orm_1.eq)(schema_1.collaborativeGoalParticipants.status, "active")));
        const contributions = await db_1.db
            .select()
            .from(schema_1.goalContributions)
            .where((0, drizzle_orm_1.eq)(schema_1.goalContributions.goalId, goalId))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.goalContributions.createdAt));
        const activities = await db_1.db
            .select()
            .from(schema_1.challengeActivities)
            .where((0, drizzle_orm_1.eq)(schema_1.challengeActivities.goalId, goalId))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.challengeActivities.createdAt));
        return {
            ...goalWithCreator.goal,
            creator: goalWithCreator.creator,
            participants: participants.map(p => ({ ...p.participant, user: p.user })),
            contributions,
            activities,
        };
    }
    async joinCollaborativeGoal(goalId, userId, personalTarget) {
        const [goal] = await db_1.db
            .select()
            .from(schema_1.collaborativeGoals)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.collaborativeGoals.id, goalId), (0, drizzle_orm_1.eq)(schema_1.collaborativeGoals.status, "active")));
        if (!goal) {
            throw new Error("Goal not found or not active");
        }
        const [existingParticipant] = await db_1.db
            .select()
            .from(schema_1.collaborativeGoalParticipants)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.collaborativeGoalParticipants.goalId, goalId), (0, drizzle_orm_1.eq)(schema_1.collaborativeGoalParticipants.userId, userId)));
        if (existingParticipant) {
            throw new Error("Already a participant in this goal");
        }
        const [participant] = await db_1.db
            .insert(schema_1.collaborativeGoalParticipants)
            .values({
            goalId,
            userId,
            personalTarget: personalTarget ? personalTarget.toString() : null,
            role: "participant",
            status: "active",
        })
            .returning();
        await this.createChallengeActivity({
            goalId,
            userId,
            activityType: "join",
            title: "Joined the challenge",
            description: "Welcome to the savings challenge!",
        });
        return participant;
    }
    async leaveCollaborativeGoal(goalId, userId) {
        await db_1.db
            .update(schema_1.collaborativeGoalParticipants)
            .set({ status: "left" })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.collaborativeGoalParticipants.goalId, goalId), (0, drizzle_orm_1.eq)(schema_1.collaborativeGoalParticipants.userId, userId)));
        await this.createChallengeActivity({
            goalId,
            userId,
            activityType: "leave",
            title: "Left the challenge",
            description: "User has left the savings challenge",
        });
    }
    async updateCollaborativeGoal(goalId, userId, updates) {
        const [goal] = await db_1.db
            .select()
            .from(schema_1.collaborativeGoals)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.collaborativeGoals.id, goalId), (0, drizzle_orm_1.eq)(schema_1.collaborativeGoals.createdBy, userId)));
        if (!goal) {
            throw new Error("Goal not found or you don't have permission to update it");
        }
        const [updatedGoal] = await db_1.db
            .update(schema_1.collaborativeGoals)
            .set({ ...updates, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(schema_1.collaborativeGoals.id, goalId))
            .returning();
        return updatedGoal;
    }
    async deleteCollaborativeGoal(goalId, userId) {
        const [goal] = await db_1.db
            .select()
            .from(schema_1.collaborativeGoals)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.collaborativeGoals.id, goalId), (0, drizzle_orm_1.eq)(schema_1.collaborativeGoals.createdBy, userId)));
        if (!goal) {
            throw new Error("Goal not found or you don't have permission to delete it");
        }
        await db_1.db.delete(schema_1.milestoneAchievements).where((0, drizzle_orm_1.eq)(schema_1.milestoneAchievements.goalId, goalId));
        await db_1.db.delete(schema_1.challengeActivities).where((0, drizzle_orm_1.eq)(schema_1.challengeActivities.goalId, goalId));
        await db_1.db.delete(schema_1.goalContributions).where((0, drizzle_orm_1.eq)(schema_1.goalContributions.goalId, goalId));
        await db_1.db.delete(schema_1.collaborativeGoalParticipants).where((0, drizzle_orm_1.eq)(schema_1.collaborativeGoalParticipants.goalId, goalId));
        await db_1.db.delete(schema_1.collaborativeGoals).where((0, drizzle_orm_1.eq)(schema_1.collaborativeGoals.id, goalId));
    }
    async clearUserCollaborativeGoals(userId) {
        const userGoals = await db_1.db
            .select({ id: schema_1.collaborativeGoals.id })
            .from(schema_1.collaborativeGoals)
            .where((0, drizzle_orm_1.eq)(schema_1.collaborativeGoals.createdBy, userId));
        for (const goal of userGoals) {
            await db_1.db.delete(schema_1.milestoneAchievements).where((0, drizzle_orm_1.eq)(schema_1.milestoneAchievements.goalId, goal.id));
            await db_1.db.delete(schema_1.challengeActivities).where((0, drizzle_orm_1.eq)(schema_1.challengeActivities.goalId, goal.id));
            await db_1.db.delete(schema_1.goalContributions).where((0, drizzle_orm_1.eq)(schema_1.goalContributions.goalId, goal.id));
            await db_1.db.delete(schema_1.collaborativeGoalParticipants).where((0, drizzle_orm_1.eq)(schema_1.collaborativeGoalParticipants.goalId, goal.id));
        }
        await db_1.db.delete(schema_1.collaborativeGoals).where((0, drizzle_orm_1.eq)(schema_1.collaborativeGoals.createdBy, userId));
        await db_1.db.delete(schema_1.collaborativeGoalParticipants).where((0, drizzle_orm_1.eq)(schema_1.collaborativeGoalParticipants.userId, userId));
        await db_1.db.delete(schema_1.goalContributions).where((0, drizzle_orm_1.eq)(schema_1.goalContributions.userId, userId));
        await db_1.db.delete(schema_1.challengeActivities).where((0, drizzle_orm_1.eq)(schema_1.challengeActivities.userId, userId));
        await db_1.db.delete(schema_1.milestoneAchievements).where((0, drizzle_orm_1.eq)(schema_1.milestoneAchievements.userId, userId));
        await db_1.db.delete(schema_1.friendships).where((0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(schema_1.friendships.requesterId, userId), (0, drizzle_orm_1.eq)(schema_1.friendships.recipientId, userId)));
    }
    async addGoalContribution(contribution) {
        const [newContribution] = await db_1.db
            .insert(schema_1.goalContributions)
            .values(contribution)
            .returning();
        await db_1.db
            .update(schema_1.collaborativeGoalParticipants)
            .set({
            currentContribution: (0, drizzle_orm_1.sql) `${schema_1.collaborativeGoalParticipants.currentContribution} + ${contribution.amount}`,
            lastContribution: new Date(),
        })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.collaborativeGoalParticipants.goalId, contribution.goalId), (0, drizzle_orm_1.eq)(schema_1.collaborativeGoalParticipants.userId, contribution.userId)));
        await this.updateGoalProgress(contribution.goalId);
        await this.createChallengeActivity({
            goalId: contribution.goalId,
            userId: contribution.userId,
            activityType: "contribution",
            title: "Made a contribution",
            description: contribution.description || `Contributed $${contribution.amount}`,
            amount: contribution.amount,
        });
        await this.checkAndCreateMilestones(contribution.goalId);
        return newContribution;
    }
    async getGoalContributions(goalId) {
        const contributions = await db_1.db
            .select({
            contribution: schema_1.goalContributions,
            user: schema_1.users,
        })
            .from(schema_1.goalContributions)
            .innerJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.goalContributions.userId, schema_1.users.id))
            .where((0, drizzle_orm_1.eq)(schema_1.goalContributions.goalId, goalId))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.goalContributions.createdAt));
        return contributions.map(c => ({ ...c.contribution, user: c.user }));
    }
    async updateGoalProgress(goalId) {
        const [result] = await db_1.db
            .select({
            total: (0, drizzle_orm_1.sql) `COALESCE(SUM(${schema_1.goalContributions.amount}), 0)`,
        })
            .from(schema_1.goalContributions)
            .where((0, drizzle_orm_1.eq)(schema_1.goalContributions.goalId, goalId));
        await db_1.db
            .update(schema_1.collaborativeGoals)
            .set({
            currentAmount: result.total.toString(),
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(schema_1.collaborativeGoals.id, goalId));
    }
    async createChallengeActivity(activity) {
        const [newActivity] = await db_1.db
            .insert(schema_1.challengeActivities)
            .values(activity)
            .returning();
        return newActivity;
    }
    async getGoalActivities(goalId) {
        const activities = await db_1.db
            .select({
            activity: schema_1.challengeActivities,
            user: schema_1.users,
        })
            .from(schema_1.challengeActivities)
            .innerJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.challengeActivities.userId, schema_1.users.id))
            .where((0, drizzle_orm_1.eq)(schema_1.challengeActivities.goalId, goalId))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.challengeActivities.createdAt));
        return activities.map(a => ({ ...a.activity, user: a.user }));
    }
    async checkAndCreateMilestones(goalId) {
        const [goal] = await db_1.db
            .select()
            .from(schema_1.collaborativeGoals)
            .where((0, drizzle_orm_1.eq)(schema_1.collaborativeGoals.id, goalId));
        if (!goal)
            return [];
        const achievements = [];
        const currentAmount = parseFloat(goal.currentAmount);
        const targetAmount = parseFloat(goal.targetAmount);
        const percentageComplete = (currentAmount / targetAmount) * 100;
        const milestones = [25, 50, 75, 100];
        for (const milestone of milestones) {
            if (percentageComplete >= milestone) {
                const [existing] = await db_1.db
                    .select()
                    .from(schema_1.milestoneAchievements)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.milestoneAchievements.goalId, goalId), (0, drizzle_orm_1.eq)(schema_1.milestoneAchievements.milestoneType, "percentage"), (0, drizzle_orm_1.eq)(schema_1.milestoneAchievements.targetAmount, (targetAmount * milestone / 100).toString())));
                if (!existing) {
                    const [achievement] = await db_1.db
                        .insert(schema_1.milestoneAchievements)
                        .values({
                        goalId,
                        userId: null,
                        milestoneType: "percentage",
                        title: `${milestone}% Complete!`,
                        description: `The group has reached ${milestone}% of the savings goal!`,
                        targetAmount: (targetAmount * milestone / 100).toString(),
                        achievedAmount: currentAmount.toString(),
                        rewardType: "badge",
                        rewardData: { type: "percentage", value: milestone },
                    })
                        .returning();
                    achievements.push(achievement);
                    await this.createChallengeActivity({
                        goalId,
                        userId: goal.createdBy,
                        activityType: "milestone",
                        title: `Milestone Achieved: ${milestone}% Complete!`,
                        description: `Congratulations! The group has reached ${milestone}% of the savings goal!`,
                        amount: currentAmount.toString(),
                    });
                }
            }
        }
        return achievements;
    }
    async getUserAchievements(userId) {
        return await db_1.db
            .select()
            .from(schema_1.milestoneAchievements)
            .where((0, drizzle_orm_1.eq)(schema_1.milestoneAchievements.userId, userId))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.milestoneAchievements.achievedAt));
    }
    async getUserMascot(userId) {
        const [mascot] = await db_1.db
            .select()
            .from(schema_1.financialMascots)
            .where((0, drizzle_orm_1.eq)(schema_1.financialMascots.userId, userId))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.financialMascots.createdAt))
            .limit(1);
        return mascot;
    }
    async createMascot(mascot) {
        const [newMascot] = await db_1.db
            .insert(schema_1.financialMascots)
            .values({
            ...mascot,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastGenerated: new Date()
        })
            .returning();
        return newMascot;
    }
    async updateMascot(userId, updates) {
        const [updatedMascot] = await db_1.db
            .update(schema_1.financialMascots)
            .set({
            ...updates,
            updatedAt: new Date()
        })
            .where((0, drizzle_orm_1.eq)(schema_1.financialMascots.userId, userId))
            .returning();
        return updatedMascot;
    }
    async toggleMascot(userId, enabled) {
        const [updatedMascot] = await db_1.db
            .update(schema_1.financialMascots)
            .set({
            isEnabled: enabled,
            updatedAt: new Date()
        })
            .where((0, drizzle_orm_1.eq)(schema_1.financialMascots.userId, userId))
            .returning();
        return updatedMascot;
    }
    async getRedeemCode(code) {
        const [redeemCode] = await db_1.db
            .select()
            .from(schema_1.redeemCodes)
            .where((0, drizzle_orm_1.eq)(schema_1.redeemCodes.code, code.toUpperCase()));
        return redeemCode;
    }
    async redeemCode(code, userId) {
        const [redeemedCode] = await db_1.db
            .update(schema_1.redeemCodes)
            .set({
            redeemed: true,
            userId,
            redeemedAt: new Date()
        })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.redeemCodes.code, code.toUpperCase()), (0, drizzle_orm_1.eq)(schema_1.redeemCodes.redeemed, false)))
            .returning();
        if (!redeemedCode) {
            throw new Error("Code not found or already redeemed");
        }
        return redeemedCode;
    }
    async redeemMultipleCodes(codes, userId) {
        const validCodes = [];
        const invalidCodes = [];
        for (const code of codes) {
            try {
                const redeemCode = await this.getRedeemCode(code);
                if (!redeemCode || redeemCode.redeemed) {
                    invalidCodes.push(code);
                    continue;
                }
                const redeemedCode = await this.redeemCode(code, userId);
                validCodes.push(redeemedCode);
            }
            catch (error) {
                invalidCodes.push(code);
            }
        }
        return { validCodes, invalidCodes };
    }
    async getUserRedeemedCodes(userId) {
        const userCodes = await db_1.db
            .select()
            .from(schema_1.redeemCodes)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.redeemCodes.userId, userId), (0, drizzle_orm_1.eq)(schema_1.redeemCodes.redeemed, true)))
            .orderBy(schema_1.redeemCodes.redeemedAt);
        return userCodes;
    }
    async createImportLog(importLog) {
        const [result] = await db_1.db.insert(schema_1.importLogs).values(importLog).returning();
        return result;
    }
    async getUserImportLogs(userId, limit = 10) {
        const results = await db_1.db
            .select()
            .from(schema_1.importLogs)
            .where((0, drizzle_orm_1.eq)(schema_1.importLogs.userId, userId))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.importLogs.importedAt))
            .limit(limit);
        return results;
    }
    async getImportLogById(id) {
        const results = await db_1.db
            .select()
            .from(schema_1.importLogs)
            .where((0, drizzle_orm_1.eq)(schema_1.importLogs.id, id))
            .limit(1);
        return results[0] || null;
    }
    async getContextualFinancialTips(userId) {
        const [result] = await db_1.db
            .select()
            .from(schema_1.contextualFinancialTips)
            .where((0, drizzle_orm_1.eq)(schema_1.contextualFinancialTips.userId, userId))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.contextualFinancialTips.updatedAt))
            .limit(1);
        return result;
    }
    async saveContextualFinancialTips(tips) {
        const [result] = await db_1.db
            .insert(schema_1.contextualFinancialTips)
            .values({
            ...tips,
            createdAt: new Date(),
            updatedAt: new Date(),
        })
            .returning();
        return result;
    }
    async updateContextualFinancialTips(userId, tips) {
        const [result] = await db_1.db
            .update(schema_1.contextualFinancialTips)
            .set({
            ...tips,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(schema_1.contextualFinancialTips.userId, userId))
            .returning();
        return result;
    }
    async shouldRegenerateFinancialTips(userId, currentDataHash) {
        const existingTips = await this.getContextualFinancialTips(userId);
        if (!existingTips) {
            return true;
        }
        if (existingTips.dataHash !== currentDataHash) {
            return true;
        }
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);
        if (existingTips.updatedAt < oneDayAgo) {
            return true;
        }
        return false;
    }
    async deleteCachedDailyRecommendations(userId) {
        await db_1.db.delete(dailyRecommendations).where((0, drizzle_orm_1.eq)(dailyRecommendations.userId, userId));
        console.log(`Deleted cached daily recommendations for user ${userId}`);
    }
}
exports.DatabaseStorage = DatabaseStorage;
exports.storage = new DatabaseStorage();
