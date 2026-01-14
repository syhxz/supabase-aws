# SSL Configuration Management

This document describes the SSL configuration management system implemented for project database connections in Supabase Studio.

## Overview

The SSL configuration management system provides comprehensive support for optional SSL connections to project databases with:

- **Optional SSL Support**: SSL is not required by default, preventing connection failures when SSL is not supported
- **Project-Specific Configuration**: Each project can have its own SSL settings
- **Multiple Configuration Sources**: SSL can be configured via connection strings, environment variables, or project metadata
- **Enhanced Error Handling**: Comprehensive SSL error detection, categorization, and recovery
- **Comprehensive Logging**: Detailed SSL error logging for debugging and monitoring

## Requirements Addressed

This implementation addresses the following requirements:

- **10.3, 10.4**: Project-specific SSL configuration support
- **12.1**: SSL configuration parsing and validation
- **12.2**: Project-specific SSL settings management
- **12.3**: SSL verification and certificate handling
- **12.4**: SSL error handling and logging
- **12.5**: Comprehensive SSL error logging

## Architecture

### Core Components

1. **SSL Types** (`ssl-types.ts`): Type definitions for SSL configuration
2. **SSL Error Handler** (`ssl-error-handler.ts`): SSL error detection, categorization, and handling
3. **Project Database Client** (`project-database-client.ts`): Enhanced with SSL support
4. **SSL Configuration API** (`ssl-config.ts`): API endpoints for SSL management

### SSL Configuration Sources (Priority Order)

1. **Project-specific SSL configuration** (`project.ssl_config`)
2. **Connection string SSL parameters** (`sslmode`, `sslcert`, etc.)
3. **Project-specific environment variables** (`PROJECT_{REF}_SSL_MODE`)
4. **Global environment variables** (`POSTGRES_SSL_MODE`, `DATABASE_SSL_MODE`)
5. **Default behavior** (SSL disabled to prevent connection failures)

## SSL Modes Supported

| Mode | Description | Security Level |
|------|-------------|----------------|
| `disable` | No SSL connection | None |
| `allow` | SSL if available, fallback to non-SSL | Low |
| `prefer` | Prefer SSL, fallback to non-SSL | Medium |
| `require` | Require SSL, accept any certificate | Medium-High |
| `verify-ca` | Require SSL with CA verification | High |
| `verify-full` | Require SSL with full certificate verification | Highest |

## Configuration Examples

### Environment Variables

```bash
# Global SSL configuration
POSTGRES_SSL_MODE=prefer
DATABASE_SSL_MODE=require

# Project-specific SSL configuration
PROJECT_MYPROJECT_SSL_MODE=verify-ca

# SSL certificate configuration
POSTGRES_SSL_CA_CERT=/path/to/ca-cert.pem
```

### Connection String

```
postgresql://user:password@host:5432/database?sslmode=require
postgresql://user:password@host:5432/database?sslmode=verify-ca&sslcert=/path/to/client.crt&sslkey=/path/to/client.key
```

### Project Metadata

```typescript
interface ProjectMetadata {
  // ... other fields
  ssl_config?: {
    enabled: boolean
    rejectUnauthorized?: boolean
    ca?: string
    cert?: string
    key?: string
    mode?: 'require' | 'prefer' | 'disable' | 'verify-ca' | 'verify-full'
  }
}
```

## API Endpoints

### GET `/api/v1/projects/[ref]/ssl-config`

Get current SSL configuration for a project.

**Response:**
```json
{
  "projectRef": "project-ref",
  "currentConfig": {
    "enabled": true,
    "mode": "require",
    "source": "connection_string",
    "details": {
      "rejectUnauthorized": true
    }
  },
  "recommendations": {
    "recommended": "verify-full",
    "alternatives": ["verify-ca", "require"],
    "reasoning": "Production environments should use the highest level of SSL security"
  },
  "environment": "production",
  "connectionSource": "connection_string"
}
```

### PUT `/api/v1/projects/[ref]/ssl-config`

Update SSL configuration for a project.

**Request:**
```json
{
  "sslConfig": {
    "enabled": true,
    "mode": "verify-ca",
    "rejectUnauthorized": true
  }
}
```

**Response:**
```json
{
  "projectRef": "project-ref",
  "requestedConfig": { /* ... */ },
  "validation": {
    "isValid": true,
    "sslEnabled": true,
    "errors": [],
    "warnings": []
  },
  "appliedSuccessfully": false,
  "message": "SSL configuration validated successfully. For self-hosted deployments, you may need to update your database configuration or environment variables to apply these settings.",
  "nextSteps": [
    "Update your database server SSL configuration if needed",
    "Set appropriate environment variables (POSTGRES_SSL_MODE, etc.)",
    "Restart the application if SSL mode changes require it",
    "Test the connection using the test endpoint"
  ]
}
```

### POST `/api/v1/projects/[ref]/ssl-config`

Test SSL connection for a project.

**Request:**
```json
{
  "sslMode": "require"  // Optional: test specific SSL mode
}
```

**Response:**
```json
{
  "projectRef": "project-ref",
  "testResult": {
    "success": true,
    "sslEnabled": true,
    "sslMode": "require",
    "connectionTime": 150,
    "fallbackUsed": false
  },
  "timestamp": "2026-01-12T15:41:27.806Z",
  "testedMode": "require"
}
```

## Error Handling

### SSL Error Categories

1. **Certificate Errors**:
   - `SELF_SIGNED_CERT`: Self-signed certificate
   - `CERT_EXPIRED`: Certificate has expired
   - `CERT_VERIFY_FAILED`: Certificate verification failed
   - `CERT_HOSTNAME_MISMATCH`: Hostname doesn't match certificate

2. **Connection Errors**:
   - `SSL_NOT_SUPPORTED`: Server doesn't support SSL
   - `SSL_CONNECTION_ERROR`: SSL connection failed
   - `SSL_CONNECTION_FAILED`: General SSL connection failure

3. **Protocol Errors**:
   - `SSL_PROTOCOL_ERROR`: SSL protocol negotiation failed

### Error Recovery

The system implements automatic error recovery:

1. **SSL Error Detection**: Automatically detect SSL-related errors
2. **Fallback Mechanism**: Attempt connection without SSL if SSL fails
3. **Error Logging**: Comprehensive logging with context
4. **User Guidance**: Provide specific suggestions based on error type

### Example Error Response

```json
{
  "success": false,
  "error": {
    "code": "SSL_NOT_SUPPORTED",
    "message": "The database server does not support SSL connections",
    "suggestions": [
      "Try connecting without SSL by setting sslmode to \"disable\"",
      "Contact your database administrator to enable SSL support"
    ]
  }
}
```

## Environment-Specific Recommendations

### Production
- **Recommended**: `verify-full`
- **Alternatives**: `verify-ca`, `require`
- **Reasoning**: Production environments should use the highest level of SSL security

### Development
- **Recommended**: `prefer`
- **Alternatives**: `require`, `disable`
- **Reasoning**: Development environments can use prefer mode to allow SSL when available but fallback to non-SSL

### Test
- **Recommended**: `disable`
- **Alternatives**: `prefer`, `require`
- **Reasoning**: Test environments typically prioritize speed and simplicity over SSL security

## Logging

### SSL Error Logging

All SSL errors are logged with comprehensive context:

```json
{
  "timestamp": "2026-01-12T15:41:27.806Z",
  "level": "error",
  "category": "ssl_connection",
  "projectRef": "project-ref",
  "errorCode": "SSL_NOT_SUPPORTED",
  "errorMessage": "server does not support ssl",
  "sslMode": "require",
  "connectionAttempt": 1,
  "fallbackAttempted": false,
  "certificateIssue": false,
  "connectionRefused": true
}
```

### SSL Configuration Logging

SSL configuration changes and validations are logged:

```json
{
  "timestamp": "2026-01-12T15:41:27.806Z",
  "level": "warning",
  "category": "ssl_config_validation",
  "projectRef": "project-ref",
  "errors": ["Invalid SSL mode: unknown"],
  "warnings": [],
  "fallbackToDefault": true
}
```

## Testing

The SSL configuration system includes comprehensive tests covering:

- SSL error detection and categorization
- SSL configuration validation
- Error response generation
- SSL recommendations
- Configuration logging

Run tests with:
```bash
npm test ssl-configuration.test.ts
```

## Best Practices

1. **Use Environment-Appropriate SSL Modes**: Follow the environment-specific recommendations
2. **Test SSL Configuration**: Use the test endpoint to verify SSL settings
3. **Monitor SSL Errors**: Review SSL error logs regularly
4. **Certificate Management**: Keep SSL certificates up to date
5. **Fallback Strategy**: Always have a fallback plan for SSL connection failures

## Troubleshooting

### Common Issues

1. **SSL Not Supported**: Database server doesn't support SSL
   - **Solution**: Use `sslmode=disable` or enable SSL on the database server

2. **Certificate Verification Failed**: SSL certificate issues
   - **Solution**: Check certificate validity, CA configuration, or use `sslmode=require`

3. **Connection Timeout**: SSL handshake timeout
   - **Solution**: Check network connectivity, firewall settings, or SSL configuration

### Debug Information

Use the connection info endpoint to get debug information:
```bash
GET /api/v1/projects/[ref]/connection-info
```

This returns sanitized connection information including SSL configuration source and status.