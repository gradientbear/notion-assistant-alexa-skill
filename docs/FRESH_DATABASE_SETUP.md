# Fresh Database Setup Guide

This guide is for setting up a completely fresh database from scratch.

## Quick Start

1. **Delete all existing tables** (if any)
   - Go to Supabase Dashboard → Table Editor
   - Delete all tables manually, OR
   - Run: `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` (⚠️ This deletes EVERYTHING)

2. **Run the complete schema**
   - Open `docs/supabase-schema.sql`
   - Copy entire contents
   - Paste into Supabase SQL Editor
   - Click "Run" or press Ctrl+Enter

3. **Verify setup**
   - Check that 3 tables exist: `users`, `licenses`, `oauth_sessions`
   - Verify columns in `users` table include: `auth_user_id`, `email_verified`, `provider`, etc.

## What Gets Created

### Tables

1. **users** - Main user table with:
   - Authentication fields (auth_user_id, email, provider, etc.)
   - Alexa integration (amazon_account_id)
   - Notion integration (notion_token, database IDs)
   - License key
   - Onboarding tracking

2. **licenses** - License key management
   - license_key (primary key)
   - status (active/inactive)
   - notes

3. **oauth_sessions** - Temporary OAuth state storage
   - state (unique)
   - email, license_key, amazon_account_id, auth_user_id
   - expires_at

### Indexes

- `idx_users_auth_user_id` - Fast lookup by Supabase Auth ID
- `idx_users_email` - Fast lookup by email
- `idx_users_amazon_account_id` - Fast lookup by Amazon ID
- `idx_users_amazon_account_id_unique` - Unique constraint (allows NULL)
- `idx_licenses_status` - Fast license status lookup
- `idx_oauth_sessions_state` - Fast OAuth session lookup
- `idx_oauth_sessions_expires_at` - For cleanup queries

### Triggers

- `update_users_updated_at` - Auto-update updated_at on user changes
- `update_licenses_updated_at` - Auto-update updated_at on license changes

### Security

- Row Level Security (RLS) enabled on all tables
- Service role policies for full access
- Secure by default

## Verification

After running the schema, verify with these queries:

```sql
-- Check tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'licenses', 'oauth_sessions');

-- Check users table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;

-- Check indexes
SELECT indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename = 'users';
```

## Adding Test Data

After setup, you can add test licenses:

```sql
INSERT INTO licenses (license_key, status, notes) VALUES
  ('TEST-LICENSE-001', 'active', 'Test license key'),
  ('TEST-LICENSE-002', 'active', 'Another test license');
```

## Next Steps

1. ✅ Database schema is ready
2. Configure Supabase Auth providers
3. Set up environment variables
4. Test authentication flow
5. Deploy application

---

**Note**: This schema is designed for the new authentication system with email/password and social login support.

