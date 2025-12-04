import { NextRequest, NextResponse } from 'next/server';
import { signWebsiteToken, verifyWebsiteToken } from '@/lib/jwt';
import { createServerClient } from '@/lib/supabase';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const REFRESH_TOKEN_EXPIRES_IN = 7 * 24 * 60 * 60; // 7 days in seconds

/**
 * Refresh Website JWT Token Endpoint
 * POST /api/auth/refresh
 * 
 * Body:
 * - refresh_token: The refresh token string
 * 
 * Returns:
 * - access_token: New website JWT token (1 hour)
 * - refresh_token: New refresh token (7 days)
 * - expires_in: Access token expiration in seconds
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { refresh_token } = body;

    if (!refresh_token) {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'refresh_token is required' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Look up refresh token in database
    const { data: refreshTokenData, error: tokenError } = await supabase
      .from('website_refresh_tokens')
      .select('*')
      .eq('token', refresh_token)
      .single();

    if (tokenError || !refreshTokenData) {
      return NextResponse.json(
        { error: 'invalid_grant', error_description: 'Invalid refresh token' },
        { status: 401 }
      );
    }

    // Check if token is revoked
    if (refreshTokenData.revoked) {
      return NextResponse.json(
        { error: 'invalid_grant', error_description: 'Refresh token has been revoked' },
        { status: 401 }
      );
    }

    // Check if token is expired
    if (new Date(refreshTokenData.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'invalid_grant', error_description: 'Refresh token has expired' },
        { status: 401 }
      );
    }

    // Get user info
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('auth_user_id, email')
      .eq('id', refreshTokenData.user_id)
      .single();

    if (userError || !user || !user.auth_user_id) {
      return NextResponse.json(
        { error: 'server_error', error_description: 'User not found' },
        { status: 500 }
      );
    }

    // Revoke old refresh token
    await supabase
      .from('website_refresh_tokens')
      .update({ 
        revoked: true, 
        revoked_at: new Date().toISOString() 
      })
      .eq('token', refresh_token);

    // Generate new access token (1 hour)
    const accessToken = signWebsiteToken({
      userId: user.auth_user_id,
      email: user.email,
    });

    // Generate new refresh token (7 days)
    const newRefreshToken = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN * 1000);

    // Store new refresh token
    const { error: storeError } = await supabase
      .from('website_refresh_tokens')
      .insert({
        token: newRefreshToken,
        user_id: refreshTokenData.user_id,
        expires_at: expiresAt.toISOString(),
        revoked: false,
      });

    if (storeError) {
      console.error('[Refresh] Error storing new refresh token:', storeError);
      return NextResponse.json(
        { error: 'server_error', error_description: 'Failed to store refresh token' },
        { status: 500 }
      );
    }

    const WEBSITE_JWT_EXPIRES_IN = parseInt(process.env.WEBSITE_JWT_EXPIRES_IN || '3600', 10);

    return NextResponse.json({
      access_token: accessToken,
      refresh_token: newRefreshToken,
      token_type: 'Bearer',
      expires_in: WEBSITE_JWT_EXPIRES_IN,
    });
  } catch (error: any) {
    console.error('[Refresh] Error:', error);
    return NextResponse.json(
      { error: 'server_error', error_description: 'Internal server error' },
      { status: 500 }
    );
  }
}

