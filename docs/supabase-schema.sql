-- Notion Data Alexa Skill - Complete Supabase Database Schema
-- Run this file in Supabase SQL Editor for a fresh database setup

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
  focus_logs_db_id TEXT,
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
-- OAUTH SESSIONS TABLE
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

-- OAuth sessions table indexes
CREATE INDEX IF NOT EXISTS idx_oauth_sessions_state ON oauth_sessions(state);
CREATE INDEX IF NOT EXISTS idx_oauth_sessions_expires_at ON oauth_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_oauth_sessions_auth_user_id ON oauth_sessions(auth_user_id) WHERE auth_user_id IS NOT NULL;

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

-- RLS Policies for users table
-- Service role can do everything
CREATE POLICY "Service role can manage users" ON users
  FOR ALL USING (true);

-- RLS Policies for licenses table
-- Service role can do everything
CREATE POLICY "Service role can manage licenses" ON licenses
  FOR ALL USING (true);

-- RLS Policies for oauth_sessions table
-- Service role can do everything
CREATE POLICY "Service role can manage oauth_sessions" ON oauth_sessions
  FOR ALL USING (true);

-- ============================================================================
-- UTILITY FUNCTIONS
-- ============================================================================

-- Function to clean up expired OAuth sessions
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM oauth_sessions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SAMPLE DATA (Optional - Uncomment to add test data)
-- ============================================================================

-- INSERT INTO licenses (license_key, status, notes) VALUES
--   ('TEST-LICENSE-001', 'active', 'Test license key'),
--   ('TEST-LICENSE-002', 'active', 'Another test license');

-- ============================================================================
-- VERIFICATION QUERIES (Run these to verify setup)
-- ============================================================================

-- Check tables exist
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name IN ('users', 'licenses', 'oauth_sessions');

-- Check users table columns
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'users'
-- ORDER BY ordinal_position;

-- Check indexes
-- SELECT indexname, indexdef 
-- FROM pg_indexes 
-- WHERE schemaname = 'public' 
-- AND tablename IN ('users', 'licenses', 'oauth_sessions');
