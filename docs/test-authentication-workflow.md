# Authentication Workflow Test Plan
## From Sign In/Sign Up to Buy License

### Test Scenarios

#### 1. Email Sign Up Flow
**Steps:**
1. Navigate to `/` (home page)
2. Click "Sign Up" tab
3. Enter email: `test@example.com`
4. Enter password: `Test1234!` (min 8 chars, uppercase, lowercase, number)
5. Confirm password: `Test1234!`
6. Click "Create Account"
7. Check email for verification link
8. Click verification link
9. Should redirect to `/auth/callback`
10. Should redirect to `/dashboard`

**Expected Results:**
- ✅ User account created in Supabase Auth
- ✅ User record created in `users` table with:
  - `auth_user_id` set
  - `email` set
  - `email_verified: true` (after clicking verification link)
  - `notion_setup_complete: false`
  - `license_key: ''`
  - `has_jwt_token: false`
- ✅ Dashboard shows:
  - Step 1: Account Created ✓
  - Step 2: Connect Notion (current)
  - Step 3: Buy License (pending)
  - Step 4: Link Alexa (pending)

**Potential Issues:**
- Email verification might be disabled in Supabase (check settings)
- User might not be created in `users` table if callback fails
- Dashboard might show loading state indefinitely

---

#### 2. Email Sign In Flow
**Steps:**
1. Navigate to `/`
2. Ensure "Sign In" tab is active
3. Enter email: `test@example.com`
4. Enter password: `Test1234!`
5. Click "Sign In"
6. Should redirect to `/dashboard`

**Expected Results:**
- ✅ Session created in Supabase
- ✅ User authenticated
- ✅ Dashboard loads with user data
- ✅ If user doesn't exist in `users` table, `/api/users/me` creates it

**Potential Issues:**
- If email not verified, sign in might fail
- Session might not persist
- User sync might fail

---

#### 3. Google OAuth Sign Up/Sign In Flow
**Steps:**
1. Navigate to `/`
2. Click "Sign in with Google" button
3. Complete Google OAuth flow
4. Should redirect to `/auth/callback`
5. Should redirect to `/dashboard`

**Expected Results:**
- ✅ Google OAuth redirects to correct callback URL
- ✅ User authenticated via Google
- ✅ User record created/updated in `users` table with:
  - `provider: 'google'`
  - `email_verified: true` (Google emails are pre-verified)
  - `auth_user_id` set
- ✅ Dashboard loads correctly

**Potential Issues:**
- OAuth redirect URI mismatch
- Cookie handling issues (Supabase sets cookies client-side)
- User creation might fail if callback doesn't execute properly

---

#### 4. Connect Notion Flow
**Steps:**
1. After sign in, navigate to `/dashboard`
2. Click "Connect Notion" button in Step 2
3. Should redirect to `/notion/connect`
4. Click "Connect Notion" button
5. Complete Notion OAuth flow
6. Should redirect to `/api/oauth/callback`
7. Should redirect to `/dashboard?notion_connected=true`

**Expected Results:**
- ✅ Notion OAuth session created
- ✅ Notion workspace setup executed:
  - Voice Planner page created
  - Tasks database created
  - Shopping database created
  - Workouts database created
  - Meals database created
  - Notes database created
  - Energy_Logs database created
- ✅ User record updated with:
  - `notion_token` set
  - `notion_setup_complete: true`
  - Database IDs saved (`tasks_db_id`, `shopping_db_id`, etc.)
- ✅ Dashboard refreshes and shows:
  - Step 2: ✓ Notion connected (with "Reconnect Notion" button)
  - Step 3: Buy License (current)

**Potential Issues:**
- Notion databases might fail to create (API rate limits)
- Database IDs might not be saved correctly
- `notion_setup_complete` might be false even if databases created
- Dashboard might not refresh after redirect

---

#### 5. Buy License Flow
**Steps:**
1. After connecting Notion, click "Buy License" button in Step 3
2. Should redirect to `/billing`
3. Click "Buy Lifetime License" button
4. Should call `/api/billing/generate-test-token`
5. Should redirect to `/dashboard?token_generated=true`

**Expected Results:**
- ✅ JWT token generated and stored in `oauth_access_tokens` table:
  - `user_id` matches user's ID
  - `token` is a valid JWT
  - `expires_at` is in the future
  - `revoked: false`
- ✅ Dashboard refreshes and shows:
  - Step 3: ✓ License activated
  - Step 4: Link Alexa (current) - "Link Alexa" button visible

**Potential Issues:**
- Token might not be generated
- Token might not be saved to database
- `has_jwt_token` might still be false after purchase
- Dashboard might not refresh

---

#### 6. Complete Flow Test (End-to-End)
**Steps:**
1. Sign up with email
2. Verify email
3. Sign in
4. Connect Notion
5. Buy License
6. Verify all steps show as complete

**Expected Final State:**
- ✅ Step 1: Account Created ✓
- ✅ Step 2: Notion Connected ✓ (with "Reconnect Notion" button)
- ✅ Step 3: License Activated ✓
- ✅ Step 4: Link Alexa (current) - "Link Alexa" button visible

**Database State:**
- ✅ `users` table:
  - `notion_setup_complete: true`
  - `notion_token` exists
  - Database IDs populated
- ✅ `oauth_access_tokens` table:
  - Active token exists for user
  - Token not expired
  - Token not revoked

---

### Common Issues and Debugging

#### Issue: User not created in `users` table
**Check:**
- `/auth/callback` logs for user creation
- `/api/users/me` logs for fallback creation
- Supabase RLS policies
- Database connection

#### Issue: Notion connection fails
**Check:**
- Notion OAuth credentials
- Notion API rate limits
- Database creation logs in `/api/oauth/notion-setup.ts`
- `notion_setup_complete` flag in database

#### Issue: JWT token not detected
**Check:**
- `/api/users/me` token query logs
- `oauth_access_tokens` table for user's token
- Token expiration time
- Token revocation status

#### Issue: Dashboard not updating
**Check:**
- Browser console for errors
- Network tab for API calls
- Query parameters (`notion_connected`, `token_generated`)
- `useEffect` hooks in dashboard

---

### Manual Test Checklist

- [ ] Email sign up creates user
- [ ] Email verification works
- [ ] Email sign in works
- [ ] Google OAuth sign in works
- [ ] User record created in `users` table
- [ ] Dashboard loads after sign in
- [ ] Notion connection creates databases
- [ ] Notion database IDs saved to `users` table
- [ ] `notion_setup_complete` set to true
- [ ] Dashboard shows "Notion connected" after connection
- [ ] License purchase generates JWT token
- [ ] JWT token saved to `oauth_access_tokens` table
- [ ] Dashboard shows `has_jwt_token: true` after purchase
- [ ] "Buy License" button hidden after purchase
- [ ] "Link Alexa" button appears after purchase
- [ ] All steps show correct status

---

### Automated Test Script (Future)

```typescript
// Example test structure (not implemented)
describe('Authentication Workflow', () => {
  it('should sign up user and create database record', async () => {
    // Test sign up
  });
  
  it('should connect Notion and create databases', async () => {
    // Test Notion connection
  });
  
  it('should purchase license and generate JWT token', async () => {
    // Test license purchase
  });
});
```

---

### Environment Variables Required

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY`
- `NOTION_CLIENT_ID`
- `NOTION_CLIENT_SECRET`
- `NOTION_REDIRECT_URI`
- `JWT_SECRET`
- `ALEXA_OAUTH_CLIENT_ID`

---

### Notes

- Email verification might be disabled in development
- OAuth flows require proper redirect URIs configured
- Notion API has rate limits (might need retries)
- JWT tokens expire (default 3600 seconds)
- Dashboard refresh relies on query parameters


