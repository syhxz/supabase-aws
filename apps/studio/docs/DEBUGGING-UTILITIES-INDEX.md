# Debugging Utilities Index

This document provides a comprehensive index of all debugging utilities and tools available for diagnosing environment detection and configuration issues.

## Quick Start

### Most Common Debugging Commands

```bash
# Quick environment detection debugging
pnpm debug:env

# Comprehensive system diagnostics
pnpm config:diagnose:verbose

# Check current configuration
pnpm config:check:verbose

# Validate environment variables
pnpm config:validate-env:verbose
```

## Environment Detection Debugging

### Primary Debugging Tool

**Command:** `pnpm debug:env`  
**Purpose:** Comprehensive environment detection debugging  
**Location:** `apps/studio/scripts/debug-environment-detection.ts`

#### Usage Options

```bash
# Basic debugging
pnpm debug:env

# Verbose output with detailed logs
pnpm debug:env:verbose

# Simulate production environment
pnpm debug:env:production

# Simulate Docker build environment
pnpm debug:env:docker

# Test specific URLs
pnpm debug:env --test-urls "http://localhost:54321,https://api.example.com"

# Skip recommendations (for automated scripts)
pnpm debug:env --no-recommendations
```

#### What It Analyzes

- ✅ Current environment variable configuration
- ✅ Environment detection priority chain
- ✅ Build-time vs runtime detection context
- ✅ URL validation for detected environment
- ✅ Container and network environment detection
- ✅ Missing variables and recommendations
- ✅ Configuration errors and guidance

### Environment Detection Output Examples

#### Successful Detection
```
🔍 ENVIRONMENT DETECTION DEBUGGING UTILITY
═══════════════════════════════════════════════════════════
Environment Detected: PRODUCTION
Detection Method: explicit-env
Detection Phase: RUNTIME
Container Context: NO
Server-Side: YES

Priority Chain (what was checked):
  1. ENVIRONMENT variable: 🎯 SELECTED
     → Explicit ENVIRONMENT="production" takes HIGHEST priority
  2. NODE_ENV variable: ⏭️  AVAILABLE
  3. URL pattern analysis: ⏭️  AVAILABLE
```

#### Issues Detected
```
🚨 2 issue(s) detected:

1. PRODUCTION_LOCALHOST_MISMATCH: Production environment using localhost URLs
   Severity: critical
   Recommendations:
     • Set SUPABASE_PUBLIC_URL=https://your-project.supabase.co
     • Set API_EXTERNAL_URL=https://api.your-domain.com
     • Remove localhost URLs from production environment variables

2. MISSING_ENVIRONMENT_VARIABLES: Critical environment variables not set
   Severity: error
   Recommendations:
     • Set ENVIRONMENT=production for explicit control
     • Set NEXT_PUBLIC_GOTRUE_URL for authentication configuration
```

## Configuration Diagnostics

### Comprehensive Diagnostics

**Command:** `pnpm config:diagnose`  
**Purpose:** Run all diagnostic checks in sequence  
**Location:** `apps/studio/scripts/diagnose-all.ts`

```bash
# Run all diagnostics
pnpm config:diagnose

# Verbose output
pnpm config:diagnose:verbose

# Continue even if checks fail
pnpm config:diagnose:continue

# JSON output for automation
pnpm config:diagnose --json
```

#### Diagnostic Checks Performed

1. **Environment Variables Validation**
   - Checks required variables are set
   - Validates variable formats
   - Identifies missing critical variables

2. **Runtime Configuration Verification**
   - Tests configuration loading
   - Validates URL accessibility
   - Checks service connectivity

3. **Health Checks**
   - API endpoint health
   - Database connectivity
   - Service availability

4. **Active Configuration Retrieval**
   - Current configuration source
   - Environment detection results
   - URL resolution status

### Individual Diagnostic Commands

#### Environment Variables

```bash
# Validate environment variables
pnpm config:validate-env

# Verbose validation
pnpm config:validate-env:verbose

# Strict mode (fail on warnings)
pnpm config:validate-env:strict
```

#### Runtime Configuration

```bash
# Verify runtime configuration
pnpm config:verify

# Verbose verification
pnpm config:verify:verbose
```

#### Health Checks

```bash
# Comprehensive health checks
pnpm config:health

# Verbose health checks
pnpm config:health:verbose

# Quick health check (config only)
pnpm config:health:quick
```

#### Active Configuration

```bash
# Show active configuration
pnpm config:check

# Show with environment variables
pnpm config:check:verbose

# Show only URLs
pnpm config:check:urls
```

## Specialized Debugging Tools

### Docker Configuration Verification

**Command:** `pnpm docker:verify`  
**Purpose:** Verify Docker-specific configuration  
**Location:** `apps/studio/scripts/verify-docker-config.ts`

```bash
# Verify Docker configuration
pnpm docker:verify

# Verbose Docker verification
pnpm docker:verify --verbose
```

### Error Handling Demonstration

**Command:** `tsx scripts/demo-error-handling.ts`  
**Purpose:** Demonstrate error handling and user guidance system  
**Location:** `apps/studio/scripts/demo-error-handling.ts`

```bash
# Run error handling demo
cd apps/studio
tsx scripts/demo-error-handling.ts
```

### Frontend Validation Demo

**Command:** `tsx scripts/demo-frontend-validation.ts`  
**Purpose:** Demonstrate frontend client validation  
**Location:** `apps/studio/scripts/demo-frontend-validation.ts`

```bash
# Run frontend validation demo
cd apps/studio
tsx scripts/demo-frontend-validation.ts
```

## Log Analysis Tools

### Environment Detection Log Analysis

```bash
# Analyze environment detection logs
./scripts/analyze-environment-logs.sh logs/combined.log

# Monitor environment detection in real-time
./scripts/monitor-environment-detection.sh logs/combined.log

# Health check monitoring
./scripts/health-check-monitor.sh http://localhost:3000/api/health
```

### Log Pattern Searches

```bash
# Find successful environment detection
grep "FINAL RESULT.*PRODUCTION" logs/combined.log

# Find critical errors
grep -E "(CRITICAL ERROR|Production environment using localhost)" logs/combined.log

# Find environment detection warnings
grep -E "(⚠️|WARNING).*environment" logs/combined.log

# Find build-time issues
grep "Docker build missing" logs/combined.log
```

## Troubleshooting Workflows

### Issue: Production Shows Development Environment

```bash
# 1. Debug environment detection
pnpm debug:env:verbose

# 2. Check environment variables
pnpm config:validate-env:verbose

# 3. Simulate production environment
pnpm debug:env:production

# 4. Run comprehensive diagnostics
pnpm config:diagnose:verbose
```

### Issue: Docker Build Environment Variables Not Available

```bash
# 1. Debug with Docker simulation
pnpm debug:env:docker

# 2. Verify Docker configuration
pnpm docker:verify

# 3. Check build-time environment detection
pnpm debug:env --verbose | grep "BUILD-TIME"

# 4. Validate Dockerfile ARG declarations
grep -E "^ARG|^ENV" Dockerfile
```

### Issue: URL Validation Errors

```bash
# 1. Test specific URLs
pnpm debug:env --test-urls "your-supabase-url,your-api-url"

# 2. Check URL configuration
pnpm config:check:urls

# 3. Validate for specific environment
ENVIRONMENT=production pnpm debug:env

# 4. Run URL-specific health checks
pnpm config:health:verbose
```

## Automation and CI/CD Integration

### Pre-Deployment Validation

```bash
#!/bin/bash
# pre-deploy-validation.sh

echo "Running pre-deployment validation..."

# Validate environment variables
pnpm config:validate-env:strict
if [ $? -ne 0 ]; then
  echo "❌ Environment variables validation failed"
  exit 1
fi

# Test environment detection
pnpm debug:env --no-recommendations
if [ $? -ne 0 ]; then
  echo "❌ Environment detection test failed"
  exit 1
fi

# Run comprehensive diagnostics
pnpm config:diagnose
if [ $? -ne 0 ]; then
  echo "❌ Configuration diagnostics failed"
  exit 1
fi

echo "✅ Pre-deployment validation passed"
```

### Post-Deployment Verification

```bash
#!/bin/bash
# post-deploy-verification.sh

HEALTH_URL=${1:-"https://your-domain.com/api/health"}

echo "Running post-deployment verification..."

# Wait for service to be ready
sleep 30

# Check health endpoint
curl -f "$HEALTH_URL"
if [ $? -ne 0 ]; then
  echo "❌ Health check failed"
  exit 1
fi

# Verify environment detection
RESPONSE=$(curl -s "$HEALTH_URL")
if echo "$RESPONSE" | grep -q "production"; then
  echo "✅ Production environment confirmed"
else
  echo "❌ Production environment not detected"
  exit 1
fi

echo "✅ Post-deployment verification passed"
```

### GitHub Actions Integration

```yaml
# .github/workflows/validate-config.yml
name: Validate Configuration

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Validate Environment Variables
        run: |
          cd apps/studio
          pnpm config:validate-env:strict
      
      - name: Test Environment Detection
        run: |
          cd apps/studio
          pnpm debug:env --no-recommendations
      
      - name: Run Configuration Diagnostics
        run: |
          cd apps/studio
          pnpm config:diagnose
```

## Documentation Index

### Core Documentation

| Document | Purpose | Location |
|----------|---------|----------|
| [Environment Detection Troubleshooting](./ENVIRONMENT-DETECTION-TROUBLESHOOTING.md) | Comprehensive troubleshooting guide | `apps/studio/docs/` |
| [Environment Variable Examples](./ENVIRONMENT-VARIABLE-EXAMPLES.md) | Complete configuration examples | `apps/studio/docs/` |
| [Production Deployment Logging Guide](./PRODUCTION-DEPLOYMENT-LOGGING-GUIDE.md) | Logging strategies and monitoring | `apps/studio/docs/` |
| [Environment Detection Overview](./ENVIRONMENT-DETECTION.md) | System overview and usage | `apps/studio/docs/` |

### Specialized Guides

| Document | Purpose | Location |
|----------|---------|----------|
| [Diagnostic Scripts Guide](./DIAGNOSTIC-SCRIPTS-GUIDE.md) | Quick reference for diagnostic commands | `apps/studio/docs/` |
| [Configuration Examples](./CONFIGURATION-EXAMPLES.md) | Environment-specific configurations | `apps/studio/docs/` |
| [Docker Deployment Checklist](./DOCKER-DEPLOYMENT-CHECKLIST.md) | Docker-specific deployment guide | `apps/studio/docs/` |
| [Runtime Configuration Troubleshooting](./RUNTIME-CONFIG-TROUBLESHOOTING.md) | Runtime configuration issues | `apps/studio/docs/` |

## Script Locations

### Debugging Scripts

| Script | Purpose | Location |
|--------|---------|----------|
| `debug-environment-detection.ts` | Primary environment debugging tool | `apps/studio/scripts/` |
| `diagnose-all.ts` | Comprehensive diagnostics | `apps/studio/scripts/` |
| `demo-error-handling.ts` | Error handling demonstration | `apps/studio/scripts/` |
| `demo-frontend-validation.ts` | Frontend validation demo | `apps/studio/scripts/` |

### Validation Scripts

| Script | Purpose | Location |
|--------|---------|----------|
| `validate-env-vars.ts` | Environment variables validation | `apps/studio/scripts/` |
| `verify-runtime-config.ts` | Runtime configuration verification | `apps/studio/scripts/` |
| `verify-docker-config.ts` | Docker configuration verification | `apps/studio/scripts/` |
| `test-health-checks.ts` | Health checks testing | `apps/studio/scripts/` |

### Utility Scripts

| Script | Purpose | Location |
|--------|---------|----------|
| `check-active-config.ts` | Active configuration display | `apps/studio/scripts/` |
| `analyze-environment-logs.sh` | Log analysis automation | `apps/studio/scripts/` |
| `monitor-environment-detection.sh` | Real-time log monitoring | `apps/studio/scripts/` |
| `health-check-monitor.sh` | Health check monitoring | `apps/studio/scripts/` |

## Getting Help

### Quick Help Commands

```bash
# Show available debugging commands
pnpm run | grep -E "(config:|debug:|docker:)"

# Get help for specific command
pnpm debug:env --help

# Show diagnostic script options
pnpm config:diagnose --help
```

### Support Escalation Process

1. **Run Initial Diagnostics**
   ```bash
   pnpm config:diagnose:verbose > diagnostics.log
   pnpm debug:env:verbose > env-debug.log
   ```

2. **Collect Environment Information**
   ```bash
   pnpm config:check:verbose > config-info.log
   env | grep -E "(ENVIRONMENT|NODE_ENV|SUPABASE|API)" > env-vars.log
   ```

3. **Analyze Logs**
   ```bash
   ./scripts/analyze-environment-logs.sh logs/combined.log > log-analysis.txt
   ```

4. **Create Support Package**
   ```bash
   tar -czf support-package-$(date +%Y%m%d-%H%M%S).tar.gz \
     diagnostics.log env-debug.log config-info.log env-vars.log log-analysis.txt
   ```

### Common Issues Quick Reference

| Issue | Quick Command | Documentation |
|-------|---------------|---------------|
| Production shows development | `pnpm debug:env:production` | [Troubleshooting Guide](./ENVIRONMENT-DETECTION-TROUBLESHOOTING.md#1-production-shows-development-environment-detected) |
| Docker build variables missing | `pnpm debug:env:docker` | [Troubleshooting Guide](./ENVIRONMENT-DETECTION-TROUBLESHOOTING.md#3-docker-build-environment-variables-not-available) |
| URL validation errors | `pnpm config:check:urls` | [Troubleshooting Guide](./ENVIRONMENT-DETECTION-TROUBLESHOOTING.md#2-production-environment-with-localhost-urls) |
| Health checks failing | `pnpm config:health:verbose` | [Diagnostic Scripts Guide](./DIAGNOSTIC-SCRIPTS-GUIDE.md#troubleshooting) |

This debugging utilities index provides comprehensive access to all tools and documentation needed to diagnose and resolve environment detection issues efficiently.