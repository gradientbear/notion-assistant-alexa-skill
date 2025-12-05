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
        email: user.email,
        license_active: licenseActive,
        notion_db_id: user.tasks_db_id,
        amazon_account_id: user.amazon_account_id,
        token_type: 'legacy',
      });
    }

    // Look up opaque token in database (new approach)
    // First try as opaque token, then fall back to JWT for backward compatibility
    const { data: tokenData, error: tokenError } = await supabase
      .from('oauth_access_tokens')
      .select('*')
      .eq('token', token)
      .single();

    if (tokenError || !tokenData) {
      // Token not found in DB - try as JWT (backward compatibility)
      console.log('[Introspect] Token not found in DB, trying as JWT...');
      const payload = verifyAccessToken(token);

      if (!payload) {
        return NextResponse.json(
          { error: 'invalid_token', error_description: 'Token verification failed' },
          { status: 401 }
        );
      }

      // Check if JWT token is revoked
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
        .eq('id', payload.sub)
        .single();

      if (userError || !user) {
        return NextResponse.json(
          { error: 'invalid_token', error_description: 'User not found' },
          { status: 401 }
        );
      }

      // Check license status (using license_key for backward compatibility)
      let licenseActive = false;
      if (user.license_key) {
        const { data: license } = await supabase
          .from('licenses')
          .select('status')
          .eq('license_key', user.license_key)
          .maybeSingle();
        licenseActive = license?.status === 'active';
      }

      // Return introspection response for JWT token
      return NextResponse.json({
        active: true,
        user_id: user.id,
        email: payload.email,
        license_active: licenseActive,
        notion_db_id: payload.notion_db_id || user.tasks_db_id,
        amazon_account_id: payload.amazon_account_id || user.amazon_account_id,
        scope: payload.scope,
        exp: payload.exp,
        iat: payload.iat,
        token_type: 'Bearer',
      });
    }

    // Opaque token found - check if revoked or expired
    if (tokenData.revoked) {
      return NextResponse.json(
        { error: 'invalid_token', error_description: 'Token has been revoked' },
        { status: 401 }
      );
    }

    if (new Date(tokenData.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'invalid_token', error_description: 'Token has expired' },
        { status: 401 }
      );
    }

    // Get user from database
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', tokenData.user_id)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'invalid_token', error_description: 'User not found' },
        { status: 401 }
      );
    }

    // Check license status (using stripe_payment_intent_id stored in license_key)
    let licenseActive = false;
    if (user.license_key) {
      // license_key now contains stripe_payment_intent_id
      const { data: license } = await supabase
        .from('licenses')
        .select('status')
        .eq('stripe_payment_intent_id', user.license_key)
        .maybeSingle();
      licenseActive = license?.status === 'active';
    }

    // Return introspection response for opaque token
    return NextResponse.json({
      active: true,
      user_id: user.id,
      email: user.email,
      license_active: licenseActive,
      notion_db_id: user.tasks_db_id,
      amazon_account_id: user.amazon_account_id,
      scope: tokenData.scope,
      exp: Math.floor(new Date(tokenData.expires_at).getTime() / 1000),
      iat: Math.floor(new Date(tokenData.issued_at).getTime() / 1000),
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

