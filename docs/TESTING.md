# Testing Guide

This document provides testing procedures for the OAuth2 JWT implementation.

## Unit Tests

### JWT Utilities

Run JWT tests:
```bash
cd web-login
npm test -- __tests__/lib/jwt.test.ts
```

## Integration Tests

### 1. OAuth Authorization Flow

**Test Case: Successful Authorization**

```bash
# Step 1: Start authorization (requires authenticated session)
curl -v "https://notion-data-user.vercel.app/api/oauth/authorize?response_type=code&client_id=YOUR_CLIENT_ID&redirect_uri=https://layla.amazon.com/api/skill/link&scope=alexa&state=test123" \
  -H "Cookie: sb-access-token=YOUR_SESSION_TOKEN"

# Expected: Redirect to redirect_uri with code parameter
```

**Test Case: Missing License**

```bash
# User without active license should be redirected to error page
curl -v "https://notion-data-user.vercel.app/api/oauth/authorize?response_type=code&client_id=YOUR_CLIENT_ID&redirect_uri=https://layla.amazon.com/api/skill/link&scope=alexa" \
  -H "Cookie: sb-access-token=USER_WITHOUT_LICENSE_TOKEN"

# Expected: Redirect to /error with message about license
```

**Test Case: Missing Notion Connection**

```bash
# User without Notion connection should be redirected
curl -v "https://notion-data-user.vercel.app/api/oauth/authorize?response_type=code&client_id=YOUR_CLIENT_ID&redirect_uri=https://layla.amazon.com/api/skill/link&scope=alexa" \
  -H "Cookie: sb-access-token=USER_WITHOUT_NOTION_TOKEN"

# Expected: Redirect to /error with message about Notion
```

### 2. Token Exchange

**Test Case: Valid Code Exchange**

```bash
# First, get an authorization code (from step 1)
# Then exchange it for a token

curl -X POST "https://notion-data-user.vercel.app/api/oauth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "code=AUTHORIZATION_CODE" \
  -d "redirect_uri=https://layla.amazon.com/api/skill/link" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET"

# Expected Response:
# {
#   "access_token": "eyJ...",
#   "token_type": "Bearer",
#   "expires_in": 3600,
#   "scope": "alexa"
# }
```

**Test Case: Invalid Code**

```bash
curl -X POST "https://notion-data-user.vercel.app/api/oauth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "code=INVALID_CODE" \
  -d "redirect_uri=https://layla.amazon.com/api/skill/link" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET"

# Expected: 400 Bad Request
# {
#   "error": "invalid_grant",
#   "error_description": "Invalid or expired authorization code"
# }
```

**Test Case: Expired Code**

```bash
# Use a code that's older than 10 minutes
# Expected: Same error as invalid code
```

### 3. Token Introspection

**Test Case: Valid JWT Token**

```bash
curl -X POST "https://notion-data-user.vercel.app/api/auth/introspect" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"

# Expected Response:
# {
#   "active": true,
#   "user_id": "uuid",
#   "auth_user_id": "uuid",
#   "email": "user@example.com",
#   "license_active": true,
#   "notion_db_id": "notion-db-id",
#   "token_type": "Bearer"
# }
```

**Test Case: Revoked Token**

```bash
# First, revoke a token
curl -X POST "https://notion-data-user.vercel.app/api/auth/revoke" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"token": "YOUR_JWT_TOKEN"}'

# Then try to introspect it
curl -X POST "https://notion-data-user.vercel.app/api/auth/introspect" \
  -H "Authorization: Bearer REVOKED_TOKEN" \
  -H "Content-Type: application/json"

# Expected: 401 Unauthorized
# {
#   "error": "invalid_token",
#   "error_description": "Token has been revoked"
# }
```

**Test Case: Legacy Base64 Token**

```bash
# Create a legacy token
LEGACY_TOKEN=$(echo '{"amazon_account_id":"test-id","email":"test@example.com","timestamp":1234567890}' | base64)

curl -X POST "https://notion-data-user.vercel.app/api/auth/introspect" \
  -H "Authorization: Bearer $LEGACY_TOKEN" \
  -H "Content-Type: application/json"

# Expected: Compatibility response with token_type: "legacy"
```

### 4. Stripe Webhook

**Test Case: Payment Succeeded**

```bash
# Use Stripe CLI to send test event
stripe trigger payment_intent.succeeded

# Or manually:
curl -X POST "https://notion-data-user.vercel.app/api/webhooks/stripe" \
  -H "Stripe-Signature: SIGNATURE" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "payment_intent.succeeded",
    "data": {
      "object": {
        "id": "pi_test",
        "metadata": {
          "license_key": "LICENSE-123",
          "user_id": "uuid"
        }
      }
    }
  }'

# Expected: License status set to 'active' in database
```

**Test Case: Refund**

```bash
stripe trigger charge.refunded

# Expected: 
# - License status set to 'inactive'
# - All tokens for user revoked
```

### 5. Lambda Integration

**Test Case: Valid Token in Request**

1. Link account in Alexa app (gets JWT token)
2. Invoke skill: "Alexa, open Notion Data"
3. Check CloudWatch logs:
   - `[AuthInterceptor] Token validated successfully`
   - User info in session attributes
4. Verify skill responds correctly

**Test Case: Missing Token**

1. Unlink account in Alexa app
2. Invoke skill: "Alexa, open Notion Data"
3. Expected: LinkAccount card response

**Test Case: Revoked Token**

1. Revoke token via `/api/auth/revoke`
2. Invoke skill (token still in Alexa cache)
3. Expected: LinkAccount card response

**Test Case: Legacy Token**

1. Use account with legacy base64 token
2. Invoke skill
3. Check CloudWatch logs:
   - `[AuthInterceptor] Processing legacy token`
   - User lookup by amazon_account_id succeeds
4. Verify skill responds correctly

## Test Checklist

### Pre-Deployment

- [ ] JWT signing/verification works
- [ ] Authorization endpoint validates license
- [ ] Authorization endpoint validates Notion connection
- [ ] Token exchange validates code
- [ ] Token exchange issues valid JWT
- [ ] Introspection validates JWT
- [ ] Introspection supports legacy tokens
- [ ] Token revocation works
- [ ] Stripe webhook activates license
- [ ] Stripe webhook revokes tokens on refund

### Post-Deployment

- [ ] Alexa account linking works end-to-end
- [ ] Lambda receives and validates tokens
- [ ] Lambda falls back to legacy lookup
- [ ] License check works in Lambda
- [ ] Notion client created correctly
- [ ] Handlers receive user info
- [ ] Error responses are user-friendly

## Performance Testing

### Load Test Token Introspection

```bash
# Use Apache Bench or similar
ab -n 1000 -c 10 -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  https://notion-data-user.vercel.app/api/auth/introspect
```

### Monitor

- Response times should be < 200ms
- Database queries should be indexed
- Consider caching token validation results

## Security Testing

### Test Cases

1. **Token Tampering**: Modify JWT signature, verify rejection
2. **Expired Token**: Use expired token, verify rejection
3. **Wrong Secret**: Use token signed with different secret
4. **SQL Injection**: Attempt injection in token claims
5. **CSRF**: Verify state parameter validation
6. **Rate Limiting**: Test token endpoint rate limits

## Debugging

### Enable Debug Logging

Set environment variable:
```bash
DEBUG=oauth:*
```

### Check Logs

**Vercel:**
- Function logs in Vercel dashboard
- Check for errors in `/api/oauth/*` routes

**Lambda:**
- CloudWatch logs for `[AuthInterceptor]` messages
- Check token validation errors

**Database:**
- Query `oauth_access_tokens` for token records
- Check `oauth_authorization_codes` for used codes
- Verify `licenses.status` is correct

