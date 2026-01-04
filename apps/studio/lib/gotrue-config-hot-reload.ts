/**
 * GoTrue Configuration Hot Reload Module
 * 
 * Implements configuration hot reload support including:
 * - Configuration change detection (Requirements 4.5)
 * - Graceful configuration reloading (Requirements 4.5)
 * - Configuration change logging (Requirements 4.5)
 * 
 * This module allows GoTrue configuration to be updated without requiring
 * a full application restart, enabling dynamic configuration updates in
 * production environments.
 */

import { EventEmitter } from 'events'
import { validateGoTrueConfiguration, type GoTrueConfigValidationResult } from './gotrue-config-validation'
import { getRuntimeConfig, subscribeToConfigChanges, refreshRuntimeConfig, type RuntimeConfig } from 'common/runtime-config'
import { updateGoTrueClientUrl, getCurrentGoTrueConfig } from 'common/gotrue'
import { logConfigurationRecovery, logConfigurationError } from 'common/configuration-logging'

/**
 * Configuration change event types
 */
export type ConfigChangeEventType = 
  | 'config_changed'
  | 'config_validated'
  | 'config_applied'
  | 'config_error'
  | 'reload_started'
  | 'reload_completed'
  | 'reload_failed'

/**
 * Configuration change event data
 */
export interface ConfigChangeEvent {
  /** Event type */
  type: ConfigChangeEventType
  /** Timestamp of the event */
  timestamp: number
  /** Previous configuration (if applicable) */
  previousConfig?: RuntimeConfig
  /** New configuration (if applicable) */
  newConfig?: RuntimeConfig
  /** Validation result (if applicable) */
  validationResult?: GoTrueConfigValidationResult
  /** Error information (if applicable) */
  error?: {
    message: string
    code?: string
    details?: any
  }
  /** Additional metadata */
  metadata?: Record<string, any>
}

/**
 * Hot reload configuration options
 */
export interface HotReloadOptions {
  /** Whether hot reload is enabled */
  enabled: boolean
  /** Minimum interval between reload attempts (ms) */
  debounceInterval: number
  /** Maximum number of consecutive reload failures before disabling */
  maxFailures: number
  /** Whether to validate configuration before applying */
  validateBeforeApply: boolean
  /** Whether to log all configuration changes */
  logChanges: boolean
  /** Custom validation function */
  customValidator?: (config: RuntimeConfig) => Promise<boolean>
}

/**
 * Default hot reload options
 */
const DEFAULT_HOT_RELOAD_OPTIONS: HotReloadOptions = {
  enabled: true,
  debounceInterval: 1000, // 1 second
  maxFailures: 5,
  validateBeforeApply: true,
  logChanges: true,
}

/**
 * Configuration hot reload manager
 */
export class GoTrueConfigHotReloadManager extends EventEmitter {
  private options: HotReloadOptions
  private isEnabled: boolean = false
  private currentConfig: RuntimeConfig | null = null
  private reloadInProgress: boolean = false
  private consecutiveFailures: number = 0
  private lastReloadTime: number = 0
  private debounceTimer: NodeJS.Timeout | null = null
  private configSubscription: (() => void) | null = null

  constructor(options: Partial<HotReloadOptions> = {}) {
    super()
    this.options = { ...DEFAULT_HOT_RELOAD_OPTIONS, ...options }
    
    console.log('[GoTrue Hot Reload] Manager initialized with options:', {
      enabled: this.options.enabled,
      debounceInterval: this.options.debounceInterval,
      maxFailures: this.options.maxFailures,
      validateBeforeApply: this.options.validateBeforeApply,
    })
  }

  /**
   * Starts the hot reload manager
   * 
   * This sets up configuration change monitoring and enables automatic
   * reloading when configuration changes are detected.
   */
  public start(): void {
    if (this.isEnabled) {
      console.warn('[GoTrue Hot Reload] Manager is already started')
      return
    }

    if (!this.options.enabled) {
      console.log('[GoTrue Hot Reload] Hot reload is disabled by configuration')
      return
    }

    console.log('[GoTrue Hot Reload] Starting configuration hot reload manager...')

    try {
      // Get initial configuration
      this.currentConfig = getRuntimeConfig()
      
      // Subscribe to configuration changes
      this.configSubscription = subscribeToConfigChanges((newConfig, error) => {
        if (error) {
          this.handleConfigError(error)
        } else if (newConfig) {
          this.handleConfigChange(newConfig)
        }
      })

      this.isEnabled = true
      this.consecutiveFailures = 0

      console.log('[GoTrue Hot Reload] ✓ Hot reload manager started successfully')
      
      this.emitEvent({
        type: 'reload_started',
        timestamp: Date.now(),
        metadata: {
          initialConfig: !!this.currentConfig,
          options: this.options,
        },
      })

    } catch (error) {
      console.error('[GoTrue Hot Reload] Failed to start hot reload manager:', error)
      
      this.emitEvent({
        type: 'reload_failed',
        timestamp: Date.now(),
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error,
        },
      })
    }
  }

  /**
   * Stops the hot reload manager
   */
  public stop(): void {
    if (!this.isEnabled) {
      console.warn('[GoTrue Hot Reload] Manager is not running')
      return
    }

    console.log('[GoTrue Hot Reload] Stopping configuration hot reload manager...')

    try {
      // Clear debounce timer
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer)
        this.debounceTimer = null
      }

      // Unsubscribe from configuration changes
      if (this.configSubscription) {
        this.configSubscription()
        this.configSubscription = null
      }

      this.isEnabled = false
      this.reloadInProgress = false

      console.log('[GoTrue Hot Reload] ✓ Hot reload manager stopped')

    } catch (error) {
      console.error('[GoTrue Hot Reload] Error stopping hot reload manager:', error)
    }
  }

  /**
   * Forces a configuration reload
   * 
   * @param skipValidation - Whether to skip validation (use with caution)
   * @returns Promise that resolves when reload is complete
   */
  public async forceReload(skipValidation: boolean = false): Promise<void> {
    console.log('[GoTrue Hot Reload] Force reload requested...')

    if (this.reloadInProgress) {
      console.warn('[GoTrue Hot Reload] Reload already in progress, skipping force reload')
      return
    }

    try {
      // Refresh runtime configuration
      await refreshRuntimeConfig()
      
      // Get the updated configuration
      const newConfig = getRuntimeConfig()
      
      if (newConfig) {
        await this.applyConfigurationChange(newConfig, skipValidation)
      } else {
        throw new Error('No configuration available after refresh')
      }

    } catch (error) {
      console.error('[GoTrue Hot Reload] Force reload failed:', error)
      
      this.emitEvent({
        type: 'reload_failed',
        timestamp: Date.now(),
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error,
        },
      })
      
      throw error
    }
  }

  /**
   * Gets the current hot reload status
   */
  public getStatus(): {
    enabled: boolean
    reloadInProgress: boolean
    consecutiveFailures: number
    lastReloadTime: number
    currentConfig: RuntimeConfig | null
  } {
    return {
      enabled: this.isEnabled,
      reloadInProgress: this.reloadInProgress,
      consecutiveFailures: this.consecutiveFailures,
      lastReloadTime: this.lastReloadTime,
      currentConfig: this.currentConfig,
    }
  }

  /**
   * Handles configuration change events
   */
  private handleConfigChange(newConfig: RuntimeConfig): void {
    // Check if configuration actually changed
    if (this.currentConfig && this.configsEqual(this.currentConfig, newConfig)) {
      console.log('[GoTrue Hot Reload] Configuration unchanged, skipping reload')
      return
    }

    console.log('[GoTrue Hot Reload] Configuration change detected')
    
    if (this.options.logChanges) {
      this.logConfigurationChange(this.currentConfig, newConfig)
    }

    // Debounce rapid configuration changes
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }

    this.debounceTimer = setTimeout(() => {
      this.applyConfigurationChange(newConfig)
        .catch(error => {
          console.error('[GoTrue Hot Reload] Failed to apply configuration change:', error)
        })
    }, this.options.debounceInterval)
  }

  /**
   * Handles configuration errors
   */
  private handleConfigError(error: any): void {
    console.error('[GoTrue Hot Reload] Configuration error:', error)
    
    this.emitEvent({
      type: 'config_error',
      timestamp: Date.now(),
      error: {
        message: error instanceof Error ? error.message : 'Configuration error',
        details: error,
      },
    })

    this.consecutiveFailures++
    
    if (this.consecutiveFailures >= this.options.maxFailures) {
      console.error(`[GoTrue Hot Reload] Too many consecutive failures (${this.consecutiveFailures}), disabling hot reload`)
      this.stop()
    }
  }

  /**
   * Applies a configuration change
   */
  private async applyConfigurationChange(
    newConfig: RuntimeConfig,
    skipValidation: boolean = false
  ): Promise<void> {
    if (this.reloadInProgress) {
      console.warn('[GoTrue Hot Reload] Reload already in progress, skipping')
      return
    }

    this.reloadInProgress = true
    const previousConfig = this.currentConfig

    try {
      console.log('[GoTrue Hot Reload] Applying configuration change...')
      
      this.emitEvent({
        type: 'config_changed',
        timestamp: Date.now(),
        previousConfig: previousConfig || undefined,
        newConfig,
      })

      // Step 1: Validate new configuration if enabled
      let validationResult: GoTrueConfigValidationResult | undefined
      
      if (this.options.validateBeforeApply && !skipValidation) {
        console.log('[GoTrue Hot Reload] Validating new configuration...')
        
        // Temporarily set environment variables to match new config for validation
        const originalEnvVars = this.backupEnvironmentVariables()
        this.setEnvironmentVariablesFromConfig(newConfig)
        
        try {
          validationResult = validateGoTrueConfiguration()
          
          if (!validationResult.isValid) {
            console.error('[GoTrue Hot Reload] Configuration validation failed:', validationResult.errors)
            
            this.emitEvent({
              type: 'config_error',
              timestamp: Date.now(),
              validationResult,
              error: {
                message: 'Configuration validation failed',
                code: 'VALIDATION_FAILED',
                details: validationResult.errors,
              },
            })
            
            throw new Error(`Configuration validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`)
          }
          
          console.log('[GoTrue Hot Reload] ✓ Configuration validation passed')
          
          this.emitEvent({
            type: 'config_validated',
            timestamp: Date.now(),
            newConfig,
            validationResult,
          })
          
        } finally {
          // Restore original environment variables
          this.restoreEnvironmentVariables(originalEnvVars)
        }
      }

      // Step 2: Apply custom validation if provided
      if (this.options.customValidator) {
        console.log('[GoTrue Hot Reload] Running custom validation...')
        
        const customValidationPassed = await this.options.customValidator(newConfig)
        
        if (!customValidationPassed) {
          throw new Error('Custom validation failed')
        }
        
        console.log('[GoTrue Hot Reload] ✓ Custom validation passed')
      }

      // Step 3: Update GoTrue client configuration
      console.log('[GoTrue Hot Reload] Updating GoTrue client configuration...')
      
      const clientUpdateSuccess = await updateGoTrueClientUrl(true) // Force update
      
      if (!clientUpdateSuccess) {
        console.warn('[GoTrue Hot Reload] GoTrue client URL update returned false, but continuing')
      }

      // Step 4: Update current configuration
      this.currentConfig = newConfig
      this.lastReloadTime = Date.now()
      this.consecutiveFailures = 0 // Reset failure count on success

      console.log('[GoTrue Hot Reload] ✓ Configuration change applied successfully')
      
      // Log successful configuration change
      if (previousConfig) {
        logConfigurationRecovery(
          'GoTrue Hot Reload',
          'hot-reload' as any,
          { type: 'config_change', message: 'Configuration updated via hot reload' } as any,
          {
            gotrueUrl: newConfig.gotrueUrl,
            supabaseUrl: newConfig.supabaseUrl,
            apiUrl: newConfig.apiUrl,
          },
          []
        )
      }

      this.emitEvent({
        type: 'config_applied',
        timestamp: Date.now(),
        previousConfig: previousConfig || undefined,
        newConfig,
        validationResult,
        metadata: {
          clientUpdateSuccess,
          reloadTime: Date.now() - (this.lastReloadTime - 1000), // Approximate reload duration
        },
      })

    } catch (error) {
      console.error('[GoTrue Hot Reload] Failed to apply configuration change:', error)
      
      this.consecutiveFailures++
      
      // Log configuration error
      logConfigurationError('GoTrue Hot Reload', {
        type: 'hot_reload_failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        severity: 'high',
        retryable: true,
        troubleshootingSteps: [
          'Check that the new configuration is valid',
          'Verify that all required environment variables are set',
          'Check network connectivity to new service URLs',
          'Review configuration validation errors if any',
        ],
      }, {
        consecutiveFailures: this.consecutiveFailures,
        maxFailures: this.options.maxFailures,
        previousConfig: previousConfig?.gotrueUrl,
        newConfig: newConfig.gotrueUrl,
      })

      this.emitEvent({
        type: 'reload_failed',
        timestamp: Date.now(),
        previousConfig: previousConfig || undefined,
        newConfig,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error,
        },
      })

      // Disable hot reload if too many failures
      if (this.consecutiveFailures >= this.options.maxFailures) {
        console.error(`[GoTrue Hot Reload] Too many consecutive failures (${this.consecutiveFailures}), disabling hot reload`)
        this.stop()
      }

      throw error

    } finally {
      this.reloadInProgress = false
    }
  }

  /**
   * Checks if two configurations are equal
   */
  private configsEqual(config1: RuntimeConfig, config2: RuntimeConfig): boolean {
    return (
      config1.gotrueUrl === config2.gotrueUrl &&
      config1.supabaseUrl === config2.supabaseUrl &&
      config1.apiUrl === config2.apiUrl &&
      config1.anonKey === config2.anonKey &&
      config1.environment === config2.environment
    )
  }

  /**
   * Logs configuration changes
   */
  private logConfigurationChange(
    previousConfig: RuntimeConfig | null,
    newConfig: RuntimeConfig
  ): void {
    console.log('[GoTrue Hot Reload] Configuration change details:')
    
    if (previousConfig) {
      const changes: string[] = []
      
      if (previousConfig.gotrueUrl !== newConfig.gotrueUrl) {
        changes.push(`GoTrue URL: ${previousConfig.gotrueUrl} → ${newConfig.gotrueUrl}`)
      }
      
      if (previousConfig.supabaseUrl !== newConfig.supabaseUrl) {
        changes.push(`Supabase URL: ${previousConfig.supabaseUrl} → ${newConfig.supabaseUrl}`)
      }
      
      if (previousConfig.apiUrl !== newConfig.apiUrl) {
        changes.push(`API URL: ${previousConfig.apiUrl} → ${newConfig.apiUrl}`)
      }
      
      if (previousConfig.anonKey !== newConfig.anonKey) {
        changes.push(`Anon Key: [CHANGED]`)
      }
      
      if (previousConfig.environment !== newConfig.environment) {
        changes.push(`Environment: ${previousConfig.environment} → ${newConfig.environment}`)
      }
      
      if (changes.length > 0) {
        console.log('[GoTrue Hot Reload] Changes detected:')
        changes.forEach(change => {
          console.log(`  • ${change}`)
        })
      } else {
        console.log('[GoTrue Hot Reload] No significant changes detected')
      }
    } else {
      console.log('[GoTrue Hot Reload] Initial configuration loaded:')
      console.log(`  • GoTrue URL: ${newConfig.gotrueUrl}`)
      console.log(`  • Supabase URL: ${newConfig.supabaseUrl}`)
      console.log(`  • API URL: ${newConfig.apiUrl}`)
      console.log(`  • Environment: ${newConfig.environment}`)
      console.log(`  • Source: ${newConfig.source}`)
    }
  }

  /**
   * Backs up current environment variables
   */
  private backupEnvironmentVariables(): Record<string, string | undefined> {
    return {
      NEXT_PUBLIC_GOTRUE_URL: process.env.NEXT_PUBLIC_GOTRUE_URL,
      SUPABASE_PUBLIC_URL: process.env.SUPABASE_PUBLIC_URL,
      API_EXTERNAL_URL: process.env.API_EXTERNAL_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    }
  }

  /**
   * Sets environment variables from configuration
   */
  private setEnvironmentVariablesFromConfig(config: RuntimeConfig): void {
    process.env.NEXT_PUBLIC_GOTRUE_URL = config.gotrueUrl
    process.env.SUPABASE_PUBLIC_URL = config.supabaseUrl
    process.env.API_EXTERNAL_URL = config.apiUrl
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = config.anonKey
  }

  /**
   * Restores environment variables from backup
   */
  private restoreEnvironmentVariables(backup: Record<string, string | undefined>): void {
    for (const [key, value] of Object.entries(backup)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  }

  /**
   * Emits a configuration change event
   */
  private emitEvent(event: ConfigChangeEvent): void {
    this.emit('configChange', event)
    
    // Also emit specific event types
    this.emit(event.type, event)
  }
}

/**
 * Global hot reload manager instance
 */
let globalHotReloadManager: GoTrueConfigHotReloadManager | null = null

/**
 * Gets or creates the global hot reload manager
 * 
 * @param options - Hot reload options (only used when creating new instance)
 * @returns Global hot reload manager instance
 */
export function getHotReloadManager(options?: Partial<HotReloadOptions>): GoTrueConfigHotReloadManager {
  if (!globalHotReloadManager) {
    globalHotReloadManager = new GoTrueConfigHotReloadManager(options)
  }
  
  return globalHotReloadManager
}

/**
 * Starts configuration hot reload with default options
 * 
 * This is a convenience function for quickly enabling hot reload functionality.
 * 
 * @param options - Optional hot reload configuration
 * @returns Hot reload manager instance
 */
export function startConfigHotReload(options?: Partial<HotReloadOptions>): GoTrueConfigHotReloadManager {
  const manager = getHotReloadManager(options)
  
  if (!manager.getStatus().enabled) {
    manager.start()
  }
  
  return manager
}

/**
 * Stops configuration hot reload
 */
export function stopConfigHotReload(): void {
  if (globalHotReloadManager) {
    globalHotReloadManager.stop()
  }
}

/**
 * Forces a configuration reload
 * 
 * @param skipValidation - Whether to skip validation (use with caution)
 * @returns Promise that resolves when reload is complete
 */
export function forceConfigReload(skipValidation: boolean = false): Promise<void> {
  if (!globalHotReloadManager) {
    throw new Error('Hot reload manager not initialized. Call startConfigHotReload() first.')
  }
  
  return globalHotReloadManager.forceReload(skipValidation)
}

/**
 * Gets the current hot reload status
 * 
 * @returns Hot reload status or null if not initialized
 */
export function getHotReloadStatus(): ReturnType<GoTrueConfigHotReloadManager['getStatus']> | null {
  return globalHotReloadManager?.getStatus() || null
}

/**
 * Subscribes to configuration change events
 * 
 * @param eventType - Event type to listen for (or 'configChange' for all events)
 * @param listener - Event listener function
 * @returns Unsubscribe function
 */
export function subscribeToConfigChangeEvents(
  eventType: ConfigChangeEventType | 'configChange',
  listener: (event: ConfigChangeEvent) => void
): () => void {
  const manager = getHotReloadManager()
  
  manager.on(eventType, listener)
  
  return () => {
    manager.off(eventType, listener)
  }
}

/**
 * React hook for using configuration hot reload
 * 
 * @param options - Hot reload options
 * @returns Hot reload manager and status
 */
export function useConfigHotReload(options?: Partial<HotReloadOptions>) {
  const manager = getHotReloadManager(options)
  
  // Auto-start on first use (in browser environment only)
  if (typeof window !== 'undefined' && !manager.getStatus().enabled) {
    manager.start()
  }
  
  return {
    manager,
    status: manager.getStatus(),
    forceReload: (skipValidation?: boolean) => manager.forceReload(skipValidation),
    start: () => manager.start(),
    stop: () => manager.stop(),
  }
}