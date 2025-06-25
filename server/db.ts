import { Pool as PgPool } from 'pg';
import { drizzle as pgDrizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

// Use DATABASE_URL for all environments (Replit provides this automatically)
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    `DATABASE_URL must be set. Did you forget to provision a database?`,
  );
}

// Always use standard PostgreSQL connection for Replit deployment
const pool = new PgPool({ 
  connectionString: databaseUrl
});
const db = pgDrizzle(pool, { schema });

console.log('✅ Connected to Replit database');

export { pool, db };