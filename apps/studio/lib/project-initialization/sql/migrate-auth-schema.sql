-- Migration Script for Auth Schema
-- This script adds missing columns and tables to existing auth schemas
-- It is idempotent and can be run multiple times safely

-- Add instance_id column to auth.users if it doesn't exist
DO $
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'auth' 
    AND table_name = 'users' 
    AND column_name = 'instance_id'
  ) THEN
    ALTER TABLE auth.users 
    ADD COLUMN instance_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid;
    
    -- Create index for instance_id
    CREATE INDEX IF NOT EXISTS idx_users_instance_id ON auth.users(instance_id);
  END IF;
END $;

-- Add is_anonymous column to auth.users if it doesn't exist
DO $
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'auth' 
    AND table_name = 'users' 
    AND column_name = 'is_anonymous'
  ) THEN
    ALTER TABLE auth.users 
    ADD COLUMN is_anonymous BOOLEAN DEFAULT FALSE;
  END IF;
END $;

-- Add deleted_at column to auth.users if it doesn't exist
DO $
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'auth' 
    AND table_name = 'users' 
    AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE auth.users 
    ADD COLUMN deleted_at TIMESTAMPTZ;
  END IF;
END $;

-- Create auth.identities table if it doesn't exist (GoTrue standard schema)
CREATE TABLE IF NOT EXISTS auth.identities (
  provider_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  identity_data JSONB NOT NULL,
  provider TEXT NOT NULL,
  last_sign_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  email TEXT GENERATED ALWAYS AS (lower(identity_data->>'email')) STORED,
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  PRIMARY KEY (id),
  UNIQUE (provider_id, provider)
);

-- Create indexes for identities table if they don't exist
CREATE INDEX IF NOT EXISTS idx_identities_user_id ON auth.identities(user_id);
CREATE INDEX IF NOT EXISTS idx_identities_email ON auth.identities(email);
CREATE INDEX IF NOT EXISTS identities_email_idx ON auth.identities(email text_pattern_ops);
CREATE INDEX IF NOT EXISTS identities_user_id_idx ON auth.identities(user_id);

-- Create email identity records for existing users who don't have them
-- This uses ON CONFLICT to ensure idempotence
INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
SELECT 
  u.id::text AS provider_id,  -- For email provider, provider_id is the user_id
  u.id AS user_id,
  jsonb_build_object(
    'sub', u.id::text,
    'email', u.email,
    'email_verified', CASE WHEN u.email_confirmed_at IS NOT NULL THEN true ELSE false END,
    'phone_verified', false
  ) AS identity_data,
  'email' AS provider,
  COALESCE(u.created_at, NOW()) AS created_at,
  COALESCE(u.updated_at, NOW()) AS updated_at
FROM auth.users u
WHERE u.email IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM auth.identities i 
    WHERE i.provider_id = u.id::text 
    AND i.provider = 'email'
  )
ON CONFLICT (provider_id, provider) DO NOTHING;

-- Update instance_id for any existing users that might have NULL values
-- (This shouldn't happen with the DEFAULT constraint, but ensures data consistency)
UPDATE auth.users 
SET instance_id = '00000000-0000-0000-0000-000000000000'::uuid 
WHERE instance_id IS NULL;
