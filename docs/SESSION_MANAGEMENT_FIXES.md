# Session Management Fixes - Implementation Summary

## Overview
This document summarizes the fixes implemented to address session management issues, including token expiration handling, re-account linking, and error recovery.

## Fixes Implemented

### 1. ✅ Token Revocation on Re-Account Linking (HIGH PRIORITY)
**File**: `web-login/app/api/users/link-amazon/route.ts`

**Issue**: When users re-linked their Amazon account, old tokens remained valid, allowing stale sessions.

**Fix**:
- Added detection of re-linking scenarios (when `amazon_account_id` changes)
- Automatically revokes all existing tokens when re-linking occurs
- Revokes both OAuth access tokens and website refresh tokens
- Includes error handling to prevent failures if revocation fails

**Code Changes**:
```typescript
// Check if user already has a different amazon_account_id (re-linking scenario)
const isRelinking = currentUser?.amazon_account_id && 
                   currentUser.amazon_account_id !== amazon_account_id

// After updating user, revoke old tokens
if (isRelinking) {
  await revokeUserTokens(authUser.id)
  // Also revoke website refresh tokens
}
```

### 2. ✅ Token Expiration Detection and Handling (HIGH PRIORITY)
**File**: `lambda/src/middleware/auth.ts`

**Issue**: Expired tokens were not properly detected, leading to unclear error messages.

**Fix**:
- Added token expiration timestamp checking (`exp` field)
- Detects tokens expiring soon (within 5 minutes) and logs warnings
- Properly handles expired tokens with `TOKEN_EXPIRED` error
- Improved error messages for different failure scenarios (401, 500, etc.)

**Code Changes**:
```typescript
// Check token expiration if exp is provided
if (userInfo.exp) {
  const now = Math.floor(Date.now() / 1000);
  const timeUntilExpiry = userInfo.exp - now;
  
  // Warn if expiring soon
  if (timeUntilExpiry > 0 && timeUntilExpiry < 300) {
    console.warn('[AuthInterceptor] Token expiring soon');
  }
  
  // Handle expired tokens
  if (timeUntilExpiry <= 0) {
    throw new Error('TOKEN_EXPIRED');
  }
}
```

### 3. ✅ Retry Logic with Exponential Backoff (MEDIUM PRIORITY)
**File**: `lambda/src/utils/database.ts`

**Issue**: Database queries could fail due to transient network issues or timeouts.

**Fix**:
- Implemented `retryWithBackoff` helper function
- Retries up to 3 times with exponential backoff (100ms, 200ms, 400ms)
- Skips retries for non-retryable errors (not found, validation errors)
- Applied to `getUserByAuthUserId` function

**Code Changes**:
```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 100
): Promise<T> {
  // Exponential backoff retry logic
}
```

### 4. ✅ Enhanced Session Cleanup (MEDIUM PRIORITY)
**File**: `lambda/src/interceptors/SessionCleanupInterceptor.ts`

**Issue**: Session attributes were only cleared on `SessionEndedRequest`, not on auth failures.

**Fix**:
- Clears session attributes when authentication fails (token expired/invalid)
- Clears stale session data (older than 1 hour)
- Tracks session timestamp to detect stale data
- Prevents stale user data from being used in subsequent requests

**Code Changes**:
```typescript
// Clear session attributes if authentication failed
if (shouldClearSession) {
  this.clearSessionAttributes(handlerInput);
}

// Clear stale session data (older than 1 hour)
if (attributes.user && attributes.sessionTimestamp) {
  const sessionAge = Date.now() - attributes.sessionTimestamp;
  if (sessionAge > MAX_SESSION_AGE) {
    this.clearSessionAttributes(handlerInput);
  }
}
```

### 5. ✅ Improved Error Messages and Logging (LOW PRIORITY)
**Files**: 
- `lambda/src/middleware/auth.ts`
- `lambda/src/utils/database.ts`
- `web-login/app/api/users/link-amazon/route.ts`

**Issue**: Error messages were unclear, making debugging difficult.

**Fix**:
- Added comprehensive logging with context (user IDs, token types, timestamps)
- Improved error messages for different failure scenarios
- Added structured logging with relevant metadata
- Better error handling in `handleAuthError` function

**Code Changes**:
```typescript
console.log('[AuthInterceptor] Token validated successfully:', {
  user_id: userInfo.user_id,
  email: userInfo.email,
  token_type: userInfo.token_type,
  expires_at: userInfo.exp ? new Date(userInfo.exp * 1000).toISOString() : 'unknown',
  has_notion_token: !!user.notion_token,
  notion_setup_complete: user.notion_setup_complete,
});
```

### 6. ✅ Session Timestamp Tracking
**File**: `lambda/src/middleware/auth.ts`

**Issue**: No way to detect stale session data.

**Fix**:
- Added `sessionTimestamp` to session attributes when user data is loaded
- Used by `SessionCleanupInterceptor` to detect stale sessions

**Code Changes**:
```typescript
attributes.sessionTimestamp = Date.now(); // Track when session data was loaded
```

## Testing Recommendations

1. **Re-Account Linking**:
   - Link Amazon account
   - Use skill with token
   - Re-link Amazon account
   - Verify old tokens are revoked and new linking is required

2. **Token Expiration**:
   - Use skill with token close to expiration
   - Verify warnings are logged
   - Wait for token to expire
   - Verify proper error handling and account linking prompt

3. **Database Retry Logic**:
   - Simulate network timeouts
   - Verify retries occur with exponential backoff
   - Verify non-retryable errors are not retried

4. **Session Cleanup**:
   - Trigger auth failures
   - Verify session attributes are cleared
   - Verify stale session data is cleaned up

## Remaining Considerations

1. **Token Refresh**: Currently, expired tokens require re-linking. Consider implementing token refresh flow for better UX.

2. **Periodic Cleanup**: Database cleanup functions exist but may need scheduled jobs to run them regularly.

3. **Rate Limiting**: Consider adding rate limiting on token operations to prevent abuse.

4. **Monitoring**: Add metrics/alerts for:
   - Token expiration rates
   - Re-linking frequency
   - Database query retry rates
   - Session cleanup frequency

## Files Modified

1. `web-login/app/api/users/link-amazon/route.ts` - Token revocation on re-linking
2. `lambda/src/middleware/auth.ts` - Token expiration handling, improved logging
3. `lambda/src/utils/database.ts` - Retry logic with exponential backoff
4. `lambda/src/interceptors/SessionCleanupInterceptor.ts` - Enhanced session cleanup
5. `web-login/app/api/oauth/callback/route.ts` - Added import for token revocation (prepared for future use)

## Environment Variables

No new environment variables required. Existing variables are used:
- `JWT_SECRET` - For JWT token validation
- `INTROSPECT_URL` - For token introspection
- `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` - For database operations
