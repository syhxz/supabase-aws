# Configuration Logging System

This document describes the comprehensive logging system implemented for configuration-related operations in the Supabase Studio application.

## Overview

The configuration logging system provides standardized, detailed logging for all configuration operations with:

- **Configuration source tracking** - Logs which source (runtime, explicit, derived, default) is being used
- **Failed request URL logging** - Detailed logging of failed requests with troubleshooting guidance
- **Environment-aware logging** - Different log levels and messages based on environment (development, production, staging)
- **Centralized error handling** - Consistent error formatting and troubleshooting suggestions

## Key Components

### 1. Configuration Logging Module (`packages/common/configuration-logging.ts`)

The main logging module that provides:

- `logConfigurationSource()` - Logs configuration source information with environment-specific validation
- `logFailedRequest()` - Logs failed requests with detailed troubleshooting steps
- `logSuccessfulRequest()` - Logs successful requests (in debug mode)
- `logConfigurationChange()` - Logs configuration changes with audit trail
- `logConfigurationError()` - Logs configuration errors with troubleshooting guidance
- `logConfigurationValidation()` - Logs configuration validation results

### 2. Enhanced Error Handling (`packages/common/runtime-config-errors.ts`)

Enhanced error handling with:

- URL-specific troubleshooting suggestions
- Environment-specific guidance (localhost vs production)
- Status code-specific recommendations
- Detailed error context and metadata

### 3. Integration Points

The logging system is integrated throughout the configuration stack:

- **Runtime Config API** (`apps/studio/pages/api/runtime-config.ts`) - Enhanced error logging
- **Runtime Config Store** (`packages/common/runtime-config.ts`) - Request logging and error handling
- **GoTrue Client** (`packages/common/gotrue.ts`) - Request logging with troubleshooting
- **GoTrue Config** (`packages/common/gotrue-config.ts`) - Configuration source logging

## Features

### Configuration Source Logging

Tracks and logs which configuration source is being used:

```typescript
logConfigurationSource(
  'Runtime Config Store',
  'runtime', // source type
  {
    gotrueUrl: 'https://api.example.com/auth/v1',
    supabaseUrl: 'https://api.example.com',
    apiUrl: 'https://api.example.com',
  },
  'production', // environment
  { hasAnonKey: true } // metadata
)
```

**Output:**
```
[Runtime Config Store] [LOAD] ✓ Configuration loaded successfully
[Runtime Config Store] [LOAD] Source: runtime
[Runtime Config Store] [LOAD] Environment: PRODUCTION
[Runtime Config Store] [LOAD] GoTrue URL: https://api.example.com/auth/v1
[Runtime Config Store] [LOAD] Supabase URL: https://api.example.com
[Runtime Config Store] [LOAD] API URL: https://api.example.com
[Runtime Config Store] [LOAD] 🚀 PRODUCTION environment detected
[Runtime Config Store] [LOAD] ✓ Production URLs validated (no localhost detected)
[Runtime Config Store] [LOAD] ✓ Using runtime configuration (optimal)
```

### Failed Request Logging

Provides detailed logging for failed requests with environment-specific troubleshooting:

```typescript
logFailedRequest('GoTrue Client', {
  url: 'http://localhost:54321/auth/v1/user',
  method: 'GET',
  status: 500,
  responseTime: 1500,
  success: false,
  error: 'Internal Server Error',
})
```

**Output:**
```
[GoTrue Client] [ERROR_HANDLING] ❌ Request failed
[GoTrue Client] [ERROR_HANDLING] URL: http://localhost:54321/auth/v1/user
[GoTrue Client] [ERROR_HANDLING] Method: GET
[GoTrue Client] [ERROR_HANDLING] Status: 500
[GoTrue Client] [ERROR_HANDLING] Response time: 1500ms
[GoTrue Client] [ERROR_HANDLING] Error: Internal Server Error
[GoTrue Client] [ERROR_HANDLING] Environment-specific guidance:
[GoTrue Client] [ERROR_HANDLING]   - Ensure local Supabase services are running
[GoTrue Client] [ERROR_HANDLING]   - Check docker-compose status: docker-compose ps
[GoTrue Client] [ERROR_HANDLING]   - Verify ports are not blocked: 8000 (Kong), 54321 (GoTrue)
```

### Environment-Specific Validation

The system provides different logging and validation based on the detected environment:

#### Production Environment
- **Critical errors** for localhost URLs
- **Warnings** for derived URLs (recommends explicit configuration)
- **Validation** of HTTPS usage
- **Detailed troubleshooting** for production-specific issues

#### Development Environment
- **Expected behavior** for localhost URLs
- **Warnings** for non-localhost URLs (may be intentional)
- **Guidance** for local development setup

#### Staging Environment
- **Warnings** for localhost URLs (likely misconfiguration)
- **Validation** of staging-specific URLs
- **Recommendations** for staging environment setup

### Configuration Change Tracking

Maintains an audit trail of configuration changes:

```typescript
logConfigurationChange(
  'Runtime Config Store',
  ConfigOperation.UPDATE,
  previousConfig,
  newConfig,
  'production'
)
```

The system tracks:
- Configuration source changes
- URL changes (sanitized for security)
- Environment context
- Metadata and timestamps

### Error Handling with Troubleshooting

Enhanced error handling provides specific troubleshooting steps:

```typescript
const error = new ConfigError({
  type: ConfigErrorType.NETWORK_TIMEOUT,
  message: 'Request timeout after 3000ms',
  userMessage: 'Configuration request timed out',
  suggestions: [
    'Check your network connection',
    'Verify the server is running and accessible',
    'For local development: ensure docker-compose services are running',
  ],
  canFallback: true,
})

logConfigurationError('Runtime Config Store', error)
```

## Usage Examples

### Basic Configuration Logging

```typescript
import { logConfigurationSource } from 'common/configuration-logging'

// Log successful configuration load
logConfigurationSource(
  'My Component',
  'runtime',
  { gotrueUrl: 'https://api.example.com/auth/v1' },
  'production'
)
```

### Request Logging

```typescript
import { logFailedRequest, logSuccessfulRequest } from 'common/configuration-logging'

// Log failed request
logFailedRequest('API Client', {
  url: 'https://api.example.com/config',
  method: 'GET',
  status: 500,
  success: false,
  error: 'Internal Server Error',
  responseTime: 1500,
})

// Log successful request (debug mode only)
logSuccessfulRequest('API Client', {
  url: 'https://api.example.com/config',
  method: 'GET',
  status: 200,
  success: true,
  responseTime: 150,
})
```

### Error Logging

```typescript
import { logConfigurationError } from 'common/configuration-logging'
import { createNetworkTimeoutError } from 'common/runtime-config-errors'

const error = createNetworkTimeoutError(3000, 'https://api.example.com/config')
logConfigurationError('My Component', error, {
  context: 'additional context',
})
```

## Debug Mode

Enable debug logging for more verbose output:

```typescript
import { enableConfigDebugLogging } from 'common/configuration-logging'

// Enable debug logging (stores in localStorage)
enableConfigDebugLogging()

// Or set environment variable
process.env.CONFIG_DEBUG = 'true'

// Or set NODE_ENV to development
process.env.NODE_ENV = 'development'
```

## Configuration Change History

Access the configuration change history for debugging:

```typescript
import { getConfigurationChangeHistory } from 'common/configuration-logging'

const history = getConfigurationChangeHistory()
console.log('Configuration changes:', history)
```

## Benefits

1. **Improved Debugging** - Detailed logs make it easier to diagnose configuration issues
2. **Environment Awareness** - Different behavior and guidance for different environments
3. **Proactive Error Prevention** - Warns about common misconfigurations before they cause issues
4. **Consistent Logging** - Standardized log format across all configuration operations
5. **Troubleshooting Guidance** - Specific, actionable steps for resolving issues
6. **Audit Trail** - Track configuration changes over time
7. **Security** - Sanitizes sensitive data (API keys, query parameters) from logs

## Requirements Satisfied

This implementation satisfies the following requirements from the specification:

- **Requirement 2.5**: Configuration source logging throughout the system
- **Requirement 3.3**: Failed request URL logging for debugging  
- **Requirement 5.4**: Detailed error messages with troubleshooting guidance

The logging system provides comprehensive visibility into configuration operations while maintaining security and providing actionable troubleshooting information.