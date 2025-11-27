# Database Migration Instructions

If you're getting an error like "column 'auth_user_id' does not exist", it means you have an existing database and need to run the migration script.

## Quick Fix

**Run this migration script first:**
```sql
-- File: docs/migration-add-auth-fields.sql
```

This script will:
1. Add all new columns to existing tables
2. Make `amazon_account_id` and `license_key` nullable
3. Create necessary indexes
4. Update existing rows with default values

## Step-by-Step

### Option 1: Fresh Database (No Existing Data)

If you're starting fresh, just run:
```sql
-- File: docs/supabase-schema.sql
```

### Option 2: Existing Database (You Have Data)

1. **First, run the migration script:**
   ```sql
   -- Copy and paste contents of docs/migration-add-auth-fields.sql
   -- into Supabase SQL Editor and execute
   ```

2. **Then, run the main schema (optional - for any missing tables):**
   ```sql
   -- File: docs/supabase-schema.sql
   -- This will create any missing tables/indexes
   ```

## What the Migration Does

The migration script (`migration-add-auth-fields.sql`) will:

✅ Add `auth_user_id` column (UUID, nullable)
✅ Add `password_hash` column (TEXT, nullable)
✅ Add `email_verified` column (BOOLEAN, default FALSE)
✅ Add `provider` column (VARCHAR, default 'email')
✅ Add `provider_id` column (VARCHAR, nullable)
✅ Add `onboarding_complete` column (BOOLEAN, default FALSE)
✅ Add Notion setup columns if missing
✅ Make `amazon_account_id` nullable
✅ Make `license_key` nullable
✅ Create indexes on new columns
✅ Update existing rows with defaults

## Verification

After running the migration, verify it worked:

```sql
-- Check if columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;

-- Should see: auth_user_id, email_verified, provider, etc.
```

## Troubleshooting

### Error: "column already exists"
- This is fine! The migration uses `ADD COLUMN IF NOT EXISTS`
- Just continue - it means the column was already added

### Error: "constraint does not exist"
- This is fine! The migration handles this gracefully
- The column might already be nullable

### Error: "index already exists"
- This is fine! The migration uses `CREATE INDEX IF NOT EXISTS`
- Just continue

## After Migration

Once the migration completes successfully:
1. Your existing data will be preserved
2. New columns will have default values
3. You can start using the new authentication system
4. Existing users will need to complete onboarding

