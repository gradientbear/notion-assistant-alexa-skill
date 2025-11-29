# Stripe Payment Integration Setup

This guide explains how to set up Stripe for one-time license purchases.

## Table of Contents

1. [Create Stripe Account](#create-stripe-account)
2. [Create Product and Price](#create-product-and-price)
3. [Configure Webhook](#configure-webhook)
4. [Get API Keys](#get-api-keys)
5. [Test Integration](#test-integration)

## Create Stripe Account

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Sign up or log in
3. Complete account verification

## Create Product and Price

### Option 1: Via Dashboard

1. Go to **Products** → **Add Product**
2. Fill in:
   - **Name**: "Notion Data Alexa Skill License"
   - **Description**: "One-time license for Notion Data Alexa Skill"
   - **Pricing**: Set your price (e.g., $9.99)
   - **Billing**: One time
3. Click **Save**
4. Copy the **Price ID** (starts with `price_`)

### Option 2: Via API

```bash
curl https://api.stripe.com/v1/products \
  -u sk_live_YOUR_SECRET_KEY: \
  -d name="Notion Data Alexa Skill License" \
  -d description="One-time license"

curl https://api.stripe.com/v1/prices \
  -u sk_live_YOUR_SECRET_KEY: \
  -d product=prod_YOUR_PRODUCT_ID \
  -d unit_amount=999 \
  -d currency=usd
```

## Configure Webhook

### 1. Create Webhook Endpoint

1. Go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Enter endpoint URL:
   ```
   https://notion-data-user.vercel.app/api/webhooks/stripe
   ```
4. Select events to listen to:
   - `payment_intent.succeeded`
   - `charge.refunded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
5. Click **Add endpoint**
6. Copy the **Signing secret** (starts with `whsec_`)

### 2. Add to Environment Variables

Add to Vercel:
```bash
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Get API Keys

1. Go to **Developers** → **API keys**
2. Copy:
   - **Publishable key** (starts with `pk_`) - for frontend
   - **Secret key** (starts with `sk_`) - for backend

### Add to Environment Variables

**Vercel:**
```bash
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

**Note:** Use test keys (`sk_test_`, `pk_test_`) for development.

## Test Integration

### 1. Test Checkout Session Creation

```bash
curl -X POST "https://notion-data-user.vercel.app/api/stripe/create-checkout-session" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "priceId": "price_YOUR_PRICE_ID",
    "successUrl": "https://notion-data-user.vercel.app/success",
    "cancelUrl": "https://notion-data-user.vercel.app/cancel"
  }'
```

### 2. Test Webhook (Using Stripe CLI)

```bash
# Install Stripe CLI
# https://stripe.com/docs/stripe-cli

# Forward webhooks to local endpoint
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Trigger test event
stripe trigger payment_intent.succeeded
```

### 3. Test Payment Flow

1. Create checkout session via API
2. Redirect user to `session.url`
3. Complete test payment (use card `4242 4242 4242 4242`)
4. Verify webhook received
5. Check `licenses` table - status should be `active`

## Webhook Event Handling

The webhook handler processes:

- **payment_intent.succeeded**: Activates license
- **charge.refunded**: Deactivates license, revokes tokens
- **payment_intent.payment_failed**: Logs for review
- **payment_intent.canceled**: Deactivates license, revokes tokens

## Metadata Requirements

When creating checkout sessions, include metadata:

```json
{
  "user_id": "uuid",
  "license_key": "LICENSE-XXX",
  "email": "user@example.com"
}
```

This allows the webhook to:
1. Activate the correct license
2. Revoke tokens for the correct user
3. Send confirmation emails

## Production Checklist

- [ ] Use live API keys (not test keys)
- [ ] Webhook endpoint is HTTPS
- [ ] Webhook signing secret is set
- [ ] Test all webhook events
- [ ] Set up monitoring/alerts
- [ ] Document refund process
- [ ] Test license activation flow
- [ ] Test token revocation on refund

## Troubleshooting

### Webhook not receiving events

1. Check webhook URL is correct
2. Verify endpoint is accessible (not behind firewall)
3. Check Stripe dashboard for delivery logs
4. Verify webhook secret matches

### License not activating

1. Check webhook logs in Vercel
2. Verify metadata includes `license_key`
3. Check `licenses` table for matching key
4. Review webhook event payload

### Tokens not revoking

1. Check webhook handler logs
2. Verify `revokeUserTokens()` is called
3. Check `oauth_access_tokens` table
4. Verify user_id mapping is correct

