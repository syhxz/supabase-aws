# Environment Detection Troubleshooting Guide

This guide helps you diagnose and fix environment detection issues in production deployments, Docker builds, and development setups.

## Quick Diagnosis

### Run the Environment Detection Debugger

```bash
# Quick debugging
pnpm debug:env

# Verbose debugging with detailed logs
pnpm debug:env --verbose

# Test specific scenarios
pnpm debug:env --simulate-production
pnpm debug:env --simulate-docker
pnpm debug:env --test-urls "http://localhost:54321,https://api.example.com"
```

### Check Current Environment Detection

```bash
# Show current environment detection
pnpm config:check:verbose

# Run comprehensive diagnostics
pnpm config:diagnose:verbose
```

## Common Issues and Solutions

### 1. Production Shows "DEVELOPMENT environment detected"

**Symptoms:**
- Docker build logs show "DEVELOPMENT environment detected"
- Production deployment uses localhost URLs
- Environment detection defaults to development

**Root Causes:**
- `ENVIRONMENT` variable not available during Docker build
- `NODE_ENV=production` overridden by localhost URL patterns
- Missing ARG declarations in Dockerfile

**Solutions:**

#### Fix 1: Set Explicit ENVIRONMENT Variable
```bash
# In your environment or .env file
ENVIRONMENT=production

# For Docker builds, ensure it's passed as build arg
docker build --build-arg ENVIRONMENT=production .
```

#### Fix 2: Update Dockerfile for Build-Time Variables
```dockerfile
# Add ARG declarations for build-time access
ARG ENVIRONMENT
ARG NODE_ENV

# Make them available at runtime
ENV ENVIRONMENT=${ENVIRONMENT}
ENV NODE_ENV=${NODE_ENV}

# Verify during build
RUN echo "Build environment: $ENVIRONMENT"
```

#### Fix 3: Fix docker-compose Configuration
```yaml
# docker-compose.yml
services:
  studio:
    build:
      context: .
      args:
        ENVIRONMENT: production
        NODE_ENV: production
    environment:
      ENVIRONMENT: production
      NODE_ENV: production
```

### 2. Production Environment with Localhost URLs

**Symptoms:**
- Environment detected as production
- Critical errors about localhost URLs
- API requests fail in production

**Root Causes:**
- Environment variables contain localhost URLs
- Missing production URL configuration
- Development URLs copied to production

**Solutions:**

#### Fix 1: Set Production URLs
```bash
# Required production environment variables
ENVIRONMENT=production
SUPABASE_PUBLIC_URL=https://your-project.supabase.co
API_EXTERNAL_URL=https://api.your-domain.com
NEXT_PUBLIC_GOTRUE_URL=https://your-project.supabase.co/auth/v1
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
```

#### Fix 2: Validate URL Configuration
```bash
# Check current URLs
pnpm config:check:urls

# Validate environment variables
pnpm config:validate-env:verbose

# Test URL validation
pnpm debug:env --test-urls "https://your-project.supabase.co,https://api.your-domain.com"
```

### 3. Docker Build Environment Variables Not Available

**Symptoms:**
- Build logs show "Environment variables not available during build"
- Missing critical environment variables warnings
- Inconsistent build-time vs runtime detection

**Root Causes:**
- ARG declarations missing from Dockerfile
- Environment variables not passed during build
- Build context doesn't include environment files

**Solutions:**

#### Fix 1: Complete Dockerfile Configuration
```dockerfile
# Dockerfile
FROM node:18-alpine

# Declare all build-time variables
ARG ENVIRONMENT
ARG NODE_ENV
ARG SUPABASE_PUBLIC_URL
ARG API_EXTERNAL_URL
ARG NEXT_PUBLIC_GOTRUE_URL

# Make them available at runtime
ENV ENVIRONMENT=${ENVIRONMENT}
ENV NODE_ENV=${NODE_ENV}
ENV SUPABASE_PUBLIC_URL=${SUPABASE_PUBLIC_URL}
ENV API_EXTERNAL_URL=${API_EXTERNAL_URL}
ENV NEXT_PUBLIC_GOTRUE_URL=${NEXT_PUBLIC_GOTRUE_URL}

# Validate critical variables during build
RUN if [ -z "$ENVIRONMENT" ]; then echo "ERROR: ENVIRONMENT not set"; exit 1; fi
RUN echo "Building for environment: $ENVIRONMENT"

# Continue with build...
COPY . .
RUN npm run build
```

#### Fix 2: Build Command with All Variables
```bash
# Build with all required variables
docker build \
  --build-arg ENVIRONMENT=production \
  --build-arg NODE_ENV=production \
  --build-arg SUPABASE_PUBLIC_URL=https://your-project.supabase.co \
  --build-arg API_EXTERNAL_URL=https://api.your-domain.com \
  --build-arg NEXT_PUBLIC_GOTRUE_URL=https://your-project.supabase.co/auth/v1 \
  -t your-app .
```

### 4. Staging Environment Not Detected

**Symptoms:**
- Staging URLs detected as production or development
- Staging-specific configuration not applied
- Environment detection shows wrong method

**Root Causes:**
- Missing staging URL patterns
- `ENVIRONMENT` variable not set to staging
- Staging URLs don't contain staging indicators

**Solutions:**

#### Fix 1: Set Explicit Staging Environment
```bash
# Explicitly set staging environment
ENVIRONMENT=staging

# Use staging-specific URLs
SUPABASE_PUBLIC_URL=https://staging.your-domain.com
API_EXTERNAL_URL=https://staging-api.your-domain.com
NEXT_PUBLIC_GOTRUE_URL=https://staging.your-domain.com/auth/v1
```

#### Fix 2: Use Staging URL Patterns
Ensure staging URLs contain staging indicators:
- `staging.your-domain.com`
- `your-domain-staging.com`
- `api-staging.your-domain.com`
- `stg.your-domain.com`

### 5. Development Environment Issues

**Symptoms:**
- Development environment not detected with localhost
- Docker services not accessible
- Mixed localhost and remote URLs

**Root Causes:**
- Docker networking configuration
- Service discovery issues
- Port mapping problems

**Solutions:**

#### Fix 1: Verify Docker Services
```bash
# Check if services are running
docker ps

# Check docker-compose services
docker-compose ps

# Restart services if needed
docker-compose down && docker-compose up -d
```

#### Fix 2: Configure Development URLs
```bash
# Development environment variables
ENVIRONMENT=development
SUPABASE_PUBLIC_URL=http://localhost:54321
API_EXTERNAL_URL=http://localhost:8000
NEXT_PUBLIC_GOTRUE_URL=http://localhost:54321/auth/v1
```

#### Fix 3: Container Networking
```yaml
# docker-compose.yml - ensure proper networking
services:
  studio:
    ports:
      - "8082:8082"
    environment:
      SUPABASE_PUBLIC_URL: http://localhost:54321
      API_EXTERNAL_URL: http://localhost:8000
    depends_on:
      - kong
      - gotrue
```

## Debugging Workflow

### Step 1: Identify the Issue
```bash
# Run environment detection debugger
pnpm debug:env --verbose

# Check what environment is detected
pnpm config:check:verbose
```

### Step 2: Analyze Environment Variables
```bash
# Validate environment variables
pnpm config:validate-env:verbose

# Check for missing variables
pnpm debug:env | grep "Missing Variables"
```

### Step 3: Test URL Scenarios
```bash
# Test with your actual URLs
pnpm debug:env --test-urls "your-supabase-url,your-api-url,your-gotrue-url"

# Simulate production environment
pnpm debug:env --simulate-production
```

### Step 4: Verify Configuration
```bash
# Run comprehensive diagnostics
pnpm config:diagnose:verbose

# Test health checks
pnpm config:health:verbose
```

### Step 5: Apply Fixes and Verify
```bash
# After making changes, verify the fix
pnpm debug:env --verbose

# Run full diagnostics to confirm
pnpm config:diagnose
```

## Environment-Specific Configurations

### Production Configuration Template

```bash
# .env.production
ENVIRONMENT=production
NODE_ENV=production

# Supabase Configuration
SUPABASE_PUBLIC_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# API Configuration
API_EXTERNAL_URL=https://api.your-domain.com
NEXT_PUBLIC_GOTRUE_URL=https://your-project.supabase.co/auth/v1

# Platform Configuration (if applicable)
NEXT_PUBLIC_IS_PLATFORM=true
```

### Development Configuration Template

```bash
# .env.development
ENVIRONMENT=development
NODE_ENV=development

# Local Supabase Configuration
SUPABASE_PUBLIC_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-local-anon-key

# Local API Configuration
API_EXTERNAL_URL=http://localhost:8000
NEXT_PUBLIC_GOTRUE_URL=http://localhost:54321/auth/v1

# Development flags
NEXT_PUBLIC_IS_PLATFORM=false
```

### Staging Configuration Template

```bash
# .env.staging
ENVIRONMENT=staging
NODE_ENV=production

# Staging Supabase Configuration
SUPABASE_PUBLIC_URL=https://staging.your-domain.com
NEXT_PUBLIC_SUPABASE_URL=https://staging.your-domain.com
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-staging-anon-key

# Staging API Configuration
API_EXTERNAL_URL=https://staging-api.your-domain.com
NEXT_PUBLIC_GOTRUE_URL=https://staging.your-domain.com/auth/v1

# Staging flags
NEXT_PUBLIC_IS_PLATFORM=true
```

## Docker-Specific Troubleshooting

### Build-Time Environment Detection

```dockerfile
# Dockerfile with comprehensive environment detection support
FROM node:18-alpine AS base

# Build-time arguments
ARG ENVIRONMENT=production
ARG NODE_ENV=production
ARG SUPABASE_PUBLIC_URL
ARG API_EXTERNAL_URL
ARG NEXT_PUBLIC_GOTRUE_URL

# Runtime environment variables
ENV ENVIRONMENT=${ENVIRONMENT}
ENV NODE_ENV=${NODE_ENV}
ENV SUPABASE_PUBLIC_URL=${SUPABASE_PUBLIC_URL}
ENV API_EXTERNAL_URL=${API_EXTERNAL_URL}
ENV NEXT_PUBLIC_GOTRUE_URL=${NEXT_PUBLIC_GOTRUE_URL}

# Validate environment during build
RUN echo "=== Build Environment Validation ==="
RUN echo "ENVIRONMENT: $ENVIRONMENT"
RUN echo "NODE_ENV: $NODE_ENV"
RUN echo "SUPABASE_PUBLIC_URL: $SUPABASE_PUBLIC_URL"
RUN echo "API_EXTERNAL_URL: $API_EXTERNAL_URL"

# Fail build if critical variables are missing
RUN if [ -z "$ENVIRONMENT" ]; then echo "ERROR: ENVIRONMENT not set"; exit 1; fi
RUN if [ -z "$SUPABASE_PUBLIC_URL" ]; then echo "ERROR: SUPABASE_PUBLIC_URL not set"; exit 1; fi

# Continue with build
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

# Verify environment detection after build
RUN npm run debug:env || echo "Environment detection check completed"

EXPOSE 3000
CMD ["npm", "start"]
```

### Docker Compose Configuration

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  studio:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        ENVIRONMENT: production
        NODE_ENV: production
        SUPABASE_PUBLIC_URL: ${SUPABASE_PUBLIC_URL}
        API_EXTERNAL_URL: ${API_EXTERNAL_URL}
        NEXT_PUBLIC_GOTRUE_URL: ${NEXT_PUBLIC_GOTRUE_URL}
    environment:
      ENVIRONMENT: production
      NODE_ENV: production
      SUPABASE_PUBLIC_URL: ${SUPABASE_PUBLIC_URL}
      API_EXTERNAL_URL: ${API_EXTERNAL_URL}
      NEXT_PUBLIC_GOTRUE_URL: ${NEXT_PUBLIC_GOTRUE_URL}
    ports:
      - "3000:3000"
    healthcheck:
      test: ["CMD", "npm", "run", "config:health:quick"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

## Logging and Monitoring

### Enable Detailed Environment Detection Logging

```bash
# Set environment variable for detailed logging
DEBUG_ENVIRONMENT_DETECTION=true

# Run with verbose logging
pnpm debug:env --verbose

# Monitor logs during startup
tail -f logs/environment-detection.log
```

### Production Deployment Verification

```bash
# Pre-deployment checks
pnpm config:validate-env:strict
pnpm config:verify:verbose
pnpm debug:env --simulate-production

# Post-deployment verification
curl -f http://your-domain.com/api/health
pnpm config:health:verbose
```

### Continuous Monitoring

```bash
# Add to your monitoring scripts
#!/bin/bash
# monitor-environment.sh

echo "Checking environment detection..."
pnpm debug:env --no-recommendations > /tmp/env-check.log 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Environment detection healthy"
else
    echo "❌ Environment detection issues detected"
    cat /tmp/env-check.log
    # Send alert to monitoring system
fi
```

## Getting Help

### Diagnostic Commands Reference

| Command | Purpose |
|---------|---------|
| `pnpm debug:env` | Quick environment detection debugging |
| `pnpm debug:env --verbose` | Detailed debugging with full logs |
| `pnpm debug:env --simulate-production` | Test production environment simulation |
| `pnpm config:diagnose:verbose` | Comprehensive system diagnostics |
| `pnpm config:check:verbose` | Show current configuration |
| `pnpm config:validate-env:verbose` | Validate environment variables |

### Log Analysis

Look for these key indicators in logs:

**Successful Detection:**
```
[Environment Detection] ✅ PRODUCTION environment detected via ENVIRONMENT variable
[Environment Detection] 🎯 ENVIRONMENT=production takes priority over NODE_ENV
```

**Build-Time Issues:**
```
[Environment Detection] ⚠️ Docker build missing critical environment variables
[Environment Detection] 💡 Add ARG declarations in Dockerfile
```

**URL Validation Errors:**
```
[Environment Detection] ❌ Production environment using localhost URLs!
[Environment Detection] 💡 Set SUPABASE_PUBLIC_URL=https://your-project.supabase.co
```

### Related Documentation

- [Environment Detection Overview](./ENVIRONMENT-DETECTION.md)
- [Configuration Examples](./CONFIGURATION-EXAMPLES.md)
- [Docker Deployment Checklist](./DOCKER-DEPLOYMENT-CHECKLIST.md)
- [Runtime Configuration Troubleshooting](./RUNTIME-CONFIG-TROUBLESHOOTING.md)

### Support Escalation

If issues persist after following this guide:

1. Run comprehensive diagnostics: `pnpm config:diagnose:verbose > diagnostics.log`
2. Collect environment detection debug output: `pnpm debug:env --verbose > env-debug.log`
3. Include both logs when reporting the issue
4. Specify your deployment method (Docker, Vercel, etc.)
5. Include your environment variable configuration (with sensitive values masked)