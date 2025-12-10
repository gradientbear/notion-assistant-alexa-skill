import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'
import { verifyWebsiteToken } from '@/lib/jwt'

// Mark route as dynamic
export const dynamic = 'force-dynamic'

export const runtime = 'nodejs'; // disable edge caching
export const revalidate = 0;

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

    // Get user from database - direct query by ID (primary key, so no ordering needed)
    const serverClient = createServerClient()
    
    // Check if client is requesting fresh data (has cache-busting timestamp parameter)
    const url = new URL(request.url);
    const hasCacheBust = url.searchParams.has('_t');
    
    // Query user directly by ID - this should always return the current state
    // Since id is the primary key, there can only be one record
    let user: any = null;
    let error: any = null;
    
    // First attempt
    let result = await serverClient
      .from('users')
      .select('id, email, password_hash, email_verified, provider, provider_id, amazon_account_id, license_key, notion_token, notion_setup_complete, privacy_page_id, tasks_db_id, onboarding_complete, created_at, updated_at')
      .eq('id', authUserId)
      .maybeSingle();
    
    user = result.data;
    error = result.error;
    
    // If client is requesting fresh data (cache-busting parameter `_t`),
    // do retries with delays to handle Supabase read replica lag
    // This is especially important right after Notion connection when data was just updated
    if (hasCacheBust && user && !error) {
      const firstUser = user;
      const firstUpdatedAt = new Date(user.updated_at);
      
      console.log(`[API /users/me] Client requested fresh data, checking for stale data...`, {
        updated_at: user.updated_at,
        has_notion_token: !!user.notion_token,
        notion_setup_complete: user.notion_setup_complete,
      });
      
      // Try retries with increasing delays (1s, 2s) to handle replication lag
      const retryDelays = [1000, 2000];
      let bestUser = user;
      let bestUpdatedAt = firstUpdatedAt;
      
      for (let i = 0; i < retryDelays.length; i++) {
        await new Promise(resolve => setTimeout(resolve, retryDelays[i]));
        
        // Retry query
        result = await serverClient
          .from('users')
          .select('id, email, password_hash, email_verified, provider, provider_id, amazon_account_id, license_key, notion_token, notion_setup_complete, privacy_page_id, tasks_db_id, onboarding_complete, created_at, updated_at')
          .eq('id', authUserId)
          .maybeSingle();
        
        const retryUser = result.data;
        const retryError = result.error;
        
        if (retryUser && !retryError) {
          const retryUpdatedAt = new Date(retryUser.updated_at);
          
          // Prefer retry result if it's newer or has more complete data
          const isNewer = retryUpdatedAt > bestUpdatedAt;
          const hasMoreData = (retryUser.notion_token && !bestUser.notion_token) ||
                             (retryUser.notion_setup_complete && !bestUser.notion_setup_complete) ||
                             (retryUser.privacy_page_id && !bestUser.privacy_page_id) ||
                             (retryUser.tasks_db_id && !bestUser.tasks_db_id);
          
          if (isNewer || hasMoreData) {
            console.log(`[API /users/me] Retry ${i + 1} returned better data:`, {
              attempt: i + 1,
              delay_ms: retryDelays[i],
              is_newer: isNewer,
              has_more_data: hasMoreData,
              first_updated_at: bestUser.updated_at,
              retry_updated_at: retryUser.updated_at,
            });
            bestUser = retryUser;
            bestUpdatedAt = retryUpdatedAt;
          }
        }
      }
      
      // If retries didn't improve data and we're missing critical fields, try direct REST API
      if ((!bestUser.notion_token || !bestUser.notion_setup_complete) && 
          bestUser.updated_at === firstUser.updated_at) {
        console.log(`[API /users/me] Data still incomplete after retries, trying direct REST API...`);
        
        try {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
          const serviceKey = process.env.SUPABASE_SERVICE_KEY!;
          const queryUrl = `${supabaseUrl}/rest/v1/users?id=eq.${authUserId}&select=*`;
          
          const directResponse = await fetch(queryUrl, {
            method: 'GET',
            headers: {
              'apikey': serviceKey,
              'Authorization': `Bearer ${serviceKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation',
              'Cache-Control': 'no-cache',
            },
          });
          
          if (directResponse.ok) {
            const directData = await directResponse.json();
            const directUser = Array.isArray(directData) ? (directData[0] || null) : directData;
            
            if (directUser && directUser.id === authUserId) {
              const directUpdatedAt = new Date(directUser.updated_at);
              
              if (directUpdatedAt > bestUpdatedAt || 
                  (directUser.notion_token && !bestUser.notion_token) ||
                  (directUser.notion_setup_complete && !bestUser.notion_setup_complete)) {
                console.log(`[API /users/me] ✅ Direct REST API returned fresher data`);
                bestUser = directUser;
              }
            }
          }
        } catch (directError: any) {
          console.error(`[API /users/me] Direct REST API fallback failed:`, directError.message);
        }
      }
      
      // Use the best result we found
      user = bestUser;
      
      if (user.updated_at !== firstUser.updated_at || 
          (user.notion_token && !firstUser.notion_token) ||
          (user.notion_setup_complete && !firstUser.notion_setup_complete)) {
        console.log(`[API /users/me] ✅ Final result improved after retries`);
      }
    }
    
    // Log for debugging
    if (user) {
      console.log('[API /users/me] User fetched:', {
        userId: user.id,
        email: user.email,
        notion_setup_complete: user.notion_setup_complete,
        has_notion_token: !!user.notion_token,
        created_at: user.created_at,
        updated_at: user.updated_at,
      });
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