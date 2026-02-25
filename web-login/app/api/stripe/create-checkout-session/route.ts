import { NextRequest, NextResponse } from 'next/server';
import { createCheckoutSession } from '@/lib/stripe';
import { createServerClient } from '@/lib/supabase';
import { verifyWebsiteToken } from '@/lib/jwt';
import { createClient } from '@supabase/supabase-js';

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

    // Try to verify as website JWT first (new approach)
    // This supports tokens that don't expire like Supabase sessions do
    const websiteTokenPayload = verifyWebsiteToken(sessionToken);
    let authUserId: string | null = null;

    if (websiteTokenPayload) {
      // Website JWT token - extract user ID from payload
      authUserId = websiteTokenPayload.sub;
    } else {
      // Fall back to Supabase session token (backward compatibility)
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseAnonKey) {
        return NextResponse.json(
          { error: 'server_error', error_description: 'Server configuration error' },
          { status: 500 }
        );
      }

      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(sessionToken);

      if (authError || !authUser) {
        return NextResponse.json(
          { error: 'unauthorized', error_description: 'Invalid session' },
          { status: 401 }
        );
      }

      authUserId = authUser.id;
    }

    if (!authUserId) {
      return NextResponse.json(
        { error: 'unauthorized', error_description: 'Invalid session' },
        { status: 401 }
      );
    }

    // Check if user already has an active license before allowing purchase
    const supabase = createServerClient();
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUserId)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'server_error', error_description: 'User not found' },
        { status: 500 }
      );
    }

    // Check if user already has an active license
    // Check for active opaque token (indicates license is active)
    const { data: activeToken } = await supabase
      .from('oauth_access_tokens')
      .select('token, expires_at, revoked')
      .eq('user_id', user.id)
      .eq('revoked', false)
      .gt('expires_at', new Date().toISOString())
      .limit(1)
      .maybeSingle();

    if (activeToken) {
      return NextResponse.json(
        { error: 'already_purchased', error_description: 'You already have an active license. No need to purchase again.' },
        { status: 400 }
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

    // Validate price ID format (should start with 'price_')
    if (!priceId.startsWith('price_')) {
      return NextResponse.json(
        { 
          error: 'invalid_request', 
          error_description: `Invalid Stripe price ID format. Expected format: 'price_...', got: '${priceId.substring(0, 20)}...'` 
        },
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

