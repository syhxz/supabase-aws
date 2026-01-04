-- Analytics Schema Initialization Script
-- This script creates the analytics schema and all required tables for project-level analytics tracking

-- Create analytics schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS analytics;

-- analytics.events table
CREATE TABLE IF NOT EXISTS analytics.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  event_data JSONB,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- analytics.metrics table
CREATE TABLE IF NOT EXISTS analytics.metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  dimensions JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_type ON analytics.events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON analytics.events(created_at);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON analytics.events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_type_created_at ON analytics.events(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_metrics_name ON analytics.metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON analytics.metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_metrics_name_timestamp ON analytics.metrics(metric_name, timestamp);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA analytics TO postgres;
GRANT ALL ON ALL TABLES IN SCHEMA analytics TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA analytics TO postgres;
