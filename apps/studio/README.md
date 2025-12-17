# Supabase Studio

A dashboard for managing your self-hosted Supabase project, and used on our [hosted platform](https://supabase.com/dashboard). Built with:

- [Next.js](https://nextjs.org/)
- [Tailwind](https://tailwindcss.com/)

## What's included

Studio is designed to work with existing deployments - either the local hosted, docker setup, or our CLI. It is not intended for managing the deployment and administration of projects - that's out of scope.

As such, the features exposed on Studio for existing deployments are limited to those which manage your database:

- Table & SQL editors
  - Saved queries are unavailable
- Database management
  - Policies, roles, extensions, replication
- API documentation

## Managing Project Settings

Project settings are managed outside of the Dashboard. If you use docker compose, you should manage the settings in your docker-compose file. If you're deploying Supabase to your own cloud, you should store your secrets and env vars in a vault or secrets manager.

## How to contribute?

- Branch from `master` and name your branches with the following structure
  - `{type}/{branch_name}`
    - Type: `chore | fix | feature`
    - The branch name is arbitrary — just make sure it summarizes the work.
- When you send a PR to `master`, it will automatically tag members of the frontend team for review.
- Review the [contributing checklists](contributing/contributing-checklists.md) to help test your feature before sending a PR.
- The Dashboard is under active development. You should run `git pull` frequently to make sure you're up to date.

### Developer Quickstart

> [!NOTE]  
> **Supabase internal use:** To develop on Studio locally with the backend services, see the instructions in the [internal `infrastructure` repo](https://github.com/supabase/infrastructure/blob/develop/docs/contributing.md).

```bash
# You'll need to be on Node v20
# in /studio

## For external contributors
pnpm install # install dependencies
pnpm run dev # start dev server

## For internal contributors
## First clone the private supabase/infrastructure repo and follow instructions for setting up mise
mise studio  # Run from supabase/infrastructure alongside `mise infra`

## For all
pnpm run test # run tests
pnpm run test -- --watch # run tests in watch mode
```

## Running within a self-hosted environment

Follow the [self-hosting guide](https://supabase.com/docs/guides/hosting/docker) to get started.

```
cd ..
cd docker
docker compose -f docker-compose.yml -f ./dev/docker-compose.dev.yml up
```

Once you've got that set up, update `.env` in the studio folder with the corresponding values.

```
POSTGRES_PASSWORD=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=
```

Then run the following commands to install dependencies and start the dashboard.

```
npm install
npm run dev
```

If you would like to configure different defaults for "Default Organization" and "Default Project", you will need to update the `.env` in the studio folder with the corresponding values.

```
DEFAULT_ORGANIZATION_NAME=
DEFAULT_PROJECT_NAME=
```

### Docker Runtime Configuration

When running Studio in Docker, the application uses **runtime configuration** instead of build-time environment variables. This allows the same Docker image to be deployed to multiple environments without rebuilding.

**Key Benefits:**
- ✅ Same Docker image works in dev, staging, and production
- ✅ No rebuild required when changing URLs
- ✅ Configuration changes take effect on container restart
- ✅ Simplified deployment process

**Required Environment Variables:**

For production deployments, set these when running the container:

```bash
# Public-facing API URL (required)
SUPABASE_PUBLIC_URL=http://192.0.2.1:8000

# External API gateway URL (required)
API_EXTERNAL_URL=http://192.0.2.1:8000

# Anonymous API key (required)
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

**Documentation:**
- 📖 [Docker Runtime Configuration Guide](./docs/DOCKER-RUNTIME-CONFIG.md) - Complete guide with examples
- 📋 [Required Environment Variables](./docs/REQUIRED-ENV-VARS.md) - Quick reference for all variables
- 🔧 [Configuration Troubleshooting](./docs/RUNTIME-CONFIG-ERROR-HANDLING.md) - Common issues and solutions

## Authentication Setup

Studio supports two authentication modes for self-hosted deployments:

### Auto-Login Mode (Default)

By default, Studio automatically logs you in without requiring credentials. This is suitable for local development or trusted environments.

```bash
# In apps/studio/.env
NEXT_PUBLIC_REQUIRE_LOGIN=false  # or omit this variable
```

### GoTrue Authentication Mode

For production deployments or when you need proper user authentication, enable GoTrue-based authentication.

> **📖 Deployment Guide**: For comprehensive deployment instructions across different environments (Docker, Vercel, AWS, Kubernetes), see the **[GoTrue Deployment Guide](./docs/GOTRUE-DEPLOYMENT-GUIDE.md)**.

#### 1. Configure Environment Variables

Add the following to your `apps/studio/.env` file:

```bash
# Enable authentication requirement
NEXT_PUBLIC_REQUIRE_LOGIN=true

# GoTrue service URL (via Kong gateway)
NEXT_PUBLIC_GOTRUE_URL=http://127.0.0.1:54321/auth/v1

# Supabase configuration
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# JWT Secret (must match GoTrue configuration)
JWT_SECRET=your-super-secret-jwt-token-with-at-least-32-characters-long
```

#### 2. Start Required Docker Services

Ensure the following services are running:

```bash
cd docker
docker compose up -d db gotrue kong
```

Verify services are healthy:

```bash
# Check GoTrue health
curl http://127.0.0.1:54321/auth/v1/health

# Check Kong gateway
curl http://127.0.0.1:54321/
```

#### 3. Create Initial Admin User

Use the provided script to create your first admin user:

```bash
# From the project root
./scripts/create-admin-user.sh admin@example.com your-secure-password
```

Or create a user directly via the GoTrue API:

```bash
curl -X POST 'http://127.0.0.1:54321/auth/v1/signup' \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "your-secure-password"
  }'
```

Alternatively, insert directly into the database:

```sql
INSERT INTO auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  created_at, updated_at, confirmed_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@example.com',
  crypt('your-secure-password', gen_salt('bf')),
  now(), now(), now(), now()
);
```

#### 4. Start Studio

```bash
cd apps/studio
pnpm run dev
```

Studio will now require login. Navigate to `http://localhost:8082` and you'll be redirected to the login page.

### Authentication Features

When authentication is enabled, Studio provides:

- **Login Page**: Secure email/password authentication
- **Session Management**: Automatic token refresh and session persistence
- **Route Protection**: All routes require authentication except the login page
- **Logout**: Clear session and redirect to login
- **Error Handling**: User-friendly error messages for authentication failures

### Security Considerations

- **JWT Secret**: Use a strong, random secret of at least 32 characters
- **HTTPS**: Always use HTTPS in production to protect credentials
- **Password Policy**: Configure GoTrue password requirements in `docker/.env`
- **Rate Limiting**: Enable rate limiting in Kong to prevent brute force attacks
- **Session Timeout**: Configure appropriate session expiration times

### Troubleshooting Authentication

See the [Authentication Migration Guide](./docs/AUTHENTICATION-MIGRATION-GUIDE.md) for detailed troubleshooting steps.

Common issues:

**Cannot access login page:**
- Verify `NEXT_PUBLIC_REQUIRE_LOGIN=true` is set
- Check that GoTrue service is running: `docker ps | grep gotrue`
- Verify GoTrue health: `curl http://127.0.0.1:54321/auth/v1/health`

**Login fails with "Invalid credentials":**
- Verify the user exists in `auth.users` table
- Check that the password is correct
- Review GoTrue logs: `docker logs <gotrue-container-id>`

**Session expires immediately:**
- Verify JWT_SECRET matches between Studio and GoTrue
- Check system clock synchronization
- Review token expiration settings in GoTrue configuration

**"Authentication service unavailable" error:**
- Verify GoTrue is running and accessible
- Check Kong gateway is routing requests correctly
- Verify network connectivity between services

## Multi-Database Project Management

Studio supports managing multiple projects within a single PostgreSQL instance. Each project gets its own isolated database, created from a template database.

### How it works

When you create a new project in Studio:

1. A new PostgreSQL database is created in your PostgreSQL instance
2. The database is created using the template database specified in your configuration
3. All tables, views, functions, and initial data from the template are copied to the new database
4. Each project maintains complete data isolation from other projects

### Configuration

Configure the template database in your `.env` file:

```bash
# Multi-Database Configuration
# Specify the template database to use when creating new project databases
# If not set, defaults to POSTGRES_DB or 'postgres'
TEMPLATE_DATABASE_NAME=postgres
```

### Template Database Selection

Studio uses the following priority order to determine the template database:

1. `TEMPLATE_DATABASE_NAME` environment variable (if set)
2. `POSTGRES_DB` environment variable (if set)
3. Default to `postgres` database

### Best Practices

**Template Database Setup:**
- Set up your template database with all the tables, functions, and extensions you want in new projects
- Include any seed data or default configurations
- Keep the template database clean and well-maintained
- Consider using Supabase migrations to manage your template schema

**Database Naming:**
- Database names are automatically generated from project names
- Names are sanitized to follow PostgreSQL naming rules (lowercase, alphanumeric, underscores)
- You can also specify custom database names when creating projects
- Database names must be unique across your PostgreSQL instance

**Resource Management:**
- Each database consumes disk space and memory
- Monitor your PostgreSQL instance resources as you create more projects
- Consider implementing cleanup policies for unused projects
- Use PostgreSQL's built-in tools to monitor database sizes

**Security:**
- Each project database is isolated from others
- Connection strings are project-specific
- Ensure proper PostgreSQL user permissions are configured
- Never share connection strings between projects

### Example Workflow

1. **Set up your template database:**
   ```sql
   -- Connect to your template database
   \c postgres
   
   -- Create your schema
   CREATE TABLE users (
     id SERIAL PRIMARY KEY,
     email TEXT UNIQUE NOT NULL,
     created_at TIMESTAMP DEFAULT NOW()
   );
   
   -- Add extensions
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   ```

2. **Configure Studio:**
   ```bash
   # In apps/studio/.env
   TEMPLATE_DATABASE_NAME=postgres
   ```

3. **Create a new project:**
   - Open Studio in your browser
   - Click "New Project"
   - Enter a project name (database name is auto-generated)
   - Or specify a custom database name
   - Click "Create Project"

4. **Verify the new database:**
   ```sql
   -- List all databases
   \l
   
   -- Connect to the new project database
   \c your_project_database_name
   
   -- Verify tables were copied from template
   \dt
   ```

### Troubleshooting

**Template database not found:**
- Verify the `TEMPLATE_DATABASE_NAME` exists in your PostgreSQL instance
- Check the Studio logs for detailed error messages
- Ensure the database user has access to the template database

**Database creation fails:**
- Check PostgreSQL logs for detailed errors
- Verify sufficient disk space is available
- Ensure the database user has `CREATEDB` permission
- Check for database name conflicts

**Connection issues:**
- Verify the connection string includes the correct database name
- Check PostgreSQL connection limits
- Ensure the database user has access to the project database
