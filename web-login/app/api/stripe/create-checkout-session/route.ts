import { NextRequest, NextResponse } from 'next/server';
import { createCheckoutSession } from '@/lib/stripe';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Create Stripe Checkout Session
 * POST /api/stripe/create-checkout-session
 * 
 * Body:
 * - priceId: Stripe price ID
 * - successUrl: URL to redirect after successful payment
 * - cancelUrl: URL to redirect after canceled payment
 * - userId: Optional user ID for metadata
 * - licenseKey: Optional license key for metadata
 */
export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const authHeader = request.headers.get('authorization');
    const sessionToken = authHeader?.replace('Bearer ', '') || 
                        request.cookies.get('sb-access-token')?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { error: 'unauthorized', error_description: 'Authentication required' },
        { status: 401 }
      );
    }

    const supabase = createServerClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(sessionToken);

    if (authError || !authUser) {
      return NextResponse.json(
        { error: 'unauthorized', error_description: 'Invalid session' },
        { status: 401 }
      );
    }

    // Get user record
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('auth_user_id', authUser.id)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'server_error', error_description: 'User not found' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { priceId, successUrl, cancelUrl } = body;

    if (!priceId || !successUrl || !cancelUrl) {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Create checkout session
    // Note: license_key will be set to payment_intent.id by the webhook
    const session = await createCheckoutSession({
      priceId,
      successUrl,
      cancelUrl,
      customerEmail: user.email,
      metadata: {
        user_id: user.id,
        email: user.email,
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: 'server_error', error_description: 'Failed to create checkout session' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error: any) {
    console.error('[Stripe Checkout] Error:', error);
    return NextResponse.json(
      { error: 'server_error', error_description: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

