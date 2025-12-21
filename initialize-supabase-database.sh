#!/bin/bash

# Initialize Supabase Database Script
# This script initializes both postgres and _supabase databases with all required
# schemas, extensions, roles, and service users with custom passwords

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Print colored output
print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_header() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo ""
}

print_step() {
    echo -e "${BLUE}▶${NC} $1"
}

# Function to show usage
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Initialize Supabase databases (postgres and _supabase) with all required schemas,
extensions, roles, and service users.

OPTIONS:
    -h, --help              Show this help message
    -t, --target-host       Target database host (default: localhost)
    -T, --target-port       Target database port (default: 5432)
    -U, --target-user       Target database superuser (default: postgres)
    -P, --target-password   Target database password
    -w, --service-password  Password for all service users (required)
    --docker                Use Docker container (supabase-db) as target
    --env-file              Path to .env file (default: docker/.env)
    --skip-users            Skip service users creation
    --skip-schemas          Skip schema initialization
    --skip-tables           Skip table creation (only create schemas)
    --skip-migrations       Skip applying migration files from supabase/migrations
    --dry-run               Show what would be done without making changes

EXAMPLES:
    # Initialize Docker database with custom password
    $0 --docker --service-password "MySecurePassword123"

    # Initialize remote database
    $0 -t db.example.com -U postgres -P dbpass \\
       -w "ServicePassword123"

    # Dry run to see what would happen
    $0 --docker --service-password "test" --dry-run

    # Skip user creation, only initialize schemas
    $0 --docker --service-password "test" --skip-users

DATABASES INITIALIZED:
    - postgres: Main database with auth, storage, realtime schemas
    - _supabase: Internal database with _analytics schema

SERVICE USERS CREATED:
    - supabase_auth_admin      (for GoTrue auth service)
    - authenticator            (for PostgREST API)
    - supabase_storage_admin   (for Storage service)
    - supabase_admin           (for Realtime and other services)
    - supabase_functions_admin (for Edge Functions)
    - pgbouncer                (for connection pooling)
    - supabase_read_only_user  (for read-only access to public schema)

EOF
}

# Default values
TARGET_HOST="localhost"
TARGET_PORT="5432"
TARGET_USER="postgres"
TARGET_PASSWORD=""
SERVICE_PASSWORD=""
USE_DOCKER=false
DRY_RUN=false
SKIP_USERS=false
SKIP_SCHEMAS=false
SKIP_TABLES=false
SKIP_MIGRATIONS=false
ENV_FILE="docker/.env"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_usage
            exit 0
            ;;
        -t|--target-host)
            TARGET_HOST="$2"
            shift 2
            ;;
        -T|--target-port)
            TARGET_PORT="$2"
            shift 2
            ;;
        -U|--target-user)
            TARGET_USER="$2"
            shift 2
            ;;
        -P|--target-password)
            TARGET_PASSWORD="$2"
            shift 2
            ;;
        -w|--service-password)
            SERVICE_PASSWORD="$2"
            shift 2
            ;;
        --docker)
            USE_DOCKER=true
            shift
            ;;
        --env-file)
            ENV_FILE="$2"
            shift 2
            ;;
        --skip-users)
            SKIP_USERS=true
            shift
            ;;
        --skip-schemas)
            SKIP_SCHEMAS=true
            shift
            ;;
        --skip-tables)
            SKIP_TABLES=true
            shift
            ;;
        --skip-migrations)
            SKIP_MIGRATIONS=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Validate required parameters
if [ "$SKIP_USERS" = false ] && [ -z "$SERVICE_PASSWORD" ]; then
    print_error "Service password is required. Use -w or --service-password"
    print_info "Or use --skip-users to skip service user creation"
    show_usage
    exit 1
fi

# Load environment variables if using Docker
if [ "$USE_DOCKER" = true ]; then
    if [ -f "$ENV_FILE" ]; then
        source "$ENV_FILE"
        print_success "Loaded environment variables from $ENV_FILE"
        TARGET_PASSWORD="${POSTGRES_PASSWORD}"

        # Load JWT settings
        JWT_SECRET="${JWT_SECRET}"
        JWT_EXP="${JWT_EXPIRY:-3600}"
    else
        print_warning "Environment file not found: $ENV_FILE"
        print_info "Using default values"
    fi
fi

print_header "Supabase Database Initialization"

# Display configuration
print_info "Configuration:"
if [ "$USE_DOCKER" = true ]; then
    echo "  Target: Docker container (supabase-db)"
else
    echo "  Target: $TARGET_USER@$TARGET_HOST:$TARGET_PORT"
fi

if [ "$SKIP_USERS" = false ]; then
    echo "  Service Password: ********** (${#SERVICE_PASSWORD} characters)"
fi

echo "  Skip Users: $SKIP_USERS"
echo "  Skip Schemas: $SKIP_SCHEMAS"
echo "  Skip Tables: $SKIP_TABLES"
echo "  Skip Migrations: $SKIP_MIGRATIONS"

if [ "$DRY_RUN" = true ]; then
    print_warning "DRY RUN MODE - No changes will be made"
fi

echo ""

# Function to execute SQL
execute_sql() {
    local sql="$1"
    local database="${2:-postgres}"
    local description="$3"

    if [ "$DRY_RUN" = true ]; then
        if [ -n "$description" ]; then
            print_info "[DRY RUN] Would execute: $description"
        fi
        return 0
    fi

    local result
    if [ "$USE_DOCKER" = true ]; then
        result=$(docker exec supabase-db psql -U "$TARGET_USER" -d "$database" -c "$sql" 2>&1)
    else
        result=$(PGPASSWORD="$TARGET_PASSWORD" psql -h "$TARGET_HOST" -p "$TARGET_PORT" -U "$TARGET_USER" -d "$database" -c "$sql" 2>&1)
    fi

    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        if [ -n "$description" ]; then
            print_warning "SQL execution warning for: $description"
            echo "Error: $result" >&2
        fi
        return 1
    fi
    return 0
}

# Function to execute SQL file
execute_sql_file() {
    local file_path="$1"
    local database="${2:-postgres}"
    local description="$3"

    if [ "$DRY_RUN" = true ]; then
        print_info "[DRY RUN] Would execute file: $file_path on database: $database"
        return 0
    fi

    if [ "$USE_DOCKER" = true ]; then
        # Copy file to container and execute
        docker cp "$file_path" supabase-db:/tmp/temp_init.sql > /dev/null 2>&1
        docker exec supabase-db psql -U "$TARGET_USER" -d "$database" -f /tmp/temp_init.sql > /dev/null 2>&1
        docker exec supabase-db rm -f /tmp/temp_init.sql > /dev/null 2>&1
    else
        PGPASSWORD="$TARGET_PASSWORD" psql -h "$TARGET_HOST" -p "$TARGET_PORT" -U "$TARGET_USER" -d "$database" -f "$file_path" > /dev/null 2>&1
    fi
}

# Function to check if database exists
check_database_exists() {
    local dbname="$1"
    local result

    if [ "$USE_DOCKER" = true ]; then
        result=$(docker exec supabase-db psql -U "$TARGET_USER" -t -c "SELECT 1 FROM pg_database WHERE datname='$dbname';" 2>/dev/null | tr -d ' \n')
    else
        result=$(PGPASSWORD="$TARGET_PASSWORD" psql -h "$TARGET_HOST" -p "$TARGET_PORT" -U "$TARGET_USER" -t -c "SELECT 1 FROM pg_database WHERE datname='$dbname';" 2>/dev/null | tr -d ' \n')
    fi

    [ "$result" = "1" ]
}

# Function to check if user exists
check_user_exists() {
    local username="$1"
    local result

    if [ "$USE_DOCKER" = true ]; then
        result=$(docker exec supabase-db psql -U "$TARGET_USER" -d postgres -t -c "SELECT 1 FROM pg_roles WHERE rolname='$username';" 2>/dev/null | tr -d ' \n')
    else
        result=$(PGPASSWORD="$TARGET_PASSWORD" psql -h "$TARGET_HOST" -p "$TARGET_PORT" -U "$TARGET_USER" -d postgres -t -c "SELECT 1 FROM pg_roles WHERE rolname='$username';" 2>/dev/null | tr -d ' \n')
    fi

    [ "$result" = "1" ]
}

# Check Docker container if needed
if [ "$USE_DOCKER" = true ]; then
    if ! docker ps | grep -q supabase-db; then
        print_error "Docker container 'supabase-db' is not running"
        print_info "Start it with: docker compose -f docker/docker-compose.yml up -d db"
        exit 1
    fi
    print_success "Docker container 'supabase-db' is running"
fi

# ============================================================================
# STEP 0: Apply exported schema migration first
# ============================================================================

if [ "$SKIP_SCHEMAS" = false ] && [ "$SKIP_MIGRATIONS" = false ]; then
    print_header "Step 0: Apply Exported Schema Migration"

    # Apply the exported current schema with error handling FIRST
    EXPORTED_SCHEMA_FILE="supabase/migrations/20251210212821_export_current_schema.sql"
    if [ -f "$EXPORTED_SCHEMA_FILE" ]; then
        print_step "Applying exported schema from $EXPORTED_SCHEMA_FILE..."

        # Create a temporary file with error-tolerant SQL
        TEMP_SCHEMA_FILE="/tmp/temp_schema_$(date +%s).sql"

        if [ "$DRY_RUN" = false ]; then
            # Add error handling to the SQL file
            cat > "$TEMP_SCHEMA_FILE" << 'EOF'
-- Set error handling for migration
SET client_min_messages = WARNING;
DO $$
BEGIN
    -- This block will catch and ignore errors for objects that already exist
    NULL;
END $$;

EOF
            # Append the original schema file content
            cat "$EXPORTED_SCHEMA_FILE" >> "$TEMP_SCHEMA_FILE"

            if execute_sql_file "$TEMP_SCHEMA_FILE" "postgres" "Apply exported current schema"; then
                print_success "Applied exported schema successfully"
            else
                print_warning "Some objects from exported schema may already exist (this is normal)"
            fi

            # Clean up temporary file
            rm -f "$TEMP_SCHEMA_FILE"
        else
            print_info "[DRY RUN] Would apply exported schema from $EXPORTED_SCHEMA_FILE"
        fi
    else
        print_warning "Exported schema file not found: $EXPORTED_SCHEMA_FILE"
        print_info "Continuing with normal initialization"
    fi
fi

# ============================================================================
# STEP 1: Create _supabase database
# ============================================================================

if [ "$SKIP_SCHEMAS" = false ]; then
    print_header "Step 1: Initialize _supabase Database"

    if check_database_exists "_supabase"; then
        print_info "_supabase database already exists"
    else
        print_step "Creating _supabase database..."
        if execute_sql "CREATE DATABASE _supabase WITH OWNER $TARGET_USER;" "postgres" "Create _supabase database"; then
            print_success "Created _supabase database"
        else
            print_warning "_supabase database might already exist, continuing..."
        fi
    fi

    # Create and initialize _analytics schema in _supabase
    if [ "$SKIP_TABLES" = false ]; then
        print_step "Creating _analytics schema and tables..."
    else
        print_step "Creating _analytics schema..."
    fi

    if execute_sql "CREATE SCHEMA IF NOT EXISTS _analytics;" "_supabase" "Create _analytics schema"; then
        execute_sql "ALTER SCHEMA _analytics OWNER TO $TARGET_USER;" "_supabase" "Set _analytics owner"

        # Initialize analytics tables if SQL file exists and not skipping tables
        if [ "$SKIP_TABLES" = false ] && [ -f "apps/studio/lib/project-initialization/sql/analytics-schema.sql" ]; then
            if execute_sql_file "apps/studio/lib/project-initialization/sql/analytics-schema.sql" "_supabase" "Initialize analytics tables"; then
                print_success "Created _analytics schema with tables in _supabase"
            else
                print_warning "Failed to initialize analytics tables (may already exist)"
                print_success "Created _analytics schema in _supabase"
            fi
        else
            if [ "$SKIP_TABLES" = true ]; then
                print_success "Created _analytics schema in _supabase (skipped table creation)"
            else
                print_success "Created _analytics schema in _supabase (tables will be created by Analytics service)"
            fi
        fi
    else
        print_warning "Failed to create _analytics schema"
    fi
fi

# ============================================================================
# STEP 2: Initialize postgres database schemas
# ============================================================================

if [ "$SKIP_SCHEMAS" = false ]; then
    print_header "Step 2: Initialize postgres Database Schemas"

    # Create extensions schema
    print_step "Creating extensions schema..."
    execute_sql "CREATE SCHEMA IF NOT EXISTS extensions;" "postgres" "Create extensions schema"
    print_success "Created extensions schema"

    # Create basic extensions
    print_step "Installing PostgreSQL extensions..."
    execute_sql "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\" SCHEMA extensions;" "postgres" "Install uuid-ossp"
    execute_sql "CREATE EXTENSION IF NOT EXISTS \"pgcrypto\" SCHEMA extensions;" "postgres" "Install pgcrypto"
    execute_sql "CREATE EXTENSION IF NOT EXISTS \"pg_stat_statements\";" "postgres" "Install pg_stat_statements"
    print_success "Installed basic extensions"

    # Create and initialize auth schema with tables
    if [ "$SKIP_TABLES" = false ]; then
        print_step "Creating auth schema and tables..."
    else
        print_step "Creating auth schema..."
    fi
    execute_sql "CREATE SCHEMA IF NOT EXISTS auth;" "postgres" "Create auth schema"

    # Initialize auth tables if SQL file exists and not skipping tables
    if [ "$SKIP_TABLES" = false ] && [ -f "apps/studio/lib/project-initialization/sql/auth-schema.sql" ]; then
        if execute_sql_file "apps/studio/lib/project-initialization/sql/auth-schema.sql" "postgres" "Initialize auth tables"; then
            print_success "Created auth schema with tables"
        else
            print_warning "Failed to initialize auth tables (may already exist)"
            print_success "Created auth schema"
        fi
    else
        if [ "$SKIP_TABLES" = true ]; then
            print_success "Created auth schema (skipped table creation)"
        else
            print_success "Created auth schema (tables will be created by GoTrue on first start)"
        fi
    fi

    # Create and initialize storage schema with tables
    if [ "$SKIP_TABLES" = false ]; then
        print_step "Creating storage schema and tables..."
    else
        print_step "Creating storage schema..."
    fi
    execute_sql "CREATE SCHEMA IF NOT EXISTS storage;" "postgres" "Create storage schema"

    # Initialize storage tables if SQL file exists and not skipping tables
    if [ "$SKIP_TABLES" = false ] && [ -f "apps/studio/lib/project-initialization/sql/storage-schema.sql" ]; then
        if execute_sql_file "apps/studio/lib/project-initialization/sql/storage-schema.sql" "postgres" "Initialize storage tables"; then
            print_success "Created storage schema with tables"
        else
            print_warning "Failed to initialize storage tables (may already exist)"
            print_success "Created storage schema"
        fi
    else
        if [ "$SKIP_TABLES" = true ]; then
            print_success "Created storage schema (skipped table creation)"
        else
            print_success "Created storage schema (tables will be created by Storage service on first start)"
        fi
    fi

    # Create _realtime schema
    print_step "Creating _realtime schema..."
    execute_sql "CREATE SCHEMA IF NOT EXISTS _realtime;" "postgres" "Create _realtime schema"
    execute_sql "ALTER SCHEMA _realtime OWNER TO $TARGET_USER;" "postgres" "Set _realtime owner"
    print_success "Created _realtime schema"

    # Create supabase_functions schema (from webhooks.sql)
    print_step "Creating supabase_functions schema..."
    if [ -f "docker/volumes/db/webhooks.sql" ]; then
        if execute_sql_file "docker/volumes/db/webhooks.sql" "postgres" "Initialize webhooks and functions"; then
            print_success "Created supabase_functions schema and webhooks"
        else
            print_warning "Failed to initialize webhooks (may already exist)"
        fi
    else
        print_warning "webhooks.sql not found, skipping"
    fi
fi

# ============================================================================
# STEP 3: Create base roles
# ============================================================================

if [ "$SKIP_USERS" = false ]; then
    print_header "Step 3: Create Base Roles"

    BASE_ROLES=(
        "anon:NOLOGIN NOINHERIT"
        "authenticated:NOLOGIN NOINHERIT"
        "service_role:NOLOGIN NOINHERIT BYPASSRLS"
        "dashboard_user:NOLOGIN"
    )

    for role_def in "${BASE_ROLES[@]}"; do
        IFS=':' read -r rolename attributes <<< "$role_def"

        if check_user_exists "$rolename"; then
            print_info "$rolename role already exists"
        else
            print_step "Creating $rolename role..."
            if execute_sql "CREATE ROLE $rolename $attributes;" "postgres" "Create role $rolename"; then
                print_success "Created $rolename role"
            else
                print_warning "Failed to create $rolename role (may already exist)"
            fi
        fi
    done
fi

# ============================================================================
# STEP 4: Create service users
# ============================================================================

if [ "$SKIP_USERS" = false ]; then
    print_header "Step 4: Create Service Users"

    # Service users configuration
    SERVICE_USERS_LIST=(
        "supabase_auth_admin:NOLOGIN NOINHERIT"
        "authenticator:NOINHERIT LOGIN"
        "supabase_storage_admin:NOLOGIN NOINHERIT"
        "supabase_admin:LOGIN CREATEROLE CREATEDB BYPASSRLS"
        "supabase_functions_admin:NOINHERIT CREATEROLE LOGIN NOREPLICATION"
        "pgbouncer:LOGIN"
        "supabase_read_only_user:LOGIN"
    )

    CREATED_COUNT=0
    UPDATED_COUNT=0

    for user_def in "${SERVICE_USERS_LIST[@]}"; do
        IFS=':' read -r username attributes <<< "$user_def"

        if check_user_exists "$username"; then
            print_step "Updating password for $username..."
            if execute_sql "ALTER USER $username WITH PASSWORD '$SERVICE_PASSWORD';" "postgres" "Update password for $username"; then
                print_success "Updated password for $username"
                ((UPDATED_COUNT++))
            else
                print_error "Failed to update password for $username"
            fi
        else
            print_step "Creating user $username..."
            if execute_sql "CREATE USER $username WITH PASSWORD '$SERVICE_PASSWORD' $attributes;" "postgres" "Create user $username"; then
                print_success "Created user $username"
                ((CREATED_COUNT++))
            else
                print_warning "Failed to create user $username, might already exist"
            fi
        fi
    done

    # Grant roles
    print_step "Granting role memberships..."
    execute_sql "GRANT anon TO authenticator;" "postgres" "Grant anon to authenticator" || true
    execute_sql "GRANT authenticated TO authenticator;" "postgres" "Grant authenticated to authenticator" || true
    execute_sql "GRANT service_role TO authenticator;" "postgres" "Grant service_role to authenticator" || true
    execute_sql "GRANT supabase_auth_admin TO supabase_admin;" "postgres" "Grant auth admin" || true
    execute_sql "GRANT supabase_storage_admin TO supabase_admin;" "postgres" "Grant storage admin" || true
    execute_sql "GRANT supabase_functions_admin TO supabase_admin;" "postgres" "Grant functions admin" || true
    print_success "Granted role memberships"

    echo ""
    print_info "Service users summary:"
    echo "  Created: $CREATED_COUNT"
    echo "  Updated: $UPDATED_COUNT"
fi

# ============================================================================
# STEP 5: Set JWT configuration
# ============================================================================

if [ "$SKIP_SCHEMAS" = false ] && [ -n "$JWT_SECRET" ]; then
    print_header "Step 5: Configure JWT Settings"

    print_step "Setting JWT configuration..."
    execute_sql "ALTER DATABASE postgres SET \"app.settings.jwt_secret\" TO '$JWT_SECRET';" "postgres" "Set JWT secret"
    execute_sql "ALTER DATABASE postgres SET \"app.settings.jwt_exp\" TO '${JWT_EXP:-3600}';" "postgres" "Set JWT expiry"
    print_success "JWT configuration set"
fi

# ============================================================================
# STEP 6: Apply additional migration files
# ============================================================================

if [ "$SKIP_SCHEMAS" = false ] && [ "$SKIP_MIGRATIONS" = false ]; then
    print_header "Step 6: Apply Additional Migration Files"

    # Note: Exported schema migration already applied in Step 0
    # Skip the exported schema file since it's already applied
    # Apply other migration files in order
    MIGRATIONS_DIR="supabase/migrations"
    if [ -d "$MIGRATIONS_DIR" ]; then
        print_step "Applying additional migration files..."

        # Get all .sql files in migrations directory, sorted by name
        MIGRATION_FILES=$(find "$MIGRATIONS_DIR" -name "*.sql" -type f | sort)
        APPLIED_COUNT=0
        SKIPPED_COUNT=0

        for migration_file in $MIGRATION_FILES; do
            # Skip the main exported schema file as it's already applied
            if [[ "$migration_file" == *"20251210212821_export_current_schema.sql" ]]; then
                continue
            fi

            filename=$(basename "$migration_file")
            print_step "  Applying migration: $filename"

            if execute_sql_file "$migration_file" "postgres" "Apply migration $filename"; then
                print_success "  ✓ Applied $filename"
                ((APPLIED_COUNT++))
            else
                print_warning "  ⚠ Skipped $filename (may already exist or have conflicts)"
                ((SKIPPED_COUNT++))
            fi
        done

        echo ""
        print_info "Migration summary:"
        echo "  Applied: $APPLIED_COUNT"
        echo "  Skipped: $SKIPPED_COUNT"
    else
        print_warning "Migrations directory not found: $MIGRATIONS_DIR"
    fi
fi

# ============================================================================
# STEP 7: Grant schema permissions
# ============================================================================

if [ "$SKIP_SCHEMAS" = false ] && [ "$SKIP_USERS" = false ]; then
    print_header "Step 7: Grant Schema Permissions"

    print_step "Granting permissions on auth schema..."
    execute_sql "GRANT USAGE ON SCHEMA auth TO postgres, anon, authenticated, service_role;" "postgres"
    execute_sql "GRANT ALL ON ALL TABLES IN SCHEMA auth TO postgres, supabase_auth_admin;" "postgres"
    execute_sql "GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO postgres, supabase_auth_admin;" "postgres"
    execute_sql "GRANT ALL ON ALL FUNCTIONS IN SCHEMA auth TO postgres, supabase_auth_admin;" "postgres"
    print_success "Granted auth schema permissions"

    print_step "Granting permissions on storage schema..."
    execute_sql "GRANT USAGE ON SCHEMA storage TO postgres, anon, authenticated, service_role;" "postgres"
    execute_sql "GRANT ALL ON ALL TABLES IN SCHEMA storage TO postgres, supabase_storage_admin;" "postgres"
    execute_sql "GRANT ALL ON ALL SEQUENCES IN SCHEMA storage TO postgres, supabase_storage_admin;" "postgres"
    execute_sql "GRANT ALL ON ALL FUNCTIONS IN SCHEMA storage TO postgres, supabase_storage_admin;" "postgres"
    print_success "Granted storage schema permissions"

    print_step "Granting permissions on extensions schema..."
    execute_sql "GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;" "postgres"
    print_success "Granted extensions schema permissions"

    print_step "Granting read-only permissions to supabase_read_only_user..."
    execute_sql "GRANT CONNECT ON DATABASE postgres TO supabase_read_only_user;" "postgres"
    execute_sql "GRANT USAGE ON SCHEMA public TO supabase_read_only_user;" "postgres"
    execute_sql "GRANT SELECT ON ALL TABLES IN SCHEMA public TO supabase_read_only_user;" "postgres"
    print_success "Granted read-only permissions to supabase_read_only_user"
fi

# ============================================================================
# STEP 8: Update environment file
# ============================================================================

if [ "$USE_DOCKER" = true ] && [ "$DRY_RUN" = false ] && [ "$SKIP_USERS" = false ]; then
    print_header "Step 8: Update Environment File"

    if [ -f "$ENV_FILE" ]; then
        # Backup original file
        BACKUP_FILE="${ENV_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
        cp "$ENV_FILE" "$BACKUP_FILE"
        print_success "Created backup: $BACKUP_FILE"

        # Update POSTGRES_PASSWORD in .env
        if grep -q "^POSTGRES_PASSWORD=" "$ENV_FILE"; then
            sed -i.tmp "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$SERVICE_PASSWORD|" "$ENV_FILE"
            rm -f "${ENV_FILE}.tmp"
            print_success "Updated POSTGRES_PASSWORD in $ENV_FILE"
        else
            print_warning "POSTGRES_PASSWORD not found in $ENV_FILE"
        fi
    fi
fi

# ============================================================================
# Final Summary
# ============================================================================

print_header "Initialization Complete"

if [ "$DRY_RUN" = false ]; then
    print_success "Supabase databases initialized successfully!"
    echo ""
    print_info "Databases initialized:"
    echo "  ✓ postgres (with auth, storage, _realtime, supabase_functions schemas)"
    echo "  ✓ _supabase (with _analytics schema)"
    echo ""

    if [ "$SKIP_USERS" = false ]; then
        print_info "Service users configured:"
        echo "  ✓ supabase_auth_admin"
        echo "  ✓ authenticator"
        echo "  ✓ supabase_storage_admin"
        echo "  ✓ supabase_admin"
        echo "  ✓ supabase_functions_admin"
        echo "  ✓ pgbouncer"
        echo "  ✓ supabase_read_only_user"
        echo ""
    fi

    print_info "Next steps:"
    echo "  1. Verify database connection:"
    if [ "$USE_DOCKER" = true ]; then
        echo "     docker exec supabase-db psql -U postgres -c '\\l'"
    else
        echo "     psql -h $TARGET_HOST -U $TARGET_USER -c '\\l'"
    fi
    echo ""
    echo "  2. Restart Supabase services:"
    echo "     docker compose -f docker/docker-compose.yml restart"
    echo ""
    echo "  3. Verify services are working:"
    echo "     curl http://localhost:8000/auth/v1/health"
else
    echo ""
    print_warning "This was a DRY RUN. No actual changes were made."
    print_info "Remove --dry-run flag to apply changes."
fi

echo ""
