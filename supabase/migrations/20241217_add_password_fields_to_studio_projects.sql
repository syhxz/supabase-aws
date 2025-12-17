-- Migration: Add password-related fields to studio_projects table
-- This adds support for project-specific database credentials and password display functionality

-- Add new columns for project-specific database credentials
ALTER TABLE public.studio_projects 
ADD COLUMN IF NOT EXISTS database_user TEXT,
ADD COLUMN IF NOT EXISTS database_password_hash TEXT;

-- Create index for database_user field for efficient queries
CREATE INDEX IF NOT EXISTS idx_studio_projects_database_user ON public.studio_projects(database_user);

-- Add comments for the new fields
COMMENT ON COLUMN public.studio_projects.database_user IS 'Project-specific database user for authentication (nullable for legacy projects)';
COMMENT ON COLUMN public.studio_projects.database_password_hash IS 'Hashed password for project-specific database user (nullable for legacy projects)';

-- Update the table comment to reflect the enhanced functionality
COMMENT ON TABLE public.studio_projects IS 'Stores metadata for Studio-managed projects including authentication credentials';