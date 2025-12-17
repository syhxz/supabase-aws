# Studio Projects Schema Updates

## Overview

This document describes the schema updates made to the `studio_projects` table to support the new user password display functionality in Supabase Studio.

## Changes Made

### New Fields Added

1. **`database_user`** (TEXT, nullable)
   - Stores project-specific database username
   - Nullable to support legacy projects that don't have project-specific credentials
   - Used for authentication when connecting to project databases

2. **`database_password_hash`** (TEXT, nullable)  
   - Stores hashed password for the project-specific database user
   - Nullable to support legacy projects
   - Used in conjunction with password display/reveal functionality in Studio UI

### Migration Files

1. **`20241128_create_studio_projects_table.sql`** - Updated to include new fields
2. **`20241217_add_password_fields_to_studio_projects.sql`** - Adds fields to existing tables
3. **`docker/volumes/db/studio_projects.sql`** - Docker initialization script

### Indexes Added

- `idx_studio_projects_database_user` - For efficient queries on database_user field

### Related Code Changes

The following TypeScript interfaces have been updated to support these fields:

- `ProjectMetadata` in `apps/studio/lib/api/self-hosted/project-store-pg.ts`
- `EnhancedProjectMetadata` with credential status tracking
- Password visibility toggle functionality in Studio UI components

## Password Display Functionality

The new schema supports:

1. **Project-specific credentials** - Each project can have its own database user/password
2. **Credential fallback** - Falls back to system credentials when project-specific ones are missing
3. **Password visibility toggle** - UI can show/hide passwords based on user preference
4. **Credential status tracking** - Tracks whether credentials are complete, missing, or using fallbacks

## Security Considerations

- Passwords are stored as hashes, not plain text
- The `database_password_hash` field should contain properly hashed passwords
- Password display in UI is controlled by user permissions and visibility toggles
- Fallback credentials are used when project-specific credentials are incomplete

## Verification

Use the verification script to check schema correctness:

```sql
\i scripts/verify-studio-projects-schema.sql
```

## Backward Compatibility

- All new fields are nullable to support existing projects
- Legacy projects without project-specific credentials will use fallback authentication
- Existing functionality remains unchanged for projects without the new fields populated