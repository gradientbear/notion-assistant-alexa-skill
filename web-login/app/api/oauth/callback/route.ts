import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Mark this route as dynamic since it uses searchParams
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Check environment variables at runtime, not module load time
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';
    const notionClientId = process.env.NOTION_CLIENT_ID || '';
    const notionClientSecret = process.env.NOTION_CLIENT_SECRET || '';
    const notionRedirectUri = process.env.NOTION_REDIRECT_URI || '';

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.redirect(
        new URL('/error?message=Missing Supabase environment variables', request.url)
      );
    }

    if (!notionClientId || !notionClientSecret || !notionRedirectUri) {
      return NextResponse.redirect(
        new URL('/error?message=Missing Notion OAuth configuration', request.url)
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(
        new URL(`/error?message=${encodeURIComponent(error)}`, request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/error?message=Missing authorization code', request.url)
      );
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${notionClientId}:${notionClientSecret}`).toString('base64')}`,
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: notionRedirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Token exchange error:', errorData);
      return NextResponse.redirect(
        new URL(
          `/error?message=${encodeURIComponent('Failed to exchange token')}`,
          request.url
        )
      );
    }

    const { access_token } = await tokenResponse.json();

    // Retrieve session data from state (in production, use Redis/DB)
    // For now, we need to get email/licenseKey from the request
    // This is a simplified version - in production, store state in DB/Redis
    
    // Get user by license key (we'll need to pass this differently in production)
    // For now, redirect to a page that asks for email/licenseKey again to complete linking
    // Or use a more secure session management approach

    // Return token to Alexa via account linking
    // In production, this should be handled through Alexa's account linking flow
    // For now, we'll redirect to a success page with instructions
    
    return NextResponse.redirect(
      new URL(
        `/success?token=${encodeURIComponent(access_token)}`,
        request.url
      )
    );
  } catch (error: any) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(
      new URL(
        `/error?message=${encodeURIComponent('OAuth callback failed')}`,
        request.url
      )
    );
  }
}

