import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/stripe';
import { revokeUserTokens } from '@/lib/oauth';
import { createServerClient } from '@/lib/supabase';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

/**
 * Stripe Webhook Endpoint
 * POST /api/webhooks/stripe
 * 
 * Handles Stripe webhook events:
 * - payment_intent.succeeded: Activate license
 * - charge.refunded: Deactivate license and revoke tokens
 * - payment_intent.payment_failed: Handle failed payment
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    // Verify webhook signature
    const event = verifyWebhookSignature(body, signature);

    if (!event) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Handle different event types
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const licenseKey = paymentIntent.metadata?.license_key;
        const userId = paymentIntent.metadata?.user_id;

        if (licenseKey) {
          // Activate license
          const { error } = await supabase
            .from('licenses')
            .update({ status: 'active', updated_at: new Date().toISOString() })
            .eq('license_key', licenseKey);

          if (error) {
            console.error('[Stripe Webhook] Error activating license:', error);
          } else {
            console.log('[Stripe Webhook] License activated:', licenseKey);
          }
        }

        break;
      }

      case 'charge.refunded':
      case 'payment_intent.canceled': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent | Stripe.Charge;
        const licenseKey = (paymentIntent as any).metadata?.license_key || 
                          (paymentIntent as any).payment_intent?.metadata?.license_key;
        const userId = (paymentIntent as any).metadata?.user_id ||
                       (paymentIntent as any).payment_intent?.metadata?.user_id;

        if (licenseKey) {
          // Deactivate license
          const { error: licenseError } = await supabase
            .from('licenses')
            .update({ status: 'inactive', updated_at: new Date().toISOString() })
            .eq('license_key', licenseKey);

          if (licenseError) {
            console.error('[Stripe Webhook] Error deactivating license:', licenseError);
          } else {
            console.log('[Stripe Webhook] License deactivated:', licenseKey);
          }

          // Revoke all tokens for users with this license
          if (userId) {
            try {
              await revokeUserTokens(userId);
              console.log('[Stripe Webhook] Tokens revoked for user:', userId);
            } catch (revokeError) {
              console.error('[Stripe Webhook] Error revoking tokens:', revokeError);
            }
          } else {
            // Find all users with this license and revoke their tokens
            const { data: users } = await supabase
              .from('users')
              .select('id')
              .eq('license_key', licenseKey);

            if (users) {
              for (const user of users) {
                try {
                  await revokeUserTokens(user.id);
                } catch (revokeError) {
                  console.error('[Stripe Webhook] Error revoking tokens for user:', user.id, revokeError);
                }
              }
            }
          }
        }

        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('[Stripe Webhook] Payment failed:', paymentIntent.id);
        // Optionally notify user or log for review
        break;
      }

      default:
        console.log('[Stripe Webhook] Unhandled event type:', event.type);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('[Stripe Webhook] Error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

