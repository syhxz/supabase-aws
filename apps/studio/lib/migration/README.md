# Migration Service

The Migration Service handles the migration of existing projects to the isolated service architecture. It provides comprehensive backup, migration, verification, and restore functionality to ensure safe and reliable data migration.

## Features

### 1. Backup Functionality (Requirement 7.1)

Creates complete backups of project data before migration:

- Backs up auth data (users, sessions, refresh tokens)
- Backs up storage metadata (buckets, objects)
- Stores backup metadata including row counts
- Saves data in JSON format for easy inspection

### 2. Schema Migration (Requirements 7.2, 7.3)

Migrates data to project-specific databases:

- Migrates auth data to project's auth schema
- Migrates storage metadata to project's storage schema
- Preserves all relationships and constraints
- Uses transactions for data consistency

### 3. Data Verification (Requirement 7.5)

Verifies data integrity after migration:

- Checks auth data integrity
- Checks storage data integrity
- Compares row counts with backup
- Provides detailed verification reports

### 4. Restore Functionality (Requirement 7.4)

Restores from backup on failure:

- Reads backup metadata
- Truncates existing data
- Restores all tables from backup
- Uses transactions for consistency

## Usage

### Basic Migration

```typescript
import { MigrationService } from './lib/migration/MigrationService'

const migrationService = new MigrationService(
  'postgresql://user:pass@localhost:5432/postgres',
  '/var/lib/backups'
)

// Migrate a project
const result = await migrationService.migrateProject(
  'project-abc',
  'project_abc_db',
  'user-123'
)

if (result.success) {
  console.log('Migration successful!')
  console.log('Backup ID:', result.backupId)
  console.log('Migrated tables:', result.migratedTables)
  console.log('Verification:', result.verificationResults)
} else {
  console.error('Migration failed:', result.error)
}

await migrationService.close()
```

### Manual Backup

```typescript
// Create a backup
const backup = await migrationService.backupProjectData(
  'project-abc',
  'project_abc_db'
)

console.log('Backup created:', backup.backupId)
console.log('Backup path:', backup.backupPath)
console.log('Row counts:', backup.rowCounts)
```

### Manual Restore

```typescript
// Restore from a specific backup
await migrationService.restoreFromBackup(
  'backup_project-abc_1234567890',
  'project_abc_db'
)
```

### Verification Only

```typescript
// Verify data integrity without migration
const verification = await migrationService.verifyDataIntegrity(
  'project-abc',
  'project_abc_db',
  backupMetadata
)

if (verification.success) {
  console.log('Data integrity verified!')
} else {
  console.log('Verification failed:', verification.details)
}
```

## Backup Structure

Backups are stored in the following structure:

```
/var/lib/backups/
  backup_project-abc_1234567890/
    metadata.json
    auth_users.json
    auth_sessions.json
    auth_refresh_tokens.json
    storage_buckets.json
    storage_objects.json
```

### Metadata Format

```json
{
  "backupId": "backup_project-abc_1234567890",
  "projectRef": "project-abc",
  "databaseName": "project_abc_db",
  "timestamp": "2025-01-27T10:30:00.000Z",
  "backupPath": "/var/lib/backups/backup_project-abc_1234567890",
  "tables": [
    "auth.users",
    "auth.sessions",
    "auth.refresh_tokens",
    "storage.buckets",
    "storage.objects"
  ],
  "rowCounts": {
    "auth.users": 150,
    "auth.sessions": 45,
    "auth.refresh_tokens": 90,
    "storage.buckets": 10,
    "storage.objects": 500
  }
}
```

## Migration Process

The migration follows these steps:

1. **Backup**: Create a complete backup of existing data
2. **Initialize**: Create project-specific schemas
3. **Migrate Auth**: Copy auth data to project database
4. **Migrate Storage**: Copy storage metadata to project database
5. **Verify**: Check data integrity and row counts
6. **Restore on Failure**: Automatically restore from backup if any step fails

## Error Handling

The service includes comprehensive error handling:

- Automatic rollback on schema initialization failure
- Automatic restore from backup on migration failure
- Detailed error messages for troubleshooting
- Transaction-based operations for consistency

## Requirements Mapping

- **Requirement 7.1**: `backupProjectData()` - Backup existing data
- **Requirement 7.2**: `migrateAuthData()` - Migrate auth data
- **Requirement 7.3**: `migrateStorageData()` - Migrate storage metadata
- **Requirement 7.4**: `restoreFromBackup()` - Restore from backup on failure
- **Requirement 7.5**: `verifyDataIntegrity()` - Verify data integrity

## Testing

See `apps/studio/tests/lib/migration-service.test.ts` for unit tests.

## Notes

- Backups are stored in JSON format for easy inspection and debugging
- All operations use transactions where possible for data consistency
- The service automatically handles connection pooling
- Backup metadata includes row counts for verification
- Failed migrations automatically trigger restore from backup
