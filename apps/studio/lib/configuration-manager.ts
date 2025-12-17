/**
 * Configuration Manager
 * 
 * Coordinates configuration loading, error recovery, and fallback strategies.
 * This service provides a unified interface for:
 * - Runtime configuration loading with retries
 * - Error recovery and user feedback
 * - Graceful degradation to fallback configurations
 * - Configuration health monitoring
 * - User notification and guidance
 */

import { useState, useCallback, useEffect } from 'react'
import {
  fetchRuntimeConfig,
  getRuntimeConfig,
  getRuntimeConfigStore,
  subscribeToConfigChanges,
  refreshRuntimeConfig,
  type RuntimeConfig,
} from 'common/runtime-config'
import { ConfigError, analyzeConfigError } from 'common/runtime-config-errors'
import { performConfigHealthCheck, type ConfigHealthResult } from './config-health'
import {
  attemptConfigurationFallback,
  cacheConfiguration,
  validateFallbackConfiguration,
  explainConfigurationLimitations,
  type FallbackConfig,
  type FallbackResult,
} from './configuration-fallback'
import { logConfigurationError, logConfigurationRecovery } from 'common/configuration-logging'

/**
 * Configuration state
 */
export interface ConfigurationState {
  /** Current configuration (runtime or fallback) */
  config: RuntimeConfig | FallbackConfig | null
  /** Whether configuration is loading */
  isLoading: boolean
  /** Current error (if any) */
  error: ConfigError | null
  /** Health check result */
  healthResult: ConfigHealthResult | null
  /** Whether using fallback configuration */
  usingFallback: boolean
  /** Fallback result (if using fallback) */
  fallbackResult: FallbackResult | null
  /** Number of retry attempts */
  retryAttempts: number
  /** Whether retry is in progress */
  isRetrying: boolean
}

/**
 * Configuration manager options
 */
export interface ConfigurationManagerOptions {
  /** Maximum retry attempts */
  maxRetries?: number
  /** Retry delay in milliseconds */
  retryDelay?: number
  /** Whether to perform health checks */
  enableHealthChecks?: boolean
  /** Whether to cache successful configurations */
  enableCaching?: boolean
  /** Whether to auto-retry on failure */
  autoRetry?: boolean
}

/**
 * Default configuration manager options
 */
const DEFAULT_OPTIONS: Required<ConfigurationManagerOptions> = {
  maxRetries: 3,
  retryDelay: 1000,
  enableHealthChecks: true,
  enableCaching: true,
  autoRetry: true,
}

/**
 * Configuration manager hook
 */
export function useConfigurationManager(options: ConfigurationManagerOptions = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  
  const [state, setState] = useState<ConfigurationState>({
    config: null,
    isLoading: false,
    error: null,
    healthResult: null,
    usingFallback: false,
    fallbackResult: null,
    retryAttempts: 0,
    isRetrying: false,
  })

  /**
   * Updates state with new values
   */
  const updateState = useCallback((updates: Partial<ConfigurationState>) => {
    setState(prev => ({ ...prev, ...updates }))
  }, [])

  /**
   * Performs health check if enabled
   */
  const performHealthCheck = useCallback(async (): Promise<ConfigHealthResult | null> => {
    if (!opts.enableHealthChecks) {
      return null
    }

    try {
      console.log('[Configuration Manager] Performing health check...')
      const healthResult = await performConfigHealthCheck()
      
      console.log('[Configuration Manager] Health check completed:', {
        healthy: healthResult.healthy,
        errors: healthResult.errors.length,
        warnings: healthResult.warnings.length,
      })
      
      return healthResult
    } catch (error) {
      console.error('[Configuration Manager] Health check failed:', error)
      return null
    }
  }, [opts.enableHealthChecks])

  /**
   * Caches configuration if enabled
   */
  const cacheConfigIfEnabled = useCallback((config: RuntimeConfig | FallbackConfig) => {
    if (!opts.enableCaching) {
      return
    }

    try {
      cacheConfiguration({
        gotrueUrl: config.gotrueUrl,
        supabaseUrl: config.supabaseUrl,
        apiUrl: config.apiUrl,
        anonKey: config.anonKey,
        source: config.source,
        environment: config.environment,
      })
    } catch (error) {
      console.warn('[Configuration Manager] Failed to cache configuration:', error)
    }
  }, [opts.enableCaching])

  /**
   * Attempts to load runtime configuration
   */
  const loadRuntimeConfiguration = useCallback(async (): Promise<{
    success: boolean
    config?: RuntimeConfig
    error?: ConfigError
  }> => {
    try {
      console.log('[Configuration Manager] Loading runtime configuration...')
      const config = await fetchRuntimeConfig()
      
      console.log('[Configuration Manager] ✓ Runtime configuration loaded successfully')
      console.log('[Configuration Manager] Source:', config.source)
      console.log('[Configuration Manager] Environment:', config.environment)
      
      // Cache successful configuration
      cacheConfigIfEnabled(config)
      
      return { success: true, config }
    } catch (error) {
      console.error('[Configuration Manager] Runtime configuration failed:', error)
      
      const configError = analyzeConfigError(error)
      logConfigurationError('Configuration Manager', configError, {
        context: 'runtime configuration loading',
        retryAttempts: state.retryAttempts,
        maxRetries: opts.maxRetries,
      })
      
      return { success: false, error: configError }
    }
  }, [cacheConfigIfEnabled, state.retryAttempts, opts.maxRetries])

  /**
   * Attempts fallback configuration
   */
  const attemptFallback = useCallback(async (originalError: ConfigError): Promise<{
    success: boolean
    fallbackResult: FallbackResult
  }> => {
    console.log('[Configuration Manager] Attempting fallback configuration...')
    
    const fallbackResult = attemptConfigurationFallback(originalError)
    
    if (fallbackResult.success && fallbackResult.config) {
      console.log('[Configuration Manager] ✓ Fallback configuration successful')
      console.log('[Configuration Manager] Fallback strategy:', fallbackResult.strategy)
      
      // Validate fallback configuration
      const validation = validateFallbackConfiguration(fallbackResult.config)
      if (!validation.isValid) {
        console.error('[Configuration Manager] Fallback configuration validation failed:', validation.errors)
        
        // Log validation errors but continue with fallback
        validation.errors.forEach(error => {
          console.error('[Configuration Manager] Validation error:', error)
        })
      }
      
      if (validation.warnings.length > 0) {
        console.warn('[Configuration Manager] Fallback configuration warnings:', validation.warnings)
      }
      
      // Cache fallback configuration if it's valid
      if (validation.isValid) {
        cacheConfigIfEnabled(fallbackResult.config)
      }
      
      logConfigurationRecovery(
        'Configuration Manager',
        fallbackResult.strategy as 'cached' | 'build-time' | 'emergency-defaults',
        originalError,
        {
          gotrueUrl: fallbackResult.config.gotrueUrl,
          supabaseUrl: fallbackResult.config.supabaseUrl,
          apiUrl: fallbackResult.config.apiUrl,
        },
        fallbackResult.config.limitations
      )
    } else {
      console.error('[Configuration Manager] ❌ All fallback strategies failed')
    }
    
    return { success: fallbackResult.success, fallbackResult }
  }, [cacheConfigIfEnabled])

  /**
   * Loads configuration with error recovery
   */
  const loadConfiguration = useCallback(async (isRetry: boolean = false): Promise<void> => {
    updateState({
      isLoading: true,
      isRetrying: isRetry,
      error: null,
      healthResult: null,
    })

    // Attempt to load runtime configuration
    const runtimeResult = await loadRuntimeConfiguration()
    
    if (runtimeResult.success && runtimeResult.config) {
      // Runtime configuration successful
      const healthResult = await performHealthCheck()
      
      updateState({
        config: runtimeResult.config,
        isLoading: false,
        isRetrying: false,
        error: null,
        healthResult,
        usingFallback: false,
        fallbackResult: null,
        retryAttempts: 0,
      })
      
      return
    }

    // Runtime configuration failed, attempt fallback
    const fallbackResult = await attemptFallback(runtimeResult.error!)
    
    if (fallbackResult.success && fallbackResult.fallbackResult.config) {
      // Fallback successful
      const healthResult = await performHealthCheck()
      
      updateState({
        config: fallbackResult.fallbackResult.config,
        isLoading: false,
        isRetrying: false,
        error: runtimeResult.error!,
        healthResult,
        usingFallback: true,
        fallbackResult: fallbackResult.fallbackResult,
        retryAttempts: isRetry ? state.retryAttempts : 0,
      })
    } else {
      // Both runtime and fallback failed
      updateState({
        config: null,
        isLoading: false,
        isRetrying: false,
        error: runtimeResult.error!,
        healthResult: null,
        usingFallback: false,
        fallbackResult: fallbackResult.fallbackResult,
        retryAttempts: isRetry ? state.retryAttempts : 0,
      })
    }
  }, [
    updateState,
    loadRuntimeConfiguration,
    performHealthCheck,
    attemptFallback,
    state.retryAttempts,
  ])

  /**
   * Retries configuration loading
   */
  const retryConfiguration = useCallback(async (): Promise<void> => {
    if (state.isRetrying || state.retryAttempts >= opts.maxRetries) {
      console.warn('[Configuration Manager] Cannot retry: already retrying or max retries reached')
      return
    }

    const newRetryAttempts = state.retryAttempts + 1
    console.log(`[Configuration Manager] Retrying configuration (attempt ${newRetryAttempts}/${opts.maxRetries})`)
    
    updateState({ retryAttempts: newRetryAttempts })
    
    // Add delay before retry
    if (opts.retryDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, opts.retryDelay))
    }
    
    await loadConfiguration(true)
  }, [state.isRetrying, state.retryAttempts, opts.maxRetries, opts.retryDelay, updateState, loadConfiguration])

  /**
   * Forces refresh of configuration
   */
  const refreshConfiguration = useCallback(async (): Promise<void> => {
    console.log('[Configuration Manager] Forcing configuration refresh...')
    
    updateState({
      retryAttempts: 0,
      error: null,
      usingFallback: false,
      fallbackResult: null,
    })
    
    try {
      await refreshRuntimeConfig()
      await loadConfiguration()
    } catch (error) {
      console.error('[Configuration Manager] Force refresh failed:', error)
      await loadConfiguration()
    }
  }, [updateState, loadConfiguration])

  /**
   * Accepts fallback configuration and stops retrying
   */
  const acceptFallback = useCallback((): void => {
    console.log('[Configuration Manager] User accepted fallback configuration')
    
    updateState({
      retryAttempts: opts.maxRetries, // Prevent further auto-retries
      isRetrying: false,
    })
  }, [updateState, opts.maxRetries])

  /**
   * Gets user-friendly status message
   */
  const getStatusMessage = useCallback((): string => {
    if (state.isLoading && !state.isRetrying) {
      return 'Loading configuration...'
    }
    
    if (state.isRetrying) {
      return `Retrying configuration (${state.retryAttempts}/${opts.maxRetries})...`
    }
    
    if (state.config && !state.usingFallback) {
      return 'Configuration loaded successfully'
    }
    
    if (state.config && state.usingFallback && state.fallbackResult) {
      return state.fallbackResult.userMessage
    }
    
    if (state.error) {
      return 'Configuration failed to load'
    }
    
    return 'Configuration status unknown'
  }, [state, opts.maxRetries])

  /**
   * Gets configuration limitations explanation
   */
  const getLimitationsExplanation = useCallback(() => {
    if (!state.usingFallback || !state.fallbackResult?.config) {
      return null
    }
    
    return explainConfigurationLimitations(state.fallbackResult.config as FallbackConfig)
  }, [state.usingFallback, state.fallbackResult])

  // Initialize configuration loading
  useEffect(() => {
    loadConfiguration()
  }, []) // Only run once on mount

  // Subscribe to runtime config changes
  useEffect(() => {
    const unsubscribe = subscribeToConfigChanges((config, error) => {
      if (config && !state.usingFallback) {
        // Runtime config updated successfully
        updateState({
          config,
          error: null,
          usingFallback: false,
          fallbackResult: null,
        })
        
        // Cache the new configuration
        cacheConfigIfEnabled(config)
      } else if (error && !state.usingFallback) {
        // Runtime config error occurred
        updateState({ error })
      }
    })

    return unsubscribe
  }, [state.usingFallback, updateState, cacheConfigIfEnabled])

  // Auto-retry logic
  useEffect(() => {
    if (
      opts.autoRetry &&
      state.error &&
      !state.isRetrying &&
      !state.usingFallback &&
      state.retryAttempts < opts.maxRetries
    ) {
      console.log('[Configuration Manager] Auto-retry triggered')
      
      const retryTimeout = setTimeout(() => {
        retryConfiguration()
      }, opts.retryDelay)
      
      return () => clearTimeout(retryTimeout)
    }
  }, [
    opts.autoRetry,
    opts.retryDelay,
    opts.maxRetries,
    state.error,
    state.isRetrying,
    state.usingFallback,
    state.retryAttempts,
    retryConfiguration,
  ])

  return {
    // State
    ...state,
    
    // Computed values
    statusMessage: getStatusMessage(),
    limitationsExplanation: getLimitationsExplanation(),
    canRetry: !state.isRetrying && state.retryAttempts < opts.maxRetries,
    hasReachedMaxRetries: state.retryAttempts >= opts.maxRetries,
    
    // Actions
    retry: retryConfiguration,
    refresh: refreshConfiguration,
    acceptFallback,
    
    // Configuration access
    getConfig: () => state.config,
    isConfigured: () => !!state.config,
    isHealthy: () => state.healthResult?.healthy ?? false,
  }
}

/**
 * Configuration manager service (singleton)
 */
class ConfigurationManagerService {
  private static instance: ConfigurationManagerService | null = null
  
  public static getInstance(): ConfigurationManagerService {
    if (!ConfigurationManagerService.instance) {
      ConfigurationManagerService.instance = new ConfigurationManagerService()
    }
    return ConfigurationManagerService.instance
  }
  
  /**
   * Gets current configuration status
   */
  public async getConfigurationStatus(): Promise<{
    hasRuntimeConfig: boolean
    hasFallbackConfig: boolean
    isHealthy: boolean
    errors: string[]
    warnings: string[]
  }> {
    const runtimeConfig = getRuntimeConfig()
    const store = getRuntimeConfigStore()
    
    let healthResult: ConfigHealthResult | null = null
    try {
      healthResult = await performConfigHealthCheck()
    } catch (error) {
      console.error('[Configuration Manager Service] Health check failed:', error)
    }
    
    return {
      hasRuntimeConfig: !!runtimeConfig,
      hasFallbackConfig: !!store.error,
      isHealthy: healthResult?.healthy ?? false,
      errors: healthResult?.errors ?? [],
      warnings: healthResult?.warnings ?? [],
    }
  }
  
  /**
   * Forces configuration refresh
   */
  public async forceRefresh(): Promise<void> {
    try {
      await refreshRuntimeConfig()
    } catch (error) {
      console.error('[Configuration Manager Service] Force refresh failed:', error)
      throw error
    }
  }
}

export const configurationManager = ConfigurationManagerService.getInstance()