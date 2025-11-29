import { NextRequest, NextResponse } from 'next/server';
import { revokeToken, revokeUserTokens } from '@/lib/oauth';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Token Revocation Endpoint
 * POST /api/auth/revoke
 * 
 * Headers:
 * - Authorization: Bearer <admin_token> (or use service role key)
 * 
 * Body:
 * - token: token to revoke (optional)
 * - user_id: user ID to revoke all tokens for (optional)
 * - all: if true, revoke all tokens (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin access (using service role key or admin token)
    const authHeader = request.headers.get('authorization');
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!authHeader && !serviceKey) {
      return NextResponse.json(
        { error: 'unauthorized', error_description: 'Authorization required' },
        { status: 401 }
      );
    }

    // For now, allow service role key or admin token
    // In production, implement proper admin authentication
    const isAuthorized = 
      authHeader?.includes(serviceKey || '') ||
      authHeader?.includes('admin') ||
      serviceKey;

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'unauthorized', error_description: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { token, user_id, all } = body;

    if (all && serviceKey) {
      // Revoke all tokens (admin only)
      const supabase = createServerClient();
      const { error } = await supabase
        .from('oauth_access_tokens')
        .update({ revoked: true, revoked_at: new Date().toISOString() })
        .eq('revoked', false);

      if (error) {
        throw error;
      }

      return NextResponse.json({ success: true, message: 'All tokens revoked' });
    }

    if (user_id) {
      // Revoke all tokens for a user
      await revokeUserTokens(user_id);
      return NextResponse.json({ success: true, message: `All tokens revoked for user ${user_id}` });
    }

    if (token) {
      // Revoke specific token
      await revokeToken(token);
      return NextResponse.json({ success: true, message: 'Token revoked' });
    }

    return NextResponse.json(
      { error: 'invalid_request', error_description: 'Missing token, user_id, or all parameter' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[Revoke] Error:', error);
    return NextResponse.json(
      { error: 'server_error', error_description: 'Internal server error' },
      { status: 500 }
    );
  }
}

