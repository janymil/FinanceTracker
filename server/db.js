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
exports.db = exports.pool = void 0;
const serverless_1 = require("@neondatabase/serverless");
const neon_serverless_1 = require("drizzle-orm/neon-serverless");
const pg_1 = require("pg");
const node_postgres_1 = require("drizzle-orm/node-postgres");
const ws_1 = __importDefault(require("ws"));
const schema = __importStar(require("@shared/schema"));
const isProduction = process.env.NODE_ENV === 'production';
const databaseUrl = isProduction
    ? process.env.DATABASE_URL_PROD
    : process.env.DATABASE_URL;
if (!databaseUrl) {
    const missingVar = isProduction ? 'DATABASE_URL_PROD' : 'DATABASE_URL';
    throw new Error(`${missingVar} must be set. Did you forget to provision a database?`);
}
let pool;
let db;
if (isProduction) {
    serverless_1.neonConfig.webSocketConstructor = ws_1.default;
    exports.pool = pool = new serverless_1.Pool({
        connectionString: databaseUrl,
        ssl: { rejectUnauthorized: false }
    });
    exports.db = db = (0, neon_serverless_1.drizzle)({ client: pool, schema });
    console.log('✅ Connected to Neon production database');
}
else {
    exports.pool = pool = new pg_1.Pool({
        connectionString: databaseUrl
    });
    exports.db = db = (0, node_postgres_1.drizzle)(pool, { schema });
    console.log('✅ Connected to Replit development database');
}
