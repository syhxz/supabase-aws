# Credential Migration Procedures

## Overview

This document provides detailed procedures for migrating legacy projects from fallback credentials to project-specific database credentials. The migration process ensures security isolation while maintaining backward compatibility.

## Migration Strategy

### Migration Phases

1. **Discovery Phase**: Identify projects requiring migration
2. **Planning Phase**: Assess migration scope and schedule
3. **Execution Phase**: Perform credential migration
4. **Validation Phase**: Verify migration success
5. **Monitoring Phase**: Track post-migration health

### Migration Types

#### 1. Single Project Migration
- Migrate one project at a time
- Suitable for testing and small-scale operations
- Allows detailed validation and rollback if needed

#### 2. Batch Migration
- Migrate multiple projects simultaneously
- Efficient for large-scale operations
- Includes progress tracking and error handling

#### 3. Scheduled Migration
- Automated migration during maintenance windows
- Reduces impact on active users
- Includes comprehensive logging and reporting

## Pre-Migration Assessment

### Project Discovery

#### Identify Projects Needing Migration

```bash
# List all projects with missing credentials
node scripts/list-projects-missing-credentials.js

# Get detailed credential status
node scripts/get-credential-status.js --detailed

# Export migration candidates to CSV
node scripts/export-migration-candidates.js --format csv
```

#### Assessment Criteria

Projects requiring migration have one or more of the following:
- `database_user` is null or empty
- `database_password_hash` is null or empty
- `credential_status` indicates incomplete credentials
- Created before credential implementation date

### Impact Analysis

#### Resource Requirements

```bash
# Estimate migration time and resources
node scripts/estimate-migration-impact.js --project-count <COUNT>

# Check database capacity for new users
node scripts/check-database-capacity.js

# Validate migration prerequisites
node scripts/validate-migration-prerequisites.js
```

#### Risk Assessment

1. **Low Risk**: Projects with recent activity and stable configuration
2. **Medium Risk**: Projects with custom configurations or integrations
3. **High Risk**: Critical production projects or those with known issues

## Migration Procedures

### Single Project Migration

#### Step 1: Pre-Migration Validation

```bash
# Validate project exists and is accessible
node scripts/validate-project.js --project-ref <PROJECT_REF>

# Check current credential status
node scripts/check-credential-status.js --project-ref <PROJECT_REF>

# Verify database connectivity with fallback credentials
node scripts/test-database-connection.js --project-ref <PROJECT_REF>
```

#### Step 2: Generate Project Credentials

```bash
# Generate new project-specific credentials
node scripts/generate-project-credentials.js --project-ref <PROJECT_REF>

# Dry run to preview changes
node scripts/generate-project-credentials.js --project-ref <PROJECT_REF> --dry-run

# Generate with custom parameters
node scripts/generate-project-credentials.js --project-ref <PROJECT_REF> --user-prefix custom
```

#### Step 3: Create Database User

```bash
# Create database user with generated credentials
node scripts/create-database-user.js --project-ref <PROJECT_REF>

# Create with specific permissions
node scripts/create-database-user.js --project-ref <PROJECT_REF> --permissions read-write

# Verify user creation
node scripts/verify-database-user.js --project-ref <PROJECT_REF>
```

#### Step 4: Update Project Record

```bash
# Update project with new credentials
node scripts/update-project-credentials.js --project-ref <PROJECT_REF>

# Verify update success
node scripts/verify-credential-update.js --project-ref <PROJECT_REF>

# Test connection with new credentials
node scripts/test-new-credentials.js --project-ref <PROJECT_REF>
```

#### Step 5: Post-Migration Validation

```bash
# Comprehensive post-migration test
node scripts/validate-migration.js --project-ref <PROJECT_REF>

# Test API endpoints
node scripts/test-api-endpoints.js --project-ref <PROJECT_REF>

# Verify no fallback usage
node scripts/verify-no-fallback.js --project-ref <PROJECT_REF>
```

### Batch Migration

#### Step 1: Prepare Batch

```bash
# Create migration batch from candidate list
node scripts/create-migration-batch.js --input candidates.csv --batch-size 10

# Validate batch prerequisites
node scripts/validate-migration-batch.js --batch-file batch_001.json

# Estimate batch completion time
node scripts/estimate-batch-time.js --batch-file batch_001.json
```

#### Step 2: Execute Batch Migration

```bash
# Start batch migration
node scripts/execute-batch-migration.js --batch-file batch_001.json

# Monitor progress
node scripts/monitor-batch-progress.js --batch-id batch_001

# Resume interrupted batch
node scripts/resume-batch-migration.js --batch-id batch_001
```

#### Step 3: Batch Validation

```bash
# Validate entire batch
node scripts/validate-batch-migration.js --batch-id batch_001

# Generate batch report
node scripts/generate-batch-report.js --batch-id batch_001

# Export results
node scripts/export-batch-results.js --batch-id batch_001 --format json
```

### Scheduled Migration

#### Configuration

```bash
# Configure scheduled migration
cat > migration-schedule.json << EOF
{
  "schedule": "0 2 * * 0",
  "batchSize": 20,
  "maxDuration": "2h",
  "notificationEmail": "admin@example.com",
  "dryRun": false
}
EOF
```

#### Setup

```bash
# Install migration scheduler
node scripts/install-migration-scheduler.js --config migration-schedule.json

# Test scheduled migration
node scripts/test-scheduled-migration.js --dry-run

# Enable scheduled migration
node scripts/enable-scheduled-migration.js
```

## Migration Scripts

### Core Migration Scripts

#### generate-project-credentials.js

```javascript
#!/usr/bin/env node

const { CredentialMigrationManager } = require('../lib/api/self-hosted/credential-migration-manager');

async function generateCredentials(projectRef, options = {}) {
  const manager = new CredentialMigrationManager();
  
  try {
    const result = await manager.generateProjectCredentials(projectRef, options);
    console.log(`Generated credentials for project ${projectRef}:`, result);
    return result;
  } catch (error) {
    console.error(`Failed to generate credentials for ${projectRef}:`, error);
    throw error;
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const projectRef = args.find(arg => arg.startsWith('--project-ref='))?.split('=')[1];
  
  if (!projectRef) {
    console.error('Usage: node generate-project-credentials.js --project-ref=<PROJECT_REF>');
    process.exit(1);
  }
  
  generateCredentials(projectRef)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { generateCredentials };
```

#### migrate-project-credentials.js

```javascript
#!/usr/bin/env node

const { CredentialMigrationManager } = require('../lib/api/self-hosted/credential-migration-manager');

async function migrateProject(projectRef, options = {}) {
  const manager = new CredentialMigrationManager();
  
  try {
    console.log(`Starting migration for project ${projectRef}...`);
    
    // Step 1: Generate credentials
    const credentials = await manager.generateProjectCredentials(projectRef);
    console.log('✓ Generated project credentials');
    
    // Step 2: Create database user
    await manager.createDatabaseUser(projectRef, credentials);
    console.log('✓ Created database user');
    
    // Step 3: Update project record
    await manager.updateProjectCredentials(projectRef, credentials);
    console.log('✓ Updated project record');
    
    // Step 4: Validate migration
    const validation = await manager.validateMigration(projectRef);
    if (!validation.success) {
      throw new Error(`Migration validation failed: ${validation.error}`);
    }
    console.log('✓ Migration validated successfully');
    
    return { success: true, projectRef, credentials };
  } catch (error) {
    console.error(`Migration failed for ${projectRef}:`, error);
    
    // Attempt rollback
    try {
      await manager.rollbackMigration(projectRef);
      console.log('✓ Rollback completed');
    } catch (rollbackError) {
      console.error('✗ Rollback failed:', rollbackError);
    }
    
    throw error;
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const projectRef = args.find(arg => arg.startsWith('--project-ref='))?.split('=')[1];
  const dryRun = args.includes('--dry-run');
  
  if (!projectRef) {
    console.error('Usage: node migrate-project-credentials.js --project-ref=<PROJECT_REF> [--dry-run]');
    process.exit(1);
  }
  
  if (dryRun) {
    console.log(`DRY RUN: Would migrate project ${projectRef}`);
    process.exit(0);
  }
  
  migrateProject(projectRef)
    .then(() => {
      console.log(`✓ Successfully migrated project ${projectRef}`);
      process.exit(0);
    })
    .catch(() => process.exit(1));
}

module.exports = { migrateProject };
```

### Validation Scripts

#### validate-migration.js

```javascript
#!/usr/bin/env node

const { CredentialMigrationManager } = require('../lib/api/self-hosted/credential-migration-manager');

async function validateMigration(projectRef) {
  const manager = new CredentialMigrationManager();
  
  const checks = [
    'Project credentials exist',
    'Database user created',
    'Connection successful',
    'No fallback usage',
    'API endpoints working'
  ];
  
  console.log(`Validating migration for project ${projectRef}...`);
  
  try {
    const results = await manager.validateMigration(projectRef);
    
    checks.forEach((check, index) => {
      const status = results.checks[index] ? '✓' : '✗';
      console.log(`${status} ${check}`);
    });
    
    if (results.success) {
      console.log('✓ Migration validation passed');
      return true;
    } else {
      console.log('✗ Migration validation failed');
      console.log('Errors:', results.errors);
      return false;
    }
  } catch (error) {
    console.error('Validation error:', error);
    return false;
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const projectRef = args.find(arg => arg.startsWith('--project-ref='))?.split('=')[1];
  
  if (!projectRef) {
    console.error('Usage: node validate-migration.js --project-ref=<PROJECT_REF>');
    process.exit(1);
  }
  
  validateMigration(projectRef)
    .then(success => process.exit(success ? 0 : 1))
    .catch(() => process.exit(1));
}

module.exports = { validateMigration };
```

## Rollback Procedures

### Automatic Rollback

Migration scripts include automatic rollback on failure:

1. **Credential Generation Failure**: No rollback needed (no changes made)
2. **Database User Creation Failure**: Remove generated credentials from project
3. **Project Update Failure**: Remove database user and credentials
4. **Validation Failure**: Complete rollback to original state

### Manual Rollback

```bash
# Rollback specific project migration
node scripts/rollback-migration.js --project-ref <PROJECT_REF>

# Rollback with cleanup
node scripts/rollback-migration.js --project-ref <PROJECT_REF> --cleanup

# Verify rollback success
node scripts/verify-rollback.js --project-ref <PROJECT_REF>
```

### Rollback Validation

```bash
# Test fallback functionality after rollback
node scripts/test-fallback-after-rollback.js --project-ref <PROJECT_REF>

# Verify no orphaned database users
node scripts/check-orphaned-users.js

# Validate project functionality
node scripts/validate-project-functionality.js --project-ref <PROJECT_REF>
```

## Monitoring and Reporting

### Migration Progress Tracking

```bash
# Real-time migration monitoring
node scripts/monitor-migration-progress.js --follow

# Generate progress report
node scripts/generate-progress-report.js --format html

# Export migration metrics
node scripts/export-migration-metrics.js --period 7d
```

### Success Metrics

1. **Migration Success Rate**: Percentage of successful migrations
2. **Migration Duration**: Average time per project migration
3. **Rollback Rate**: Percentage of migrations requiring rollback
4. **Post-Migration Issues**: Problems discovered after migration

### Reporting

```bash
# Daily migration report
node scripts/generate-daily-report.js --email admin@example.com

# Weekly migration summary
node scripts/generate-weekly-summary.js --format pdf

# Migration dashboard data
node scripts/export-dashboard-data.js --format json
```

## Best Practices

### Planning

1. **Start with low-risk projects** to validate procedures
2. **Schedule migrations during low-traffic periods**
3. **Maintain communication** with stakeholders
4. **Document all procedures** and lessons learned

### Execution

1. **Always run dry-run first** to preview changes
2. **Monitor system resources** during batch migrations
3. **Validate each step** before proceeding
4. **Keep detailed logs** of all operations

### Post-Migration

1. **Monitor system health** for 24-48 hours after migration
2. **Track fallback usage** to ensure migration success
3. **Update documentation** with any procedure changes
4. **Plan follow-up migrations** based on lessons learned

## Troubleshooting

### Common Issues

#### Migration Failures

1. **Database Connection Issues**
   - Verify database connectivity
   - Check credential permissions
   - Validate network configuration

2. **Credential Generation Failures**
   - Check random number generation
   - Verify password complexity requirements
   - Validate username format constraints

3. **Database User Creation Failures**
   - Check database permissions
   - Verify user limit constraints
   - Validate naming conventions

#### Performance Issues

1. **Slow Migration Performance**
   - Reduce batch size
   - Check database load
   - Optimize migration queries

2. **Resource Exhaustion**
   - Monitor memory usage
   - Check connection pool limits
   - Scale migration infrastructure

### Recovery Procedures

```bash
# Recover from failed batch migration
node scripts/recover-failed-batch.js --batch-id <BATCH_ID>

# Clean up orphaned resources
node scripts/cleanup-migration-artifacts.js

# Repair corrupted project data
node scripts/repair-project-data.js --project-ref <PROJECT_REF>
```

---

**Document Version**: 1.0  
**Last Updated**: [Current Date]  
**Related Documents**:
- [Credential Management Runbook](./CREDENTIAL-MANAGEMENT-RUNBOOK.md)
- [Credential Troubleshooting Guide](./CREDENTIAL-TROUBLESHOOTING-GUIDE.md)
- [Credential Monitoring Guide](./CREDENTIAL-MONITORING-ALERTING.md)