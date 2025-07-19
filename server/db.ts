import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { drizzle as neonDrizzle } from 'drizzle-orm/neon-serverless';
import { Pool as PgPool } from 'pg';
import { drizzle as pgDrizzle } from 'drizzle-orm/node-postgres';
import ws from "ws";
import * as schema from "@shared/schema";

// Determine which database to use based on environment
const isProduction = process.env.NODE_ENV === 'production';
const databaseUrl = isProduction 
  ? process.env.DATABASE_URL_PROD 
  : process.env.DATABASE_URL;

if (!databaseUrl) {
  const missingVar = isProduction ? 'DATABASE_URL_PROD' : 'DATABASE_URL';
  throw new Error(
    `${missingVar} must be set. Did you forget to provision a database?`,
  );
}

// Initialize database connection based on environment
let pool: NeonPool | PgPool;
let db: ReturnType<typeof neonDrizzle> | ReturnType<typeof pgDrizzle>;

if (isProduction) {
  // Production: Use Neon with WebSocket for serverless
  neonConfig.webSocketConstructor = ws;
  
  const neonPool = new NeonPool({ 
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });
  pool = neonPool;
  db = neonDrizzle(neonPool, { schema });
  
  console.log('✅ Connected to Neon production database');
} else {
  // Development: Use standard PostgreSQL connection for Replit
  pool = new PgPool({ 
    connectionString: databaseUrl
  });
  db = pgDrizzle(pool, { schema });
  
  console.log('✅ Connected to Replit development database');
}

export { pool, db };