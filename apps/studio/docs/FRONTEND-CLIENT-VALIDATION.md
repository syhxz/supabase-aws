# Frontend Client URL Validation

This document describes the frontend client URL validation system implemented to enhance environment detection and URL validation for Supabase clients.

## Overview

The frontend client validation system implements Requirements 3.1, 3.2, 3.3, and 3.5 from the environment detection specification:

- **3.1**: Add validation that production environments use production URLs
- **3.2**: Ensure NEXT_PUBLIC_SUPABASE_URL takes priority over hardcoded URLs  
- **3.3**: Implement URL pattern-based environment detection
- **3.5**: Add logging for frontend client initialization URLs

## Key Components

### 1. Frontend Client Validation Module (`packages/common/frontend-client-validation.ts`)

Core validation functions:
- `getFrontendClientUrls()` - Gets URLs with proper priority handling
- `validateFrontendClientUrls()` - Validates URLs for environment appropriateness
- `validateFrontendEnvironmentVariables()` - Validates environment variable configuration
- `createValidatedClientConfig()` - Creates validated client configuration
- `logFrontendClientInitialization()` - Comprehensive initialization logging

### 2. Frontend Client Helpers (`apps/studio/lib/frontend-client-helpers.ts`)

Application-specific helpers:
- `createValidatedSupabaseClient()` - Creates validated Supabase clients
- `validateCurrentFrontendConfig()` - Validates current configuration
- `performFrontendHealthCheck()` - Health check with network tests
- `getFrontendSetupRecommendations()` - Environment-specific setup guidance

### 3. Supabase Client Factory (`apps/studio/lib/supabase-client-factory.ts`)

Centralized client creation:
- `getSupabaseClient()` - Default validated client
- `createCustomSupabaseClient()` - Custom configuration client
- `createAdminSupabaseClient()` - Admin/service role client
- `createSupportSupabaseClient()` - Support operations client

## URL Priority System

The system implements a strict priority order for Supabase URLs:

1. **NEXT_PUBLIC_SUPABASE_URL** (Priority 1) - Highest priority for frontend clients
2. **SUPABASE_PUBLIC_URL** (Priority 2) - Fallback for public URLs
3. **SUPABASE_URL** (Priority 3) - General Supabase URL
4. **Hardcoded localhost** (Priority 4) - Development fallback

This ensures that `NEXT_PUBLIC_SUPABASE_URL` always takes precedence over hardcoded URLs, satisfying Requirement 3.2.

## Environment Detection

The system detects environments based on URL patterns:

### Production Detection
- HTTPS URLs (e.g., `https://project.supabase.co`)
- External IP addresses (e.g., `http://192.168.1.100`)
- Domain names (e.g., `http://api.example.com`)

### Development Detection  
- Localhost patterns (`localhost`, `127.0.0.1`, `0.0.0.0`)
- Development ports (54321, 8000, 3000, etc.)
- When explicit environment variables are set

### Staging Detection
- Staging patterns in URLs (`staging`, `stg`, `test`, `dev-`, `preview`)

## Validation Rules

### Production Environment (Requirement 3.1)
- ❌ **CRITICAL ERROR**: Localhost URLs in production
- ⚠️ **WARNING**: Development ports in production URLs
- ⚠️ **WARNING**: HTTP instead of HTTPS in production
- ⚠️ **WARNING**: IP addresses instead of domain names

### Development Environment
- ✅ **EXPECTED**: Localhost URLs
- ⚠️ **WARNING**: Non-localhost URLs (may be intentional)
- ⚠️ **WARNING**: HTTPS with localhost (certificate issues)

### Staging Environment
- ⚠️ **WARNING**: URLs without staging patterns
- ✅ **EXPECTED**: Staging-specific URLs

## Comprehensive Logging (Requirement 3.5)

The system provides detailed logging for frontend client initialization:

```typescript
[Frontend Client] 🚀 Supabase client initialization at 2025-12-07T15:19:10.158Z
[Frontend Client] Environment: PRODUCTION
[Frontend Client] === CLIENT CONFIGURATION ===
[Frontend Client] Supabase URL: https://my-project.supabase.co
[Frontend Client]   Source: NEXT_PUBLIC_SUPABASE_URL (priority 1)
[Frontend Client] GoTrue URL: https://my-project.supabase.co/auth/v1
[Frontend Client]   Source: derived-from-supabase (priority 2)
[Frontend Client] API Key: abcd...xyz (masked)
[Frontend Client]   Source: NEXT_PUBLIC_SUPABASE_ANON_KEY (priority 1)
```

## Integration with Auth System

The validation system is integrated into the main auth provider (`apps/studio/lib/auth.tsx`):

- Validates runtime configuration URLs
- Provides critical error handling for production-localhost mismatches
- Shows user-facing errors for critical production issues
- Logs comprehensive setup information for debugging

## Updated Client Creation

Several files were updated to use the validated client creation:

- `apps/studio/lib/upload.ts` - Uses `createSupportSupabaseClient()`
- `apps/studio/pages/api/generate-attachment-url.ts` - Uses validated support client
- `apps/studio/pages/api/ai/docs.ts` - Uses `createValidatedSupabaseClient()`
- `apps/studio/components/interfaces/Support/support-storage-client.ts` - Uses factory

## Usage Examples

### Basic Client Creation
```typescript
import { getSupabaseClient } from 'lib/supabase-client-factory'

const client = getSupabaseClient() // Automatically validated
```

### Custom Configuration
```typescript
import { createValidatedSupabaseClient } from 'lib/frontend-client-helpers'

const client = createValidatedSupabaseClient({
  supabaseUrl: 'https://custom.supabase.co',
  anonKey: 'custom-key',
})
```

### Configuration Validation
```typescript
import { validateCurrentFrontendConfig } from 'lib/frontend-client-helpers'

const validation = validateCurrentFrontendConfig()
if (!validation.isValid) {
  console.error('Configuration issues:', validation.summary)
}
```

## Testing

Comprehensive tests are provided in `apps/studio/tests/lib/frontend-client-validation.test.ts`:

- URL priority system testing
- Environment detection testing  
- Validation rule testing
- Error condition testing
- Configuration creation testing

## Demo Script

A demonstration script is available at `apps/studio/scripts/demo-frontend-validation.ts` that shows:

- Production environment validation
- Development environment validation
- Error cases (production with localhost)
- URL priority system
- Initialization logging

## Benefits

1. **Production Safety**: Prevents localhost URLs in production deployments
2. **Clear Priority**: NEXT_PUBLIC_SUPABASE_URL always takes precedence
3. **Environment Awareness**: Automatic environment detection from URL patterns
4. **Comprehensive Logging**: Detailed initialization and validation logging
5. **Developer Experience**: Clear error messages and setup recommendations
6. **Centralized Management**: Single source of truth for client creation

## Error Handling

The system provides specific error messages and recommendations:

- **Production-localhost mismatch**: Critical errors with specific fix instructions
- **Missing environment variables**: Recommendations for required variables
- **Invalid URL formats**: Clear validation error messages
- **Environment-specific guidance**: Tailored recommendations per environment

This implementation ensures that frontend clients are properly configured, validated, and logged according to the environment detection requirements.