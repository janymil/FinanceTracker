"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerContextualFinancialTipsRoutes = registerContextualFinancialTipsRoutes;
const clerkAuth_1 = require("../clerkAuth");
const aiProcessor_1 = require("../../lib/aiProcessor");
const unifiedAICache_1 = require("../../lib/unifiedAICache");
const storage_1 = require("../storage");
const crypto_1 = __importDefault(require("crypto"));
const drizzle_orm_1 = require("drizzle-orm");
const schema_1 = require("../../shared/schema");
const db_1 = require("../db");
function registerContextualFinancialTipsRoutes(app) {
    app.delete('/api/ai/contextual-financial-tips/cache', clerkAuth_1.isAuthenticated, async (req, res) => {
        try {
            const userId = (0, clerkAuth_1.getUserId)(req);
            if (!userId) {
                return res.status(401).json({ message: "Authentication required" });
            }
            await storage_1.storage.deleteCachedDailyRecommendations(userId);
            await db_1.db.delete(schema_1.contextualFinancialTips).where((0, drizzle_orm_1.eq)(schema_1.contextualFinancialTips.userId, userId));
            const { aiCache } = await Promise.resolve().then(() => __importStar(require('../cache')));
            aiCache.clearUserCache(userId);
            console.log(`Manually cleared all AI caches for user ${userId}`);
            return res.json({ success: true, message: "Cache cleared successfully" });
        }
        catch (error) {
            console.error("Error clearing cache:", error);
            return res.status(500).json({ message: "Failed to clear cache" });
        }
    });
    app.post('/api/ai/contextual-financial-tips', clerkAuth_1.isAuthenticated, async (req, res) => {
        try {
            const userId = (0, clerkAuth_1.getUserId)(req);
            if (!userId) {
                return res.status(401).json({ message: "Authentication required" });
            }
            const { transactions, summary, budgets, selectedMonth } = req.body;
            if (!transactions || !summary) {
                return res.status(400).json({ message: "Transactions and summary are required" });
            }
            const dataForHash = {
                transactionCount: transactions.length,
                totalIncome: summary.totalIncome || 0,
                totalExpenses: summary.totalExpenses || 0,
                budgetCount: budgets?.length || 0,
                recentTransactions: transactions.slice(0, 5).map((t) => ({
                    amount: t.amount,
                    category: t.category,
                    date: t.date
                }))
            };
            const currentDataHash = crypto_1.default
                .createHash('md5')
                .update(JSON.stringify(dataForHash))
                .digest('hex');
            const forceRefresh = req.body.forceRefresh || req.query.refresh === 'true';
            if (!forceRefresh) {
                const month = selectedMonth || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
                const cachedResult = await unifiedAICache_1.unifiedAICache.get('contextual-tips', userId, month, {
                    summary,
                    transactions: transactions.slice(0, 10),
                    budgets
                });
                if (cachedResult && cachedResult.tips) {
                    console.log('Contextual financial tips: Using unified cache - avoiding API call');
                    return res.json({ tips: cachedResult.tips });
                }
            }
            if (forceRefresh) {
                console.log('Contextual financial tips: Force refresh requested - bypassing cache');
            }
            console.log('Contextual financial tips: Generating new AI tips - data changed or cache expired');
            const formatMonth = (selectedMonth) => {
                if (!selectedMonth)
                    return 'Current Month';
                const [year, month] = selectedMonth.split('-');
                const date = new Date(parseInt(year), parseInt(month) - 1);
                return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            };
            const formattedMonth = formatMonth(selectedMonth);
            const aiPayload = {
                summary: {
                    totalIncome: summary.totalIncome || 0,
                    totalExpenses: summary.totalExpenses || 0,
                    netBalance: summary.netBalance || 0,
                    transactionCount: transactions.length || 0
                },
                transactions: transactions.slice(0, 10).map((t) => ({
                    description: t.description || t.note || 'Transaction',
                    amount: t.amount,
                    category: t.category || 'Uncategorized',
                    date: t.date
                })),
                budgets: budgets?.map((budget) => ({
                    category: budget.categoryName,
                    budgetAmount: budget.amount,
                    spent: budget.spent || 0,
                    remaining: budget.remaining || budget.amount
                })) || [],
                selectedMonth: formattedMonth
            };
            const result = await (0, aiProcessor_1.runAI)('contextual-tips', userId, aiPayload);
            const tips = Array.isArray(result?.tips) ? result.tips.map((tip, index) => ({
                id: tip.id || `tip_${Date.now()}_${index}`,
                title: tip.title || 'Financial Tip',
                description: tip.description || 'No description available',
                category: ['spending', 'saving', 'budgeting', 'income'].includes(tip.category) ? tip.category : 'budgeting',
                priority: ['high', 'medium', 'low'].includes(tip.priority) ? tip.priority : 'medium',
                actionable: Boolean(tip.actionable)
            })) : [];
            const month = selectedMonth || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
            try {
                await unifiedAICache_1.unifiedAICache.set('contextual-tips', userId, month, {
                    summary,
                    transactions: transactions.slice(0, 10),
                    budgets
                }, { tips });
                console.log('Contextual financial tips: Saved to unified cache');
            }
            catch (cacheError) {
                console.error("Error saving contextual financial tips to unified cache:", cacheError);
            }
            return res.json({ tips });
        }
        catch (error) {
            console.error("Error generating contextual financial tips:", error);
            try {
                const cachedTips = await storage_1.storage.getContextualFinancialTips(userId);
                if (cachedTips && cachedTips.tips) {
                    console.log('Contextual financial tips: Returning cached tips due to error');
                    return res.json({ tips: cachedTips.tips });
                }
            }
            catch (cacheError) {
                console.error("Error retrieving cached tips:", cacheError);
            }
            const fallbackTips = [];
            const { summary, budgets, transactions } = req.body;
            const savingsRate = summary?.totalIncome > 0 ?
                ((summary.totalIncome - summary.totalExpenses) / summary.totalIncome) * 100 : 0;
            if (summary?.netBalance < 0) {
                fallbackTips.push({
                    id: 'fallback_deficit',
                    title: 'Address Spending Deficit',
                    description: 'Your expenses exceed your income this month. Review your largest expense categories and identify areas to reduce spending.',
                    category: 'spending',
                    priority: 'high',
                    actionable: true
                });
            }
            else if (savingsRate > 90) {
                fallbackTips.push({
                    id: 'fallback_investment',
                    title: 'Consider Investment Opportunities',
                    description: `With a ${Math.round(savingsRate)}% savings rate, consider investing your surplus in index funds, retirement accounts, or other growth vehicles.`,
                    category: 'saving',
                    priority: 'medium',
                    actionable: true
                });
            }
            if ((!budgets || budgets.length === 0) && summary?.totalExpenses > 100) {
                fallbackTips.push({
                    id: 'fallback_budget',
                    title: 'Create Monthly Budgets',
                    description: 'Set up budgets for your main spending categories to better track and control your expenses.',
                    category: 'budgeting',
                    priority: 'medium',
                    actionable: true
                });
            }
            if (fallbackTips.length === 0) {
                if (savingsRate > 50) {
                    fallbackTips.push({
                        id: 'fallback_wealth_building',
                        title: 'Build Long-term Wealth',
                        description: 'Your excellent financial discipline creates opportunities for wealth building. Consider diversifying investments and setting long-term financial goals.',
                        category: 'saving',
                        priority: 'low',
                        actionable: true
                    });
                }
                else {
                    fallbackTips.push({
                        id: 'fallback_general',
                        title: 'Track Your Progress',
                        description: 'Continue monitoring your financial transactions to identify spending patterns and optimization opportunities.',
                        category: 'budgeting',
                        priority: 'low',
                        actionable: true
                    });
                }
            }
            return res.json({ tips: fallbackTips });
        }
    });
}
