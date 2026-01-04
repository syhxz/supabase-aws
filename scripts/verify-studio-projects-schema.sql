-- Schema Verification Script for studio_projects table
-- This script verifies that the studio_projects table has all required fields
-- including the new password-related fields for user authentication display

-- Check if the table exists and has all required columns
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'studio_projects'
ORDER BY ordinal_position;

-- Check if all required indexes exist
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'studio_projects' 
  AND schemaname = 'public'
ORDER BY indexname;

-- Check if the trigger exists
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'studio_projects'
  AND event_object_schema = 'public';

-- Check table and column comments
SELECT 
    obj_description(c.oid) as table_comment
FROM pg_class c 
JOIN pg_namespace n ON n.oid = c.relnamespace 
WHERE c.relname = 'studio_projects' 
  AND n.nspname = 'public';

SELECT 
    a.attname as column_name,
    col_description(a.attrelid, a.attnum) as column_comment
FROM pg_attribute a
JOIN pg_class c ON c.oid = a.attrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relname = 'studio_projects' 
  AND n.nspname = 'public'
  AND a.attnum > 0 
  AND NOT a.attisdropped
ORDER BY a.attnum;