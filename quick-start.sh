#!/bin/bash

# Quick Start Script
# Intelligently rebuilds and starts the Supabase Studio environment

set -e

echo "🚀 Quick Start - Supabase Studio"

# Function to check if image exists
image_exists() {
    docker image inspect supabase-studio-custom:latest >/dev/null 2>&1
}

# Function to check if containers are running
containers_running() {
    docker compose -f docker/docker-compose.yml ps --services --filter "status=running" | grep -q "studio"
}

# Parse command line arguments
FORCE_REBUILD=false
SKIP_REBUILD=false
ENABLE_DB=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --force-rebuild|-f)
            FORCE_REBUILD=true
            shift
            ;;
        --skip-rebuild|-s)
            SKIP_REBUILD=true
            shift
            ;;
        --with-db)
            ENABLE_DB=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --force-rebuild, -f    Force rebuild Docker image"
            echo "  --skip-rebuild, -s     Skip rebuild and use existing image"
            echo "  --with-db              Enable built-in PostgreSQL database"
            echo "  --help, -h             Show this help message"
            echo ""
            echo "Database Configuration:"
            echo "  By default, the built-in PostgreSQL database is disabled."
            echo "  Use --with-db to enable it, or set ENABLE_SUPABASE_DB=true in docker/.env"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Step 1: Check if we need to rebuild
if [ "$SKIP_REBUILD" = false ]; then
    if [ "$FORCE_REBUILD" = true ]; then
        echo "🔨 Force rebuilding Docker image..."
        ./quick-rebuild.sh --force
    elif ! image_exists; then
        echo "📦 Docker image not found - building..."
        ./quick-rebuild.sh --force
    else
        echo "🔍 Checking if rebuild is needed..."
        ./quick-rebuild.sh
    fi
else
    echo "⏭️  Skipping rebuild as requested"
    if ! image_exists; then
        echo "❌ Error: Docker image does not exist and --skip-rebuild was specified"
        echo "💡 Run without --skip-rebuild or build the image first"
        exit 1
    fi
fi

# Step 2: Determine which services to start
COMPOSE_PROFILES=""
USE_BUILTIN_DB=false

# Check if database should be enabled
if [ "$ENABLE_DB" = true ]; then
    echo "🗄️  Built-in PostgreSQL database will be enabled"
    COMPOSE_PROFILES="--profile db"
    USE_BUILTIN_DB=true
else
    # Check .env file for database setting
    if [ -f "docker/.env" ] && grep -q "ENABLE_SUPABASE_DB=true" docker/.env; then
        echo "🗄️  Built-in PostgreSQL database enabled via .env file"
        COMPOSE_PROFILES="--profile db"
        USE_BUILTIN_DB=true
    else
        echo "🔗 Using external database (built-in PostgreSQL disabled)"
        echo "💡 Use --with-db flag or set ENABLE_SUPABASE_DB=true in docker/.env to enable built-in database"
    fi
fi

# Step 3: Start the services
echo "🐳 Starting Docker Compose services..."

# Stop any running containers first
if containers_running; then
    echo "🛑 Stopping existing containers..."
    docker compose -f docker/docker-compose.yml down
fi

# Start services with appropriate configuration
echo "▶️  Starting services..."
if [ "$USE_BUILTIN_DB" = true ]; then
    docker compose -f docker/docker-compose.yml $COMPOSE_PROFILES up -d
else
    docker compose -f docker/docker-compose.yml up -d
fi

# Step 4: Wait for services to be healthy
echo "⏳ Waiting for services to be ready..."

# Wait for database to be healthy (only if using built-in database)
if [ "$USE_BUILTIN_DB" = true ]; then
    echo "  📊 Waiting for database..."
    timeout=60
    counter=0
    while [ $counter -lt $timeout ]; do
        if docker compose -f docker/docker-compose.yml $COMPOSE_PROFILES ps db | grep -q "healthy"; then
            echo "  ✅ Database is ready"
            break
        fi
        sleep 2
        counter=$((counter + 2))
        if [ $counter -ge $timeout ]; then
            echo "  ❌ Database health check timeout"
            exit 1
        fi
    done
else
    echo "  ⏭️  Skipping database health check (external database mode)"
fi

# Wait for Studio to be healthy
echo "  🎨 Waiting for Studio..."
timeout=120
counter=0
while [ $counter -lt $timeout ]; do
    if docker compose -f docker/docker-compose.yml ps studio | grep -q "healthy"; then
        echo "  ✅ Studio is ready"
        break
    fi
    sleep 3
    counter=$((counter + 3))
    if [ $counter -ge $timeout ]; then
        echo "  ❌ Studio health check timeout"
        echo "  📋 Checking Studio logs..."
        docker logs supabase-studio --tail=20
        exit 1
    fi
done

# Step 5: Show status
echo ""
echo "🎉 Supabase Studio is ready!"
echo "🌐 Studio URL: http://localhost:3000"
echo "📊 Analytics: http://localhost:4000"
echo "🔧 Kong Gateway: http://localhost:8000"
if [ "$USE_BUILTIN_DB" = true ]; then
    echo "🗄️  Built-in Database: http://localhost:5432"
else
    echo "🔗 Using external database"
fi
echo ""
echo "📋 Service Status:"
if [ "$USE_BUILTIN_DB" = true ]; then
    docker compose -f docker/docker-compose.yml $COMPOSE_PROFILES ps
else
    docker compose -f docker/docker-compose.yml ps
fi

echo ""
echo "💡 Useful commands:"
echo "  View logs:     docker logs supabase-studio --follow"
if [ "$USE_BUILTIN_DB" = true ]; then
    echo "  Stop services: docker compose -f docker/docker-compose.yml --profile db down"
else
    echo "  Stop services: docker compose -f docker/docker-compose.yml down"
fi
echo "  Restart:       ./quick-start.sh"
if [ "$USE_BUILTIN_DB" = false ]; then
    echo "  Enable DB:     ./quick-start.sh --with-db"
fi
echo "  Toggle DB:     docker/toggle-database.sh [enable|disable|status]"