-- Webhooks Schema Initialization Script
-- This script creates the webhooks schema and all required tables for project-level webhook management

-- Create webhooks schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS webhooks;

-- webhooks.hooks table
CREATE TABLE IF NOT EXISTS webhooks.hooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  events TEXT[] NOT NULL,
  secret TEXT,
  headers JSONB,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- webhooks.logs table
CREATE TABLE IF NOT EXISTS webhooks.logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hook_id UUID NOT NULL REFERENCES webhooks.hooks(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  payload JSONB,
  response_status INTEGER,
  response_body TEXT,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_hooks_events ON webhooks.hooks USING GIN(events);
CREATE INDEX IF NOT EXISTS idx_hooks_enabled ON webhooks.hooks(enabled);
CREATE INDEX IF NOT EXISTS idx_hooks_created_by ON webhooks.hooks(created_by);
CREATE INDEX IF NOT EXISTS idx_logs_hook_id ON webhooks.logs(hook_id);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON webhooks.logs(created_at);
CREATE INDEX IF NOT EXISTS idx_logs_event ON webhooks.logs(event);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA webhooks TO postgres;
GRANT ALL ON ALL TABLES IN SCHEMA webhooks TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA webhooks TO postgres;
