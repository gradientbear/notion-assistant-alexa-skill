import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken, isLegacyToken, parseLegacyToken } from '@/lib/jwt';
import { isTokenRevoked } from '@/lib/oauth';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Token Introspection Endpoint
 * POST /api/auth/introspect
 * 
 * Headers:
 * - Authorization: Bearer <token>
 * 
 * Returns user info, license status, and notion_db_id
 * Supports both JWT tokens and legacy base64 tokens (for 30-day transition period)
 */
export async function POST(request: NextRequest) {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'unauthorized', error_description: 'Missing or invalid Authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '').trim();

    if (!token) {
      return NextResponse.json(
        { error: 'unauthorized', error_description: 'Token is required' },
        { status: 401 }
      );
    }

    const supabase = createServerClient();

    // Check if it's a legacy base64 token
    if (isLegacyToken(token)) {
      console.log('[Introspect] Processing legacy base64 token');
      const legacyData = parseLegacyToken(token);

      if (!legacyData || !legacyData.amazon_account_id) {
        return NextResponse.json(
          { error: 'invalid_token', error_description: 'Invalid legacy token format' },
          { status: 401 }
        );
      }

      // Look up user by amazon_account_id
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('amazon_account_id', legacyData.amazon_account_id)
        .single();

      if (userError || !user) {
        return NextResponse.json(
          { error: 'invalid_token', error_description: 'User not found for legacy token' },
          { status: 401 }
        );
      }

      // Check license status
      let licenseActive = false;
      if (user.license_key) {
        const { data: license } = await supabase
          .from('licenses')
          .select('status')
          .eq('license_key', user.license_key)
          .single();
        licenseActive = license?.status === 'active';
      }

      // Return compatibility response
      return NextResponse.json({
        active: true,
        user_id: user.id,
        auth_user_id: user.auth_user_id,
        email: user.email,
        license_active: licenseActive,
        notion_db_id: user.tasks_db_id,
        amazon_account_id: user.amazon_account_id,
        token_type: 'legacy',
      });
    }

    // Verify JWT token
    const payload = verifyAccessToken(token);

    if (!payload) {
      return NextResponse.json(
        { error: 'invalid_token', error_description: 'Token verification failed' },
        { status: 401 }
      );
    }

    // Check if token is revoked
    const revoked = await isTokenRevoked(token);
    if (revoked) {
      return NextResponse.json(
        { error: 'invalid_token', error_description: 'Token has been revoked' },
        { status: 401 }
      );
    }

    // Get user from database
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('auth_user_id', payload.sub)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'invalid_token', error_description: 'User not found' },
        { status: 401 }
      );
    }

    // Check license status
    let licenseActive = false;
    if (user.license_key) {
      const { data: license } = await supabase
        .from('licenses')
        .select('status')
        .eq('license_key', user.license_key)
        .single();
      licenseActive = license?.status === 'active';
    }

    // Return introspection response
    return NextResponse.json({
      active: true,
      user_id: user.id,
      auth_user_id: payload.sub,
      email: payload.email,
      license_active: licenseActive,
      notion_db_id: payload.notion_db_id || user.tasks_db_id,
      amazon_account_id: payload.amazon_account_id || user.amazon_account_id,
      scope: payload.scope,
      exp: payload.exp,
      iat: payload.iat,
      token_type: 'Bearer',
    });
  } catch (error: any) {
    console.error('[Introspect] Error:', error);
    return NextResponse.json(
      { error: 'server_error', error_description: 'Internal server error' },
      { status: 500 }
    );
  }
}

