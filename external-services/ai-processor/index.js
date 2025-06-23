"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const openai_1 = __importDefault(require("openai"));
const dotenv_1 = __importDefault(require("dotenv"));
const openai_functions_1 = require("./openai-functions");
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = parseInt(process.env.PORT || '3000', 10);
const openai = new openai_1.default({ apiKey: process.env.OPENAI_API_KEY });
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'ai-processor', model: 'gpt-4o' });
});
app.post("/execute-gpt-task", async (req, res) => {
    const { task, userId, payload } = req.body;
    if (!task || !userId || !payload) {
        return res.status(400).json({ error: 'Missing required fields: task, userId, payload' });
    }
    try {
        let result;
        switch (task) {
            case "contextual-tips":
                result = await handleContextualTips(payload);
                break;
            case "daily-recommendations":
                result = await handleDailyRecommendations(payload);
                break;
            case "financial-tips":
                result = await handleFinancialTips(payload);
                break;
            case "expense-predictions":
                result = await handleExpensePredictions(payload);
                break;
            case "trend-predictions":
                result = await handleTrendPredictions(payload);
                break;
            case "financial-health-score":
                result = await handleFinancialHealthScore(payload);
                break;
            case "spending-insights":
                result = await handleSpendingInsights(payload);
                break;
            default:
                return res.status(400).json({ error: `Unknown AI task: ${task}` });
        }
        return res.json(result);
    }
    catch (err) {
        console.error(`AI task error [${task}]`, err);
        return res.status(500).json({ error: "AI task failed" });
    }
});
const fallbackCache = new Map();
async function handleContextualTips(payload) {
    return await (0, openai_functions_1.generateFinancialTips)(payload);
}
async function handleDailyRecommendations(payload) {
    return await (0, openai_functions_1.generateDailyRecommendations)(payload);
}
async function handleFinancialTips(payload) {
    return await (0, openai_functions_1.generateFinancialTips)(payload);
}
async function handleExpensePredictions(payload) {
    return await (0, openai_functions_1.generateExpensePredictions)(payload);
}
async function handleTrendPredictions(payload) {
    return await (0, openai_functions_1.generateTrendPredictions)(payload);
}
async function handleFinancialHealthScore(payload) {
    return await (0, openai_functions_1.generateFinancialHealthScore)(payload);
}
async function handleSpendingInsights(payload) {
    return await (0, openai_functions_1.generateSpendingInsights)(payload);
}
app.post('/generate-financial-tip', async (req, res) => {
    try {
        const result = await handleFinancialTips(req.body);
        res.json(result);
    }
    catch (error) {
        console.error('Legacy financial tip error:', error);
        res.status(500).json({ error: 'Financial tip generation failed' });
    }
});
app.post('/generate-daily-recommendation', async (req, res) => {
    try {
        const result = await handleDailyRecommendations(req.body);
        res.json(result);
    }
    catch (error) {
        console.error('Legacy daily recommendation error:', error);
        res.status(500).json({ error: 'Daily recommendation generation failed' });
    }
});
async function handleFinancialHealthScore(payload) {
    return await (0, openai_functions_1.generateAIFinancialHealthScore)(payload);
}
async function handleSpendingInsights(payload) {
    return await (0, openai_functions_1.generateSpendingInsights)(payload.transactions);
}
async function handleTrendPredictions(payload) {
    const { transactions, categoryMap, budgets } = payload;
    return await (0, openai_functions_1.generateTrendPredictions)(transactions, categoryMap, budgets);
}
app.listen(port, '0.0.0.0', () => {
    console.log(`AI Processor server running on port ${port}`);
});
