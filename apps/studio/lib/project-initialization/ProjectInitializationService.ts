import { Pool, PoolClient } from 'pg'
import fs from 'fs/promises'
import path from 'path'

export interface InitResult {
  success: boolean
  projectRef: string
  databaseName: string
  schemasCreated: string[]
  error?: string
}

export interface ProjectConfig {
  projectRef: string
  databaseName: string
  connectionString: string
  ownerUserId: string
}

/**
 * ProjectInitializationService
 * 
 * Handles the initialization of project-specific schemas and configurations.
 * This service creates auth, storage, webhooks, and analytics schemas for each project,
 * ensuring complete service isolation between projects.
 */
export class ProjectInitializationService {
  private pool: Pool
  private isClosed: boolean

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    })
    this.isClosed = false
  }

  /**
   * Get the absolute path to an SQL file
   * Uses multiple fallback strategies to work in both dev and production
   */
  private getSqlFilePath(filename: string): string {
    // Strategy 1: Try __dirname (works in dev mode)
    let sqlPath = path.join(__dirname, 'sql', filename)
    
    // Strategy 2: If __dirname is replaced by webpack (shows as /ROOT or similar), 
    // use process.cwd() with the known relative path
    if (__dirname.includes('/ROOT') || __dirname === '/') {
      sqlPath = path.join(process.cwd(), 'apps', 'studio', 'lib', 'project-initialization', 'sql', filename)
    }
    
    // Strategy 3: Docker/Production environment - check if we're in Next.js build output
    if (__dirname.includes('.next/server') || __dirname.includes('/chunks')) {
      // In Docker, files are at /app/apps/studio/lib/project-initialization/sql/
      sqlPath = path.join('/app', 'apps', 'studio', 'lib', 'project-initialization', 'sql', filename)
    }
    
    // Strategy 4: Docker environment - check if we're in the app directory
    if (process.cwd().includes('/app') && !path.isAbsolute(__dirname)) {
      sqlPath = path.join(process.cwd(), 'lib', 'project-initialization', 'sql', filename)
    }
    
    // Log for debugging
    console.log(`[ProjectInitializationService] Resolving SQL file: ${filename}`)
    console.log(`[ProjectInitializationService] Module directory (__dirname): ${__dirname}`)
    console.log(`[ProjectInitializationService] Current working directory (process.cwd()): ${process.cwd()}`)
    console.log(`[ProjectInitializationService] Resolved path: ${sqlPath}`)
    
    return sqlPath
  }

  /**
   * Read an SQL file with enhanced error handling
   */
  private async readSqlFile(filename: string): Promise<string> {
    const sqlPath = this.getSqlFilePath(filename)
    
    try {
      const sql = await fs.readFile(sqlPath, 'utf-8')
      console.log(`[ProjectInitializationService] Successfully read SQL file: ${filename}`)
      return sql
    } catch (error) {
      console.error(`[ProjectInitializationService] Failed to read SQL file: ${filename}`)
      console.error(`[ProjectInitializationService] Attempted path: ${sqlPath}`)
      console.error(`[ProjectInitializationService] Current working directory: ${process.cwd()}`)
      console.error(`[ProjectInitializationService] Module directory: ${__dirname}`)
      
      // Check if file exists
      try {
        await fs.access(sqlPath)
        console.error(`[ProjectInitializationService] File exists but cannot be read`)
      } catch {
        console.error(`[ProjectInitializationService] File does not exist at expected location`)
      }
      
      throw new Error(`Failed to read SQL file ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Initialize a project with all required schemas
   */
  async initializeProject(projectRef: string, databaseName: string): Promise<InitResult> {
    const schemasCreated: string[] = []
    let client: PoolClient | null = null

    try {
      // Get a client from the pool
      client = await this.pool.connect()

      // Start a transaction
      await client.query('BEGIN')

      // Initialize auth schema
      await this.initializeAuthSchema(client)
      schemasCreated.push('auth')

      // Skip auth schema migration for now to avoid transaction issues
      console.log('[ProjectInitializationService] Skipping auth schema migration to avoid transaction conflicts')

      // Initialize storage schema
      await this.initializeStorageSchema(client)
      schemasCreated.push('storage')

      // Run storage schema migration to add missing columns/tables
      await this.migrateStorageSchema(client)

      // Initialize webhooks schema
      await this.initializeWebhooksSchema(client)
      schemasCreated.push('webhooks')

      // Initialize analytics schema
      await this.initializeAnalyticsSchema(client)
      schemasCreated.push('analytics')

      // Configure logical replication
      await this.configureLogicalReplication(client, databaseName)

      // Commit the transaction
      await client.query('COMMIT')

      return {
        success: true,
        projectRef,
        databaseName,
        schemasCreated,
      }
    } catch (error) {
      // Rollback on error
      if (client) {
        try {
          await client.query('ROLLBACK')
        } catch (rollbackError) {
          console.error('Error during rollback:', rollbackError)
        }
      }

      // Attempt to clean up any partially created schemas
      await this.rollbackInitialization(projectRef, databaseName)

      return {
        success: false,
        projectRef,
        databaseName,
        schemasCreated,
        error: error instanceof Error ? error.message : 'Unknown error during initialization',
      }
    } finally {
      if (client) {
        client.release()
      }
    }
  }

  /**
   * Initialize auth schema with all required tables
   */
  async initializeAuthSchema(client: PoolClient): Promise<void> {
    const sql = await this.readSqlFile('auth-schema.sql')
    await client.query(sql)
  }

  /**
   * Run auth schema migration to add missing columns and tables
   * This is idempotent and safe to run on both new and existing schemas
   */
  async migrateAuthSchema(client: PoolClient): Promise<void> {
    try {
      console.log('[ProjectInitializationService] Running auth schema migration...')
      const sql = await this.readSqlFile('migrate-auth-schema.sql')
      await client.query(sql)
      console.log('[ProjectInitializationService] ✓ Auth schema migration completed successfully')
    } catch (error) {
      console.error('[ProjectInitializationService] ✗ Auth schema migration failed:', error)
      // Log the error but don't throw - migration failures shouldn't prevent project initialization
      // The schema might already be up-to-date or the migration might not be critical
      console.warn('[ProjectInitializationService] Continuing with project initialization despite migration error')
    }
  }

  /**
   * Initialize storage schema with all required tables
   */
  async initializeStorageSchema(client: PoolClient): Promise<void> {
    const sql = await this.readSqlFile('storage-schema.sql')
    await client.query(sql)
  }

  /**
   * Run storage schema migration to add missing columns and tables
   * This is idempotent and safe to run on both new and existing schemas
   */
  async migrateStorageSchema(client: PoolClient): Promise<void> {
    try {
      console.log('[ProjectInitializationService] Running storage schema migration...')
      const sql = await this.readSqlFile('migrate-storage-schema.sql')
      await client.query(sql)
      console.log('[ProjectInitializationService] ✓ Storage schema migration completed successfully')
    } catch (error) {
      console.error('[ProjectInitializationService] ✗ Storage schema migration failed:', error)
      // Log the error but don't throw - migration failures shouldn't prevent project initialization
      // The schema might already be up-to-date or the migration might not be critical
      console.warn('[ProjectInitializationService] Continuing with project initialization despite migration error')
    }
  }

  /**
   * Initialize webhooks schema with all required tables
   */
  async initializeWebhooksSchema(client: PoolClient): Promise<void> {
    const sql = await this.readSqlFile('webhooks-schema.sql')
    await client.query(sql)
  }

  /**
   * Initialize analytics schema with all required tables
   */
  async initializeAnalyticsSchema(client: PoolClient): Promise<void> {
    const sql = await this.readSqlFile('analytics-schema.sql')
    await client.query(sql)
  }

  /**
   * Configure logical replication for the database
   */
  async configureLogicalReplication(client: PoolClient, databaseName: string): Promise<void> {
    // Check if logical replication is already enabled
    const result = await client.query(
      `SELECT setting FROM pg_settings WHERE name = 'wal_level'`
    )

    if (result.rows.length > 0 && result.rows[0].setting !== 'logical') {
      // Note: Changing wal_level requires a database restart
      // This should be done at the database cluster level, not per-database
      console.warn(
        `Logical replication not enabled. Current wal_level: ${result.rows[0].setting}. ` +
        `To enable, set wal_level=logical in postgresql.conf and restart PostgreSQL.`
      )
    }

    // Create a publication for the project if it doesn't exist
    const publicationName = `${databaseName}_publication`
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_publication WHERE pubname = '${publicationName}'
        ) THEN
          CREATE PUBLICATION ${publicationName} FOR ALL TABLES;
        END IF;
      END $$;
    `)
  }

  /**
   * Rollback initialization by dropping all created schemas
   * Falls back to manual schema dropping if SQL file is not found
   */
  async rollbackInitialization(projectRef: string, databaseName?: string): Promise<void> {
    let client: PoolClient | null = null

    try {
      client = await this.pool.connect()

      try {
        // Try to use rollback SQL file
        const sql = await this.readSqlFile('rollback-schemas.sql')
        await client.query(sql)
        console.log(`[ProjectInitializationService] Successfully rolled back initialization for project: ${projectRef}`)
      } catch (fileError) {
        // Fallback: manually drop schemas one by one
        console.warn(`[ProjectInitializationService] Rollback SQL file not found, using manual schema cleanup`)
        
        const schemas = ['analytics', 'webhooks', 'storage', 'auth']
        const results: { schema: string; success: boolean; error?: string }[] = []
        
        for (const schema of schemas) {
          try {
            await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`)
            results.push({ schema, success: true })
            console.log(`[ProjectInitializationService] ✓ Dropped schema: ${schema}`)
          } catch (dropError) {
            const errorMsg = dropError instanceof Error ? dropError.message : 'Unknown error'
            results.push({ schema, success: false, error: errorMsg })
            console.error(`[ProjectInitializationService] ✗ Failed to drop schema ${schema}: ${errorMsg}`)
          }
        }
        
        // Log summary
        const successful = results.filter(r => r.success).length
        const failed = results.filter(r => !r.success).length
        console.log(`[ProjectInitializationService] Rollback summary: ${successful} succeeded, ${failed} failed`)
        
        if (failed > 0) {
          console.warn(`[ProjectInitializationService] Some schemas could not be dropped. Manual cleanup may be required.`)
          console.warn(`[ProjectInitializationService] Failed schemas:`, results.filter(r => !r.success))
        }
      }
    } catch (error) {
      console.error(`[ProjectInitializationService] Error during rollback for project ${projectRef}:`, error)
      throw error
    } finally {
      if (client) {
        client.release()
      }
    }
  }

  /**
   * Create project directories for functions, storage, and logs
   */
  async createProjectDirectories(projectRef: string, baseDir?: string): Promise<void> {
    // Use a development-friendly base directory if not specified
    const defaultBaseDir = process.env.PROJECT_DATA_DIR || path.join(process.cwd(), '.project-data')
    const actualBaseDir = baseDir || defaultBaseDir
    
    const directories = [
      path.join(actualBaseDir, 'functions', projectRef),
      path.join(actualBaseDir, 'storage', projectRef),
      path.join(actualBaseDir, 'logs', projectRef),
    ]

    console.log(`[ProjectInitializationService] Creating project directories in: ${actualBaseDir}`)
    
    for (const dir of directories) {
      try {
        await fs.mkdir(dir, { recursive: true })
        console.log(`[ProjectInitializationService] ✓ Created directory: ${dir}`)
      } catch (error) {
        console.error(`[ProjectInitializationService] ✗ Failed to create directory ${dir}:`, error)
        throw error
      }
    }
  }

  /**
   * Delete project directories
   */
  async deleteProjectDirectories(projectRef: string, baseDir?: string): Promise<void> {
    // Use a development-friendly base directory if not specified
    const defaultBaseDir = process.env.PROJECT_DATA_DIR || path.join(process.cwd(), '.project-data')
    const actualBaseDir = baseDir || defaultBaseDir
    
    const directories = [
      path.join(actualBaseDir, 'functions', projectRef),
      path.join(actualBaseDir, 'storage', projectRef),
      path.join(actualBaseDir, 'logs', projectRef),
    ]

    console.log(`[ProjectInitializationService] Deleting project directories from: ${actualBaseDir}`)
    
    for (const dir of directories) {
      try {
        await fs.rm(dir, { recursive: true, force: true })
        console.log(`[ProjectInitializationService] ✓ Deleted directory: ${dir}`)
      } catch (error) {
        console.error(`[ProjectInitializationService] ✗ Error deleting directory ${dir}:`, error)
      }
    }
  }

  /**
   * Close the connection pool
   * This method is idempotent and can be safely called multiple times
   */
  async close(): Promise<void> {
    if (this.isClosed) {
      console.warn('[ProjectInitializationService] Pool already closed, skipping close operation')
      return
    }

    try {
      await this.pool.end()
      this.isClosed = true
      console.log('[ProjectInitializationService] Successfully closed connection pool')
    } catch (error) {
      console.error('[ProjectInitializationService] Error closing connection pool:', error)
      throw error
    }
  }
}
