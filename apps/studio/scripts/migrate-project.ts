#!/usr/bin/env ts-node

/**
 * Migration Script for Project-Level Service Isolation
 * 
 * This script migrates existing projects to the isolated service architecture.
 * It handles backup, migration, verification, and restore operations.
 * 
 * Usage:
 *   npm run migrate-project -- --project-ref=project-abc --database=project_abc_db --owner=user-123
 *   npm run migrate-project -- --all
 *   npm run migrate-project -- --verify-only --project-ref=project-abc --database=project_abc_db
 */

import { MigrationService } from '../lib/migration/MigrationService'
import { Pool } from 'pg'

interface MigrationOptions {
  projectRef?: string
  database?: string
  owner?: string
  all?: boolean
  verifyOnly?: boolean
  backupOnly?: boolean
  restore?: string
  connectionString?: string
  backupDir?: string
}

async function parseArgs(): Promise<MigrationOptions> {
  const args = process.argv.slice(2)
  const options: MigrationOptions = {}

  for (const arg of args) {
    if (arg.startsWith('--project-ref=')) {
      options.projectRef = arg.split('=')[1]
    } else if (arg.startsWith('--database=')) {
      options.database = arg.split('=')[1]
    } else if (arg.startsWith('--owner=')) {
      options.owner = arg.split('=')[1]
    } else if (arg === '--all') {
      options.all = true
    } else if (arg === '--verify-only') {
      options.verifyOnly = true
    } else if (arg === '--backup-only') {
      options.backupOnly = true
    } else if (arg.startsWith('--restore=')) {
      options.restore = arg.split('=')[1]
    } else if (arg.startsWith('--connection-string=')) {
      options.connectionString = arg.split('=')[1]
    } else if (arg.startsWith('--backup-dir=')) {
      options.backupDir = arg.split('=')[1]
    }
  }

  return options
}

async function getAllProjects(connectionString: string): Promise<Array<{
  ref: string
  database: string
  owner: string
}>> {
  const pool = new Pool({ connectionString })
  
  try {
    const result = await pool.query(`
      SELECT 
        ref as "ref",
        database_name as "database",
        owner_user_id as "owner"
      FROM projects
      WHERE status = 'active'
    `)
    
    return result.rows
  } finally {
    await pool.end()
  }
}

async function migrateProject(
  service: MigrationService,
  projectRef: string,
  database: string,
  owner: string
): Promise<void> {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`Migrating project: ${projectRef}`)
  console.log(`Database: ${database}`)
  console.log(`Owner: ${owner}`)
  console.log('='.repeat(60))

  const result = await service.migrateProject(projectRef, database, owner)

  if (result.success) {
    console.log('\n✅ Migration successful!')
    console.log(`Backup ID: ${result.backupId}`)
    console.log(`Migrated tables: ${result.migratedTables.join(', ')}`)
    
    if (result.verificationResults) {
      console.log('\nVerification Results:')
      console.log(`  Auth data integrity: ${result.verificationResults.checks.authDataIntegrity ? '✅' : '❌'}`)
      console.log(`  Storage data integrity: ${result.verificationResults.checks.storageDataIntegrity ? '✅' : '❌'}`)
      console.log(`  Row count match: ${result.verificationResults.checks.rowCountMatch ? '✅' : '❌'}`)
      
      if (result.verificationResults.details.rowCountComparison) {
        console.log('\nRow Count Comparison:')
        const comparison = result.verificationResults.details.rowCountComparison
        console.log(`  Auth users: ${comparison.authUsers.actual}/${comparison.authUsers.expected} ${comparison.authUsers.match ? '✅' : '❌'}`)
        console.log(`  Storage buckets: ${comparison.storageBuckets.actual}/${comparison.storageBuckets.expected} ${comparison.storageBuckets.match ? '✅' : '❌'}`)
      }
    }
  } else {
    console.log('\n❌ Migration failed!')
    console.log(`Error: ${result.error}`)
    if (result.backupId) {
      console.log(`Backup available at: ${result.backupId}`)
    }
    throw new Error(`Migration failed for project ${projectRef}`)
  }
}

async function backupProject(
  service: MigrationService,
  projectRef: string,
  database: string
): Promise<void> {
  console.log(`\nCreating backup for project: ${projectRef}`)
  
  const backup = await service.backupProjectData(projectRef, database)
  
  console.log('\n✅ Backup created successfully!')
  console.log(`Backup ID: ${backup.backupId}`)
  console.log(`Backup path: ${backup.backupPath}`)
  console.log(`Tables backed up: ${backup.tables.join(', ')}`)
  console.log('\nRow counts:')
  for (const [table, count] of Object.entries(backup.rowCounts)) {
    console.log(`  ${table}: ${count}`)
  }
}

async function restoreProject(
  service: MigrationService,
  backupId: string,
  database: string
): Promise<void> {
  console.log(`\nRestoring from backup: ${backupId}`)
  console.log(`Target database: ${database}`)
  
  await service.restoreFromBackup(backupId, database)
  
  console.log('\n✅ Restore completed successfully!')
}

async function main() {
  const options = await parseArgs()

  // Validate options
  if (!options.all && !options.projectRef) {
    console.error('Error: --project-ref is required (or use --all to migrate all projects)')
    process.exit(1)
  }

  if (!options.all && !options.restore && !options.database) {
    console.error('Error: --database is required')
    process.exit(1)
  }

  if (!options.all && !options.restore && !options.verifyOnly && !options.backupOnly && !options.owner) {
    console.error('Error: --owner is required for migration')
    process.exit(1)
  }

  // Get connection string
  const connectionString = options.connectionString || 
    process.env.DATABASE_URL || 
    'postgresql://postgres:postgres@localhost:5432/postgres'

  const backupDir = options.backupDir || '/var/lib/backups'

  console.log('Migration Script')
  console.log('================')
  console.log(`Connection: ${connectionString.replace(/:[^:@]+@/, ':****@')}`)
  console.log(`Backup directory: ${backupDir}`)

  const service = new MigrationService(connectionString, backupDir)

  try {
    // Handle restore operation
    if (options.restore) {
      if (!options.database) {
        console.error('Error: --database is required for restore')
        process.exit(1)
      }
      await restoreProject(service, options.restore, options.database)
      return
    }

    // Handle backup-only operation
    if (options.backupOnly) {
      if (!options.projectRef || !options.database) {
        console.error('Error: --project-ref and --database are required for backup')
        process.exit(1)
      }
      await backupProject(service, options.projectRef, options.database)
      return
    }

    // Handle migration
    if (options.all) {
      console.log('\nFetching all active projects...')
      const projects = await getAllProjects(connectionString)
      console.log(`Found ${projects.length} projects to migrate`)

      let successCount = 0
      let failureCount = 0

      for (const project of projects) {
        try {
          await migrateProject(service, project.ref, project.database, project.owner)
          successCount++
        } catch (error) {
          console.error(`Failed to migrate project ${project.ref}:`, error)
          failureCount++
        }
      }

      console.log(`\n${'='.repeat(60)}`)
      console.log('Migration Summary')
      console.log('='.repeat(60))
      console.log(`Total projects: ${projects.length}`)
      console.log(`Successful: ${successCount}`)
      console.log(`Failed: ${failureCount}`)
    } else {
      // Migrate single project
      await migrateProject(
        service,
        options.projectRef!,
        options.database!,
        options.owner!
      )
    }

    console.log('\n✅ All operations completed successfully!')
  } catch (error) {
    console.error('\n❌ Error:', error)
    process.exit(1)
  } finally {
    await service.close()
  }
}

// Run the script
main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
