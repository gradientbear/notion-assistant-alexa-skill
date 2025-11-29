# OAuth2 JWT Migration Guide

This guide walks you through implementing OAuth2 Account Linking with JWT tokens, replacing the legacy base64 token system.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Environment Variables](#environment-variables)
4. [Database Migrations](#database-migrations)
5. [Deployment Steps](#deployment-steps)
6. [Alexa Developer Console Configuration](#alexa-developer-console-configuration)
7. [Migration Strategy](#migration-strategy)
8. [Testing](#testing)
9. [Troubleshooting](#troubleshooting)

## Overview

This migration implements:

- **OAuth2 Authorization Code Grant** flow for Alexa Account Linking
- **JWT access tokens** (HS256) replacing base64 tokens
- **Token introspection** endpoint for Lambda validation
- **Legacy token support** (30-day transition period)
- **Stripe payment integration** for license activation
- **Token revocation** on license deactivation

## Prerequisites

- Node.js 18+ installed
- Supabase project with existing `users`, `licenses`, `oauth_sessions` tables
- AWS Lambda function deployed
- Vercel (or similar) for Next.js deployment
- Stripe account (for payment integration)

## Environment Variables

### Next.js (Vercel)

Add these to your Vercel project settings:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# JWT
JWT_SECRET=your-secure-random-secret-min-32-chars
JWT_EXPIRES_IN=3600
APP_ISS=https://notion-data-user.vercel.app

# OAuth2
ALEXA_OAUTH_CLIENT_ID=your-alexa-client-id
ALEXA_OAUTH_CLIENT_SECRET=your-alexa-client-secret
ALEXA_REDIRECT_URIS=https://layla.amazon.com/api/skill/link,https://pitangui.amazon.com/api/skill/link

# Stripe (optional)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
REFRESH_TOKEN_ENABLED=false
```

### AWS Lambda

Add these to your Lambda function environment variables:

```bash
# Supabase
SUPABASE_URL=https://[project-ref].supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# JWT
JWT_SECRET=your-secure-random-secret-min-32-chars
INTROSPECT_URL=https://notion-data-user.vercel.app/api/auth/introspect
LEGACY_TOKEN_SUPPORT=true  # Set to false after 30 days
```

## Database Migrations

### Step 1: Run OAuth Tables Migration

1. Open Supabase SQL Editor
2. Run `docs/migrations/20250101_add_oauth_tables.sql`
3. Verify tables were created:
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('oauth_authorization_codes', 'oauth_access_tokens', 'oauth_refresh_tokens');
   ```

### Step 2: Verify License Table

1. Run `docs/migrations/20250101_add_license_fields.sql`
2. Verify constraint exists:
   ```sql
   SELECT constraint_name FROM information_schema.table_constraints 
   WHERE table_name = 'licenses' AND constraint_name = 'licenses_status_check';
   ```

## Deployment Steps

### 1. Install Dependencies

```bash
cd web-login
npm install jsonwebtoken @types/jsonwebtoken stripe
```

### 2. Deploy Next.js API Routes

The following routes are automatically deployed with your Next.js app:

- `/api/oauth/authorize` - OAuth authorization endpoint
- `/api/oauth/token` - Token exchange endpoint
- `/api/auth/introspect` - Token introspection endpoint
- `/api/auth/revoke` - Token revocation endpoint
- `/api/webhooks/stripe` - Stripe webhook handler
- `/api/stripe/create-checkout-session` - Checkout session creation

### 3. Deploy Lambda Updates

1. Copy `lambda/src/middleware/auth.ts` to your Lambda project
2. Copy `lambda/src/utils/jwt.ts` to your Lambda project
3. Update `lambda/src/index.ts` to include `AuthInterceptor`
4. Build and deploy:
   ```bash
   cd lambda
   npm install
   npm run build
   sam build
   sam deploy
   ```

### 4. Run Migration Script (Optional)

To migrate existing users:

```bash
# Preview migration
node scripts/migrate_legacy_tokens.js --preview

# Apply migration
node scripts/migrate_legacy_tokens.js --apply
```

**Note:** It's recommended to notify users to re-link their accounts instead of auto-migrating.

## Alexa Developer Console Configuration

### 1. Account Linking Settings

1. Go to [Alexa Developer Console](https://developer.amazon.com/alexa/console/ask)
2. Select your skill
3. Go to **Build** → **Account Linking**
4. Configure:

   **Authorization URI:**
   ```
   https://notion-data-user.vercel.app/api/oauth/authorize
   ```

   **Access Token URI:**
   ```
   https://notion-data-user.vercel.app/api/oauth/token
   ```

   **Client ID:**
   ```
   [Your ALEXA_OAUTH_CLIENT_ID]
   ```

   **Client Secret:**
   ```
   [Your ALEXA_OAUTH_CLIENT_SECRET]
   ```

   **Authorization Grant Type:**
   ```
   Auth Code Grant
   ```

   **Scope:**
   ```
   alexa
   ```

   **Domain List:**
   ```
   notion-data-user.vercel.app
   ```

   **Default Access Token Expiration Time:**
   ```
   3600
   ```

### 2. Save and Build

1. Click **Save**
2. Click **Build Model**
3. Wait for build to complete

## Migration Strategy

### Phase 1: Deploy (Week 1)

1. Deploy new API routes
2. Deploy Lambda with `LEGACY_TOKEN_SUPPORT=true`
3. Configure Alexa Developer Console
4. Test with new account linking

### Phase 2: Transition (Weeks 2-4)

1. Legacy tokens continue to work
2. New users get JWT tokens
3. Monitor logs for legacy token usage
4. Send email notifications to existing users to re-link

### Phase 3: Cleanup (Week 5+)

1. Set `LEGACY_TOKEN_SUPPORT=false` in Lambda
2. Remove legacy token handling code
3. Clean up expired tokens:
   ```sql
   SELECT cleanup_expired_oauth_tokens();
   ```

## Testing

### 1. Test OAuth Flow

```bash
# Step 1: Get authorization code
curl "https://notion-data-user.vercel.app/api/oauth/authorize?response_type=code&client_id=YOUR_CLIENT_ID&redirect_uri=https://layla.amazon.com/api/skill/link&scope=alexa&state=test123"

# Step 2: Exchange code for token (from Alexa)
curl -X POST "https://notion-data-user.vercel.app/api/oauth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code&code=YOUR_CODE&redirect_uri=https://layla.amazon.com/api/skill/link&client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET"
```

### 2. Test Token Introspection

```bash
curl -X POST "https://notion-data-user.vercel.app/api/auth/introspect" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

Expected response:
```json
{
  "active": true,
  "user_id": "uuid",
  "email": "user@example.com",
  "license_active": true,
  "notion_db_id": "notion-db-id",
  "token_type": "Bearer"
}
```

### 3. Test Lambda Integration

1. Link account in Alexa app
2. Test skill invocation: "Alexa, open Notion Data"
3. Check CloudWatch logs for:
   - `[AuthInterceptor] Token validated successfully`
   - User info in session attributes

### 4. Test Legacy Token Support

```bash
# Create a legacy token (base64 JSON)
echo '{"amazon_account_id":"test-id","email":"test@example.com","timestamp":1234567890}' | base64

# Test introspection with legacy token
curl -X POST "https://notion-data-user.vercel.app/api/auth/introspect" \
  -H "Authorization: Bearer LEGACY_BASE64_TOKEN"
```

## Troubleshooting

### Issue: "Invalid client_id" in authorize endpoint

**Solution:** Verify `ALEXA_OAUTH_CLIENT_ID` matches the value in Alexa Developer Console.

### Issue: "Invalid redirect_uri"

**Solution:** 
1. Check `ALEXA_REDIRECT_URIS` includes the exact redirect URI from Alexa
2. Verify redirect URI in Alexa Developer Console matches

### Issue: Lambda can't introspect tokens

**Solution:**
1. Verify `INTROSPECT_URL` is correct
2. Check Lambda has internet access (VPC configuration)
3. Verify `JWT_SECRET` matches between Next.js and Lambda

### Issue: Legacy tokens not working

**Solution:**
1. Verify `LEGACY_TOKEN_SUPPORT=true` in Lambda
2. Check token format (should be base64 JSON)
3. Verify user exists with matching `amazon_account_id`

### Issue: License check failing

**Solution:**
1. Verify `licenses.status = 'active'` in database
2. Check license key is linked to user
3. Review webhook logs for Stripe events

## Security Considerations

1. **JWT_SECRET**: Use a strong, random secret (min 32 characters)
2. **HTTPS Only**: All endpoints must use HTTPS
3. **Token Expiration**: Default 3600s (1 hour), adjust as needed
4. **Revocation**: Tokens are revoked when license becomes inactive
5. **Rate Limiting**: Consider adding rate limiting to token endpoints

## Next Steps

After successful migration:

1. Monitor token usage in `oauth_access_tokens` table
2. Set up alerts for failed token validations
3. Review and optimize token expiration times
4. Consider implementing refresh tokens if needed
5. Document any customizations for your team

## Support

For issues or questions:
1. Check CloudWatch logs for Lambda errors
2. Check Vercel function logs for API errors
3. Review Supabase logs for database errors
4. Test with curl commands above to isolate issues

