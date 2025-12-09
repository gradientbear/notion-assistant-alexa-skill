# Stripe Payment Bug Fix - Root Cause Analysis & Solution

## 🔍 Root Causes Identified

### 1. **Race Condition in Webhook Handler** (CRITICAL)
**Problem**: The `checkout.session.completed` event handler tried to retrieve the `payment_intent`, but if it failed (e.g., payment_intent not yet available), it would just `break` without creating the license. This meant:
- License was never created in the `licenses` table
- `users.license_key` was never updated
- User appeared as unpaid even after successful payment

**Location**: `web-login/app/api/webhooks/stripe/route.ts` (lines 66-151)

### 2. **Missing Error Handling & Retry Logic** (CRITICAL)
**Problem**: When webhook operations failed, the handler:
- Logged errors but still returned HTTP 200
- Stripe interpreted this as success and **never retried**
- Failed payments were permanently lost

**Impact**: If database was temporarily unavailable or user didn't exist yet, the payment would fail silently.

### 3. **User Not Found Race Condition** (HIGH)
**Problem**: If the webhook fired before the user was created in the database (e.g., during signup), it would fail immediately without retrying.

**Location**: `web-login/app/api/webhooks/stripe/route.ts` (lines 97-106, 165-174)

### 4. **No Idempotency Checks** (MEDIUM)
**Problem**: If both `checkout.session.completed` and `payment_intent.succeeded` events fired, the license could be created twice or operations could conflict.

### 5. **Inconsistent Error Responses** (MEDIUM)
**Problem**: Some errors returned HTTP 200 (success), others returned error codes. This confused Stripe's retry mechanism.

## ✅ Solutions Implemented

### 1. **Unified License Activation Function**
Created a robust `activateLicense()` helper function that:
- ✅ Handles idempotency (checks if license already exists and is active)
- ✅ Retries user lookup (handles race conditions where user might not exist yet)
- ✅ Ensures atomic operations (license creation + user update)
- ✅ Returns proper error codes for Stripe retries
- ✅ Handles missing payment_intent gracefully (uses session data as fallback)

### 2. **Proper Error Handling**
- ✅ Returns HTTP 400/500 for failures (so Stripe retries)
- ✅ Only returns HTTP 200 when license is successfully activated
- ✅ Logs all errors with context for debugging

### 3. **Race Condition Handling**
- ✅ Retries user lookup up to 3 times with 1-second delays
- ✅ Handles case where payment_intent might not be immediately available
- ✅ Falls back to session data if payment_intent retrieval fails

### 4. **Idempotency**
- ✅ Checks if license already exists and is active before creating
- ✅ Uses `upsert` with `onConflict` to handle duplicate events safely
- ✅ Prevents duplicate license creation from multiple webhook events

### 5. **Transaction Safety**
- ✅ Updates `users.license_key` immediately after license creation
- ✅ If user update fails, rolls back license status to prevent inconsistent state
- ✅ Ensures both operations succeed or both fail

## 📋 Database Structure Verification

### ✅ Correct Structure
```sql
-- licenses table
stripe_payment_intent_id VARCHAR(255) PRIMARY KEY  -- Stores payment intent ID
license_key VARCHAR(255)                           -- Also stores payment intent ID (backward compat)
status VARCHAR(20) DEFAULT 'active'                 -- Must be 'active' for valid license

-- users table
license_key VARCHAR(255)                            -- Stores stripe_payment_intent_id
```

### ✅ Workflow Confirmation
1. **Checkout Creation**: Creates session with `user_id` in metadata ✅
2. **Webhook Processing**: 
   - Receives `checkout.session.completed` or `payment_intent.succeeded` ✅
   - Creates license with `stripe_payment_intent_id` as PK ✅
   - Updates `users.license_key = stripe_payment_intent_id` ✅
3. **License Validation**:
   - Checks `user.license_key` exists ✅
   - Queries `licenses` where `stripe_payment_intent_id = user.license_key` ✅
   - Verifies `status = 'active'` ✅

## 🔧 Files Modified

### `web-login/app/api/webhooks/stripe/route.ts`
**Changes**:
- Added `activateLicense()` helper function with:
  - Idempotency checks
  - Retry logic for user lookup
  - Proper error handling
  - Transaction safety
- Updated `checkout.session.completed` handler to use new function
- Updated `payment_intent.succeeded` handler to use new function
- Both handlers now return proper error codes for Stripe retries

## 🧪 Testing Checklist

### Test Scenarios
- [ ] **Normal Payment Flow**: User pays → webhook fires → license created → user can link Alexa
- [ ] **Race Condition**: Webhook fires before user exists → should retry and succeed
- [ ] **Duplicate Events**: Both `checkout.session.completed` and `payment_intent.succeeded` fire → should handle idempotently
- [ ] **Payment Intent Unavailable**: `checkout.session.completed` fires but payment_intent not yet available → should use session data
- [ ] **Database Error**: Temporary database unavailability → should return 500 so Stripe retries
- [ ] **Already Active License**: Webhook fires for already-activated license → should skip gracefully

### Verification Steps
1. Make a test payment in Stripe test mode
2. Check webhook logs in Vercel/your hosting platform
3. Verify in Supabase:
   ```sql
   -- Check license was created
   SELECT * FROM licenses WHERE stripe_payment_intent_id = 'pi_...';
   
   -- Check user license_key was updated
   SELECT id, license_key FROM users WHERE id = '...';
   
   -- Verify they match
   SELECT u.id, u.license_key, l.status 
   FROM users u
   JOIN licenses l ON l.stripe_payment_intent_id = u.license_key
   WHERE u.id = '...';
   ```
4. Try linking Alexa account → should succeed if license is active

## 🚨 Important Notes

### Webhook Secret Configuration
**CRITICAL**: Ensure you're using the correct webhook secret:
- **Test Mode**: Use test mode webhook secret (`whsec_...` from Stripe Dashboard → Webhooks → Test mode)
- **Live Mode**: Use live mode webhook secret (`whsec_...` from Stripe Dashboard → Webhooks → Live mode)

**Environment Variable**: `STRIPE_WEBHOOK_SECRET` must match the mode of your `STRIPE_SECRET_KEY`

### Stripe Event Types
The webhook now handles:
- ✅ `checkout.session.completed` (primary for Checkout Sessions)
- ✅ `payment_intent.succeeded` (fallback/direct payment intents)
- ✅ `charge.refunded` (deactivates license)
- ✅ `payment_intent.canceled` (deactivates license)

### Idempotency
The webhook is now **idempotent** - you can safely retry failed webhooks or process duplicate events without creating duplicate licenses.

## 📊 Before vs After

### Before
```
Payment → Webhook Fires → Error (user not found) → Returns 200 → Stripe thinks success → License never created → User asked to pay again ❌
```

### After
```
Payment → Webhook Fires → Retry user lookup → Create license → Update user → Return 200 → License active ✅
```

## 🔄 Migration Notes

### For Existing Failed Payments
If you have users who paid but don't have licenses:

1. **Find affected users**:
   ```sql
   SELECT u.id, u.email, u.license_key, l.status
   FROM users u
   LEFT JOIN licenses l ON l.stripe_payment_intent_id = u.license_key
   WHERE u.license_key IS NOT NULL AND l.status IS NULL;
   ```

2. **Manually activate licenses** (if you have payment_intent_ids):
   ```sql
   INSERT INTO licenses (stripe_payment_intent_id, license_key, status, purchase_date)
   VALUES ('pi_...', 'pi_...', 'active', NOW())
   ON CONFLICT (stripe_payment_intent_id) DO UPDATE SET status = 'active';
   ```

3. **Or trigger webhook replay** in Stripe Dashboard → Webhooks → Select event → "Send test webhook"

## 📝 Summary

The root cause was **inadequate error handling and race condition management** in the webhook handler. The fix ensures:
1. ✅ Licenses are always created when payment succeeds
2. ✅ Users are always updated with the correct license_key
3. ✅ Race conditions are handled gracefully
4. ✅ Stripe retries failed webhooks automatically
5. ✅ Duplicate events are handled idempotently

The system should now reliably activate licenses for all successful payments.

