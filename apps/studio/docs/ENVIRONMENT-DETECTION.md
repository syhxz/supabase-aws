# Environment Detection and Environment-Specific Behavior

## Overview

This document describes the environment detection system that ensures correct URL usage across different deployment environments (development, staging, production).

## Features

### 1. Environment Detection

The system automatically detects the current environment using multiple signals:

**Detection Priority:**
1. **Explicit ENVIRONMENT variable** - Highest priority
2. **NODE_ENV variable** - Standard Node.js environment
3. **URL patterns** - Analyzes URLs for localhost/staging indicators
4. **Default to production** - Safe default for unspecified environments

### 2. Environment-Specific Validation

URLs are validated based on the detected environment:

**Production Environment:**
- ❌ Rejects localhost and 127.0.0.1 URLs
- ⚠️  Warns about insecure HTTP URLs
- ✅ Requires production-ready URLs

**Development Environment:**
- ✅ Expects localhost URLs
- ⚠️  Warns if using non-localhost URLs (may be intentional)

**Staging Environment:**
- ✅ Expects staging-specific URLs
- ⚠️  Warns about localhost usage

### 3. Environment-Specific Logging

All configuration operations include environment-aware logging:

```typescript
// Production
[Runtime Config API] 🚀 PRODUCTION environment detected
[Runtime Config API] ✓ Production URLs validated (no localhost detected)

// Development
[Runtime Config Store] 🔧 DEVELOPMENT environment detected
[Runtime Config Store] ✓ Using localhost URLs (expected for development)

// Staging
[GoTrue Config] 🧪 STAGING environment detected
[GoTrue Config] ✓ Using staging URL
```

## Usage

### Detecting Environment

```typescript
import { detectEnvironment } from 'common/environment-detection'

const envInfo = detectEnvironment()
console.log(envInfo.environment) // 'development' | 'production' | 'staging'
console.log(envInfo.isProduction) // boolean
console.log(envInfo.detectionMethod) // How it was detected
```

### Validating URLs

```typescript
import { validateUrlsForEnvironment } from 'common/environment-detection'

const validation = validateUrlsForEnvironment(
  {
    gotrueUrl: 'http://localhost:54321/auth/v1',
    supabaseUrl: 'http://localhost:54321',
  },
  'production'
)

if (!validation.isValid) {
  console.error('URL validation errors:', validation.errors)
}
```

### Performing Comprehensive Check

```typescript
import { performEnvironmentCheck } from 'common/environment-detection'

// Detects environment, validates URLs, and logs everything
const envInfo = performEnvironmentCheck({
  gotrueUrl: config.gotrueUrl,
  supabaseUrl: config.supabaseUrl,
  apiUrl: config.apiUrl,
})
```

## Environment Variables

### Setting Explicit Environment

```bash
# Explicitly set environment (highest priority)
ENVIRONMENT=production

# Or use NODE_ENV
NODE_ENV=production
```

### URL-Based Detection

The system analyzes these URLs for environment indicators:
- `SUPABASE_PUBLIC_URL`
- `SUPABASE_URL`
- `API_EXTERNAL_URL`

**Development indicators:**
- Contains `localhost`
- Contains `127.0.0.1`

**Staging indicators:**
- Contains `staging`
- Contains `stg`

## Integration Points

The environment detection system is integrated into:

1. **Runtime Config API** (`apps/studio/pages/api/runtime-config.ts`)
   - Detects environment on every config request
   - Validates URLs for the environment
   - Logs environment-specific warnings

2. **Runtime Config Store** (`packages/common/runtime-config.ts`)
   - Validates URLs when config is loaded
   - Logs environment-specific messages
   - Warns about localhost in production

3. **GoTrue Config** (`packages/common/gotrue-config.ts`)
   - Validates GoTrue URL for environment
   - Logs environment-aware resolution info
   - Warns about misconfigurations

## Error Detection

### Production with Localhost URLs

```
[Runtime Config Store] ❌ CRITICAL ERROR: Production environment using localhost URLs!
[Runtime Config Store] All API requests will fail!
[Runtime Config Store] Check your environment variables:
[Runtime Config Store]   - SUPABASE_PUBLIC_URL
[Runtime Config Store]   - API_EXTERNAL_URL
[Runtime Config Store]   - NEXT_PUBLIC_GOTRUE_URL
```

### Development with Remote URLs

```
[Runtime Config Store] ⚠️  Development environment not using localhost URLs
[Runtime Config Store] This may be intentional if connecting to remote services
```

## Recommendations

### Production Deployment

```bash
# Set explicit environment
ENVIRONMENT=production

# Use production URLs
SUPABASE_PUBLIC_URL=https://your-project.supabase.co
API_EXTERNAL_URL=https://api.your-domain.com
NEXT_PUBLIC_GOTRUE_URL=https://your-project.supabase.co/auth/v1

# Use HTTPS
# Never use localhost or 127.0.0.1
```

### Development Setup

```bash
# Optional: Set explicit environment
ENVIRONMENT=development

# Use localhost URLs (or omit for defaults)
SUPABASE_PUBLIC_URL=http://localhost:54321
API_EXTERNAL_URL=http://localhost:8000
```

### Staging Setup

```bash
# Set explicit environment
ENVIRONMENT=staging

# Use staging URLs
SUPABASE_PUBLIC_URL=https://staging.your-domain.com
API_EXTERNAL_URL=https://staging-api.your-domain.com
```

## Testing

Comprehensive tests are available in `packages/common/environment-detection.test.ts`:

```bash
# Run environment detection tests
pnpm test environment-detection.test.ts
```

Tests cover:
- Environment detection from various signals
- URL validation for each environment
- Priority ordering of detection methods
- Recommendation generation
- Comprehensive environment checks

## Benefits

1. **Early Error Detection** - Catches misconfigurations before they cause runtime failures
2. **Clear Logging** - Environment-aware messages make debugging easier
3. **Automatic Validation** - No manual checks needed
4. **Safe Defaults** - Defaults to production for safety
5. **Flexible Detection** - Multiple detection methods for different deployment scenarios

## Related Documentation

- [Runtime Configuration](./RUNTIME-CONFIG-ERROR-HANDLING.md)
- [Configuration Logging](./CONFIGURATION-LOGGING.md)
- [Docker Deployment](./DOCKER-DEPLOYMENT-CHECKLIST.md)
