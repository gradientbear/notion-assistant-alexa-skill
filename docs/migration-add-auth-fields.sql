-- Migration Script: Add Authentication Fields to Existing Database
-- ⚠️ NOTE: If you deleted all tables, use supabase-schema.sql instead!
-- This script is ONLY for existing databases that need to be updated.

-- Step 1: Add new columns to users table (if they don't exist)
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_user_id UUID;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS provider VARCHAR(50) DEFAULT 'email';
ALTER TABLE users ADD COLUMN IF NOT EXISTS provider_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notion_setup_complete BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_page_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tasks_db_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS focus_logs_db_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS energy_logs_db_id TEXT;

-- Step 2: Make amazon_account_id and license_key nullable (if they're currently NOT NULL)
-- Note: This will fail if there are constraints, but that's okay - it means they're already nullable
DO $$ 
BEGIN
    -- Try to drop NOT NULL constraint on amazon_account_id
    BEGIN
        ALTER TABLE users ALTER COLUMN amazon_account_id DROP NOT NULL;
    EXCEPTION WHEN OTHERS THEN
        -- Column might already be nullable or constraint doesn't exist
        NULL;
    END;
    
    -- Try to drop NOT NULL constraint on license_key
    BEGIN
        ALTER TABLE users ALTER COLUMN license_key DROP NOT NULL;
    EXCEPTION WHEN OTHERS THEN
        -- Column might already be nullable or constraint doesn't exist
        NULL;
    END;
END $$;

-- Step 3: Add unique constraint on auth_user_id (if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'users_auth_user_id_key'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_auth_user_id_key UNIQUE (auth_user_id);
    END IF;
END $$;

-- Step 4: Create indexes (if they don't exist)
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Step 5: Create partial unique index for amazon_account_id (allows NULL but unique when not NULL)
-- Drop existing index if it exists with different definition
DROP INDEX IF EXISTS idx_users_amazon_account_id_unique;
CREATE UNIQUE INDEX idx_users_amazon_account_id_unique 
ON users(amazon_account_id) 
WHERE amazon_account_id IS NOT NULL;

-- Step 6: Update oauth_sessions table
ALTER TABLE oauth_sessions ADD COLUMN IF NOT EXISTS auth_user_id UUID;
ALTER TABLE oauth_sessions ALTER COLUMN license_key DROP NOT NULL;

-- Step 7: Set default values for existing rows
UPDATE users 
SET 
    email_verified = COALESCE(email_verified, FALSE),
    provider = COALESCE(provider, 'email'),
    onboarding_complete = COALESCE(onboarding_complete, FALSE),
    notion_setup_complete = COALESCE(notion_setup_complete, FALSE)
WHERE 
    email_verified IS NULL 
    OR provider IS NULL 
    OR onboarding_complete IS NULL 
    OR notion_setup_complete IS NULL;

