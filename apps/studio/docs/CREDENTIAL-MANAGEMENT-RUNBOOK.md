# Credential Management Operational Runbook

## Overview

This runbook provides operational procedures for managing project credentials in Supabase Studio, including fallback mechanisms, migration procedures, and troubleshooting guidance.

## System Architecture

### Credential Types

1. **Project-Specific Credentials**: Unique database user and password for each project
   - `database_user`: Project-specific database username
   - `database_password_hash`: Encrypted password for the project user

2. **Fallback Credentials**: System-wide default credentials used when project credentials are missing
   - Source: Environment variables (`POSTGRES_USER`, `POSTGRES_PASSWORD`)
   - Used automatically when project credentials are null or empty

### Credential Resolution Flow

```
Project Request → Check Project Credentials → Use Project Credentials (if complete)
                                          ↓
                                    Missing/Incomplete → Use Fallback Credentials → Log Usage
```

## Operational Procedures

### 1. Detecting Projects with Missing Credentials

#### Manual Detection
```bash
# Check credential status via API
curl -X GET "http://localhost:3000/api/platform/credential-monitoring/stats"

# Check specific project
curl -X GET "http://localhost:3000/api/platform/projects/{project-ref}/credential-status"
```

#### Automated Detection
```bash
# Run credential health check
node scripts/credential-health-check.js

# Generate credential report
node scripts/generate-credential-report.js
```

### 2. Migrating Legacy Projects

#### Single Project Migration
```bash
# Migrate specific project
node scripts/migrate-project-credentials.js --project-ref <PROJECT_REF>

# Dry run migration (preview only)
node scripts/migrate-project-credentials.js --project-ref <PROJECT_REF> --dry-run
```

#### Batch Migration
```bash
# Migrate all projects with missing credentials
node scripts/migrate-project-credentials.js --batch

# Migrate with progress reporting
node scripts/migrate-project-credentials.js --batch --verbose
```

#### Migration Verification
```bash
# Verify migration results
node scripts/verify-credential-migration.js --project-ref <PROJECT_REF>

# Check migration status for all projects
node scripts/verify-credential-migration.js --all
```

### 3. Credential Validation

#### Manual Validation
```bash
# Validate project credentials
node scripts/validate-project-credentials.js --project-ref <PROJECT_REF>

# Validate all project credentials
node scripts/validate-project-credentials.js --all
```

#### Automated Validation
- Validation runs automatically during:
  - Project creation
  - Credential updates
  - Migration processes
  - Health checks

### 4. Monitoring and Alerting

#### Key Metrics to Monitor

1. **Fallback Usage Rate**
   - Target: < 5% of projects using fallback credentials
   - Alert threshold: > 10% fallback usage

2. **Credential Validation Failures**
   - Target: < 1% validation failure rate
   - Alert threshold: > 5% validation failures

3. **Migration Success Rate**
   - Target: > 95% successful migrations
   - Alert threshold: < 90% success rate

#### Monitoring Endpoints

```bash
# System health check
GET /api/system-health

# Credential usage statistics
GET /api/metrics/credential-usage

# Credential monitoring dashboard
GET /api/platform/credential-monitoring/stats
```

### 5. Emergency Procedures

#### Credential System Failure
1. **Immediate Response**
   - Verify fallback credentials are configured
   - Check environment variables: `POSTGRES_USER`, `POSTGRES_PASSWORD`
   - Restart affected services if needed

2. **Diagnosis**
   - Check credential monitoring logs
   - Verify database connectivity
   - Test credential validation endpoints

3. **Recovery**
   - Fix underlying credential issues
   - Re-run failed migrations
   - Verify system functionality

#### Mass Credential Corruption
1. **Assessment**
   - Identify affected projects
   - Determine scope of corruption
   - Backup current credential state

2. **Recovery**
   - Use fallback credentials for immediate functionality
   - Re-generate credentials for affected projects
   - Validate new credentials before deployment

## Configuration Management

### Environment Variables

Required environment variables for credential fallback:

```bash
# Database connection credentials
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=postgres

# Credential management settings
CREDENTIAL_FALLBACK_ENABLED=true
CREDENTIAL_MIGRATION_BATCH_SIZE=10
CREDENTIAL_VALIDATION_TIMEOUT=30000
```

### Feature Flags

```bash
# Enable/disable credential features
ENABLE_CREDENTIAL_MIGRATION=true
ENABLE_CREDENTIAL_MONITORING=true
ENABLE_FALLBACK_LOGGING=true
```

## Security Considerations

### Credential Storage
- Project passwords are stored as hashed values
- Fallback credentials are sourced from secure environment variables
- Audit logs track all credential-related operations

### Access Control
- Credential migration requires admin privileges
- Monitoring endpoints require appropriate authentication
- Audit logs are protected and tamper-evident

### Compliance
- All credential operations are logged for audit purposes
- Credential changes are tracked with timestamps and user attribution
- Failed access attempts are monitored and alerted

## Performance Considerations

### Fallback Impact
- Fallback credential resolution adds minimal latency (< 5ms)
- Caching reduces repeated environment variable lookups
- Monitoring overhead is negligible for normal operations

### Migration Performance
- Batch migrations process 10 projects at a time by default
- Large migrations should be scheduled during maintenance windows
- Progress monitoring prevents timeout issues

## Backup and Recovery

### Credential Backup
```bash
# Backup current credential state
pg_dump -t projects -t credential_audit_log > credential_backup.sql

# Backup environment configuration
env | grep -E "(POSTGRES_|CREDENTIAL_)" > credential_env_backup.txt
```

### Recovery Procedures
```bash
# Restore from backup
psql < credential_backup.sql

# Verify restoration
node scripts/verify-credential-restoration.js
```

## Change Management

### Credential Updates
1. **Planning**
   - Assess impact of credential changes
   - Plan rollback procedures
   - Schedule maintenance windows

2. **Implementation**
   - Update credentials in staging environment first
   - Validate changes before production deployment
   - Monitor system health during rollout

3. **Verification**
   - Run post-deployment health checks
   - Verify credential functionality
   - Monitor for any issues or alerts

### Version Control
- All credential management scripts are version controlled
- Configuration changes require code review
- Deployment procedures are documented and tested

## Contact Information

### Escalation Path
1. **Level 1**: Development Team
2. **Level 2**: Platform Engineering
3. **Level 3**: Database Administration Team

### Emergency Contacts
- On-call Engineer: [Contact Information]
- Database Administrator: [Contact Information]
- Platform Engineering Lead: [Contact Information]

---

**Document Version**: 1.0  
**Last Updated**: [Current Date]  
**Next Review**: [Review Date]