import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/stripe';
import { revokeUserTokens, issueAccessToken } from '@/lib/oauth';
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
        const userId = paymentIntent.metadata?.user_id;
        const paymentIntentId = paymentIntent.id; // Use payment intent ID as license key

        if (!userId) {
          console.error('[Stripe Webhook] Missing user_id in payment intent metadata');
          break;
        }

        // Get user record
        const { data: user, error: userError } = await supabase
          .from('users')
          .select('id, email')
          .eq('id', userId)
          .single();

        if (userError || !user) {
          console.error('[Stripe Webhook] User not found:', userId);
          break;
        }

        // Create or update license record using payment_intent.id as primary key
        const { error: licenseError } = await supabase
          .from('licenses')
          .upsert({
            stripe_payment_intent_id: paymentIntentId,
            license_key: paymentIntentId, // Store payment intent ID as license key for backward compatibility
            status: 'active',
            stripe_customer_id: paymentIntent.customer as string || null,
            amount_paid: paymentIntent.amount ? paymentIntent.amount / 100 : null, // Convert cents to dollars
            currency: paymentIntent.currency || 'usd',
            purchase_date: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'stripe_payment_intent_id',
          });

        if (licenseError) {
          console.error('[Stripe Webhook] Error creating/updating license:', licenseError);
        } else {
          console.log('[Stripe Webhook] License activated:', paymentIntentId);
        }

        // Update user's license_key field
        const { error: updateUserError } = await supabase
          .from('users')
          .update({ license_key: paymentIntentId })
          .eq('id', userId);

        if (updateUserError) {
          console.error('[Stripe Webhook] Error updating user license_key:', updateUserError);
        }

        // Generate opaque Alexa token
        try {
          const ALEXA_CLIENT_ID = process.env.ALEXA_OAUTH_CLIENT_ID || 'voice-planner';
          const tokenResult = await issueAccessToken(
            userId,
            ALEXA_CLIENT_ID,
            'alexa'
          );

          console.log('[Stripe Webhook] Generated opaque token for user:', userId);
        } catch (tokenError: any) {
          console.error('[Stripe Webhook] Error generating token:', tokenError);
          // Don't fail the webhook if token generation fails
        }

        break;
      }

      case 'charge.refunded':
      case 'payment_intent.canceled': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent | Stripe.Charge;
        const paymentIntentId = (paymentIntent as any).id || 
                                 (paymentIntent as any).payment_intent?.id;
        const userId = (paymentIntent as any).metadata?.user_id ||
                       (paymentIntent as any).payment_intent?.metadata?.user_id;

        if (paymentIntentId) {
          // Deactivate license using stripe_payment_intent_id
          const { error: licenseError } = await supabase
            .from('licenses')
            .update({ status: 'inactive', updated_at: new Date().toISOString() })
            .eq('stripe_payment_intent_id', paymentIntentId);

          if (licenseError) {
            console.error('[Stripe Webhook] Error deactivating license:', licenseError);
          } else {
            console.log('[Stripe Webhook] License deactivated:', paymentIntentId);
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
            // Find all users with this license (stored in license_key field) and revoke their tokens
            const { data: users } = await supabase
              .from('users')
              .select('id')
              .eq('license_key', paymentIntentId);

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

          // Clear license_key from users
          await supabase
            .from('users')
            .update({ license_key: null })
            .eq('license_key', paymentIntentId);
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

