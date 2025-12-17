# Credential Troubleshooting Guide

## Overview

This guide provides comprehensive troubleshooting procedures for credential-related issues in Supabase Studio, including fallback mechanisms, migration problems, and validation failures.

## Common Issues and Solutions

### 1. 500 Internal Server Error on Database Access

#### Symptoms
- API returns 500 error when accessing `/api/platform/projects/[ref]/databases`
- Error logs show "Cannot read property 'database_user' of null"
- Database connection information not displayed in UI

#### Root Cause
- Missing `database_user` or `database_password_hash` fields in project record
- Legacy project created before credential implementation
- Corrupted or deleted credential data

#### Diagnosis Steps

```bash
# Check project credential status
curl -X GET "http://localhost:3000/api/platform/projects/{project-ref}/credential-status"

# Verify project exists in database
node scripts/check-project-exists.js --project-ref <PROJECT_REF>

# Check credential fields directly
node scripts/inspect-project-credentials.js --project-ref <PROJECT_REF>
```

#### Solution

```bash
# Option 1: Enable fallback credentials (immediate fix)
export CREDENTIAL_FALLBACK_ENABLED=true
systemctl restart supabase-studio

# Option 2: Migrate project to proper credentials (permanent fix)
node scripts/migrate-project-credentials.js --project-ref <PROJECT_REF>

# Option 3: Manual credential creation
node scripts/create-project-credentials.js --project-ref <PROJECT_REF>
```

#### Verification

```bash
# Test API endpoint
curl -X GET "http://localhost:3000/api/platform/projects/{project-ref}/databases"

# Verify no fallback usage
node scripts/check-fallback-usage.js --project-ref <PROJECT_REF>
```

### 2. Fallback Credentials Not Working

#### Symptoms
- System still returns errors despite fallback being enabled
- Connection strings contain null or undefined values
- Fallback usage not logged

#### Root Cause
- Missing or incorrect environment variables
- Fallback credentials have insufficient permissions
- Database connectivity issues

#### Diagnosis Steps

```bash
# Check environment variables
env | grep -E "(POSTGRES_|CREDENTIAL_)"

# Test fallback credential connectivity
node scripts/test-fallback-connection.js

# Verify fallback configuration
node scripts/verify-fallback-config.js
```

#### Solution

```bash
# Set required environment variables
export POSTGRES_USER=postgres
export POSTGRES_PASSWORD=your_secure_password
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5432
export CREDENTIAL_FALLBACK_ENABLED=true

# Test database connection with fallback credentials
psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d postgres

# Restart services
systemctl restart supabase-studio
```

#### Verification

```bash
# Test fallback resolution
node scripts/test-fallback-resolution.js

# Check fallback usage logs
tail -f /var/log/supabase-studio/credential-fallback.log
```

### 3. Migration Failures

#### Symptoms
- Migration script exits with error
- Project credentials partially created
- Database user creation fails

#### Root Cause Analysis

```bash
# Check migration logs
tail -f /var/log/supabase-studio/migration.log

# Verify database permissions
node scripts/check-migration-permissions.js

# Check for existing database users
node scripts/list-database-users.js --project-ref <PROJECT_REF>
```

#### Common Migration Issues

##### Issue: Database User Already Exists

```bash
# Check for existing user
psql -c "SELECT usename FROM pg_user WHERE usename LIKE 'project_%';"

# Remove conflicting user
node scripts/remove-conflicting-user.js --project-ref <PROJECT_REF>

# Retry migration
node scripts/migrate-project-credentials.js --project-ref <PROJECT_REF>
```

##### Issue: Insufficient Database Permissions

```bash
# Check current user permissions
psql -c "SELECT current_user, session_user;"

# Grant required permissions
psql -c "ALTER USER postgres CREATEDB CREATEROLE;"

# Verify permissions
node scripts/verify-migration-permissions.js
```

##### Issue: Password Complexity Requirements

```bash
# Check password policy
node scripts/check-password-policy.js

# Generate compliant password
node scripts/generate-secure-password.js --project-ref <PROJECT_REF>

# Update password requirements
node scripts/update-password-policy.js --min-length 12 --require-special
```

### 4. Credential Validation Failures

#### Symptoms
- Validation errors during credential updates
- API rejects credential changes
- Inconsistent credential format

#### Diagnosis Steps

```bash
# Test credential validation
node scripts/test-credential-validation.js --user <USER> --password <PASSWORD>

# Check validation rules
node scripts/show-validation-rules.js

# Validate specific project credentials
node scripts/validate-project-credentials.js --project-ref <PROJECT_REF>
```

#### Common Validation Issues

##### Issue: Invalid Username Format

```bash
# Check username requirements
node scripts/show-username-requirements.js

# Generate valid username
node scripts/generate-valid-username.js --project-ref <PROJECT_REF>

# Update username format
node scripts/update-username-format.js --project-ref <PROJECT_REF>
```

##### Issue: Weak Password

```bash
# Check password strength
node scripts/check-password-strength.js --password <PASSWORD>

# Generate strong password
node scripts/generate-strong-password.js --length 16 --complexity high

# Update password policy
node scripts/update-password-policy.js --enforce-strength
```

### 5. Connection String Generation Issues

#### Symptoms
- Malformed connection strings
- Missing connection parameters
- Incorrect credential substitution

#### Diagnosis Steps

```bash
# Test connection string generation
node scripts/test-connection-string.js --project-ref <PROJECT_REF>

# Debug connection string components
node scripts/debug-connection-string.js --project-ref <PROJECT_REF>

# Validate connection string format
node scripts/validate-connection-string.js --connection-string <STRING>
```

#### Solutions

```bash
# Regenerate connection string
node scripts/regenerate-connection-string.js --project-ref <PROJECT_REF>

# Fix connection string template
node scripts/fix-connection-template.js

# Update connection string configuration
node scripts/update-connection-config.js --template <TEMPLATE>
```

### 6. Monitoring and Logging Issues

#### Symptoms
- Missing credential usage logs
- Monitoring endpoints return errors
- Audit logs not being created

#### Diagnosis Steps

```bash
# Check logging configuration
node scripts/check-logging-config.js

# Test log writing permissions
node scripts/test-log-permissions.js

# Verify monitoring service status
systemctl status credential-monitoring
```

#### Solutions

```bash
# Enable credential logging
export CREDENTIAL_LOGGING_ENABLED=true
export LOG_LEVEL=info

# Fix log file permissions
chmod 644 /var/log/supabase-studio/credential-*.log
chown supabase:supabase /var/log/supabase-studio/credential-*.log

# Restart monitoring service
systemctl restart credential-monitoring
```

## Diagnostic Tools

### Credential Health Check

```bash
#!/bin/bash
# comprehensive-credential-health-check.sh

echo "=== Credential System Health Check ==="

# Check environment variables
echo "1. Environment Variables:"
env | grep -E "(POSTGRES_|CREDENTIAL_)" | while read line; do
  echo "  ✓ $line"
done

# Check database connectivity
echo "2. Database Connectivity:"
if psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d postgres -c "SELECT 1;" > /dev/null 2>&1; then
  echo "  ✓ Database connection successful"
else
  echo "  ✗ Database connection failed"
fi

# Check fallback functionality
echo "3. Fallback Functionality:"
if node scripts/test-fallback-resolution.js > /dev/null 2>&1; then
  echo "  ✓ Fallback resolution working"
else
  echo "  ✗ Fallback resolution failed"
fi

# Check migration capabilities
echo "4. Migration Capabilities:"
if node scripts/test-migration-permissions.js > /dev/null 2>&1; then
  echo "  ✓ Migration permissions sufficient"
else
  echo "  ✗ Migration permissions insufficient"
fi

# Check monitoring services
echo "5. Monitoring Services:"
if systemctl is-active credential-monitoring > /dev/null 2>&1; then
  echo "  ✓ Monitoring service active"
else
  echo "  ✗ Monitoring service inactive"
fi

echo "=== Health Check Complete ==="
```

### Project Credential Inspector

```javascript
#!/usr/bin/env node
// inspect-project-credentials.js

const { ProjectStore } = require('../lib/api/self-hosted/project-store');

async function inspectCredentials(projectRef) {
  const store = new ProjectStore();
  
  try {
    console.log(`Inspecting credentials for project: ${projectRef}`);
    
    const project = await store.getProject(projectRef);
    if (!project) {
      console.log('✗ Project not found');
      return;
    }
    
    console.log('Project Information:');
    console.log(`  ID: ${project.id}`);
    console.log(`  Name: ${project.name}`);
    console.log(`  Created: ${project.created_at}`);
    
    console.log('Credential Status:');
    console.log(`  Database User: ${project.database_user || 'NULL'}`);
    console.log(`  Password Hash: ${project.database_password_hash ? 'SET' : 'NULL'}`);
    console.log(`  Status: ${getCredentialStatus(project)}`);
    
    console.log('Fallback Analysis:');
    const needsFallback = !project.database_user || !project.database_password_hash;
    console.log(`  Needs Fallback: ${needsFallback ? 'YES' : 'NO'}`);
    
    if (needsFallback) {
      console.log('  Fallback Reason:');
      if (!project.database_user) console.log('    - Missing database_user');
      if (!project.database_password_hash) console.log('    - Missing database_password_hash');
    }
    
  } catch (error) {
    console.error('Inspection failed:', error);
  }
}

function getCredentialStatus(project) {
  if (!project.database_user && !project.database_password_hash) return 'MISSING_BOTH';
  if (!project.database_user) return 'MISSING_USER';
  if (!project.database_password_hash) return 'MISSING_PASSWORD';
  return 'COMPLETE';
}

// CLI interface
if (require.main === module) {
  const projectRef = process.argv[2];
  if (!projectRef) {
    console.error('Usage: node inspect-project-credentials.js <PROJECT_REF>');
    process.exit(1);
  }
  
  inspectCredentials(projectRef)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
```

### Connection String Debugger

```javascript
#!/usr/bin/env node
// debug-connection-string.js

const { generateEnhancedConnectionString } = require('../lib/api/self-hosted/connection-string');

async function debugConnectionString(projectRef) {
  console.log(`Debugging connection string for project: ${projectRef}`);
  
  try {
    const result = await generateEnhancedConnectionString({
      projectRef,
      allowFallback: true,
      logFallbackUsage: false // Don't log during debugging
    });
    
    console.log('Connection String Generation Result:');
    console.log(`  Connection String: ${result.connectionString}`);
    console.log(`  Used Fallback: ${result.usedFallback}`);
    console.log(`  Fallback Reason: ${result.fallbackReason || 'N/A'}`);
    
    // Parse and validate connection string
    const url = new URL(result.connectionString);
    console.log('Connection String Components:');
    console.log(`  Protocol: ${url.protocol}`);
    console.log(`  Username: ${url.username}`);
    console.log(`  Password: ${url.password ? '[HIDDEN]' : 'MISSING'}`);
    console.log(`  Host: ${url.hostname}`);
    console.log(`  Port: ${url.port}`);
    console.log(`  Database: ${url.pathname.slice(1)}`);
    
    // Test connection
    console.log('Testing Connection...');
    const testResult = await testConnection(result.connectionString);
    console.log(`  Connection Test: ${testResult ? 'SUCCESS' : 'FAILED'}`);
    
  } catch (error) {
    console.error('Debug failed:', error);
  }
}

async function testConnection(connectionString) {
  const { Client } = require('pg');
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    await client.query('SELECT 1');
    await client.end();
    return true;
  } catch (error) {
    console.error('Connection test error:', error.message);
    return false;
  }
}

// CLI interface
if (require.main === module) {
  const projectRef = process.argv[2];
  if (!projectRef) {
    console.error('Usage: node debug-connection-string.js <PROJECT_REF>');
    process.exit(1);
  }
  
  debugConnectionString(projectRef)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
```

## Emergency Procedures

### Complete Credential System Failure

#### Immediate Response (< 5 minutes)

1. **Enable Emergency Fallback Mode**
   ```bash
   export CREDENTIAL_EMERGENCY_MODE=true
   export CREDENTIAL_FALLBACK_ENABLED=true
   systemctl restart supabase-studio
   ```

2. **Verify Basic Functionality**
   ```bash
   curl -X GET "http://localhost:3000/api/health"
   curl -X GET "http://localhost:3000/api/platform/projects"
   ```

3. **Notify Stakeholders**
   ```bash
   node scripts/send-emergency-notification.js --type credential-failure
   ```

#### Short-term Recovery (< 30 minutes)

1. **Diagnose Root Cause**
   ```bash
   node scripts/comprehensive-credential-diagnosis.js
   tail -f /var/log/supabase-studio/error.log
   ```

2. **Implement Temporary Fix**
   ```bash
   # Restore from backup if available
   node scripts/restore-credential-backup.js --backup-date today
   
   # Or regenerate critical project credentials
   node scripts/emergency-credential-regeneration.js
   ```

3. **Validate Recovery**
   ```bash
   node scripts/validate-emergency-recovery.js
   ```

#### Long-term Resolution (< 2 hours)

1. **Root Cause Analysis**
   ```bash
   node scripts/generate-incident-report.js --type credential-failure
   ```

2. **Permanent Fix Implementation**
   ```bash
   node scripts/implement-permanent-fix.js
   ```

3. **System Hardening**
   ```bash
   node scripts/implement-preventive-measures.js
   ```

### Mass Credential Corruption

#### Assessment Phase

```bash
# Assess scope of corruption
node scripts/assess-credential-corruption.js

# Identify affected projects
node scripts/list-corrupted-projects.js

# Estimate recovery time
node scripts/estimate-recovery-time.js
```

#### Recovery Phase

```bash
# Backup current state
node scripts/backup-current-credential-state.js

# Restore from known good backup
node scripts/restore-credential-backup.js --backup-date <DATE>

# Regenerate corrupted credentials
node scripts/regenerate-corrupted-credentials.js --batch-size 5

# Validate recovery
node scripts/validate-mass-recovery.js
```

## Performance Troubleshooting

### Slow Credential Resolution

#### Diagnosis

```bash
# Profile credential resolution performance
node scripts/profile-credential-resolution.js

# Check database query performance
node scripts/analyze-credential-queries.js

# Monitor system resources
top -p $(pgrep -f supabase-studio)
```

#### Optimization

```bash
# Enable credential caching
export CREDENTIAL_CACHE_ENABLED=true
export CREDENTIAL_CACHE_TTL=300

# Optimize database queries
node scripts/optimize-credential-queries.js

# Scale credential services
node scripts/scale-credential-services.js --instances 3
```

### High Fallback Usage

#### Analysis

```bash
# Analyze fallback usage patterns
node scripts/analyze-fallback-patterns.js --period 7d

# Identify projects needing migration
node scripts/identify-migration-candidates.js

# Estimate migration impact
node scripts/estimate-migration-impact.js
```

#### Remediation

```bash
# Prioritize high-impact migrations
node scripts/prioritize-migrations.js --criteria impact

# Schedule batch migrations
node scripts/schedule-batch-migrations.js --schedule "0 2 * * 0"

# Monitor migration progress
node scripts/monitor-migration-progress.js --dashboard
```

## Best Practices for Troubleshooting

### Systematic Approach

1. **Gather Information**
   - Collect error messages and logs
   - Identify affected projects and users
   - Determine timeline and scope

2. **Isolate the Problem**
   - Test individual components
   - Verify configuration settings
   - Check dependencies and prerequisites

3. **Implement Solution**
   - Start with least disruptive fixes
   - Test changes in staging first
   - Document all changes made

4. **Verify Resolution**
   - Test affected functionality
   - Monitor for recurring issues
   - Update documentation

### Documentation

1. **Keep Detailed Logs**
   - Record all troubleshooting steps
   - Document solutions that work
   - Note lessons learned

2. **Update Procedures**
   - Improve troubleshooting guides
   - Add new diagnostic tools
   - Share knowledge with team

3. **Preventive Measures**
   - Implement monitoring alerts
   - Create automated health checks
   - Plan regular maintenance

---

**Document Version**: 1.0  
**Last Updated**: [Current Date]  
**Emergency Contact**: [Emergency Contact Information]  
**Related Documents**:
- [Credential Management Runbook](./CREDENTIAL-MANAGEMENT-RUNBOOK.md)
- [Credential Migration Procedures](./CREDENTIAL-MIGRATION-PROCEDURES.md)
- [Credential Monitoring Guide](./CREDENTIAL-MONITORING-ALERTING.md)