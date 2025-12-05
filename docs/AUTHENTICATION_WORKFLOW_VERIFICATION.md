# Authentication Workflow Verification

This document verifies that `database-schema.sql` correctly supports the complete authentication workflow from signup to account linking.

## ✅ Complete Authentication Flow

### 1. **User Signup** (`/auth/callback`)

**Code Action:**
```typescript
// Creates user with id matching Supabase Auth user id
.insert({
  id: data.user.id,  // Must match auth.users.id
  email: data.user.email,
  provider: data.user.app_metadata?.provider || 'email',
  email_verified: ...,
  license_key: '',
  notion_setup_complete: false,
  onboarding_complete: false,
})
```

**Schema Support:**
- ✅ `users.id` UUID PRIMARY KEY (no default) - matches `auth.users.id`
- ✅ All required columns exist: `email`, `provider`, `email_verified`, `license_key`, `notion_setup_complete`, `onboarding_complete`
- ✅ Foreign key constraint: `users.id` → `auth.users(id)` ON DELETE CASCADE
- ✅ Unique constraint on `email`
- ✅ RLS policy allows service role access

**Status:** ✅ **PERFECT MATCH**

---

### 2. **User Sync** (`/api/auth/sync-user`)

**Code Action:**
```typescript
// Looks up user by id (which equals auth_user_id parameter)
.eq('id', auth_user_id)

// Creates user if not exists
.insert({
  id: auth_user_id,  // Must match Supabase Auth user id
  email,
  provider,
  ...
})
```

**Schema Support:**
- ✅ `users.id` is primary key, no default
- ✅ Lookup by `id` is indexed (`idx_users_id`)
- ✅ Insert with explicit `id` works (no default conflicts)

**Status:** ✅ **PERFECT MATCH**

---

### 3. **Notion OAuth Initiation** (`/api/oauth/initiate`)

**Code Action:**
```typescript
// Creates OAuth session with auth_user_id
await createOAuthSession(
  state,
  email,
  licenseKey,
  amazonAccountId,
  codeVerifier,
  auth_user_id  // Stored in session
);
```

**Schema Support:**
- ✅ `oauth_sessions` table exists
- ✅ `oauth_sessions.auth_user_id` column exists (UUID)
- ✅ `oauth_sessions.state` is UNIQUE (for lookup)
- ✅ Index on `state` for fast retrieval
- ✅ Index on `auth_user_id` for queries
- ✅ RLS policy allows service role access

**Status:** ✅ **PERFECT MATCH**

---

### 4. **Notion OAuth Callback** (`/api/oauth/callback`)

**Code Action:**
```typescript
// Retrieves session by state
const session = await getOAuthSession(state);

// Gets auth_user_id from session
let authUserId = session.auth_user_id;

// Looks up user by id
.eq('id', authUserId)

// Updates user with Notion token
.update({
  notion_token: access_token,
  notion_setup_complete: true,
  ...
})
```

**Schema Support:**
- ✅ `oauth_sessions` can be queried by `state`
- ✅ `oauth_sessions.auth_user_id` provides user ID
- ✅ `users` table can be queried by `id`
- ✅ `users.notion_token` column exists (TEXT)
- ✅ `users.notion_setup_complete` column exists (BOOLEAN)
- ✅ All database ID columns exist (`privacy_page_id`, `tasks_db_id`, etc.)

**Status:** ✅ **PERFECT MATCH**

---

### 5. **Alexa Account Linking - Authorize** (`/api/oauth/authorize`)

**Code Action:**
```typescript
// Looks up user by id
.eq('id', authUserId)

// Stores authorization code
await storeAuthCode(
  code,
  user.id,  // user_id from users table
  clientId,
  redirectUri,
  scope,
  codeChallenge,
  codeChallengeMethod
);
```

**Schema Support:**
- ✅ `oauth_authorization_codes` table exists
- ✅ `oauth_authorization_codes.user_id` references `users(id)` ON DELETE CASCADE
- ✅ All required columns: `code`, `user_id`, `client_id`, `redirect_uri`, `scope`, `code_challenge`, `code_challenge_method`, `used`, `expires_at`
- ✅ Index on `user_id` for lookups
- ✅ Index on `expires_at` for cleanup
- ✅ Index on `used` for active code queries
- ✅ RLS policy allows service role access

**Status:** ✅ **PERFECT MATCH**

---

### 6. **Alexa Account Linking - Token** (`/api/oauth/token`)

**Code Action:**
```typescript
// Validates authorization code
const result = await validateAuthCode(code, clientId, redirectUri, codeVerifier);
// Queries oauth_authorization_codes by code
// Updates used = true, used_at = NOW()

// Issues access token
await issueAccessToken(
  userId,  // From authorization code
  clientId,
  scope
);
// Inserts into oauth_access_tokens
```

**Schema Support:**
- ✅ `oauth_authorization_codes` can be queried by `code`
- ✅ `oauth_authorization_codes.used` can be updated
- ✅ `oauth_authorization_codes.used_at` column exists
- ✅ `oauth_access_tokens` table exists
- ✅ `oauth_access_tokens.user_id` references `users(id)` ON DELETE CASCADE
- ✅ All required columns: `token`, `user_id`, `client_id`, `scope`, `issued_at`, `expires_at`, `revoked`, `revoked_at`
- ✅ Index on `user_id` for lookups
- ✅ Index on `revoked, expires_at` for active token queries
- ✅ RLS policy allows service role access

**Status:** ✅ **PERFECT MATCH**

---

### 7. **License Validation** (via opaque tokens)

**Code Action:**
```typescript
// Checks for active opaque tokens
const { data: tokens } = await supabase
  .from('oauth_access_tokens')
  .select('*')
  .eq('user_id', userId)
  .eq('revoked', false)
  .gt('expires_at', new Date().toISOString());
```

**Schema Support:**
- ✅ `oauth_access_tokens` table exists
- ✅ `oauth_access_tokens.user_id` references `users(id)`
- ✅ `oauth_access_tokens.revoked` column exists (BOOLEAN)
- ✅ `oauth_access_tokens.expires_at` column exists (TIMESTAMPTZ)
- ✅ Composite index on `revoked, expires_at` for efficient queries
- ✅ RLS policy allows service role access

**Status:** ✅ **PERFECT MATCH**

---

## 🔍 Schema Verification Checklist

### Users Table
- ✅ `id` UUID PRIMARY KEY (no default) - matches `auth.users.id`
- ✅ `email` VARCHAR(255) NOT NULL UNIQUE
- ✅ `provider`, `provider_id`, `email_verified` columns exist
- ✅ `amazon_account_id` VARCHAR(255) (nullable, unique when not null)
- ✅ `license_key` VARCHAR(255) (nullable)
- ✅ `notion_token` TEXT (nullable)
- ✅ `notion_setup_complete` BOOLEAN DEFAULT FALSE
- ✅ All database ID columns exist (`privacy_page_id`, `tasks_db_id`, etc.)
- ✅ `onboarding_complete` BOOLEAN DEFAULT FALSE
- ✅ `created_at`, `updated_at` TIMESTAMPTZ
- ✅ Foreign key: `users.id` → `auth.users(id)` ON DELETE CASCADE
- ✅ Indexes: `idx_users_id`, `idx_users_email`, `idx_users_amazon_account_id`
- ✅ Unique index on `amazon_account_id` (nullable)

### OAuth Sessions Table
- ✅ `id` UUID PRIMARY KEY DEFAULT uuid_generate_v4()
- ✅ `state` VARCHAR(255) UNIQUE NOT NULL
- ✅ `email` VARCHAR(255) NOT NULL
- ✅ `auth_user_id` UUID (nullable) - **MUST EXIST for OAuth flow**
- ✅ `license_key`, `amazon_account_id`, `code_verifier` columns exist
- ✅ `expires_at` TIMESTAMPTZ NOT NULL
- ✅ Indexes: `idx_oauth_sessions_state`, `idx_oauth_sessions_auth_user_id`
- ✅ RLS policy allows service role access

### OAuth2 Authorization Codes Table
- ✅ `code` TEXT PRIMARY KEY
- ✅ `user_id` UUID NOT NULL REFERENCES `users(id)` ON DELETE CASCADE
- ✅ `client_id`, `redirect_uri`, `scope` columns exist
- ✅ `code_challenge`, `code_challenge_method` columns exist (PKCE)
- ✅ `used` BOOLEAN DEFAULT FALSE
- ✅ `used_at` TIMESTAMPTZ (nullable)
- ✅ `expires_at` TIMESTAMPTZ NOT NULL
- ✅ `created_at` TIMESTAMPTZ DEFAULT NOW()
- ✅ Indexes: `idx_oauth_auth_codes_user_id`, `idx_oauth_auth_codes_expires_at`, `idx_oauth_auth_codes_used`
- ✅ RLS policy allows service role access

### OAuth2 Access Tokens Table
- ✅ `token` TEXT PRIMARY KEY (opaque token, not JWT)
- ✅ `user_id` UUID NOT NULL REFERENCES `users(id)` ON DELETE CASCADE
- ✅ `client_id`, `scope` columns exist
- ✅ `issued_at` TIMESTAMPTZ DEFAULT NOW()
- ✅ `expires_at` TIMESTAMPTZ NOT NULL
- ✅ `revoked` BOOLEAN DEFAULT FALSE
- ✅ `revoked_at` TIMESTAMPTZ (nullable)
- ✅ `created_at` TIMESTAMPTZ DEFAULT NOW()
- ✅ Indexes: `idx_oauth_access_tokens_user_id`, `idx_oauth_access_tokens_revoked`, `idx_oauth_access_tokens_expires_at`
- ✅ RLS policy allows service role access

### OAuth2 Refresh Tokens Table
- ✅ `token` TEXT PRIMARY KEY
- ✅ `user_id` UUID NOT NULL REFERENCES `users(id)` ON DELETE CASCADE
- ✅ `client_id` TEXT NOT NULL
- ✅ `issued_at`, `revoked`, `revoked_at`, `created_at` columns exist
- ✅ Indexes: `idx_oauth_refresh_tokens_user_id`, `idx_oauth_refresh_tokens_revoked`
- ✅ RLS policy allows service role access

### Website Refresh Tokens Table
- ✅ `token` TEXT PRIMARY KEY
- ✅ `user_id` UUID NOT NULL REFERENCES `users(id)` ON DELETE CASCADE
- ✅ `expires_at` TIMESTAMPTZ NOT NULL
- ✅ `revoked`, `revoked_at`, `issued_at`, `created_at` columns exist
- ✅ Indexes: `idx_website_refresh_tokens_user_id`, `idx_website_refresh_tokens_expires_at`, `idx_website_refresh_tokens_revoked`
- ✅ RLS policy allows service role access

### Licenses Table
- ✅ `stripe_payment_intent_id` VARCHAR(255) PRIMARY KEY
- ✅ `license_key` VARCHAR(255) (nullable)
- ✅ `status` VARCHAR(20) NOT NULL DEFAULT 'active'
- ✅ Stripe fields: `stripe_customer_id`, `amount_paid`, `currency`, `purchase_date`
- ✅ Indexes: `idx_licenses_status`, `idx_licenses_stripe_payment_intent_id`, `idx_licenses_stripe_customer_id`
- ✅ RLS policy allows service role access

---

## 🎯 Critical Identity Alignment

### ✅ Correct Implementation
- `users.id` = `auth.users.id` (one source of truth)
- No `auth_user_id` column in `users` table
- No default on `users.id` (must match Supabase Auth exactly)
- `oauth_sessions.auth_user_id` exists (temporary OAuth state storage)

### ✅ Foreign Key Integrity
- All OAuth2 tables reference `users(id)` correctly
- `ON DELETE CASCADE` ensures cleanup when user is deleted
- Foreign key constraint to `auth.users(id)` ensures data integrity

### ✅ Indexes for Performance
- All lookup columns are indexed
- Composite indexes for common query patterns
- Unique indexes where needed

### ✅ RLS Policies
- All tables have service role policies
- Allows application to access all tables via service key
- Prevents unauthorized access

---

## ✅ Final Verdict

**The `database-schema.sql` is PERFECTLY ALIGNED with the authentication workflow.**

Every step from signup to account linking is fully supported:
1. ✅ User signup creates record with correct `id`
2. ✅ User sync works with `id` lookup
3. ✅ OAuth sessions store `auth_user_id` correctly
4. ✅ OAuth callback retrieves user by `id`
5. ✅ Authorization codes reference `users.id` correctly
6. ✅ Access tokens reference `users.id` correctly
7. ✅ License validation queries tokens correctly

**No changes needed. The schema is production-ready.**

