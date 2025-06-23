"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.unifiedAICache = exports.UnifiedAICache = void 0;
const crypto_1 = __importDefault(require("crypto"));
const db_1 = require("../server/db");
const schema_1 = require("../shared/schema");
const drizzle_orm_1 = require("drizzle-orm");
class UnifiedAICache {
    constructor() {
        this.memoryCache = new Map();
    }
    generateKey(functionName, userId, month, dataHash) {
        return `ai:${functionName}:${userId}:${month}:${dataHash}`;
    }
    createDataHash(data) {
        return crypto_1.default
            .createHash('md5')
            .update(JSON.stringify(data))
            .digest('hex')
            .substring(0, 8);
    }
    async get(functionName, userId, month, userData) {
        const dataHash = this.createDataHash(userData);
        const key = this.generateKey(functionName, userId, month, dataHash);
        const memoryEntry = this.memoryCache.get(key);
        if (memoryEntry) {
            memoryEntry.lastAccessed = new Date();
            console.log(`[UnifiedCache] Memory hit for ${functionName}:${month}`);
            return memoryEntry.result;
        }
        try {
            const dbEntry = await this.getFromDatabase(functionName, userId, month, dataHash);
            if (dbEntry) {
                this.memoryCache.set(key, dbEntry);
                console.log(`[UnifiedCache] Database hit for ${functionName}:${month}`);
                return dbEntry.result;
            }
        }
        catch (error) {
            console.error('[UnifiedCache] Database read error:', error);
        }
        console.log(`[UnifiedCache] Cache miss for ${functionName}:${month}`);
        return null;
    }
    async set(functionName, userId, month, userData, result) {
        const dataHash = this.createDataHash(userData);
        const key = this.generateKey(functionName, userId, month, dataHash);
        const entry = {
            userId,
            functionName,
            month,
            dataHash,
            result,
            createdAt: new Date(),
            lastAccessed: new Date()
        };
        this.memoryCache.set(key, entry);
        try {
            await this.saveToDatabase(entry);
            console.log(`[UnifiedCache] Cached ${functionName}:${month} (hash: ${dataHash})`);
        }
        catch (error) {
            console.error('[UnifiedCache] Database write error:', error);
        }
    }
    async invalidateUser(userId) {
        for (const [key, entry] of this.memoryCache.entries()) {
            if (entry.userId === userId) {
                this.memoryCache.delete(key);
            }
        }
        try {
            await this.clearUserFromDatabase(userId);
            console.log(`[UnifiedCache] Invalidated all cache for user ${userId}`);
        }
        catch (error) {
            console.error('[UnifiedCache] Database clear error:', error);
        }
    }
    async invalidateFunction(userId, functionName, month) {
        for (const [key, entry] of this.memoryCache.entries()) {
            if (entry.userId === userId && entry.functionName === functionName) {
                if (!month || entry.month === month) {
                    this.memoryCache.delete(key);
                }
            }
        }
        try {
            await this.clearFunctionFromDatabase(userId, functionName, month);
            const scope = month ? `${functionName}:${month}` : functionName;
            console.log(`[UnifiedCache] Invalidated ${scope} for user ${userId}`);
        }
        catch (error) {
            console.error('[UnifiedCache] Database clear error:', error);
        }
    }
    async getFromDatabase(functionName, userId, month, dataHash) {
        try {
            const result = await db_1.db.select()
                .from(schema_1.aiCache)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.aiCache.userId, userId), (0, drizzle_orm_1.eq)(schema_1.aiCache.functionName, functionName), (0, drizzle_orm_1.eq)(schema_1.aiCache.month, month), (0, drizzle_orm_1.eq)(schema_1.aiCache.dataHash, dataHash)))
                .limit(1);
            if (result.length > 0) {
                return {
                    userId,
                    functionName,
                    month,
                    dataHash,
                    result: result[0].result,
                    createdAt: result[0].createdAt,
                    lastAccessed: new Date()
                };
            }
            return null;
        }
        catch (error) {
            console.error('Database read error:', error);
            return null;
        }
    }
    async saveToDatabase(entry) {
        try {
            const existing = await db_1.db.select()
                .from(schema_1.aiCache)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.aiCache.userId, entry.userId), (0, drizzle_orm_1.eq)(schema_1.aiCache.functionName, entry.functionName), (0, drizzle_orm_1.eq)(schema_1.aiCache.month, entry.month)))
                .limit(1);
            if (existing.length > 0) {
                await db_1.db.update(schema_1.aiCache)
                    .set({
                    dataHash: entry.dataHash,
                    result: entry.result,
                    lastAccessed: new Date()
                })
                    .where((0, drizzle_orm_1.eq)(schema_1.aiCache.id, existing[0].id));
            }
            else {
                await db_1.db.insert(schema_1.aiCache).values({
                    userId: entry.userId,
                    functionName: entry.functionName,
                    month: entry.month,
                    dataHash: entry.dataHash,
                    result: entry.result,
                    createdAt: entry.createdAt,
                    lastAccessed: entry.lastAccessed,
                    updatedAt: new Date()
                });
            }
        }
        catch (error) {
            console.error('Database save error:', error);
        }
    }
    async clearUserFromDatabase(userId) {
        try {
            await db_1.db.delete(schema_1.aiCache).where((0, drizzle_orm_1.eq)(schema_1.aiCache.userId, userId));
        }
        catch (error) {
            console.error('Database clear error:', error);
        }
    }
    async clearFunctionFromDatabase(userId, functionName, month) {
        try {
            if (month) {
                await db_1.db.delete(schema_1.aiCache).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.aiCache.userId, userId), (0, drizzle_orm_1.eq)(schema_1.aiCache.functionName, functionName), (0, drizzle_orm_1.eq)(schema_1.aiCache.month, month)));
            }
            else {
                await db_1.db.delete(schema_1.aiCache).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.aiCache.userId, userId), (0, drizzle_orm_1.eq)(schema_1.aiCache.functionName, functionName)));
            }
        }
        catch (error) {
            console.error('Database function clear error:', error);
        }
    }
    getStats() {
        const memoryEntries = this.memoryCache.size;
        const functionBreakdown = new Map();
        for (const entry of this.memoryCache.values()) {
            const count = functionBreakdown.get(entry.functionName) || 0;
            functionBreakdown.set(entry.functionName, count + 1);
        }
        return {
            memoryEntries,
            functionBreakdown: Object.fromEntries(functionBreakdown),
            lastAccessed: new Date()
        };
    }
    cleanup() {
        const maxAge = 24 * 60 * 60 * 1000;
        const now = new Date();
        for (const [key, entry] of this.memoryCache.entries()) {
            if (now.getTime() - entry.lastAccessed.getTime() > maxAge) {
                this.memoryCache.delete(key);
            }
        }
    }
}
exports.UnifiedAICache = UnifiedAICache;
exports.unifiedAICache = new UnifiedAICache();
