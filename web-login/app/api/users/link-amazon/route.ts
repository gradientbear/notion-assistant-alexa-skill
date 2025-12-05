import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

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

    // Check if amazon_account_id is already taken
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

    return NextResponse.json({ success: true, user })
  } catch (error: any) {
    console.error('Error linking Amazon account:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to link Amazon account' },
      { status: 500 }
    )
  }
}

