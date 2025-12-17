import { Pool, PoolClient } from 'pg'
import fs from 'fs/promises'
import path from 'path'

export interface RepairResult {
  success: boolean
  databaseName: string
  schemasRepaired: string[]
  error?: string
}

export interface DatabaseInfo {
  name: string
  isTemplate: boolean
  isMainDatabase: boolean
}

/**
 * SchemaRepairService
 * 
 * Repairs missing or incomplete schemas in existing databases.
 * This service ensures all databases (main, template, and project databases)
 * have the complete and up-to-date schema structure.
 */
export class SchemaRepairService {
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
   */
  private getSqlFilePath(filename: string): string {
    let sqlPath = path.join(__dirname, 'sql', filename)
    
    if (__dirname.includes('/ROOT') || __dirname === '/') {
      sqlPath = path.join(process.cwd(), 'apps', 'studio', 'lib', 'project-initialization', 'sql', filename)
    }
    
    return sqlPath
  }

  /**
   * Read an SQL file
   */
  private async readSqlFile(filename: string): Promise<string> {
    const sqlPath = this.getSqlFilePath(filename)
    
    try {
      const sql = await fs.readFile(sqlPath, 'utf-8')
      return sql
    } catch (error) {
      throw new Error(`Failed to read SQL file ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get all databases that need schema repair
   */
  async getAllDatabases(): Promise<DatabaseInfo[]> {
    const client = await this.pool.connect()
    
    try {
      // Get all databases
      const result = await client.query(`
        SELECT datname 
        FROM pg_database 
        WHERE datistemplate = false 
        AND datname NOT IN ('postgres', 'template0', 'template1')
        ORDER BY datname
      `)

      const databases: DatabaseInfo[] = []

      // Add main postgres database
      databases.push({
        name: 'postgres',
        isTemplate: false,
        isMainDatabase: true,
      })

      // Add template database if it exists
      const templateDbName = process.env.TEMPLATE_DATABASE_NAME || 'supabase_template'
      const templateExists = await client.query(
        'SELECT 1 FROM pg_database WHERE datname = $1',
        [templateDbName]
      )
      
      if (templateExists.rows.length > 0) {
        databases.push({
          name: templateDbName,
          isTemplate: true,
          isMainDatabase: false,
        })
      }

      // Add project databases
      for (const row of result.rows) {
        const dbName = row.datname
        if (dbName !== templateDbName) {
          databases.push({
            name: dbName,
            isTemplate: false,
            isMainDatabase: false,
          })
        }
      }

      return databases
    } finally {
      client.release()
    }
  }

  /**
   * Repair schemas for all databases
   */
  async repairAllDatabases(): Promise<RepairResult[]> {
    const databases = await this.getAllDatabases()
    const results: RepairResult[] = []

    console.log(`[SchemaRepairService] Found ${databases.length} databases to repair`)

    for (const db of databases) {
      console.log(`[SchemaRepairService] Repairing database: ${db.name} (template: ${db.isTemplate}, main: ${db.isMainDatabase})`)
      
      try {
        const result = await this.repairDatabase(db.name)
        results.push(result)
        
        if (result.success) {
          console.log(`[SchemaRepairService] ✓ Successfully repaired ${db.name}`)
        } else {
          console.error(`[SchemaRepairService] ✗ Failed to repair ${db.name}: ${result.error}`)
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        results.push({
          success: false,
          databaseName: db.name,
          schemasRepaired: [],
          error: errorMsg,
        })
        console.error(`[SchemaRepairService] ✗ Error repairing ${db.name}: ${errorMsg}`)
      }
    }

    return results
  }

  /**
   * Repair schemas for a specific database
   */
  async repairDatabase(databaseName: string): Promise<RepairResult> {
    const schemasRepaired: string[] = []
    
    // Create a new pool for the specific database
    const dbConnectionString = this.pool.options.connectionString?.replace(/\/[^\/]*$/, `/${databaseName}`)
    if (!dbConnectionString) {
      throw new Error('Could not determine database connection string')
    }

    const dbPool = new Pool({
      connectionString: dbConnectionString,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    })

    let client: PoolClient | null = null

    try {
      client = await dbPool.connect()
      await client.query('BEGIN')

      // Repair auth schema
      if (await this.repairAuthSchema(client)) {
        schemasRepaired.push('auth')
      }

      // Repair storage schema
      if (await this.repairStorageSchema(client)) {
        schemasRepaired.push('storage')
      }

      // Repair webhooks schema
      if (await this.repairWebhooksSchema(client)) {
        schemasRepaired.push('webhooks')
      }

      // Repair analytics schema
      if (await this.repairAnalyticsSchema(client)) {
        schemasRepaired.push('analytics')
      }

      await client.query('COMMIT')

      return {
        success: true,
        databaseName,
        schemasRepaired,
      }
    } catch (error) {
      if (client) {
        try {
          await client.query('ROLLBACK')
        } catch (rollbackError) {
          console.error('Error during rollback:', rollbackError)
        }
      }

      return {
        success: false,
        databaseName,
        schemasRepaired,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    } finally {
      if (client) {
        client.release()
      }
      await dbPool.end()
    }
  }

  /**
   * Repair auth schema
   */
  private async repairAuthSchema(client: PoolClient): Promise<boolean> {
    try {
      // Create schema if it doesn't exist
      await client.query('CREATE SCHEMA IF NOT EXISTS auth')

      // Check if auth.users table exists
      const tableExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'auth' AND table_name = 'users'
        )
      `)

      if (!tableExists.rows[0].exists) {
        // Create complete auth schema
        const sql = await this.readSqlFile('auth-schema.sql')
        await client.query(sql)
        console.log(`[SchemaRepairService] Created complete auth schema`)
        return true
      } else {
        // Run migration to add any missing columns/tables
        try {
          const migrationSql = await this.readSqlFile('migrate-auth-schema.sql')
          await client.query(migrationSql)
          console.log(`[SchemaRepairService] Applied auth schema migration`)
          return true
        } catch (error) {
          console.warn(`[SchemaRepairService] Auth migration failed (may be already up-to-date): ${error}`)
          return false
        }
      }
    } catch (error) {
      console.error(`[SchemaRepairService] Error repairing auth schema: ${error}`)
      throw error
    }
  }

  /**
   * Repair storage schema
   */
  private async repairStorageSchema(client: PoolClient): Promise<boolean> {
    try {
      // Create schema if it doesn't exist
      await client.query('CREATE SCHEMA IF NOT EXISTS storage')

      // Check if storage.buckets table exists
      const tableExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'storage' AND table_name = 'buckets'
        )
      `)

      if (!tableExists.rows[0].exists) {
        // Create complete storage schema
        const sql = await this.readSqlFile('storage-schema.sql')
        await client.query(sql)
        console.log(`[SchemaRepairService] Created complete storage schema`)
        return true
      } else {
        // Check and add missing columns
        let repaired = false

        // Check for missing columns in storage.buckets
        const bucketsColumns = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_schema = 'storage' AND table_name = 'buckets'
        `)

        const existingColumns = bucketsColumns.rows.map(row => row.column_name)
        const requiredColumns = ['public', 'avif_autodetection', 'file_size_limit', 'allowed_mime_types']
        
        for (const column of requiredColumns) {
          if (!existingColumns.includes(column)) {
            let columnDef = ''
            switch (column) {
              case 'public':
                columnDef = 'public BOOLEAN DEFAULT FALSE'
                break
              case 'avif_autodetection':
                columnDef = 'avif_autodetection BOOLEAN DEFAULT FALSE'
                break
              case 'file_size_limit':
                columnDef = 'file_size_limit BIGINT'
                break
              case 'allowed_mime_types':
                columnDef = 'allowed_mime_types TEXT[]'
                break
            }
            
            await client.query(`ALTER TABLE storage.buckets ADD COLUMN IF NOT EXISTS ${columnDef}`)
            console.log(`[SchemaRepairService] Added missing column: storage.buckets.${column}`)
            repaired = true
          }
        }

        // Check for missing columns in storage.objects
        const objectsColumns = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_schema = 'storage' AND table_name = 'objects'
        `)

        const existingObjectColumns = objectsColumns.rows.map(row => row.column_name)
        const requiredObjectColumns = ['path_tokens', 'version']
        
        for (const column of requiredObjectColumns) {
          if (!existingObjectColumns.includes(column)) {
            let columnDef = ''
            switch (column) {
              case 'path_tokens':
                columnDef = 'path_tokens TEXT[]'
                break
              case 'version':
                columnDef = 'version TEXT'
                break
            }
            
            await client.query(`ALTER TABLE storage.objects ADD COLUMN IF NOT EXISTS ${columnDef}`)
            console.log(`[SchemaRepairService] Added missing column: storage.objects.${column}`)
            repaired = true
          }
        }

        // Create missing indexes
        const indexes = [
          'CREATE INDEX IF NOT EXISTS idx_buckets_name ON storage.buckets(name)',
          'CREATE INDEX IF NOT EXISTS idx_buckets_owner ON storage.buckets(owner)',
          'CREATE INDEX IF NOT EXISTS idx_objects_bucket_id ON storage.objects(bucket_id)',
          'CREATE INDEX IF NOT EXISTS idx_objects_owner ON storage.objects(owner)',
          'CREATE INDEX IF NOT EXISTS idx_objects_name ON storage.objects(name)',
          'CREATE INDEX IF NOT EXISTS idx_objects_bucket_name ON storage.objects(bucket_id, name)',
        ]

        for (const indexSql of indexes) {
          try {
            await client.query(indexSql)
          } catch (error) {
            // Index might already exist, that's okay
            console.debug(`[SchemaRepairService] Index creation skipped (may already exist): ${error}`)
          }
        }

        if (repaired) {
          console.log(`[SchemaRepairService] Repaired storage schema`)
        }
        
        return repaired
      }
    } catch (error) {
      console.error(`[SchemaRepairService] Error repairing storage schema: ${error}`)
      throw error
    }
  }

  /**
   * Repair webhooks schema
   */
  private async repairWebhooksSchema(client: PoolClient): Promise<boolean> {
    try {
      // Create schema if it doesn't exist
      await client.query('CREATE SCHEMA IF NOT EXISTS webhooks')

      // Check if webhooks schema has tables
      const tableCount = await client.query(`
        SELECT COUNT(*) as count
        FROM information_schema.tables 
        WHERE table_schema = 'webhooks'
      `)

      if (parseInt(tableCount.rows[0].count) === 0) {
        // Create complete webhooks schema
        const sql = await this.readSqlFile('webhooks-schema.sql')
        await client.query(sql)
        console.log(`[SchemaRepairService] Created complete webhooks schema`)
        return true
      }

      return false
    } catch (error) {
      console.error(`[SchemaRepairService] Error repairing webhooks schema: ${error}`)
      throw error
    }
  }

  /**
   * Repair analytics schema
   */
  private async repairAnalyticsSchema(client: PoolClient): Promise<boolean> {
    try {
      // Create schema if it doesn't exist
      await client.query('CREATE SCHEMA IF NOT EXISTS analytics')

      // Check if analytics schema has tables
      const tableCount = await client.query(`
        SELECT COUNT(*) as count
        FROM information_schema.tables 
        WHERE table_schema = 'analytics'
      `)

      if (parseInt(tableCount.rows[0].count) === 0) {
        // Create complete analytics schema
        const sql = await this.readSqlFile('analytics-schema.sql')
        await client.query(sql)
        console.log(`[SchemaRepairService] Created complete analytics schema`)
        return true
      }

      return false
    } catch (error) {
      console.error(`[SchemaRepairService] Error repairing analytics schema: ${error}`)
      throw error
    }
  }

  /**
   * Close the connection pool
   */
  async close(): Promise<void> {
    if (this.isClosed) {
      return
    }

    try {
      await this.pool.end()
      this.isClosed = true
      console.log('[SchemaRepairService] Successfully closed connection pool')
    } catch (error) {
      console.error('[SchemaRepairService] Error closing connection pool:', error)
      throw error
    }
  }
}