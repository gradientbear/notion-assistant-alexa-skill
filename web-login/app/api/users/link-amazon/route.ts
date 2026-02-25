import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'
import { revokeUserTokens } from '@/lib/oauth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

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

    const { amazon_account_id } = await request.json()

    if (!amazon_account_id) {
      return NextResponse.json(
        { error: 'Missing amazon_account_id' },
        { status: 400 }
      )
    }

    const serverClient = createServerClient()

    // Check if amazon_account_id is already taken by another user
    const { data: existingUser } = await serverClient
      .from('users')
      .select('*')
      .eq('amazon_account_id', amazon_account_id)
      .single()

    if (existingUser && existingUser.id !== authUser.id) {
      return NextResponse.json(
        { error: 'This Amazon account is already linked to another user' },
        { status: 409 }
      )
    }

    // Check if user already has a different amazon_account_id (re-linking scenario)
    const { data: currentUser } = await serverClient
      .from('users')
      .select('amazon_account_id')
      .eq('id', authUser.id)
      .single()

    const isRelinking = currentUser?.amazon_account_id && 
                       currentUser.amazon_account_id !== amazon_account_id

    // Update user
    const { data: user, error } = await serverClient
      .from('users')
      .update({
        amazon_account_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', authUser.id)
      .select()
      .single()

    if (error) {
      throw error
    }

    // CRITICAL: Revoke all existing tokens when re-linking to prevent stale sessions
    // This ensures old tokens can't be used after account re-linking
    if (isRelinking) {
      console.log('[Link Amazon] Re-linking detected, revoking old tokens for user:', authUser.id)
      try {
        await revokeUserTokens(authUser.id)
        
        // Also revoke website refresh tokens
        await serverClient
          .from('website_refresh_tokens')
          .update({ 
            revoked: true, 
            revoked_at: new Date().toISOString() 
          })
          .eq('user_id', authUser.id)
          .eq('revoked', false)

        console.log('[Link Amazon] Successfully revoked old tokens for re-linked account')
      } catch (revokeError: any) {
        // Log but don't fail - token revocation is best effort
        console.error('[Link Amazon] Error revoking old tokens (non-critical):', {
          error: revokeError?.message,
          user_id: authUser.id
        })
      }
    }

    return NextResponse.json({ success: true, user, tokens_revoked: isRelinking })
  } catch (error: any) {
    console.error('[Link Amazon] Error linking Amazon account:', {
      error: error.message,
      stack: error.stack
    })
    return NextResponse.json(
      { error: error.message || 'Failed to link Amazon account' },
      { status: 500 }
    )
  }
}

