-- Migration: Migrate existing data to multi-tenant tables
-- This migration handles migration of any existing monitoring, advisor, or log data
-- to the new multi-tenant structure with project_id associations

-- Note: This migration is designed to be safe to run even if no existing data exists
-- It will only migrate data if the source tables exist and contain data

-- Function to get default project ID safely
CREATE OR REPLACE FUNCTION get_default_project_id() RETURNS INTEGER AS $$
BEGIN
  -- Check if studio_projects table exists and has the id column
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'studio_projects'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'studio_projects'
    AND column_name = 'id'
  ) THEN
    -- Check if table has any data
    IF EXISTS (SELECT 1 FROM public.studio_projects LIMIT 1) THEN
      RETURN (SELECT id FROM public.studio_projects ORDER BY id LIMIT 1);
    ELSE
      -- Table exists but is empty, return default
      RETURN 1;
    END IF;
  ELSE
    -- Table or id column doesn't exist yet, return default
    RETURN 1;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Any error, return default
    RAISE NOTICE 'Error in get_default_project_id(): %, returning default ID 1', SQLERRM;
    RETURN 1;
END;
$$ LANGUAGE plpgsql;

-- Function to safely migrate monitoring data if it exists
DO $
BEGIN
  -- Check if there's an existing monitoring table without project_id
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'monitoring' 
    AND table_name != 'monitoring_data'
  ) THEN
    -- Migrate existing monitoring data
    -- This assumes existing data should be associated with the first project
    -- In a real scenario, you would need to determine the correct project association
    INSERT INTO public.monitoring_data (
      project_id, 
      metric_name, 
      metric_value, 
      metadata, 
      timestamp, 
      created_at
    )
    SELECT 
      get_default_project_id() as project_id,
      metric_name,
      metric_value,
      COALESCE(metadata, '{}'),
      COALESCE(timestamp, created_at, NOW()),
      COALESCE(created_at, NOW())
    FROM public.monitoring
    WHERE NOT EXISTS (
      SELECT 1 FROM public.monitoring_data 
      WHERE monitoring_data.metric_name = monitoring.metric_name 
      AND monitoring_data.timestamp = COALESCE(monitoring.timestamp, monitoring.created_at, NOW())
    );
    
    RAISE NOTICE 'Migrated existing monitoring data to monitoring_data table';
  ELSE
    RAISE NOTICE 'No existing monitoring table found - skipping monitoring data migration';
  END IF;
END $;

-- Function to safely migrate advisor data if it exists
DO $
BEGIN
  -- Check if there's an existing advisor table without project_id
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'advisor' 
    AND table_name != 'advisor_data'
  ) THEN
    -- Migrate existing advisor data
    INSERT INTO public.advisor_data (
      project_id,
      advisor_type,
      recommendation,
      severity,
      metadata,
      created_at,
      resolved_at
    )
    SELECT 
      get_default_project_id() as project_id,
      COALESCE(advisor_type, 'general'),
      recommendation,
      COALESCE(severity, 'info'),
      COALESCE(metadata, '{}'),
      COALESCE(created_at, NOW()),
      resolved_at
    FROM public.advisor
    WHERE NOT EXISTS (
      SELECT 1 FROM public.advisor_data 
      WHERE advisor_data.recommendation = advisor.recommendation 
      AND advisor_data.created_at = COALESCE(advisor.created_at, NOW())
    );
    
    RAISE NOTICE 'Migrated existing advisor data to advisor_data table';
  ELSE
    RAISE NOTICE 'No existing advisor table found - skipping advisor data migration';
  END IF;
END $;

-- Function to safely migrate log data if it exists
DO $
BEGIN
  -- Check if there's an existing logs table without project_id (excluding webhooks.logs)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'logs' 
    AND table_name != 'log_data'
  ) THEN
    -- Migrate existing log data
    INSERT INTO public.log_data (
      project_id,
      log_level,
      message,
      metadata,
      timestamp
    )
    SELECT 
      get_default_project_id() as project_id,
      COALESCE(log_level, 'info'),
      message,
      COALESCE(metadata, '{}'),
      COALESCE(timestamp, created_at, NOW())
    FROM public.logs
    WHERE NOT EXISTS (
      SELECT 1 FROM public.log_data 
      WHERE log_data.message = logs.message 
      AND log_data.timestamp = COALESCE(logs.timestamp, logs.created_at, NOW())
    );
    
    RAISE NOTICE 'Migrated existing log data to log_data table';
  ELSE
    RAISE NOTICE 'No existing logs table found - skipping log data migration';
  END IF;
END $;

-- Create a function to associate orphaned data with projects
-- This can be used later if specific project associations need to be made
CREATE OR REPLACE FUNCTION associate_data_with_project(
  target_project_ref TEXT,
  data_type TEXT DEFAULT 'all'
) RETURNS TEXT AS $
DECLARE
  target_project_id INTEGER;
  result_message TEXT := '';
BEGIN
  -- Get the project ID for the given ref
  SELECT id INTO target_project_id 
  FROM public.studio_projects 
  WHERE ref = target_project_ref;
  
  IF target_project_id IS NULL THEN
    RETURN 'Error: Project with ref "' || target_project_ref || '" not found';
  END IF;
  
  -- Update monitoring data if requested
  IF data_type IN ('all', 'monitoring') THEN
    UPDATE public.monitoring_data 
    SET project_id = target_project_id 
    WHERE project_id = get_default_project_id();
    
    result_message := result_message || 'Updated monitoring data for project ' || target_project_ref || '. ';
  END IF;
  
  -- Update advisor data if requested
  IF data_type IN ('all', 'advisor') THEN
    UPDATE public.advisor_data 
    SET project_id = target_project_id 
    WHERE project_id = get_default_project_id();
    
    result_message := result_message || 'Updated advisor data for project ' || target_project_ref || '. ';
  END IF;
  
  -- Update log data if requested
  IF data_type IN ('all', 'log') THEN
    UPDATE public.log_data 
    SET project_id = target_project_id 
    WHERE project_id = get_default_project_id();
    
    result_message := result_message || 'Updated log data for project ' || target_project_ref || '. ';
  END IF;
  
  RETURN result_message;
END;
$ LANGUAGE plpgsql;

-- Add comment for the helper functions
COMMENT ON FUNCTION associate_data_with_project(TEXT, TEXT) IS 'Helper function to associate existing data with a specific project';
COMMENT ON FUNCTION get_default_project_id() IS 'Helper function to safely get default project ID';

-- Grant permissions on the helper functions
GRANT EXECUTE ON FUNCTION associate_data_with_project(TEXT, TEXT) TO postgres;
GRANT EXECUTE ON FUNCTION associate_data_with_project(TEXT, TEXT) TO supabase_admin;
GRANT EXECUTE ON FUNCTION get_default_project_id() TO postgres;
GRANT EXECUTE ON FUNCTION get_default_project_id() TO supabase_admin;