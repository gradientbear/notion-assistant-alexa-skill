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

    // Validate that the license_key exists in the licenses table and is active
    const { data: license, error: licenseError } = await serverClient
      .from('licenses')
      .select('status, stripe_payment_intent_id')
      .eq('stripe_payment_intent_id', license_key.trim())
      .maybeSingle()

    if (licenseError) {
      console.error('[Update License] Error checking license:', licenseError)
      return NextResponse.json(
        { error: 'Failed to validate license key' },
        { status: 500 }
      )
    }

    if (!license) {
      return NextResponse.json(
        { error: 'License key not found in system' },
        { status: 404 }
      )
    }

    if (license.status !== 'active') {
      return NextResponse.json(
        { error: 'License key is not active' },
        { status: 400 }
      )
    }

    // Check if this license_key is already assigned to a different user
    const { data: existingUser, error: checkError } = await serverClient
      .from('users')
      .select('id, email')
      .eq('license_key', license_key.trim())
      .neq('id', authUser.id)
      .maybeSingle()

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('[Update License] Error checking for existing assignment:', checkError)
      return NextResponse.json(
        { error: 'Failed to validate license assignment' },
        { status: 500 }
      )
    }

    if (existingUser) {
      return NextResponse.json(
        { 
          error: 'This license key is already assigned to another user',
          existing_user_email: existingUser.email 
        },
        { status: 409 }
      )
    }

    // Update user
    const { data: user, error } = await serverClient
      .from('users')
      .update({
        license_key: license_key.trim(),
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

