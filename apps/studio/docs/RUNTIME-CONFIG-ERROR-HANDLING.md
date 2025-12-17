# Runtime Configuration Error Handling

This document describes the comprehensive error handling system for runtime configuration in Supabase Studio.

## Overview

The runtime configuration system includes robust error handling that:
- Detects and categorizes different types of errors
- Provides user-friendly error messages with troubleshooting steps
- Implements automatic fallback to build-time configuration
- Includes retry logic with exponential backoff
- Logs detailed error information for debugging

## Error Types

### 1. Network Timeout (`NETWORK_TIMEOUT`)

**Cause**: Request to `/api/runtime-config` exceeds the 3-second timeout.

**User Message**: "Configuration request timed out"

**Troubleshooting Steps**:
- Check your network connection
- Verify the server is running and accessible
- Try refreshing the page
- If the problem persists, the application will use build-time defaults

**Fallback**: Yes - uses build-time configuration

### 2. Network Error (`NETWORK_ERROR`)

**Cause**: Network connectivity issues, DNS resolution failures, or server unreachable.

**User Message**: "Failed to connect to configuration server"

**Troubleshooting Steps**:
- Check your network connection
- Verify the server is running
- Check if a firewall is blocking the connection
- The application will use build-time configuration as fallback

**Fallback**: Yes - uses build-time configuration

### 3. Invalid Response (`INVALID_RESPONSE`)

**Cause**: Server returns a response that doesn't match the expected format or is missing required fields.

**User Message**: "Received invalid configuration from server"

**Troubleshooting Steps**:
- Verify server environment variables are properly set
- Check server logs for configuration errors
- Ensure all required fields are present in the response
- The application will use build-time configuration as fallback

**Fallback**: Yes - uses build-time configuration

### 4. Missing Environment Variables (`MISSING_ENV_VARS`)

**Cause**: Required environment variables are not set on the server.

**User Message**: "Server configuration is incomplete"

**Troubleshooting Steps**:
- Set the following environment variables on the server:
  - `SUPABASE_PUBLIC_URL` or `API_EXTERNAL_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Restart the server after setting environment variables
- For development, localhost defaults will be used
- For production, ensure proper URLs are configured

**Fallback**: Yes - uses localhost defaults for development

### 5. Invalid URL (`INVALID_URL`)

**Cause**: Configuration contains URLs with invalid format or unsupported protocol.

**User Message**: "Configuration contains invalid URL"

**Troubleshooting Steps**:
- Verify URLs are valid http or https URLs
- Check for typos in the URL
- Ensure the URL includes the protocol (http:// or https://)
- Example: https://your-project.supabase.co

**Fallback**: Yes - uses build-time configuration

### 6. Server Error (`SERVER_ERROR`)

**Cause**: Server returns an HTTP error status (4xx or 5xx).

**User Message**: "Configuration server returned an error"

**Troubleshooting Steps**:
- Check server logs for detailed error information
- Verify server environment variables are properly set
- Ensure the server has access to required resources
- The application will use build-time configuration as fallback

**Fallback**: Yes - uses build-time configuration

### 7. Unknown Error (`UNKNOWN`)

**Cause**: Unexpected error that doesn't match other categories.

**User Message**: "An unexpected error occurred while loading configuration"

**Troubleshooting Steps**:
- Try refreshing the page
- Check browser console for detailed error information
- If the problem persists, contact support
- The application will use build-time configuration as fallback

**Fallback**: Yes - uses build-time configuration

## Fallback Strategy

When runtime configuration fails, the system follows this fallback chain:

1. **Runtime Configuration** (highest priority)
   - Fetched from `/api/runtime-config`
   - Server-side environment variables
   - Can be changed without rebuild

2. **Explicit Build-time Configuration**
   - `NEXT_PUBLIC_GOTRUE_URL`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - Compiled into bundle

3. **Derived Build-time Configuration**
   - Derived from `SUPABASE_PUBLIC_URL`
   - Derived from `SUPABASE_URL`
   - Compiled into bundle

4. **Development Defaults** (lowest priority)
   - `http://127.0.0.1:54321/auth/v1`
   - Only suitable for local development

## Retry Logic

The system implements automatic retry with exponential backoff:

- **Maximum Retries**: 3 attempts
- **Initial Delay**: 1 second
- **Backoff Strategy**: Exponential (doubles each retry)
- **Maximum Delay**: 5 seconds

Example retry sequence:
1. First attempt fails → wait 1 second
2. Second attempt fails → wait 2 seconds
3. Third attempt fails → wait 4 seconds
4. All retries exhausted → use fallback configuration

## User Interface

### Loading State

While fetching runtime configuration:
```
┌─────────────────────────────────┐
│                                 │
│         [Logo Loader]           │
│                                 │
│   Loading configuration...      │
│                                 │
└─────────────────────────────────┘
```

### Error State

When configuration fails but app continues with fallback:
```
┌──────────────────────────────────────────────────────────┐
│ ⚠️  Configuration Warning                                │
│                                                          │
│ Failed to load runtime configuration                    │
│                                                          │
│ ▸ Troubleshooting suggestions                           │
│   • Check your network connection                       │
│   • Verify the server is running                        │
│   • The application will use build-time defaults        │
│                                                          │
│                                          [Retry] Button  │
└──────────────────────────────────────────────────────────┘
```

## Logging

All configuration errors are logged with appropriate severity:

### Warning Level (Fallback Available)
```javascript
console.warn('[Runtime Config Store] Configuration warning')
console.warn('[Runtime Config Store] Technical details:', error.message)
console.warn('[Runtime Config Store] Suggestions:')
console.warn('  - Check your network connection')
console.warn('  - Verify the server is running')
```

### Error Level (Critical)
```javascript
console.error('[Runtime Config Store] Configuration error')
console.error('[Runtime Config Store] Technical details:', error.message)
console.error('[Runtime Config Store] Suggestions:')
console.error('  - Check server logs for details')
```

## API Response Format

### Success Response
```json
{
  "gotrueUrl": "http://192.0.2.1:8000/auth/v1",
  "supabaseUrl": "http://192.0.2.1:8000",
  "apiUrl": "http://192.0.2.1:8000",
  "anonKey": "eyJhbGc...",
  "source": "explicit",
  "environment": "production",
  "timestamp": 1701234567890
}
```

### Error Response
```json
{
  "error": "Invalid environment configuration",
  "details": "SUPABASE_PUBLIC_URL is set but invalid",
  "suggestions": [
    "Ensure SUPABASE_PUBLIC_URL is a valid http or https URL",
    "Example: https://your-project.supabase.co"
  ]
}
```

## Testing Error Handling

### Simulate Network Timeout
```javascript
// In browser console
const controller = new AbortController()
setTimeout(() => controller.abort(), 100) // Abort after 100ms
fetch('/api/runtime-config', { signal: controller.signal })
```

### Simulate Invalid Response
```javascript
// Temporarily modify API to return invalid data
// In apps/studio/pages/api/runtime-config.ts
return res.status(200).json({ invalid: 'data' })
```

### Simulate Server Error
```javascript
// Temporarily modify API to return error
// In apps/studio/pages/api/runtime-config.ts
return res.status(500).json({ error: 'Internal server error' })
```

### Test Fallback Behavior
```bash
# Stop the server to trigger network errors
# The app should continue with build-time configuration
```

## Best Practices

1. **Always Set Environment Variables in Production**
   - Set `SUPABASE_PUBLIC_URL` or `API_EXTERNAL_URL`
   - Set `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Never rely on defaults in production

2. **Monitor Error Logs**
   - Check server logs regularly for configuration errors
   - Set up alerts for repeated configuration failures

3. **Test Error Scenarios**
   - Test with missing environment variables
   - Test with invalid URLs
   - Test with network timeouts
   - Verify fallback behavior works correctly

4. **Provide Clear Documentation**
   - Document required environment variables
   - Provide examples of proper configuration
   - Include troubleshooting steps in deployment guides

5. **Handle Errors Gracefully**
   - Never block the application due to configuration errors
   - Always provide fallback options
   - Show clear error messages to users
   - Log detailed information for debugging

## Related Documentation

- [Runtime Configuration Guide](./RUNTIME-CONFIG-GUIDE.md)
- [API Client Runtime Config](./API-CLIENT-RUNTIME-CONFIG.md)
- [Deployment Guide](../../../PRODUCTION-DEPLOYMENT-GUIDE.md)
