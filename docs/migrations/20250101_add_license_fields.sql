-- Migration: Ensure licenses table has required fields
-- Date: 2025-01-01
-- Description: Verifies licenses.status exists and is properly constrained

-- Check if licenses table exists (should already exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'licenses') THEN
    -- Create licenses table if it doesn't exist
    CREATE TABLE licenses (
      license_key VARCHAR(255) PRIMARY KEY,
      status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      notes TEXT
    );
  END IF;
END $$;

-- Ensure status column exists and has constraint
DO $$
BEGIN
  -- Add status column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'licenses' AND column_name = 'status'
  ) THEN
    ALTER TABLE licenses ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active';
  END IF;
  
  -- Add constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'licenses_status_check'
  ) THEN
    ALTER TABLE licenses ADD CONSTRAINT licenses_status_check 
    CHECK (status IN ('active', 'inactive'));
  END IF;
END $$;

-- Ensure indexes exist
CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);

-- Ensure trigger for updated_at exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_licenses_updated_at'
  ) THEN
    CREATE TRIGGER update_licenses_updated_at 
    BEFORE UPDATE ON licenses
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

