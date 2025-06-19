
-- Add billing interval column to users table
ALTER TABLE users ADD COLUMN billing_interval TEXT DEFAULT 'monthly';

-- Update the billing_interval check constraint
-- Note: SQLite doesn't support adding constraints to existing tables,
-- so we'll rely on application-level validation for now
