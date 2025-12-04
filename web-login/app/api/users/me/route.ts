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
    
    // Explicitly select all fields including notion_token
    // Note: select('*') sometimes doesn't return notion_token due to RLS/PostgREST behavior
    // So we explicitly list all fields to ensure notion_token is included
    // IMPORTANT: Use energy_logs_db_id (not focus_logs_db_id) - that column doesn't exist
    // CRITICAL: Use .select() instead of .single() to handle duplicate auth_user_id cases
    // If multiple users exist with same auth_user_id, prefer the one with Notion token or most recently updated
    let { data: usersByAuthId, error } = await serverClient
      .from('users')
      .select('id, auth_user_id, email, password_hash, email_verified, provider, provider_id, amazon_account_id, license_key, notion_token, notion_setup_complete, privacy_page_id, tasks_db_id, shopping_db_id, workouts_db_id, meals_db_id, notes_db_id, energy_logs_db_id, onboarding_complete, created_at, updated_at')
      .eq('auth_user_id', authUserId)
    
    let user: any = null;
    
    // Handle multiple users with same auth_user_id
    if (usersByAuthId && usersByAuthId.length > 0) {
      // If multiple users found, prefer:
      // 1. User with Notion token (most complete)
      // 2. Most recently updated
      const userWithToken = usersByAuthId.find(u => !!(u as any).notion_token);
      if (userWithToken) {
        user = userWithToken;
        console.log('[API /users/me] Selected user with Notion token:', {
          user_id: user.id,
          has_notion_token: true,
          notion_setup_complete: (user as any).notion_setup_complete,
        });
      } else {
        user = usersByAuthId.sort((a, b) => 
          new Date(b.updated_at || b.created_at).getTime() - 
          new Date(a.updated_at || a.created_at).getTime()
        )[0];
        console.log('[API /users/me] Selected most recently updated user:', {
          user_id: user.id,
          updated_at: user.updated_at,
          has_notion_token: !!(user as any).notion_token,
        });
      }
      
      if (usersByAuthId.length > 1) {
        console.warn('[API /users/me] ⚠️ Multiple users found with same auth_user_id!', {
          total_users: usersByAuthId.length,
          selected_user_id: user.id,
          all_user_ids: usersByAuthId.map(u => ({
            id: u.id,
            has_notion_token: !!(u as any).notion_token,
            notion_setup_complete: (u as any).notion_setup_complete,
            updated_at: u.updated_at,
          })),
          auth_user_id: authUserId,
        });
        
        // Check if another user has Notion data but selected user doesn't
        // This can happen if Notion was connected to a different user record
        const otherUserWithNotion = usersByAuthId.find(u => 
          u.id !== user.id && 
          !!(u as any).notion_token && 
          (u as any).notion_setup_complete
        );
        
        if (otherUserWithNotion && !(user as any).notion_token) {
          console.warn('[API /users/me] ⚠️ Found Notion data in different user record!', {
            selected_user_id: user.id,
            user_with_notion_id: otherUserWithNotion.id,
            message: 'Notion data exists in a different user record. User should reconnect Notion to fix this.',
          });
        }
      }
      
      error = null; // Clear error since we found users
    } else if (error) {
      // Error occurred during query
      console.error('[API /users/me] Error querying users by auth_user_id:', error);
    }

    // Always log the lookup result - this is critical for debugging
    console.log('[API /users/me] User lookup result:', {
      hasUser: !!user,
      hasError: !!error,
      errorCode: error?.code,
      errorMessage: error?.message,
      authUserId: authUserId,
      totalUsersFound: usersByAuthId?.length || 0,
      selectedUserId: user?.id,
      timestamp: new Date().toISOString(),
    })
    
    // If user not found by auth_user_id, try by email as fallback
    // IMPORTANT: If multiple users exist with same email, prefer the one with auth_user_id match or Notion token
    if (error || !user) {
      console.log('[API /users/me] User not found by auth_user_id, trying email lookup...')
      const { data: usersByEmail, error: emailError } = await serverClient
        .from('users')
        .select('id, auth_user_id, email, password_hash, email_verified, provider, provider_id, amazon_account_id, license_key, notion_token, notion_setup_complete, privacy_page_id, tasks_db_id, shopping_db_id, workouts_db_id, meals_db_id, notes_db_id, energy_logs_db_id, onboarding_complete, created_at, updated_at')
        .eq('email', userEmail || '')
      
      if (usersByEmail && !emailError && usersByEmail.length > 0) {
        // If multiple users with same email, prefer:
        // 1. One with matching auth_user_id (CRITICAL - must match)
        // 2. One with Notion token (most complete) - only if no auth_user_id match
        // 3. Most recently updated - only if no auth_user_id match
        let selectedUser = usersByEmail.find(u => u.auth_user_id === authUserId);
        
        console.log('[API /users/me] Email lookup results:', {
          total_users: usersByEmail.length,
          users_with_matching_auth_id: usersByEmail.filter(u => u.auth_user_id === authUserId).length,
          users_with_notion_token: usersByEmail.filter(u => !!(u as any).notion_token).length,
          auth_user_id_to_match: authUserId,
        });
        
        if (!selectedUser) {
          // Prefer user with Notion token
          selectedUser = usersByEmail.find(u => !!(u as any).notion_token);
        }
        
        if (!selectedUser) {
          // Use most recently updated
          selectedUser = usersByEmail.sort((a, b) => 
            new Date(b.updated_at || b.created_at).getTime() - 
            new Date(a.updated_at || a.created_at).getTime()
          )[0];
        }
        
        if (selectedUser) {
          console.log('[API /users/me] Found user by email:', {
            id: selectedUser.id,
            auth_user_id: selectedUser.auth_user_id,
            has_notion_token: !!(selectedUser as any).notion_token,
            matches_auth_user_id: selectedUser.auth_user_id === authUserId
          })
          user = selectedUser
          error = null
          
          // Update auth_user_id if it's missing or doesn't match
          if (user && user.auth_user_id !== authUserId) {
            const { error: updateError } = await serverClient
              .from('users')
              .update({ auth_user_id: authUserId })
              .eq('id', user.id)
            
            if (updateError) {
              console.error('[API /users/me] Failed to update auth_user_id:', updateError)
            } else {
              user.auth_user_id = authUserId
              console.log('[API /users/me] Updated auth_user_id successfully')
            }
          }
        }
      }
    }
    
    // Log raw database response to see what fields are actually returned
    if (user) {
      console.log('[API /users/me] Raw user data from database:', {
        id: user.id,
        email: user.email,
        auth_user_id: (user as any).auth_user_id,
        has_notion_token_field: 'notion_token' in user,
        notion_token_value: (user as any).notion_token ? 'EXISTS' : 'NULL',
        notion_token_length: (user as any).notion_token?.length || 0,
        notion_token_preview: (user as any).notion_token ? (user as any).notion_token.substring(0, 10) + '...' : 'null',
        notion_setup_complete: (user as any).notion_setup_complete,
        all_keys: Object.keys(user),
      })
      
      // Also try a direct query to verify notion_token is accessible
      const { data: directQuery, error: directError } = await serverClient
        .from('users')
        .select('id, notion_token')
        .eq('id', user.id)
        .single()
      
      console.log('[API /users/me] Direct notion_token query:', {
        hasData: !!directQuery,
        hasError: !!directError,
        has_notion_token: !!(directQuery as any)?.notion_token,
        token_length: (directQuery as any)?.notion_token?.length || 0,
      })
    }
    
    // Log the full error object if it exists
    if (error) {
      console.log('[API /users/me] Full error object:', JSON.stringify(error, null, 2))
      
      // If error is about missing column, it's a database schema issue
      // Try a simpler query without the problematic column
      if (error.code === '42703' && error.message?.includes('focus_logs_db_id')) {
        console.log('[API /users/me] Database schema error detected, trying simpler query...')
        const { data: simpleUser, error: simpleError } = await serverClient
          .from('users')
          .select('*')
          .eq('auth_user_id', authUserId)
          .single()
        
        if (simpleUser && !simpleError) {
          user = simpleUser
          error = null
          console.log('[API /users/me] Found user with simple query:', simpleUser.id)
        }
      }
    }

    // If user doesn't exist, create them (fallback for race conditions)
    if (error || !user) {
      console.error('[API /users/me] User not found in database, attempting to create:', {
        auth_user_id: authUserId,
        error: error ? {
          code: error.code,
          message: error.message,
          details: error.details,
        } : null,
      })

      // Try to create the user as a fallback
      console.log('[API /users/me] Attempting to create user:', {
        auth_user_id: authUserId,
        email: userEmail || '',
        provider: userProvider,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_KEY,
      })
      
      const { data: newUser, error: createError } = await serverClient
        .from('users')
        .insert({
          auth_user_id: authUserId,
          email: userEmail || '',
          provider: userProvider,
          email_verified: userProvider !== 'email',
          license_key: '',
          notion_setup_complete: false,
          onboarding_complete: false,
        })
        .select()
        .single()

      if (createError) {
        console.error('[API /users/me] Create error details:', {
          code: createError.code,
          message: createError.message,
          details: createError.details,
          hint: createError.hint,
        })
        
        // If it's a duplicate, try fetching again with explicit field selection
        if (createError.code === '23505') {
          console.log('[API /users/me] Duplicate key error, fetching existing user...')
          const { data: fetchedUser, error: fetchError } = await serverClient
            .from('users')
            .select('id, auth_user_id, email, password_hash, email_verified, provider, provider_id, amazon_account_id, license_key, notion_token, notion_setup_complete, privacy_page_id, tasks_db_id, shopping_db_id, workouts_db_id, meals_db_id, notes_db_id, energy_logs_db_id, onboarding_complete, created_at, updated_at')
            .eq('auth_user_id', authUserId)
            .single()
          
          if (fetchedUser && !fetchError) {
            user = fetchedUser
            console.log('[API /users/me] User found after duplicate error:', {
              id: fetchedUser.id,
              auth_user_id: fetchedUser.auth_user_id,
              has_notion_token: !!(fetchedUser as any).notion_token,
              notion_setup_complete: (fetchedUser as any).notion_setup_complete
            })
          } else {
            console.error('[API /users/me] Failed to fetch user after duplicate error:', fetchError)
            // Try by email as last resort
            if (userEmail) {
              console.log('[API /users/me] Trying email lookup as last resort...')
              const { data: userByEmail } = await serverClient
                .from('users')
                .select('id, auth_user_id, email, password_hash, email_verified, provider, provider_id, amazon_account_id, license_key, notion_token, notion_setup_complete, privacy_page_id, tasks_db_id, shopping_db_id, workouts_db_id, meals_db_id, notes_db_id, energy_logs_db_id, onboarding_complete, created_at, updated_at')
                .eq('email', userEmail)
                .maybeSingle()
              
              if (userByEmail) {
                user = userByEmail
                // Update auth_user_id if missing
                if (!userByEmail.auth_user_id) {
                  await serverClient
                    .from('users')
                    .update({ auth_user_id: authUserId })
                    .eq('id', userByEmail.id)
                }
                console.log('[API /users/me] Found user by email:', userByEmail.id)
              } else {
                return NextResponse.json(
                  { error: 'User not found' },
                  { status: 404 }
                )
              }
            } else {
              return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
              )
            }
          }
        } else {
          // For other errors, log and return error
          console.error('[API /users/me] Failed to create user with non-duplicate error')
          return NextResponse.json(
            { error: 'User not found', details: createError.message },
            { status: 404 }
          )
        }
      } else if (newUser) {
        user = newUser
        console.log('[API /users/me] ✅ User created successfully as fallback:', {
          id: newUser.id,
          email: newUser.email,
          auth_user_id: newUser.auth_user_id,
        })
      } else {
        console.error('[API /users/me] Insert returned no user and no error')
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        )
      }
    } else {
      console.log('[API /users/me] User already exists in database:', {
        id: user.id,
        email: user.email,
        notion_setup_complete: user.notion_setup_complete,
        has_notion_token: !!(user as any).notion_token,
        notion_token_length: (user as any).notion_token?.length || 0,
        notion_token_preview: (user as any).notion_token ? (user as any).notion_token.substring(0, 20) + '...' : 'null',
      })
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
    
    // Log what we're returning to debug
    console.log('[API /users/me] Returning user data:', {
      id: safeUser.id,
      email: safeUser.email,
      notion_setup_complete: (safeUser as any).notion_setup_complete,
      has_notion_token: !!(safeUser as any).notion_token,
      notion_token_length: (safeUser as any).notion_token?.length || 0,
      has_jwt_token: hasJwtToken,
    })

    // Explicitly include notion_token in response (it's needed for dashboard)
    return NextResponse.json({
      ...safeUser,
      notion_token: (safeUser as any).notion_token || null, // Explicitly include
      has_jwt_token: hasJwtToken,
    })
  } catch (error: any) {
    console.error('Error getting user:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

