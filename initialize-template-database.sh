#!/bin/bash

# Initialize Template Database with Complete Schemas
# This script creates and initializes the template database with all required schemas
# including the complete storage schema with all necessary columns

set -e

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --host)
            DB_HOST="$2"
            shift 2
            ;;
        --port)
            DB_PORT="$2"
            shift 2
            ;;
        --user)
            DB_USER="$2"
            shift 2
            ;;
        --password)
            DB_PASSWORD="$2"
            shift 2
            ;;
        --database)
            TEMPLATE_DB_NAME="$2"
            shift 2
            ;;
        --container)
            USE_CONTAINER="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --host HOST         Database host (default: localhost)"
            echo "  --port PORT         Database port (default: 5432)"
            echo "  --user USER         Database user (default: postgres)"
            echo "  --password PASS     Database password"
            echo "  --database NAME     Template database name (default: supabase_template)"
            echo "  --container NAME    Docker container name (default: supabase-db)"
            echo "  --help              Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Set defaults
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_USER=${DB_USER:-postgres}
USE_CONTAINER=${USE_CONTAINER:-supabase-db}

# Load environment variables if no command line args provided
if [ -z "$DB_PASSWORD" ] && [ -f "docker/.env" ]; then
    source docker/.env
    echo "✓ Loaded environment variables from docker/.env"
    DB_PASSWORD=${POSTGRES_PASSWORD}
fi

# Use environment variable or default for template name
TEMPLATE_DB_NAME=${TEMPLATE_DB_NAME:-${TEMPLATE_DATABASE_NAME:-supabase_template}}

echo "🔧 Initializing Template Database: $TEMPLATE_DB_NAME"
echo "📡 Connection: $DB_USER@$DB_HOST:$DB_PORT"

# Function to execute SQL on the template database
execute_template_sql() {
    local sql="$1"
    local description="$2"

    echo "  📋 $description..."

    if [ -n "$USE_CONTAINER" ] && docker ps | grep -q "$USE_CONTAINER" 2>/dev/null; then
        # Use container
        if docker exec "$USE_CONTAINER" psql -U "$DB_USER" -d "$TEMPLATE_DB_NAME" -c "$sql" > /dev/null 2>&1; then
            echo "  ✓ $description completed"
        else
            echo "  ❌ $description failed"
            return 1
        fi
    else
        # Use direct connection
        if [ -n "$DB_PASSWORD" ]; then
            export PGPASSWORD="$DB_PASSWORD"
        fi
        if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TEMPLATE_DB_NAME" -c "$sql" > /dev/null 2>&1; then
            echo "  ✓ $description completed"
        else
            echo "  ❌ $description failed"
            return 1
        fi
    fi
}

# Function to execute SQL file on the template database
execute_template_sql_file() {
    local file_path="$1"
    local description="$2"

    echo "  📋 $description..."

    if [ -n "$USE_CONTAINER" ] && docker ps | grep -q "$USE_CONTAINER" 2>/dev/null; then
        # Use container
        if docker cp "$file_path" "$USE_CONTAINER":/tmp/temp_schema.sql > /dev/null 2>&1; then
            if docker exec "$USE_CONTAINER" psql -U "$DB_USER" -d "$TEMPLATE_DB_NAME" -f /tmp/temp_schema.sql > /dev/null 2>&1; then
                echo "  ✓ $description completed"
                docker exec "$USE_CONTAINER" rm -f /tmp/temp_schema.sql > /dev/null 2>&1
            else
                echo "  ❌ $description failed"
                return 1
            fi
        else
            echo "  ❌ Failed to copy SQL file to container"
            return 1
        fi
    else
        # Use direct connection
        if [ -n "$DB_PASSWORD" ]; then
            export PGPASSWORD="$DB_PASSWORD"
        fi
        if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TEMPLATE_DB_NAME" -f "$file_path" > /dev/null 2>&1; then
            echo "  ✓ $description completed"
        else
            echo "  ❌ $description failed"
            return 1
        fi
    fi
}

# Check database connection
echo "🔍 Checking database connection..."
if [ "$DB_HOST" != "localhost" ] && [ "$DB_HOST" != "127.0.0.1" ]; then
    echo "✓ Using direct connection to $DB_HOST:$DB_PORT"
    USE_CONTAINER=""
    # Test connection
    if [ -n "$DB_PASSWORD" ]; then
        export PGPASSWORD="$DB_PASSWORD"
    fi
    if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "SELECT 1;" > /dev/null 2>&1; then
        echo "❌ Error: Cannot connect to database"
        echo "Please check your connection parameters"
        exit 1
    fi
elif docker ps | grep -q "$USE_CONTAINER" 2>/dev/null; then
    echo "✓ Using Docker container: $USE_CONTAINER"
    # Wait for database to be ready
    echo "⏳ Waiting for database to be ready..."
    sleep 5
else
    echo "✓ Using direct connection to $DB_HOST:$DB_PORT"
    USE_CONTAINER=""
    # Test connection
    if [ -n "$DB_PASSWORD" ]; then
        export PGPASSWORD="$DB_PASSWORD"
    fi
    if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "SELECT 1;" > /dev/null 2>&1; then
        echo "❌ Error: Cannot connect to database"
        echo "Please check your connection parameters"
        exit 1
    fi
fi

# Check if template database exists
echo "🔍 Checking if template database exists..."
if [ -n "$USE_CONTAINER" ] && docker ps | grep -q "$USE_CONTAINER" 2>/dev/null; then
    DB_EXISTS=$(docker exec "$USE_CONTAINER" psql -U "$DB_USER" -t -c "SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = '$TEMPLATE_DB_NAME');" | tr -d ' ')
else
    if [ -n "$DB_PASSWORD" ]; then
        export PGPASSWORD="$DB_PASSWORD"
    fi
    DB_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -t -c "SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = '$TEMPLATE_DB_NAME');" | tr -d ' ')
fi

if [ "$DB_EXISTS" = "f" ]; then
    echo "📦 Creating template database: $TEMPLATE_DB_NAME"
    if [ -n "$USE_CONTAINER" ] && docker ps | grep -q "$USE_CONTAINER" 2>/dev/null; then
        docker exec "$USE_CONTAINER" psql -U "$DB_USER" -c "CREATE DATABASE \"$TEMPLATE_DB_NAME\";"
    else
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "CREATE DATABASE \"$TEMPLATE_DB_NAME\";"
    fi
    echo "✓ Template database created"
else
    echo "✓ Template database already exists"
fi

# Initialize basic extensions
echo "🔧 Installing basic extensions..."
execute_template_sql "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";" "Installing uuid-ossp extension"
execute_template_sql "CREATE EXTENSION IF NOT EXISTS \"pgcrypto\";" "Installing pgcrypto extension"

# Create schemas
echo "🏗️  Creating schemas..."
execute_template_sql "CREATE SCHEMA IF NOT EXISTS auth;" "Creating auth schema"
execute_template_sql "CREATE SCHEMA IF NOT EXISTS storage;" "Creating storage schema"
execute_template_sql "CREATE SCHEMA IF NOT EXISTS extensions;" "Creating extensions schema"

# Initialize auth schema
echo "🔐 Initializing auth schema..."
if [ -f "apps/studio/lib/project-initialization/sql/auth-schema.sql" ]; then
    execute_template_sql_file "apps/studio/lib/project-initialization/sql/auth-schema.sql" "Installing auth schema"
else
    echo "  ⚠️  Auth schema file not found, skipping..."
fi

# Initialize storage schema with complete structure
echo "💾 Initializing storage schema..."
if [ -f "apps/studio/lib/project-initialization/sql/storage-schema.sql" ]; then
    execute_template_sql_file "apps/studio/lib/project-initialization/sql/storage-schema.sql" "Installing storage schema"
else
    echo "  ⚠️  Storage schema file not found, skipping..."
fi

# Apply storage schema migration to ensure all columns are present
echo "🔄 Applying storage schema migration..."
if [ -f "apps/studio/lib/project-initialization/sql/migrate-storage-schema.sql" ]; then
    execute_template_sql_file "apps/studio/lib/project-initialization/sql/migrate-storage-schema.sql" "Applying storage schema migration"
else
    echo "  ⚠️  Storage migration file not found, skipping..."
fi

# Initialize webhooks schema
echo "🪝 Initializing webhooks schema..."
if [ -f "apps/studio/lib/project-initialization/sql/webhooks-schema.sql" ]; then
    execute_template_sql_file "apps/studio/lib/project-initialization/sql/webhooks-schema.sql" "Installing webhooks schema"
else
    echo "  ⚠️  Webhooks schema file not found, skipping..."
fi

# Initialize analytics schema
echo "📊 Initializing analytics schema..."
if [ -f "apps/studio/lib/project-initialization/sql/analytics-schema.sql" ]; then
    execute_template_sql_file "apps/studio/lib/project-initialization/sql/analytics-schema.sql" "Installing analytics schema"
else
    echo "  ⚠️  Analytics schema file not found, skipping..."
fi

# Verify storage.buckets table structure
echo "🔍 Verifying storage.buckets table structure..."
if [ -n "$USE_CONTAINER" ] && docker ps | grep -q "$USE_CONTAINER" 2>/dev/null; then
    BUCKETS_COLUMNS=$(docker exec "$USE_CONTAINER" psql -U "$DB_USER" -d "$TEMPLATE_DB_NAME" -t -c "
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'storage'
AND table_name = 'buckets'
ORDER BY column_name;
" | tr -d ' ' | grep -v '^$')
else
    if [ -n "$DB_PASSWORD" ]; then
        export PGPASSWORD="$DB_PASSWORD"
    fi
    BUCKETS_COLUMNS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TEMPLATE_DB_NAME" -t -c "
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'storage'
AND table_name = 'buckets'
ORDER BY column_name;
" | tr -d ' ' | grep -v '^$')
fi

echo "  📋 Current storage.buckets columns:"
echo "$BUCKETS_COLUMNS" | sed 's/^/    - /'

# Check for required columns
REQUIRED_COLUMNS=("allowed_mime_types" "avif_autodetection" "created_at" "file_size_limit" "id" "name" "owner" "public" "updated_at")
MISSING_COLUMNS=()

for col in "${REQUIRED_COLUMNS[@]}"; do
    if ! echo "$BUCKETS_COLUMNS" | grep -q "^$col$"; then
        MISSING_COLUMNS+=("$col")
    fi
done

if [ ${#MISSING_COLUMNS[@]} -eq 0 ]; then
    echo "  ✅ All required columns are present in storage.buckets"
else
    echo "  ❌ Missing columns in storage.buckets: ${MISSING_COLUMNS[*]}"
    echo "  🔧 Attempting to add missing columns..."

    for col in "${MISSING_COLUMNS[@]}"; do
        case $col in
            "public")
                execute_template_sql "ALTER TABLE storage.buckets ADD COLUMN IF NOT EXISTS public BOOLEAN DEFAULT FALSE;" "Adding public column"
                ;;
            "avif_autodetection")
                execute_template_sql "ALTER TABLE storage.buckets ADD COLUMN IF NOT EXISTS avif_autodetection BOOLEAN DEFAULT FALSE;" "Adding avif_autodetection column"
                ;;
            "file_size_limit")
                execute_template_sql "ALTER TABLE storage.buckets ADD COLUMN IF NOT EXISTS file_size_limit BIGINT;" "Adding file_size_limit column"
                ;;
            "allowed_mime_types")
                execute_template_sql "ALTER TABLE storage.buckets ADD COLUMN IF NOT EXISTS allowed_mime_types TEXT[];" "Adding allowed_mime_types column"
                ;;
        esac
    done
fi

# Verify storage.objects table structure
echo "🔍 Verifying storage.objects table structure..."
if [ -n "$USE_CONTAINER" ] && docker ps | grep -q "$USE_CONTAINER" 2>/dev/null; then
    OBJECTS_COLUMNS=$(docker exec "$USE_CONTAINER" psql -U "$DB_USER" -d "$TEMPLATE_DB_NAME" -t -c "
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'storage'
AND table_name = 'objects'
ORDER BY column_name;
" | tr -d ' ' | grep -v '^$')
else
    if [ -n "$DB_PASSWORD" ]; then
        export PGPASSWORD="$DB_PASSWORD"
    fi
    OBJECTS_COLUMNS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TEMPLATE_DB_NAME" -t -c "
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'storage'
AND table_name = 'objects'
ORDER BY column_name;
" | tr -d ' ' | grep -v '^$')
fi

echo "  📋 Current storage.objects columns:"
echo "$OBJECTS_COLUMNS" | sed 's/^/    - /'

# Check for required columns in objects table
REQUIRED_OBJECTS_COLUMNS=("bucket_id" "created_at" "id" "last_accessed_at" "metadata" "name" "owner" "path_tokens" "updated_at" "version")
MISSING_OBJECTS_COLUMNS=()

for col in "${REQUIRED_OBJECTS_COLUMNS[@]}"; do
    if ! echo "$OBJECTS_COLUMNS" | grep -q "^$col$"; then
        MISSING_OBJECTS_COLUMNS+=("$col")
    fi
done

if [ ${#MISSING_OBJECTS_COLUMNS[@]} -eq 0 ]; then
    echo "  ✅ All required columns are present in storage.objects"
else
    echo "  ❌ Missing columns in storage.objects: ${MISSING_OBJECTS_COLUMNS[*]}"
    echo "  🔧 Attempting to add missing columns..."

    for col in "${MISSING_OBJECTS_COLUMNS[@]}"; do
        case $col in
            "path_tokens")
                execute_template_sql "ALTER TABLE storage.objects ADD COLUMN IF NOT EXISTS path_tokens TEXT[];" "Adding path_tokens column"
                ;;
            "version")
                execute_template_sql "ALTER TABLE storage.objects ADD COLUMN IF NOT EXISTS version TEXT;" "Adding version column"
                ;;
        esac
    done
fi

# Grant permissions
echo "🔐 Setting up permissions..."
execute_template_sql "GRANT USAGE ON SCHEMA auth TO postgres;" "Granting auth schema usage"
execute_template_sql "GRANT ALL ON ALL TABLES IN SCHEMA auth TO postgres;" "Granting auth tables permissions"
execute_template_sql "GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO postgres;" "Granting auth sequences permissions"

execute_template_sql "GRANT USAGE ON SCHEMA storage TO postgres;" "Granting storage schema usage"
execute_template_sql "GRANT ALL ON ALL TABLES IN SCHEMA storage TO postgres;" "Granting storage tables permissions"
execute_template_sql "GRANT ALL ON ALL SEQUENCES IN SCHEMA storage TO postgres;" "Granting storage sequences permissions"

# Final verification
echo "🔍 Final verification..."
if [ -n "$USE_CONTAINER" ] && docker ps | grep -q "$USE_CONTAINER" 2>/dev/null; then
    PUBLIC_COL_EXISTS=$(docker exec "$USE_CONTAINER" psql -U "$DB_USER" -d "$TEMPLATE_DB_NAME" -t -c "
SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'storage'
    AND table_name = 'buckets'
    AND column_name = 'public'
);
" | tr -d ' ')
else
    if [ -n "$DB_PASSWORD" ]; then
        export PGPASSWORD="$DB_PASSWORD"
    fi
    PUBLIC_COL_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TEMPLATE_DB_NAME" -t -c "
SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'storage'
    AND table_name = 'buckets'
    AND column_name = 'public'
);
" | tr -d ' ')
fi

if [ "$PUBLIC_COL_EXISTS" = "t" ]; then
    echo "✅ Template database initialization completed successfully!"
    echo "✅ storage.buckets table has the 'public' column"
    echo ""
    echo "📋 Template database summary:"
    echo "  - Database name: $TEMPLATE_DB_NAME"
    echo "  - Schemas: auth, storage, extensions"
    echo "  - All required columns present in storage tables"
    echo ""
    echo "🎉 New projects created from this template will have complete storage schemas!"
else
    echo "❌ Template database initialization failed!"
    echo "❌ storage.buckets table is missing the 'public' column"
    exit 1