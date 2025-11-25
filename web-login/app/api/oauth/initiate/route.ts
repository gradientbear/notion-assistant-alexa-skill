import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
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

    const { email, licenseKey } = await request.json();

    if (!email || !licenseKey) {
      return NextResponse.json(
        { error: 'Email and license key are required' },
        { status: 400 }
      );
    }

    // Generate PKCE code verifier and challenge
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    // Store code verifier in session (in production, use proper session storage)
    // For now, we'll include it in the state parameter
    const state = crypto.randomBytes(16).toString('hex');
    
    // Store state, email, licenseKey, and codeVerifier temporarily
    // In production, use Redis or database for this
    const sessionData = {
      email,
      licenseKey,
      codeVerifier,
      timestamp: Date.now(),
    };

    // Build Notion OAuth URL
    const authUrl = new URL('https://api.notion.com/v1/oauth/authorize');
    authUrl.searchParams.set('client_id', notionClientId);
    authUrl.searchParams.set('redirect_uri', notionRedirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('owner', 'user');
    authUrl.searchParams.set('state', state);

    // In production, store sessionData with state as key in Redis/DB
    // For now, we'll encode it in the state (not ideal for production)
    
    return NextResponse.json({ authUrl: authUrl.toString(), state });
  } catch (error: any) {
    console.error('OAuth initiation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

