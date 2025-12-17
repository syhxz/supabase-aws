# Multi-Database Quick Reference

Quick reference guide for common multi-database operations in Supabase Studio.

## Configuration

### Minimal Setup

```bash
# apps/studio/.env
POSTGRES_PASSWORD=your-password
TEMPLATE_DATABASE_NAME=postgres
```

### Full Configuration

```bash
# apps/studio/.env
POSTGRES_PASSWORD=your-password
TEMPLATE_DATABASE_NAME=postgres
PROJECT_STORE_PATH=.kiro/data/projects.json
DEFAULT_ORGANIZATION_NAME=My Organization
DEFAULT_PROJECT_NAME=Default Project
```

## Common Operations

### Create a Project

**Via UI:**
1. Open Studio → Click "New Project"
2. Enter project name
3. Select region (use "Local" for self-hosted)
4. (Optional) Enter custom database name
5. Database password is not used in self-hosted mode
6. Click "Create Project"

**Via API:**
```bash
curl -X POST http://localhost:3000/api/platform/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Project",
    "database_name": "my_project_db",
    "organization_id": 1
  }'
```

### List All Projects

```bash
curl http://localhost:3000/api/platform/projects
```

### Check Database Exists

```sql
SELECT datname FROM pg_database WHERE datname = 'your_database';
```

### List All Databases

```sql
SELECT datname FROM pg_database ORDER BY datname;
```

### Get Database Size

```sql
SELECT 
  datname,
  pg_size_pretty(pg_database_size(datname)) as size
FROM pg_database
WHERE datname NOT IN ('template0', 'template1')
ORDER BY pg_database_size(datname) DESC;
```

## Template Database

### Create Template

```sql
CREATE DATABASE my_template;
\c my_template

-- Add your schema
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL
);

-- Add extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### Update Template

```sql
\c my_template

-- Add new table
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  title TEXT NOT NULL
);
```

### Verify Template

```sql
\c my_template
\dt  -- List tables
\df  -- List functions
\dx  -- List extensions
```

## Database Management

### Connect to Project Database

```bash
psql -h localhost -U postgres -d project_database_name
```

### Backup Project Database

```bash
pg_dump -h localhost -U postgres project_database_name > backup.sql
```

### Restore Project Database

```bash
psql -h localhost -U postgres -d project_database_name < backup.sql
```

### Delete Project Database

```sql
-- Disconnect all users first
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'project_database_name';

-- Drop database
DROP DATABASE project_database_name;
```

### Clone Project Database

```sql
CREATE DATABASE project_clone WITH TEMPLATE project_original;
```

## Troubleshooting

### Template Database Connection Error

**Error**: `source database "postgres" is being accessed by other users`

**Solution** (automatic in our implementation):
```sql
-- Our code automatically uses FORCE option (PostgreSQL 13+)
CREATE DATABASE new_db WITH TEMPLATE postgres FORCE;

-- Or manually terminate connections
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'postgres'
  AND pid <> pg_backend_pid();
```

**Best Practice**: Use a dedicated template database
```bash
# Create template database
docker exec -it supabase-db psql -U postgres -c "CREATE DATABASE supabase_template"

# Configure in .env
TEMPLATE_DATABASE_NAME=supabase_template
```

See [Template Database Connections Guide](./template-database-connections.md) for details.

### Check Template Exists

```sql
SELECT datname FROM pg_database WHERE datname = 'postgres';
```

### Verify User Permissions

```sql
-- Check if user can create databases
SELECT rolname, rolcreatedb 
FROM pg_roles 
WHERE rolname = 'your_user';

-- Grant permission if needed
ALTER USER your_user CREATEDB;
```

### Check Disk Space

```bash
df -h
```

```sql
SELECT 
  pg_size_pretty(sum(pg_database_size(datname))) as total_size
FROM pg_database;
```

### View Active Connections

```sql
SELECT 
  datname,
  count(*) as connections
FROM pg_stat_activity
GROUP BY datname
ORDER BY connections DESC;
```

### Check Studio Logs

```bash
# In apps/studio directory
npm run dev 2>&1 | grep -i "database\|error"
```

## Database Naming

### Valid Names

```
my_project
user_management
analytics_2024
project_v2
```

### Invalid Names

```
My-Project          # Uppercase and hyphen
123_project         # Starts with number
project@2024        # Special character
postgres            # Reserved name
```

### Auto-Generated Names

```
Input: "My Project"     → Output: "my_project_abc123"
Input: "Test App"       → Output: "test_app_def456"
Input: "User-Management"→ Output: "user_management_ghi789"
```

## SQL Snippets

### List Project Databases

```sql
SELECT 
  datname as database_name,
  pg_size_pretty(pg_database_size(datname)) as size,
  (SELECT count(*) FROM pg_stat_activity WHERE datname = d.datname) as connections
FROM pg_database d
WHERE datname NOT IN ('postgres', 'template0', 'template1')
ORDER BY datname;
```

### Find Large Tables

```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;
```

### Check Database Activity

```sql
SELECT 
  datname,
  usename,
  application_name,
  state,
  query
FROM pg_stat_activity
WHERE datname = 'your_database'
ORDER BY query_start DESC;
```

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `POSTGRES_PASSWORD` | Yes | - | PostgreSQL password |
| `TEMPLATE_DATABASE_NAME` | No | `postgres` | Template database name |
| `PROJECT_STORE_PATH` | No | `.kiro/data/projects.json` | Project metadata location |
| `DEFAULT_ORGANIZATION_NAME` | No | `Default Organization` | Default org name |
| `DEFAULT_PROJECT_NAME` | No | `Default Project` | Default project name |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/platform/projects` | Create new project |
| `GET` | `/api/platform/projects` | List all projects |
| `GET` | `/api/platform/projects/:id` | Get project details |
| `GET` | `/api/platform/organizations/:slug/projects` | List org projects |

## Error Codes

| Code | Description | Solution |
|------|-------------|----------|
| `DATABASE_ALREADY_EXISTS` | Database name in use | Choose different name |
| `TEMPLATE_NOT_FOUND` | Template doesn't exist | Check TEMPLATE_DATABASE_NAME |
| `INVALID_DATABASE_NAME` | Invalid name format | Use lowercase, letters, numbers, underscores |
| `INSUFFICIENT_PERMISSIONS` | No CREATEDB permission | Grant CREATEDB to user |
| `DISK_SPACE_FULL` | No disk space | Free up space |

## Useful Commands

### PostgreSQL

```bash
# List databases
psql -h localhost -U postgres -l

# Connect to database
psql -h localhost -U postgres -d database_name

# Execute SQL file
psql -h localhost -U postgres -d database_name -f script.sql

# Dump database
pg_dump -h localhost -U postgres database_name > dump.sql

# Restore database
psql -h localhost -U postgres -d database_name < dump.sql
```

### Studio

```bash
# Start development server
npm run dev

# Run tests
npm run test

# Build for production
npm run build
```

## Best Practices Checklist

- [ ] Set up template database with required schema
- [ ] Configure TEMPLATE_DATABASE_NAME in .env
- [ ] Test template by creating a project
- [ ] Document template schema for team
- [ ] Set up monitoring for disk space
- [ ] Implement backup strategy
- [ ] Configure connection pooling
- [ ] Set up database maintenance schedule
- [ ] Document naming conventions
- [ ] Train team on multi-database workflow

## Resources

- Main README: `apps/studio/README.md`
- Detailed Guide: `apps/studio/docs/multi-database-configuration.md`
- Requirements: `.kiro/specs/multi-database-project-management/requirements.md`
- Design: `.kiro/specs/multi-database-project-management/design.md`
