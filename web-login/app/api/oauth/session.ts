import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

export interface OAuthSession {
  id: string;
  state: string;
  email: string;
  license_key: string;
  amazon_account_id: string | null;
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
  
  // Session expires in 10 minutes
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

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
    throw new Error(`Failed to create OAuth session: ${error.message}`);
  }

  return data as OAuthSession;
}

export async function getOAuthSession(state: string): Promise<OAuthSession | null> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data, error } = await supabase
    .from('oauth_sessions')
    .select('*')
    .eq('state', state)
    .gt('expires_at', new Date().toISOString()) // Only get non-expired sessions
    .single();

  if (error || !data) {
    return null;
  }

  return data as OAuthSession;
}

export async function deleteOAuthSession(state: string): Promise<void> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { error } = await supabase
    .from('oauth_sessions')
    .delete()
    .eq('state', state);

  if (error) {
    console.error('Failed to delete OAuth session:', error);
    // Don't throw - cleanup is best effort
  }
}

