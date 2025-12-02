-- ============================================================================
-- Notion Data Alexa Skill - Complete Database Schema
-- ============================================================================
-- This file contains the complete database schema including all migrations.
-- Run this file in Supabase SQL Editor for a fresh database setup.
--
-- This schema supports:
-- - User Registration & Authentication (Supabase Auth + OAuth2)
-- - Payment Integration (Stripe one-time purchases via licenses table)
-- - OAuth2 Account Linking (JWT tokens for Alexa)
-- - Notion Integration (token storage and database IDs)
--
-- Tables:
-- - users: User accounts with auth, license, and Notion integration
-- - licenses: License keys for payment/activation (Stripe webhook updates status)
-- - oauth_sessions: Legacy OAuth state (backward compatibility)
-- - oauth_authorization_codes: OAuth2 authorization codes
-- - oauth_access_tokens: JWT access tokens for Alexa Account Linking
-- - oauth_refresh_tokens: Refresh tokens (optional)
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Authentication fields
  auth_user_id UUID UNIQUE, -- Supabase Auth user ID
  email VARCHAR(255) NOT NULL,
  password_hash TEXT, -- For email/password auth (if not using Supabase Auth)
  email_verified BOOLEAN DEFAULT FALSE,
  provider VARCHAR(50) DEFAULT 'email', -- 'email', 'google', 'microsoft', 'apple'
  provider_id VARCHAR(255),
  
  -- Alexa integration
  amazon_account_id VARCHAR(255) UNIQUE, -- Nullable, linked during onboarding
  
  -- License
  license_key VARCHAR(255), -- Nullable, entered during onboarding
  
  -- Notion integration
  notion_token TEXT,
  notion_setup_complete BOOLEAN DEFAULT FALSE,
  privacy_page_id TEXT,
  tasks_db_id TEXT,
  shopping_db_id TEXT,
  workouts_db_id TEXT,
  meals_db_id TEXT,
  notes_db_id TEXT,
  energy_logs_db_id TEXT,
  
  -- Onboarding tracking
  onboarding_complete BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- LICENSES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS licenses (
  license_key VARCHAR(255) PRIMARY KEY,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT
);

-- ============================================================================
-- OAUTH SESSIONS TABLE (Legacy - for backward compatibility)
-- ============================================================================
CREATE TABLE IF NOT EXISTS oauth_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  state VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) NOT NULL,
  license_key VARCHAR(255), -- Optional for web flow
  amazon_account_id VARCHAR(255),
  auth_user_id UUID, -- For web auth flow
  code_verifier TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- ============================================================================
-- OAUTH2 TABLES (For JWT Token Management)
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
-- Stores JWT access tokens for Alexa Account Linking
CREATE TABLE IF NOT EXISTS oauth_access_tokens (
  token TEXT PRIMARY KEY, -- The JWT token itself
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
-- INDEXES
-- ============================================================================

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON users(auth_user_id) WHERE auth_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_amazon_account_id ON users(amazon_account_id) WHERE amazon_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_license_key ON users(license_key) WHERE license_key IS NOT NULL;

-- Unique constraint for amazon_account_id (allows NULL but unique when not NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_amazon_account_id_unique 
ON users(amazon_account_id) 
WHERE amazon_account_id IS NOT NULL;

-- Licenses table indexes
CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);

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
CREATE TRIGGER update_users_updated_at 
BEFORE UPDATE ON users
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for licenses table
CREATE TRIGGER update_licenses_updated_at 
BEFORE UPDATE ON licenses
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

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

-- RLS Policies for users table
-- Service role can do everything
CREATE POLICY "Service role can manage users" ON users
  FOR ALL USING (true);

-- RLS Policies for licenses table
-- Service role can do everything
CREATE POLICY "Service role can manage licenses" ON licenses
  FOR ALL USING (true);

-- RLS Policies for oauth_sessions table (legacy)
-- Service role can do everything
CREATE POLICY "Service role can manage oauth_sessions" ON oauth_sessions
  FOR ALL USING (true);

-- RLS Policies for OAuth2 tables
-- Service role can do everything
CREATE POLICY "Service role can manage oauth_authorization_codes" ON oauth_authorization_codes
  FOR ALL USING (true);

CREATE POLICY "Service role can manage oauth_access_tokens" ON oauth_access_tokens
  FOR ALL USING (true);

CREATE POLICY "Service role can manage oauth_refresh_tokens" ON oauth_refresh_tokens
  FOR ALL USING (true);

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
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SAMPLE DATA (Optional - Uncomment to add test data)
-- ============================================================================

-- INSERT INTO licenses (license_key, status, notes) VALUES
--   ('TEST-LICENSE-001', 'active', 'Test license key'),
--   ('TEST-LICENSE-002', 'active', 'Another test license');

-- ============================================================================
-- TEST USER CREATION (Optional - for testing)
-- ============================================================================

-- Create Test User for Alexa Skill Testing
-- Replace 'YOUR_AMAZON_ACCOUNT_ID_HERE' with the actual userId from Alexa Developer Console Simulator
-- Replace 'YOUR_NOTION_TOKEN_HERE' with your Notion integration token
--
-- INSERT INTO users (
--   amazon_account_id,
--   email,
--   license_key,
--   notion_token,
--   notion_setup_complete,
--   onboarding_complete,
--   created_at,
--   updated_at
-- ) VALUES (
--   'amzn1.ask.account.XXXXXXXXXXXXX',  -- Replace with actual Amazon Account ID from simulator
--   'test@example.com',                  -- Your test email
--   'TEST-LICENSE-KEY',                  -- Any value works since license validation is disabled
--   'secret_XXXXXXXXXXXXXXXXXXXXXXXX',   -- Replace with your Notion integration token
--   false,                               -- Will be set to true after setup
--   false,
--   NOW(),
--   NOW()
-- )
-- ON CONFLICT (amazon_account_id) 
-- DO UPDATE SET
--   email = EXCLUDED.email,
--   notion_token = EXCLUDED.notion_token,  -- Update token if user exists
--   updated_at = NOW();

-- ============================================================================
-- VERIFICATION QUERIES (Run these to verify setup)
-- ============================================================================

-- Check tables exist
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name IN (
--   'users', 
--   'licenses', 
--   'oauth_sessions',
--   'oauth_authorization_codes',
--   'oauth_access_tokens',
--   'oauth_refresh_tokens'
-- );

-- Check users table columns
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'users'
-- ORDER BY ordinal_position;

-- Check indexes
-- SELECT indexname, indexdef 
-- FROM pg_indexes 
-- WHERE schemaname = 'public' 
-- AND tablename IN (
--   'users', 
--   'licenses', 
--   'oauth_sessions',
--   'oauth_authorization_codes',
--   'oauth_access_tokens',
--   'oauth_refresh_tokens'
-- );

