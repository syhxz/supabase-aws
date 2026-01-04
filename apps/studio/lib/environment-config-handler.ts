/**
 * Environment-Specific Configuration Handler
 * 
 * Provides logic to adapt connection strings based on environment
 * and implement reactive updates when configuration changes.
 * 
 * Requirements: 3.3, 3.4
 */

import { generateConnectionString, type ConnectionStringOptions } from './api/self-hosted/connection-string'
import { createDatabaseTypeIdentifier, type Database } from './database-type-identifier'

export interface EnvironmentConfig {
  POSTGRES_HOST: string
  POSTGRES_PORT: number
  POSTGRES_DB: string
  POSTGRES_USER_READ_WRITE: string
  POSTGRES_USER_READ_ONLY: string
  POSTGRES_PASSWORD: string
  ENVIRONMENT: 'development' | 'staging' | 'production'
  NODE_ENV: 'development' | 'production'
}

export interface ConnectionConfigOptions {
  projectRef: string
  databaseId: string
  readOnly?: boolean
  maskPassword?: boolean
}

export interface ConfigChangeListener {
  (config: EnvironmentConfig): void
}

/**
 * Environment-specific configuration handler that adapts connection strings
 * based on environment and provides reactive updates
 */
export class EnvironmentConfigHandler {
  private currentConfig: EnvironmentConfig
  private listeners: Set<ConfigChangeListener> = new Set()
  private databases: Database[] = []

  constructor(initialConfig?: Partial<EnvironmentConfig>) {
    this.currentConfig = this.loadEnvironmentConfig(initialConfig)
  }

  /**
   * Loads environment configuration from process.env with fallbacks
   */
  private loadEnvironmentConfig(overrides?: Partial<EnvironmentConfig>): EnvironmentConfig {
    const config: EnvironmentConfig = {
      POSTGRES_HOST: process.env.POSTGRES_HOST || 'db',
      POSTGRES_PORT: parseInt(process.env.POSTGRES_PORT || '5432', 10),
      POSTGRES_DB: process.env.POSTGRES_DB || 'postgres',
      POSTGRES_USER_READ_WRITE: process.env.POSTGRES_USER_READ_WRITE || 'supabase_admin',
      POSTGRES_USER_READ_ONLY: process.env.POSTGRES_USER_READ_ONLY || 'supabase_read_only_user',
      POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD || 'postgres',
      ENVIRONMENT: (process.env.ENVIRONMENT as 'development' | 'staging' | 'production') || 'development',
      NODE_ENV: (process.env.NODE_ENV as 'development' | 'production') || 'development',
      ...overrides
    }

    return config
  }

  /**
   * Updates the database list for type identification
   */
  updateDatabases(databases: Database[]): void {
    this.databases = databases
  }

  /**
   * Gets the current environment configuration
   */
  getCurrentConfig(): EnvironmentConfig {
    return { ...this.currentConfig }
  }

  /**
   * Updates environment configuration and notifies listeners
   * Requirement 3.4: Reactive UI updates when configuration changes
   */
  updateConfig(newConfig: Partial<EnvironmentConfig>): void {
    const previousConfig = { ...this.currentConfig }
    this.currentConfig = { ...this.currentConfig, ...newConfig }

    // Notify all listeners of the configuration change
    this.notifyListeners(this.currentConfig)
  }

  /**
   * Adds a listener for configuration changes
   * Requirement 3.4: Reactive UI updates when configuration changes
   */
  addConfigChangeListener(listener: ConfigChangeListener): () => void {
    this.listeners.add(listener)
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * Notifies all listeners of configuration changes
   */
  private notifyListeners(config: EnvironmentConfig): void {
    this.listeners.forEach(listener => {
      try {
        listener(config)
      } catch (error) {
        console.error('Error in config change listener:', error)
      }
    })
  }

  /**
   * Generates environment-adapted connection string
   * Requirement 3.3: Adapt connection strings based on environment
   */
  generateEnvironmentConnectionString(options: ConnectionConfigOptions): string {
    const { projectRef, databaseId, readOnly = false, maskPassword = true } = options

    // Identify database type using current databases (if available)
    let isPrimary = true
    if (this.databases.length > 0) {
      const typeIdentifier = createDatabaseTypeIdentifier(this.databases)
      isPrimary = typeIdentifier.isPrimaryDatabase(projectRef, databaseId)
    }

    // Get environment-specific configuration
    const envConfig = this.getEnvironmentSpecificConfig()

    // Determine if we should use read-only credentials
    // Use explicit readOnly parameter first, then fall back to database type
    const useReadOnly = readOnly || !isPrimary

    // Prepare connection string options with environment-specific values
    const connectionOptions: ConnectionStringOptions = {
      databaseName: this.getDatabaseName(projectRef, databaseId),
      readOnly: useReadOnly,
      host: envConfig.host,
      port: envConfig.port,
      user: useReadOnly ? envConfig.readOnlyUser : envConfig.readWriteUser,
      password: envConfig.password,
      useEnvironmentDefaults: true,
      maskPassword
    }

    return generateConnectionString(connectionOptions)
  }

  /**
   * Gets environment-specific configuration based on current environment
   * Requirement 3.3: Environment-specific adaptation
   */
  private getEnvironmentSpecificConfig(): {
    host: string
    port: number
    readWriteUser: string
    readOnlyUser: string
    password: string
  } {
    const config = this.currentConfig

    // Adapt configuration based on environment
    switch (config.ENVIRONMENT) {
      case 'production':
        return {
          host: config.POSTGRES_HOST,
          port: config.POSTGRES_PORT,
          readWriteUser: config.POSTGRES_USER_READ_WRITE,
          readOnlyUser: config.POSTGRES_USER_READ_ONLY,
          password: config.POSTGRES_PASSWORD
        }

      case 'staging':
        return {
          host: config.POSTGRES_HOST,
          port: config.POSTGRES_PORT,
          readWriteUser: config.POSTGRES_USER_READ_WRITE,
          readOnlyUser: config.POSTGRES_USER_READ_ONLY,
          password: config.POSTGRES_PASSWORD
        }

      case 'development':
      default:
        return {
          host: config.POSTGRES_HOST || 'db',
          port: config.POSTGRES_PORT || 5432,
          readWriteUser: config.POSTGRES_USER_READ_WRITE || 'supabase_admin',
          readOnlyUser: config.POSTGRES_USER_READ_ONLY || 'supabase_read_only_user',
          password: config.POSTGRES_PASSWORD || 'postgres'
        }
    }
  }

  /**
   * Gets the appropriate database name for the connection
   */
  private getDatabaseName(projectRef: string, databaseId: string): string {
    // Find the specific database
    const database = this.databases.find(db => db.identifier === databaseId)
    
    if (database?.db_name) {
      return database.db_name
    }

    // Fallback to project reference or environment default
    return projectRef || this.currentConfig.POSTGRES_DB
  }

  /**
   * Validates environment configuration
   */
  validateConfig(): { isValid: boolean; errors: string[] } {
    const errors: string[] = []
    const config = this.currentConfig

    if (!config.POSTGRES_HOST || config.POSTGRES_HOST.trim() === '') {
      errors.push('POSTGRES_HOST cannot be empty')
    }

    if (!config.POSTGRES_PORT || config.POSTGRES_PORT <= 0 || config.POSTGRES_PORT > 65535) {
      errors.push('POSTGRES_PORT must be a valid port number between 1 and 65535')
    }

    if (!config.POSTGRES_DB || config.POSTGRES_DB.trim() === '') {
      errors.push('POSTGRES_DB cannot be empty')
    }

    if (!config.POSTGRES_USER_READ_WRITE || config.POSTGRES_USER_READ_WRITE.trim() === '') {
      errors.push('POSTGRES_USER_READ_WRITE cannot be empty')
    }

    if (!config.POSTGRES_USER_READ_ONLY || config.POSTGRES_USER_READ_ONLY.trim() === '') {
      errors.push('POSTGRES_USER_READ_ONLY cannot be empty')
    }

    if (!config.POSTGRES_PASSWORD || config.POSTGRES_PASSWORD.trim() === '') {
      errors.push('POSTGRES_PASSWORD cannot be empty')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Reloads configuration from environment variables
   * Useful for detecting external configuration changes
   */
  reloadFromEnvironment(): void {
    const newConfig = this.loadEnvironmentConfig()
    
    // Check if configuration actually changed
    const hasChanged = Object.keys(newConfig).some(key => {
      const configKey = key as keyof EnvironmentConfig
      return this.currentConfig[configKey] !== newConfig[configKey]
    })

    if (hasChanged) {
      this.currentConfig = newConfig
      this.notifyListeners(this.currentConfig)
    }
  }

  /**
   * Gets connection strings for all supported formats with environment adaptation
   */
  getAllConnectionStrings(options: ConnectionConfigOptions): {
    postgresql: string
    psql: string
    jdbc: string
    dotnet: string
    nodejs: string
  } {
    const baseConnectionString = this.generateEnvironmentConnectionString(options)
    const { projectRef, databaseId, readOnly = false } = options

    // Get environment-specific configuration
    const envConfig = this.getEnvironmentSpecificConfig()
    const databaseName = this.getDatabaseName(projectRef, databaseId)
    const user = readOnly ? envConfig.readOnlyUser : envConfig.readWriteUser
    const password = '[YOUR_PASSWORD]' // Always mask for display

    return {
      postgresql: baseConnectionString,
      psql: `psql -h ${envConfig.host} -p ${envConfig.port} -d ${databaseName} -U ${user}`,
      jdbc: `jdbc:postgresql://${envConfig.host}:${envConfig.port}/${databaseName}?user=${user}&password=${password}`,
      dotnet: `Host=${envConfig.host};Database=${databaseName};Username=${user};Password=${password};SSL Mode=Require;Trust Server Certificate=true`,
      nodejs: `DATABASE_URL=${baseConnectionString}`
    }
  }
}

/**
 * Global instance for environment configuration handling
 */
let globalConfigHandler: EnvironmentConfigHandler | null = null

/**
 * Gets or creates the global environment configuration handler
 */
export function getEnvironmentConfigHandler(): EnvironmentConfigHandler {
  if (!globalConfigHandler) {
    globalConfigHandler = new EnvironmentConfigHandler()
  }
  return globalConfigHandler
}

/**
 * Creates a new environment configuration handler instance
 */
export function createEnvironmentConfigHandler(initialConfig?: Partial<EnvironmentConfig>): EnvironmentConfigHandler {
  return new EnvironmentConfigHandler(initialConfig)
}

/**
 * Utility function to detect environment changes and update configuration
 */
export function setupEnvironmentWatcher(handler: EnvironmentConfigHandler): () => void {
  // Set up periodic checking for environment changes
  const interval = setInterval(() => {
    handler.reloadFromEnvironment()
  }, 5000) // Check every 5 seconds

  // Return cleanup function
  return () => {
    clearInterval(interval)
  }
}

/**
 * React hook for environment configuration (if using React)
 */
export function useEnvironmentConfig() {
  const handler = getEnvironmentConfigHandler()
  
  return {
    config: handler.getCurrentConfig(),
    updateConfig: (newConfig: Partial<EnvironmentConfig>) => handler.updateConfig(newConfig),
    addListener: (listener: ConfigChangeListener) => handler.addConfigChangeListener(listener),
    generateConnectionString: (options: ConnectionConfigOptions) => 
      handler.generateEnvironmentConnectionString(options),
    getAllConnectionStrings: (options: ConnectionConfigOptions) => 
      handler.getAllConnectionStrings(options),
    validateConfig: () => handler.validateConfig(),
    reloadFromEnvironment: () => handler.reloadFromEnvironment()
  }
}