-- Studio Projects Table Initialization
-- This script creates the studio_projects table for storing project metadata
-- It runs during database initialization in Docker containers

-- Create the studio_projects table with all required fields
CREATE TABLE IF NOT EXISTS public.studio_projects (
  id SERIAL PRIMARY KEY,
  ref TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  database_name TEXT UNIQUE NOT NULL,
  database_user TEXT, -- Project-specific database user (nullable for legacy projects)
  database_password_hash TEXT, -- Hashed password for storage (nullable for legacy projects)
  organization_id INTEGER NOT NULL DEFAULT 1,
  owner_user_id TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE_HEALTHY',
  region TEXT NOT NULL DEFAULT 'localhost',
  connection_string TEXT NOT NULL,
  inserted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_studio_projects_ref ON public.studio_projects(ref);
CREATE INDEX IF NOT EXISTS idx_studio_projects_database_name ON public.studio_projects(database_name);
CREATE INDEX IF NOT EXISTS idx_studio_projects_database_user ON public.studio_projects(database_user);
CREATE INDEX IF NOT EXISTS idx_studio_projects_owner ON public.studio_projects(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_studio_projects_org ON public.studio_projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_studio_projects_status ON public.studio_projects(status);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_studio_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_studio_projects_updated_at
  BEFORE UPDATE ON public.studio_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_studio_projects_updated_at();

-- Add comments for documentation
COMMENT ON TABLE public.studio_projects IS 'Stores metadata for Studio-managed projects including authentication credentials';
COMMENT ON COLUMN public.studio_projects.ref IS 'Unique project reference identifier';
COMMENT ON COLUMN public.studio_projects.database_name IS 'PostgreSQL database name';
COMMENT ON COLUMN public.studio_projects.database_user IS 'Project-specific database user for authentication (nullable for legacy projects)';
COMMENT ON COLUMN public.studio_projects.database_password_hash IS 'Hashed password for project-specific database user (nullable for legacy projects)';
COMMENT ON COLUMN public.studio_projects.owner_user_id IS 'GoTrue user ID of the project owner';
COMMENT ON COLUMN public.studio_projects.connection_string IS 'Database connection string';

-- Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_projects TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_projects TO supabase_admin;
GRANT USAGE ON SEQUENCE public.studio_projects_id_seq TO postgres;
GRANT USAGE ON SEQUENCE public.studio_projects_id_seq TO supabase_admin;