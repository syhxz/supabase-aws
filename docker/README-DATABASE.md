# Database Configuration Guide

By default, the Supabase Studio Docker setup is configured to use an **external database** and does not start the built-in PostgreSQL container.

## Quick Start

### Using External Database (Default)
```bash
# Start without built-in database
./quick-start.sh
```

### Using Built-in Database
```bash
# Start with built-in PostgreSQL database
./quick-start.sh --with-db
```

## Configuration Options

### Method 1: Command Line Flag
Use the `--with-db` flag when starting:
```bash
./quick-start.sh --with-db
```

### Method 2: Environment Variable
Set `ENABLE_SUPABASE_DB=true` in `docker/.env`:
```bash
# In docker/.env
ENABLE_SUPABASE_DB=true
```

Then start normally:
```bash
./quick-start.sh
```

### Method 3: Toggle Script
Use the convenient toggle script:
```bash
# Enable built-in database
./docker/toggle-database.sh enable

# Disable built-in database (use external)
./docker/toggle-database.sh disable

# Check current status
./docker/toggle-database.sh status
```

### Method 4: Docker Compose Profiles
Directly use Docker Compose with profiles:
```bash
# With built-in database
docker compose -f docker/docker-compose.yml --profile db up -d

# Without built-in database (default)
docker compose -f docker/docker-compose.yml up -d
```

## External Database Setup

When using an external database, make sure to configure the following environment variables in `docker/.env`:

```bash
# Database connection settings
POSTGRES_HOST=your-external-db-host
POSTGRES_PORT=5432
POSTGRES_DB=your-database-name
POSTGRES_PASSWORD=your-database-password

# Disable built-in database
ENABLE_SUPABASE_DB=false
```

## Built-in Database Details

When enabled, the built-in PostgreSQL database:
- Runs on port `5432` (mapped to host)
- Uses persistent volumes in `docker/volumes/db/`
- Includes all Supabase extensions and configurations
- Automatically initializes with required schemas

## Troubleshooting

### Services won't start without database
If services fail to start in external database mode, check:
1. External database is accessible
2. Connection parameters are correct in `.env`
3. Database has required permissions and extensions

### Switching between modes
When switching between built-in and external database:
1. Stop all services: `docker compose -f docker/docker-compose.yml down`
2. Update configuration
3. Restart: `./quick-start.sh` (with appropriate flags)

## Service Dependencies

The following services depend on the database and will adapt automatically:
- `auth` (GoTrue)
- `rest` (PostgREST) 
- `realtime`
- `storage`
- `meta`
- `functions`
- `analytics`

When using external database mode, these services will attempt to connect to your external database using the configured connection parameters.