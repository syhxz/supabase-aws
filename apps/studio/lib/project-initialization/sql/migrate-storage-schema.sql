-- Migration Script for Storage Schema
-- This script adds missing columns to existing storage schemas
-- It is idempotent and can be run multiple times safely

-- Add public column to storage.buckets if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'storage' 
    AND table_name = 'buckets' 
    AND column_name = 'public'
  ) THEN
    ALTER TABLE storage.buckets 
    ADD COLUMN public BOOLEAN DEFAULT FALSE;
  END IF;
END $$ LANGUAGE plpgsql;

-- Add avif_autodetection column to storage.buckets if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'storage' 
    AND table_name = 'buckets' 
    AND column_name = 'avif_autodetection'
  ) THEN
    ALTER TABLE storage.buckets 
    ADD COLUMN avif_autodetection BOOLEAN DEFAULT FALSE;
  END IF;
END $$ LANGUAGE plpgsql;

-- Add file_size_limit column to storage.buckets if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'storage' 
    AND table_name = 'buckets' 
    AND column_name = 'file_size_limit'
  ) THEN
    ALTER TABLE storage.buckets 
    ADD COLUMN file_size_limit BIGINT;
  END IF;
END $$ LANGUAGE plpgsql;

-- Add allowed_mime_types column to storage.buckets if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'storage' 
    AND table_name = 'buckets' 
    AND column_name = 'allowed_mime_types'
  ) THEN
    ALTER TABLE storage.buckets 
    ADD COLUMN allowed_mime_types TEXT[];
  END IF;
END $$ LANGUAGE plpgsql;

-- Add path_tokens column to storage.objects if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'storage' 
    AND table_name = 'objects' 
    AND column_name = 'path_tokens'
  ) THEN
    ALTER TABLE storage.objects 
    ADD COLUMN path_tokens TEXT[];
  END IF;
END $$ LANGUAGE plpgsql;

-- Add version column to storage.objects if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'storage' 
    AND table_name = 'objects' 
    AND column_name = 'version'
  ) THEN
    ALTER TABLE storage.objects 
    ADD COLUMN version TEXT;
  END IF;
END $$ LANGUAGE plpgsql;

-- Create missing indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_buckets_name ON storage.buckets(name);
CREATE INDEX IF NOT EXISTS idx_buckets_owner ON storage.buckets(owner);
CREATE INDEX IF NOT EXISTS idx_objects_bucket_id ON storage.objects(bucket_id);
CREATE INDEX IF NOT EXISTS idx_objects_owner ON storage.objects(owner);
CREATE INDEX IF NOT EXISTS idx_objects_name ON storage.objects(name);
CREATE INDEX IF NOT EXISTS idx_objects_bucket_name ON storage.objects(bucket_id, name);