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

    // Get user record
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('auth_user_id', authUser.id)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'server_error', error_description: 'User not found' },
        { status: 500 }
      );
    }

    // Generate JWT token (Phase 1: skip actual payment)
    const clientId = process.env.ALEXA_OAUTH_CLIENT_ID || 'alexa';
    const tokenResult = await issueAccessToken(
      user.id,
      clientId,
      'alexa',
      user.tasks_db_id || undefined,
      user.amazon_account_id || undefined
    );

    console.log('[Billing] Generated test token for user:', user.id);

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

