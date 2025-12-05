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
      console.log('No token found in request')
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
      console.log('[API /users/me] Authenticated via website JWT:', authUserId);
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
      console.log('[API /users/me] Authenticated via Supabase session token:', authUserId);
    }

    if (!authUserId) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      )
    }

    // Get user from database
    const serverClient = createServerClient()
    
    // Query users table by id (which matches Supabase Auth user id)
    // Retry mechanism for read-after-write consistency (Supabase replication lag)
    let user: any = null;
    let error: any = null;
    const maxRetries = 3;
    const retryDelay = 500; // 500ms between retries
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // Query with fresh Supabase client - each attempt creates a new query
      // Supabase doesn't cache queries by default, so this should always be fresh
      const result = await serverClient
        .from('users')
        .select('id, email, password_hash, email_verified, provider, provider_id, amazon_account_id, license_key, notion_token, notion_setup_complete, privacy_page_id, tasks_db_id, shopping_db_id, workouts_db_id, meals_db_id, notes_db_id, energy_logs_db_id, onboarding_complete, created_at, updated_at')
        .eq('id', authUserId)
        .single();
      
      user = result.data;
      error = result.error;
      
      // If we got the user and it has the expected data, break early
      if (user && !error) {
        // Check if this is a fresh read (has updated_at within last 10 seconds)
        // This helps detect if we're reading stale data after a write
        const updatedAt = new Date(user.updated_at);
        const now = new Date();
        const ageMs = now.getTime() - updatedAt.getTime();
        
        // If data is fresh (updated within last 10 seconds), use it
        // OR if we have notion_token (meaning it was set at some point), use it
        // OR if this is the last attempt, use whatever we have
        if (ageMs < 10000 || user.notion_token || attempt === maxRetries - 1) {
          console.log(`[API /users/me] ✅ Got user data on attempt ${attempt + 1}`, {
            has_notion_token: !!user.notion_token,
            data_age_ms: ageMs,
            is_fresh: ageMs < 10000,
            is_last_attempt: attempt === maxRetries - 1,
          });
          break;
        }
        
        // Data is stale and we're not on last attempt - continue retrying
        console.log(`[API /users/me] ⏳ Data appears stale (age: ${ageMs}ms), retrying...`);
      }
      
      // If we got an error and it's not a "not found" error, break
      if (error && error.code !== 'PGRST116') {
        break;
      }
      
      // Wait before retry (except on last attempt)
      if (attempt < maxRetries - 1) {
        console.log(`[API /users/me] ⏳ Retry ${attempt + 1}/${maxRetries} - waiting ${retryDelay}ms for replication...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    // Always log the lookup result - this is critical for debugging
    console.log('[API /users/me] User lookup result:', {
      hasUser: !!user,
      hasError: !!error,
      errorCode: error?.code,
      errorMessage: error?.message,
      userId: authUserId,
      timestamp: new Date().toISOString(),
    })
    
    // Log raw database response to see what fields are actually returned
    if (user) {
      console.log('[API /users/me] 🔍 User found in database:', {
        id: user.id,
        email: user.email,
        has_notion_token_field: 'notion_token' in user,
        notion_token_value: (user as any).notion_token ? 'EXISTS' : 'NULL',
        notion_token_length: (user as any).notion_token?.length || 0,
        notion_token_preview: (user as any).notion_token ? (user as any).notion_token.substring(0, 10) + '...' : 'null',
        notion_setup_complete: (user as any).notion_setup_complete,
        privacy_page_id: (user as any).privacy_page_id,
        tasks_db_id: (user as any).tasks_db_id,
        updated_at: (user as any).updated_at,
      })
      
      // CRITICAL: Log the raw user object to see all fields
      console.log('[API /users/me] 🔍 Raw user object keys:', Object.keys(user))
      console.log('[API /users/me] 🔍 Raw user notion fields:', {
        notion_token: (user as any).notion_token,
        notion_setup_complete: (user as any).notion_setup_complete,
        privacy_page_id: (user as any).privacy_page_id,
        tasks_db_id: (user as any).tasks_db_id,
      })
    } else if (error) {
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

    // Log token check result for debugging
    if (tokenError) {
      console.error('[API /users/me] Error checking for opaque token:', tokenError);
    } else if (activeToken) {
      console.log('[API /users/me] Found active opaque token:', {
        token_preview: activeToken.token ? activeToken.token.substring(0, 20) + '...' : 'null',
        expires_at: activeToken.expires_at,
      });
    } else {
      // Check if there are any tokens (even expired/revoked) for debugging
      const { data: allTokens } = await serverClient
        .from('oauth_access_tokens')
        .select('token, expires_at, revoked')
        .eq('user_id', user.id)
        .limit(5);
      
      console.log('[API /users/me] No active opaque token found. All tokens for user:', {
        user_id: user.id,
        token_count: allTokens?.length || 0,
        tokens: allTokens?.map(t => ({
          token_preview: t.token ? t.token.substring(0, 20) + '...' : 'null',
          expires_at: t.expires_at,
          revoked: t.revoked,
          is_expired: new Date(t.expires_at) <= new Date(),
        })),
      });
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
    
    // Log what we're returning to debug
    console.log('[API /users/me] 🔍 Returning user data:', {
      id: safeUser.id,
      email: safeUser.email,
      notion_setup_complete: (safeUser as any).notion_setup_complete,
      has_notion_token: !!(safeUser as any).notion_token,
      notion_token_length: (safeUser as any).notion_token?.length || 0,
      has_jwt_token: hasJwtToken,
      privacy_page_id: (safeUser as any).privacy_page_id,
      tasks_db_id: (safeUser as any).tasks_db_id,
      updated_at: (safeUser as any).updated_at,
    })
    
    // CRITICAL: Log the actual response payload
    console.log('[API /users/me] 🔍 Response payload notion fields:', {
      notion_token: responsePayload.notion_token ? 'EXISTS (' + responsePayload.notion_token.length + ' chars)' : 'NULL',
      notion_setup_complete: responsePayload.notion_setup_complete,
      privacy_page_id: responsePayload.privacy_page_id,
      tasks_db_id: responsePayload.tasks_db_id,
    })

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

