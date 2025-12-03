import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

if (!stripeSecretKey) {
  console.warn('[Stripe] STRIPE_SECRET_KEY not set. Stripe features will be disabled.');
}

export const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

/**
 * Verify Stripe webhook signature
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string
): Stripe.Event | null {
  if (!stripe || !stripeWebhookSecret) {
    throw new Error('Stripe not configured');
  }

  try {
    const event = stripe.webhooks.constructEvent(payload, signature, stripeWebhookSecret);
    return event;
  } catch (error: any) {
    console.error('[Stripe] Webhook signature verification failed:', error.message);
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
    throw new Error('Stripe not configured');
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
    throw new Error('Stripe not configured');
  }

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return paymentIntent;
  } catch (error: any) {
    console.error('[Stripe] Error retrieving payment intent:', error);
    return null;
  }
}

