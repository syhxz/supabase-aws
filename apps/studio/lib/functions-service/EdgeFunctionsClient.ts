import { getStorageBackend } from './storage/StorageBackendFactory'
import {
  StorageBackend,
  FunctionFile,
  FunctionMetadata,
  StorageBackendError,
  StorageNotFoundError,
} from './storage/StorageBackend'
import { 
  getDenoRuntimeService, 
  DenoRuntimeService,
  FunctionExecutionResult,
  DenoRuntimeConfig 
} from './deno/DenoRuntimeService'

/**
 * Deployment data for Edge Functions
 */
export interface DeploymentData {
  /** Function slug/identifier */
  slug: string
  /** Function files to deploy */
  files: FunctionFile[]
  /** Function metadata */
  metadata: Omit<FunctionMetadata, 'createdAt' | 'updatedAt'>
  /** Import map content (optional) */
  importMap?: string
  /** Entry point file (optional, defaults to 'index.ts') */
  entrypoint?: string
}

/**
 * Deployment result
 */
export interface DeploymentResult {
  /** Whether deployment was successful */
  success: boolean
  /** Function metadata after deployment */
  metadata: FunctionMetadata
  /** Error message if deployment failed */
  error?: string
  /** Additional details */
  details?: Record<string, any>
}

/**
 * Function information
 */
export interface FunctionInfo {
  /** Function metadata */
  metadata: FunctionMetadata
  /** Function files */
  files: FunctionFile[]
}

/**
 * Function invocation result
 */
export interface InvocationResult {
  /** HTTP status code */
  status: number
  /** Response headers */
  headers: Record<string, string>
  /** Response body */
  body: any
  /** Execution time in milliseconds */
  executionTime: number
}

/**
 * Edge Functions Client Configuration
 */
export interface EdgeFunctionsClientConfig {
  /** Deno runtime configuration */
  denoConfig?: DenoRuntimeConfig
}

/**
 * Edge Functions Client
 * 
 * Provides a unified interface for managing Edge Functions with storage backend integration.
 * Supports both local file system and AWS S3 storage backends with Deno runtime integration.
 */
export class EdgeFunctionsClient {
  private storageBackend: StorageBackend | null = null
  private denoRuntimeService: DenoRuntimeService | null = null
  private config: EdgeFunctionsClientConfig

  constructor(config: EdgeFunctionsClientConfig = {}) {
    this.config = config
  }

  /**
   * Get or initialize the storage backend
   */
  private async getStorageBackend(): Promise<StorageBackend> {
    if (!this.storageBackend) {
      this.storageBackend = await getStorageBackend()
    }
    return this.storageBackend
  }

  /**
   * Get or initialize the Deno runtime service
   */
  private getDenoRuntimeService(): DenoRuntimeService {
    if (!this.denoRuntimeService) {
      this.denoRuntimeService = getDenoRuntimeService(this.config.denoConfig)
    }
    return this.denoRuntimeService
  }

  /**
   * Deploy a function to the specified project
   * 
   * @param projectRef - Project reference
   * @param deploymentData - Function deployment data
   * @returns Deployment result
   */
  async deploy(projectRef: string, deploymentData: DeploymentData): Promise<DeploymentResult> {
    try {
      const storage = await this.getStorageBackend()
      const denoRuntime = this.getDenoRuntimeService()
      
      // Validate deployment data
      this.validateDeploymentData(deploymentData)
      
      // Prepare function files
      const files = [...deploymentData.files]
      
      // Add import map if provided
      if (deploymentData.importMap) {
        files.push({
          name: 'import_map.json',
          content: deploymentData.importMap,
          path: 'import_map.json',
        })
      }
      
      // Create complete metadata with timestamps
      const now = new Date()
      const existingMetadata = await storage.getMetadata(projectRef, deploymentData.slug)
      
      const metadata: FunctionMetadata = {
        ...deploymentData.metadata,
        slug: deploymentData.slug,
        projectRef,
        entrypoint: deploymentData.entrypoint || 'index.ts',
        createdAt: existingMetadata?.createdAt || now,
        updatedAt: now,
      }
      
      // Store function in storage backend first
      await storage.store(projectRef, deploymentData.slug, files, metadata)
      
      // Prepare function for Deno runtime validation and preloading
      let preparation
      try {
        preparation = await denoRuntime.prepareFunction(storage, projectRef, deploymentData.slug)
        
        // Validate TypeScript code
        const validation = await denoRuntime.validateFunction(preparation)
        if (!validation.valid) {
          console.warn(`Function '${deploymentData.slug}' has TypeScript validation errors:`, validation.errors)
          // Continue deployment but log warnings
        }
        
        // Preload function dependencies for better performance
        const preloadResult = await denoRuntime.preloadFunction(preparation)
        if (preloadResult.success) {
          console.log(`Successfully preloaded ${preloadResult.cachedModules} modules for function '${deploymentData.slug}'`)
        } else {
          console.warn(`Failed to preload function '${deploymentData.slug}':`, preloadResult.error)
          // Continue deployment even if preloading fails
        }
        
      } catch (error: any) {
        console.warn(`Deno runtime preparation failed for function '${deploymentData.slug}':`, error.message)
        // Continue deployment even if Deno preparation fails
      } finally {
        // Clean up temporary files
        if (preparation) {
          await preparation.cleanup()
        }
      }
      
      console.log(`Successfully deployed function '${deploymentData.slug}' to project '${projectRef}' using ${storage.getType()} storage`)
      
      return {
        success: true,
        metadata,
      }
      
    } catch (error: any) {
      console.error(`Failed to deploy function '${deploymentData.slug}':`, error)
      
      return {
        success: false,
        metadata: deploymentData.metadata as FunctionMetadata,
        error: error.message,
        details: {
          projectRef,
          functionSlug: deploymentData.slug,
          storageType: this.storageBackend?.getType() || 'unknown',
          originalError: error instanceof StorageBackendError ? error.code : 'UNKNOWN_ERROR',
        },
      }
    }
  }

  /**
   * List all functions in a project
   * 
   * @param projectRef - Project reference
   * @returns Array of function metadata
   */
  async list(projectRef: string): Promise<FunctionMetadata[]> {
    try {
      const storage = await this.getStorageBackend()
      return await storage.list(projectRef)
    } catch (error: any) {
      console.error(`Failed to list functions for project '${projectRef}':`, error)
      throw new StorageBackendError(
        `Failed to list functions: ${error.message}`,
        error instanceof StorageBackendError ? error.code : 'LIST_ERROR',
        { projectRef, originalError: error }
      )
    }
  }

  /**
   * Get function information (metadata and files)
   * 
   * @param projectRef - Project reference
   * @param slug - Function slug
   * @returns Function information
   */
  async get(projectRef: string, slug: string): Promise<FunctionInfo> {
    try {
      const storage = await this.getStorageBackend()
      
      // Get metadata and files in parallel
      const [metadata, files] = await Promise.all([
        storage.getMetadata(projectRef, slug),
        storage.retrieve(projectRef, slug),
      ])
      
      if (!metadata) {
        throw new StorageNotFoundError(`Function ${slug} in project ${projectRef}`)
      }
      
      return {
        metadata,
        files,
      }
      
    } catch (error: any) {
      if (error instanceof StorageBackendError) {
        throw error
      }
      
      console.error(`Failed to get function '${slug}' from project '${projectRef}':`, error)
      throw new StorageBackendError(
        `Failed to get function: ${error.message}`,
        'GET_ERROR',
        { projectRef, functionSlug: slug, originalError: error }
      )
    }
  }

  /**
   * Delete a function from a project
   * 
   * @param projectRef - Project reference
   * @param slug - Function slug
   */
  async delete(projectRef: string, slug: string): Promise<void> {
    try {
      const storage = await this.getStorageBackend()
      await storage.delete(projectRef, slug)
      
      console.log(`Successfully deleted function '${slug}' from project '${projectRef}'`)
      
    } catch (error: any) {
      if (error instanceof StorageBackendError) {
        throw error
      }
      
      console.error(`Failed to delete function '${slug}' from project '${projectRef}':`, error)
      throw new StorageBackendError(
        `Failed to delete function: ${error.message}`,
        'DELETE_ERROR',
        { projectRef, functionSlug: slug, originalError: error }
      )
    }
  }

  /**
   * Check if a function exists
   * 
   * @param projectRef - Project reference
   * @param slug - Function slug
   * @returns True if function exists
   */
  async exists(projectRef: string, slug: string): Promise<boolean> {
    try {
      const storage = await this.getStorageBackend()
      return await storage.exists(projectRef, slug)
    } catch (error: any) {
      console.error(`Failed to check if function '${slug}' exists in project '${projectRef}':`, error)
      return false
    }
  }

  /**
   * Get function metadata only
   * 
   * @param projectRef - Project reference
   * @param slug - Function slug
   * @returns Function metadata or null if not found
   */
  async getMetadata(projectRef: string, slug: string): Promise<FunctionMetadata | null> {
    try {
      const storage = await this.getStorageBackend()
      return await storage.getMetadata(projectRef, slug)
    } catch (error: any) {
      if (error instanceof StorageBackendError) {
        throw error
      }
      
      console.error(`Failed to get metadata for function '${slug}' in project '${projectRef}':`, error)
      throw new StorageBackendError(
        `Failed to get function metadata: ${error.message}`,
        'METADATA_ERROR',
        { projectRef, functionSlug: slug, originalError: error }
      )
    }
  }

  /**
   * Get function files only
   * 
   * @param projectRef - Project reference
   * @param slug - Function slug
   * @returns Function files
   */
  async getFiles(projectRef: string, slug: string): Promise<FunctionFile[]> {
    try {
      const storage = await this.getStorageBackend()
      return await storage.retrieve(projectRef, slug)
    } catch (error: any) {
      if (error instanceof StorageBackendError) {
        throw error
      }
      
      console.error(`Failed to get files for function '${slug}' in project '${projectRef}':`, error)
      throw new StorageBackendError(
        `Failed to get function files: ${error.message}`,
        'FILES_ERROR',
        { projectRef, functionSlug: slug, originalError: error }
      )
    }
  }

  /**
   * Invoke a function using Deno runtime
   * 
   * @param projectRef - Project reference
   * @param slug - Function slug
   * @param payload - Invocation payload
   * @returns Invocation result
   */
  async invoke(projectRef: string, slug: string, payload: any): Promise<InvocationResult> {
    try {
      const storage = await this.getStorageBackend()
      const denoRuntime = this.getDenoRuntimeService()
      
      // Verify function exists
      const exists = await this.exists(projectRef, slug)
      if (!exists) {
        throw new StorageNotFoundError(`Function ${slug} in project ${projectRef}`)
      }

      // Prepare function for execution
      const preparation = await denoRuntime.prepareFunction(storage, projectRef, slug)
      
      try {
        // Execute function with Deno runtime
        const executionResult = await denoRuntime.executeFunction(preparation, payload)
        
        // Convert Deno execution result to InvocationResult
        const result: InvocationResult = {
          status: executionResult.success ? 200 : 500,
          headers: {
            'Content-Type': 'application/json',
            'X-Function-Name': slug,
            'X-Project-Ref': projectRef,
            'X-Storage-Backend': storage.getType(),
            'X-Execution-Time': executionResult.executionTime.toString(),
          },
          body: executionResult.success 
            ? this.parseExecutionOutput(executionResult.stdout)
            : {
                error: executionResult.error || 'Function execution failed',
                stderr: executionResult.stderr,
                exitCode: executionResult.exitCode,
              },
          executionTime: executionResult.executionTime,
        }

        return result
        
      } finally {
        // Clean up temporary files
        await preparation.cleanup()
      }
      
    } catch (error: any) {
      if (error instanceof StorageBackendError) {
        throw error
      }
      
      console.error(`Failed to invoke function '${slug}' in project '${projectRef}':`, error)
      throw new StorageBackendError(
        `Failed to invoke function: ${error.message}`,
        'INVOKE_ERROR',
        { projectRef, functionSlug: slug, originalError: error }
      )
    }
  }

  /**
   * Parse execution output from Deno runtime
   * 
   * @param stdout - Standard output from Deno execution
   * @returns Parsed output
   */
  private parseExecutionOutput(stdout: string): any {
    if (!stdout || stdout.trim().length === 0) {
      return { message: 'Function executed successfully', output: null }
    }

    // Try to parse as JSON first
    try {
      return JSON.parse(stdout.trim())
    } catch {
      // If not JSON, return as plain text
      return { message: 'Function executed successfully', output: stdout.trim() }
    }
  }

  /**
   * Get storage backend health status
   * 
   * @returns Storage backend health status
   */
  async getStorageHealth(): Promise<{
    healthy: boolean
    type: string
    error?: string
    details?: Record<string, any>
  }> {
    try {
      const storage = await this.getStorageBackend()
      const healthStatus = await storage.healthCheck()
      
      return {
        healthy: healthStatus.healthy,
        type: storage.getType(),
        error: healthStatus.error,
        details: healthStatus.details,
      }
      
    } catch (error: any) {
      return {
        healthy: false,
        type: 'unknown',
        error: `Failed to check storage health: ${error.message}`,
        details: { originalError: error.message },
      }
    }
  }

  /**
   * Get Deno runtime health status
   * 
   * @returns Deno runtime health status
   */
  async getDenoHealth(): Promise<{
    healthy: boolean
    version?: string
    error?: string
    details?: Record<string, any>
  }> {
    try {
      const denoRuntime = this.getDenoRuntimeService()
      return await denoRuntime.healthCheck()
    } catch (error: any) {
      return {
        healthy: false,
        error: `Failed to check Deno runtime health: ${error.message}`,
        details: { originalError: error.message },
      }
    }
  }

  /**
   * Get comprehensive health status for Edge Functions service
   * 
   * @returns Comprehensive health status
   */
  async getHealthStatus(): Promise<{
    healthy: boolean
    storage: {
      healthy: boolean
      type: string
      error?: string
      details?: Record<string, any>
    }
    deno: {
      healthy: boolean
      version?: string
      error?: string
      details?: Record<string, any>
    }
    cache?: {
      totalCachedFunctions: number
      cacheByStorageType: Record<string, number>
      cacheByProject: Record<string, number>
    }
  }> {
    const [storageHealth, denoHealth] = await Promise.all([
      this.getStorageHealth(),
      this.getDenoHealth(),
    ])

    const denoRuntime = this.getDenoRuntimeService()
    const cacheStats = denoRuntime.getCacheStats()

    return {
      healthy: storageHealth.healthy && denoHealth.healthy,
      storage: storageHealth,
      deno: denoHealth,
      cache: cacheStats,
    }
  }

  /**
   * Validate function TypeScript code
   * 
   * @param projectRef - Project reference
   * @param slug - Function slug
   * @returns Validation result
   */
  async validateFunction(projectRef: string, slug: string): Promise<{
    valid: boolean
    errors: string[]
    warnings: string[]
  }> {
    try {
      const storage = await this.getStorageBackend()
      const denoRuntime = this.getDenoRuntimeService()
      
      // Verify function exists
      const exists = await this.exists(projectRef, slug)
      if (!exists) {
        throw new StorageNotFoundError(`Function ${slug} in project ${projectRef}`)
      }

      // Prepare function for validation
      const preparation = await denoRuntime.prepareFunction(storage, projectRef, slug)
      
      try {
        return await denoRuntime.validateFunction(preparation)
      } finally {
        await preparation.cleanup()
      }
      
    } catch (error: any) {
      if (error instanceof StorageBackendError) {
        throw error
      }
      
      return {
        valid: false,
        errors: [`Failed to validate function: ${error.message}`],
        warnings: [],
      }
    }
  }

  /**
   * Preload function dependencies
   * 
   * @param projectRef - Project reference
   * @param slug - Function slug
   * @returns Preload result
   */
  async preloadFunction(projectRef: string, slug: string): Promise<{
    success: boolean
    cachedModules: number
    error?: string
  }> {
    try {
      const storage = await this.getStorageBackend()
      const denoRuntime = this.getDenoRuntimeService()
      
      // Verify function exists
      const exists = await this.exists(projectRef, slug)
      if (!exists) {
        throw new StorageNotFoundError(`Function ${slug} in project ${projectRef}`)
      }

      // Prepare function for preloading
      const preparation = await denoRuntime.prepareFunction(storage, projectRef, slug)
      
      try {
        return await denoRuntime.preloadFunction(preparation)
      } finally {
        await preparation.cleanup()
      }
      
    } catch (error: any) {
      return {
        success: false,
        cachedModules: 0,
        error: `Failed to preload function: ${error.message}`,
      }
    }
  }

  /**
   * Clear Deno runtime cache
   * 
   * @param projectRef - Project reference (optional)
   * @param slug - Function slug (optional)
   */
  async clearDenoCache(projectRef?: string, slug?: string): Promise<void> {
    const denoRuntime = this.getDenoRuntimeService()
    await denoRuntime.clearCache(projectRef, slug)
  }

  /**
   * Get Deno runtime cache statistics
   */
  getDenoCacheStats(): {
    totalCachedFunctions: number
    cacheByStorageType: Record<string, number>
    cacheByProject: Record<string, number>
  } {
    const denoRuntime = this.getDenoRuntimeService()
    return denoRuntime.getCacheStats()
  }

  /**
   * Refresh storage backend and Deno runtime (clears cache and reinitializes)
   */
  async refreshStorage(): Promise<void> {
    this.storageBackend = null
    // Clear Deno runtime cache when refreshing storage
    if (this.denoRuntimeService) {
      await this.denoRuntimeService.clearCache()
    }
    // The next call to getStorageBackend() will reinitialize
  }

  /**
   * Refresh Deno runtime service (clears cache and reinitializes)
   */
  async refreshDenoRuntime(): Promise<void> {
    if (this.denoRuntimeService) {
      await this.denoRuntimeService.clearCache()
    }
    this.denoRuntimeService = null
    // The next call to getDenoRuntimeService() will reinitialize
  }

  /**
   * Validate deployment data
   * 
   * @param deploymentData - Deployment data to validate
   * @throws Error if validation fails
   */
  private validateDeploymentData(deploymentData: DeploymentData): void {
    if (!deploymentData.slug || deploymentData.slug.trim().length === 0) {
      throw new Error('Function slug is required')
    }

    // Validate slug format (lowercase alphanumeric, hyphens, and underscores only)
    if (!/^[a-z0-9][a-z0-9_-]*[a-z0-9]$/.test(deploymentData.slug)) {
      throw new Error(
        'Function slug must start and end with alphanumeric characters and contain only lowercase letters, numbers, hyphens, and underscores'
      )
    }

    if (!deploymentData.files || deploymentData.files.length === 0) {
      throw new Error('At least one function file is required')
    }

    // Validate that there's an entry point file
    const entrypoint = deploymentData.entrypoint || 'index.ts'
    const hasEntrypoint = deploymentData.files.some(
      file => file.path === entrypoint || file.name === entrypoint
    )

    if (!hasEntrypoint) {
      throw new Error(`Entry point file '${entrypoint}' not found in function files`)
    }

    // Validate metadata
    if (!deploymentData.metadata) {
      throw new Error('Function metadata is required')
    }

    if (!deploymentData.metadata.name || deploymentData.metadata.name.trim().length === 0) {
      throw new Error('Function name is required in metadata')
    }

    if (!deploymentData.metadata.version || deploymentData.metadata.version.trim().length === 0) {
      throw new Error('Function version is required in metadata')
    }

    if (!deploymentData.metadata.userId || deploymentData.metadata.userId.trim().length === 0) {
      throw new Error('User ID is required in metadata')
    }

    // Validate files
    for (const file of deploymentData.files) {
      if (!file.name || file.name.trim().length === 0) {
        throw new Error('File name is required for all files')
      }

      if (!file.path || file.path.trim().length === 0) {
        throw new Error('File path is required for all files')
      }

      if (file.content === undefined || file.content === null) {
        throw new Error(`File content is required for file '${file.name}'`)
      }
    }

    // Validate import map if provided
    if (deploymentData.importMap) {
      try {
        JSON.parse(deploymentData.importMap)
      } catch (error) {
        throw new Error('Import map must be valid JSON')
      }
    }
  }
}

/**
 * Singleton instance
 */
let edgeFunctionsClient: EdgeFunctionsClient | null = null

/**
 * Get the singleton EdgeFunctionsClient instance
 */
export function getEdgeFunctionsClient(config?: EdgeFunctionsClientConfig): EdgeFunctionsClient {
  if (!edgeFunctionsClient) {
    edgeFunctionsClient = new EdgeFunctionsClient(config)
  }
  return edgeFunctionsClient
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetEdgeFunctionsClient(): void {
  edgeFunctionsClient = null
}