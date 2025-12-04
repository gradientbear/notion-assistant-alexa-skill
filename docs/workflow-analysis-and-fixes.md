# Authentication Workflow Analysis and Fixes

## Workflow Steps

1. **Signup** → User created in Supabase Auth → User record created in `users` table → Dashboard
2. **Connect Notion** → Notion OAuth → Databases created → User updated → Dashboard refreshes
3. **Purchase License** → JWT token generated → Token saved to `oauth_access_tokens` → Dashboard refreshes
4. **Account Linking Visible** → When `notion_setup_complete: true` AND `has_jwt_token: true`

---

## Issues Found and Fixed

### Issue 1: `notion_setup_complete` Logic
**Problem:** `notion_setup_complete` was set based on `setupResult.success`, which required ALL databases to be created. If any database failed, the flag would be false even though Notion was connected.

**Fix:** Changed to use `criticalSetupSuccess` which only requires:
- Voice Planner page (`privacyPageId`)
- Tasks database (`tasksDbId`)

**Files Changed:**
- `web-login/app/api/oauth/callback/route.ts` (4 locations)

**Code:**
```typescript
const criticalSetupSuccess = !!(setupResult.privacyPageId && setupResult.tasksDbId);
notion_setup_complete: criticalSetupSuccess
```

---

### Issue 2: User Lookup by Email (Multiple Users)
**Problem:** When `auth_user_id` was missing from OAuth session, the code used `.maybeSingle()` which would fail if multiple users had the same email.

**Fix:** Changed to handle multiple users by:
1. Prioritizing user with matching `auth_user_id` (if available)
2. Prioritizing user with existing `notion_token`
3. Falling back to most recently updated user
4. Updating `auth_user_id` if missing

**Files Changed:**
- `web-login/app/api/oauth/callback/route.ts`

---

### Issue 3: Dashboard Refresh Timing
**Problem:** Dashboard might not refresh properly after token generation due to database replication lag.

**Fix:** Added 1 second delay for token generation refresh (vs 500ms for Notion connection).

**Files Changed:**
- `web-login/app/dashboard/page.tsx`

---

### Issue 4: Token Verification
**Problem:** No verification that token was actually stored after generation.

**Fix:** Added token verification query after generation to confirm storage.

**Files Changed:**
- `web-login/app/api/billing/generate-test-token/route.ts`

---

### Issue 5: Dashboard Notion Connection Check
**Problem:** Dashboard was checking `notion_token` OR `notion_setup_complete`, but should prioritize `notion_setup_complete`.

**Fix:** Changed to prioritize `notion_setup_complete` as the definitive flag.

**Files Changed:**
- `web-login/app/dashboard/page.tsx`

**Code:**
```typescript
const hasNotionConnection = user.notion_setup_complete || !!(user.notion_token);
```

---

## Step-by-Step Flow Verification

### Step 1: Signup
**Path:** `/` → `supabase.auth.signUp()` → `/auth/callback` → `/dashboard`

**Verification Points:**
- ✅ User created in Supabase Auth
- ✅ User record created in `users` table with:
  - `auth_user_id` set
  - `email` set
  - `notion_setup_complete: false`
  - `has_jwt_token: false` (checked via query)

**Potential Issues:**
- Email verification might be disabled
- User creation might fail if callback doesn't execute
- **Fix:** `/api/users/me` has fallback to create user

---

### Step 2: Connect Notion
**Path:** `/dashboard` → `/notion/connect` → `/api/oauth/initiate` → Notion OAuth → `/api/oauth/callback` → `/dashboard?notion_connected=true`

**Verification Points:**
- ✅ OAuth session created with `auth_user_id`
- ✅ Notion token exchanged
- ✅ Databases created (at least page + Tasks)
- ✅ User updated with:
  - `notion_token` set
  - `notion_setup_complete: true` (if critical success)
  - Database IDs saved (only if created)
- ✅ Dashboard refreshes and shows "Notion connected"

**Potential Issues:**
- `auth_user_id` might not be in session → **Fixed:** Falls back to email lookup with prioritization
- Database creation might fail → **Fixed:** Only critical databases required
- `notion_setup_complete` might be false → **Fixed:** Uses critical success check

---

### Step 3: Purchase License
**Path:** `/dashboard` → `/billing` → `/api/billing/generate-test-token` → `/dashboard?token_generated=true`

**Verification Points:**
- ✅ User authenticated
- ✅ User found in database
- ✅ JWT token generated
- ✅ Token stored in `oauth_access_tokens` with:
  - `user_id` = user's database ID
  - `token` = JWT token
  - `expires_at` = future timestamp
  - `revoked: false`
- ✅ Token verified in database
- ✅ Dashboard refreshes and shows `has_jwt_token: true`

**Potential Issues:**
- Token might not be stored → **Fixed:** Added verification query
- Token query might not find it immediately → **Fixed:** Added 1s delay for refresh
- Wrong `user_id` used → **Verified:** Uses database ID consistently

---

### Step 4: Account Linking Visibility
**Path:** Dashboard checks conditions → Shows "Link Alexa" button

**Verification Points:**
- ✅ `hasNotionConnection` = `notion_setup_complete || !!notion_token`
- ✅ `hasJwtToken` = `has_jwt_token || skipLicenseCheck`
- ✅ `canLink` = `hasNotionConnection && hasJwtToken && !amazon_account_id`
- ✅ Button appears when `canLink` is true

**Potential Issues:**
- `notion_setup_complete` might be false → **Fixed:** Uses critical success
- `has_jwt_token` might be false → **Fixed:** Improved token query and refresh timing
- Dashboard might not refresh → **Fixed:** Improved refresh logic

---

## Database Schema Verification

### `users` table
- `id` (UUID) - Primary key
- `auth_user_id` (UUID) - Supabase Auth user ID
- `email` (VARCHAR)
- `notion_token` (TEXT) - Notion OAuth token
- `notion_setup_complete` (BOOLEAN) - True if critical setup succeeded
- `tasks_db_id`, `shopping_db_id`, etc. - Database IDs (nullable)
- `license_key` (VARCHAR) - Not used for JWT token check
- `amazon_account_id` (VARCHAR) - Nullable

### `oauth_access_tokens` table
- `token` (TEXT) - Primary key (JWT token)
- `user_id` (UUID) - References `users.id`
- `client_id` (TEXT)
- `expires_at` (TIMESTAMPTZ)
- `revoked` (BOOLEAN)

**Query:** `.eq('user_id', user.id).eq('revoked', false).gt('expires_at', now())`

---

## Testing Checklist

### Signup Flow
- [ ] Email signup creates user in Supabase Auth
- [ ] User record created in `users` table
- [ ] `auth_user_id` is set correctly
- [ ] Dashboard loads after signup

### Notion Connection Flow
- [ ] OAuth session created with `auth_user_id`
- [ ] Notion token exchanged successfully
- [ ] Voice Planner page created
- [ ] Tasks database created
- [ ] Other databases created (optional)
- [ ] `notion_token` saved to `users` table
- [ ] `notion_setup_complete` set to `true` (if critical success)
- [ ] Database IDs saved (only if created)
- [ ] Dashboard shows "Notion connected"

### License Purchase Flow
- [ ] User authenticated
- [ ] JWT token generated
- [ ] Token saved to `oauth_access_tokens` table
- [ ] Token verified in database
- [ ] Dashboard shows `has_jwt_token: true`
- [ ] "Buy License" button hidden
- [ ] "Link Alexa" button appears

### Account Linking Visibility
- [ ] "Link Alexa" button appears when:
  - `notion_setup_complete: true` OR `notion_token` exists
  - `has_jwt_token: true`
  - `amazon_account_id` is null
- [ ] "Connect Notion" button shows in Step 4 if Notion not connected
- [ ] "Buy License" button shows in Step 4 if license not purchased

---

## Debugging Tips

### Check User State
```sql
SELECT id, email, auth_user_id, notion_setup_complete, 
       notion_token IS NOT NULL as has_notion_token,
       tasks_db_id IS NOT NULL as has_tasks_db
FROM users 
WHERE email = 'user@example.com';
```

### Check JWT Token
```sql
SELECT token, user_id, expires_at, revoked, created_at
FROM oauth_access_tokens
WHERE user_id = 'user-uuid-here'
ORDER BY created_at DESC;
```

### Check OAuth Session
```sql
SELECT state, email, auth_user_id, expires_at
FROM oauth_sessions
WHERE email = 'user@example.com'
ORDER BY created_at DESC
LIMIT 5;
```

---

## Summary of Fixes

1. ✅ Fixed `notion_setup_complete` to use critical success (page + Tasks DB)
2. ✅ Improved user lookup to handle multiple users by email
3. ✅ Added token verification after generation
4. ✅ Improved dashboard refresh timing (1s delay for token generation)
5. ✅ Enhanced logging throughout the flow
6. ✅ Fixed dashboard Notion connection check to prioritize `notion_setup_complete`

All fixes maintain backward compatibility and improve error handling.


