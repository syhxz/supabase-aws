import { Pool, PoolClient, PoolConfig } from 'pg'

/**
 * Configuration for a project's connection pool
 */
export interface ProjectPoolConfig {
  projectRef: string
  databaseName: string
  connectionString: string
  maxConnections?: number
  idleTimeoutMillis?: number
  connectionTimeoutMillis?: number
}

/**
 * Statistics for a connection pool
 */
export interface PoolStats {
  totalCount: number
  idleCount: number
  waitingCount: number
}

/**
 * Manages database connection pools for multiple projects
 * Each project gets its own isolated connection pool
 */
export class ConnectionPoolManager {
  private pools: Map<string, Pool> = new Map()
  private poolConfigs: Map<string, ProjectPoolConfig> = new Map()
  private idleTimers: Map<string, NodeJS.Timeout> = new Map()
  
  // Default configuration
  private readonly DEFAULT_MAX_CONNECTIONS = 10
  private readonly DEFAULT_IDLE_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes
  private readonly DEFAULT_CONNECTION_TIMEOUT_MS = 30 * 1000 // 30 seconds
  private readonly IDLE_CHECK_INTERVAL_MS = 60 * 1000 // 1 minute

  /**
   * Get or create a connection pool for a project
   */
  async getPool(projectRef: string): Promise<Pool> {
    const existingPool = this.pools.get(projectRef)
    
    if (existingPool) {
      // Reset idle timer since pool is being used
      this.resetIdleTimer(projectRef)
      return existingPool
    }

    const config = this.poolConfigs.get(projectRef)
    if (!config) {
      throw new Error(`No configuration found for project: ${projectRef}`)
    }

    return this.createPool(config)
  }

  /**
   * Create a new connection pool for a project
   */
  private createPool(config: ProjectPoolConfig): Pool {
    const poolConfig: PoolConfig = {
      connectionString: config.connectionString,
      max: config.maxConnections ?? this.DEFAULT_MAX_CONNECTIONS,
      idleTimeoutMillis: config.idleTimeoutMillis ?? this.DEFAULT_IDLE_TIMEOUT_MS,
      connectionTimeoutMillis: config.connectionTimeoutMillis ?? this.DEFAULT_CONNECTION_TIMEOUT_MS,
      // Enable connection reuse
      allowExitOnIdle: false,
    }

    const pool = new Pool(poolConfig)

    // Handle pool errors
    pool.on('error', (err, client) => {
      console.error(`Unexpected error on idle client for project ${config.projectRef}:`, err)
    })

    // Handle pool connection events
    pool.on('connect', (client) => {
      console.log(`New client connected to pool for project ${config.projectRef}`)
    })

    pool.on('remove', (client) => {
      console.log(`Client removed from pool for project ${config.projectRef}`)
    })

    this.pools.set(config.projectRef, pool)
    this.startIdleTimer(config.projectRef)

    return pool
  }

  /**
   * Register a project configuration
   */
  registerProject(config: ProjectPoolConfig): void {
    this.poolConfigs.set(config.projectRef, config)
  }

  /**
   * Unregister a project and close its pool
   */
  async unregisterProject(projectRef: string): Promise<void> {
    await this.closePool(projectRef)
    this.poolConfigs.delete(projectRef)
    this.clearIdleTimer(projectRef)
  }

  /**
   * Get a client from the pool for a project
   */
  async getClient(projectRef: string): Promise<PoolClient> {
    const pool = await this.getPool(projectRef)
    return pool.connect()
  }

  /**
   * Execute a query using a pool connection
   */
  async query<T = any>(
    projectRef: string,
    text: string,
    values?: any[]
  ): Promise<{ rows: T[]; rowCount: number }> {
    const pool = await this.getPool(projectRef)
    const result = await pool.query(text, values)
    return {
      rows: result.rows,
      rowCount: result.rowCount ?? 0,
    }
  }

  /**
   * Close a specific pool
   */
  async closePool(projectRef: string): Promise<void> {
    const pool = this.pools.get(projectRef)
    if (pool) {
      await pool.end()
      this.pools.delete(projectRef)
      this.clearIdleTimer(projectRef)
      console.log(`Closed connection pool for project ${projectRef}`)
    }
  }

  /**
   * Close all pools
   */
  async closeAllPools(): Promise<void> {
    const closePromises = Array.from(this.pools.keys()).map((projectRef) =>
      this.closePool(projectRef)
    )
    await Promise.all(closePromises)
  }

  /**
   * Get statistics for a project's pool
   */
  getPoolStats(projectRef: string): PoolStats | null {
    const pool = this.pools.get(projectRef)
    if (!pool) {
      return null
    }

    return {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
    }
  }

  /**
   * Get statistics for all pools
   */
  getAllPoolStats(): Map<string, PoolStats> {
    const stats = new Map<string, PoolStats>()
    
    for (const [projectRef, pool] of this.pools.entries()) {
      stats.set(projectRef, {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount,
      })
    }

    return stats
  }

  /**
   * Check if a pool exists for a project
   */
  hasPool(projectRef: string): boolean {
    return this.pools.has(projectRef)
  }

  /**
   * Get list of all registered project refs
   */
  getRegisteredProjects(): string[] {
    return Array.from(this.poolConfigs.keys())
  }

  /**
   * Start idle timer for a pool
   * Closes the pool if it remains idle for too long
   */
  private startIdleTimer(projectRef: string): void {
    this.clearIdleTimer(projectRef)

    const timer = setTimeout(async () => {
      const pool = this.pools.get(projectRef)
      if (pool && pool.idleCount === pool.totalCount && pool.totalCount > 0) {
        console.log(`Closing idle pool for project ${projectRef}`)
        await this.closePool(projectRef)
      } else {
        // Restart timer if pool is still active
        this.startIdleTimer(projectRef)
      }
    }, this.IDLE_CHECK_INTERVAL_MS)

    this.idleTimers.set(projectRef, timer)
  }

  /**
   * Reset idle timer when pool is used
   */
  private resetIdleTimer(projectRef: string): void {
    this.startIdleTimer(projectRef)
  }

  /**
   * Clear idle timer for a project
   */
  private clearIdleTimer(projectRef: string): void {
    const timer = this.idleTimers.get(projectRef)
    if (timer) {
      clearTimeout(timer)
      this.idleTimers.delete(projectRef)
    }
  }

  /**
   * Health check for a project's pool
   */
  async healthCheck(projectRef: string): Promise<boolean> {
    try {
      const result = await this.query(projectRef, 'SELECT 1 as health')
      return result.rows.length > 0 && result.rows[0].health === 1
    } catch (error) {
      console.error(`Health check failed for project ${projectRef}:`, error)
      return false
    }
  }
}

// Singleton instance - use global to persist across hot reloads in development
const globalForConnectionPoolManager = global as unknown as {
  connectionPoolManager: ConnectionPoolManager | undefined
}

/**
 * Get the singleton ConnectionPoolManager instance
 * 
 * Note: Uses global object to persist across hot reloads in development mode
 */
export function getConnectionPoolManager(): ConnectionPoolManager {
  if (!globalForConnectionPoolManager.connectionPoolManager) {
    globalForConnectionPoolManager.connectionPoolManager = new ConnectionPoolManager()
  }
  return globalForConnectionPoolManager.connectionPoolManager
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetConnectionPoolManager(): void {
  if (globalForConnectionPoolManager.connectionPoolManager) {
    globalForConnectionPoolManager.connectionPoolManager.closeAllPools().catch(console.error)
    globalForConnectionPoolManager.connectionPoolManager = undefined
  }
}
