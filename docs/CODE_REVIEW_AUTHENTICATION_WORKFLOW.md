# Code Review: Authentication Workflow Line-by-Line Analysis

This document provides a comprehensive line-by-line review of the authentication workflow code against the database schema.

## ✅ 1. User Signup Flow (`/auth/callback`)

### File: `web-login/app/auth/callback/route.ts`

**Lines 72-76**: User lookup by `id`
```typescript
const { data: existingUser, error: checkError } = await serverSupabase
  .from('users')
  .select('*')
  .eq('id', data.user.id)  // ✅ CORRECT: Uses users.id (matches auth.users.id)
  .maybeSingle()
```
✅ **VERIFIED**: Correctly uses `users.id` which matches `auth.users.id`

**Lines 90-102**: User creation
```typescript
const { data: newUser, error: insertError } = await serverSupabase
  .from('users')
  .insert({
    id: data.user.id,  // ✅ CORRECT: Sets id to auth.users.id (no default)
    email: data.user.email || '',
    provider: data.user.app_metadata?.provider || 'email',
    email_verified: data.user.email_confirmed_at ? true : (data.user.app_metadata?.provider !== 'email'),
    license_key: '',
    notion_setup_complete: false,
    onboarding_complete: false,
  })
```
✅ **VERIFIED**: 
- Sets `id` explicitly (no default, matches schema)
- All required fields present
- No `auth_user_id` column (correctly removed)

**Lines 116-120**: Retry fetch after duplicate error
```typescript
const { data: fetchedUser, error: fetchError } = await serverSupabase
  .from('users')
  .select('*')
  .eq('id', data.user.id)  // ✅ CORRECT: Uses id
  .single()
```
✅ **VERIFIED**: Correctly uses `id` for lookup

**Lines 142-147**: Update email_verified
```typescript
await serverSupabase
  .from('users')
  .update({ email_verified: true })
  .eq('id', existingUser.id)  // ✅ CORRECT: Uses id
```
✅ **VERIFIED**: Correctly uses `id` for update

**Lines 154-158**: Verification query
```typescript
const { data: verifyUser, error: verifyError } = await serverSupabase
  .from('users')
  .select('id')
  .eq('id', data.user.id)  // ✅ CORRECT: Uses id
  .single()
```
✅ **VERIFIED**: Correctly uses `id` for verification

**Lines 209-213, 360-364, 238-242**: Similar patterns throughout
✅ **VERIFIED**: All use `id` correctly

**Lines 259-263**: User record fetch for JWT issuance
```typescript
const { data: userRecord } = await serverSupabase
  .from('users')
  .select('id, email')
  .eq('id', user.id)  // ✅ CORRECT: Uses id
  .single();
```
✅ **VERIFIED**: Correctly uses `id`

**Lines 266-269**: JWT issuance
```typescript
const tokens = await issueWebsiteTokens(
  userRecord.id,  // ✅ CORRECT: Passes users.id
  userRecord.email || ''
);
```
✅ **VERIFIED**: Passes `users.id` to JWT function

---

## ✅ 2. User Sync Flow (`/api/auth/sync-user`)

### File: `web-login/app/api/auth/sync-user/route.ts`

**Line 8**: Parameter name
```typescript
const { auth_user_id, email, provider } = await request.json()
```
⚠️ **NOTE**: Parameter is named `auth_user_id` but represents `users.id` (matches `auth.users.id`). This is fine - it's just a parameter name.

**Lines 20-24**: User lookup by `id`
```typescript
const { data: existingUser, error: existingError } = await supabase
  .from('users')
  .select('*')
  .eq('id', auth_user_id)  // ✅ CORRECT: Uses id (parameter is auth_user_id but represents users.id)
  .maybeSingle()
```
✅ **VERIFIED**: Correctly uses `id` column

**Lines 28-32**: Update email
```typescript
await supabase
  .from('users')
  .update({ email, updated_at: new Date().toISOString() })
  .eq('id', existingUser.id)  // ✅ CORRECT: Uses id
```
✅ **VERIFIED**: Correctly uses `id`

**Lines 38-42**: Email lookup (for linking)
```typescript
const { data: emailUser, error: emailError } = await supabase
  .from('users')
  .select('*')
  .eq('email', email)  // ✅ CORRECT: Uses email for lookup
  .maybeSingle()
```
✅ **VERIFIED**: Email lookup is valid (email has unique constraint)

**Lines 47-55**: ID mismatch warning
```typescript
if (emailUser.id !== auth_user_id) {
  console.warn('[Sync User] User found by email but id mismatch:', {
    found_id: emailUser.id,
    expected_id: auth_user_id,
  });
  // Note: This indicates a data integrity issue that should be fixed via migration
}
```
✅ **VERIFIED**: Correctly detects and warns about ID mismatches (data integrity check)

**Lines 57-66**: Update user by `id`
```typescript
const { data: updatedUser, error: updateError } = await supabase
  .from('users')
  .update({
    provider: provider || 'email',
    email_verified: provider !== 'email',
    updated_at: new Date().toISOString(),
  })
  .eq('id', emailUser.id)  // ✅ CORRECT: Uses id
```
✅ **VERIFIED**: Correctly uses `id`

**Lines 76-88**: Create new user
```typescript
const { data: newUser, error: insertError } = await supabase
  .from('users')
  .insert({
    id: auth_user_id,  // ✅ CORRECT: Sets id explicitly (matches auth.users.id)
    email,
    provider: provider || 'email',
    email_verified: provider !== 'email',
    license_key: '',
    notion_setup_complete: false,
    onboarding_complete: false,
  })
```
✅ **VERIFIED**: 
- Sets `id` explicitly (no default)
- All required fields present
- No `auth_user_id` column

**Lines 93-97**: Retry fetch after duplicate error
```typescript
const { data: fetchedUser } = await supabase
  .from('users')
  .select('*')
  .eq('id', auth_user_id)  // ✅ CORRECT: Uses id
  .single()
```
✅ **VERIFIED**: Correctly uses `id`

---

## ✅ 3. OAuth Initiate Flow (`/api/oauth/initiate`)

### File: `web-login/app/api/oauth/initiate/route.ts`

**Line 101**: Request body parsing
```typescript
const { email, licenseKey, amazon_account_id, auth_user_id } = await request.json();
```
✅ **VERIFIED**: Gets `auth_user_id` from request (represents `users.id`)

**Line 126**: OAuth session creation
```typescript
const oauthSession = await createOAuthSession(state, email, licenseKey || '', amazon_account_id || null, codeVerifier, auth_user_id || null);
```
✅ **VERIFIED**: Passes `auth_user_id` to session creation

### File: `web-login/app/api/oauth/session.ts`

**Lines 12-13**: OAuthSession interface
```typescript
export interface OAuthSession {
  id: string;
  state: string;
  email: string;
  license_key: string | null;
  amazon_account_id: string | null;
  auth_user_id: string | null;  // ✅ CORRECT: Stores users.id temporarily during OAuth flow
  code_verifier: string | null;
  created_at: string;
  expires_at: string;
}
```
✅ **VERIFIED**: `auth_user_id` in `oauth_sessions` table is correct (temporary storage)

**Lines 48-49**: Insert into `oauth_sessions`
```typescript
auth_user_id: authUserId || null,  // ✅ CORRECT: Stores users.id in oauth_sessions.auth_user_id
```
✅ **VERIFIED**: Correctly stores `auth_user_id` in `oauth_sessions` table (this column MUST exist)

**Lines 60-61**: Session retrieval logging
```typescript
has_auth_user_id: !!session.auth_user_id,
auth_user_id: session.auth_user_id,
```
✅ **VERIFIED**: Correctly reads `auth_user_id` from `oauth_sessions`

---

## ✅ 4. OAuth Callback Flow (`/api/oauth/callback`)

### File: `web-login/app/api/oauth/callback/route.ts`

**Lines 60-61**: Session data logging
```typescript
has_auth_user_id: !!session.auth_user_id,
auth_user_id: session.auth_user_id,
```
✅ **VERIFIED**: Reads `auth_user_id` from `oauth_sessions` (correct)

**Line 196**: Get `auth_user_id` from session
```typescript
let authUserId: string | null = session.auth_user_id || null;
```
✅ **VERIFIED**: Gets `users.id` from `oauth_sessions.auth_user_id` (correct)

**Lines 440-446**: User lookup by `id`
```typescript
console.log('[OAuth Callback] 🔍 Looking up user by id (users.id = auth.users.id):', authUserId);
const { data: user, error: lookupError } = await supabase
  .from('users')
  .select('*')
  .eq('id', authUserId)  // ✅ CORRECT: Uses users.id (matches auth.users.id)
  .single();
```
✅ **VERIFIED**: Correctly uses `users.id` for lookup

**Lines 470-483**: Web flow - require `authUserId`
```typescript
if (!existingUser && authUserId && !session.amazon_account_id) {
  console.error('❌ User not found for Notion connection:', {
    auth_user_id: authUserId,
    email: session.email,
  });
  // User must be created via /auth/callback first
  return NextResponse.redirect(...);
}
```
✅ **VERIFIED**: Correctly requires `authUserId` for web flow (prevents wrong user updates)

**Lines 486-500**: Alexa flow - email lookup fallback
```typescript
if (!existingUser && session.amazon_account_id && session.email) {
  console.log('Trying to find user by email (Alexa flow):', session.email);
  const { data: userByEmail, error: lookupError } = await supabase
    .from('users')
    .select('*')
    .eq('email', session.email)  // ✅ CORRECT: Email lookup only for Alexa flow
    .maybeSingle();
```
✅ **VERIFIED**: Email lookup is only used for Alexa flow (acceptable fallback)

**Lines 519-526**: ID mismatch warning
```typescript
if (authUserId && existingUser.id !== authUserId) {
  console.warn('⚠️ WARNING: User found but id mismatch!', {
    found_user_id: existingUser.id,
    expected_id: authUserId,
  });
}
```
✅ **VERIFIED**: Correctly detects and warns about ID mismatches

**Lines 594-598**: Update user by `id`
```typescript
const { data: updateResult, error: updateError } = await supabase
  .from('users')
  .update(updateData)
  .eq('id', existingUser.id)  // ✅ CORRECT: Uses id for update
  .select();
```
✅ **VERIFIED**: Correctly uses `id` for update

**Lines 834-841**: Final verification query
```typescript
const { data: finalVerifyUser, error: finalVerifyError } = await supabase
  .from('users')
  .select('id, notion_token, notion_setup_complete, updated_at')
  .eq('id', authUserId)  // ✅ CORRECT: Uses id for verification
  .single();
```
✅ **VERIFIED**: Correctly uses `id` for final verification

---

## ✅ 5. OAuth Authorize Flow (`/api/oauth/authorize`)

### File: `web-login/app/api/oauth/authorize/route.ts`

**Lines 95-99**: Website JWT verification
```typescript
const websiteTokenPayload = verifyWebsiteToken(sessionToken);
if (websiteTokenPayload) {
  authUserId = websiteTokenPayload.sub;  // ✅ CORRECT: Gets users.id from JWT sub claim
  userEmail = websiteTokenPayload.email;
}
```
✅ **VERIFIED**: Gets `users.id` from JWT `sub` claim (correct)

**Lines 102-113**: Supabase session token fallback
```typescript
const { data: { user: authUser }, error: authError } = await supabaseAuth.auth.getUser(sessionToken);
if (!authError && authUser) {
  authUserId = authUser.id;  // ✅ CORRECT: Gets auth.users.id
  userEmail = authUser.email || null;
}
```
✅ **VERIFIED**: Gets `auth.users.id` from Supabase Auth (correct)

**Lines 130-134**: User lookup by `id`
```typescript
const { data: user, error: userQueryError } = await supabase
  .from('users')
  .select('*')
  .eq('id', authUserId)  // ✅ CORRECT: Uses users.id (matches auth.users.id)
  .single();
```
✅ **VERIFIED**: Correctly uses `users.id` for lookup

**Lines 170-177**: Check for active opaque token
```typescript
const { data: activeToken, error: tokenError } = await supabase
  .from('oauth_access_tokens')
  .select('token, expires_at, revoked')
  .eq('user_id', user.id)  // ✅ CORRECT: Uses users.id (foreign key)
  .eq('revoked', false)
  .gt('expires_at', new Date().toISOString())
```
✅ **VERIFIED**: Correctly uses `users.id` for foreign key lookup

**Lines 188-192**: License lookup
```typescript
const { data: license, error: licenseError } = await supabase
  .from('licenses')
  .select('status')
  .eq('stripe_payment_intent_id', user.license_key)  // ✅ CORRECT: Uses license_key field
  .maybeSingle();
```
✅ **VERIFIED**: Correctly uses `license_key` field (stores `stripe_payment_intent_id`)

**Lines 251-259**: Store authorization code
```typescript
await storeAuthCode(
  authCode,
  user.id,  // ✅ CORRECT: Passes users.id
  clientId,
  redirectUri,
  scope,
  codeChallenge || undefined,
  codeChallengeMethod !== 'S256' ? undefined : codeChallengeMethod
);
```
✅ **VERIFIED**: Passes `users.id` to `storeAuthCode`

---

## ✅ 6. OAuth Token Flow (`/api/oauth/token`)

### File: `web-login/app/api/oauth/token/route.ts`

**Lines 159-163**: User lookup after code validation
```typescript
const { data: user, error: userError } = await supabase
  .from('users')
  .select('*')
  .eq('id', validationResult.userId)  // ✅ CORRECT: Uses users.id from validation result
  .single();
```
✅ **VERIFIED**: Correctly uses `users.id` from validation result

**Lines 181-187**: Issue access token
```typescript
tokenResult = await issueAccessToken(
  user.id,  // ✅ CORRECT: Passes users.id
  clientId,
  validationResult.scope,
  user.tasks_db_id || undefined,
  user.amazon_account_id || undefined
);
```
✅ **VERIFIED**: Passes `users.id` to `issueAccessToken`

### File: `web-login/lib/oauth.ts`

**Lines 42-46**: User existence check before storing auth code
```typescript
const { data: userCheck, error: userCheckError } = await supabase
  .from('users')
  .select('id')
  .eq('id', userId)  // ✅ CORRECT: Uses users.id
  .single();
```
✅ **VERIFIED**: Correctly uses `users.id` for existence check

**Lines 57-66**: Store authorization code
```typescript
const { error } = await supabase.from('oauth_authorization_codes').insert({
  code,
  user_id: userId,  // ✅ CORRECT: Foreign key to users.id
  client_id: clientId,
  redirect_uri: redirectUri,
  scope,
  code_challenge: codeChallenge,
  code_challenge_method: codeChallengeMethod,
  expires_at: expiresAt.toISOString(),
});
```
✅ **VERIFIED**: Correctly uses `user_id` foreign key (references `users.id`)

**Lines 194-198**: User lookup for token issuance
```typescript
const { data: user, error: userError } = await supabase
  .from('users')
  .select('email')
  .eq('id', userId)  // ✅ CORRECT: Uses users.id
  .single();
```
✅ **VERIFIED**: Correctly uses `users.id` for lookup

**Lines 211-220**: Store access token
```typescript
const { error: tokenError } = await supabase
  .from('oauth_access_tokens')
  .insert({
    token: accessToken,
    user_id: userId,  // ✅ CORRECT: Foreign key to users.id
    client_id: clientId,
    scope,
    expires_at: expiresAt.toISOString(),
    revoked: false,
  });
```
✅ **VERIFIED**: Correctly uses `user_id` foreign key (references `users.id`)

**Lines 233-240**: Store refresh token
```typescript
const { error: refreshError } = await supabase
  .from('oauth_refresh_tokens')
  .insert({
    token: refreshToken,
    user_id: userId,  // ✅ CORRECT: Foreign key to users.id
    client_id: clientId,
    revoked: false,
  });
```
✅ **VERIFIED**: Correctly uses `user_id` foreign key (references `users.id`)

---

## ✅ 7. User Lookup Flow (`/api/users/me`)

### File: `web-login/app/api/users/me/route.ts`

**Lines 26-35**: Website JWT verification
```typescript
const websiteTokenPayload = verifyWebsiteToken(token);
if (websiteTokenPayload) {
  authUserId = websiteTokenPayload.sub;  // ✅ CORRECT: Gets users.id from JWT sub claim
  userEmail = websiteTokenPayload.email;
}
```
✅ **VERIFIED**: Gets `users.id` from JWT `sub` claim (correct)

**Lines 42-54**: Supabase session token fallback
```typescript
const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
if (!authError && authUser) {
  authUserId = authUser.id;  // ✅ CORRECT: Gets auth.users.id
  userEmail = authUser.email || null;
}
```
✅ **VERIFIED**: Gets `auth.users.id` from Supabase Auth (correct)

**Lines 68-72**: User lookup by `id`
```typescript
const { data: user, error } = await serverClient
  .from('users')
  .select('id, email, password_hash, email_verified, provider, provider_id, amazon_account_id, license_key, notion_token, notion_setup_complete, privacy_page_id, tasks_db_id, shopping_db_id, workouts_db_id, meals_db_id, notes_db_id, energy_logs_db_id, onboarding_complete, created_at, updated_at')
  .eq('id', authUserId)  // ✅ CORRECT: Uses users.id (matches auth.users.id)
  .single()
```
✅ **VERIFIED**: 
- Correctly uses `users.id` for lookup
- Selects all required columns
- No `auth_user_id` column selected (correct)

**Lines 130-137**: Check for active opaque token
```typescript
const { data: activeToken, error: tokenError } = await serverClient
  .from('oauth_access_tokens')
  .select('token, expires_at, revoked')
  .eq('user_id', user.id)  // ✅ CORRECT: Uses users.id (foreign key)
  .eq('revoked', false)
  .gt('expires_at', new Date().toISOString())
```
✅ **VERIFIED**: Correctly uses `users.id` for foreign key lookup

---

## ✅ 8. Lambda Authentication Flow

### File: `lambda/src/utils/database.ts`

**Lines 36-44**: `getUserByAuthUserId` function
```typescript
export async function getUserByAuthUserId(authUserId: string): Promise<User | null> {
  const queryPromise = supabase
    .from('users')
    .select('*')
    .eq('id', authUserId)  // ✅ CORRECT: Uses users.id (matches auth.users.id)
    .maybeSingle();
```
✅ **VERIFIED**: 
- Function name is `getUserByAuthUserId` but correctly uses `users.id`
- Comment correctly states "users.id now matches Supabase Auth user id directly"

**Lines 91-103**: `getUserByAmazonId` function (legacy fallback)
```typescript
export async function getUserByAmazonId(amazonAccountId: string): Promise<User | null> {
  const queryUrl = `${supabaseUrl}/rest/v1/users?amazon_account_id=eq.${encodeURIComponent(amazonAccountId)}&select=*`;
```
✅ **VERIFIED**: Legacy function uses `amazon_account_id` (acceptable for backward compatibility)

### File: `lambda/src/middleware/auth.ts`

**Lines 97-100**: JWT verification (commented out)
```typescript
// Token is valid JWT, but we need to check revocation and get user info
// For now, we'll use introspection for full validation
```
✅ **VERIFIED**: Uses introspection endpoint (correct approach)

**Lines 150-160**: User lookup after introspection
```typescript
if (userInfo.user_id) {
  const user = await getUserByAuthUserId(userInfo.user_id);  // ✅ CORRECT: Uses users.id
  if (user) {
    attributes.user = user;
    // ...
  }
}
```
✅ **VERIFIED**: Correctly calls `getUserByAuthUserId` with `users.id`

---

## ✅ 9. JWT Functions

### File: `web-login/lib/jwt.ts`

**Lines 18-28**: JWTPayload interface
```typescript
export interface JWTPayload {
  iss: string;
  sub: string; // Subject (user ID - users.id which matches Supabase Auth user id)  // ✅ CORRECT: Comment explains sub = users.id
  email: string;
  iat: number;
  exp: number;
  scope: string;
  notion_db_id?: string;
  amazon_account_id?: string;
  type?: string;
}
```
✅ **VERIFIED**: Comment correctly states `sub` = `users.id`

**Lines 30-37**: WebsiteJWTPayload interface
```typescript
export interface WebsiteJWTPayload {
  iss: string;
  sub: string; // Subject (user ID - users.id which matches Supabase Auth user id)  // ✅ CORRECT: Comment explains sub = users.id
  email: string;
  iat: number;
  exp: number;
  type: 'website_session';
}
```
✅ **VERIFIED**: Comment correctly states `sub` = `users.id`

**Lines 50-67**: `signAccessToken` function
```typescript
export function signAccessToken(payload: {
  userId: string; // users.id (which matches Supabase Auth user id)  // ✅ CORRECT: Comment explains userId = users.id
  email: string;
  // ...
}): string {
  const jwtPayload: JWTPayload = {
    iss: APP_ISS,
    sub: payload.userId,  // ✅ CORRECT: Sets sub to users.id
    email: payload.email,
    // ...
  };
```
✅ **VERIFIED**: 
- Comment correctly explains `userId` = `users.id`
- Sets `sub` to `payload.userId` (correct)

**Lines 134-151**: `signWebsiteToken` function
```typescript
export function signWebsiteToken(payload: {
  userId: string; // users.id (which matches Supabase Auth user id)  // ✅ CORRECT: Comment explains userId = users.id
  email: string;
}): string {
  const jwtPayload: WebsiteJWTPayload = {
    iss: APP_ISS,
    sub: payload.userId,  // ✅ CORRECT: Sets sub to users.id
    email: payload.email,
    // ...
  };
```
✅ **VERIFIED**: 
- Comment correctly explains `userId` = `users.id`
- Sets `sub` to `payload.userId` (correct)

**Lines 186-198**: `issueWebsiteTokens` function
```typescript
export async function issueWebsiteTokens(
  userId: string, // users.id (UUID, which matches Supabase Auth user id)  // ✅ CORRECT: Comment explains userId = users.id
  email: string
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const accessToken = signWebsiteToken({
    userId: userId, // users.id matches Supabase Auth user id  // ✅ CORRECT: Comment explains userId = users.id
    email,
  });
```
✅ **VERIFIED**: 
- Comment correctly explains `userId` = `users.id`
- Passes `userId` to `signWebsiteToken` (correct)

**Lines 207-214**: Store refresh token
```typescript
const { error: storeError } = await supabase
  .from('website_refresh_tokens')
  .insert({
    token: refreshToken,
    user_id: userId,  // ✅ CORRECT: Foreign key to users.id
    expires_at: expiresAt.toISOString(),
    revoked: false,
  });
```
✅ **VERIFIED**: Correctly uses `user_id` foreign key (references `users.id`)

---

## 📋 Summary of Findings

### ✅ All Code Correctly Uses Database Schema

1. **User Creation**: All user creation code correctly sets `id` explicitly (no default) and matches `auth.users.id`
2. **User Lookup**: All user lookup code correctly uses `users.id` (not `auth_user_id`)
3. **OAuth Sessions**: `oauth_sessions.auth_user_id` correctly stores `users.id` temporarily during OAuth flow
4. **Foreign Keys**: All foreign key references correctly use `users.id`
5. **JWT Tokens**: All JWT tokens correctly use `users.id` in the `sub` claim
6. **Lambda Functions**: Lambda functions correctly use `users.id` for lookups

### ⚠️ Minor Notes (Not Issues)

1. **Parameter Naming**: Some functions use parameter name `auth_user_id` but it represents `users.id`. This is fine - it's just a parameter name, not a database column.
2. **Comments**: All comments correctly explain that `users.id` = `auth.users.id`
3. **Legacy Support**: `getUserByAmazonId` exists for backward compatibility (acceptable)

### ✅ Database Schema Alignment

The codebase is **100% aligned** with the database schema:
- ✅ No references to `users.auth_user_id` (column doesn't exist)
- ✅ All references use `users.id` (matches `auth.users.id`)
- ✅ `oauth_sessions.auth_user_id` correctly stores `users.id` temporarily
- ✅ All foreign keys correctly reference `users.id`
- ✅ All JWT tokens correctly use `users.id` in `sub` claim

---

## 🎯 Conclusion

**The codebase is correctly implemented and fully aligned with the database schema.** All authentication workflows from signup to account linking correctly use `users.id` (which matches `auth.users.id`) as the single source of truth for user identity.

