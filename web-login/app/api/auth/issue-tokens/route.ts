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
      .select('id, email')
      .eq('id', authUser.id)
      .maybeSingle();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'user_not_found', error_description: 'User account does not exist. Please sign in first.' },
        { status: 404 }
      );
    }

    // Issue tokens for existing user
    const tokens = await issueWebsiteTokens(
      user.id,
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

