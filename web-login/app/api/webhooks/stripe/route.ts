import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature, stripe } from '@/lib/stripe';
import { revokeUserTokens, issueAccessToken } from '@/lib/oauth';
import { createServerClient } from '@/lib/supabase';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // Use Node.js runtime for better Buffer support

/**
 * Stripe Webhook Endpoint
 * POST /api/webhooks/stripe
 * 
 * Handles Stripe webhook events:
 * - checkout.session.completed: Activate license (for Checkout Sessions)
 * - payment_intent.succeeded: Activate license (direct payment intents)
 * - charge.refunded: Deactivate license and revoke tokens
 * - payment_intent.canceled: Deactivate license and revoke tokens
 * - payment_intent.payment_failed: Handle failed payment
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[Stripe Webhook] Webhook received');
    
    // Get raw body as Buffer - this is critical for signature verification
    // Stripe requires the exact raw body bytes, not a parsed JSON object
    // We must preserve the exact bytes that Stripe sent
    let bodyBuffer: Buffer;
    try {
      // Get as array buffer first to preserve exact bytes
      const arrayBuffer = await request.arrayBuffer();
      bodyBuffer = Buffer.from(arrayBuffer);
    } catch (error) {
      // Fallback to text() if arrayBuffer() fails, but this is less ideal
      console.warn('[Stripe Webhook] Failed to get arrayBuffer, using text() fallback');
      const bodyText = await request.text();
      bodyBuffer = Buffer.from(bodyText, 'utf8');
    }
    
    const signature = request.headers.get('stripe-signature');

    console.log('[Stripe Webhook] Headers:', {
      hasSignature: !!signature,
      signatureLength: signature?.length || 0,
      bodyLength: bodyBuffer.length,
      bodyPreview: bodyBuffer.toString('utf8').substring(0, 100),
      hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
      webhookSecretPrefix: process.env.STRIPE_WEBHOOK_SECRET?.substring(0, 10) || 'NOT SET',
    });

    if (!signature) {
      console.error('[Stripe Webhook] Missing stripe-signature header');
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.error('[Stripe Webhook] STRIPE_WEBHOOK_SECRET environment variable is not set');
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    // Verify webhook signature - pass Buffer directly
    console.log('[Stripe Webhook] Verifying signature...');
    const event = verifyWebhookSignature(bodyBuffer, signature);

    if (!event) {
      console.error('[Stripe Webhook] Invalid signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Helper function to activate license (idempotent)
    async function activateLicense(
      paymentIntentId: string,
      userId: string,
      paymentIntent?: Stripe.PaymentIntent,
      session?: Stripe.Checkout.Session
    ): Promise<{ success: boolean; error?: string }> {
      try {
        // Check if license already exists and is active (idempotency check)
        const { data: existingLicense } = await supabase
          .from('licenses')
          .select('status')
          .eq('stripe_payment_intent_id', paymentIntentId)
          .maybeSingle();

        if (existingLicense && existingLicense.status === 'active') {
          console.log('[Stripe Webhook] License already active, skipping activation:', paymentIntentId);
          // Still update user's license_key in case it's missing
          await supabase
            .from('users')
            .update({ license_key: paymentIntentId })
            .eq('id', userId);
          return { success: true };
        }

        // Get user record (with retry for race conditions)
        let user;
        let retries = 3;
        while (retries > 0) {
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id, email')
            .eq('id', userId)
            .single();

          if (!userError && userData) {
            user = userData;
            break;
          }

          if (userError && userError.code !== 'PGRST116') {
            // Not a "not found" error, fail immediately
            console.error('[Stripe Webhook] Error fetching user:', userError);
            return { success: false, error: `User fetch error: ${userError.message}` };
          }

          // User not found - wait and retry (race condition: user might be created soon)
          console.log(`[Stripe Webhook] User not found, retrying... (${retries} attempts left)`);
          retries--;
          if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
          }
        }

        if (!user) {
          return { success: false, error: `User ${userId} not found after retries` };
        }

        // Prepare license data
        const licenseData: any = {
          stripe_payment_intent_id: paymentIntentId,
          license_key: paymentIntentId, // Store payment intent ID as license key for backward compatibility
          status: 'active',
          purchase_date: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // Add payment intent data if available
        if (paymentIntent) {
          licenseData.stripe_customer_id = paymentIntent.customer as string || null;
          licenseData.amount_paid = paymentIntent.amount ? paymentIntent.amount / 100 : null;
          licenseData.currency = paymentIntent.currency || 'usd';
        } else if (session) {
          // Fallback to session data
          licenseData.stripe_customer_id = session.customer as string || null;
          licenseData.amount_paid = session.amount_total ? session.amount_total / 100 : null;
          licenseData.currency = session.currency || 'usd';
        }

        // Create or update license record (idempotent upsert)
        const { error: licenseError } = await supabase
          .from('licenses')
          .upsert(licenseData, {
            onConflict: 'stripe_payment_intent_id',
          });

        if (licenseError) {
          console.error('[Stripe Webhook] Error creating/updating license:', licenseError);
          return { success: false, error: `License creation failed: ${licenseError.message}` };
        }

        // Update user's license_key field (critical - must succeed)
        const { error: updateUserError } = await supabase
          .from('users')
          .update({ license_key: paymentIntentId })
          .eq('id', userId);

        if (updateUserError) {
          console.error('[Stripe Webhook] Error updating user license_key:', updateUserError);
          // This is critical - if this fails, license validation will fail
          // Try to rollback license status
          await supabase
            .from('licenses')
            .update({ status: 'inactive' })
            .eq('stripe_payment_intent_id', paymentIntentId);
          return { success: false, error: `User update failed: ${updateUserError.message}` };
        }

        console.log('[Stripe Webhook] License activated successfully:', {
          payment_intent_id: paymentIntentId,
          user_id: userId,
        });

        // Generate opaque Alexa token (non-critical, don't fail if this errors)
        try {
          const ALEXA_CLIENT_ID = process.env.ALEXA_OAUTH_CLIENT_ID || 'voice-planner';
          await issueAccessToken(userId, ALEXA_CLIENT_ID, 'alexa');
        } catch (tokenError: any) {
          console.error('[Stripe Webhook] Error generating token (non-critical):', tokenError);
          // Don't fail the webhook if token generation fails
        }

        return { success: true };
      } catch (error: any) {
        console.error('[Stripe Webhook] Unexpected error in activateLicense:', error);
        return { success: false, error: error.message || 'Unknown error' };
      }
    }

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        // Handle Checkout Session completion (primary event for Checkout Sessions)
        const session = event.data.object as Stripe.Checkout.Session;
        const paymentIntentId = session.payment_intent as string;
        const userId = session.metadata?.user_id;

        if (!paymentIntentId) {
          console.error('[Stripe Webhook] Missing payment_intent in checkout session');
          // Return error so Stripe retries
          return NextResponse.json(
            { error: 'Missing payment_intent' },
            { status: 400 }
          );
        }

        if (!userId) {
          console.error('[Stripe Webhook] Missing user_id in checkout session metadata');
          return NextResponse.json(
            { error: 'Missing user_id' },
            { status: 400 }
          );
        }

        // Try to retrieve payment intent for full details (but don't fail if unavailable)
        let paymentIntent: Stripe.PaymentIntent | undefined;
        if (stripe) {
          try {
            paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
          } catch (error: any) {
            console.warn('[Stripe Webhook] Could not retrieve payment intent, using session data:', error.message);
            // Continue with session data only
          }
        }

        // Activate license (handles idempotency and race conditions)
        const result = await activateLicense(paymentIntentId, userId, paymentIntent, session);
        
        if (!result.success) {
          console.error('[Stripe Webhook] Failed to activate license:', result.error);
          // Return error so Stripe retries
          return NextResponse.json(
            { error: result.error || 'Failed to activate license' },
            { status: 500 }
          );
        }

        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const userId = paymentIntent.metadata?.user_id;
        const paymentIntentId = paymentIntent.id;

        if (!userId) {
          console.error('[Stripe Webhook] Missing user_id in payment intent metadata');
          return NextResponse.json(
            { error: 'Missing user_id' },
            { status: 400 }
          );
        }

        // Activate license (handles idempotency and race conditions)
        const result = await activateLicense(paymentIntentId, userId, paymentIntent);
        
        if (!result.success) {
          console.error('[Stripe Webhook] Failed to activate license:', result.error);
          // Return error so Stripe retries
          return NextResponse.json(
            { error: result.error || 'Failed to activate license' },
            { status: 500 }
          );
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
          }

          // Revoke all tokens for users with this license
          if (userId) {
            try {
              await revokeUserTokens(userId);
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
        // Payment failed - optionally notify user or log for review
        break;
      }

      default:
        // Unhandled event type
        break;
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

