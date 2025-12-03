# OAuth2 JWT Migration - Pull Request Template

This PR implements OAuth2 Account Linking with JWT tokens, Stripe payments, and Lambda JWT validation.

## Changes Summary

### New Files

**Next.js API Routes:**
- `web-login/app/api/oauth/authorize/route.ts` - OAuth authorization endpoint
- `web-login/app/api/oauth/token/route.ts` - Token exchange endpoint
- `web-login/app/api/auth/introspect/route.ts` - Token introspection endpoint
- `web-login/app/api/auth/revoke/route.ts` - Token revocation endpoint
- `web-login/app/api/webhooks/stripe/route.ts` - Stripe webhook handler
- `web-login/app/api/stripe/create-checkout-session/route.ts` - Checkout session creation

**Helper Libraries:**
- `web-login/lib/jwt.ts` - JWT signing/verification utilities
- `web-login/lib/oauth.ts` - OAuth flow helpers
- `web-login/lib/stripe.ts` - Stripe integration wrapper

**Lambda Updates:**
- `lambda/src/middleware/auth.ts` - JWT validation interceptor
- `lambda/src/utils/jwt.ts` - JWT utilities for Lambda

**Migrations:**
- `docs/migrations/20250101_add_oauth_tables.sql` - OAuth tables
- `docs/migrations/20250101_add_license_fields.sql` - License table updates

**Scripts:**
- `scripts/migrate_legacy_tokens.js` - Legacy token migration helper

**Documentation:**
- `docs/oauth_jwt_migration.md` - Migration guide
- `docs/stripe_setup.md` - Stripe setup instructions
- `docs/diagrams/oauth_flow.txt` - OAuth flow diagram
- `docs/TESTING.md` - Testing procedures

**Tests:**
- `web-login/__tests__/lib/jwt.test.ts` - JWT unit tests

### Modified Files

- `lambda/src/index.ts` - Added AuthInterceptor to request interceptors

## Manual Application Instructions

### Step 1: Install Dependencies

```bash
cd web-login
npm install jsonwebtoken @types/jsonwebtoken stripe
```

### Step 2: Apply Database Migrations

1. Open Supabase SQL Editor
2. Run `docs/migrations/20250101_add_oauth_tables.sql`
3. Run `docs/migrations/20250101_add_license_fields.sql`
4. Verify tables created:
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('oauth_authorization_codes', 'oauth_access_tokens', 'oauth_refresh_tokens');
   ```

### Step 3: Set Environment Variables

**Vercel:**
```bash
JWT_SECRET=your-secure-random-secret-min-32-chars
JWT_EXPIRES_IN=3600
APP_ISS=https://voice-planner-murex.vercel.app
ALEXA_OAUTH_CLIENT_ID=your-client-id
ALEXA_OAUTH_CLIENT_SECRET=your-client-secret
ALEXA_REDIRECT_URIS=https://layla.amazon.com/api/skill/link,https://pitangui.amazon.com/api/skill/link
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Lambda:**
```bash
JWT_SECRET=your-secure-random-secret-min-32-chars
INTROSPECT_URL=https://voice-planner-murex.vercel.app/api/auth/introspect
LEGACY_TOKEN_SUPPORT=true
```

### Step 4: Deploy Next.js Routes

The API routes are automatically deployed with your Next.js app. No additional steps needed.

### Step 5: Deploy Lambda Updates

```bash
cd lambda
npm install
npm run build
sam build
sam deploy
```

### Step 6: Configure Alexa Developer Console

1. Go to [Alexa Developer Console](https://developer.amazon.com/alexa/console/ask)
2. Select your skill → Build → Account Linking
3. Configure:
   - **Authorization URI**: `https://voice-planner-murex.vercel.app/api/oauth/authorize`
   - **Access Token URI**: `https://voice-planner-murex.vercel.app/api/oauth/token`
   - **Client ID**: `[Your ALEXA_OAUTH_CLIENT_ID]`
   - **Client Secret**: `[Your ALEXA_OAUTH_CLIENT_SECRET]`
   - **Authorization Grant Type**: `Auth Code Grant`
   - **Scope**: `alexa`
4. Save and Build Model

### Step 7: (Optional) Run Migration Script

```bash
# Preview
node scripts/migrate_legacy_tokens.js --preview

# Apply (if needed)
node scripts/migrate_legacy_tokens.js --apply
```

## Testing Checklist

- [ ] OAuth authorization flow works
- [ ] Token exchange returns valid JWT
- [ ] Token introspection validates tokens
- [ ] Legacy tokens still work (if enabled)
- [ ] Lambda validates JWT tokens
- [ ] Lambda falls back to legacy lookup
- [ ] Stripe webhook activates licenses
- [ ] Stripe webhook revokes tokens on refund
- [ ] License check works in authorize endpoint
- [ ] Notion connection check works

## Breaking Changes

⚠️ **None** - This is backward compatible with legacy tokens for 30 days.

## Migration Timeline

- **Week 1**: Deploy and test
- **Weeks 2-4**: Transition period (legacy tokens supported)
- **Week 5+**: Disable legacy support, cleanup

## Rollback Plan

If issues occur:

1. Set `LEGACY_TOKEN_SUPPORT=true` in Lambda
2. Revert `lambda/src/index.ts` to remove `AuthInterceptor`
3. Legacy flow will continue working

## Security Notes

- JWT_SECRET must be strong (min 32 characters)
- All endpoints require HTTPS
- Webhook signatures are verified
- Tokens are revoked on license deactivation

## Related Issues

- Closes #[issue-number]

## Additional Notes

- Legacy token support enabled by default for 30-day transition
- Users should be notified to re-link accounts
- Monitor token usage in `oauth_access_tokens` table

