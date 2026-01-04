-- Migration: Create multi-tenant data isolation tables
-- This migration creates monitoring_data, advisor_data, and log_data tables
-- with proper project_id foreign keys for data isolation

-- Create monitoring_data table
CREATE TABLE IF NOT EXISTS public.monitoring_data (
  id BIGSERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES public.studio_projects(id) ON DELETE CASCADE,
  metric_name VARCHAR(255) NOT NULL,
  metric_value NUMERIC NOT NULL,
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create advisor_data table
CREATE TABLE IF NOT EXISTS public.advisor_data (
  id BIGSERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES public.studio_projects(id) ON DELETE CASCADE,
  advisor_type VARCHAR(100) NOT NULL,
  recommendation TEXT NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Create log_data table
CREATE TABLE IF NOT EXISTS public.log_data (
  id BIGSERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES public.studio_projects(id) ON DELETE CASCADE,
  log_level VARCHAR(20) NOT NULL CHECK (log_level IN ('debug', 'info', 'warn', 'error')),
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for monitoring_data
CREATE INDEX IF NOT EXISTS idx_monitoring_data_project_id ON public.monitoring_data(project_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_data_timestamp ON public.monitoring_data(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_monitoring_data_project_timestamp ON public.monitoring_data(project_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_monitoring_data_metric_name ON public.monitoring_data(metric_name);

-- Create indexes for advisor_data
CREATE INDEX IF NOT EXISTS idx_advisor_data_project_id ON public.advisor_data(project_id);
CREATE INDEX IF NOT EXISTS idx_advisor_data_severity ON public.advisor_data(severity);
CREATE INDEX IF NOT EXISTS idx_advisor_data_project_severity ON public.advisor_data(project_id, severity);
CREATE INDEX IF NOT EXISTS idx_advisor_data_advisor_type ON public.advisor_data(advisor_type);
CREATE INDEX IF NOT EXISTS idx_advisor_data_created_at ON public.advisor_data(created_at DESC);

-- Create indexes for log_data
CREATE INDEX IF NOT EXISTS idx_log_data_project_id ON public.log_data(project_id);
CREATE INDEX IF NOT EXISTS idx_log_data_timestamp ON public.log_data(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_log_data_project_timestamp ON public.log_data(project_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_log_data_level ON public.log_data(log_level);

-- Add table comments for documentation
COMMENT ON TABLE public.monitoring_data IS 'Stores monitoring metrics data isolated by project';
COMMENT ON COLUMN public.monitoring_data.project_id IS 'Foreign key reference to studio_projects table';
COMMENT ON COLUMN public.monitoring_data.metric_name IS 'Name of the monitoring metric';
COMMENT ON COLUMN public.monitoring_data.metric_value IS 'Numeric value of the metric';
COMMENT ON COLUMN public.monitoring_data.metadata IS 'Additional metadata in JSON format';

COMMENT ON TABLE public.advisor_data IS 'Stores advisor recommendations data isolated by project';
COMMENT ON COLUMN public.advisor_data.project_id IS 'Foreign key reference to studio_projects table';
COMMENT ON COLUMN public.advisor_data.advisor_type IS 'Type of advisor that generated the recommendation';
COMMENT ON COLUMN public.advisor_data.recommendation IS 'The recommendation text';
COMMENT ON COLUMN public.advisor_data.severity IS 'Severity level: info, warning, or critical';
COMMENT ON COLUMN public.advisor_data.resolved_at IS 'Timestamp when the recommendation was resolved';

COMMENT ON TABLE public.log_data IS 'Stores application log data isolated by project';
COMMENT ON COLUMN public.log_data.project_id IS 'Foreign key reference to studio_projects table';
COMMENT ON COLUMN public.log_data.log_level IS 'Log level: debug, info, warn, or error';
COMMENT ON COLUMN public.log_data.message IS 'The log message';
COMMENT ON COLUMN public.log_data.metadata IS 'Additional log metadata in JSON format';

-- Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monitoring_data TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monitoring_data TO supabase_admin;
GRANT USAGE ON SEQUENCE public.monitoring_data_id_seq TO postgres;
GRANT USAGE ON SEQUENCE public.monitoring_data_id_seq TO supabase_admin;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.advisor_data TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.advisor_data TO supabase_admin;
GRANT USAGE ON SEQUENCE public.advisor_data_id_seq TO postgres;
GRANT USAGE ON SEQUENCE public.advisor_data_id_seq TO supabase_admin;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.log_data TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.log_data TO supabase_admin;
GRANT USAGE ON SEQUENCE public.log_data_id_seq TO postgres;
GRANT USAGE ON SEQUENCE public.log_data_id_seq TO supabase_admin;