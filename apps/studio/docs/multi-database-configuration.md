# Multi-Database Configuration Guide

This guide provides detailed information about configuring and using the multi-database project management feature in Supabase Studio.

## Overview

The multi-database feature allows you to manage multiple isolated projects within a single PostgreSQL instance. Each project gets its own database, created from a template database that you configure.

## Architecture

```
PostgreSQL Instance
├── postgres (template database)
├── project_alpha_abc123 (Project 1)
├── project_beta_def456 (Project 2)
└── project_gamma_ghi789 (Project 3)
```

Each project database:
- Is completely isolated from other projects
- Contains a copy of the template database schema
- Has its own connection string
- Can be managed independently

## Configuration

### Environment Variables

Add the following to your `apps/studio/.env` file:

```bash
# Required: PostgreSQL connection settings
POSTGRES_PASSWORD=your-super-secret-and-long-postgres-password

# Optional: Template database configuration
# Specifies which database to use as a template for new projects
# Default: Uses POSTGRES_DB or 'postgres' if not set
TEMPLATE_DATABASE_NAME=postgres

# Optional: Project metadata storage
# Location where project metadata is stored
# Default: .kiro/data/projects.json
PROJECT_STORE_PATH=.kiro/data/projects.json
```

### Template Database Selection Logic

Studio determines the template database using this priority:

1. **TEMPLATE_DATABASE_NAME** - Explicitly configured template
2. **POSTGRES_DB** - Default database from PostgreSQL configuration
3. **postgres** - PostgreSQL default database

Example configurations:

```bash
# Use a custom template database
TEMPLATE_DATABASE_NAME=my_template_db

# Use the default PostgreSQL database
POSTGRES_DB=postgres
# TEMPLATE_DATABASE_NAME not set - will use 'postgres'

# Use a specific template with all your extensions
TEMPLATE_DATABASE_NAME=supabase_template
```

## Database Naming Rules

### Automatic Name Generation

When you don't specify a database name, Studio automatically generates one:

```
project_name → project_name_abc123
My Project → my_project_def456
Test-App → test_app_ghi789
```

Generation rules:
- Converts to lowercase
- Replaces spaces and special characters with underscores
- Removes consecutive underscores
- Adds a unique timestamp suffix
- Truncates to 63 characters (PostgreSQL limit)

### Custom Database Names

You can specify custom database names that must follow these rules:

**Valid characters:**
- Lowercase letters (a-z)
- Numbers (0-9)
- Underscores (_)
- Must start with a letter

**Restrictions:**
- Maximum length: 63 characters
- Must be unique across the PostgreSQL instance
- Cannot use reserved names: `postgres`, `template0`, `template1`, `supabase`, `auth`, `storage`, `realtime`

**Valid examples:**
```
my_project
project_2024
user_management_db
analytics_v2
```

**Invalid examples:**
```
My-Project          # Contains uppercase and hyphen
123_project         # Starts with number
project@2024        # Contains special character
postgres            # Reserved name
```

## Setting Up Your Template Database

### Basic Template Setup

1. **Connect to PostgreSQL:**
   ```bash
   psql -h localhost -U postgres
   ```

2. **Create or modify your template database:**
   ```sql
   -- If creating a new template
   CREATE DATABASE my_template;
   \c my_template
   
   -- Or use existing database
   \c postgres
   ```

3. **Set up your schema:**
   ```sql
   -- Create tables
   CREATE TABLE users (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     email TEXT UNIQUE NOT NULL,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   
   CREATE TABLE profiles (
     id UUID PRIMARY KEY REFERENCES users(id),
     username TEXT UNIQUE,
     avatar_url TEXT
   );
   ```

4. **Add extensions:**
   ```sql
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   CREATE EXTENSION IF NOT EXISTS "pgcrypto";
   CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
   ```

5. **Create functions:**
   ```sql
   CREATE OR REPLACE FUNCTION update_updated_at()
   RETURNS TRIGGER AS $$
   BEGIN
     NEW.updated_at = NOW();
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;
   ```

6. **Add seed data (optional):**
   ```sql
   INSERT INTO users (email) VALUES
     ('admin@example.com'),
     ('user@example.com');
   ```

### Supabase-Specific Template

For a Supabase-compatible template:

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pgjwt";

-- Create auth schema (if needed)
CREATE SCHEMA IF NOT EXISTS auth;

-- Create storage schema (if needed)
CREATE SCHEMA IF NOT EXISTS storage;

-- Set up RLS policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own data"
  ON users FOR SELECT
  USING (auth.uid() = id);
```

### Using Supabase Migrations

The recommended approach is to use Supabase migrations:

1. **Initialize Supabase:**
   ```bash
   supabase init
   ```

2. **Create migrations:**
   ```bash
   supabase migration new initial_schema
   ```

3. **Apply to template database:**
   ```bash
   supabase db push
   ```

4. **Configure Studio to use this database:**
   ```bash
   # In .env
   TEMPLATE_DATABASE_NAME=postgres
   ```

## Project Creation Workflow

### Via Studio UI

1. Navigate to Studio (http://localhost:3000)
2. Click "New Project"
3. Fill in the form:
   - **Project Name** (required): Display name for your project
   - **Database Name** (optional): Custom database name or leave blank for auto-generation
   - **Region** (required): Select region (for self-hosted, use "Local" or any available region)
   - **Database Password**: For self-hosted mode, this field is for platform compatibility only. All databases use the POSTGRES_PASSWORD from your .env file
   - **Organization** (required): Select organization
4. Click "Create Project"
5. Wait for database creation (progress indicator shown)
6. Project appears in your project list

**Important for Self-Hosted:**
- All project databases share the same PostgreSQL user credentials (configured via POSTGRES_PASSWORD in .env)
- The database password field in the UI is not used in self-hosted mode
- Each project gets its own isolated database, but they all use the same PostgreSQL user

### Via API

```typescript
// POST /api/platform/projects
const response = await fetch('/api/platform/projects', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'My New Project',
    database_name: 'my_new_project_db', // Optional
    organization_id: 1,
  }),
});

const project = await response.json();
console.log('Created project:', project);
```

### Response Format

```json
{
  "id": 1,
  "ref": "abc123def456",
  "name": "My New Project",
  "database_name": "my_new_project_db",
  "organization_id": 1,
  "connection_string": "postgresql://user:pass@localhost:5432/my_new_project_db",
  "status": "ACTIVE_HEALTHY",
  "region": "local",
  "inserted_at": "2024-01-15T10:30:00Z"
}
```

## Error Handling

### Common Errors

#### Database Already Exists

**Error:**
```json
{
  "error": {
    "message": "Database 'my_project' already exists",
    "code": "DATABASE_ALREADY_EXISTS"
  }
}
```

**Solution:**
- Choose a different database name
- Delete the existing database if it's no longer needed
- Use auto-generated names to avoid conflicts

#### Template Database Not Found

**Error:**
```json
{
  "error": {
    "message": "Template database 'my_template' does not exist",
    "code": "TEMPLATE_NOT_FOUND"
  }
}
```

**Solution:**
- Verify `TEMPLATE_DATABASE_NAME` in `.env`
- Check that the template database exists: `\l` in psql
- Create the template database or update configuration

#### Invalid Database Name

**Error:**
```json
{
  "error": {
    "message": "Invalid database name: must contain only lowercase letters, numbers, and underscores",
    "code": "INVALID_DATABASE_NAME"
  }
}
```

**Solution:**
- Use only lowercase letters, numbers, and underscores
- Start with a letter
- Keep length under 63 characters

#### Insufficient Permissions

**Error:**
```json
{
  "error": {
    "message": "Permission denied to create database",
    "code": "INSUFFICIENT_PERMISSIONS"
  }
}
```

**Solution:**
- Grant CREATEDB permission to the database user:
  ```sql
  ALTER USER your_user CREATEDB;
  ```

#### Disk Space Full

**Error:**
```json
{
  "error": {
    "message": "Could not create database: insufficient disk space",
    "code": "DISK_SPACE_FULL"
  }
}
```

**Solution:**
- Free up disk space
- Delete unused databases
- Increase storage capacity

## Best Practices

### Template Database Management

1. **Keep it clean:**
   - Only include essential schema and data
   - Remove test data before using as template
   - Document the template structure

2. **Version control:**
   - Use migrations to manage schema changes
   - Tag template versions
   - Test template before deploying

3. **Regular updates:**
   - Update template when adding new features
   - Migrate existing projects if needed
   - Communicate changes to team

### Resource Management

1. **Monitor disk usage:**
   ```sql
   -- Check database sizes
   SELECT 
     datname,
     pg_size_pretty(pg_database_size(datname)) as size
   FROM pg_database
   ORDER BY pg_database_size(datname) DESC;
   ```

2. **Set up alerts:**
   - Monitor disk space
   - Track number of databases
   - Alert on creation failures

3. **Implement cleanup:**
   - Remove unused projects
   - Archive old databases
   - Set retention policies

### Security

1. **Isolate projects:**
   - Each project has its own database
   - No cross-database queries
   - Separate connection strings

2. **Manage permissions:**
   ```sql
   -- Create project-specific users
   CREATE USER project_user_1 WITH PASSWORD 'secure_password';
   GRANT ALL PRIVILEGES ON DATABASE project_1 TO project_user_1;
   ```

3. **Secure connection strings:**
   - Store in environment variables
   - Never commit to version control
   - Rotate passwords regularly

### Performance

1. **Connection pooling:**
   - Configure appropriate pool sizes
   - Monitor connection usage
   - Use connection poolers (PgBouncer)

2. **Database maintenance:**
   ```sql
   -- Regular vacuum
   VACUUM ANALYZE;
   
   -- Reindex if needed
   REINDEX DATABASE your_database;
   ```

3. **Monitor performance:**
   - Track query performance
   - Monitor resource usage per database
   - Optimize slow queries

## Troubleshooting

### Debugging Connection Issues

1. **Check database exists:**
   ```sql
   SELECT datname FROM pg_database WHERE datname = 'your_database';
   ```

2. **Verify user permissions:**
   ```sql
   SELECT 
     datname,
     has_database_privilege('your_user', datname, 'CONNECT') as can_connect
   FROM pg_database
   WHERE datname = 'your_database';
   ```

3. **Test connection:**
   ```bash
   psql -h localhost -U your_user -d your_database
   ```

### Checking Studio Logs

```bash
# In apps/studio directory
npm run dev

# Look for errors related to:
# - Database creation
# - Template database access
# - Connection string generation
```

### Verifying Template Copy

```sql
-- Connect to new database
\c new_project_database

-- List all tables
\dt

-- Compare with template
\c template_database
\dt

-- Check if schemas match
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;
```

## Migration from Single Database

If you're migrating from a single-database setup:

1. **Backup existing data:**
   ```bash
   pg_dump -h localhost -U postgres your_database > backup.sql
   ```

2. **Set up template:**
   - Use your existing database as template
   - Or create new template with desired schema

3. **Update configuration:**
   ```bash
   # In .env
   TEMPLATE_DATABASE_NAME=your_existing_database
   ```

4. **Create new projects:**
   - New projects will use the template
   - Existing project continues using original database

5. **No data migration needed:**
   - Existing project data remains in place
   - New projects start fresh from template

## Advanced Configuration

### Custom Project Store Location

```bash
# In .env
PROJECT_STORE_PATH=/custom/path/projects.json
```

### Multiple Template Databases

While Studio currently supports one template, you can work around this:

1. **Create multiple templates:**
   ```sql
   CREATE DATABASE template_basic;
   CREATE DATABASE template_advanced;
   ```

2. **Switch templates by updating .env:**
   ```bash
   # For basic projects
   TEMPLATE_DATABASE_NAME=template_basic
   
   # For advanced projects
   TEMPLATE_DATABASE_NAME=template_advanced
   ```

3. **Restart Studio after changing template**

### Database Naming Prefix

To organize databases by environment or team:

```typescript
// Custom naming in your code
const databaseName = `${environment}_${teamName}_${projectName}`;
// Results in: prod_teamA_myproject
```

## FAQ

**Q: Can I change the template database after creating projects?**
A: Yes, but it only affects new projects. Existing projects keep their current schema.

**Q: How do I migrate data between projects?**
A: Use `pg_dump` and `pg_restore`:
```bash
pg_dump -h localhost -U postgres source_db > data.sql
psql -h localhost -U postgres -d target_db < data.sql
```

**Q: Can I delete a project database?**
A: Yes, but be careful:
```sql
DROP DATABASE project_database_name;
```
Also remove the project from Studio's project store.

**Q: What happens if template database is modified?**
A: Existing projects are not affected. Only new projects get the updated template.

**Q: Can I use a remote database as template?**
A: The template must be in the same PostgreSQL instance as the new databases.

**Q: How many projects can I create?**
A: Limited only by your PostgreSQL instance resources (disk space, memory, connection limits).

## Support

For issues or questions:
- Check Studio logs for detailed error messages
- Review PostgreSQL logs for database-level errors
- Consult the main README for general Studio setup
- Open an issue on GitHub for bugs or feature requests
