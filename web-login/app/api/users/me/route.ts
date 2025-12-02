import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

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

    // Verify token and get user
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

    // Get user from database
    const serverClient = createServerClient()
    
    // Explicitly select all fields including notion_token
    // Note: select('*') sometimes doesn't return notion_token due to RLS/PostgREST behavior
    // So we explicitly list all fields to ensure notion_token is included
    let { data: user, error } = await serverClient
      .from('users')
      .select('id, auth_user_id, email, password_hash, email_verified, provider, provider_id, amazon_account_id, license_key, notion_token, notion_setup_complete, privacy_page_id, tasks_db_id, focus_logs_db_id, energy_logs_db_id, onboarding_complete, created_at, updated_at')
      .eq('auth_user_id', authUser.id)
      .single()

    // Always log the lookup result - this is critical for debugging
    console.log('[API /users/me] User lookup result:', {
      hasUser: !!user,
      hasError: !!error,
      errorCode: error?.code,
      errorMessage: error?.message,
      authUserId: authUser.id,
      timestamp: new Date().toISOString(),
    })
    
    // If user not found by auth_user_id, try by email as fallback
    if (error || !user) {
      console.log('[API /users/me] User not found by auth_user_id, trying email lookup...')
      const { data: userByEmail, error: emailError } = await serverClient
        .from('users')
        .select('id, auth_user_id, email, password_hash, email_verified, provider, provider_id, amazon_account_id, license_key, notion_token, notion_setup_complete, privacy_page_id, tasks_db_id, focus_logs_db_id, energy_logs_db_id, onboarding_complete, created_at, updated_at')
        .eq('email', authUser.email || '')
        .single()
      
      if (userByEmail && !emailError) {
        console.log('[API /users/me] Found user by email, updating auth_user_id...')
        user = userByEmail
        error = null
        
        // Update auth_user_id if it's missing
        if (user && !user.auth_user_id) {
          const { error: updateError } = await serverClient
            .from('users')
            .update({ auth_user_id: authUser.id })
            .eq('id', user.id)
          
          if (updateError) {
            console.error('[API /users/me] Failed to update auth_user_id:', updateError)
          } else {
            user.auth_user_id = authUser.id
            console.log('[API /users/me] Updated auth_user_id successfully')
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
    }

    // If user doesn't exist, create them (fallback for race conditions)
    if (error || !user) {
      console.error('[API /users/me] User not found in database, attempting to create:', {
        auth_user_id: authUser.id,
        email: authUser.email,
        error: error ? {
          code: error.code,
          message: error.message,
          details: error.details,
        } : null,
      })

      // Try to create the user as a fallback
      console.log('[API /users/me] Attempting to create user:', {
        auth_user_id: authUser.id,
        email: authUser.email,
        provider: authUser.app_metadata?.provider || 'email',
        hasServiceKey: !!process.env.SUPABASE_SERVICE_KEY,
      })
      
      const { data: newUser, error: createError } = await serverClient
        .from('users')
        .insert({
          auth_user_id: authUser.id,
          email: authUser.email || '',
          provider: authUser.app_metadata?.provider || 'email',
          email_verified: authUser.email_confirmed_at ? true : (authUser.app_metadata?.provider !== 'email'),
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
        
        // If it's a duplicate, try fetching again
        if (createError.code === '23505') {
          console.log('[API /users/me] Duplicate key error, fetching existing user...')
          const { data: fetchedUser, error: fetchError } = await serverClient
            .from('users')
            .select('*')
            .eq('auth_user_id', authUser.id)
            .single()
          
          if (fetchedUser && !fetchError) {
            user = fetchedUser
            console.log('[API /users/me] User found after duplicate error:', fetchedUser.id)
          } else {
            console.error('[API /users/me] Failed to fetch user after duplicate error:', fetchError)
            return NextResponse.json(
              { error: 'User not found' },
              { status: 404 }
            )
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

    // Check if user has an active JWT token
    const { data: activeToken } = await serverClient
      .from('oauth_access_tokens')
      .select('id')
      .eq('user_id', user.id)
      .eq('revoked', false)
      .gt('expires_at', new Date().toISOString())
      .limit(1)
      .single();

    const hasJwtToken = !!activeToken;

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

