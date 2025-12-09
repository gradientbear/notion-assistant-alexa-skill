import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'
import { verifyWebsiteToken } from '@/lib/jwt'

// Mark route as dynamic
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Get auth token from header or cookie
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || 
                 request.cookies.get('sb-access-token')?.value ||
                 request.cookies.get('sb-' + (process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]?.split('.')[0] || 'default') + '-auth-token')?.value

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized - No token provided' },
        { status: 401 }
      )
    }

    // Try to verify as website JWT first (new approach)
    const websiteTokenPayload = verifyWebsiteToken(token);
    let authUserId: string | null = null;
    let userEmail: string | null = null;
    let userProvider: string = 'email';

    if (websiteTokenPayload) {
      // Website JWT token - extract user ID and email from payload
      authUserId = websiteTokenPayload.sub;
      userEmail = websiteTokenPayload.email;
    } else {
      // Fall back to Supabase session token (backward compatibility)
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      const supabase = createClient(supabaseUrl, supabaseAnonKey)

      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token)

      if (authError || !authUser) {
        return NextResponse.json(
          { error: 'Invalid token' },
          { status: 401 }
        )
      }

      authUserId = authUser.id;
      userEmail = authUser.email || null;
      userProvider = authUser.app_metadata?.provider || 'email';
    }

    if (!authUserId) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      )
    }

    // Get user from database - use a more aggressive approach to get fresh data
    const serverClient = createServerClient()
    
    // First, try to get the user with a timestamp filter to ensure we get recent data
    // This forces Supabase to query the primary database, not a stale replica
    let user: any = null;
    let error: any = null;
    
    // Query with explicit ordering by updated_at DESC to get the most recent version
    const result = await serverClient
      .from('users')
      .select('id, email, password_hash, email_verified, provider, provider_id, amazon_account_id, license_key, notion_token, notion_setup_complete, privacy_page_id, tasks_db_id, onboarding_complete, created_at, updated_at')
      .eq('id', authUserId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    user = result.data;
    error = result.error;
    
    // If we got stale data (updated_at is more than 1 minute old), retry with delays
    if (user && !error) {
      const updatedAt = new Date(user.updated_at);
      const now = new Date();
      const ageMs = now.getTime() - updatedAt.getTime();
      
      // If data is more than 1 minute old, it's definitely stale - retry
      if (ageMs > 60000 && !user.notion_token) {
        console.log('[API /users/me] Data is stale, retrying with delays...');
        const maxRetries = 5;
        const retryDelay = 1000;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          
          const retryResult = await serverClient
            .from('users')
            .select('id, email, password_hash, email_verified, provider, provider_id, amazon_account_id, license_key, notion_token, notion_setup_complete, privacy_page_id, tasks_db_id, onboarding_complete, created_at, updated_at')
            .eq('id', authUserId)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (retryResult.data) {
            const retryUpdatedAt = new Date(retryResult.data.updated_at);
            const retryAgeMs = now.getTime() - retryUpdatedAt.getTime();
            
            // If we got fresher data, use it
            if (retryAgeMs < ageMs || retryResult.data.notion_token) {
              user = retryResult.data;
              break;
            }
          }
        }
      }
    }

    if (error) {
      console.error('[API /users/me] User not found:', {
        userId: authUserId,
        errorCode: error.code,
        errorMessage: error.message,
      })
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Ensure user exists before returning
    if (!user) {
      console.error('[API /users/me] User is null after all attempts')
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Check if user has an active opaque token (for Alexa account linking)
    // Note: oauth_access_tokens table stores opaque tokens (random strings), not JWTs
    const { data: activeToken, error: tokenError } = await serverClient
      .from('oauth_access_tokens')
      .select('token, expires_at, revoked')
      .eq('user_id', user.id)
      .eq('revoked', false)
      .gt('expires_at', new Date().toISOString())
      .limit(1)
      .maybeSingle();

    if (tokenError) {
      console.error('[API /users/me] Error checking for opaque token:', tokenError);
    }

    const hasJwtToken = !!activeToken; // Note: This checks for opaque tokens, not JWTs (legacy naming)

    // Don't return sensitive data (but keep notion_token for dashboard check)
    const { password_hash, ...safeUser } = user
    
    // Prepare response payload
    const responsePayload = {
      ...safeUser,
      notion_token: (safeUser as any).notion_token || null,
      has_jwt_token: hasJwtToken,
    }

    // Explicitly include notion_token in response (it's needed for dashboard)
    // Add cache-busting headers to ensure fresh data
    return NextResponse.json(responsePayload, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error: any) {
    console.error('Error getting user:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

