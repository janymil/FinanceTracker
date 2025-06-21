import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { drizzle as neonDrizzle } from 'drizzle-orm/neon-serverless';
import { Pool as PgPool } from 'pg';
import { drizzle as pgDrizzle } from 'drizzle-orm/node-postgres';
import ws from "ws";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set. Did you forget to provision a database?');
}

const databaseUrl = process.env.DATABASE_URL;
const isNeonDatabase = databaseUrl.includes('neon.tech') || databaseUrl.includes('neon.database');

let pool: NeonPool | PgPool;
let db: ReturnType<typeof neonDrizzle> | ReturnType<typeof pgDrizzle>;

if (isNeonDatabase) {
  // Configure Neon with WebSocket
  neonConfig.webSocketConstructor = ws;
  pool = new NeonPool({ 
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });
  db = neonDrizzle({ client: pool, schema });
  console.log('✅ Connected to Neon database');
} else {
  // Use standard PostgreSQL for Replit
  pool = new PgPool({ 
    connectionString: databaseUrl
  });
  db = pgDrizzle(pool, { schema });
  console.log('✅ Connected to PostgreSQL database');
}

export { pool, db };