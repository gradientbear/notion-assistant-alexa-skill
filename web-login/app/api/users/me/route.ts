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
    const { data: user, error } = await serverClient
      .from('users')
      .select('*')
      .eq('auth_user_id', authUser.id)
      .single()

    if (error || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Don't return sensitive data
    const { password_hash, ...safeUser } = user

    return NextResponse.json({ ...safeUser })
  } catch (error: any) {
    console.error('Error getting user:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

