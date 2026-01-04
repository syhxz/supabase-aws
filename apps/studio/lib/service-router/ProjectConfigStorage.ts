/**
 * Project configuration for service routing
 */
export interface ProjectConfig {
  projectRef: string
  databaseName: string
  connectionString: string
  ownerUserId: string
  createdAt: Date
  updatedAt: Date
}

/**
 * Cache entry with TTL
 */
interface CacheEntry<T> {
  value: T
  expiresAt: number
}

/**
 * Manages project configurations with in-memory caching and persistence
 */
export class ProjectConfigStorage {
  private cache: Map<string, CacheEntry<ProjectConfig>> = new Map()
  private readonly DEFAULT_TTL_MS = 5 * 60 * 1000 // 5 minutes
  private cleanupInterval: NodeJS.Timeout | null = null
  private readonly CLEANUP_INTERVAL_MS = 60 * 1000 // 1 minute

  constructor() {
    this.startCleanupInterval()
  }

  /**
   * Get project configuration by project ref
   */
  async get(projectRef: string): Promise<ProjectConfig | null> {
    // Check cache first
    const cached = this.getFromCache(projectRef)
    if (cached) {
      return cached
    }

    // Load from persistence (database)
    const config = await this.loadFromPersistence(projectRef)
    if (config) {
      this.setInCache(projectRef, config)
    }

    return config
  }

  /**
   * Set project configuration
   */
  async set(config: ProjectConfig): Promise<void> {
    // Update cache
    this.setInCache(config.projectRef, config)

    // Persist to database
    await this.saveToPersistence(config)
  }

  /**
   * Delete project configuration
   */
  async delete(projectRef: string): Promise<void> {
    // Remove from cache
    this.cache.delete(projectRef)

    // Remove from persistence
    await this.deleteFromPersistence(projectRef)
  }

  /**
   * Check if configuration exists
   */
  async has(projectRef: string): Promise<boolean> {
    const config = await this.get(projectRef)
    return config !== null
  }

  /**
   * Get all project configurations
   */
  async getAll(): Promise<ProjectConfig[]> {
    return await this.loadAllFromPersistence()
  }

  /**
   * Invalidate cache for a project
   */
  invalidate(projectRef: string): void {
    this.cache.delete(projectRef)
  }

  /**
   * Invalidate all cache entries
   */
  invalidateAll(): void {
    this.cache.clear()
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0, // TODO: Implement hit rate tracking
    }
  }

  /**
   * Cleanup expired cache entries
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now()
    const expiredKeys: string[] = []

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        expiredKeys.push(key)
      }
    }

    for (const key of expiredKeys) {
      this.cache.delete(key)
    }

    if (expiredKeys.length > 0) {
      console.log(`Cleaned up ${expiredKeys.length} expired cache entries`)
    }
  }

  /**
   * Start periodic cleanup of expired entries
   */
  private startCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries()
    }, this.CLEANUP_INTERVAL_MS)
  }

  /**
   * Stop cleanup interval
   */
  stopCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }

  /**
   * Get configuration from cache
   */
  private getFromCache(projectRef: string): ProjectConfig | null {
    const entry = this.cache.get(projectRef)
    if (!entry) {
      return null
    }

    // Check if expired
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(projectRef)
      return null
    }

    return entry.value
  }

  /**
   * Set configuration in cache
   */
  private setInCache(projectRef: string, config: ProjectConfig, ttlMs?: number): void {
    const expiresAt = Date.now() + (ttlMs ?? this.DEFAULT_TTL_MS)
    this.cache.set(projectRef, {
      value: config,
      expiresAt,
    })
  }

  /**
   * Load configuration from persistence layer
   * This is a placeholder - actual implementation will depend on the database setup
   */
  private async loadFromPersistence(projectRef: string): Promise<ProjectConfig | null> {
    // TODO: Implement actual database query
    // For now, return null to indicate not found
    // In production, this would query the postgres database for project configuration
    
    // Example implementation:
    // const result = await pool.query(
    //   'SELECT * FROM projects WHERE ref = $1',
    //   [projectRef]
    // )
    // if (result.rows.length === 0) return null
    // return this.mapRowToConfig(result.rows[0])
    
    return null
  }

  /**
   * Save configuration to persistence layer
   */
  private async saveToPersistence(config: ProjectConfig): Promise<void> {
    // TODO: Implement actual database insert/update
    // For now, this is a no-op
    // In production, this would insert or update the project configuration in postgres
    
    // Example implementation:
    // await pool.query(
    //   `INSERT INTO projects (ref, database_name, connection_string, owner_user_id, created_at, updated_at)
    //    VALUES ($1, $2, $3, $4, $5, $6)
    //    ON CONFLICT (ref) DO UPDATE SET
    //      database_name = EXCLUDED.database_name,
    //      connection_string = EXCLUDED.connection_string,
    //      owner_user_id = EXCLUDED.owner_user_id,
    //      updated_at = EXCLUDED.updated_at`,
    //   [config.projectRef, config.databaseName, config.connectionString, 
    //    config.ownerUserId, config.createdAt, config.updatedAt]
    // )
  }

  /**
   * Delete configuration from persistence layer
   */
  private async deleteFromPersistence(projectRef: string): Promise<void> {
    // TODO: Implement actual database delete
    // For now, this is a no-op
    
    // Example implementation:
    // await pool.query('DELETE FROM projects WHERE ref = $1', [projectRef])
  }

  /**
   * Load all configurations from persistence layer
   */
  private async loadAllFromPersistence(): Promise<ProjectConfig[]> {
    // TODO: Implement actual database query
    // For now, return empty array
    
    // Example implementation:
    // const result = await pool.query('SELECT * FROM projects')
    // return result.rows.map(row => this.mapRowToConfig(row))
    
    return []
  }

  /**
   * Map database row to ProjectConfig
   */
  private mapRowToConfig(row: any): ProjectConfig {
    return {
      projectRef: row.ref,
      databaseName: row.database_name,
      connectionString: row.connection_string,
      ownerUserId: row.owner_user_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }
  }
}

// Singleton instance - use global to persist across hot reloads in development
const globalForProjectConfigStorage = global as unknown as {
  projectConfigStorage: ProjectConfigStorage | undefined
}

/**
 * Get the singleton ProjectConfigStorage instance
 * 
 * Note: Uses global object to persist across hot reloads in development mode
 */
export function getProjectConfigStorage(): ProjectConfigStorage {
  if (!globalForProjectConfigStorage.projectConfigStorage) {
    globalForProjectConfigStorage.projectConfigStorage = new ProjectConfigStorage()
  }
  return globalForProjectConfigStorage.projectConfigStorage
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetProjectConfigStorage(): void {
  if (globalForProjectConfigStorage.projectConfigStorage) {
    globalForProjectConfigStorage.projectConfigStorage.stopCleanupInterval()
    globalForProjectConfigStorage.projectConfigStorage = undefined
  }
}
