#!/bin/bash

# Quick Rebuild Script
# This script optimizes the rebuild process by only rebuilding when necessary

set -e

echo "🚀 Quick Rebuild - Optimized Docker Build Process"

# Check if we need to rebuild by comparing file timestamps
DOCKERFILE_PATH="apps/studio/Dockerfile"
IMAGE_NAME="supabase-studio-custom:latest"

# Get the last modification time of key files
LAST_BUILD_FILE=".last-build-timestamp"
CURRENT_TIME=$(date +%s)

# Files that should trigger a rebuild
KEY_FILES=(
    "apps/studio/pages/api/platform/projects/create.ts"
    "apps/studio/lib/project-initialization/ProjectInitializationService.ts"
    "apps/studio/lib/database-initialization/DatabaseInitializationService.ts"
    "apps/studio/lib/startup/startup-hooks.ts"
    "apps/studio/pages/_app.tsx"
    "apps/studio/pages/api/internal/startup-init.ts"
)

# Check if any key files have been modified since last build
NEEDS_REBUILD=false

if [ ! -f "$LAST_BUILD_FILE" ]; then
    echo "📝 No previous build timestamp found - full rebuild required"
    NEEDS_REBUILD=true
else
    LAST_BUILD_TIME=$(cat "$LAST_BUILD_FILE")
    echo "📅 Last build: $(date -d @$LAST_BUILD_TIME)"
    
    for file in "${KEY_FILES[@]}"; do
        if [ -f "$file" ]; then
            FILE_TIME=$(stat -c %Y "$file" 2>/dev/null || stat -f %m "$file" 2>/dev/null)
            if [ "$FILE_TIME" -gt "$LAST_BUILD_TIME" ]; then
                echo "🔄 File changed: $file"
                NEEDS_REBUILD=true
                break
            fi
        fi
    done
fi

# Force rebuild option
if [ "$1" = "--force" ] || [ "$1" = "-f" ]; then
    echo "🔨 Force rebuild requested"
    NEEDS_REBUILD=true
fi

if [ "$NEEDS_REBUILD" = false ]; then
    echo "✅ No changes detected - skipping rebuild"
    echo "💡 Use --force to rebuild anyway"
    exit 0
fi

echo "🔨 Building Docker image..."

# Use BuildKit for faster builds
export DOCKER_BUILDKIT=1

# Build with cache optimization
docker build \
    --target production \
    --tag "$IMAGE_NAME" \
    --file "$DOCKERFILE_PATH" \
    --build-arg BUILDKIT_INLINE_CACHE=1 \
    .

if [ $? -eq 0 ]; then
    echo "$CURRENT_TIME" > "$LAST_BUILD_FILE"
    echo "✅ Build completed successfully!"
    echo "📦 Image: $IMAGE_NAME"
else
    echo "❌ Build failed!"
    exit 1
fi