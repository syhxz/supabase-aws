-- Rollback Migration: Remove multi-tenant data isolation tables
-- This migration can be used to rollback the multi-tenant data tables if needed
-- WARNING: This will permanently delete all data in these tables

-- Drop the helper function first
DROP FUNCTION IF EXISTS public.associate_data_with_project(TEXT, TEXT);

-- Drop the multi-tenant data tables (this will cascade delete all data)
DROP TABLE IF EXISTS public.log_data CASCADE;
DROP TABLE IF EXISTS public.advisor_data CASCADE;
DROP TABLE IF EXISTS public.monitoring_data CASCADE;

-- Note: The studio_projects table is not dropped as it may contain important project metadata
-- If you need to rollback the studio_projects table as well, run a separate migration