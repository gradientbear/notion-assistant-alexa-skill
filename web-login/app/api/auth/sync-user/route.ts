import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { auth_user_id, email, provider } = await request.json()

    if (!auth_user_id || !email) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    // Check if user already exists by id (which matches auth_user_id)
    const { data: existingUser, error: existingError } = await supabase
      .from('users')
      .select('*')
      .eq('id', auth_user_id)
      .maybeSingle()

    if (existingUser) {
      // Update email if changed
      if (existingUser.email !== email) {
        await supabase
          .from('users')
          .update({ email, updated_at: new Date().toISOString() })
          .eq('id', existingUser.id)
      }
      return NextResponse.json({ success: true, user: existingUser })
    }

    // Check if user exists by email (for linking)
    const { data: emailUser, error: emailError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle()

    if (emailUser) {
      // If user found by email but id doesn't match, this is a data integrity issue
      // We can't update the primary key, so just update other fields
      if (emailUser.id !== auth_user_id) {
        console.warn('[Sync User] User found by email but id mismatch:', {
          found_id: emailUser.id,
          expected_id: auth_user_id,
          email: emailUser.email,
        });
        // Update other fields but keep existing id
        // Note: This indicates a data integrity issue that should be fixed via migration
      }
      
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({
          provider: provider || 'email',
          email_verified: provider !== 'email', // Social logins are pre-verified
          updated_at: new Date().toISOString(),
        })
        .eq('id', emailUser.id)
        .select()
        .single()

      if (updateError) {
        throw updateError
      }

      return NextResponse.json({ success: true, user: updatedUser })
    }

    // Create new user with id matching Supabase Auth user id
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        id: auth_user_id,
        email,
        provider: provider || 'email',
        email_verified: provider !== 'email', // Social logins are pre-verified
        license_key: '', // Will be set later
        notion_setup_complete: false,
        onboarding_complete: false,
      })
      .select()
      .single()

    if (insertError) {
      // If it's a duplicate key error, user was just created - fetch it
      if (insertError.code === '23505') {
        const { data: fetchedUser } = await supabase
          .from('users')
          .select('*')
          .eq('id', auth_user_id)
          .single()
        
        if (fetchedUser) {
          return NextResponse.json({ success: true, user: fetchedUser })
        }
      }
      throw insertError
    }

    return NextResponse.json({ success: true, user: newUser })
  } catch (error: any) {
    console.error('Error syncing user:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to sync user' },
      { status: 500 }
    )
  }
}

