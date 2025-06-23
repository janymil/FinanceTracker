"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAI = runAI;
const unifiedAICache_1 = require("./unifiedAICache");
function hashObject(obj) {
    const json = JSON.stringify(obj);
    return crypto.createHash("sha256").update(json).digest("hex");
}
async function checkCache(key) {
    return aiCache.get(key);
}
async function storeCache(key, value) {
    aiCache.set(key, value, 1800);
}
async function runAI(task, userId, payload) {
    const month = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const cached = await unifiedAICache_1.unifiedAICache.get(task, userId, month, payload);
    if (cached) {
        console.log(`[AI ${task}] Using unified cache for ${month}`);
        return cached;
    }
    try {
        const response = await fetch("https://finanzerpro.fly.dev/execute-gpt-task", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ task, userId, payload })
        });
        if (response.ok) {
            const result = await response.json();
            await unifiedAICache_1.unifiedAICache.set(task, userId, month, payload, result);
            console.log(`[AI ${task}] Success via unified endpoint`);
            return result;
        }
        console.error(`[AI ${task}] Unified endpoint failed: ${response.status} ${response.statusText}`);
        throw new Error(`Unified endpoint failed for task: ${task}`);
    }
    catch (err) {
        console.error(`[AI ${task}] Fly.io service failed:`, err.message);
        switch (task) {
            case 'daily-recommendations':
                return { recommendations: [], insights: [], error: 'Fly.io service unavailable' };
            case 'financial-tips':
                return { tip: {}, error: 'Fly.io service unavailable' };
            case 'contextual-tips':
                return { tips: [], error: 'Fly.io service unavailable' };
            default:
                return { error: 'Fly.io service unavailable' };
        }
    }
}
