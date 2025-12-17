import { getServiceRouter } from '../service-router'

/**
 * Query analysis result interface
 */
export interface QueryAnalysis {
  query: string
  calls: number
  total_time: number
  mean_time: number
  min_time: number
  max_time: number
  rows: number
}

/**
 * Index suggestion interface
 */
export interface IndexSuggestion {
  table_name: string
  column_name: string
  reason: string
  estimated_impact: 'high' | 'medium' | 'low'
  create_statement: string
}

/**
 * Slow query interface
 */
export interface SlowQuery {
  query: string
  execution_time: number
  timestamp: string
  user_id?: string
}

/**
 * Performance report interface
 */
export interface PerformanceReport {
  project_ref: string
  generated_at: string
  slow_queries: SlowQuery[]
  query_analysis: QueryAnalysis[]
  index_suggestions: IndexSuggestion[]
  database_stats: {
    size_bytes: number
    table_count: number
    index_count: number
  }
}

/**
 * Advisors Service Adapter
 * 
 * Provides project-isolated performance analysis and optimization recommendations.
 * Each project's queries and schema are analyzed independently.
 */
export class AdvisorsServiceAdapter {
  private serviceRouter = getServiceRouter()

  /**
   * Analyze queries for a project using pg_stat_statements
   * 
   * @param projectRef - The project reference
   * @returns Array of query analysis results
   */
  async analyzeQueries(projectRef: string): Promise<QueryAnalysis[]> {
    // First, ensure pg_stat_statements extension is enabled
    try {
      await this.serviceRouter.query(
        projectRef,
        `CREATE EXTENSION IF NOT EXISTS pg_stat_statements`
      )
    } catch (error) {
      console.warn(`Could not enable pg_stat_statements for ${projectRef}:`, error)
      // Continue anyway - extension might already exist or be unavailable
    }

    // Query pg_stat_statements for query statistics
    // Only analyze queries from the current database
    const result = await this.serviceRouter.query<any>(
      projectRef,
      `SELECT 
        query,
        calls,
        total_exec_time as total_time,
        mean_exec_time as mean_time,
        min_exec_time as min_time,
        max_exec_time as max_time,
        rows
       FROM pg_stat_statements
       WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
       ORDER BY total_exec_time DESC
       LIMIT 50`
    )

    return result.rows.map((row) => ({
      query: row.query,
      calls: parseInt(row.calls, 10),
      total_time: parseFloat(row.total_time),
      mean_time: parseFloat(row.mean_time),
      min_time: parseFloat(row.min_time),
      max_time: parseFloat(row.max_time),
      rows: parseInt(row.rows, 10),
    }))
  }

  /**
   * Suggest indexes for a project based on schema analysis
   * 
   * @param projectRef - The project reference
   * @returns Array of index suggestions
   */
  async suggestIndexes(projectRef: string): Promise<IndexSuggestion[]> {
    const suggestions: IndexSuggestion[] = []

    // Find foreign key columns without indexes
    const fkWithoutIndexResult = await this.serviceRouter.query<any>(
      projectRef,
      `SELECT
        tc.table_name,
        kcu.column_name,
        tc.constraint_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
       WHERE tc.constraint_type = 'FOREIGN KEY'
         AND tc.table_schema NOT IN ('pg_catalog', 'information_schema')
         AND NOT EXISTS (
           SELECT 1
           FROM pg_indexes
           WHERE schemaname = tc.table_schema
             AND tablename = tc.table_name
             AND indexdef LIKE '%' || kcu.column_name || '%'
         )
       ORDER BY tc.table_name, kcu.column_name`
    )

    for (const row of fkWithoutIndexResult.rows) {
      suggestions.push({
        table_name: row.table_name,
        column_name: row.column_name,
        reason: `Foreign key column without index (constraint: ${row.constraint_name})`,
        estimated_impact: 'high',
        create_statement: `CREATE INDEX idx_${row.table_name}_${row.column_name} ON ${row.table_name}(${row.column_name});`,
      })
    }

    // Find tables with sequential scans (if pg_stat_user_tables is available)
    try {
      const seqScanResult = await this.serviceRouter.query<any>(
        projectRef,
        `SELECT
          schemaname,
          tablename,
          seq_scan,
          seq_tup_read,
          idx_scan,
          n_live_tup
         FROM pg_stat_user_tables
         WHERE seq_scan > 1000
           AND seq_tup_read > 100000
           AND (idx_scan IS NULL OR idx_scan < seq_scan / 10)
           AND n_live_tup > 1000
         ORDER BY seq_tup_read DESC
         LIMIT 10`
      )

      for (const row of seqScanResult.rows) {
        // Get columns that might benefit from indexes
        try {
          const columnsResult = await this.serviceRouter.query<any>(
            projectRef,
            `SELECT column_name, data_type
             FROM information_schema.columns
             WHERE table_schema = $1
               AND table_name = $2
               AND data_type IN ('integer', 'bigint', 'uuid', 'text', 'varchar', 'timestamp', 'timestamptz', 'date')
             ORDER BY ordinal_position
             LIMIT 5`,
            [row.schemaname, row.tablename]
          )

          for (const col of columnsResult.rows) {
            suggestions.push({
              table_name: row.tablename,
              column_name: col.column_name,
              reason: `Table has high sequential scan count (${row.seq_scan} scans, ${row.seq_tup_read} rows read)`,
              estimated_impact: 'medium',
              create_statement: `CREATE INDEX idx_${row.tablename}_${col.column_name} ON ${row.tablename}(${col.column_name});`,
            })
          }
        } catch (colError) {
          console.warn(`Could not get columns for table ${row.tablename}:`, colError)
        }
      }
    } catch (error) {
      console.warn(`Could not analyze sequential scans for ${projectRef}:`, error)
    }

    return suggestions
  }

  /**
   * Detect slow queries for a project
   * 
   * @param projectRef - The project reference
   * @param threshold - Execution time threshold in milliseconds
   * @returns Array of slow queries
   */
  async detectSlowQueries(projectRef: string, threshold: number): Promise<SlowQuery[]> {
    if (threshold <= 0) {
      throw new Error('Threshold must be greater than 0')
    }

    // Try to use pg_stat_statements to find slow queries
    try {
      await this.serviceRouter.query(
        projectRef,
        `CREATE EXTENSION IF NOT EXISTS pg_stat_statements`
      )

      const result = await this.serviceRouter.query<any>(
        projectRef,
        `SELECT 
          query,
          mean_exec_time as execution_time,
          NOW() as timestamp
         FROM pg_stat_statements
         WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
           AND mean_exec_time > $1
         ORDER BY mean_exec_time DESC
         LIMIT 20`,
        [threshold]
      )

      return result.rows.map((row) => ({
        query: row.query,
        execution_time: parseFloat(row.execution_time),
        timestamp: row.timestamp,
      }))
    } catch (error) {
      console.warn(`Could not detect slow queries using pg_stat_statements for ${projectRef}:`, error)
      
      // Fallback: return empty array if pg_stat_statements is not available
      return []
    }
  }

  /**
   * Generate a comprehensive performance report for a project
   * 
   * @param projectRef - The project reference
   * @returns Performance report
   */
  async generatePerformanceReport(projectRef: string): Promise<PerformanceReport> {
    const generatedAt = new Date().toISOString()

    // Gather all performance data
    const [slowQueries, queryAnalysis, indexSuggestions, databaseStats] = await Promise.all([
      this.detectSlowQueries(projectRef, 100), // Queries slower than 100ms
      this.analyzeQueries(projectRef),
      this.suggestIndexes(projectRef),
      this.getDatabaseStats(projectRef),
    ])

    return {
      project_ref: projectRef,
      generated_at: generatedAt,
      slow_queries: slowQueries,
      query_analysis: queryAnalysis,
      index_suggestions: indexSuggestions,
      database_stats: databaseStats,
    }
  }

  /**
   * Get database statistics for a project
   * 
   * @param projectRef - The project reference
   * @returns Database statistics
   */
  private async getDatabaseStats(
    projectRef: string
  ): Promise<{ size_bytes: number; table_count: number; index_count: number }> {
    // Get project configuration to determine database name
    const config = await this.serviceRouter.getProjectConfig(projectRef)
    
    if (!config) {
      throw new Error(`Project not found: ${projectRef}`)
    }

    // Get database size
    const sizeResult = await this.serviceRouter.query<{ size: string }>(
      projectRef,
      `SELECT pg_database_size($1) as size`,
      [config.databaseName]
    )

    const sizeBytes = parseInt(sizeResult.rows[0]?.size || '0', 10)

    // Get table count
    const tableCountResult = await this.serviceRouter.query<{ count: string }>(
      projectRef,
      `SELECT COUNT(*) as count
       FROM information_schema.tables
       WHERE table_schema NOT IN ('pg_catalog', 'information_schema')`
    )

    const tableCount = parseInt(tableCountResult.rows[0]?.count || '0', 10)

    // Get index count
    const indexCountResult = await this.serviceRouter.query<{ count: string }>(
      projectRef,
      `SELECT COUNT(*) as count
       FROM pg_indexes
       WHERE schemaname NOT IN ('pg_catalog', 'information_schema')`
    )

    const indexCount = parseInt(indexCountResult.rows[0]?.count || '0', 10)

    return {
      size_bytes: sizeBytes,
      table_count: tableCount,
      index_count: indexCount,
    }
  }

  /**
   * Subscribe to performance alerts for a project
   * 
   * @param projectRef - The project reference
   * @param userId - The user ID to send alerts to
   */
  async subscribeToAlerts(projectRef: string, userId: string): Promise<void> {
    // This is a placeholder for future implementation
    // In a real system, this would:
    // 1. Store the subscription in a database
    // 2. Set up a background job to monitor performance
    // 3. Send notifications when thresholds are exceeded
    
    console.log(`User ${userId} subscribed to alerts for project ${projectRef}`)
    
    // For now, we'll just validate that the project exists
    const config = await this.serviceRouter.getProjectConfig(projectRef)
    if (!config) {
      throw new Error(`Project not found: ${projectRef}`)
    }
  }
}

// Singleton instance
let advisorsServiceAdapter: AdvisorsServiceAdapter | null = null

/**
 * Get the singleton AdvisorsServiceAdapter instance
 */
export function getAdvisorsServiceAdapter(): AdvisorsServiceAdapter {
  if (!advisorsServiceAdapter) {
    advisorsServiceAdapter = new AdvisorsServiceAdapter()
  }
  return advisorsServiceAdapter
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetAdvisorsServiceAdapter(): void {
  advisorsServiceAdapter = null
}
