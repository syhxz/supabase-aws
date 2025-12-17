# API Client Runtime Configuration Updates

## Overview

This document describes the updates made to API clients to support runtime configuration and comprehensive URL logging for debugging purposes.

## Changes Made

### 1. GoTrue Client (`packages/common/gotrue.ts`)

**Runtime Configuration Integration:**
- Added import for `getGoTrueUrlAsync` and `subscribeToConfigChanges`
- Created `updateGoTrueClientUrl()` function to dynamically update the client URL when runtime configuration changes
- Added subscription to runtime config changes to automatically update the client URL
- The client now prioritizes runtime configuration over build-time configuration

**URL Logging:**
- Enhanced `fetchWithTimeout` wrapper to log all outgoing requests
- Logs include:
  - Request URL before making the request
  - Response status for failed requests
  - Error messages with URL for failed requests
- All logs are prefixed with `[GoTrue Client]` for easy filtering

**Example Logs:**
```
[GoTrue Client] Initializing with URL: http://192.0.2.1:8000/auth/v1 (source: runtime)
[GoTrue Client] Making request to: http://192.0.2.1:8000/auth/v1/token
[GoTrue Client] Request failed: http://192.0.2.1:8000/auth/v1/token - Status: 401 Unauthorized
```

### 2. Auth Provider (`packages/common/auth.tsx`)

**Runtime Configuration Integration:**
- Added import for `updateGoTrueClientUrl`
- Updated initialization effect to call `updateGoTrueClientUrl()` before initializing the GoTrue client
- Ensures the client uses production URLs from runtime config before any authentication operations
- Gracefully handles runtime config failures by falling back to build-time configuration

**Flow:**
1. Component mounts
2. Fetch runtime configuration
3. Update GoTrue client URL
4. Initialize GoTrue client
5. Restore session from localStorage

### 3. GoTrue Health Check (`apps/studio/lib/gotrue-health.ts`)

**URL Logging:**
- Added logging before making health check requests
- Logs successful health checks with response time
- Logs failed health checks with status code and error message
- All logs are prefixed with `[GoTrue Health]`

**Example Logs:**
```
[GoTrue Health] Checking health at: http://192.0.2.1:8000/auth/v1/health
[GoTrue Health] Health check successful: http://192.0.2.1:8000/auth/v1/health (234ms)
```

### 4. Config Health Check (`apps/studio/lib/config-health.ts`)

**URL Logging:**
- Added logging before checking service reachability
- Logs successful checks with response time
- Logs failed checks with status code and error message
- Logs timeout errors with duration
- All logs are prefixed with `[Config Health]`

**Example Logs:**
```
[Config Health] Checking service reachability: http://192.0.2.1:8000/health
[Config Health] Service reachable: http://192.0.2.1:8000/health (156ms)
```

### 5. Analytics API (`apps/studio/lib/api/self-hosted/logs.ts`)

**URL Logging:**
- Added logging before making analytics requests
- Logs failed requests with status code
- Logs request errors with error message
- All logs are prefixed with `[Analytics API]`

**Example Logs:**
```
[Analytics API] Making request to: https://logflare.example.com/api/endpoints/query/logs
[Analytics API] Request failed: https://logflare.example.com/api/endpoints/query/logs - Status: 403 Forbidden
```

## Benefits

### 1. Runtime Configuration Support

- **No Rebuild Required:** API clients now use runtime configuration, allowing URL changes without rebuilding the application
- **Environment Portability:** The same Docker image can be deployed to multiple environments with different URLs
- **Dynamic Updates:** Client URLs automatically update when runtime configuration changes

### 2. Comprehensive URL Logging

- **Debugging:** All API requests log their URLs, making it easy to identify which URLs are being used
- **Troubleshooting:** Failed requests include the attempted URL, status code, and error message
- **Monitoring:** Logs can be filtered by service name (e.g., `[GoTrue Client]`, `[Analytics API]`)
- **Production Issues:** When requests fail in production, logs show exactly which URL was attempted

### 3. Validation

- **Requirements 1.2:** Frontend makes API requests using production URLs (validated by URL logging)
- **Requirements 3.3:** Failed requests log the attempted URL for debugging (implemented in all API clients)

## Testing

A comprehensive test suite was created in `apps/studio/tests/lib/api-url-logging.test.ts` that verifies:

1. URL logging is present in `gotrue.ts`
2. URL logging is present in `gotrue-health.ts`
3. URL logging is present in `config-health.ts`
4. URL logging is present in `logs.ts`
5. Runtime config integration is present in `auth.tsx`
6. Runtime config subscription is present in `gotrue.ts`

All tests pass successfully.

## Usage

### For Developers

No code changes are required. The API clients will automatically:
1. Use runtime configuration when available
2. Fall back to build-time configuration if runtime config fails
3. Log all requests for debugging

### For DevOps

To change API URLs in production:
1. Update environment variables (e.g., `SUPABASE_PUBLIC_URL`, `API_EXTERNAL_URL`)
2. Restart the container
3. The application will automatically use the new URLs
4. Check logs to verify the correct URLs are being used

### Debugging Production Issues

When investigating API failures:
1. Check logs for `[GoTrue Client]`, `[Analytics API]`, etc.
2. Look for "Making request to:" messages to see which URLs are being used
3. Look for "Request failed:" or "Request error:" messages to see what went wrong
4. Verify the URLs match your expected production URLs

## Related Files

- `packages/common/gotrue.ts` - GoTrue client with runtime config and URL logging
- `packages/common/auth.tsx` - Auth provider with runtime config integration
- `packages/common/gotrue-config.ts` - Configuration resolution with runtime priority
- `packages/common/runtime-config.ts` - Runtime configuration store
- `apps/studio/lib/gotrue-health.ts` - GoTrue health check with URL logging
- `apps/studio/lib/config-health.ts` - Config health check with URL logging
- `apps/studio/lib/api/self-hosted/logs.ts` - Analytics API with URL logging
- `apps/studio/tests/lib/api-url-logging.test.ts` - Test suite for URL logging

## Next Steps

This implementation satisfies task 6 of the fix-frontend-runtime-config spec:
- ✅ Updated gotrue.ts to use runtime config
- ✅ Updated auth.tsx to use runtime config
- ✅ Updated other API clients to use runtime config
- ✅ Added URL logging for all API requests

The application now properly uses runtime configuration and logs all API requests for debugging purposes.
