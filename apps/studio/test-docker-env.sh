#!/bin/bash

# Test script to validate environment variable availability during Docker builds
# Requirements 1.1, 1.3: Test environment variable availability during Docker builds

set -e

echo "=== DOCKER ENVIRONMENT VARIABLE TEST ==="
echo "Test started at: $(date)"
echo ""

# Test function to check if environment variable is available
test_env_var() {
    local var_name="$1"
    local expected_value="$2"
    local actual_value="${!var_name}"
    
    if [ -n "$actual_value" ]; then
        echo "✅ $var_name: $actual_value"
        if [ -n "$expected_value" ] && [ "$actual_value" != "$expected_value" ]; then
            echo "   ⚠️  Expected: $expected_value, Got: $actual_value"
        fi
    else
        echo "❌ $var_name: NOT SET"
        return 1
    fi
}

echo "Testing core environment detection variables:"
test_env_var "ENVIRONMENT"
test_env_var "NODE_ENV"
test_env_var "NEXT_PUBLIC_IS_PLATFORM"
test_env_var "NEXT_PUBLIC_REQUIRE_LOGIN"

echo ""
echo "Testing build context detection:"
if [ -n "$DOCKER_BUILDKIT" ] || [ -n "$BUILDKIT_PROGRESS" ] || [ -n "$DOCKER_BUILD" ]; then
    echo "✅ Build-time context detected"
    echo "   DOCKER_BUILDKIT: ${DOCKER_BUILDKIT:-not set}"
    echo "   BUILDKIT_PROGRESS: ${BUILDKIT_PROGRESS:-not set}"
    echo "   DOCKER_BUILD: ${DOCKER_BUILD:-not set}"
else
    echo "ℹ️  Runtime context (not build-time)"
fi

echo ""
echo "Testing environment detection priority:"
if [ -n "$ENVIRONMENT" ]; then
    echo "✅ ENVIRONMENT variable set: $ENVIRONMENT (HIGHEST PRIORITY)"
    case "$ENVIRONMENT" in
        "production")
            echo "   → Production environment detected"
            ;;
        "development")
            echo "   → Development environment detected"
            ;;
        "staging")
            echo "   → Staging environment detected"
            ;;
        *)
            echo "   ⚠️  Invalid ENVIRONMENT value: $ENVIRONMENT"
            echo "   Valid values: production, development, staging"
            ;;
    esac
else
    echo "⚠️  ENVIRONMENT variable not set"
    echo "   Fallback to NODE_ENV: ${NODE_ENV:-not set}"
    if [ "$NODE_ENV" = "development" ]; then
        echo "   → Development environment (via NODE_ENV)"
    elif [ "$NODE_ENV" = "production" ]; then
        echo "   → Production environment (via NODE_ENV, requires URL validation)"
    else
        echo "   → Default to production (safety fallback)"
    fi
fi

echo ""
echo "Testing Docker build recommendations:"
if [ -z "$ENVIRONMENT" ]; then
    echo "💡 RECOMMENDATION: Set ENVIRONMENT variable for explicit control"
    echo "   Example: docker build --build-arg ENVIRONMENT=production ..."
fi

if [ -z "$NODE_ENV" ]; then
    echo "💡 RECOMMENDATION: Set NODE_ENV variable as fallback"
    echo "   Example: docker build --build-arg NODE_ENV=production ..."
fi

echo ""
echo "=== TEST COMPLETED ==="
echo "Test completed at: $(date)"

# Exit with error if critical variables are missing
if [ -z "$ENVIRONMENT" ] && [ -z "$NODE_ENV" ]; then
    echo ""
    echo "❌ CRITICAL: Both ENVIRONMENT and NODE_ENV are missing"
    echo "   This will cause environment detection to use default fallback"
    echo "   Add ARG declarations and build arguments to fix this"
    exit 1
fi

echo ""
echo "✅ Environment variable test passed"
exit 0