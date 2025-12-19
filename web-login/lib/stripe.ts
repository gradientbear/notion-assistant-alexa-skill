import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

// Stripe will be null if STRIPE_SECRET_KEY is not set

export const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

/**
 * Verify Stripe webhook signature
 * 
 * IMPORTANT: The payload must be the exact raw bytes that Stripe sent.
 * Do not parse as JSON or modify the body in any way before calling this function.
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string
): Stripe.Event | null {
  if (!stripe || !stripeWebhookSecret) {
    throw new Error('Stripe not configured. Please set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET environment variables.');
  }

  try {
    // Stripe requires the exact raw bytes for signature verification
    // If payload is already a Buffer, use it directly
    // If it's a string, convert to Buffer using 'utf8' encoding
    // Note: We must use the exact encoding that Stripe used (typically utf8)
    const payloadBuffer = Buffer.isBuffer(payload) 
      ? payload 
      : Buffer.from(payload, 'utf8');
    
    // Stripe's constructEvent expects a Buffer or string
    // Passing Buffer directly is preferred to preserve exact bytes
    const event = stripe.webhooks.constructEvent(
      payloadBuffer,
      signature,
      stripeWebhookSecret
    );
    return event;
  } catch (error: any) {
    console.error('[Stripe] Webhook signature verification failed:', error.message);
    console.error('[Stripe] Error details:', {
      message: error.message,
      type: error.type,
      signatureLength: signature?.length,
      payloadLength: Buffer.isBuffer(payload) ? payload.length : payload.length,
      payloadType: Buffer.isBuffer(payload) ? 'Buffer' : 'string',
      webhookSecretSet: !!stripeWebhookSecret,
      webhookSecretLength: stripeWebhookSecret?.length || 0,
    });
    
    // Additional debugging: check if webhook secret format is correct
    if (stripeWebhookSecret && !stripeWebhookSecret.startsWith('whsec_')) {
      console.error('[Stripe] WARNING: Webhook secret does not start with "whsec_" - this might be incorrect');
    }
    
    return null;
  }
}

/**
 * Create a one-time checkout session
 */
export async function createCheckoutSession(params: {
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  metadata?: Record<string, string>;
}): Promise<Stripe.Checkout.Session | null> {
  if (!stripe) {
    throw new Error('Stripe not configured. Please set STRIPE_SECRET_KEY environment variable.');
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment', // One-time payment
      payment_method_types: ['card'],
      line_items: [
        {
          price: params.priceId,
          quantity: 1,
        },
      ],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      customer_email: params.customerEmail,
      metadata: params.metadata || {},
      // Pass metadata to payment intent so it's available in webhook events
      payment_intent_data: {
        metadata: params.metadata || {},
      },
    });

    return session;
  } catch (error: any) {
    console.error('[Stripe] Error creating checkout session:', error);
    throw error;
  }
}

/**
 * Get payment intent details
 */
export async function getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent | null> {
  if (!stripe) {
    throw new Error('Stripe not configured. Please set STRIPE_SECRET_KEY environment variable.');
  }

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return paymentIntent;
  } catch (error: any) {
    console.error('[Stripe] Error retrieving payment intent:', error);
    return null;
  }
}

