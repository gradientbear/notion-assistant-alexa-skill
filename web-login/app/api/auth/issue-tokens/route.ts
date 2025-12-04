import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { issueWebsiteTokens } from '@/lib/jwt';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/**
 * Issue Website JWT Tokens Endpoint
 * POST /api/auth/issue-tokens
 * 
 * Headers:
 * - Authorization: Bearer <supabase_session_token>
 * 
 * Returns:
 * - access_token: Website JWT token (1 hour)
 * - refresh_token: Refresh token (7 days)
 * - expires_in: Access token expiration in seconds
 */
export async function POST(request: NextRequest) {
  try {
    // Get Supabase session token
    const authHeader = request.headers.get('authorization');
    const sessionToken = authHeader?.replace('Bearer ', '') || 
                        request.cookies.get('sb-access-token')?.value ||
                        request.cookies.get('sb-' + (process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]?.split('.')[0] || 'default') + '-auth-token')?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { error: 'unauthorized', error_description: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify Supabase session
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(sessionToken);

    if (authError || !authUser) {
      return NextResponse.json(
        { error: 'unauthorized', error_description: 'Invalid session' },
        { status: 401 }
      );
    }

    // Get user record from database
    const serverClient = createServerClient();
    const { data: user, error: userError } = await serverClient
      .from('users')
      .select('id, auth_user_id, email')
      .eq('auth_user_id', authUser.id)
      .maybeSingle();

    if (userError || !user) {
      // User might not exist yet - create them
      const { data: newUser, error: createError } = await serverClient
        .from('users')
        .insert({
          auth_user_id: authUser.id,
          email: authUser.email || '',
          provider: authUser.app_metadata?.provider || 'email',
          email_verified: authUser.email_confirmed_at ? true : (authUser.app_metadata?.provider !== 'email'),
          license_key: '',
          notion_setup_complete: false,
          onboarding_complete: false,
        })
        .select('id, auth_user_id, email')
        .single();

      if (createError || !newUser) {
        return NextResponse.json(
          { error: 'server_error', error_description: 'Failed to create user' },
          { status: 500 }
        );
      }

      // Issue tokens for newly created user
      const tokens = await issueWebsiteTokens(
        newUser.id,
        authUser.id,
        authUser.email || ''
      );

      return NextResponse.json({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        token_type: 'Bearer',
        expires_in: tokens.expiresIn,
      });
    }

    // Issue tokens for existing user
    const tokens = await issueWebsiteTokens(
      user.id,
      authUser.id,
      user.email
    );

    return NextResponse.json({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      token_type: 'Bearer',
      expires_in: tokens.expiresIn,
    });
  } catch (error: any) {
    console.error('[Issue Tokens] Error:', error);
    return NextResponse.json(
      { error: 'server_error', error_description: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

