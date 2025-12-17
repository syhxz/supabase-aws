-- Migration: Create credential audit log table for tracking credential-related operations
-- This provides persistent storage for credential monitoring and audit capabilities

-- Create the credential_audit_log table
CREATE TABLE IF NOT EXISTS public.credential_audit_log (
  id BIGSERIAL PRIMARY KEY,
  project_ref TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('fallback_used', 'credentials_migrated', 'validation_failed', 'health_check', 'report_generated')),
  event_details JSONB NOT NULL DEFAULT '{}',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_credential_audit_log_project_ref ON public.credential_audit_log(project_ref);
CREATE INDEX IF NOT EXISTS idx_credential_audit_log_event_type ON public.credential_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_credential_audit_log_timestamp ON public.credential_audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_credential_audit_log_user_id ON public.credential_audit_log(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_credential_audit_log_created_at ON public.credential_audit_log(created_at DESC);

-- Create a composite index for common queries
CREATE INDEX IF NOT EXISTS idx_credential_audit_log_project_event_time ON public.credential_audit_log(project_ref, event_type, timestamp DESC);

-- Add comments for documentation
COMMENT ON TABLE public.credential_audit_log IS 'Audit log for credential-related operations and monitoring events';
COMMENT ON COLUMN public.credential_audit_log.project_ref IS 'Project reference identifier or "system" for system-wide events';
COMMENT ON COLUMN public.credential_audit_log.event_type IS 'Type of credential event: fallback_used, credentials_migrated, validation_failed, health_check, report_generated';
COMMENT ON COLUMN public.credential_audit_log.event_details IS 'JSON object containing event-specific details and metadata';
COMMENT ON COLUMN public.credential_audit_log.timestamp IS 'When the event occurred';
COMMENT ON COLUMN public.credential_audit_log.user_id IS 'GoTrue user ID associated with the event (if applicable)';
COMMENT ON COLUMN public.credential_audit_log.created_at IS 'When the audit log entry was created';

-- Create a function to automatically clean up old audit log entries (optional)
CREATE OR REPLACE FUNCTION cleanup_old_credential_audit_logs()
RETURNS void AS $$
BEGIN
  -- Keep only the last 6 months of audit logs
  DELETE FROM public.credential_audit_log 
  WHERE created_at < NOW() - INTERVAL '6 months';
END;
$$ LANGUAGE plpgsql;

-- Add a comment for the cleanup function
COMMENT ON FUNCTION cleanup_old_credential_audit_logs() IS 'Removes credential audit log entries older than 6 months to prevent table bloat';