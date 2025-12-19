import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { stripe } from '@/lib/stripe';
import { issueAccessToken } from '@/lib/oauth';
import { verifyWebsiteToken } from '@/lib/jwt';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

/**
 * User-facing License Activation Endpoint
 * POST /api/activate-license
 * 
 * Allows users to manually activate their license using a Stripe session ID or payment intent ID.
 * This is useful when the webhook fails.
 * 
 * Body: { sessionId?: string, paymentIntentId?: string }
 */
export async function POST(request: NextRequest) {
  try {
    // Get auth token
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || 
                 request.cookies.get('sb-access-token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in' },
        { status: 401 }
      );
    }

    // Verify token and get user ID
    const websiteTokenPayload = verifyWebsiteToken(token);
    let authUserId: string | null = null;

    if (websiteTokenPayload) {
      authUserId = websiteTokenPayload.sub;
    } else {
      // Fall back to Supabase session
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { data: { user: authUser } } = await supabase.auth.getUser(token);
      
      if (!authUser) {
        return NextResponse.json(
          { error: 'Invalid token' },
          { status: 401 }
        );
      }
      authUserId = authUser.id;
    }

    if (!authUserId) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    const { sessionId, paymentIntentId: providedPaymentIntentId } = await request.json();

    if (!sessionId && !providedPaymentIntentId) {
      return NextResponse.json(
        { error: 'Either sessionId or paymentIntentId is required' },
        { status: 400 }
      );
    }

    if (!stripe) {
      return NextResponse.json(
        { error: 'Stripe not configured' },
        { status: 500 }
      );
    }

    let paymentIntent: Stripe.PaymentIntent;
    let session: Stripe.Checkout.Session | null = null;
    let paymentIntentId: string;

    // If sessionId provided, retrieve session first
    if (sessionId) {
      try {
        session = await stripe.checkout.sessions.retrieve(sessionId);
        const sessionPaymentIntentId = session.payment_intent as string;
        
        if (!sessionPaymentIntentId) {
          return NextResponse.json(
            { error: 'Session does not have a payment intent' },
            { status: 400 }
          );
        }

        // Verify the session belongs to this user
        if (session.metadata?.user_id !== authUserId) {
          return NextResponse.json(
            { error: 'This session does not belong to you' },
            { status: 403 }
          );
        }

        paymentIntentId = sessionPaymentIntentId;
      } catch (error: any) {
        console.error('[Activate License] Error retrieving session:', error);
        return NextResponse.json(
          { error: `Failed to retrieve session: ${error.message}` },
          { status: 400 }
        );
      }
    } else {
      // Use provided payment intent ID if no session ID
      if (!providedPaymentIntentId) {
        return NextResponse.json(
          { error: 'Either sessionId or paymentIntentId is required' },
          { status: 400 }
        );
      }
      paymentIntentId = providedPaymentIntentId;
    }

    // Retrieve payment intent
    try {
      paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error: any) {
      console.error('[Activate License] Error retrieving payment intent:', error);
      return NextResponse.json(
        { error: `Failed to retrieve payment intent: ${error.message}` },
        { status: 400 }
      );
    }

    // Verify payment was successful
    if (paymentIntent.status !== 'succeeded') {
      return NextResponse.json(
        { error: `Payment status is ${paymentIntent.status}, not succeeded` },
        { status: 400 }
      );
    }

    // Verify the payment intent belongs to this user
    const paymentUserId = paymentIntent.metadata?.user_id || session?.metadata?.user_id;
    if (paymentUserId && paymentUserId !== authUserId) {
      return NextResponse.json(
        { error: 'This payment does not belong to you' },
        { status: 403 }
      );
    }

    const supabase = createServerClient();

    // Check if user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', authUserId)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
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
      // Update user's license_key in case it's missing
      await supabase
        .from('users')
        .update({ license_key: paymentIntentId })
        .eq('id', authUserId);

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
      console.error('[Activate License] Error creating/updating license:', licenseError);
      return NextResponse.json(
        { error: `License creation failed: ${licenseError.message}` },
        { status: 500 }
      );
    }

    // Update user's license_key field
    const { error: updateUserError } = await supabase
      .from('users')
      .update({ license_key: paymentIntentId })
      .eq('id', authUserId);

    if (updateUserError) {
      console.error('[Activate License] Error updating user license_key:', updateUserError);
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
      await issueAccessToken(authUserId, ALEXA_CLIENT_ID, 'alexa');
      console.log('[Activate License] Opaque token generated successfully');
    } catch (tokenError: any) {
      console.error('[Activate License] Error generating token (non-critical):', tokenError);
      // Don't fail if token generation fails
    }

    console.log('[Activate License] License activated successfully:', {
      payment_intent_id: paymentIntentId,
      user_id: authUserId,
    });

    return NextResponse.json({
      success: true,
      message: 'License activated successfully',
      license_key: paymentIntentId,
    });
  } catch (error: any) {
    console.error('[Activate License] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

