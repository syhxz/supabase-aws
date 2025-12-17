/**
 * Integration utilities for environment configuration
 * 
 * Provides helper functions to integrate environment-specific configuration
 * with existing UI components and connection string generation.
 * 
 * Requirements: 3.3, 3.4
 */

import { getEnvironmentConfigHandler, type EnvironmentConfig } from './environment-config-handler'
import { generateConnectionString, type ConnectionStringOptions } from './api/self-hosted/connection-string'
import { constructConnStringSyntax } from '../components/interfaces/Connect/DatabaseSettings.utils'

/**
 * Enhanced connection string generation with environment adaptation
 * 
 * @param baseConnectionString - Base connection string from API
 * @param options - Connection string construction options
 * @returns Enhanced connection string syntax with environment-specific values
 */
export function enhanceConnectionStringSyntax(
  baseConnectionString: string,
  options: {
    selectedTab: 'uri' | 'psql' | 'golang' | 'jdbc' | 'dotnet' | 'nodejs' | 'php' | 'python'
    usePoolerConnection: boolean
    ref: string
    cloudProvider: string
    region: string
    tld: string
    portNumber: string
  }
) {
  try {
    // Get current environment configuration
    const configHandler = getEnvironmentConfigHandler()
    const envConfig = configHandler.getCurrentConfig()

    // Extract actual connection info from environment
    const actualConnectionInfo = {
      user: envConfig.POSTGRES_USER_READ_WRITE,
      password: '[YOUR_PASSWORD]', // Always masked for security
      host: envConfig.POSTGRES_HOST,
      port: envConfig.POSTGRES_PORT,
      database: envConfig.POSTGRES_DB
    }

    // Use the existing function with actual connection info
    return constructConnStringSyntax(baseConnectionString, {
      ...options,
      actualConnectionInfo
    })
  } catch (error) {
    console.warn('Failed to enhance connection string with environment config:', error)
    
    // Fall back to original function without environment enhancement
    return constructConnStringSyntax(baseConnectionString, options)
  }
}

/**
 * Gets environment-adapted connection information for UI display
 * 
 * @param projectRef - Project reference ID
 * @param databaseName - Database name
 * @param readOnly - Whether to use read-only credentials
 * @returns Connection information adapted for current environment
 */
export function getEnvironmentConnectionInfo(
  projectRef: string,
  databaseName: string,
  readOnly: boolean = false
): {
  host: string
  port: number
  database: string
  user: string
  connectionString: string
  environment: string
} {
  try {
    const configHandler = getEnvironmentConfigHandler()
    const envConfig = configHandler.getCurrentConfig()

    // Generate connection string with environment-specific values
    const connectionOptions: ConnectionStringOptions = {
      databaseName: databaseName || envConfig.POSTGRES_DB,
      readOnly,
      host: envConfig.POSTGRES_HOST,
      port: envConfig.POSTGRES_PORT,
      user: readOnly ? envConfig.POSTGRES_USER_READ_ONLY : envConfig.POSTGRES_USER_READ_WRITE,
      password: envConfig.POSTGRES_PASSWORD,
      useEnvironmentDefaults: true,
      maskPassword: true
    }

    const connectionString = generateConnectionString(connectionOptions)

    return {
      host: envConfig.POSTGRES_HOST,
      port: envConfig.POSTGRES_PORT,
      database: databaseName || envConfig.POSTGRES_DB,
      user: readOnly ? envConfig.POSTGRES_USER_READ_ONLY : envConfig.POSTGRES_USER_READ_WRITE,
      connectionString,
      environment: envConfig.ENVIRONMENT
    }
  } catch (error) {
    console.error('Failed to get environment connection info:', error)
    
    // Return fallback values
    return {
      host: process.env.POSTGRES_HOST || 'db',
      port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
      database: databaseName || process.env.POSTGRES_DB || 'postgres',
      user: readOnly 
        ? (process.env.POSTGRES_USER_READ_ONLY || 'supabase_read_only_user')
        : (process.env.POSTGRES_USER_READ_WRITE || 'supabase_admin'),
      connectionString: 'Error generating connection string',
      environment: process.env.ENVIRONMENT || 'development'
    }
  }
}

/**
 * Validates that environment configuration is properly set up
 * 
 * @returns Validation result with any configuration issues
 */
export function validateEnvironmentSetup(): {
  isValid: boolean
  warnings: string[]
  errors: string[]
  environment: string
} {
  const warnings: string[] = []
  const errors: string[] = []

  try {
    const configHandler = getEnvironmentConfigHandler()
    const envConfig = configHandler.getCurrentConfig()
    const validation = configHandler.validateConfig()

    // Add validation errors
    errors.push(...validation.errors)

    // Check for common configuration issues
    if (envConfig.POSTGRES_HOST === 'localhost' && envConfig.ENVIRONMENT === 'production') {
      warnings.push('Using localhost in production environment - this may not be accessible')
    }

    if (envConfig.POSTGRES_USER_READ_WRITE === 'postgres' && envConfig.ENVIRONMENT === 'production') {
      warnings.push('Using default postgres user in production - consider using a dedicated user')
    }

    if (envConfig.POSTGRES_PASSWORD === 'postgres' && envConfig.ENVIRONMENT === 'production') {
      warnings.push('Using default password in production - this is a security risk')
    }

    return {
      isValid: validation.isValid && errors.length === 0,
      warnings,
      errors,
      environment: envConfig.ENVIRONMENT
    }
  } catch (error) {
    errors.push(`Failed to validate environment setup: ${error instanceof Error ? error.message : 'Unknown error'}`)
    
    return {
      isValid: false,
      warnings,
      errors,
      environment: process.env.ENVIRONMENT || 'unknown'
    }
  }
}

/**
 * Updates environment configuration and triggers reactive updates
 * 
 * @param updates - Partial configuration updates
 * @returns Promise that resolves when update is complete
 */
export async function updateEnvironmentConfig(
  updates: Partial<EnvironmentConfig>
): Promise<void> {
  try {
    const configHandler = getEnvironmentConfigHandler()
    configHandler.updateConfig(updates)
    
    // Allow time for reactive updates to propagate
    await new Promise(resolve => setTimeout(resolve, 100))
  } catch (error) {
    console.error('Failed to update environment config:', error)
    throw error
  }
}