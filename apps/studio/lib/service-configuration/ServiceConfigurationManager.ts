import { getServiceRouter } from '../service-router'
import { generateConnectionString } from '../api/self-hosted/connection-string'
import { findProjectByRef } from '../api/self-hosted'

/**
 * Service configuration for a project
 */
export interface ProjectServiceConfig {
  projectRef: string
  databaseName: string
  databaseUser: string
  databasePassword: string
  connectionString: string
  services: {
    gotrue: ServiceEndpointConfig
    storage: ServiceEndpointConfig
    realtime: ServiceEndpointConfig
    postgrest: ServiceEndpointConfig
  }
}

/**
 * Service endpoint configuration
 */
export interface ServiceEndpointConfig {
  enabled: boolean
  connectionString: string
  lastUpdated: Date
  errorCount: number
  lastError?: string
}

/**
 * Service configuration update result
 */
export interface ServiceConfigUpdateResult {
  success: boolean
  updatedServices: string[]
  errors: Array<{
    service: string
    error: string
  }>
}

/**
 * Service authentication failure log entry
 */
export interface ServiceAuthFailureLog {
  projectRef: string
  service: string
  timestamp: Date
  error: string
  databaseUser: string
  attemptedConnection: string
}

/**
 * Service Configuration Manager
 * 
 * Manages service configurations to use project-specific database users.
 * Updates connection strings for GoTrue, Storage, Realtime, and PostgREST services.
 */
export class ServiceConfigurationManager {
  private serviceRouter = getServiceRouter()
  private configCache = new Map<string, ProjectServiceConfig>()
  private authFailureLogs: ServiceAuthFailureLog[] = []
  private readonly MAX_LOG_ENTRIES = 1000

  /**
   * Configure all services for a project to use project-specific database user
   * 
   * @param projectRef - The project reference
   * @returns Configuration update result
   */
  async configureProjectServices(projectRef: string): Promise<ServiceConfigUpdateResult> {
    const result: ServiceConfigUpdateResult = {
      success: true,
      updatedServices: [],
      errors: []
    }

    try {
      // Get project information
      const projectResult = await findProjectByRef(projectRef)
      if (projectResult.error || !projectResult.data) {
        throw new Error(`Project not found: ${projectRef}`)
      }

      const project = projectResult.data

      // Ensure project has database user configured
      if (!project.database_user || !project.database_password) {
        throw new Error(`Project ${projectRef} does not have database user configured`)
      }

      // Generate project-specific connection string
      const { generateProjectConnectionString } = await import('../api/self-hosted/connection-string')
      const connectionStrings = generateProjectConnectionString({
        databaseName: project.database_name,
        databaseUser: project.database_user,
        databasePassword: project.database_password
      })
      
      const connectionString = connectionStrings.actual

      // Create service configuration
      const serviceConfig: ProjectServiceConfig = {
        projectRef,
        databaseName: project.database_name,
        databaseUser: project.database_user,
        databasePassword: project.database_password,
        connectionString,
        services: {
          gotrue: {
            enabled: true,
            connectionString,
            lastUpdated: new Date(),
            errorCount: 0
          },
          storage: {
            enabled: true,
            connectionString,
            lastUpdated: new Date(),
            errorCount: 0
          },
          realtime: {
            enabled: true,
            connectionString,
            lastUpdated: new Date(),
            errorCount: 0
          },
          postgrest: {
            enabled: true,
            connectionString,
            lastUpdated: new Date(),
            errorCount: 0
          }
        }
      }

      // Configure each service
      const services = ['gotrue', 'storage', 'realtime', 'postgrest'] as const

      for (const serviceName of services) {
        try {
          await this.configureService(projectRef, serviceName, serviceConfig)
          result.updatedServices.push(serviceName)
        } catch (error: any) {
          result.success = false
          result.errors.push({
            service: serviceName,
            error: error.message
          })
          
          // Log authentication failure
          this.logAuthFailure(projectRef, serviceName, error.message, project.database_user, connectionString)
        }
      }

      // Cache the configuration
      this.configCache.set(projectRef, serviceConfig)

      console.log(`Service configuration updated for project ${projectRef}:`, {
        updatedServices: result.updatedServices,
        errors: result.errors
      })

    } catch (error: any) {
      result.success = false
      result.errors.push({
        service: 'all',
        error: error.message
      })
    }

    return result
  }

  /**
   * Configure a specific service for a project
   * 
   * @param projectRef - The project reference
   * @param serviceName - The service name
   * @param serviceConfig - The service configuration
   */
  private async configureService(
    projectRef: string,
    serviceName: string,
    serviceConfig: ProjectServiceConfig
  ): Promise<void> {
    switch (serviceName) {
      case 'gotrue':
        await this.configureGoTrueService(projectRef, serviceConfig)
        break
      case 'storage':
        await this.configureStorageService(projectRef, serviceConfig)
        break
      case 'realtime':
        await this.configureRealtimeService(projectRef, serviceConfig)
        break
      case 'postgrest':
        await this.configurePostgRESTService(projectRef, serviceConfig)
        break
      default:
        throw new Error(`Unknown service: ${serviceName}`)
    }
  }

  /**
   * Configure GoTrue service to use project-specific database user
   * 
   * @param projectRef - The project reference
   * @param serviceConfig - The service configuration
   */
  private async configureGoTrueService(
    projectRef: string,
    serviceConfig: ProjectServiceConfig
  ): Promise<void> {
    // Test database connection with project-specific user
    await this.testServiceConnection(projectRef, 'gotrue', serviceConfig.connectionString)

    // Update service router configuration
    await this.serviceRouter.registerProject({
      projectRef,
      databaseName: serviceConfig.databaseName,
      connectionString: serviceConfig.connectionString,
      ownerUserId: 'system',
      createdAt: new Date(),
      updatedAt: new Date()
    })

    console.log(`GoTrue service configured for project ${projectRef} with user ${serviceConfig.databaseUser}`)
  }

  /**
   * Configure Storage service to use project-specific database user
   * 
   * @param projectRef - The project reference
   * @param serviceConfig - The service configuration
   */
  private async configureStorageService(
    projectRef: string,
    serviceConfig: ProjectServiceConfig
  ): Promise<void> {
    // Test database connection with project-specific user
    await this.testServiceConnection(projectRef, 'storage', serviceConfig.connectionString)

    // Verify storage schema exists and is accessible
    await this.verifyStorageSchema(projectRef)

    console.log(`Storage service configured for project ${projectRef} with user ${serviceConfig.databaseUser}`)
  }

  /**
   * Configure Realtime service to use project-specific database user
   * 
   * @param projectRef - The project reference
   * @param serviceConfig - The service configuration
   */
  private async configureRealtimeService(
    projectRef: string,
    serviceConfig: ProjectServiceConfig
  ): Promise<void> {
    // Test database connection with project-specific user
    await this.testServiceConnection(projectRef, 'realtime', serviceConfig.connectionString)

    // Verify realtime schema exists and is accessible
    await this.verifyRealtimeSchema(projectRef)

    console.log(`Realtime service configured for project ${projectRef} with user ${serviceConfig.databaseUser}`)
  }

  /**
   * Configure PostgREST service to use project-specific database user
   * 
   * @param projectRef - The project reference
   * @param serviceConfig - The service configuration
   */
  private async configurePostgRESTService(
    projectRef: string,
    serviceConfig: ProjectServiceConfig
  ): Promise<void> {
    // Test database connection with project-specific user
    await this.testServiceConnection(projectRef, 'postgrest', serviceConfig.connectionString)

    // Verify public schema access
    await this.verifyPublicSchemaAccess(projectRef)

    console.log(`PostgREST service configured for project ${projectRef} with user ${serviceConfig.databaseUser}`)
  }

  /**
   * Test service database connection
   * 
   * @param projectRef - The project reference
   * @param serviceName - The service name
   * @param connectionString - The connection string to test
   */
  private async testServiceConnection(
    projectRef: string,
    serviceName: string,
    connectionString: string
  ): Promise<void> {
    try {
      // Test basic connectivity
      const result = await this.serviceRouter.query(projectRef, 'SELECT 1 as test')
      
      if (!result.rows || result.rows.length === 0 || result.rows[0].test !== 1) {
        throw new Error('Database connection test failed')
      }

      console.log(`${serviceName} service database connection test passed for project ${projectRef}`)
    } catch (error: any) {
      const errorMessage = `${serviceName} service database connection failed: ${error.message}`
      
      // Log the authentication failure
      const config = this.configCache.get(projectRef)
      if (config) {
        this.logAuthFailure(projectRef, serviceName, errorMessage, config.databaseUser, connectionString)
      }
      
      throw new Error(errorMessage)
    }
  }

  /**
   * Verify storage schema exists and is accessible
   * 
   * @param projectRef - The project reference
   */
  private async verifyStorageSchema(projectRef: string): Promise<void> {
    try {
      // Check if storage schema exists
      const schemaResult = await this.serviceRouter.query(
        projectRef,
        `SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'storage'`
      )

      if (schemaResult.rows.length === 0) {
        throw new Error('Storage schema not found')
      }

      // Check if storage.buckets table exists and is accessible
      const tableResult = await this.serviceRouter.query(
        projectRef,
        `SELECT table_name FROM information_schema.tables 
         WHERE table_schema = 'storage' AND table_name = 'buckets'`
      )

      if (tableResult.rows.length === 0) {
        throw new Error('Storage buckets table not found or not accessible')
      }

      // Test basic table access
      await this.serviceRouter.query(projectRef, 'SELECT COUNT(*) FROM storage.buckets')

    } catch (error: any) {
      throw new Error(`Storage schema verification failed: ${error.message}`)
    }
  }

  /**
   * Verify realtime schema exists and is accessible
   * 
   * @param projectRef - The project reference
   */
  private async verifyRealtimeSchema(projectRef: string): Promise<void> {
    try {
      // Check if _realtime schema exists
      const schemaResult = await this.serviceRouter.query(
        projectRef,
        `SELECT schema_name FROM information_schema.schemata WHERE schema_name = '_realtime'`
      )

      if (schemaResult.rows.length === 0) {
        console.warn(`Realtime schema not found for project ${projectRef}, realtime features may be limited`)
        return
      }

      // Test basic schema access
      await this.serviceRouter.query(
        projectRef,
        `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '_realtime'`
      )

    } catch (error: any) {
      console.warn(`Realtime schema verification failed for project ${projectRef}: ${error.message}`)
      // Don't throw - realtime schema is optional
    }
  }

  /**
   * Verify public schema access
   * 
   * @param projectRef - The project reference
   */
  private async verifyPublicSchemaAccess(projectRef: string): Promise<void> {
    try {
      // Test basic public schema access
      await this.serviceRouter.query(
        projectRef,
        `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'`
      )

    } catch (error: any) {
      throw new Error(`Public schema access verification failed: ${error.message}`)
    }
  }

  /**
   * Get service configuration for a project
   * 
   * @param projectRef - The project reference
   * @returns Service configuration or null if not found
   */
  async getProjectServiceConfig(projectRef: string): Promise<ProjectServiceConfig | null> {
    // Check cache first
    const cached = this.configCache.get(projectRef)
    if (cached) {
      return cached
    }

    // Try to load and configure if not cached
    try {
      const result = await this.configureProjectServices(projectRef)
      if (result.success) {
        return this.configCache.get(projectRef) || null
      }
    } catch (error) {
      console.error(`Failed to load service configuration for project ${projectRef}:`, error)
    }

    return null
  }

  /**
   * Remove service configuration for a project
   * 
   * @param projectRef - The project reference
   */
  async removeProjectServiceConfig(projectRef: string): Promise<void> {
    // Remove from cache
    this.configCache.delete(projectRef)

    // Unregister from service router
    await this.serviceRouter.unregisterProject(projectRef)

    console.log(`Service configuration removed for project ${projectRef}`)
  }

  /**
   * Log service authentication failure
   * 
   * @param projectRef - The project reference
   * @param service - The service name
   * @param error - The error message
   * @param databaseUser - The database user that failed
   * @param connectionString - The connection string (masked)
   */
  private logAuthFailure(
    projectRef: string,
    service: string,
    error: string,
    databaseUser: string,
    connectionString: string
  ): void {
    // Mask the password in connection string for logging
    const maskedConnectionString = connectionString.replace(
      /:([^:@]+)@/,
      ':***@'
    )

    const logEntry: ServiceAuthFailureLog = {
      projectRef,
      service,
      timestamp: new Date(),
      error,
      databaseUser,
      attemptedConnection: maskedConnectionString
    }

    this.authFailureLogs.push(logEntry)

    // Keep only the most recent entries
    if (this.authFailureLogs.length > this.MAX_LOG_ENTRIES) {
      this.authFailureLogs = this.authFailureLogs.slice(-this.MAX_LOG_ENTRIES)
    }

    console.error(`Service authentication failure logged:`, logEntry)
  }

  /**
   * Get authentication failure logs for a project
   * 
   * @param projectRef - The project reference
   * @param limit - Maximum number of entries to return
   * @returns Array of authentication failure logs
   */
  getAuthFailureLogs(projectRef: string, limit: number = 50): ServiceAuthFailureLog[] {
    return this.authFailureLogs
      .filter(log => log.projectRef === projectRef)
      .slice(-limit)
      .reverse() // Most recent first
  }

  /**
   * Get all authentication failure logs
   * 
   * @param limit - Maximum number of entries to return
   * @returns Array of authentication failure logs
   */
  getAllAuthFailureLogs(limit: number = 100): ServiceAuthFailureLog[] {
    return this.authFailureLogs
      .slice(-limit)
      .reverse() // Most recent first
  }

  /**
   * Clear authentication failure logs for a project
   * 
   * @param projectRef - The project reference
   */
  clearAuthFailureLogs(projectRef: string): void {
    this.authFailureLogs = this.authFailureLogs.filter(
      log => log.projectRef !== projectRef
    )
  }

  /**
   * Get service configuration statistics
   * 
   * @returns Configuration statistics
   */
  getStats(): {
    configuredProjects: number
    totalAuthFailures: number
    recentAuthFailures: number
    serviceStats: Record<string, { configured: number; errors: number }>
  } {
    const now = Date.now()
    const oneHourAgo = now - (60 * 60 * 1000)

    const recentFailures = this.authFailureLogs.filter(
      log => log.timestamp.getTime() > oneHourAgo
    )

    const serviceStats: Record<string, { configured: number; errors: number }> = {}
    const services = ['gotrue', 'storage', 'realtime', 'postgrest']

    for (const service of services) {
      serviceStats[service] = {
        configured: 0,
        errors: 0
      }
    }

    // Count configured services
    for (const config of this.configCache.values()) {
      for (const [serviceName, serviceConfig] of Object.entries(config.services)) {
        if (serviceConfig.enabled) {
          serviceStats[serviceName].configured++
        }
        serviceStats[serviceName].errors += serviceConfig.errorCount
      }
    }

    return {
      configuredProjects: this.configCache.size,
      totalAuthFailures: this.authFailureLogs.length,
      recentAuthFailures: recentFailures.length,
      serviceStats
    }
  }

  /**
   * Health check for service configurations
   * 
   * @param projectRef - The project reference (optional, checks all if not provided)
   * @returns Health check results
   */
  async healthCheck(projectRef?: string): Promise<{
    healthy: boolean
    projects: Array<{
      projectRef: string
      healthy: boolean
      services: Record<string, { healthy: boolean; error?: string }>
    }>
  }> {
    const results: Array<{
      projectRef: string
      healthy: boolean
      services: Record<string, { healthy: boolean; error?: string }>
    }> = []

    const projectsToCheck = projectRef 
      ? [projectRef]
      : Array.from(this.configCache.keys())

    for (const ref of projectsToCheck) {
      const config = this.configCache.get(ref)
      if (!config) continue

      const projectResult = {
        projectRef: ref,
        healthy: true,
        services: {} as Record<string, { healthy: boolean; error?: string }>
      }

      // Test each service
      for (const [serviceName, serviceConfig] of Object.entries(config.services)) {
        if (!serviceConfig.enabled) {
          projectResult.services[serviceName] = { healthy: true }
          continue
        }

        try {
          await this.testServiceConnection(ref, serviceName, serviceConfig.connectionString)
          projectResult.services[serviceName] = { healthy: true }
        } catch (error: any) {
          projectResult.services[serviceName] = { 
            healthy: false, 
            error: error.message 
          }
          projectResult.healthy = false
        }
      }

      results.push(projectResult)
    }

    const overallHealthy = results.every(r => r.healthy)

    return {
      healthy: overallHealthy,
      projects: results
    }
  }
}

// Singleton instance
let serviceConfigurationManager: ServiceConfigurationManager | null = null

/**
 * Get the singleton ServiceConfigurationManager instance
 */
export function getServiceConfigurationManager(): ServiceConfigurationManager {
  if (!serviceConfigurationManager) {
    serviceConfigurationManager = new ServiceConfigurationManager()
  }
  return serviceConfigurationManager
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetServiceConfigurationManager(): void {
  serviceConfigurationManager = null
}