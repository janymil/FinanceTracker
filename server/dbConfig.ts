import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import ws from "ws";
import * as schema from "@shared/schema";

// Configure Neon for WebSocket support
neonConfig.webSocketConstructor = ws;

const isDevelopment = process.env.NODE_ENV === 'development';
const isReplit = process.env.REPL_ID !== undefined;
const useReplitDB = isDevelopment && isReplit;

console.log(`Database Config: ${useReplitDB ? 'Using Replit DB' : 'Using Neon DB'} (dev: ${isDevelopment}, replit: ${isReplit})`);

// Database connection setup
export const createDatabaseConnection = () => {
  if (useReplitDB) {
    // Use Replit's built-in PostgreSQL for development
    const replitDbUrl = process.env.DATABASE_URL;
    if (!replitDbUrl) {
      throw new Error("DATABASE_URL must be set for Replit development environment");
    }
    
    // Use postgres-js for Replit DB (better performance in development)
    const client = postgres(replitDbUrl, {
      max: 1, // Single connection for development
      ssl: false
    });
    
    return drizzlePostgres(client, { schema });
  } else {
    // Use Neon DB for production
    const neonDbUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
    if (!neonDbUrl) {
      throw new Error("NEON_DATABASE_URL must be set for production environment");
    }
    
    const pool = new Pool({ 
      connectionString: neonDbUrl,
      ssl: true
    });
    
    return drizzle({ client: pool, schema });
  }
};

export const db = createDatabaseConnection();

// Export database type for use in sync operations
export const getDatabaseInfo = () => ({
  isReplitDB: useReplitDB,
  isDevelopment,
  isProduction: !isDevelopment,
  connectionType: useReplitDB ? 'replit-postgres' : 'neon-serverless'
});