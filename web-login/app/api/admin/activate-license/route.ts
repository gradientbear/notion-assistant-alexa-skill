import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { stripe, getPaymentIntent } from '@/lib/stripe';
import { issueAccessToken } from '@/lib/oauth';

export const dynamic = 'force-dynamic';

/**
 * Manual License Activation Endpoint
 * POST /api/admin/activate-license
 * 
 * This endpoint allows manual activation of a license by verifying a Stripe payment intent.
 * Useful when webhook fails or for testing.
 * 
 * Body: { paymentIntentId: string, userId?: string }
 */
export async function POST(request: NextRequest) {
  try {
    // Get auth token to verify admin access (optional - you can add proper admin auth)
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized - Token required' },
        { status: 401 }
      );
    }

    const { paymentIntentId, userId } = await request.json();

    if (!paymentIntentId) {
      return NextResponse.json(
        { error: 'paymentIntentId is required' },
        { status: 400 }
      );
    }

    console.log('[Manual Activation] Processing:', { paymentIntentId, userId });

    // Verify payment intent with Stripe
    if (!stripe) {
      return NextResponse.json(
        { error: 'Stripe not configured' },
        { status: 500 }
      );
    }

    let paymentIntent: any;
    try {
      paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error: any) {
      console.error('[Manual Activation] Error retrieving payment intent:', error);
      return NextResponse.json(
        { error: `Failed to retrieve payment intent: ${error.message}` },
        { status: 400 }
      );
    }

    // Verify payment was successful
    if (paymentIntent.status !== 'succeeded') {
      return NextResponse.json(
        { error: `Payment intent status is ${paymentIntent.status}, not succeeded` },
        { status: 400 }
      );
    }

    // Get user ID from payment intent metadata or provided userId
    const targetUserId = userId || paymentIntent.metadata?.user_id;

    if (!targetUserId) {
      return NextResponse.json(
        { error: 'user_id not found in payment intent metadata and not provided' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Check if user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', targetUserId)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: `User not found: ${targetUserId}` },
        { status: 404 }
      );
    }

    // Check if license already exists and is active (idempotency)
    const { data: existingLicense } = await supabase
      .from('licenses')
      .select('status')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .maybeSingle();

    if (existingLicense && existingLicense.status === 'active') {
      console.log('[Manual Activation] License already active, updating user license_key if needed');
      // Update user's license_key in case it's missing
      await supabase
        .from('users')
        .update({ license_key: paymentIntentId })
        .eq('id', targetUserId);

      return NextResponse.json({
        success: true,
        message: 'License already active',
        license_key: paymentIntentId,
      });
    }

    // Prepare license data
    const licenseData: any = {
      stripe_payment_intent_id: paymentIntentId,
      license_key: paymentIntentId,
      status: 'active',
      purchase_date: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      stripe_customer_id: paymentIntent.customer as string || null,
      amount_paid: paymentIntent.amount ? paymentIntent.amount / 100 : null,
      currency: paymentIntent.currency || 'usd',
    };

    // Create or update license record
    const { error: licenseError } = await supabase
      .from('licenses')
      .upsert(licenseData, {
        onConflict: 'stripe_payment_intent_id',
      });

    if (licenseError) {
      console.error('[Manual Activation] Error creating/updating license:', licenseError);
      return NextResponse.json(
        { error: `License creation failed: ${licenseError.message}` },
        { status: 500 }
      );
    }

    // Update user's license_key field
    const { error: updateUserError } = await supabase
      .from('users')
      .update({ license_key: paymentIntentId })
      .eq('id', targetUserId);

    if (updateUserError) {
      console.error('[Manual Activation] Error updating user license_key:', updateUserError);
      // Try to rollback license status
      await supabase
        .from('licenses')
        .update({ status: 'inactive' })
        .eq('stripe_payment_intent_id', paymentIntentId);
      return NextResponse.json(
        { error: `User update failed: ${updateUserError.message}` },
        { status: 500 }
      );
    }

    // Generate opaque Alexa token
    try {
      const ALEXA_CLIENT_ID = process.env.ALEXA_OAUTH_CLIENT_ID || 'voice-planner';
      await issueAccessToken(targetUserId, ALEXA_CLIENT_ID, 'alexa');
      console.log('[Manual Activation] Opaque token generated successfully');
    } catch (tokenError: any) {
      console.error('[Manual Activation] Error generating token (non-critical):', tokenError);
      // Don't fail if token generation fails
    }

    console.log('[Manual Activation] License activated successfully:', {
      payment_intent_id: paymentIntentId,
      user_id: targetUserId,
    });

    return NextResponse.json({
      success: true,
      message: 'License activated successfully',
      license_key: paymentIntentId,
      user_id: targetUserId,
      payment_status: paymentIntent.status,
    });
  } catch (error: any) {
    console.error('[Manual Activation] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}












