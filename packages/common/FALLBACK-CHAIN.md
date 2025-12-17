# Configuration Fallback Chain

This document explains the fallback chain used for GoTrue URL configuration in the Supabase Studio frontend.

## Overview

The configuration system implements a comprehensive fallback chain to ensure the application can work in various environments (development, staging, production) with different levels of configuration.

## Fallback Priority Order

The system attempts to resolve the GoTrue URL in the following order:

```
1. Runtime Configuration (highest priority)
   ↓ (if unavailable or invalid)
2. Explicit Build-time Configuration
   ↓ (if unavailable or invalid)
3. Derived from Public URL
   ↓ (if unavailable or invalid)
4. Derived from Internal URL
   ↓ (if unavailable or invalid)
5. Development Defaults (lowest priority)
```

### 1. Runtime Configuration

**Source:** `/api/runtime-config` endpoint  
**Environment Variable:** Server-side environment variables  
**Priority:** Highest  
**Can be changed:** Yes, without rebuild (restart container)

The runtime configuration is fetched from the server at application startup. This allows the same Docker image to be deployed to multiple environments with different configurations.

**Example:**
```bash
# Set on the server/container
SUPABASE_PUBLIC_URL=https://api.production.com
API_EXTERNAL_URL=https://api.production.com
```

### 2. Explicit Build-time Configuration

**Source:** `NEXT_PUBLIC_GOTRUE_URL` environment variable  
**Priority:** High  
**Can be changed:** No, requires rebuild

Explicitly set GoTrue URL that is compiled into the JavaScript bundle during build.

**Example:**
```bash
# Set during build
NEXT_PUBLIC_GOTRUE_URL=https://api.example.com/auth/v1
```

### 3. Derived from Public URL

**Source:** `SUPABASE_PUBLIC_URL` environment variable  
**Priority:** Medium  
**Can be changed:** No, requires rebuild  
**Derivation:** Appends `/auth/v1` to the base URL

**Example:**
```bash
# Set during build
SUPABASE_PUBLIC_URL=https://api.example.com
# Results in: https://api.example.com/auth/v1
```

### 4. Derived from Internal URL

**Source:** `SUPABASE_URL` environment variable  
**Priority:** Low  
**Can be changed:** No, requires rebuild  
**Derivation:** Appends `/auth/v1` to the base URL

**Example:**
```bash
# Set during build
SUPABASE_URL=http://localhost:54321
# Results in: http://localhost:54321/auth/v1
```

### 5. Development Defaults

**Source:** Hardcoded default  
**Priority:** Lowest  
**Value:** `http://127.0.0.1:54321/auth/v1`  
**Use case:** Local development only

This is the fallback of last resort and should only be used in development environments.

## Environment-Specific Behavior

### Development Environment

- **Expected:** Using localhost defaults is normal
- **Warnings:** Minimal warnings, informational logging
- **Recommendation:** No configuration needed for local development

**Example Log:**
```
[GoTrue Config] ℹ️  Development environment: Using localhost defaults
[GoTrue Config] This is expected for local development
[GoTrue Config] Ensure your local Supabase stack is running on http://127.0.0.1:54321/auth/v1
```

### Production Environment

- **Expected:** Explicit or runtime configuration
- **Warnings:** Critical errors if using defaults
- **Recommendation:** Always set explicit configuration

**Example Log (Good):**
```
[GoTrue Config] ✓ Production environment with explicit configuration (recommended)
```

**Example Log (Bad):**
```
[GoTrue Config] ❌ CRITICAL: Using development defaults in production!
[GoTrue Config] This will cause all authentication requests to fail!
[GoTrue Config] Action required: Set one of these environment variables:
[GoTrue Config]   - NEXT_PUBLIC_GOTRUE_URL (recommended)
[GoTrue Config]   - SUPABASE_PUBLIC_URL
[GoTrue Config]   - SUPABASE_URL
```

### Staging Environment

- **Expected:** Explicit or runtime configuration
- **Warnings:** Warnings if using defaults
- **Recommendation:** Set appropriate staging URLs

## Fallback Warnings

The system provides detailed warnings when falling back through the chain:

### When Falling Back to Defaults

```
[GoTrue Config] ⚠️  Fallback chain reached development defaults
[GoTrue Config] Fallback chain: runtime → explicit → derived → DEFAULT
```

In production, this triggers critical errors:
```
[GoTrue Config] ❌ CRITICAL: Using development defaults in production!
[GoTrue Config] This will cause API requests to fail.
[GoTrue Config] Fallback occurred because:
[GoTrue Config]   1. Runtime config API failed or returned invalid data
[GoTrue Config]   2. No NEXT_PUBLIC_GOTRUE_URL environment variable
[GoTrue Config]   3. No SUPABASE_PUBLIC_URL environment variable
[GoTrue Config]   4. No SUPABASE_URL environment variable
```

### When Using Derived URLs

```
[GoTrue Config] ⚠️  Using derived URL as fallback
[GoTrue Config] Runtime config was unavailable, using build-time derived URL
```

In production:
```
[GoTrue Config] ⚠️  Production environment using derived URL
[GoTrue Config] Consider setting explicit NEXT_PUBLIC_GOTRUE_URL for production
```

## Best Practices

### For Development

1. **No configuration needed** - defaults work out of the box
2. Ensure local Supabase stack is running on `http://127.0.0.1:54321`

### For Production

1. **Always use runtime configuration** (recommended)
   ```bash
   SUPABASE_PUBLIC_URL=https://your-api.com
   API_EXTERNAL_URL=https://your-api.com
   ```

2. **Or use explicit build-time configuration**
   ```bash
   NEXT_PUBLIC_GOTRUE_URL=https://your-api.com/auth/v1
   ```

3. **Never rely on defaults** - they will cause failures

### For Staging

1. Use runtime or explicit configuration
2. Set environment-specific URLs
3. Test the complete fallback chain

## Testing Fallback Behavior

The fallback chain is thoroughly tested in `gotrue-config.test.ts`:

- ✅ Complete fallback chain (runtime → explicit → derived → default)
- ✅ Fallback with missing environment variables
- ✅ Fallback with invalid URLs
- ✅ Environment-specific warnings
- ✅ Localhost defaults in development
- ✅ Critical errors in production

## Troubleshooting

### Issue: API requests failing in production

**Symptom:** All authentication requests return connection errors

**Diagnosis:**
1. Check logs for "CRITICAL: Using development defaults in production"
2. Verify environment variables are set
3. Confirm runtime config API is accessible

**Solution:**
```bash
# Set one of these environment variables
SUPABASE_PUBLIC_URL=https://your-production-api.com
# or
NEXT_PUBLIC_GOTRUE_URL=https://your-production-api.com/auth/v1
```

### Issue: Configuration not updating after environment variable change

**Symptom:** Old URLs still being used after updating environment variables

**Diagnosis:**
1. Check if using build-time configuration (requires rebuild)
2. Verify runtime config API is returning new values

**Solution:**
- For runtime config: Restart the container
- For build-time config: Rebuild the Docker image

### Issue: Warnings about derived URLs in production

**Symptom:** Logs show "Production environment using derived URL"

**Diagnosis:** Using `SUPABASE_PUBLIC_URL` instead of explicit `NEXT_PUBLIC_GOTRUE_URL`

**Solution:**
```bash
# Set explicit GoTrue URL (recommended for production)
NEXT_PUBLIC_GOTRUE_URL=https://your-production-api.com/auth/v1
```

## Related Documentation

- [Runtime Configuration](./runtime-config.ts) - Runtime configuration store
- [Environment Detection](./environment-detection.ts) - Environment detection utilities
- [GoTrue Configuration](./gotrue-config.ts) - Main configuration module
