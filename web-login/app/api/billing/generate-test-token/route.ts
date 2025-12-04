import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { issueAccessToken } from '@/lib/oauth';

export const dynamic = 'force-dynamic';

/**
 * Generate JWT token for Phase 1 testing
 * POST /api/billing/generate-test-token
 */
export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const authHeader = request.headers.get('authorization');
    const sessionToken = authHeader?.replace('Bearer ', '') || 
                        request.cookies.get('sb-access-token')?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { error: 'unauthorized', error_description: 'Authentication required' },
        { status: 401 }
      );
    }

    const supabase = createServerClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(sessionToken);

    if (authError || !authUser) {
      return NextResponse.json(
        { error: 'unauthorized', error_description: 'Invalid session' },
        { status: 401 }
      );
    }

    // Get user record - handle duplicate auth_user_id cases
    // Use same logic as /api/users/me to ensure consistency
    let { data: usersByAuthId, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('auth_user_id', authUser.id);
    
    let user = null;
    
    // Handle multiple users with same auth_user_id (same logic as /api/users/me)
    if (usersByAuthId && usersByAuthId.length > 0) {
      // If multiple users found, prefer:
      // 1. User with Notion token (most complete)
      // 2. Most recently updated
      const userWithToken = usersByAuthId.find(u => !!(u as any).notion_token);
      if (userWithToken) {
        user = userWithToken;
        console.log('[Billing] Selected user with Notion token:', {
          user_id: user.id,
          has_notion_token: true,
        });
      } else {
        user = usersByAuthId.sort((a, b) => 
          new Date(b.updated_at || b.created_at).getTime() - 
          new Date(a.updated_at || a.created_at).getTime()
        )[0];
        console.log('[Billing] Selected most recently updated user:', {
          user_id: user.id,
          updated_at: user.updated_at,
        });
      }
      
      if (usersByAuthId.length > 1) {
        console.warn('[Billing] ⚠️ Multiple users found with same auth_user_id!', {
          total_users: usersByAuthId.length,
          selected_user_id: user.id,
          all_user_ids: usersByAuthId.map(u => ({
            id: u.id,
            has_notion_token: !!(u as any).notion_token,
            updated_at: u.updated_at,
          })),
          auth_user_id: authUser.id,
        });
      }
      
      userError = null; // Clear error since we found users
    }

    if (userError || !user) {
      console.error('[Billing] User not found:', {
        auth_user_id: authUser.id,
        error: userError,
        usersFound: usersByAuthId?.length || 0,
      });
      return NextResponse.json(
        { error: 'server_error', error_description: 'User not found' },
        { status: 500 }
      );
    }

    // Generate JWT token (Phase 1: skip actual payment)
    const clientId = process.env.ALEXA_OAUTH_CLIENT_ID || 'alexa';
    
    console.log('[Billing] Generating token for user:', {
      user_id: user.id,
      auth_user_id: user.auth_user_id,
      email: user.email,
      has_tasks_db: !!user.tasks_db_id,
      has_notion_token: !!(user as any).notion_token,
      notion_setup_complete: (user as any).notion_setup_complete,
      matching_auth_user_id: user.auth_user_id === authUser.id,
    });
    
    // Verify this is the same user that /api/users/me would return
    if (user.auth_user_id !== authUser.id) {
      console.error('[Billing] ⚠️ WARNING: User auth_user_id mismatch!', {
        user_auth_user_id: user.auth_user_id,
        session_auth_user_id: authUser.id,
        user_id: user.id,
      });
    }
    
    const tokenResult = await issueAccessToken(
      user.id, // Database user ID
      clientId,
      'alexa',
      user.tasks_db_id || undefined,
      user.amazon_account_id || undefined
    );

    console.log('[Billing] Token generated successfully:', {
      user_id: user.id,
      token_preview: tokenResult.access_token.substring(0, 20) + '...',
      expires_in: tokenResult.expires_in,
    });
    
    // Verify token was stored by querying it back
    const { data: storedToken, error: verifyError } = await supabase
      .from('oauth_access_tokens')
      .select('token, expires_at, revoked')
      .eq('user_id', user.id)
      .eq('revoked', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (verifyError) {
      console.error('[Billing] Error verifying token storage:', verifyError);
    } else if (storedToken) {
      console.log('[Billing] Token verified in database:', {
        token_preview: storedToken.token ? storedToken.token.substring(0, 20) + '...' : 'null',
        expires_at: storedToken.expires_at,
        revoked: storedToken.revoked,
      });
    } else {
      console.warn('[Billing] Token not found in database after generation - might be a timing issue');
    }

    return NextResponse.json({
      success: true,
      message: 'JWT token generated successfully',
      access_token: tokenResult.access_token,
      expires_in: tokenResult.expires_in,
    });
  } catch (error: any) {
    console.error('[Billing] Error generating token:', error);
    return NextResponse.json(
      { error: 'server_error', error_description: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

