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

    const { license_key } = await request.json()

    if (!license_key) {
      return NextResponse.json(
        { error: 'Missing license_key' },
        { status: 400 }
      )
    }

    const serverClient = createServerClient()

    // Update user
    const { data: user, error } = await serverClient
      .from('users')
      .update({
        license_key,
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
    console.error('Error updating license:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update license' },
      { status: 500 }
    )
  }
}

