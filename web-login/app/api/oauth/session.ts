import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

export interface OAuthSession {
  id: string;
  state: string;
  email: string;
  license_key: string;
  amazon_account_id: string | null;
  auth_user_id: string | null;
  code_verifier: string | null;
  created_at: string;
  expires_at: string;
}

export async function createOAuthSession(
  state: string,
  email: string,
  licenseKey: string,
  amazonAccountId: string | null,
  codeVerifier: string | null,
  authUserId?: string | null
): Promise<OAuthSession> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Session expires in 30 minutes (extended from 10 to allow more time for OAuth flow)
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  // Check if state already exists (prevent collisions)
  const { data: existingSession } = await supabase
    .from('oauth_sessions')
    .select('id, state, expires_at')
    .eq('state', state)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (existingSession) {
    console.warn('[OAuth Session] ⚠️ State collision detected:', {
      state: state.substring(0, 16) + '...',
      existing_session_id: existingSession.id,
      expires_at: existingSession.expires_at,
    });
    throw new Error('OAuth session state already exists and is not expired');
  }

  console.log('[OAuth Session] Attempting to insert session:', {
    state: state.substring(0, 16) + '...',
    email,
    has_license_key: !!licenseKey,
    has_amazon_account_id: !!amazonAccountId,
    has_auth_user_id: !!authUserId,
    auth_user_id: authUserId,
    expires_at: expiresAt,
  });

  const { data, error } = await supabase
    .from('oauth_sessions')
    .insert({
      state,
      email,
      license_key: licenseKey || null,
      amazon_account_id: amazonAccountId,
      auth_user_id: authUserId || null,
      code_verifier: codeVerifier,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error) {
    // Handle unique constraint violation specifically
    if (error.code === '23505') {
      console.error('[OAuth Session] ❌ Unique constraint violation (state already exists):', {
        error_code: error.code,
        error_message: error.message,
        state: state.substring(0, 16) + '...',
      });
      throw new Error(`OAuth session with this state already exists: ${error.message}`);
    }
    
    console.error('[OAuth Session] ❌ Insert error:', {
      error_code: error.code,
      error_message: error.message,
      error_details: error.details,
      error_hint: error.hint,
    });
    throw new Error(`Failed to create OAuth session: ${error.message} (code: ${error.code})`);
  }

  console.log('[OAuth Session] ✅ Session created successfully:', {
    session_id: data?.id,
    state: data?.state?.substring(0, 16) + '...',
    auth_user_id: data?.auth_user_id,
  });

  return data as OAuthSession;
}

export async function getOAuthSession(state: string): Promise<OAuthSession | null> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('[OAuth Session] Retrieving session for state:', state.substring(0, 16) + '...');

  const { data, error } = await supabase
    .from('oauth_sessions')
    .select('*')
    .eq('state', state)
    .gt('expires_at', new Date().toISOString()) // Only get non-expired sessions
    .single();

  if (error) {
    // PGRST116 means "0 rows" - session not found or expired
    if (error.code === 'PGRST116') {
      console.warn('[OAuth Session] ⚠️ Session not found or expired (PGRST116):', {
        state: state.substring(0, 16) + '...',
        error_message: error.message,
      });
    } else {
      console.error('[OAuth Session] ❌ Retrieval error:', {
        error_code: error.code,
        error_message: error.message,
        error_details: error.details,
        error_hint: error.hint,
        state: state.substring(0, 16) + '...',
      });
    }
    return null;
  }

  if (!data) {
    console.warn('[OAuth Session] ⚠️ No session found for state:', state.substring(0, 16) + '...');
    return null;
  }

  console.log('[OAuth Session] ✅ Session retrieved:', {
    session_id: data.id,
    email: data.email,
    has_auth_user_id: !!data.auth_user_id,
    auth_user_id: data.auth_user_id,
    expires_at: data.expires_at,
  });

  return data as OAuthSession;
}

export async function deleteOAuthSession(state: string): Promise<void> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('[OAuth Session] Deleting session for state:', state.substring(0, 16) + '...');

  const { error } = await supabase
    .from('oauth_sessions')
    .delete()
    .eq('state', state);

  if (error) {
    console.error('[OAuth Session] ❌ Failed to delete OAuth session:', {
      error_code: error.code,
      error_message: error.message,
      state: state.substring(0, 16) + '...',
    });
    // Don't throw - cleanup is best effort
  } else {
    console.log('[OAuth Session] ✅ Session deleted successfully:', state.substring(0, 16) + '...');
  }
}

/**
 * Cleanup expired OAuth sessions
 * This function can be called periodically to remove stale sessions from the database
 */
export async function cleanupExpiredOAuthSessions(): Promise<number> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('[OAuth Session] Starting cleanup of expired sessions...');

  const { data, error } = await supabase
    .from('oauth_sessions')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .select();

  if (error) {
    console.error('[OAuth Session] ❌ Failed to cleanup expired sessions:', {
      error_code: error.code,
      error_message: error.message,
    });
    return 0;
  }

  const deletedCount = data?.length || 0;
  console.log('[OAuth Session] ✅ Cleanup completed:', {
    deleted_count: deletedCount,
  });

  return deletedCount;
}

