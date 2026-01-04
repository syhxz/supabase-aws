-- Rollback Script for Schema Initialization
-- This script drops all schemas and their contents created during project initialization

-- Drop analytics schema and all its objects
DROP SCHEMA IF EXISTS analytics CASCADE;

-- Drop webhooks schema and all its objects
DROP SCHEMA IF EXISTS webhooks CASCADE;

-- Drop storage schema and all its objects
DROP SCHEMA IF EXISTS storage CASCADE;

-- Drop auth schema and all its objects
DROP SCHEMA IF EXISTS auth CASCADE;
