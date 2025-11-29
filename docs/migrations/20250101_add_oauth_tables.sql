-- Migration: Add OAuth2 tables for JWT token management
-- Date: 2025-01-01
-- Description: Creates tables for OAuth2 authorization codes, access tokens, and refresh tokens

-- ============================================================================
-- OAUTH AUTHORIZATION CODES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS oauth_authorization_codes (
  code TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'alexa',
  code_challenge TEXT,
  code_challenge_method TEXT,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for cleanup of expired codes
CREATE INDEX IF NOT EXISTS idx_oauth_auth_codes_expires_at 
ON oauth_authorization_codes(expires_at);

-- Index for user lookup
CREATE INDEX IF NOT EXISTS idx_oauth_auth_codes_user_id 
ON oauth_authorization_codes(user_id);

-- ============================================================================
-- OAUTH ACCESS TOKENS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS oauth_access_tokens (
  token TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'alexa',
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked BOOLEAN DEFAULT FALSE,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for user lookup
CREATE INDEX IF NOT EXISTS idx_oauth_access_tokens_user_id 
ON oauth_access_tokens(user_id);

-- Index for revocation checks
CREATE INDEX IF NOT EXISTS idx_oauth_access_tokens_revoked 
ON oauth_access_tokens(revoked, expires_at);

-- Index for cleanup of expired tokens
CREATE INDEX IF NOT EXISTS idx_oauth_access_tokens_expires_at 
ON oauth_access_tokens(expires_at);

-- ============================================================================
-- OAUTH REFRESH TOKENS TABLE (Optional - if refresh tokens are enabled)
-- ============================================================================
CREATE TABLE IF NOT EXISTS oauth_refresh_tokens (
  token TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  revoked BOOLEAN DEFAULT FALSE,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for user lookup
CREATE INDEX IF NOT EXISTS idx_oauth_refresh_tokens_user_id 
ON oauth_refresh_tokens(user_id);

-- Index for revocation checks
CREATE INDEX IF NOT EXISTS idx_oauth_refresh_tokens_revoked 
ON oauth_refresh_tokens(revoked);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE oauth_authorization_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_access_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_refresh_tokens ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "Service role can manage oauth_authorization_codes" 
ON oauth_authorization_codes FOR ALL USING (true);

CREATE POLICY "Service role can manage oauth_access_tokens" 
ON oauth_access_tokens FOR ALL USING (true);

CREATE POLICY "Service role can manage oauth_refresh_tokens" 
ON oauth_refresh_tokens FOR ALL USING (true);

-- ============================================================================
-- CLEANUP FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_tokens()
RETURNS void AS $$
BEGIN
  -- Delete expired authorization codes
  DELETE FROM oauth_authorization_codes 
  WHERE expires_at < NOW() - INTERVAL '1 day';
  
  -- Delete expired access tokens (keep revoked for audit)
  DELETE FROM oauth_access_tokens 
  WHERE expires_at < NOW() - INTERVAL '7 days' AND revoked = FALSE;
  
  -- Delete old revoked tokens (after 30 days)
  DELETE FROM oauth_access_tokens 
  WHERE revoked = TRUE AND revoked_at < NOW() - INTERVAL '30 days';
  
  -- Delete old refresh tokens if revoked
  DELETE FROM oauth_refresh_tokens 
  WHERE revoked = TRUE AND revoked_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

