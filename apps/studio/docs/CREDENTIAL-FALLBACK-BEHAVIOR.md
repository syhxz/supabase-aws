# Credential Fallback Behavior Documentation

## Overview

This document describes the credential fallback mechanism implemented in Supabase Studio to handle projects with missing or incomplete database credentials. The fallback system ensures continuous database connectivity while providing a migration path for legacy projects.

## Fallback Mechanism

### When Fallback is Used

The system uses fallback credentials in the following scenarios:

1. **Missing Database User**: When `database_user` field is null or empty
2. **Missing Database Password**: When `database_password_hash` field is null or empty
3. **Both Credentials Missing**: When both fields are null or empty
4. **Legacy Projects**: Projects created before credential fields were implemented

### Fallback Resolution Logic

```typescript
function shouldUseFallback(credentials: Partial<ProjectCredentials>): boolean {
  return !credentials.user || !credentials.passwordHash || 
         credentials.user.trim() === '' || credentials.passwordHash.trim() === '';
}
```

### Credential Source Priority

1. **Primary**: Project-specific credentials (`database_user`, `database_password_hash`)
2. **Fallback**: Environment-based system credentials (`POSTGRES_USER`, `POSTGRES_PASSWORD`)

## Implementation Details

### Credential Fallback Manager

The `CredentialFallbackManager` class handles all fallback logic:

```typescript
interface CredentialFallbackManager {
  getProjectCredentials(projectRef: string): ProjectCredentials
  getFallbackCredentials(readOnly?: boolean): SystemCredentials
  shouldUseFallback(credentials: Partial<ProjectCredentials>): boolean
  logFallbackUsage(projectRef: string, reason: string): void
}
```

### Connection String Generation

Enhanced connection string generation with fallback support:

```typescript
interface ConnectionStringResult {
  connectionString: string
  usedFallback: boolean
  fallbackReason?: string
}
```

## Fallback Scenarios

### Scenario 1: Complete Missing Credentials

**Condition**: Both `database_user` and `database_password_hash` are null

**Behavior**:
- Uses `POSTGRES_USER` from environment
- Uses `POSTGRES_PASSWORD` from environment
- Logs fallback usage with reason "missing_both"
- Returns connection string with fallback credentials

**Example**:
```json
{
  "project_ref": "abc123",
  "database_user": null,
  "database_password_hash": null
}
```

**Result**:
```json
{
  "connectionString": "postgresql://postgres:password@host:5432/postgres",
  "usedFallback": true,
  "fallbackReason": "missing_both"
}
```

### Scenario 2: Missing User Only

**Condition**: `database_user` is null, `database_password_hash` exists

**Behavior**:
- Uses `POSTGRES_USER` from environment
- Uses project's `database_password_hash` (if valid)
- Logs fallback usage with reason "missing_user"

### Scenario 3: Missing Password Only

**Condition**: `database_user` exists, `database_password_hash` is null

**Behavior**:
- Uses project's `database_user`
- Uses `POSTGRES_PASSWORD` from environment
- Logs fallback usage with reason "missing_password"

### Scenario 4: Empty String Values

**Condition**: Credentials exist but are empty strings

**Behavior**:
- Treats empty strings as missing credentials
- Applies same fallback logic as null values
- Logs fallback usage with reason "empty_credentials"

## Environment Configuration

### Required Environment Variables

```bash
# Primary database credentials (used as fallback)
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=postgres

# Fallback behavior configuration
CREDENTIAL_FALLBACK_ENABLED=true
FALLBACK_LOGGING_ENABLED=true
```

### Optional Configuration

```bash
# Read-only fallback credentials (if different)
POSTGRES_READONLY_USER=readonly_user
POSTGRES_READONLY_PASSWORD=readonly_password

# Fallback behavior tuning
FALLBACK_CACHE_TTL=300
FALLBACK_RETRY_ATTEMPTS=3
```

## Logging and Monitoring

### Fallback Usage Logging

Every fallback usage is logged with the following information:

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "project_ref": "abc123",
  "event_type": "fallback_used",
  "reason": "missing_both",
  "fallback_source": "environment",
  "user_id": "user_456"
}
```

### Log Levels

- **INFO**: Normal fallback usage
- **WARN**: Repeated fallback usage for same project
- **ERROR**: Fallback credential resolution failures

### Monitoring Metrics

1. **Fallback Usage Rate**: Percentage of projects using fallback credentials
2. **Fallback Frequency**: How often fallback is used per project
3. **Fallback Resolution Time**: Time taken to resolve fallback credentials
4. **Fallback Failure Rate**: Failed fallback credential resolutions

## API Integration

### Database API Enhancement

The `/api/platform/projects/[ref]/databases` endpoint automatically handles fallback:

```typescript
// Before (would fail with 500 error)
const project = await getProject(projectRef);
const connectionString = generateConnectionString({
  user: project.database_user, // null - causes error
  password: project.database_password_hash // null - causes error
});

// After (handles fallback gracefully)
const project = await getProject(projectRef);
const result = await generateEnhancedConnectionString({
  projectRef,
  allowFallback: true,
  logFallbackUsage: true
});
```

### Response Format

API responses include fallback information:

```json
{
  "connectionString": "postgresql://postgres:password@host:5432/postgres",
  "usedFallback": true,
  "fallbackReason": "missing_both",
  "credentialStatus": "incomplete"
}
```

## Migration Path

### Automatic Migration

Projects using fallback credentials can be migrated to project-specific credentials:

1. **Detection**: System identifies projects using fallback
2. **Generation**: Creates unique credentials for the project
3. **Validation**: Verifies new credentials work correctly
4. **Update**: Saves new credentials to project record
5. **Verification**: Confirms project no longer uses fallback

### Migration Triggers

- Manual migration via admin tools
- Scheduled batch migration jobs
- Project update operations
- Health check remediation

## Security Considerations

### Credential Isolation

- Fallback credentials provide basic functionality but lack project isolation
- Project-specific credentials offer better security boundaries
- Migration to project credentials is recommended for production environments

### Audit Trail

- All fallback usage is logged for security auditing
- Credential access patterns are monitored
- Unusual fallback usage triggers alerts

### Access Control

- Fallback credentials have same permissions as configured system user
- Project credentials can have more restrictive permissions
- Read-only fallback credentials available for query-only operations

## Performance Impact

### Fallback Resolution Performance

- Credential resolution adds < 5ms latency
- Environment variable caching reduces lookup time
- No significant impact on API response times

### Caching Strategy

```typescript
// Fallback credentials are cached to improve performance
const fallbackCache = new Map<string, SystemCredentials>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
```

## Troubleshooting

### Common Issues

1. **Fallback Credentials Not Working**
   - Verify environment variables are set
   - Check database connectivity with fallback credentials
   - Validate credential format and permissions

2. **Excessive Fallback Usage**
   - Review projects that haven't been migrated
   - Check for credential corruption or deletion
   - Verify migration processes are working

3. **Performance Issues**
   - Monitor fallback resolution times
   - Check for cache misses or expiration issues
   - Verify database connection pooling

### Diagnostic Commands

```bash
# Test fallback credential resolution
node scripts/test-fallback-credentials.js

# Check fallback usage statistics
curl -X GET "http://localhost:3000/api/metrics/credential-usage"

# Verify environment configuration
node scripts/verify-fallback-config.js
```

## Best Practices

### Development

1. **Always test with both project and fallback credentials**
2. **Include fallback scenarios in integration tests**
3. **Monitor fallback usage in development environments**

### Production

1. **Migrate legacy projects to project-specific credentials**
2. **Monitor fallback usage rates and trends**
3. **Set up alerts for excessive fallback usage**
4. **Regularly audit credential security**

### Operations

1. **Keep fallback credentials secure and rotated**
2. **Document all credential-related procedures**
3. **Test fallback mechanisms during disaster recovery drills**
4. **Maintain audit logs for compliance requirements**

---

**Document Version**: 1.0  
**Last Updated**: [Current Date]  
**Related Documents**: 
- [Credential Management Runbook](./CREDENTIAL-MANAGEMENT-RUNBOOK.md)
- [Credential Migration Procedures](./CREDENTIAL-MIGRATION-PROCEDURES.md)
- [Credential Troubleshooting Guide](./CREDENTIAL-TROUBLESHOOTING-GUIDE.md)