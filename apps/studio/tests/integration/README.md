# Integration Tests

This directory contains end-to-end integration tests that verify complete system behavior across multiple components.

## Runtime Configuration Integration Tests

**File:** `runtime-config-e2e.test.ts`

Comprehensive integration tests for the runtime configuration system covering:

### Test Coverage

#### 1. End-to-End Configuration Flow in Production Mode
- ✅ Load production configuration from environment variables on startup (Requirement 1.1)
- ✅ Use production URLs for all API requests (Requirement 1.2)
- ✅ Return correct URLs from runtime config API (Requirement 1.3)
- ✅ Fetch runtime config before making API requests (Requirement 1.5)

#### 2. Environment Switching (dev/staging/prod)
- ✅ Use development URLs in development environment (Requirement 4.2)
- ✅ Use staging URLs in staging environment
- ✅ Use production URLs in production environment (Requirement 4.1)
- ✅ Adapt to environment-specific configuration without code changes (Requirement 2.2)

#### 3. Configuration Updates with Container Restart
- ✅ Use new URLs after container restart without rebuild (Requirement 1.4)
- ✅ Clear cached config on container restart
- ✅ Handle environment variable changes across restarts

#### 4. Error Recovery and Fallback Behavior
- ✅ Fall back to defaults when runtime config fetch fails
- ✅ Handle invalid environment variable values gracefully
- ✅ Recover from errors on subsequent requests
- ✅ Use fallback chain: runtime → explicit → derived → default
- ✅ Handle missing environment variables with warnings

#### 5. Production URL Validation
- ✅ Never use localhost URLs in production environment
- ✅ Validate all URLs use http or https protocol
- ✅ Reject non-http/https protocols
- ✅ Ensure production config uses HTTPS in production
- ✅ Validate production URLs are publicly accessible

#### 6. Complete Integration Scenarios
- ✅ Handle complete production deployment flow
- ✅ Handle environment migration scenario (staging → production)
- ✅ Handle configuration refresh during runtime

### Running the Tests

```bash
# Run all integration tests
pnpm vitest run tests/integration/

# Run only runtime config integration tests
pnpm vitest run tests/integration/runtime-config-e2e.test.ts

# Run with watch mode
pnpm vitest tests/integration/runtime-config-e2e.test.ts
```

### Test Results

All 24 integration tests pass successfully, validating:
- Production mode configuration flow
- Environment switching capabilities
- Container restart behavior
- Error recovery mechanisms
- Production URL validation
- Complete deployment scenarios

### Requirements Validated

These integration tests validate the following requirements from the spec:
- **1.1**: Load API URLs from runtime environment variables
- **1.2**: Use production API gateway URL instead of localhost
- **1.3**: Runtime configuration API returns correct production URLs
- **1.4**: Use new URLs after restart without rebuild
- **2.2**: Same Docker image adapts to different environments
- **4.1**: Direct all requests to production API gateway
- **4.2**: Use localhost in development

### Key Features Tested

1. **Production Safety**: Ensures no localhost URLs are used in production
2. **Environment Portability**: Same Docker image works across dev/staging/prod
3. **Runtime Flexibility**: Configuration updates without rebuilds
4. **Error Resilience**: Graceful fallback to defaults when config fails
5. **URL Validation**: Strict validation of URL formats and protocols
6. **Complete Workflows**: End-to-end deployment and migration scenarios
