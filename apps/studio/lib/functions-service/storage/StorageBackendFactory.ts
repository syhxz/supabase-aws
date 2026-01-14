import {
  StorageBackend,
  StorageBackendConfig,
  StorageConfigurationError,
} from './StorageBackend'
import { LocalFileSystemStorage } from './LocalFileSystemStorage'
import { S3Storage } from './S3Storage'

/**
 * Storage Backend Factory
 * 
 * Creates and manages storage backend instances based on configuration.
 * Provides fallback logic for invalid configurations.
 */
export class StorageBackendFactory {
  private static instance: StorageBackendFactory | null = null
  private cachedBackend: StorageBackend | null = null
  private lastConfig: string | null = null

  /**
   * Get singleton instance
   */
  static getInstance(): StorageBackendFactory {
    if (!StorageBackendFactory.instance) {
      StorageBackendFactory.instance = new StorageBackendFactory()
    }
    return StorageBackendFactory.instance
  }

  /**
   * Reset singleton instance (useful for testing)
   */
  static resetInstance(): void {
    StorageBackendFactory.instance = null
  }

  /**
   * Create storage backend based on environment configuration
   */
  async createStorageBackend(): Promise<StorageBackend> {
    const config = this.getStorageConfig()
    const configHash = this.getConfigHash(config)

    // Return cached backend if configuration hasn't changed
    if (this.cachedBackend && this.lastConfig === configHash) {
      return this.cachedBackend
    }

    try {
      const backend = await this.createBackendFromConfig(config)
      
      // Perform health check on the backend
      const healthStatus = await backend.healthCheck()
      
      if (!healthStatus.healthy) {
        console.warn(`Storage backend health check failed: ${healthStatus.error}`)
        
        // If S3 backend fails, fall back to local storage
        if (config.type === 's3') {
          console.warn('Falling back to local file system storage due to S3 health check failure')
          return this.createFallbackBackend()
        }
        
        throw new StorageConfigurationError(
          `Storage backend health check failed: ${healthStatus.error}`,
          healthStatus.details
        )
      }

      // Cache the successful backend
      this.cachedBackend = backend
      this.lastConfig = configHash
      
      console.log(`Successfully initialized ${backend.getType()} storage backend`)
      return backend

    } catch (error: any) {
      console.error(`Failed to initialize ${config.type} storage backend:`, error)
      
      // Fall back to local storage for any configuration errors
      if (config.type === 's3') {
        console.warn('Falling back to local file system storage due to S3 configuration error')
        return this.createFallbackBackend()
      }
      
      throw error
    }
  }

  /**
   * Create storage backend from configuration
   */
  private async createBackendFromConfig(config: StorageBackendConfig): Promise<StorageBackend> {
    switch (config.type) {
      case 'local':
        return new LocalFileSystemStorage(config.options.basePath)
      
      case 's3':
        return new S3Storage(config.options)
      
      default:
        throw new StorageConfigurationError(
          `Unsupported storage backend type: ${config.type}. Supported types: local, s3`
        )
    }
  }

  /**
   * Create fallback backend (local file system)
   */
  private createFallbackBackend(): StorageBackend {
    console.log('Creating fallback local file system storage backend')
    const fallbackBackend = new LocalFileSystemStorage()
    
    // Cache the fallback backend
    this.cachedBackend = fallbackBackend
    this.lastConfig = 'fallback-local'
    
    return fallbackBackend
  }

  /**
   * Get storage configuration from environment variables
   */
  private getStorageConfig(): StorageBackendConfig {
    const backendType = (process.env.EDGE_FUNCTIONS_STORAGE_BACKEND || 'local').toLowerCase()

    switch (backendType) {
      case 'local':
        return {
          type: 'local',
          options: {
            basePath: process.env.EDGE_FUNCTIONS_LOCAL_PATH,
          },
        }

      case 's3':
        return {
          type: 's3',
          options: {
            bucketName: process.env.EDGE_FUNCTIONS_S3_BUCKET_NAME,
            region: process.env.EDGE_FUNCTIONS_S3_REGION,
            endpoint: process.env.EDGE_FUNCTIONS_S3_ENDPOINT,
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            basePrefix: process.env.EDGE_FUNCTIONS_S3_PREFIX,
          },
        }

      default:
        console.warn(`Invalid storage backend type '${backendType}', falling back to local storage`)
        return {
          type: 'local',
          options: {
            basePath: process.env.EDGE_FUNCTIONS_LOCAL_PATH,
          },
        }
    }
  }

  /**
   * Generate a hash of the configuration for caching
   */
  private getConfigHash(config: StorageBackendConfig): string {
    return JSON.stringify({
      type: config.type,
      options: config.options,
    })
  }

  /**
   * Validate storage backend configuration
   */
  validateConfiguration(): {
    valid: boolean
    errors: string[]
    warnings: string[]
    config: StorageBackendConfig
  } {
    const errors: string[] = []
    const warnings: string[] = []
    const config = this.getStorageConfig()

    // Validate based on backend type
    switch (config.type) {
      case 'local':
        this.validateLocalConfig(config, errors, warnings)
        break

      case 's3':
        this.validateS3Config(config, errors, warnings)
        break

      default:
        errors.push(`Unsupported storage backend type: ${config.type}`)
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      config,
    }
  }

  /**
   * Validate local storage configuration
   */
  private validateLocalConfig(
    config: StorageBackendConfig,
    errors: string[],
    warnings: string[]
  ): void {
    const basePath = config.options.basePath

    if (basePath && typeof basePath !== 'string') {
      errors.push('EDGE_FUNCTIONS_LOCAL_PATH must be a valid path string')
    }

    if (!basePath) {
      warnings.push('EDGE_FUNCTIONS_LOCAL_PATH not set, using default: /home/deno/functions')
    }
  }

  /**
   * Validate S3 storage configuration
   */
  private validateS3Config(
    config: StorageBackendConfig,
    errors: string[],
    warnings: string[]
  ): void {
    const { bucketName, region, accessKeyId, secretAccessKey, endpoint } = config.options

    // Required fields
    if (!bucketName) {
      errors.push('EDGE_FUNCTIONS_S3_BUCKET_NAME is required for S3 storage')
    }

    if (!region) {
      errors.push('EDGE_FUNCTIONS_S3_REGION is required for S3 storage')
    }

    if (!accessKeyId) {
      errors.push('AWS_ACCESS_KEY_ID is required for S3 storage')
    }

    if (!secretAccessKey) {
      errors.push('AWS_SECRET_ACCESS_KEY is required for S3 storage')
    }

    // Optional fields with warnings
    if (endpoint) {
      warnings.push(`Using custom S3 endpoint: ${endpoint}`)
    }

    if (!config.options.basePrefix) {
      warnings.push('EDGE_FUNCTIONS_S3_PREFIX not set, using default: edge-functions')
    }

    // Validate bucket name format (basic validation)
    if (bucketName && typeof bucketName === 'string') {
      if (bucketName.length < 3 || bucketName.length > 63) {
        errors.push('S3 bucket name must be between 3 and 63 characters')
      }

      if (!/^[a-z0-9.-]+$/.test(bucketName)) {
        errors.push('S3 bucket name can only contain lowercase letters, numbers, dots, and hyphens')
      }

      if (bucketName.startsWith('.') || bucketName.endsWith('.')) {
        errors.push('S3 bucket name cannot start or end with a dot')
      }
    }

    // Validate region format
    if (region && typeof region === 'string') {
      if (!/^[a-z0-9-]+$/.test(region)) {
        warnings.push('S3 region format may be invalid')
      }
    }
  }

  /**
   * Get current storage backend configuration summary
   */
  getConfigurationSummary(): {
    type: string
    healthy: boolean
    details: Record<string, any>
  } {
    const config = this.getStorageConfig()
    
    return {
      type: config.type,
      healthy: this.cachedBackend !== null,
      details: {
        ...config.options,
        // Mask sensitive information
        accessKeyId: config.options.accessKeyId ? '***' : undefined,
        secretAccessKey: config.options.secretAccessKey ? '***' : undefined,
      },
    }
  }

  /**
   * Force refresh of storage backend (clears cache)
   */
  refreshBackend(): void {
    this.cachedBackend = null
    this.lastConfig = null
    console.log('Storage backend cache cleared, will reinitialize on next access')
  }
}

/**
 * Convenience function to get storage backend instance
 */
export async function getStorageBackend(): Promise<StorageBackend> {
  const factory = StorageBackendFactory.getInstance()
  return factory.createStorageBackend()
}

/**
 * Convenience function to validate storage configuration
 */
export function validateStorageConfiguration() {
  const factory = StorageBackendFactory.getInstance()
  return factory.validateConfiguration()
}

/**
 * Convenience function to get configuration summary
 */
export function getStorageConfigurationSummary() {
  const factory = StorageBackendFactory.getInstance()
  return factory.getConfigurationSummary()
}

/**
 * Convenience function to refresh storage backend
 */
export function refreshStorageBackend(): void {
  const factory = StorageBackendFactory.getInstance()
  factory.refreshBackend()
}