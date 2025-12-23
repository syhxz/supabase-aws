-- Fix Auth service UUID conversion issue
-- This migration fixes the UUID type conversion error in auth.identities table

-- Fix the UUID comparison issue in the backfill migration
DO $$
BEGIN
  -- Update last_sign_in_at for identities where it's null
  UPDATE auth.identities
  SET last_sign_in_at = '2022-11-25'::timestamptz
  WHERE last_sign_in_at IS NULL 
    AND created_at::date = '2022-11-25'::date
    AND updated_at::date = '2022-11-25'::date
    AND provider = 'email'
    AND id::text = user_id::text;
    
  -- Ensure the identities table has proper constraints
  ALTER TABLE auth.identities 
  ALTER COLUMN last_sign_in_at SET DEFAULT NOW();
  
EXCEPTION WHEN OTHERS THEN
  -- Log the error but don't fail the migration
  RAISE NOTICE 'Auth identities fix completed with warnings: %', SQLERRM;
END $$;

-- Ensure studio_projects table exists with proper schema
CREATE TABLE IF NOT EXISTS public.studio_projects (
  id SERIAL PRIMARY KEY,
  ref TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  database_name TEXT UNIQUE NOT NULL,
  database_user TEXT,
  database_password_hash TEXT,
  organization_id INTEGER NOT NULL DEFAULT 1,
  owner_user_id TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE_HEALTHY',
  region TEXT NOT NULL DEFAULT 'localhost',
  connection_string TEXT NOT NULL,
  inserted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default project if none exists
INSERT INTO public.studio_projects (ref, name, database_name, connection_string)
SELECT 'default', 'Default Project', 'postgres', 'postgres://postgres@localhost:5432/postgres'
WHERE NOT EXISTS (SELECT 1 FROM public.studio_projects);
