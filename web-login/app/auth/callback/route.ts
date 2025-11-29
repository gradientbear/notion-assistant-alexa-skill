import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const supabase = createServerClient()

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      console.error('Error exchanging code for session:', error)
      return NextResponse.redirect(new URL('/?error=Authentication failed', request.url))
    }

    if (data.user) {
      // Sync user to database directly (server-side)
      try {
        const serverSupabase = createServerClient()
        
        // Check if user exists
        const { data: existingUser } = await serverSupabase
          .from('users')
          .select('*')
          .eq('auth_user_id', data.user.id)
          .maybeSingle()

        if (!existingUser) {
          // Create new user
          const { error: insertError } = await serverSupabase
            .from('users')
            .insert({
              auth_user_id: data.user.id,
              email: data.user.email || '',
              provider: data.user.app_metadata?.provider || 'email',
              email_verified: data.user.app_metadata?.provider !== 'email',
              license_key: '',
              notion_setup_complete: false,
              onboarding_complete: false,
            })

          if (insertError) {
            console.error('Error creating user:', insertError)
          }
        }
      } catch (err) {
        console.error('Error syncing user:', err)
      }
    }
  }

  // Redirect to onboarding
      return NextResponse.redirect(new URL('/dashboard', request.url))
}

