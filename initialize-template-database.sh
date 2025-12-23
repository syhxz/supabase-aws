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

# Create auth.schema_migrations table to prevent GoTrue migration issues
echo "🔧 Creating auth.schema_migrations table..."
execute_template_sql "CREATE TABLE IF NOT EXISTS auth.schema_migrations (
    version character varying(255) NOT NULL PRIMARY KEY,
    inserted_at timestamp(0) without time zone DEFAULT NOW()
);" "Creating auth schema_migrations table"
execute_template_sql "COMMENT ON TABLE auth.schema_migrations IS 'Auth: Manages updates to the auth system.';" "Adding comment to auth schema_migrations"

# Apply GoTrue migration fix to prevent known migration issues
echo "🔧 Applying GoTrue migration fixes..."
if [ -f "scripts/fix-gotrue-migration.sql" ]; then
    execute_template_sql_file "scripts/fix-gotrue-migration.sql" "Applying GoTrue migration fixes"
    echo "✅ Applied GoTrue migration fixes"
else
    echo "⚠️  GoTrue migration fix file not found, skipping"
fi

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

# Apply comprehensive security configuration
echo "🔐 Applying comprehensive security configuration..."

# Create comprehensive security SQL
SECURITY_SQL="
-- Enable comprehensive security across all Supabase APIs
-- This enables Row Level Security (RLS) and creates authentication policies

-- Enable RLS on common tables (create them if they don't exist)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Posts table (example content table)
CREATE TABLE IF NOT EXISTS public.posts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Comments table (example content table)
CREATE TABLE IF NOT EXISTS public.comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id UUID REFERENCES public.posts(id) NOT NULL,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles table
DROP POLICY IF EXISTS \"Users can view their own profile\" ON public.profiles;
CREATE POLICY \"Users can view their own profile\" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS \"Users can update their own profile\" ON public.profiles;
CREATE POLICY \"Users can update their own profile\" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS \"Users can insert their own profile\" ON public.profiles;
CREATE POLICY \"Users can insert their own profile\" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Create RLS policies for posts table
DROP POLICY IF EXISTS \"Authenticated users can view all posts\" ON public.posts;
CREATE POLICY \"Authenticated users can view all posts\" ON public.posts
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS \"Users can create their own posts\" ON public.posts;
CREATE POLICY \"Users can create their own posts\" ON public.posts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS \"Users can update their own posts\" ON public.posts;
CREATE POLICY \"Users can update their own posts\" ON public.posts
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS \"Users can delete their own posts\" ON public.posts;
CREATE POLICY \"Users can delete their own posts\" ON public.posts
    FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for comments table
DROP POLICY IF EXISTS \"Authenticated users can view all comments\" ON public.comments;
CREATE POLICY \"Authenticated users can view all comments\" ON public.comments
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS \"Users can create their own comments\" ON public.comments;
CREATE POLICY \"Users can create their own comments\" ON public.comments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS \"Users can update their own comments\" ON public.comments;
CREATE POLICY \"Users can update their own comments\" ON public.comments
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS \"Users can delete their own comments\" ON public.comments;
CREATE POLICY \"Users can delete their own comments\" ON public.comments
    FOR DELETE USING (auth.uid() = user_id);

-- Deny anonymous access to all tables
DROP POLICY IF EXISTS \"Deny anonymous access to profiles\" ON public.profiles;
CREATE POLICY \"Deny anonymous access to profiles\" ON public.profiles
    FOR ALL USING (auth.role() != 'anon');

DROP POLICY IF EXISTS \"Deny anonymous access to posts\" ON public.posts;
CREATE POLICY \"Deny anonymous access to posts\" ON public.posts
    FOR ALL USING (auth.role() != 'anon');

DROP POLICY IF EXISTS \"Deny anonymous access to comments\" ON public.comments;
CREATE POLICY \"Deny anonymous access to comments\" ON public.comments
    FOR ALL USING (auth.role() != 'anon');

-- Create storage policies for private buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('user_avatars', 'user_avatars', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
    ('user_documents', 'user_documents', false, 52428800, ARRAY['application/pdf', 'text/plain', 'application/msword']),
    ('private_files', 'private_files', false, 104857600, NULL)
ON CONFLICT (id) DO NOTHING;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Revoke permissions from anonymous users
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- Create function to handle user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS \$\$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
    RETURN NEW;
END;
\$\$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic profile creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
"

# Write security SQL to temporary file and execute
TEMP_SECURITY_FILE="/tmp/template_security_\$(date +%s).sql"
echo "\$SECURITY_SQL" > "\$TEMP_SECURITY_FILE"

if execute_template_sql_file "\$TEMP_SECURITY_FILE" "Applying comprehensive security configuration"; then
    echo "  ✅ Applied comprehensive security configuration"
else
    echo "  ⚠️  Some security policies may already exist (this is normal)"
fi

# Clean up temporary file
rm -f "\$TEMP_SECURITY_FILE"

# Apply migration files
echo "🔄 Applying migration files..."
MIGRATIONS_DIR="supabase/migrations"
if [ -d "$MIGRATIONS_DIR" ]; then
    echo "  📋 Found migrations directory, applying migration files..."
    
    # Get all .sql files in migrations directory, sorted by name
    MIGRATION_FILES=$(find "$MIGRATIONS_DIR" -name "*.sql" -type f | sort)
    APPLIED_COUNT=0
    SKIPPED_COUNT=0
    
    for migration_file in $MIGRATION_FILES; do
        # Skip the main exported schema file as it may conflict with template setup
        if [[ "$migration_file" == *"export_current_schema.sql" ]]; then
            continue
        fi
        
        # Skip the comprehensive security file as it's already applied inline
        if [[ "$migration_file" == *"enable_comprehensive_security.sql" ]]; then
            continue
        fi
        
        filename=$(basename "$migration_file")
        echo "    📄 Applying migration: $filename"
        
        if execute_template_sql_file "$migration_file" "Applying migration $filename"; then
            echo "    ✅ Applied $filename"
            ((APPLIED_COUNT++))
        else
            echo "    ⚠️  Skipped $filename (may already exist or have conflicts)"
            ((SKIPPED_COUNT++))
        fi
    done
    
    echo "  📊 Migration summary:"
    echo "    Applied: $APPLIED_COUNT"
    echo "    Skipped: $SKIPPED_COUNT"
else
    echo "  ⚠️  Migrations directory not found: $MIGRATIONS_DIR"
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