# Configuration Health Checks

This document describes the configuration health check system implemented in Supabase Studio.

## Overview

The configuration health check system validates that:
1. Runtime configuration is available and valid
2. GoTrue authentication service is reachable
3. API gateway is reachable
4. All services respond within acceptable timeouts

## Components

### Health Check Module (`lib/config-health.ts`)

The core health check functionality is provided by the `performConfigHealthCheck()` function:

```typescript
import { performConfigHealthCheck } from 'lib/config-health'

const healthResult = await performConfigHealthCheck()
console.log('System healthy:', healthResult.healthy)
```

### Health Check API Endpoint (`/api/health`)

A REST API endpoint is available for external health checks:

```bash
# Check system health
curl http://localhost:3000/api/health

# Response format
{
  "healthy": true,
  "timestamp": "2024-12-05T11:30:00.000Z",
  "checks": {
    "runtimeConfig": { "healthy": true, "responseTime": 50 },
    "gotrue": { "healthy": true, "url": "...", "responseTime": 100 },
    "apiGateway": { "healthy": true, "url": "...", "responseTime": 75 }
  },
  "config": {
    "environment": "production",
    "source": "explicit",
    "gotrueUrl": "https://api.example.com/auth/v1",
    "supabaseUrl": "https://api.example.com",
    "apiUrl": "https://api.example.com"
  },
  "errors": [],
  "warnings": []
}
```

### Application Integration (`pages/_app.tsx`)

Health checks are automatically performed during application startup:

1. Runtime configuration is fetched
2. Health checks are performed on all services
3. Warnings are displayed to users if issues are detected
4. Application continues to work with fallback configuration if needed

## Health Check Results

### Healthy System
- Status Code: `200`
- All checks pass
- No errors or warnings

### Unhealthy System
- Status Code: `503`
- One or more checks fail
- Errors and warnings are provided
- Troubleshooting suggestions included

### System Error
- Status Code: `500`
- Health check system itself failed
- Fallback error information provided

## Error Handling

The health check system provides detailed error information:

```typescript
interface ConfigHealthResult {
  healthy: boolean
  checks: {
    runtimeConfigAvailable: HealthCheck
    gotrueReachable: HealthCheck
    apiGatewayReachable: HealthCheck
  }
  errors: string[]      // Critical issues
  warnings: string[]    // Non-critical issues
  timestamp: number
  config?: RuntimeConfig
}
```

### Common Issues

1. **Runtime Configuration Unavailable**
   - Cause: API endpoint not responding
   - Solution: Check server logs, verify environment variables

2. **GoTrue Service Unreachable**
   - Cause: Network connectivity or service down
   - Solution: Verify GoTrue URL, check network connectivity

3. **API Gateway Unreachable**
   - Cause: Network connectivity or gateway down
   - Solution: Verify API URL, check network connectivity

4. **Localhost URLs in Production**
   - Cause: Using development defaults in production
   - Solution: Set proper environment variables

## Usage Examples

### Programmatic Health Check

```typescript
import { performConfigHealthCheck, getHealthCheckErrorMessage } from 'lib/config-health'

async function checkSystemHealth() {
  try {
    const result = await performConfigHealthCheck()
    
    if (result.healthy) {
      console.log('✅ System is healthy')
    } else {
      console.warn('⚠️ System has issues:')
      console.warn(getHealthCheckErrorMessage(result))
    }
  } catch (error) {
    console.error('❌ Health check failed:', error)
  }
}
```

### Quick Health Check

```typescript
import { quickHealthCheck } from 'lib/config-health'

// Lightweight check (runtime config only)
const isConfigAvailable = await quickHealthCheck()
```

### Health Check Formatting

```typescript
import { formatHealthCheckResult } from 'lib/config-health'

const result = await performConfigHealthCheck()
console.log(formatHealthCheckResult(result))
```

## Monitoring Integration

The health check endpoint can be used with:

- **Load Balancers**: Configure health checks on `/api/health`
- **Monitoring Systems**: Poll the endpoint for system status
- **Docker Health Checks**: Use in Dockerfile HEALTHCHECK directive
- **Kubernetes**: Configure readiness and liveness probes

### Docker Health Check Example

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1
```

### Kubernetes Probe Example

```yaml
livenessProbe:
  httpGet:
    path: /api/health
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10
readinessProbe:
  httpGet:
    path: /api/health
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5
```

## Configuration

Health checks can be configured through environment variables:

- `HEALTH_CHECK_TIMEOUT`: Timeout for service checks (default: 5000ms)
- `HEALTH_CHECK_ENABLED`: Enable/disable health checks (default: true)

## Troubleshooting

### Health Check Timeouts

If health checks are timing out:

1. Check network connectivity to services
2. Verify service URLs are correct
3. Increase timeout if services are slow
4. Check firewall rules

### False Positives

If health checks report failures but services work:

1. Verify health check endpoints exist
2. Check service authentication requirements
3. Review network routing
4. Check service logs for errors

### Performance Impact

Health checks are designed to be lightweight:

- Runtime config check: ~50ms
- Service reachability: ~100ms per service
- Total overhead: ~250ms during startup
- Cached results prevent repeated checks

## Requirements Addressed

This implementation addresses the following requirements:

- **Requirement 3.1**: Invalid environment variables return error responses with details
- **Requirement 3.3**: Failed API requests log attempted URLs for debugging
- **Requirement 3.4**: Successful configuration loads are logged for verification

The health check system ensures early detection of configuration issues and provides comprehensive troubleshooting information to system administrators.