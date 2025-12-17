import { Pool, PoolClient } from 'pg'
import {
  ConnectionPoolManager,
  getConnectionPoolManager,
  ProjectPoolConfig,
  PoolStats,
} from './ConnectionPoolManager'
import {
  ProjectConfigStorage,
  getProjectConfigStorage,
  ProjectConfig,
} from './ProjectConfigStorage'
import {
  AccessValidator,
  getAccessValidator,
  AccessValidationResult,
} from './AccessValidation'
import { NextApiRequest } from 'next'

/**
 * Service Router - Routes service requests to the correct project database
 * 
 * This is the main entry point for project-level service isolation.
 * It manages connection pools, project configurations, and access validation.
 */
export class ServiceRouter {
  private connectionPoolManager: ConnectionPoolManager
  private configStorage: ProjectConfigStorage
  private accessValidator: AccessValidator

  constructor() {
    this.connectionPoolManager = getConnectionPoolManager()
    this.configStorage = getProjectConfigStorage()
    this.accessValidator = getAccessValidator()
  }

  /**
   * Get a database connection for a project
   * 
   * @param projectRef - The project reference
   * @returns A database connection pool
   * @throws Error if project is not registered
   */
  async getConnection(projectRef: string): Promise<Pool> {
    const config = await this.configStorage.get(projectRef)
    
    if (!config) {
      throw new Error(`Project not registered: ${projectRef}`)
    }

    return this.connectionPoolManager.getPool(projectRef)
  }

  /**
   * Get a client from the connection pool
   * 
   * @param projectRef - The project reference
   * @returns A database client
   */
  async getClient(projectRef: string): Promise<PoolClient> {
    // Check if project is registered, if not try to load and register it
    await this.ensureProjectRegistered(projectRef)
    return this.connectionPoolManager.getClient(projectRef)
  }

  /**
   * Ensure a project is registered, loading from database if necessary
   * This handles hot reload scenarios where the in-memory state is lost
   * 
   * @param projectRef - The project reference
   */
  private async ensureProjectRegistered(projectRef: string): Promise<void> {
    // Check if already registered
    const config = await this.configStorage.get(projectRef)
    if (config) {
      return
    }

    // Not registered - try to load from database and register
    console.log(`[ServiceRouter] Project ${projectRef} not registered, attempting to load from database...`)
    
    try {
      const { findProjectByRef, generateConnectionString } = await import('../api/self-hosted')
      const result = await findProjectByRef(projectRef)
      
      if (result.error || !result.data) {
        throw new Error(`Project not found in database: ${projectRef}`)
      }

      const project = result.data
      const connectionString = generateConnectionString({
        databaseName: project.database_name,
        readOnly: false,
      })

      // Register the project
      await this.registerProject({
        projectRef: project.ref,
        databaseName: project.database_name,
        connectionString,
        ownerUserId: project.owner_user_id || 'system',
        createdAt: project.inserted_at ? new Date(project.inserted_at) : new Date(),
        updatedAt: project.updated_at ? new Date(project.updated_at) : new Date(),
      })

      console.log(`[ServiceRouter] ✓ Successfully registered project: ${projectRef} (database: ${project.database_name})`)
    } catch (error) {
      console.error(`[ServiceRouter] Failed to load and register project ${projectRef}:`, error)
      throw error
    }
  }

  /**
   * Execute a query on a project's database
   * 
   * @param projectRef - The project reference
   * @param text - SQL query text
   * @param values - Query parameters
   * @returns Query result
   */
  async query<T = any>(
    projectRef: string,
    text: string,
    values?: any[]
  ): Promise<{ rows: T[]; rowCount: number }> {
    // Ensure project is registered before querying
    await this.ensureProjectRegistered(projectRef)
    return this.connectionPoolManager.query<T>(projectRef, text, values)
  }

  /**
   * Register a new project with the service router
   * 
   * @param config - Project configuration
   */
  async registerProject(config: ProjectConfig): Promise<void> {
    // Store configuration
    await this.configStorage.set(config)

    // Register with connection pool manager
    const poolConfig: ProjectPoolConfig = {
      projectRef: config.projectRef,
      databaseName: config.databaseName,
      connectionString: config.connectionString,
    }
    this.connectionPoolManager.registerProject(poolConfig)

    console.log(`Registered project: ${config.projectRef}`)
  }

  /**
   * Unregister a project from the service router
   * 
   * @param projectRef - The project reference
   */
  async unregisterProject(projectRef: string): Promise<void> {
    // Remove from connection pool manager
    await this.connectionPoolManager.unregisterProject(projectRef)

    // Remove from configuration storage
    await this.configStorage.delete(projectRef)

    console.log(`Unregistered project: ${projectRef}`)
  }

  /**
   * Validate that a user has access to a project
   * 
   * @param projectRef - The project reference
   * @param userId - The user ID
   * @returns Validation result
   */
  async validateProjectAccess(
    projectRef: string,
    userId: string
  ): Promise<boolean> {
    const result = await this.accessValidator.validateProjectAccess(projectRef, userId)
    return result.allowed
  }

  /**
   * Validate a request has access to a project
   * 
   * @param req - Next.js API request
   * @param projectRef - The project reference
   * @returns Validation result with user ID if successful
   */
  async validateRequest(
    req: NextApiRequest,
    projectRef: string
  ): Promise<AccessValidationResult> {
    return this.accessValidator.validateRequest(req, projectRef)
  }

  /**
   * Check if a project is registered
   * 
   * @param projectRef - The project reference
   * @returns True if project is registered
   */
  async isProjectRegistered(projectRef: string): Promise<boolean> {
    return this.configStorage.has(projectRef)
  }

  /**
   * Get project configuration
   * 
   * @param projectRef - The project reference
   * @returns Project configuration or null if not found
   */
  async getProjectConfig(projectRef: string): Promise<ProjectConfig | null> {
    return this.configStorage.get(projectRef)
  }

  /**
   * Get all registered projects
   * 
   * @returns Array of project configurations
   */
  async getAllProjects(): Promise<ProjectConfig[]> {
    return this.configStorage.getAll()
  }

  /**
   * Get connection pool statistics for a project
   * 
   * @param projectRef - The project reference
   * @returns Pool statistics or null if pool doesn't exist
   */
  getPoolStats(projectRef: string): PoolStats | null {
    return this.connectionPoolManager.getPoolStats(projectRef)
  }

  /**
   * Get connection pool statistics for all projects
   * 
   * @returns Map of project refs to pool statistics
   */
  getAllPoolStats(): Map<string, PoolStats> {
    return this.connectionPoolManager.getAllPoolStats()
  }

  /**
   * Perform health check on a project's database connection
   * 
   * @param projectRef - The project reference
   * @returns True if connection is healthy
   */
  async healthCheck(projectRef: string): Promise<boolean> {
    try {
      return await this.connectionPoolManager.healthCheck(projectRef)
    } catch (error) {
      console.error(`Health check failed for project ${projectRef}:`, error)
      return false
    }
  }

  /**
   * Invalidate cached configuration for a project
   * 
   * @param projectRef - The project reference
   */
  invalidateCache(projectRef: string): void {
    this.configStorage.invalidate(projectRef)
  }

  /**
   * Invalidate all cached configurations
   */
  invalidateAllCaches(): void {
    this.configStorage.invalidateAll()
  }

  /**
   * Close connection pool for a project
   * 
   * @param projectRef - The project reference
   */
  async closePool(projectRef: string): Promise<void> {
    await this.connectionPoolManager.closePool(projectRef)
  }

  /**
   * Close all connection pools
   */
  async closeAllPools(): Promise<void> {
    await this.connectionPoolManager.closeAllPools()
  }

  /**
   * Get rate limit statistics for a project
   * 
   * @param projectRef - The project reference
   * @returns Rate limit stats or null if not found
   */
  getRateLimitStats(projectRef: string): { count: number; resetAt: number } | null {
    return this.accessValidator.getRateLimitStats(projectRef)
  }

  /**
   * Reset rate limit for a project
   * 
   * @param projectRef - The project reference
   */
  resetRateLimit(projectRef: string): void {
    this.accessValidator.resetRateLimit(projectRef)
  }

  /**
   * Execute a function with a database client
   * Automatically handles client acquisition and release
   * 
   * @param projectRef - The project reference
   * @param fn - Function to execute with the client
   * @returns Result of the function
   */
  async withClient<T>(
    projectRef: string,
    fn: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.getClient(projectRef)
    try {
      return await fn(client)
    } finally {
      client.release()
    }
  }

  /**
   * Execute a function within a transaction
   * Automatically handles transaction begin, commit, and rollback
   * 
   * @param projectRef - The project reference
   * @param fn - Function to execute within the transaction
   * @returns Result of the function
   */
  async withTransaction<T>(
    projectRef: string,
    fn: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.getClient(projectRef)
    try {
      await client.query('BEGIN')
      const result = await fn(client)
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }
}

// Singleton instance - use global to persist across hot reloads in development
const globalForServiceRouter = global as unknown as {
  serviceRouter: ServiceRouter | undefined
}

/**
 * Get the singleton ServiceRouter instance
 * 
 * Note: Uses global object to persist across hot reloads in development mode
 */
export function getServiceRouter(): ServiceRouter {
  if (!globalForServiceRouter.serviceRouter) {
    globalForServiceRouter.serviceRouter = new ServiceRouter()
  }
  return globalForServiceRouter.serviceRouter
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetServiceRouter(): void {
  if (globalForServiceRouter.serviceRouter) {
    globalForServiceRouter.serviceRouter.closeAllPools().catch(console.error)
    globalForServiceRouter.serviceRouter = undefined
  }
}
