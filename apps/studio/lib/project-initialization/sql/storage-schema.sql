-- Storage Schema Initialization Script
-- This script creates the storage schema and all required tables for project-level file storage

-- Create storage schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS storage;

-- storage.buckets table
CREATE TABLE IF NOT EXISTS storage.buckets (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  owner UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  public BOOLEAN DEFAULT FALSE,
  avif_autodetection BOOLEAN DEFAULT FALSE,
  file_size_limit BIGINT,
  allowed_mime_types TEXT[]
);

-- storage.objects table
CREATE TABLE IF NOT EXISTS storage.objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id TEXT NOT NULL REFERENCES storage.buckets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  owner UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ,
  metadata JSONB,
  path_tokens TEXT[],
  version TEXT,
  UNIQUE(bucket_id, name)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_buckets_name ON storage.buckets(name);
CREATE INDEX IF NOT EXISTS idx_buckets_owner ON storage.buckets(owner);
CREATE INDEX IF NOT EXISTS idx_objects_bucket_id ON storage.objects(bucket_id);
CREATE INDEX IF NOT EXISTS idx_objects_owner ON storage.objects(owner);
CREATE INDEX IF NOT EXISTS idx_objects_name ON storage.objects(name);
CREATE INDEX IF NOT EXISTS idx_objects_bucket_name ON storage.objects(bucket_id, name);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA storage TO postgres;
GRANT ALL ON ALL TABLES IN SCHEMA storage TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA storage TO postgres;
