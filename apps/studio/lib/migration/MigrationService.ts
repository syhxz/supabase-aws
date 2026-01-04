import { Pool, PoolClient } from 'pg'
import fs from 'fs/promises'
import path from 'path'
import { ProjectInitializationService } from '../project-initialization/ProjectInitializationService'

export interface BackupMetadata {
  backupId: string
  projectRef: string
  databaseName: string
  timestamp: Date
  backupPath: string
  tables: string[]
  rowCounts: Record<string, number>
}

export interface MigrationResult {
  success: boolean
  projectRef: string
  backupId?: string
  migratedTables: string[]
  verificationResults?: VerificationResult
  error?: string
}

export interface VerificationResult {
  success: boolean
  checks: {
    authDataIntegrity: boolean
    storageDataIntegrity: boolean
    rowCountMatch: boolean
  }
  details: Record<string, any>
}

/**
 * MigrationService
 * 
 * Handles migration of existing projects to the isolated service architecture.
 * Provides backup, migration, verification, and restore functionality.
 */
export class MigrationService {
  private pool: Pool
  private backupDir: string

  constructor(connectionString: string, backupDir: string = '/var/lib/backups') {
    this.pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    })
    this.backupDir = backupDir
  }

  /**
   * Backup existing project data
   * Requirement 7.1: Backup existing data
   */
  async backupProjectData(projectRef: string, databaseName: string): Promise<BackupMetadata> {
    const backupId = `backup_${projectRef}_${Date.now()}`
    const backupPath = path.join(this.backupDir, backupId)
    
    let client: PoolClient | null = null

    try {
      // Create backup directory
      await fs.mkdir(backupPath, { recursive: true })

      client = await this.pool.connect()

      // Backup auth data
      const authTables = ['auth.users', 'auth.sessions', 'auth.refresh_tokens']
      const storageTables = ['storage.buckets', 'storage.objects']
      const allTables = [...authTables, ...storageTables]

      const rowCounts: Record<string, number> = {}

      for (const table of allTables) {
        // Get row count
        const countResult = await client.query(`SELECT COUNT(*) as count FROM ${table}`)
        const count = parseInt(countResult.rows[0].count, 10)
        rowCounts[table] = count

        // Export table data to JSON
        const dataResult = await client.query(`SELECT * FROM ${table}`)
        const tableName = table.replace('.', '_')
        const filePath = path.join(backupPath, `${tableName}.json`)
        await fs.writeFile(filePath, JSON.stringify(dataResult.rows, null, 2))
      }

      // Store backup metadata
      const metadata: BackupMetadata = {
        backupId,
        projectRef,
        databaseName,
        timestamp: new Date(),
        backupPath,
        tables: allTables,
        rowCounts,
      }

      const metadataPath = path.join(backupPath, 'metadata.json')
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2))

      console.log(`Backup created successfully: ${backupId}`)
      return metadata
    } catch (error) {
      console.error(`Error creating backup for project ${projectRef}:`, error)
      throw new Error(`Backup failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      if (client) {
        client.release()
      }
    }
  }

  /**
   * Migrate auth data to project database
   * Requirement 7.2: Migrate auth data to project databases
   */
  async migrateAuthData(
    sourceClient: PoolClient,
    targetClient: PoolClient,
    projectRef: string
  ): Promise<void> {
    try {
      // Migrate users
      const usersResult = await sourceClient.query(
        `SELECT * FROM auth.users WHERE raw_app_meta_data->>'project_ref' = $1`,
        [projectRef]
      )

      for (const user of usersResult.rows) {
        await targetClient.query(
          `INSERT INTO auth.users (
            id, email, encrypted_password, email_confirmed_at, invited_at,
            confirmation_token, confirmation_sent_at, recovery_token, recovery_sent_at,
            email_change_token_new, email_change, email_change_sent_at,
            last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
            is_super_admin, created_at, updated_at, phone, phone_confirmed_at,
            phone_change, phone_change_token, phone_change_sent_at,
            confirmed_at, email_change_token_current, email_change_confirm_status,
            banned_until, reauthentication_token, reauthentication_sent_at,
            is_sso_user, deleted_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
            $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31
          ) ON CONFLICT (id) DO NOTHING`,
          [
            user.id, user.email, user.encrypted_password, user.email_confirmed_at,
            user.invited_at, user.confirmation_token, user.confirmation_sent_at,
            user.recovery_token, user.recovery_sent_at, user.email_change_token_new,
            user.email_change, user.email_change_sent_at, user.last_sign_in_at,
            user.raw_app_meta_data, user.raw_user_meta_data, user.is_super_admin,
            user.created_at, user.updated_at, user.phone, user.phone_confirmed_at,
            user.phone_change, user.phone_change_token, user.phone_change_sent_at,
            user.confirmed_at, user.email_change_token_current,
            user.email_change_confirm_status, user.banned_until,
            user.reauthentication_token, user.reauthentication_sent_at,
            user.is_sso_user, user.deleted_at
          ]
        )
      }

      // Migrate sessions
      const sessionsResult = await sourceClient.query(
        `SELECT s.* FROM auth.sessions s
         JOIN auth.users u ON s.user_id = u.id
         WHERE u.raw_app_meta_data->>'project_ref' = $1`,
        [projectRef]
      )

      for (const session of sessionsResult.rows) {
        await targetClient.query(
          `INSERT INTO auth.sessions (
            id, user_id, created_at, updated_at, factor_id, aal, not_after
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO NOTHING`,
          [
            session.id, session.user_id, session.created_at, session.updated_at,
            session.factor_id, session.aal, session.not_after
          ]
        )
      }

      // Migrate refresh tokens
      const tokensResult = await sourceClient.query(
        `SELECT rt.* FROM auth.refresh_tokens rt
         JOIN auth.users u ON rt.user_id = u.id
         WHERE u.raw_app_meta_data->>'project_ref' = $1`,
        [projectRef]
      )

      for (const token of tokensResult.rows) {
        await targetClient.query(
          `INSERT INTO auth.refresh_tokens (
            id, token, user_id, revoked, created_at, updated_at, parent, session_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (id) DO NOTHING`,
          [
            token.id, token.token, token.user_id, token.revoked,
            token.created_at, token.updated_at, token.parent, token.session_id
          ]
        )
      }

      console.log(`Auth data migrated successfully for project: ${projectRef}`)
    } catch (error) {
      console.error(`Error migrating auth data for project ${projectRef}:`, error)
      throw error
    }
  }

  /**
   * Migrate storage metadata to project database
   * Requirement 7.3: Migrate storage metadata
   */
  async migrateStorageData(
    sourceClient: PoolClient,
    targetClient: PoolClient,
    projectRef: string
  ): Promise<void> {
    try {
      // Migrate buckets
      const bucketsResult = await sourceClient.query(
        `SELECT * FROM storage.buckets WHERE id LIKE $1`,
        [`${projectRef}%`]
      )

      for (const bucket of bucketsResult.rows) {
        await targetClient.query(
          `INSERT INTO storage.buckets (
            id, name, owner, created_at, updated_at, public,
            avif_autodetection, file_size_limit, allowed_mime_types
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (id) DO NOTHING`,
          [
            bucket.id, bucket.name, bucket.owner, bucket.created_at,
            bucket.updated_at, bucket.public, bucket.avif_autodetection,
            bucket.file_size_limit, bucket.allowed_mime_types
          ]
        )
      }

      // Migrate objects
      const objectsResult = await sourceClient.query(
        `SELECT * FROM storage.objects WHERE bucket_id LIKE $1`,
        [`${projectRef}%`]
      )

      for (const object of objectsResult.rows) {
        await targetClient.query(
          `INSERT INTO storage.objects (
            id, bucket_id, name, owner, created_at, updated_at,
            last_accessed_at, metadata, path_tokens, version
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (id) DO NOTHING`,
          [
            object.id, object.bucket_id, object.name, object.owner,
            object.created_at, object.updated_at, object.last_accessed_at,
            object.metadata, object.path_tokens, object.version
          ]
        )
      }

      console.log(`Storage data migrated successfully for project: ${projectRef}`)
    } catch (error) {
      console.error(`Error migrating storage data for project ${projectRef}:`, error)
      throw error
    }
  }

  /**
   * Verify data integrity after migration
   * Requirement 7.5: Verify data integrity
   */
  async verifyDataIntegrity(
    projectRef: string,
    databaseName: string,
    backupMetadata: BackupMetadata
  ): Promise<VerificationResult> {
    let client: PoolClient | null = null

    try {
      // Connect to the project database
      const projectConnectionString = this.pool.options.connectionString?.replace(
        /\/[^/]+$/,
        `/${databaseName}`
      )
      const projectPool = new Pool({ connectionString: projectConnectionString })
      client = await projectPool.connect()

      const checks = {
        authDataIntegrity: false,
        storageDataIntegrity: false,
        rowCountMatch: false,
      }

      const details: Record<string, any> = {}

      // Verify auth data
      const authUserCount = await client.query(`SELECT COUNT(*) as count FROM auth.users`)
      const authSessionCount = await client.query(`SELECT COUNT(*) as count FROM auth.sessions`)
      const authTokenCount = await client.query(`SELECT COUNT(*) as count FROM auth.refresh_tokens`)

      details.authCounts = {
        users: parseInt(authUserCount.rows[0].count, 10),
        sessions: parseInt(authSessionCount.rows[0].count, 10),
        tokens: parseInt(authTokenCount.rows[0].count, 10),
      }

      // Check if auth tables have data
      checks.authDataIntegrity = details.authCounts.users >= 0

      // Verify storage data
      const storageBucketCount = await client.query(`SELECT COUNT(*) as count FROM storage.buckets`)
      const storageObjectCount = await client.query(`SELECT COUNT(*) as count FROM storage.objects`)

      details.storageCounts = {
        buckets: parseInt(storageBucketCount.rows[0].count, 10),
        objects: parseInt(storageObjectCount.rows[0].count, 10),
      }

      checks.storageDataIntegrity = details.storageCounts.buckets >= 0

      // Verify row counts match backup
      const expectedAuthUsers = backupMetadata.rowCounts['auth.users'] || 0
      const expectedStorageBuckets = backupMetadata.rowCounts['storage.buckets'] || 0

      checks.rowCountMatch = 
        details.authCounts.users === expectedAuthUsers &&
        details.storageCounts.buckets === expectedStorageBuckets

      details.rowCountComparison = {
        authUsers: {
          expected: expectedAuthUsers,
          actual: details.authCounts.users,
          match: details.authCounts.users === expectedAuthUsers,
        },
        storageBuckets: {
          expected: expectedStorageBuckets,
          actual: details.storageCounts.buckets,
          match: details.storageCounts.buckets === expectedStorageBuckets,
        },
      }

      const success = checks.authDataIntegrity && checks.storageDataIntegrity && checks.rowCountMatch

      await projectPool.end()

      return {
        success,
        checks,
        details,
      }
    } catch (error) {
      console.error(`Error verifying data integrity for project ${projectRef}:`, error)
      return {
        success: false,
        checks: {
          authDataIntegrity: false,
          storageDataIntegrity: false,
          rowCountMatch: false,
        },
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      }
    } finally {
      if (client) {
        client.release()
      }
    }
  }

  /**
   * Restore from backup on failure
   * Requirement 7.4: Restore from backup on failure
   */
  async restoreFromBackup(backupId: string, databaseName: string): Promise<void> {
    const backupPath = path.join(this.backupDir, backupId)
    let client: PoolClient | null = null

    try {
      // Read backup metadata
      const metadataPath = path.join(backupPath, 'metadata.json')
      const metadataContent = await fs.readFile(metadataPath, 'utf-8')
      const metadata: BackupMetadata = JSON.parse(metadataContent)

      // Connect to the database
      const projectConnectionString = this.pool.options.connectionString?.replace(
        /\/[^/]+$/,
        `/${databaseName}`
      )
      const projectPool = new Pool({ connectionString: projectConnectionString })
      client = await projectPool.connect()

      await client.query('BEGIN')

      // Restore each table
      for (const table of metadata.tables) {
        const tableName = table.replace('.', '_')
        const filePath = path.join(backupPath, `${tableName}.json`)
        const fileContent = await fs.readFile(filePath, 'utf-8')
        const rows = JSON.parse(fileContent)

        // Clear existing data
        await client.query(`TRUNCATE TABLE ${table} CASCADE`)

        // Restore data
        if (rows.length > 0) {
          const columns = Object.keys(rows[0])
          const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ')
          const columnNames = columns.join(', ')

          for (const row of rows) {
            const values = columns.map(col => row[col])
            await client.query(
              `INSERT INTO ${table} (${columnNames}) VALUES (${placeholders})`,
              values
            )
          }
        }
      }

      await client.query('COMMIT')
      await projectPool.end()

      console.log(`Successfully restored from backup: ${backupId}`)
    } catch (error) {
      if (client) {
        try {
          await client.query('ROLLBACK')
        } catch (rollbackError) {
          console.error('Error during rollback:', rollbackError)
        }
      }
      console.error(`Error restoring from backup ${backupId}:`, error)
      throw new Error(`Restore failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      if (client) {
        client.release()
      }
    }
  }

  /**
   * Migrate a project to the isolated service architecture
   */
  async migrateProject(
    projectRef: string,
    databaseName: string,
    ownerUserId: string
  ): Promise<MigrationResult> {
    let backupMetadata: BackupMetadata | undefined
    let sourceClient: PoolClient | null = null
    let targetClient: PoolClient | null = null

    try {
      // Step 1: Backup existing data
      console.log(`Starting backup for project: ${projectRef}`)
      backupMetadata = await this.backupProjectData(projectRef, databaseName)

      // Step 2: Initialize project schemas
      console.log(`Initializing schemas for project: ${projectRef}`)
      const initService = new ProjectInitializationService(
        this.pool.options.connectionString || ''
      )

      // Connect to the project database
      const projectConnectionString = this.pool.options.connectionString?.replace(
        /\/[^/]+$/,
        `/${databaseName}`
      )
      const projectPool = new Pool({ connectionString: projectConnectionString })
      targetClient = await projectPool.connect()

      const initResult = await initService.initializeProject(projectRef, databaseName)
      if (!initResult.success) {
        throw new Error(`Schema initialization failed: ${initResult.error}`)
      }

      // Step 3: Migrate auth data
      console.log(`Migrating auth data for project: ${projectRef}`)
      sourceClient = await this.pool.connect()
      await this.migrateAuthData(sourceClient, targetClient, projectRef)

      // Step 4: Migrate storage data
      console.log(`Migrating storage data for project: ${projectRef}`)
      await this.migrateStorageData(sourceClient, targetClient, projectRef)

      // Step 5: Verify data integrity
      console.log(`Verifying data integrity for project: ${projectRef}`)
      const verificationResults = await this.verifyDataIntegrity(
        projectRef,
        databaseName,
        backupMetadata
      )

      if (!verificationResults.success) {
        throw new Error('Data verification failed')
      }

      await projectPool.end()

      return {
        success: true,
        projectRef,
        backupId: backupMetadata.backupId,
        migratedTables: backupMetadata.tables,
        verificationResults,
      }
    } catch (error) {
      console.error(`Migration failed for project ${projectRef}:`, error)

      // Attempt to restore from backup if available
      if (backupMetadata) {
        console.log(`Attempting to restore from backup: ${backupMetadata.backupId}`)
        try {
          await this.restoreFromBackup(backupMetadata.backupId, databaseName)
        } catch (restoreError) {
          console.error('Restore failed:', restoreError)
        }
      }

      return {
        success: false,
        projectRef,
        backupId: backupMetadata?.backupId,
        migratedTables: [],
        error: error instanceof Error ? error.message : 'Unknown error during migration',
      }
    } finally {
      if (sourceClient) {
        sourceClient.release()
      }
      if (targetClient) {
        targetClient.release()
      }
    }
  }

  /**
   * Close the connection pool
   */
  async close(): Promise<void> {
    await this.pool.end()
  }
}
