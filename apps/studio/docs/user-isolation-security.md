# User Isolation Security Utilities

This document describes the user isolation verification and security utilities implemented for project-specific database users.

## Overview

The user isolation security system provides utilities to verify that project-specific database users have proper isolation and cannot access databases from other projects. This ensures data security and prevents cross-project data access.

## Components

### 1. User Isolation Security Module

Located at: `lib/api/self-hosted/user-isolation-security.ts`

This module provides the following functions:

#### `verifyCrossProjectAccessDenial(username, targetDatabase)`
Verifies that a user cannot access databases from other projects.

```typescript
const result = await verifyCrossProjectAccessDenial('proj_test', 'other_project_db')
if (result.data?.canAccess) {
  console.log('Security violation: User has unauthorized access!')
}
```

#### `verifyUserPermissions(username, assignedDatabase)`
Verifies that a user has the correct permissions on their assigned database and no permissions on other databases.

```typescript
const result = await verifyUserPermissions('proj_test', 'test_db')
if (!result.data?.hasCorrectPermissions) {
  console.log('Violations found:', result.data?.violations)
}
```

#### `logUserAccess(auditLog)`
Logs user access attempts for audit purposes.

```typescript
await logUserAccess({
  username: 'proj_test',
  database: 'test_db',
  timestamp: new Date(),
  accessType: 'SELECT',
  granted: true,
  details: 'Query executed successfully'
})
```

#### `runIsolationVerification()`
Runs a comprehensive isolation verification check across all project users.

```typescript
const result = await runIsolationVerification()
console.log('Isolation status:', result.data?.isolationStatus)
console.log('Violations:', result.data?.violations)
```

#### `generateIsolationVerificationScript()`
Creates a SQL script that can be run manually to validate user isolation.

```typescript
const script = generateIsolationVerificationScript()
console.log(script) // SQL script for manual verification
```

### 2. Verification Script

Located at: `scripts/verify-user-isolation.ts`

This script can be run to verify user isolation across the entire system.

#### Usage

```bash
# Run automated verification
npm run verify:isolation

# Generate SQL script for manual verification
npm run verify:isolation:sql
```

#### Output

The script provides:
- Overall isolation status (SECURE/COMPROMISED/UNKNOWN)
- List of users and databases checked
- Detailed security violations with recommendations
- Summary of findings

## Security Violations

The system detects the following types of security violations:

### 1. Cross-Project Access
- **Type**: `CROSS_PROJECT_ACCESS`
- **Severity**: `HIGH`
- **Description**: User has access to databases from other projects
- **Recommendation**: Revoke unauthorized permissions

### 2. Excessive Privileges
- **Type**: `EXCESSIVE_PRIVILEGES`
- **Severity**: `CRITICAL` (superuser), `HIGH` (createrole), `MEDIUM` (createdb)
- **Description**: User has system-level privileges they shouldn't have
- **Recommendation**: Remove excessive privileges

### 3. Missing Isolation
- **Type**: `MISSING_ISOLATION`
- **Severity**: `CRITICAL`
- **Description**: User doesn't have access to their assigned database
- **Recommendation**: Grant appropriate permissions

## Integration

The security utilities are automatically exported from the main self-hosted API module:

```typescript
import {
  verifyCrossProjectAccessDenial,
  verifyUserPermissions,
  runIsolationVerification
} from 'lib/api/self-hosted'
```

## Testing

Comprehensive tests are available at:
`lib/api/self-hosted/__tests__/user-isolation-security.test.ts`

Run tests with:
```bash
npx vitest run lib/api/self-hosted/__tests__/user-isolation-security.test.ts
```

## Manual Verification

For manual verification, you can run the generated SQL script directly against your PostgreSQL database:

```bash
# Generate the script
npm run verify:isolation:sql > isolation-check.sql

# Run it against your database
psql -h localhost -U postgres -d postgres -f isolation-check.sql
```

The script will show:
1. All project users and their attributes
2. Database permissions for each user
3. Potential cross-project access violations
4. Users with excessive system privileges
5. Summary statistics

## Best Practices

1. **Regular Verification**: Run isolation verification regularly, especially after creating or modifying projects
2. **Audit Logging**: Use the audit logging function to track user access patterns
3. **Immediate Action**: Address CRITICAL and HIGH severity violations immediately
4. **Monitoring**: Integrate verification into your monitoring and alerting systems
5. **Documentation**: Keep track of any intentional exceptions to isolation rules

## Troubleshooting

### Common Issues

1. **Connection Errors**: Ensure the database connection is properly configured
2. **Permission Errors**: Verify that the verification user has sufficient privileges to query system tables
3. **False Positives**: Some system databases (postgres, template0, template1) are excluded from violation checks

### Debug Mode

For debugging, you can enable verbose logging by setting the appropriate log level in your environment.