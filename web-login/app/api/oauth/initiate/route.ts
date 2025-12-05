import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { createOAuthSession } from '../session';

export async function GET(request: NextRequest) {
  // Handle Alexa account linking - GET request with query parameters
  try {
    const searchParams = request.nextUrl.searchParams;
    const amazonAccountId = searchParams.get('amazon_account_id') || null;
    const email = searchParams.get('email');
    const licenseKey = searchParams.get('license_key');

    if (!email || !licenseKey) {
      return NextResponse.redirect(
        new URL('/?error=Email and license key are required', request.url)
      );
    }

    // Validate license key
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.redirect(
        new URL('/?error=Server configuration error', request.url)
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: license, error: licenseError } = await supabase
      .from('licenses')
      .select('status')
      .eq('license_key', licenseKey)
      .single();

    if (licenseError || !license || license.status !== 'active') {
      return NextResponse.redirect(
        new URL('/?error=Invalid or inactive license key', request.url)
      );
    }

    // Generate state and code verifier
    const state = crypto.randomBytes(32).toString('hex');
    const codeVerifier = crypto.randomBytes(32).toString('base64url');

    // Store session in database
    await createOAuthSession(state, email, licenseKey, amazonAccountId, codeVerifier);

    // Build Notion OAuth URL
    const notionClientId = process.env.NOTION_CLIENT_ID || '';
    const notionRedirectUri = process.env.NOTION_REDIRECT_URI || '';

    if (!notionClientId || !notionRedirectUri) {
      return NextResponse.redirect(
        new URL('/?error=Missing Notion OAuth configuration', request.url)
      );
    }

    const authUrl = new URL('https://api.notion.com/v1/oauth/authorize');
    authUrl.searchParams.set('client_id', notionClientId);
    authUrl.searchParams.set('redirect_uri', notionRedirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('owner', 'user');
    authUrl.searchParams.set('state', state);

    return NextResponse.redirect(authUrl.toString());
  } catch (error: any) {
    console.error('OAuth initiation error:', error);
    return NextResponse.redirect(
      new URL('/?error=OAuth initiation failed', request.url)
    );
  }
}

export async function POST(request: NextRequest) {
  // Handle web form submission
  try {
    // Check environment variables at runtime, not module load time
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';
    const notionClientId = process.env.NOTION_CLIENT_ID || '';
    const notionRedirectUri = process.env.NOTION_REDIRECT_URI || '';

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Missing Supabase environment variables' },
        { status: 500 }
      );
    }

    if (!notionClientId || !notionRedirectUri) {
      return NextResponse.json(
        { error: 'Missing Notion OAuth configuration' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email, licenseKey, amazon_account_id, auth_user_id } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // License validation disabled for MVP - license key is optional and not validated

    // Generate PKCE code verifier and state
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const state = crypto.randomBytes(32).toString('hex');

    // Store session in database (licenseKey is optional for web flow)
    console.log('[OAuth Initiate] Creating OAuth session:', {
      state: state.substring(0, 16) + '...',
      email,
      has_license_key: !!licenseKey,
      has_amazon_account_id: !!amazon_account_id,
      auth_user_id: auth_user_id || null,
    });
    
    try {
      const oauthSession = await createOAuthSession(state, email, licenseKey || '', amazon_account_id || null, codeVerifier, auth_user_id || null);
      console.log('[OAuth Initiate] ✅ OAuth session created:', {
        session_id: oauthSession.id,
        state: oauthSession.state.substring(0, 16) + '...',
        auth_user_id: oauthSession.auth_user_id,
        expires_at: oauthSession.expires_at,
      });
    } catch (sessionError: any) {
      console.error('[OAuth Initiate] ❌ Failed to create OAuth session:', sessionError);
      return NextResponse.json(
        { error: `Failed to create OAuth session: ${sessionError.message}` },
        { status: 500 }
      );
    }

    // Build Notion OAuth URL
    const authUrl = new URL('https://api.notion.com/v1/oauth/authorize');
    authUrl.searchParams.set('client_id', notionClientId);
    authUrl.searchParams.set('redirect_uri', notionRedirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('owner', 'user');
    authUrl.searchParams.set('state', state);

    return NextResponse.json({ authUrl: authUrl.toString(), state });
  } catch (error: any) {
    console.error('OAuth initiation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

