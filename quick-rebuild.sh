#!/bin/bash

# Quick Rebuild Script
# This script optimizes the rebuild process by only rebuilding when necessary

set -e

echo "🚀 Quick Rebuild - Optimized Docker Build Process"

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCKER_DIR="$SCRIPT_DIR/docker"

# Check if we need to rebuild by comparing file timestamps
STUDIO_DOCKERFILE_PATH="apps/studio/Dockerfile"
STUDIO_IMAGE_NAME="supabase-studio-custom:latest"
ENHANCED_REST_IMAGE_NAME="supabase-rest-enhanced:latest"

# Get the last modification time of key files
LAST_BUILD_FILE=".last-build-timestamp"
LAST_ENHANCED_BUILD_FILE=".last-enhanced-build-timestamp"
CURRENT_TIME=$(date +%s)

# Files that should trigger a Studio rebuild
STUDIO_KEY_FILES=(
    "apps/studio/pages/api/platform/projects/create.ts"
    "apps/studio/lib/project-initialization/ProjectInitializationService.ts"
    "apps/studio/lib/database-initialization/DatabaseInitializationService.ts"
    "apps/studio/lib/startup/startup-hooks.ts"
    "apps/studio/pages/_app.tsx"
    "apps/studio/pages/api/internal/startup-init.ts"
)

# Files that should trigger an Enhanced REST container rebuild
ENHANCED_REST_KEY_FILES=(
    "docker/enhanced-rest-container/Dockerfile"
    "docker/enhanced-rest-container/config/"
    "docker/enhanced-rest-container/scripts/"
    "apps/studio/lib/api/rpc-function-service.ts"
    "apps/studio/lib/api/transaction-service.ts"
    "apps/studio/lib/api/project-database-client.ts"
    "docker/docker-compose.yml"
)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] [INFO] $*${NC}"
}

log_success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] [SUCCESS] $*${NC}"
}

log_warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] [WARN] $*${NC}"
}

log_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] $*${NC}"
}

# Build enhanced REST container
build_enhanced_container() {
    log "Building enhanced PostgREST container..."
    
    cd "$DOCKER_DIR"
    
    # Build the enhanced container
    if docker build -t "$ENHANCED_REST_IMAGE_NAME" -f enhanced-rest-container/Dockerfile .; then
        log_success "Enhanced container built successfully"
        return 0
    else
        log_error "Failed to build enhanced container"
        return 1
    fi
}

# Check if enhanced REST container needs rebuild
check_enhanced_rest_rebuild() {
    local needs_rebuild=false
    
    if [ ! -f "$LAST_ENHANCED_BUILD_FILE" ]; then
        log "No previous enhanced REST build timestamp found - rebuild required"
        needs_rebuild=true
    else
        local last_build_time=$(cat "$LAST_ENHANCED_BUILD_FILE")
        log "Last enhanced REST build: $(date -d @$last_build_time 2>/dev/null || date -r $last_build_time 2>/dev/null || echo 'unknown')"
        
        for file in "${ENHANCED_REST_KEY_FILES[@]}"; do
            if [ -f "$file" ]; then
                local file_time=$(stat -c %Y "$file" 2>/dev/null || stat -f %m "$file" 2>/dev/null)
                if [ "$file_time" -gt "$last_build_time" ]; then
                    log "Enhanced REST file changed: $file"
                    needs_rebuild=true
                    break
                fi
            elif [ -d "$file" ]; then
                # Check directory modification time
                local dir_time=$(find "$file" -type f -exec stat -c %Y {} \; 2>/dev/null | sort -n | tail -1 || echo "0")
                if [ "$dir_time" -gt "$last_build_time" ]; then
                    log "Enhanced REST directory changed: $file"
                    needs_rebuild=true
                    break
                fi
            fi
        done
    fi
    
    echo "$needs_rebuild"
}

# Check if Studio container needs rebuild
check_studio_rebuild() {
    local needs_rebuild=false
    
    if [ ! -f "$LAST_BUILD_FILE" ]; then
        log "No previous Studio build timestamp found - rebuild required"
        needs_rebuild=true
    else
        local last_build_time=$(cat "$LAST_BUILD_FILE")
        log "Last Studio build: $(date -d @$last_build_time 2>/dev/null || date -r $last_build_time 2>/dev/null || echo 'unknown')"
        
        for file in "${STUDIO_KEY_FILES[@]}"; do
            if [ -f "$file" ]; then
                local file_time=$(stat -c %Y "$file" 2>/dev/null || stat -f %m "$file" 2>/dev/null)
                if [ "$file_time" -gt "$last_build_time" ]; then
                    log "Studio file changed: $file"
                    needs_rebuild=true
                    break
                fi
            fi
        done
    fi
    
    echo "$needs_rebuild"
}

# Parse command line arguments
FORCE_REBUILD=false
STUDIO_ONLY=false
ENHANCED_ONLY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --force|-f)
            FORCE_REBUILD=true
            shift
            ;;
        --studio-only)
            STUDIO_ONLY=true
            shift
            ;;
        --enhanced-only)
            ENHANCED_ONLY=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --force, -f         Force rebuild of all containers"
            echo "  --studio-only       Only rebuild Studio container"
            echo "  --enhanced-only     Only rebuild Enhanced REST container"
            echo "  --help, -h          Show this help message"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Check what needs to be rebuilt
NEEDS_STUDIO_REBUILD=$(check_studio_rebuild)
NEEDS_ENHANCED_REBUILD=$(check_enhanced_rest_rebuild)

# Apply force rebuild option
if [ "$FORCE_REBUILD" = true ]; then
    log "Force rebuild requested"
    NEEDS_STUDIO_REBUILD=true
    NEEDS_ENHANCED_REBUILD=true
fi

# Apply container-specific options
if [ "$STUDIO_ONLY" = true ]; then
    NEEDS_ENHANCED_REBUILD=false
elif [ "$ENHANCED_ONLY" = true ]; then
    NEEDS_STUDIO_REBUILD=false
fi

# Check if anything needs to be rebuilt
if [ "$NEEDS_STUDIO_REBUILD" = false ] && [ "$NEEDS_ENHANCED_REBUILD" = false ]; then
    log_success "No changes detected - skipping rebuild"
    echo "💡 Use --force to rebuild anyway"
    exit 0
fi

# Use BuildKit for faster builds
export DOCKER_BUILDKIT=1

# Build Enhanced REST container if needed
if [ "$NEEDS_ENHANCED_REBUILD" = true ]; then
    log "Building Enhanced REST container..."
    if build_enhanced_container; then
        echo "$CURRENT_TIME" > "$LAST_ENHANCED_BUILD_FILE"
        log_success "Enhanced REST container build completed!"
    else
        log_error "Enhanced REST container build failed!"
        exit 1
    fi
else
    log "Enhanced REST container is up to date"
fi

# Build Studio container if needed
if [ "$NEEDS_STUDIO_REBUILD" = true ]; then
    log "Building Studio container..."
    
    # Change back to project root for Studio build
    cd "$SCRIPT_DIR"
    
    # Build with cache optimization
    if docker build \
        --target production \
        --tag "$STUDIO_IMAGE_NAME" \
        --file "$STUDIO_DOCKERFILE_PATH" \
        --build-arg BUILDKIT_INLINE_CACHE=1 \
        .; then
        echo "$CURRENT_TIME" > "$LAST_BUILD_FILE"
        log_success "Studio container build completed!"
    else
        log_error "Studio container build failed!"
        exit 1
    fi
else
    log "Studio container is up to date"
fi

log_success "Quick rebuild process completed successfully!"

# Display summary
echo ""
log_success "=== BUILD SUMMARY ==="
if [ "$NEEDS_STUDIO_REBUILD" = true ]; then
    log_success "✅ Studio container: $STUDIO_IMAGE_NAME"
else
    log "⏭️  Studio container: up to date"
fi

if [ "$NEEDS_ENHANCED_REBUILD" = true ]; then
    log_success "✅ Enhanced REST container: $ENHANCED_REST_IMAGE_NAME"
else
    log "⏭️  Enhanced REST container: up to date"
fi
echo ""