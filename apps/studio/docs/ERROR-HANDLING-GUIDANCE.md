# Error Handling and User Guidance System

This document describes the comprehensive error handling and user guidance system implemented for environment detection and configuration validation.

## Overview

The error handling and user guidance system implements Requirements 4.1, 4.2, 4.3, 4.4, and 4.5 from the environment detection specification:

- **4.1**: Fallback recommendation logging with specific configuration fixes
- **4.2**: Production-localhost mismatch error logging with critical error handling
- **4.3**: Development-production mismatch warnings for potential misconfigurations
- **4.4**: Configuration validation with helpful examples of correct environment variables
- **4.5**: URL validation failure recommendations with specific fix guidance

## Key Components

### 1. Error Handling and Guidance Module (`packages/common/error-handling-guidance.ts`)

Core error generation and analysis functions:
- `generateFallbackRecommendations()` - Fallback configuration guidance
- `generateProductionLocalhostError()` - Critical production-localhost mismatch errors
- `generateDevelopmentProductionMismatch()` - Environment mismatch warnings
- `generateConfigurationValidationError()` - Missing variable validation with examples
- `generateUrlValidationError()` - URL format validation recommendations
- `generateDockerBuildVariableError()` - Docker build-time variable issues
- `analyzeEnvironmentForErrors()` - Comprehensive environment analysis
- `generateTroubleshootingGuide()` - Environment-specific troubleshooting

### 2. Configuration Validation Service (`apps/studio/lib/configuration-validation-service.ts`)

Comprehensive validation orchestration:
- `validateConfiguration()` - Full configuration validation with error analysis
- `logValidationResults()` - Detailed validation result logging
- `validateConfigurationOrThrow()` - Validation with error throwing for critical issues
- `quickHealthCheck()` - Fast configuration health assessment

### 3. Configuration Health API (`apps/studio/pages/api/configuration-health.ts`)

HTTP API for configuration validation:
- `GET /api/configuration-health` - Quick health check with optional detailed validation
- `POST /api/configuration-health` - Custom validation with parameters
- Returns comprehensive health status and troubleshooting guidance

## Error Types and Severity Levels

### Error Types
- `missing-environment-variables` - Required environment variables not set
- `production-localhost-mismatch` - Localhost URLs in production environment
- `development-production-mismatch` - Environment detection mismatch
- `invalid-url-format` - Malformed or inappropriate URLs
- `fallback-configuration-used` - System using fallback configuration
- `environment-variable-conflict` - Conflicting environment variable values
- `docker-build-variable-missing` - Missing variables during Docker build
- `network-configuration-error` - Network connectivity or configuration issues

### Severity Levels
- **Critical**: Prevents application operation, requires immediate action
- **Error**: Causes functionality issues, needs to be fixed
- **Warning**: Potential issues, should be addressed
- **Info**: Informational messages, no action required

## Comprehensive Error Analysis

### Production-Localhost Mismatch (Requirement 4.2)

**Detection**: Production environment with localhost URLs
**Severity**: Critical
**Impact**: Complete application failure in production

```typescript
// Example error generation
const error = generateProductionLocalhostError(
  ['http://localhost:54321', 'http://localhost:54321/auth/v1'],
  context
)

// Provides:
// - Critical error classification
// - Specific affected URLs
// - Immediate action recommendations
// - Environment variable examples
// - Docker configuration examples
// - Configuration file templates
```

**Recommendations Provided**:
- 🚨 IMMEDIATE ACTION REQUIRED - Production deployment will fail
- Set SUPABASE_PUBLIC_URL to production Supabase URL
- Set API_EXTERNAL_URL to production API gateway URL
- Set NEXT_PUBLIC_SUPABASE_URL for frontend clients
- Verify URLs are accessible from production network
- Never use localhost, 127.0.0.1, or 0.0.0.0 in production

### Fallback Configuration Recommendations (Requirement 4.1)

**Detection**: System using fallback configuration sources
**Severity**: Warning to Critical (depending on fallback type)

```typescript
// Example fallback scenarios
const buildTimeFallback = generateFallbackRecommendations('build-time', context)
const cachedFallback = generateFallbackRecommendations('cached', context)
const emergencyFallback = generateFallbackRecommendations('emergency-defaults', context)
```

**Fallback Types**:
1. **Build-time**: Runtime config failed, using build-time variables
2. **Cached**: Using cached configuration from previous session
3. **Emergency Defaults**: All sources failed, using hardcoded defaults (CRITICAL)

### Configuration Validation with Examples (Requirement 4.4)

**Detection**: Missing or invalid environment variables
**Provides**: Environment-specific examples and guidance

```typescript
// Production examples
{
  'ENVIRONMENT': 'production',
  'SUPABASE_PUBLIC_URL': 'https://your-project.supabase.co',
  'API_EXTERNAL_URL': 'https://api.yourcompany.com',
  'NEXT_PUBLIC_SUPABASE_URL': 'https://your-project.supabase.co',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY': 'eyJhbGciOiJIUzI1NiIs...'
}

// Development examples
{
  'ENVIRONMENT': 'development',
  'SUPABASE_PUBLIC_URL': 'http://127.0.0.1:54321',
  'API_EXTERNAL_URL': 'http://127.0.0.1:8000',
  'NEXT_PUBLIC_SUPABASE_URL': 'http://127.0.0.1:54321'
}
```

### URL Validation Recommendations (Requirement 4.5)

**Detection**: Invalid URL formats or inappropriate URLs for environment
**Provides**: Specific URL format guidance and connectivity testing

```typescript
// Example recommendations
- 'Ensure all URLs use valid HTTP or HTTPS protocols'
- 'Verify URLs are accessible from your deployment environment'
- 'Use appropriate URLs for your environment (localhost for dev, domains for prod)'
- 'Test URL connectivity before deployment'
- 'Follow URL format: protocol://hostname:port/path'
```

## Environment-Specific Troubleshooting Guides

### Production Environment
```typescript
{
  title: 'Production Environment Troubleshooting',
  commonIssues: [
    'Localhost URLs in production configuration',
    'Missing or incorrect environment variables',
    'Network connectivity issues to external services',
    'SSL/TLS certificate problems',
    'Incorrect API keys or authentication tokens'
  ],
  diagnosticCommands: [
    'curl -f $SUPABASE_PUBLIC_URL/rest/v1/',
    'nslookup your-project.supabase.co',
    'docker logs your-container-name',
    'kubectl logs deployment/your-app'
  ],
  quickFixes: [
    'Set ENVIRONMENT=production explicitly',
    'Update SUPABASE_PUBLIC_URL to production URL',
    'Verify API_EXTERNAL_URL points to production gateway',
    'Check NEXT_PUBLIC_SUPABASE_URL for frontend clients'
  ]
}
```

### Development Environment
```typescript
{
  title: 'Development Environment Troubleshooting',
  commonIssues: [
    'Local Supabase services not running',
    'Port conflicts (54321, 8000 already in use)',
    'Docker containers not started',
    'Environment variables not loaded'
  ],
  diagnosticCommands: [
    'docker-compose ps',
    'curl -f http://127.0.0.1:54321/rest/v1/',
    'netstat -tulpn | grep -E "(54321|8000)"'
  ],
  quickFixes: [
    'Run docker-compose up -d to start services',
    'Check if ports 54321 and 8000 are available',
    'Set NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321'
  ]
}
```

## Integration Points

### Auth System Integration
The error handling system is integrated into the main auth provider:

```typescript
// Enhanced error handling in auth.tsx
const configValidation = validateConfiguration({
  includeFrontend: true,
  includeDockerChecks: true,
  logResults: true,
  customUrls: { supabaseUrl, gotrueUrl, apiUrl }
})

// Critical error handling
if (configValidation.criticalErrors.length > 0) {
  toast.error('Critical Configuration Error', {
    description: `${configValidation.criticalErrors.length} critical issues detected`,
    action: { label: 'View Guide', onClick: () => showTroubleshootingGuide() }
  })
}
```

### Runtime Config API Integration
The runtime config API includes comprehensive error analysis:

```typescript
// Enhanced error analysis in runtime-config.ts
const configErrors = analyzeEnvironmentForErrors(envInfo, { supabaseUrl, gotrueUrl, apiUrl })

if (configErrors.length > 0) {
  const criticalErrors = configErrors.filter(e => e.severity === 'critical')
  if (criticalErrors.length > 0) {
    console.error(`🚨 CRITICAL: ${criticalErrors.length} critical configuration errors`)
  }
}
```

### Environment Detection Integration
Environment detection automatically analyzes for errors:

```typescript
// Automatic error analysis in environment-detection.ts
const errors = analyzeEnvironmentForErrors(envInfo, urls)
if (errors.length > 0) {
  errors.forEach(error => logConfigurationError(error, context))
}
```

## API Usage

### Configuration Health Check
```bash
# Quick health check
curl http://localhost:3000/api/configuration-health

# Detailed validation with troubleshooting
curl "http://localhost:3000/api/configuration-health?detailed=true&troubleshooting=true"

# Custom validation
curl -X POST http://localhost:3000/api/configuration-health \
  -H "Content-Type: application/json" \
  -d '{
    "includeFrontend": true,
    "includeDockerChecks": true,
    "customUrls": {
      "supabaseUrl": "https://test.supabase.co"
    }
  }'
```

### Response Format
```typescript
{
  "isHealthy": false,
  "summary": "🚨 Configuration has 1 critical errors that prevent operation",
  "environment": "production",
  "timestamp": "2025-12-07T15:30:00.000Z",
  "quickCheck": {
    "isHealthy": false,
    "summary": "Critical configuration issues detected",
    "criticalIssues": 1,
    "recommendations": [
      "🚨 IMMEDIATE ACTION REQUIRED - Production deployment will fail",
      "Set SUPABASE_PUBLIC_URL to your production Supabase URL",
      "Set API_EXTERNAL_URL to your production API gateway URL"
    ]
  },
  "troubleshootingGuide": {
    "title": "Production Environment Troubleshooting",
    "commonIssues": [...],
    "diagnosticCommands": [...],
    "quickFixes": [...]
  }
}
```

## Testing

Comprehensive tests are provided in `apps/studio/tests/lib/error-handling-guidance.test.ts`:

- Error generation testing for all error types
- Severity level validation
- Recommendation content verification
- Environment-specific guidance testing
- Integration with environment detection testing

## Demo Scripts

### Error Handling Demo
`apps/studio/scripts/demo-error-handling.ts` demonstrates:
- Production-localhost mismatch errors
- Fallback configuration recommendations
- Missing variable validation
- Environment-specific troubleshooting guides
- Comprehensive configuration validation
- Quick health check functionality

## Benefits

1. **Proactive Error Detection**: Identifies configuration issues before they cause failures
2. **Actionable Guidance**: Provides specific, actionable recommendations for each error type
3. **Environment Awareness**: Tailored guidance for production, development, and staging environments
4. **Comprehensive Examples**: Includes environment variables, Docker commands, and configuration files
5. **Severity Classification**: Prioritizes critical issues that prevent operation
6. **Integration Ready**: Seamlessly integrates with existing auth and configuration systems
7. **API Accessible**: Programmatic access via HTTP API for monitoring and automation
8. **Developer Experience**: Clear, helpful error messages with step-by-step fix instructions

## Error Prevention

The system helps prevent common configuration issues:

- **Production Safety**: Prevents localhost URLs in production deployments
- **Docker Build Issues**: Identifies missing build-time environment variables
- **Environment Mismatches**: Detects when detected environment doesn't match expected
- **URL Validation**: Ensures URLs are properly formatted and appropriate for environment
- **Fallback Awareness**: Alerts when system is using fallback configuration

This comprehensive error handling and user guidance system ensures that configuration issues are detected early, clearly communicated, and provide actionable guidance for resolution.