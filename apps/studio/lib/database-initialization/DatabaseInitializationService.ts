import { Pool } from 'pg'
import fs from 'fs/promises'
import path from 'path'

/**
 * Database Initialization Service
 * 
 * Handles automatic initialization of template and system databases
 * on application startup. This ensures that all required databases
 * and schemas are available without manual intervention.
 */
export class DatabaseInitializationService {
  private pool: Pool

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    })
  }

  /**
   * Initialize all required databases and schemas
   */
  async initializeAll(): Promise<void> {
    console.log('[DatabaseInitializationService] Starting database initialization...')

    try {
      // Step 1: Initialize _supabase database for system data
      await this.initializeSupabaseDatabase()

      // Step 2: Initialize template database for project creation
      await this.initializeTemplateDatabase()

      // Step 3: Initialize studio_projects table
      await this.initializeStudioProjectsTable()

      console.log('[DatabaseInitializationService] ✓ All databases initialized successfully')
    } catch (error) {
      console.error('[DatabaseInitializationService] ✗ Database initialization failed:', error)
      throw error
    }
  }

  /**
   * Initialize _supabase database for system analytics and logs
   */
  private async initializeSupabaseDatabase(): Promise<void> {
    console.log('[DatabaseInitializationService] Initializing _supabase database...')

    const client = await this.pool.connect()
    try {
      // Check if _supabase database exists
      const dbExists = await client.query(
        'SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1) as exists',
        ['_supabase']
      )

      if (!dbExists.rows[0].exists) {
        console.log('[DatabaseInitializationService] Creating _supabase database...')
        await client.query('CREATE DATABASE "_supabase"')
        console.log('[DatabaseInitializationService] ✓ _supabase database created')
      } else {
        console.log('[DatabaseInitializationService] ✓ _supabase database already exists')
      }

      // Initialize _supabase database schemas
      await this.initializeSupabaseSchemas()

    } finally {
      client.release()
    }
  }

  /**
   * Initialize schemas in _supabase database
   */
  private async initializeSupabaseSchemas(): Promise<void> {
    console.log('[DatabaseInitializationService] Initializing _supabase schemas...')

    // Create a new connection to _supabase database
    const supabaseConnectionString = this.pool.options.connectionString?.replace('/postgres', '/_supabase')
    if (!supabaseConnectionString) {
      throw new Error('Could not construct _supabase connection string')
    }

    const supabasePool = new Pool({
      connectionString: supabaseConnectionString,
      max: 2,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    })

    const client = await supabasePool.connect()
    try {
      // Create _analytics schema for logflare
      await client.query('CREATE SCHEMA IF NOT EXISTS _analytics')
      console.log('[DatabaseInitializationService] ✓ _analytics schema created')

      // Create basic tables for analytics (simplified version)
      await client.query(`
        CREATE TABLE IF NOT EXISTS _analytics.logs (
          id BIGSERIAL PRIMARY KEY,
          timestamp TIMESTAMPTZ DEFAULT NOW(),
          level TEXT,
          message TEXT,
          metadata JSONB,
          source TEXT
        )
      `)

      console.log('[DatabaseInitializationService] ✓ _supabase schemas initialized')
    } finally {
      client.release()
      await supabasePool.end()
    }
  }

  /**
   * Initialize template database for project creation
   */
  private async initializeTemplateDatabase(): Promise<void> {
    console.log('[DatabaseInitializationService] Initializing template database...')

    const client = await this.pool.connect()
    try {
      // Check if template database exists
      const dbExists = await client.query(
        'SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1) as exists',
        ['supabase_template']
      )

      if (!dbExists.rows[0].exists) {
        console.log('[DatabaseInitializationService] Creating supabase_template database...')
        await client.query('CREATE DATABASE "supabase_template"')
        console.log('[DatabaseInitializationService] ✓ supabase_template database created')

        // Initialize template database with complete schemas
        await this.initializeTemplateSchemas()
      } else {
        console.log('[DatabaseInitializationService] ✓ supabase_template database already exists')
        
        // Always run schema updates to ensure template is up-to-date
        await this.updateTemplateSchemas()
      }

    } finally {
      client.release()
    }
  }

  /**
   * Initialize complete schemas in template database
   */
  private async initializeTemplateSchemas(): Promise<void> {
    console.log('[DatabaseInitializationService] Initializing template database schemas...')

    // Create a new connection to template database
    const templateConnectionString = this.pool.options.connectionString?.replace('/postgres', '/supabase_template')
    if (!templateConnectionString) {
      throw new Error('Could not construct template connection string')
    }

    const templatePool = new Pool({
      connectionString: templateConnectionString,
      max: 2,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    })

    const client = await templatePool.connect()
    try {
      // Initialize all schemas using the same SQL files as ProjectInitializationService
      await this.runSchemaFile(client, 'auth-schema.sql')
      console.log('[DatabaseInitializationService] ✓ Auth schema initialized in template')

      await this.runSchemaFile(client, 'storage-schema.sql')
      console.log('[DatabaseInitializationService] ✓ Storage schema initialized in template')

      await this.runSchemaFile(client, 'webhooks-schema.sql')
      console.log('[DatabaseInitializationService] ✓ Webhooks schema initialized in template')

      await this.runSchemaFile(client, 'analytics-schema.sql')
      console.log('[DatabaseInitializationService] ✓ Analytics schema initialized in template')

      // Run migrations to ensure all columns are present
      await this.runSchemaFile(client, 'migrate-storage-schema.sql')
      console.log('[DatabaseInitializationService] ✓ Storage schema migration completed in template')

    } finally {
      client.release()
      await templatePool.end()
    }
  }

  /**
   * Update template database schemas to latest version
   */
  private async updateTemplateSchemas(): Promise<void> {
    console.log('[DatabaseInitializationService] Updating template database schemas...')

    const templateConnectionString = this.pool.options.connectionString?.replace('/postgres', '/supabase_template')
    if (!templateConnectionString) {
      throw new Error('Could not construct template connection string')
    }

    const templatePool = new Pool({
      connectionString: templateConnectionString,
      max: 2,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    })

    const client = await templatePool.connect()
    try {
      // Run migrations to ensure template has latest schema
      await this.runSchemaFile(client, 'migrate-storage-schema.sql')
      console.log('[DatabaseInitializationService] ✓ Template storage schema updated')

    } catch (error) {
      console.warn('[DatabaseInitializationService] Template schema update failed (may be expected):', error)
    } finally {
      client.release()
      await templatePool.end()
    }
  }

  /**
   * Initialize studio_projects table in main database
   */
  private async initializeStudioProjectsTable(): Promise<void> {
    console.log('[DatabaseInitializationService] Initializing studio_projects table...')

    const client = await this.pool.connect()
    try {
      // Check if studio_projects table exists
      const tableExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'studio_projects'
        )
      `)

      if (!tableExists.rows[0].exists) {
        console.log('[DatabaseInitializationService] Creating studio_projects table...')
        
        // Read and execute the migration SQL
        const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '20241128_create_studio_projects_table.sql')
        const migrationSql = await fs.readFile(migrationPath, 'utf-8')
        await client.query(migrationSql)
        
        console.log('[DatabaseInitializationService] ✓ studio_projects table created')
      } else {
        console.log('[DatabaseInitializationService] ✓ studio_projects table already exists')
      }

    } finally {
      client.release()
    }
  }

  /**
   * Run a schema SQL file
   */
  private async runSchemaFile(client: any, filename: string): Promise<void> {
    const sqlPath = this.getSqlFilePath(filename)
    const sql = await fs.readFile(sqlPath, 'utf-8')
    await client.query(sql)
  }

  /**
   * Get the absolute path to an SQL file
   */
  private getSqlFilePath(filename: string): string {
    // Try multiple paths to find the SQL file
    const possiblePaths = [
      path.join(__dirname, '..', 'project-initialization', 'sql', filename),
      path.join(process.cwd(), 'apps', 'studio', 'lib', 'project-initialization', 'sql', filename),
      path.join('/app', 'apps', 'studio', 'lib', 'project-initialization', 'sql', filename),
    ]

    for (const sqlPath of possiblePaths) {
      try {
        // Check if file exists synchronously
        require('fs').accessSync(sqlPath)
        return sqlPath
      } catch {
        // File doesn't exist, try next path
        continue
      }
    }

    throw new Error(`SQL file not found: ${filename}. Tried paths: ${possiblePaths.join(', ')}`)
  }

  /**
   * Close the connection pool
   */
  async close(): Promise<void> {
    await this.pool.end()
  }
}

/**
 * Initialize databases on application startup
 */
export async function initializeDatabasesOnStartup(): Promise<void> {
  const connectionString = process.env.DATABASE_URL || 
    `postgresql://postgres:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST || 'db'}:${process.env.POSTGRES_PORT || 5432}/postgres`

  const initService = new DatabaseInitializationService(connectionString)
  
  try {
    await initService.initializeAll()
  } finally {
    await initService.close()
  }
}