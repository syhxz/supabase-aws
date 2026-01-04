/**
 * React hook for environment configuration management
 * 
 * Provides reactive updates when configuration changes
 * Requirements: 3.3, 3.4
 */

import { useState, useEffect, useCallback } from 'react'
import { 
  getEnvironmentConfigHandler, 
  type EnvironmentConfig, 
  type ConnectionConfigOptions,
  type ConfigChangeListener 
} from '../lib/environment-config-handler'

export interface UseEnvironmentConfigReturn {
  config: EnvironmentConfig
  isLoading: boolean
  error: string | null
  updateConfig: (newConfig: Partial<EnvironmentConfig>) => void
  generateConnectionString: (options: ConnectionConfigOptions) => string
  getAllConnectionStrings: (options: ConnectionConfigOptions) => {
    postgresql: string
    psql: string
    jdbc: string
    dotnet: string
    nodejs: string
  }
  validateConfig: () => { isValid: boolean; errors: string[] }
  reloadFromEnvironment: () => void
}

/**
 * Hook for managing environment configuration with reactive updates
 * 
 * Requirement 3.4: Reactive UI updates when configuration changes
 */
export function useEnvironmentConfig(): UseEnvironmentConfigReturn {
  const [config, setConfig] = useState<EnvironmentConfig>(() => 
    getEnvironmentConfigHandler().getCurrentConfig()
  )
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handler = getEnvironmentConfigHandler()

  // Set up listener for configuration changes
  useEffect(() => {
    const listener: ConfigChangeListener = (newConfig) => {
      setConfig(newConfig)
      setError(null) // Clear any previous errors when config updates
    }

    const unsubscribe = handler.addConfigChangeListener(listener)
    
    return unsubscribe
  }, [handler])

  // Update configuration with error handling
  const updateConfig = useCallback((newConfig: Partial<EnvironmentConfig>) => {
    try {
      setIsLoading(true)
      setError(null)
      handler.updateConfig(newConfig)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update configuration')
    } finally {
      setIsLoading(false)
    }
  }, [handler])

  // Generate connection string with error handling
  const generateConnectionString = useCallback((options: ConnectionConfigOptions) => {
    try {
      return handler.generateEnvironmentConnectionString(options)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate connection string'
      setError(errorMessage)
      return `Error: ${errorMessage}`
    }
  }, [handler])

  // Get all connection strings with error handling
  const getAllConnectionStrings = useCallback((options: ConnectionConfigOptions) => {
    try {
      return handler.getAllConnectionStrings(options)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate connection strings'
      setError(errorMessage)
      return {
        postgresql: `Error: ${errorMessage}`,
        psql: `Error: ${errorMessage}`,
        jdbc: `Error: ${errorMessage}`,
        dotnet: `Error: ${errorMessage}`,
        nodejs: `Error: ${errorMessage}`
      }
    }
  }, [handler])

  // Validate configuration
  const validateConfig = useCallback(() => {
    return handler.validateConfig()
  }, [handler])

  // Reload from environment
  const reloadFromEnvironment = useCallback(() => {
    try {
      setIsLoading(true)
      setError(null)
      handler.reloadFromEnvironment()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reload configuration')
    } finally {
      setIsLoading(false)
    }
  }, [handler])

  return {
    config,
    isLoading,
    error,
    updateConfig,
    generateConnectionString,
    getAllConnectionStrings,
    validateConfig,
    reloadFromEnvironment
  }
}

/**
 * Hook for watching specific configuration values
 */
export function useConfigValue<K extends keyof EnvironmentConfig>(
  key: K
): [EnvironmentConfig[K], (value: EnvironmentConfig[K]) => void] {
  const { config, updateConfig } = useEnvironmentConfig()
  
  const setValue = useCallback((value: EnvironmentConfig[K]) => {
    updateConfig({ [key]: value } as Partial<EnvironmentConfig>)
  }, [key, updateConfig])

  return [config[key], setValue]
}

/**
 * Hook for connection string generation with automatic updates
 */
export function useConnectionString(options: ConnectionConfigOptions) {
  const { generateConnectionString, config } = useEnvironmentConfig()
  const [connectionString, setConnectionString] = useState<string>('')

  useEffect(() => {
    try {
      const newConnectionString = generateConnectionString(options)
      setConnectionString(newConnectionString)
    } catch (err) {
      console.error('Failed to generate connection string:', err)
      setConnectionString('Error generating connection string')
    }
  }, [generateConnectionString, options, config])

  return connectionString
}

/**
 * Hook for all connection strings with automatic updates
 */
export function useAllConnectionStrings(options: ConnectionConfigOptions) {
  const { getAllConnectionStrings, config } = useEnvironmentConfig()
  const [connectionStrings, setConnectionStrings] = useState(() => 
    getAllConnectionStrings(options)
  )

  useEffect(() => {
    try {
      const newConnectionStrings = getAllConnectionStrings(options)
      setConnectionStrings(newConnectionStrings)
    } catch (err) {
      console.error('Failed to generate connection strings:', err)
      setConnectionStrings({
        postgresql: 'Error generating connection string',
        psql: 'Error generating connection string',
        jdbc: 'Error generating connection string',
        dotnet: 'Error generating connection string',
        nodejs: 'Error generating connection string'
      })
    }
  }, [getAllConnectionStrings, options, config])

  return connectionStrings
}