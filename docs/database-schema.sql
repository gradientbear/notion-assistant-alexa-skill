-- ============================================================================
-- Voice Planner Alexa Skill - Complete Database Schema
-- ============================================================================
-- This is the SINGLE SOURCE OF TRUTH for the database schema.
-- All migrations have been consolidated into this file.
-- 
-- Run this file in Supabase SQL Editor for:
-- - Fresh database setup
-- - Migrating existing databases
-- - Applying all schema changes in one go
--
-- This file is idempotent - safe to run multiple times.
--
-- This schema supports:
-- - User Registration & Authentication (Supabase Auth + OAuth2)
-- - Payment Integration (Stripe one-time purchases via licenses table)
-- - OAuth2 Account Linking (Opaque tokens for Alexa)
-- - Website JWT Sessions (Stateless JWTs with refresh tokens)
-- - Notion Integration (token storage and database IDs)
--
-- Tables:
-- - users: User accounts with auth, license, and Notion integration
-- - licenses: License keys for payment/activation (Stripe webhook updates status)
-- - oauth_sessions: Legacy OAuth state (backward compatibility)
-- - oauth_authorization_codes: OAuth2 authorization codes
-- - oauth_access_tokens: Opaque access tokens for Alexa Account Linking
-- - oauth_refresh_tokens: Refresh tokens (optional)
-- - website_refresh_tokens: Refresh tokens for website JWT sessions
--
-- IMPORTANT IDENTITY ALIGNMENT:
-- - users.id = auth.users.id (one source of truth, no default, no auth_user_id column)
-- - oauth_sessions.auth_user_id = temporary storage during OAuth flow (MUST exist)
-- - Code uses users.id for all user lookups, oauth_sessions.auth_user_id for OAuth state
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USERS TABLE
-- ============================================================================
-- IMPORTANT: users.id = auth.users.id (one source of truth)
-- No auth_user_id column in users table (removed in migration 002)
-- No default on id (must match Supabase Auth exactly)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY, -- NO DEFAULT - must match auth.users.id exactly
  
  -- Authentication fields
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT, -- For email/password auth (if not using Supabase Auth)
  email_verified BOOLEAN DEFAULT FALSE,
  provider VARCHAR(50) DEFAULT 'email', -- 'email', 'google', 'microsoft', 'apple'
  provider_id VARCHAR(255),
  
  -- Alexa integration
  amazon_account_id VARCHAR(255), -- Nullable, linked during onboarding
  
  -- License
  license_key VARCHAR(255), -- Nullable, stores stripe_payment_intent_id for backward compatibility
  
  -- Notion integration
  notion_token TEXT,
  notion_setup_complete BOOLEAN DEFAULT FALSE,
  privacy_page_id TEXT,
  tasks_db_id TEXT, -- Active: Used for task management
  
  -- Onboarding tracking
  onboarding_complete BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Migration 002: Sync users.id with auth.users.id and remove auth_user_id
DO $$
DECLARE
  has_auth_user_id BOOLEAN;
  id_has_default BOOLEAN;
BEGIN
  -- Check if auth_user_id column exists (old schema)
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'auth_user_id'
  ) INTO has_auth_user_id;
  
  -- Check if id column has a default (should not have one)
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name = 'id' 
    AND column_default IS NOT NULL
  ) INTO id_has_default;
  
  -- Always ensure id has no default (critical for identity alignment)
  IF id_has_default THEN
    ALTER TABLE users ALTER COLUMN id DROP DEFAULT;
    RAISE NOTICE 'Removed default from users.id column (must match auth.users.id exactly)';
  END IF;
  
  IF has_auth_user_id THEN
    -- Step 1: Sync IDs - Update users.id to match auth_user_id where they differ
    UPDATE users 
    SET id = auth_user_id 
    WHERE auth_user_id IS NOT NULL 
      AND id != auth_user_id;
    
    RAISE NOTICE 'Synced user IDs to match auth_user_id';
    
    -- Step 2: Drop constraints that might conflict
    ALTER TABLE oauth_authorization_codes 
      DROP CONSTRAINT IF EXISTS oauth_authorization_codes_user_id_fkey;
    
    ALTER TABLE oauth_access_tokens 
      DROP CONSTRAINT IF EXISTS oauth_access_tokens_user_id_fkey;
    
    ALTER TABLE oauth_refresh_tokens 
      DROP CONSTRAINT IF EXISTS oauth_refresh_tokens_user_id_fkey;
    
    ALTER TABLE website_refresh_tokens 
      DROP CONSTRAINT IF EXISTS website_refresh_tokens_user_id_fkey;
    
    -- Drop primary key constraint if it exists (we'll recreate it)
    ALTER TABLE users 
      DROP CONSTRAINT IF EXISTS users_pkey;
    
    -- Drop unique constraints that might conflict
    ALTER TABLE users 
      DROP CONSTRAINT IF EXISTS users_id_key;
    
    ALTER TABLE users 
      DROP CONSTRAINT IF EXISTS users_email_key;
    
    ALTER TABLE users 
      DROP CONSTRAINT IF EXISTS users_auth_user_id_key;
    
    -- Drop indexes that reference auth_user_id
    DROP INDEX IF EXISTS idx_users_auth_user_id;
    
    -- Step 3: Remove default from id column (must match Supabase Auth, no auto-generation)
    ALTER TABLE users 
      ALTER COLUMN id DROP DEFAULT;
    
    -- Step 4: Make id the primary key
    ALTER TABLE users 
      ADD CONSTRAINT users_pkey PRIMARY KEY (id);
    
    -- Step 5: Add foreign key constraint to auth.users(id)
    BEGIN
      ALTER TABLE users
        ADD CONSTRAINT users_id_fkey
        FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
      
      RAISE NOTICE 'Added foreign key constraint to auth.users(id)';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Could not add foreign key constraint to auth.users(id): %', SQLERRM;
      RAISE NOTICE 'You may need to add this constraint manually with appropriate permissions';
    END;
    
    -- Step 6: Add UNIQUE constraints
    ALTER TABLE users 
      ADD CONSTRAINT users_id_unique UNIQUE (id);
    
    ALTER TABLE users 
      ADD CONSTRAINT users_email_unique UNIQUE (email);
    
    -- Step 7: Drop auth_user_id column from users table
    ALTER TABLE users 
      DROP COLUMN IF EXISTS auth_user_id;
    
    RAISE NOTICE 'Migration 002: Removed auth_user_id from users table (users.id now matches auth.users.id)';
  ELSE
    RAISE NOTICE 'Migration 002: users table already migrated (no auth_user_id found)';
    -- Even if already migrated, ensure id has no default
    IF id_has_default THEN
      RAISE NOTICE 'Migration 002: Removed default from id column (was already migrated but had default)';
    END IF;
  END IF;
END $$;

-- ============================================================================
-- LICENSES TABLE
-- ============================================================================
-- Uses stripe_payment_intent_id as primary key (not license_key)
DO $$
DECLARE
  has_stripe_payment_intent_id BOOLEAN;
  table_exists BOOLEAN;
  has_pk BOOLEAN;
BEGIN
  -- Check if table exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'licenses'
  ) INTO table_exists;
  
  -- Check if stripe_payment_intent_id column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'licenses' AND column_name = 'stripe_payment_intent_id'
  ) INTO has_stripe_payment_intent_id;
  
  -- Check if primary key constraint exists
  IF table_exists THEN
    SELECT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE table_name = 'licenses' 
      AND constraint_type = 'PRIMARY KEY'
    ) INTO has_pk;
  ELSE
    has_pk := FALSE;
  END IF;
  
  -- Step 1: Always drop existing PK constraint first (regardless of which column it's on)
  -- This is safe and necessary for migration
  IF has_pk THEN
    ALTER TABLE licenses DROP CONSTRAINT IF EXISTS licenses_pkey;
    RAISE NOTICE 'Dropped existing primary key constraint';
  END IF;
  
  IF NOT has_stripe_payment_intent_id THEN
    -- Old schema detected - need to migrate
    
    -- Create table if it doesn't exist (without PK first, we'll add it later)
    CREATE TABLE IF NOT EXISTS licenses (
      license_key VARCHAR(255),
      status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      notes TEXT
    );
    
    -- Step 2: Make license_key nullable (now safe since PK is dropped)
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'licenses' 
      AND column_name = 'license_key' 
      AND is_nullable = 'NO'
    ) THEN
      ALTER TABLE licenses ALTER COLUMN license_key DROP NOT NULL;
      RAISE NOTICE 'Made license_key nullable';
    END IF;
    
    -- Step 3: Add new Stripe fields
    ALTER TABLE licenses 
      ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10,2),
      ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'usd',
      ADD COLUMN IF NOT EXISTS purchase_date TIMESTAMPTZ DEFAULT NOW();
    
    -- Step 4: Migrate existing license_key values to stripe_payment_intent_id
    -- For existing rows, use license_key if available, otherwise generate a value
    UPDATE licenses 
    SET stripe_payment_intent_id = COALESCE(
      license_key, 
      'legacy_' || gen_random_uuid()::text
    )
    WHERE stripe_payment_intent_id IS NULL;
    
    -- Step 5: Set stripe_payment_intent_id as primary key
    ALTER TABLE licenses 
      ADD CONSTRAINT licenses_pkey PRIMARY KEY (stripe_payment_intent_id);
    RAISE NOTICE 'Set stripe_payment_intent_id as primary key';
    
    RAISE NOTICE 'Migrated licenses table to new schema';
  ELSE
    -- New schema already exists, create table with new schema if it doesn't exist
    CREATE TABLE IF NOT EXISTS licenses (
      stripe_payment_intent_id VARCHAR(255) PRIMARY KEY,
      license_key VARCHAR(255),
      status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
      stripe_customer_id VARCHAR(255),
      amount_paid DECIMAL(10,2),
      currency VARCHAR(3) DEFAULT 'usd',
      purchase_date TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      notes TEXT
    );
    
    -- Ensure all columns are present
    ALTER TABLE licenses 
      ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10,2),
      ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'usd',
      ADD COLUMN IF NOT EXISTS purchase_date TIMESTAMPTZ DEFAULT NOW();
    
    -- Make license_key nullable if it isn't already
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'licenses' 
      AND column_name = 'license_key' 
      AND is_nullable = 'NO'
    ) THEN
      ALTER TABLE licenses ALTER COLUMN license_key DROP NOT NULL;
    END IF;
    
    -- Ensure PK is on stripe_payment_intent_id (recreate if needed)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE table_name = 'licenses' 
      AND constraint_type = 'PRIMARY KEY'
    ) THEN
      ALTER TABLE licenses 
        ADD CONSTRAINT licenses_pkey PRIMARY KEY (stripe_payment_intent_id);
      RAISE NOTICE 'Added primary key constraint on stripe_payment_intent_id';
    END IF;
    
    RAISE NOTICE 'Licenses table already has new schema, ensuring all columns exist';
  END IF;
END $$;

-- ============================================================================
-- OAUTH SESSIONS TABLE (Legacy - for backward compatibility)
-- ============================================================================
-- IMPORTANT: auth_user_id MUST remain in this table (it's used for OAuth flows)
-- This is temporary session storage, different from users.auth_user_id
CREATE TABLE IF NOT EXISTS oauth_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  state VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) NOT NULL,
  license_key VARCHAR(255), -- Optional for web flow
  amazon_account_id VARCHAR(255),
  auth_user_id UUID, -- For web auth flow - MUST KEEP THIS COLUMN!
  code_verifier TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Ensure auth_user_id column exists in oauth_sessions (fix for migration 002 bug)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'oauth_sessions' AND column_name = 'auth_user_id'
  ) THEN
    ALTER TABLE oauth_sessions ADD COLUMN auth_user_id UUID;
    RAISE NOTICE 'Added auth_user_id column to oauth_sessions (fixing migration 002 bug)';
  END IF;
END $$;

-- ============================================================================
-- OAUTH2 TABLES (For Opaque Token Management)
-- ============================================================================

-- OAUTH AUTHORIZATION CODES TABLE
-- Stores one-time authorization codes for OAuth2 Authorization Code Grant flow
CREATE TABLE IF NOT EXISTS oauth_authorization_codes (
  code TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'alexa',
  code_challenge TEXT, -- For PKCE support
  code_challenge_method TEXT, -- 'plain' or 'S256'
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- OAUTH ACCESS TOKENS TABLE
-- Stores opaque access tokens (random strings) for Alexa Account Linking
CREATE TABLE IF NOT EXISTS oauth_access_tokens (
  token TEXT PRIMARY KEY, -- Opaque token (random string), not JWT
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'alexa',
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked BOOLEAN DEFAULT FALSE,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- OAUTH REFRESH TOKENS TABLE (Optional - if refresh tokens are enabled)
CREATE TABLE IF NOT EXISTS oauth_refresh_tokens (
  token TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  revoked BOOLEAN DEFAULT FALSE,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- WEBSITE REFRESH TOKENS TABLE
-- Stores refresh tokens for website JWT sessions
-- ============================================================================
CREATE TABLE IF NOT EXISTS website_refresh_tokens (
  token TEXT PRIMARY KEY, -- Opaque refresh token
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked BOOLEAN DEFAULT FALSE,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Users table indexes (after migration 002: use id, not auth_user_id)
CREATE INDEX IF NOT EXISTS idx_users_id ON users(id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_amazon_account_id ON users(amazon_account_id) WHERE amazon_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_license_key ON users(license_key) WHERE license_key IS NOT NULL;

-- Unique constraint for amazon_account_id (allows NULL but unique when not NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_amazon_account_id_unique 
ON users(amazon_account_id) 
WHERE amazon_account_id IS NOT NULL;

-- Licenses table indexes
CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);
CREATE INDEX IF NOT EXISTS idx_licenses_stripe_payment_intent_id ON licenses(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_licenses_stripe_customer_id ON licenses(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- OAuth sessions table indexes (legacy)
CREATE INDEX IF NOT EXISTS idx_oauth_sessions_state ON oauth_sessions(state);
CREATE INDEX IF NOT EXISTS idx_oauth_sessions_expires_at ON oauth_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_oauth_sessions_auth_user_id ON oauth_sessions(auth_user_id) WHERE auth_user_id IS NOT NULL;

-- OAuth2 authorization codes indexes
CREATE INDEX IF NOT EXISTS idx_oauth_auth_codes_expires_at ON oauth_authorization_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_oauth_auth_codes_user_id ON oauth_authorization_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_auth_codes_used ON oauth_authorization_codes(used) WHERE used = FALSE;

-- OAuth2 access tokens indexes
CREATE INDEX IF NOT EXISTS idx_oauth_access_tokens_user_id ON oauth_access_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_access_tokens_revoked ON oauth_access_tokens(revoked, expires_at);
CREATE INDEX IF NOT EXISTS idx_oauth_access_tokens_expires_at ON oauth_access_tokens(expires_at);

-- OAuth2 refresh tokens indexes
CREATE INDEX IF NOT EXISTS idx_oauth_refresh_tokens_user_id ON oauth_refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_refresh_tokens_revoked ON oauth_refresh_tokens(revoked);

-- Website refresh tokens indexes
CREATE INDEX IF NOT EXISTS idx_website_refresh_tokens_user_id ON website_refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_website_refresh_tokens_expires_at ON website_refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_website_refresh_tokens_revoked ON website_refresh_tokens(revoked, expires_at);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for users table
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at 
BEFORE UPDATE ON users
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for licenses table
DROP TRIGGER IF EXISTS update_licenses_updated_at ON licenses;
CREATE TRIGGER update_licenses_updated_at 
BEFORE UPDATE ON licenses
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PERMISSIONS & GRANTS
-- ============================================================================

-- Grant schema usage to Supabase roles
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Grant table permissions to Supabase roles
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;

-- Grant function permissions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- Grant sequence permissions (for auto-increment columns if any)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO anon, authenticated, service_role;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_authorization_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_access_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_refresh_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
-- Service role can do everything (USING for SELECT, WITH CHECK for INSERT/UPDATE)
DROP POLICY IF EXISTS "Service role can manage users" ON users;
CREATE POLICY "Service role can manage users" ON users
  FOR ALL USING (true) WITH CHECK (true);

-- RLS Policies for licenses table
-- Service role can do everything
DROP POLICY IF EXISTS "Service role can manage licenses" ON licenses;
CREATE POLICY "Service role can manage licenses" ON licenses
  FOR ALL USING (true) WITH CHECK (true);

-- RLS Policies for oauth_sessions table (legacy)
-- Service role can do everything
DROP POLICY IF EXISTS "Service role can manage oauth_sessions" ON oauth_sessions;
CREATE POLICY "Service role can manage oauth_sessions" ON oauth_sessions
  FOR ALL USING (true) WITH CHECK (true);

-- RLS Policies for OAuth2 tables
-- Service role can do everything
DROP POLICY IF EXISTS "Service role can manage oauth_authorization_codes" ON oauth_authorization_codes;
CREATE POLICY "Service role can manage oauth_authorization_codes" ON oauth_authorization_codes
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage oauth_access_tokens" ON oauth_access_tokens;
CREATE POLICY "Service role can manage oauth_access_tokens" ON oauth_access_tokens
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage oauth_refresh_tokens" ON oauth_refresh_tokens;
CREATE POLICY "Service role can manage oauth_refresh_tokens" ON oauth_refresh_tokens
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage website_refresh_tokens" ON website_refresh_tokens;
CREATE POLICY "Service role can manage website_refresh_tokens" ON website_refresh_tokens
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- UTILITY FUNCTIONS
-- ============================================================================

-- Function to clean up expired OAuth sessions (legacy)
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM oauth_sessions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired OAuth2 tokens
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_tokens()
RETURNS void AS $$
BEGIN
  -- Delete expired authorization codes (keep for 1 day after expiry for audit)
  DELETE FROM oauth_authorization_codes 
  WHERE expires_at < NOW() - INTERVAL '1 day';
  
  -- Delete expired access tokens (keep revoked for 30 days for audit)
  DELETE FROM oauth_access_tokens 
  WHERE expires_at < NOW() - INTERVAL '7 days' AND revoked = FALSE;
  
  -- Delete old revoked access tokens (after 30 days)
  DELETE FROM oauth_access_tokens 
  WHERE revoked = TRUE AND revoked_at < NOW() - INTERVAL '30 days';
  
  -- Delete old revoked refresh tokens (after 30 days)
  DELETE FROM oauth_refresh_tokens 
  WHERE revoked = TRUE AND revoked_at < NOW() - INTERVAL '30 days';
  
  -- Delete expired website refresh tokens (keep revoked for 30 days for audit)
  DELETE FROM website_refresh_tokens 
  WHERE expires_at < NOW() - INTERVAL '7 days' AND revoked = FALSE;
  
  -- Delete old revoked website refresh tokens (after 30 days)
  DELETE FROM website_refresh_tokens 
  WHERE revoked = TRUE AND revoked_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;
