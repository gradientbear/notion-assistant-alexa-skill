-- ============================================================================
-- Migration 001: Add Stripe fields to licenses, website refresh tokens
-- ============================================================================
-- Run this migration in Supabase SQL Editor
-- This migration adds:
-- 1. Stripe payment fields to licenses table
-- 2. website_refresh_tokens table for website JWT sessions
-- ============================================================================

-- Step 1: Update licenses table
-- First, drop the primary key constraint on license_key
ALTER TABLE licenses DROP CONSTRAINT IF EXISTS licenses_pkey;

-- Add new Stripe fields
ALTER TABLE licenses 
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'usd',
  ADD COLUMN IF NOT EXISTS purchase_date TIMESTAMPTZ DEFAULT NOW();

-- Make license_key nullable (for backward compatibility)
ALTER TABLE licenses ALTER COLUMN license_key DROP NOT NULL;

-- Set stripe_payment_intent_id as primary key
-- Note: This will fail if there are existing rows. You may need to:
-- 1. Migrate existing data first
-- 2. Or set a default value for existing rows
ALTER TABLE licenses 
  ADD CONSTRAINT licenses_pkey PRIMARY KEY (stripe_payment_intent_id);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_licenses_stripe_payment_intent_id ON licenses(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_licenses_stripe_customer_id ON licenses(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- Step 2: Create website_refresh_tokens table
CREATE TABLE IF NOT EXISTS website_refresh_tokens (
  token TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked BOOLEAN DEFAULT FALSE,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_website_refresh_tokens_user_id ON website_refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_website_refresh_tokens_expires_at ON website_refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_website_refresh_tokens_revoked ON website_refresh_tokens(revoked, expires_at);

-- Enable RLS
ALTER TABLE website_refresh_tokens ENABLE ROW LEVEL SECURITY;

-- Add RLS policy
CREATE POLICY "Service role can manage website_refresh_tokens" ON website_refresh_tokens
  FOR ALL USING (true);

-- Update cleanup function
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

-- ============================================================================
-- IMPORTANT NOTES:
-- ============================================================================
-- 1. If you have existing licenses, you'll need to migrate them:
--    UPDATE licenses SET stripe_payment_intent_id = license_key WHERE stripe_payment_intent_id IS NULL;
--
-- 2. After migration, update your application code to use stripe_payment_intent_id
--    instead of license_key as the primary identifier
--
-- 3. The license_key field is kept for backward compatibility but is now nullable
-- ============================================================================

