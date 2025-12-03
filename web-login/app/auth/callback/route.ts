import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const errorParam = requestUrl.searchParams.get('error')
  
  console.log('[Auth Callback] Request received:', {
    url: requestUrl.toString(),
    hasCode: !!code,
    codeLength: code?.length || 0,
    error: errorParam,
    allParams: Object.fromEntries(requestUrl.searchParams.entries()),
  })

  // Check for OAuth errors
  if (errorParam) {
    console.error('[Auth Callback] OAuth error:', errorParam)
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(errorParam)}`, request.url))
  }

  // For exchangeCodeForSession, we need to use the anon key, not service role
  // But we'll use service role for database operations
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[Auth Callback] Missing Supabase environment variables')
    return NextResponse.redirect(new URL('/?error=Server configuration error', request.url))
  }

  // Create a client with anon key for auth operations
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  // Try to get session from cookies first (Supabase might have already set it)
  // Supabase sets cookies with pattern: sb-<project-ref>-auth-token
  const projectRef = supabaseUrl.split('//')[1]?.split('.')[0] || 'default'
  const cookieName = `sb-${projectRef}-auth-token`
  const accessToken = request.cookies.get('sb-access-token')?.value || 
                     request.cookies.get(cookieName)?.value
  
  console.log('[Auth Callback] Cookie check:', {
    hasAccessToken: !!request.cookies.get('sb-access-token')?.value,
    hasProjectCookie: !!request.cookies.get(cookieName)?.value,
    cookieName,
    allCookies: Object.keys(Object.fromEntries(request.cookies.getAll().map(c => [c.name, '***'])))
  })

  if (code) {
    console.log('[Auth Callback] Exchanging code for session...')
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      console.error('[Auth Callback] Error exchanging code for session:', error)
      return NextResponse.redirect(new URL('/?error=Authentication failed', request.url))
    }

    if (data.user) {
      console.log('[Auth Callback] User authenticated:', data.user.id, data.user.email)
      
      // Sync user to database directly (server-side) and wait for completion
      let userCreated = false
      try {
        const serverSupabase = createServerClient()
        
        // Check if user exists
        const { data: existingUser, error: checkError } = await serverSupabase
          .from('users')
          .select('*')
          .eq('auth_user_id', data.user.id)
          .maybeSingle()

        if (checkError && checkError.code !== 'PGRST116') {
          console.error('[Auth Callback] Error checking existing user:', checkError)
        }

        if (!existingUser) {
          console.log('[Auth Callback] Creating new user in database', {
            auth_user_id: data.user.id,
            email: data.user.email,
            provider: data.user.app_metadata?.provider || 'email',
          })
          
          // Create new user
          const { data: newUser, error: insertError } = await serverSupabase
            .from('users')
            .insert({
              auth_user_id: data.user.id,
              email: data.user.email || '',
              provider: data.user.app_metadata?.provider || 'email',
              email_verified: data.user.email_confirmed_at ? true : (data.user.app_metadata?.provider !== 'email'),
              license_key: '',
              notion_setup_complete: false,
              onboarding_complete: false,
            })
            .select()
            .single()

          if (insertError) {
            console.error('[Auth Callback] Error creating user:', {
              code: insertError.code,
              message: insertError.message,
              details: insertError.details,
              hint: insertError.hint,
            })
            
            // If it's a duplicate key error, user was just created - try to fetch it
            if (insertError.code === '23505') {
              console.log('[Auth Callback] Duplicate key error - user might already exist, fetching...')
              // Retry fetching the user (might have been created by another request)
              const { data: fetchedUser, error: fetchError } = await serverSupabase
                .from('users')
                .select('*')
                .eq('auth_user_id', data.user.id)
                .single()
              
              if (fetchedUser && !fetchError) {
                console.log('[Auth Callback] User found after duplicate error:', fetchedUser.id)
                userCreated = true
              } else {
                console.error('[Auth Callback] Failed to fetch user after duplicate error:', fetchError)
              }
            } else {
              // For other errors, log and continue to see if we can recover
              console.error('[Auth Callback] Non-duplicate insert error, will attempt verification anyway')
            }
          } else if (newUser) {
            console.log('[Auth Callback] User created successfully:', newUser.id)
            userCreated = true
          } else {
            console.error('[Auth Callback] Insert succeeded but no user returned')
          }
        } else {
          console.log('[Auth Callback] User already exists:', existingUser.id)
          userCreated = true
          // Update email_verified status if needed
          if (data.user.email_confirmed_at && !existingUser.email_verified) {
            await serverSupabase
              .from('users')
              .update({ email_verified: true })
              .eq('id', existingUser.id)
          }
        }

        // Verify user exists before redirecting (retry up to 3 times)
        if (userCreated) {
          let verified = false
          for (let i = 0; i < 3; i++) {
            const { data: verifyUser, error: verifyError } = await serverSupabase
              .from('users')
              .select('id')
              .eq('auth_user_id', data.user.id)
              .single()
            
            if (verifyUser && !verifyError) {
              verified = true
              console.log('[Auth Callback] User verified in database:', verifyUser.id)
              break
            }
            
            if (i < 2) {
              // Wait 200ms before retry
              await new Promise(resolve => setTimeout(resolve, 200))
            }
          }

          if (!verified) {
            console.error('[Auth Callback] User not found in database after creation attempts')
            return NextResponse.redirect(new URL('/?error=User creation failed. Please try again.', request.url))
          }
        } else {
          console.error('[Auth Callback] Failed to create user in database')
          return NextResponse.redirect(new URL('/?error=User creation failed. Please try again.', request.url))
        }
      } catch (err: any) {
        console.error('[Auth Callback] Error syncing user:', err)
        return NextResponse.redirect(new URL('/?error=Authentication error. Please try again.', request.url))
      }
      
      // Only redirect to dashboard if we have a verified user
      return NextResponse.redirect(new URL('/dashboard', request.url))
    } else {
      console.error('[Auth Callback] No user in session data after code exchange')
      return NextResponse.redirect(new URL('/?error=Authentication failed - no user data', request.url))
    }
  } else if (accessToken) {
    // If we have an access token in cookies, try to get user from it
    console.log('[Auth Callback] Found access token in cookies, verifying user...')
    const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken)
    
    if (userError || !user) {
      console.error('[Auth Callback] Invalid access token:', userError)
      return NextResponse.redirect(new URL('/?error=Invalid session', request.url))
    }

    // User is authenticated, sync to database
    console.log('[Auth Callback] User authenticated via token:', user.id, user.email)
    
    // Sync user to database (same logic as above)
    let userCreated = false
    try {
      const serverSupabase = createServerClient()
      
      const { data: existingUser, error: checkError } = await serverSupabase
        .from('users')
        .select('*')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('[Auth Callback] Error checking existing user:', checkError)
      }

      if (!existingUser) {
        console.log('[Auth Callback] Creating new user in database via token flow')
        const { data: newUser, error: insertError } = await serverSupabase
          .from('users')
          .insert({
            auth_user_id: user.id,
            email: user.email || '',
            provider: user.app_metadata?.provider || 'email',
            email_verified: user.email_confirmed_at ? true : (user.app_metadata?.provider !== 'email'),
            license_key: '',
            notion_setup_complete: false,
            onboarding_complete: false,
          })
          .select()
          .single()

        if (insertError) {
          console.error('[Auth Callback] Error creating user:', insertError)
          if (insertError.code === '23505') {
            const { data: fetchedUser } = await serverSupabase
              .from('users')
              .select('*')
              .eq('auth_user_id', user.id)
              .single()
            
            if (fetchedUser) {
              userCreated = true
            }
          }
        } else if (newUser) {
          userCreated = true
        }
      } else {
        userCreated = true
      }

      if (userCreated) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      } else {
        return NextResponse.redirect(new URL('/?error=User creation failed', request.url))
      }
    } catch (err: any) {
      console.error('[Auth Callback] Error syncing user:', err)
      return NextResponse.redirect(new URL('/?error=Authentication error', request.url))
    }
  }

  // No code or token - this is normal for Supabase OAuth
  // Supabase handles OAuth client-side and sets cookies
  // Try to get user from session cookies and create user if needed
  console.log('[Auth Callback] No code or token - Supabase OAuth handled client-side, checking for session...')
  
  // Try multiple cookie name patterns to find the session token
  const allCookies = request.cookies.getAll()
  let sessionToken: string | null = null
  
  console.log('[Auth Callback] All cookies:', allCookies.map(c => ({ 
    name: c.name, 
    hasValue: !!c.value,
    valueLength: c.value?.length || 0,
  })))
  
  // Reuse the projectRef and cookieName already defined above
  // Try different cookie name patterns (same as used elsewhere)
  sessionToken = request.cookies.get('sb-access-token')?.value || 
                 request.cookies.get(cookieName)?.value ||
                 null
  
  // Also try iterating through all cookies as fallback
  if (!sessionToken) {
    for (const cookie of allCookies) {
      const name = cookie.name
      // Supabase sets cookies like: sb-<project-ref>-auth-token
      if (name.includes('auth-token') || (name.startsWith('sb-') && name.includes('auth'))) {
        sessionToken = cookie.value
        console.log('[Auth Callback] Found session token in cookie (fallback):', name)
        break
      }
    }
  } else {
    console.log('[Auth Callback] Found session token using standard pattern:', {
      cookieName: cookieName,
      tokenLength: sessionToken.length,
    })
  }
  
  // If still no token, log all cookie names for debugging
  if (!sessionToken) {
    console.log('[Auth Callback] No session token found. All cookie names:', allCookies.map(c => c.name))
  }
  
  if (sessionToken) {
    try {
      // Try to get user from the session token
      const { data: { user }, error: userError } = await supabase.auth.getUser(sessionToken)
      
      if (user && !userError) {
        console.log('[Auth Callback] Found user in session (client-side OAuth):', user.id, user.email)
        
        // Sync user to database
        const serverSupabase = createServerClient()
        
        const { data: existingUser, error: checkError } = await serverSupabase
          .from('users')
          .select('*')
          .eq('auth_user_id', user.id)
          .maybeSingle()

        if (checkError && checkError.code !== 'PGRST116') {
          console.error('[Auth Callback] Error checking existing user:', checkError)
        }

        if (!existingUser) {
          console.log('[Auth Callback] Creating new user in database (client-side OAuth flow)')
          const { data: newUser, error: insertError } = await serverSupabase
            .from('users')
            .insert({
              auth_user_id: user.id,
              email: user.email || '',
              provider: user.app_metadata?.provider || 'email',
              email_verified: user.email_confirmed_at ? true : (user.app_metadata?.provider !== 'email'),
              license_key: '',
              notion_setup_complete: false,
              onboarding_complete: false,
            })
            .select()
            .single()

          if (insertError) {
            console.error('[Auth Callback] Error creating user:', {
              code: insertError.code,
              message: insertError.message,
              details: insertError.details,
            })
            
            // If duplicate, user was just created - that's okay
            if (insertError.code === '23505') {
              console.log('[Auth Callback] User already exists (duplicate key)')
            }
          } else if (newUser) {
            console.log('[Auth Callback] User created successfully (client-side OAuth):', newUser.id)
          }
        } else {
          console.log('[Auth Callback] User already exists in database:', existingUser.id)
        }
        
        // Redirect to dashboard
        return NextResponse.redirect(new URL('/dashboard', request.url))
      } else {
        console.log('[Auth Callback] Could not get user from session token:', userError?.message)
      }
    } catch (err: any) {
      console.error('[Auth Callback] Error checking session for client-side OAuth:', err)
    }
  } else {
    console.log('[Auth Callback] No session token found in cookies')
  }
  
  // If we couldn't create the user here, redirect anyway
  // The /api/users/me endpoint has a fallback to create the user
  console.log('[Auth Callback] Redirecting to dashboard (user creation will happen via /api/users/me fallback if needed)')
  return NextResponse.redirect(new URL('/dashboard', request.url))
}

