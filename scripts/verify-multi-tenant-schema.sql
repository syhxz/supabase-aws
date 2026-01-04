-- Verification script for multi-tenant data isolation schema
-- This script verifies that all tables, indexes, and constraints are properly created

-- Check if all required tables exist
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('studio_projects', 'monitoring_data', 'advisor_data', 'log_data')
ORDER BY table_name;

-- Check foreign key constraints
SELECT 
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('monitoring_data', 'advisor_data', 'log_data')
ORDER BY tc.table_name, tc.constraint_name;

-- Check indexes
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename IN ('studio_projects', 'monitoring_data', 'advisor_data', 'log_data')
ORDER BY tablename, indexname;

-- Check column definitions for monitoring_data
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'monitoring_data'
ORDER BY ordinal_position;

-- Check column definitions for advisor_data
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'advisor_data'
ORDER BY ordinal_position;

-- Check column definitions for log_data
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'log_data'
ORDER BY ordinal_position;

-- Check check constraints
SELECT 
  tc.table_name,
  tc.constraint_name,
  cc.check_clause
FROM information_schema.table_constraints AS tc
JOIN information_schema.check_constraints AS cc
  ON tc.constraint_name = cc.constraint_name
WHERE tc.constraint_type = 'CHECK' 
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('advisor_data', 'log_data')
ORDER BY tc.table_name, tc.constraint_name;

-- Test basic functionality with sample data (will be rolled back)
BEGIN;

-- Insert a test project if none exists
INSERT INTO public.studio_projects (ref, name, database_name, connection_string)
VALUES ('test-project', 'Test Project', 'test_db', 'postgresql://localhost/test_db')
ON CONFLICT (ref) DO NOTHING;

-- Get the project ID
DO $$
DECLARE
  test_project_id INTEGER;
BEGIN
  SELECT id INTO test_project_id FROM public.studio_projects WHERE ref = 'test-project';
  
  -- Test monitoring_data insertion
  INSERT INTO public.monitoring_data (project_id, metric_name, metric_value)
  VALUES (test_project_id, 'test_metric', 100.5);
  
  -- Test advisor_data insertion
  INSERT INTO public.advisor_data (project_id, advisor_type, recommendation, severity)
  VALUES (test_project_id, 'performance', 'Test recommendation', 'info');
  
  -- Test log_data insertion
  INSERT INTO public.log_data (project_id, log_level, message)
  VALUES (test_project_id, 'info', 'Test log message');
  
  RAISE NOTICE 'All test insertions successful';
END $$;

-- Verify the test data was inserted correctly
SELECT 'monitoring_data' as table_name, COUNT(*) as record_count FROM public.monitoring_data
UNION ALL
SELECT 'advisor_data' as table_name, COUNT(*) as record_count FROM public.advisor_data
UNION ALL
SELECT 'log_data' as table_name, COUNT(*) as record_count FROM public.log_data;

-- Rollback the test transaction
ROLLBACK;

-- Final verification message
SELECT 'Multi-tenant schema verification completed successfully' as status;