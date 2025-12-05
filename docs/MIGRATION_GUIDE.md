# Migration Guide: User Identity Alignment

This guide explains how to apply the migration that fixes identity alignment between Supabase Auth and the `users` table.

## Overview

This migration ensures that `users.id` matches `auth.users.id` directly, eliminating the need for a separate `auth_user_id` column. This creates a single source of truth for user identity.

## Migration Files

- **Forward Migration**: `docs/migrations/002_fix_user_identity_alignment.sql`
- **Rollback Migration**: `docs/migrations/002_fix_user_identity_alignment_rollback.sql`

## How to Apply

### Step 1: Backup Your Database

**CRITICAL**: Always backup your database before running migrations.

```sql
-- Create a backup (example for Supabase)
-- Use Supabase dashboard or pg_dump
```

### Step 2: Review the Migration

Read through `docs/migrations/002_fix_user_identity_alignment.sql` to understand what it does:

1. Syncs `users.id` with `auth_user_id` values
2. Removes default from `id` column
3. Makes `id` the primary key
4. Adds foreign key constraint to `auth.users(id)`
5. Drops `auth_user_id` column
6. Updates indexes and constraints

### Step 3: Run the Migration

1. Open Supabase SQL Editor
2. Copy the contents of `docs/migrations/002_fix_user_identity_alignment.sql`
3. Execute the migration
4. Verify no errors occurred

### Step 4: Verify Migration Success

Run these verification queries:

```sql
-- Check users table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;

-- Verify auth_user_id column is gone
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'auth_user_id';
-- Should return 0 rows

-- Check foreign key constraint exists
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'users';
```

### Step 5: Deploy Code Changes

After the migration is successful, deploy the updated code:

1. All user lookups now use `id` instead of `auth_user_id`
2. User creation uses `id` directly from Supabase Auth
3. JWT tokens use `users.id` as the `sub` claim

## Rollback Procedure

If you need to rollback:

1. **STOP**: Deploy the old code first (before rolling back database)
2. Run `docs/migrations/002_fix_user_identity_alignment_rollback.sql`
3. Verify rollback success

**Note**: After rollback, you'll need to update your application code to use `auth_user_id` again.

## Testing Checklist

After migration, test these flows:

- [ ] User signup/login via Supabase Auth
- [ ] OAuth authorization flow (`/api/oauth/authorize`)
- [ ] Alexa account linking
- [ ] Notion connection
- [ ] License validation
- [ ] Website JWT token issuance and refresh
- [ ] User profile updates
- [ ] Stripe checkout and webhook processing

## Common Issues

### Issue: Foreign Key Constraint Fails

**Error**: `Could not add foreign key constraint to auth.users(id)`

**Solution**: You may need superuser permissions. In Supabase, this constraint may not be necessary if RLS policies are properly configured. The migration will log a warning but continue.

### Issue: Users with Mismatched IDs

**Error**: Some users have `id != auth_user_id`

**Solution**: The migration automatically syncs these with:
```sql
UPDATE users SET id = auth_user_id WHERE id != auth_user_id;
```

### Issue: Duplicate Users

**Error**: Multiple users with same `auth_user_id`

**Solution**: The migration handles this by syncing IDs first. If duplicates persist, you may need to manually merge user records before migration.

## Post-Migration

After successful migration:

1. Monitor application logs for any errors
2. Verify all user lookups work correctly
3. Check that OAuth flows complete successfully
4. Ensure Alexa linking works end-to-end

## Support

If you encounter issues:

1. Check application logs
2. Review database constraints
3. Verify RLS policies allow service role access
4. Ensure all code changes are deployed

