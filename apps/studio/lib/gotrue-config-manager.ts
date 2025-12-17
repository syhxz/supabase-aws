/**
 * GoTrue Configuration Manager
 * 
 * Main integration module that coordinates configuration validation and hot reload.
 * This module provides a unified interface for:
 * - Startup configuration validation
 * - Configuration hot reload management
 * - Error recovery and user guidance
 * - Configuration health monitoring
 * 
 * Implements Requirements 4.1, 4.2, and 4.5 by providing comprehensive
 * configuration management with validation, error reporting, and hot reload.
 */

import { EventEmitter } from 'events'
import { 
  validateGoTrueConfiguration, 
  formatValidationResult,
  type GoTrueConfigValidationResult 
} from './gotrue-config-validation'
import { 
  GoTrueConfigHotReloadManager,
  getHotReloadManager,
  type ConfigChangeEvent,
  type HotReloadOptions 
} from './gotrue-config-hot-reload'
import { performConfigHealthCheck, type ConfigHealthResult } from './config-health'
import { logConfigurationError, logConfigurationRecovery } from 'common/configuration-logging'

/**
 * Configuration manager state
 */
export interface ConfigManagerState {
  /** Whether the manager is initialized */
  initialized: boolean
  /** Current validation result */
  validationResult: GoTrueConfigValidationResult | null
  /** Current health check result */
  healthResult: ConfigHealthResult | null
  /** Whether hot reload is enabled and running */
  hotReloadEnabled: boolean
  /** Last configuration change event */
  lastConfigChange: ConfigChangeEvent | null
  /** Number of configuration errors since startup */
  errorCount: number
  /** Number of successful configuration reloads */
  reloadCount: number
  /** Manager startup timestamp */
  startupTime: number
}

/**
 * Configuration manager options
 */
export interface ConfigManagerOptions {
  /** Whether to perform validation on startup */
  validateOnStartup: boolean
  /** Whether to enable hot reload */
  enableHotReload: boolean
  /** Whether to perform health checks */
  enableHealthChecks: boolean
  /** Hot reload specific options */
  hotReloadOptions: Partial<HotReloadOptions>
  /** Whether to auto-recover from configuration errors */
  autoRecover: boolean
  /** Interval for periodic health checks (ms, 0 to disable) */
  healthCheckInterval: number
}

/**
 * Default configuration manager options
 */
const DEFAULT_CONFIG_MANAGER_OPTIONS: ConfigManagerOptions = {
  validateOnStartup: true,
  enableHotReload: true,
  enableHealthChecks: true,
  hotReloadOptions: {
    enabled: true,
    debounceInterval: 1000,
    maxFailures: 5,
    validateBeforeApply: true,
    logChanges: true,
  },
  autoRecover: true,
  healthCheckInterval: 30000, // 30 seconds
}

/**
 * GoTrue Configuration Manager
 * 
 * This class provides comprehensive configuration management including:
 * - Startup validation (Requirements 4.1, 4.2)
 * - Hot reload support (Requirements 4.5)
 * - Health monitoring
 * - Error recovery
 */
export class GoTrueConfigManager extends EventEmitter {
  private options: ConfigManagerOptions
  private state: ConfigManagerState
  private hotReloadManager: GoTrueConfigHotReloadManager | null = null
  private healthCheckTimer: NodeJS.Timeout | null = null

  constructor(options: Partial<ConfigManagerOptions> = {}) {
    super()
    
    this.options = { ...DEFAULT_CONFIG_MANAGER_OPTIONS, ...options }
    this.state = {
      initialized: false,
      validationResult: null,
      healthResult: null,
      hotReloadEnabled: false,
      lastConfigChange: null,
      errorCount: 0,
      reloadCount: 0,
      startupTime: Date.now(),
    }

    console.log('[GoTrue Config Manager] Manager created with options:', {
      validateOnStartup: this.options.validateOnStartup,
      enableHotReload: this.options.enableHotReload,
      enableHealthChecks: this.options.enableHealthChecks,
      autoRecover: this.options.autoRecover,
    })
  }

  /**
   * Initializes the configuration manager
   * 
   * This performs startup validation and sets up hot reload if enabled.
   * Implements Requirements 4.1 and 4.2 for startup validation.
   * 
   * @returns Promise that resolves when initialization is complete
   */
  public async initialize(): Promise<void> {
    if (this.state.initialized) {
      console.warn('[GoTrue Config Manager] Manager is already initialized')
      return
    }

    console.log('[GoTrue Config Manager] Initializing configuration manager...')

    try {
      // Step 1: Perform startup validation if enabled
      if (this.options.validateOnStartup) {
        console.log('[GoTrue Config Manager] Performing startup configuration validation...')
        
        const validationResult = validateGoTrueConfiguration()
        this.state.validationResult = validationResult

        if (!validationResult.isValid) {
          console.error('[GoTrue Config Manager] Startup validation failed:')
          console.error(formatValidationResult(validationResult))
          
          this.state.errorCount++
          this.emit('validationFailed', validationResult)

          // Log validation errors
          validationResult.errors.forEach(error => {
            logConfigurationError('GoTrue Config Manager', {
              type: error.type,
              message: error.message,
              severity: error.severity,
              retryable: false,
              troubleshootingSteps: error.remediationSteps,
            }, {
              configKey: error.key,
              startupValidation: true,
            })
          })

          if (!this.options.autoRecover) {
            throw new Error(`Configuration validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`)
          }
        } else {
          console.log('[GoTrue Config Manager] ✓ Startup validation passed')
          this.emit('validationPassed', validationResult)
        }
      }

      // Step 2: Perform initial health check if enabled
      if (this.options.enableHealthChecks) {
        console.log('[GoTrue Config Manager] Performing initial health check...')
        
        try {
          const healthResult = await performConfigHealthCheck()
          this.state.healthResult = healthResult

          if (!healthResult.healthy) {
            console.warn('[GoTrue Config Manager] Initial health check failed:', healthResult.errors)
            this.emit('healthCheckFailed', healthResult)
          } else {
            console.log('[GoTrue Config Manager] ✓ Initial health check passed')
            this.emit('healthCheckPassed', healthResult)
          }
        } catch (error) {
          console.error('[GoTrue Config Manager] Initial health check error:', error)
          this.emit('healthCheckError', error)
        }
      }

      // Step 3: Set up hot reload if enabled
      if (this.options.enableHotReload) {
        console.log('[GoTrue Config Manager] Setting up configuration hot reload...')
        
        this.hotReloadManager = getHotReloadManager(this.options.hotReloadOptions)
        
        // Subscribe to hot reload events
        this.hotReloadManager.on('configChange', (event: ConfigChangeEvent) => {
          this.handleConfigChangeEvent(event)
        })

        this.hotReloadManager.on('config_applied', (event: ConfigChangeEvent) => {
          this.state.reloadCount++
          this.emit('configReloaded', event)
        })

        this.hotReloadManager.on('reload_failed', (event: ConfigChangeEvent) => {
          this.state.errorCount++
          this.emit('reloadFailed', event)
        })

        // Start hot reload
        this.hotReloadManager.start()
        this.state.hotReloadEnabled = this.hotReloadManager.getStatus().enabled

        console.log('[GoTrue Config Manager] ✓ Hot reload configured and started')
      }

      // Step 4: Set up periodic health checks if enabled
      if (this.options.enableHealthChecks && this.options.healthCheckInterval > 0) {
        console.log(`[GoTrue Config Manager] Setting up periodic health checks (${this.options.healthCheckInterval}ms)`)
        
        this.healthCheckTimer = setInterval(() => {
          this.performPeriodicHealthCheck()
        }, this.options.healthCheckInterval)
      }

      this.state.initialized = true
      
      console.log('[GoTrue Config Manager] ✓ Configuration manager initialized successfully')
      this.emit('initialized', this.state)

    } catch (error) {
      console.error('[GoTrue Config Manager] Initialization failed:', error)
      
      this.state.errorCount++
      this.emit('initializationFailed', error)
      
      throw error
    }
  }

  /**
   * Shuts down the configuration manager
   */
  public shutdown(): void {
    console.log('[GoTrue Config Manager] Shutting down configuration manager...')

    try {
      // Stop periodic health checks
      if (this.healthCheckTimer) {
        clearInterval(this.healthCheckTimer)
        this.healthCheckTimer = null
      }

      // Stop hot reload
      if (this.hotReloadManager) {
        this.hotReloadManager.stop()
        this.state.hotReloadEnabled = false
      }

      this.state.initialized = false
      
      console.log('[GoTrue Config Manager] ✓ Configuration manager shut down')
      this.emit('shutdown')

    } catch (error) {
      console.error('[GoTrue Config Manager] Error during shutdown:', error)
    }
  }

  /**
   * Forces configuration validation
   * 
   * @returns Promise resolving to validation result
   */
  public async validateConfiguration(): Promise<GoTrueConfigValidationResult> {
    console.log('[GoTrue Config Manager] Performing manual configuration validation...')

    try {
      const validationResult = validateGoTrueConfiguration()
      this.state.validationResult = validationResult

      if (validationResult.isValid) {
        console.log('[GoTrue Config Manager] ✓ Manual validation passed')
        this.emit('validationPassed', validationResult)
      } else {
        console.error('[GoTrue Config Manager] Manual validation failed')
        this.state.errorCount++
        this.emit('validationFailed', validationResult)
      }

      return validationResult

    } catch (error) {
      console.error('[GoTrue Config Manager] Manual validation error:', error)
      
      const errorResult: GoTrueConfigValidationResult = {
        isValid: false,
        errors: [{
          type: 'connectivity',
          message: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          key: 'validation',
          severity: 'critical',
          remediationSteps: ['Check configuration and try again'],
        }],
        warnings: [],
        validatedConfig: {},
        environment: 'production',
        timestamp: Date.now(),
      }

      this.state.validationResult = errorResult
      this.state.errorCount++
      this.emit('validationFailed', errorResult)

      return errorResult
    }
  }

  /**
   * Forces configuration reload
   * 
   * @param skipValidation - Whether to skip validation
   * @returns Promise that resolves when reload is complete
   */
  public async reloadConfiguration(skipValidation: boolean = false): Promise<void> {
    if (!this.hotReloadManager) {
      throw new Error('Hot reload is not enabled')
    }

    console.log('[GoTrue Config Manager] Forcing configuration reload...')

    try {
      await this.hotReloadManager.forceReload(skipValidation)
      console.log('[GoTrue Config Manager] ✓ Configuration reload completed')
      
    } catch (error) {
      console.error('[GoTrue Config Manager] Configuration reload failed:', error)
      this.state.errorCount++
      throw error
    }
  }

  /**
   * Performs health check
   * 
   * @returns Promise resolving to health check result
   */
  public async performHealthCheck(): Promise<ConfigHealthResult> {
    console.log('[GoTrue Config Manager] Performing manual health check...')

    try {
      const healthResult = await performConfigHealthCheck()
      this.state.healthResult = healthResult

      if (healthResult.healthy) {
        console.log('[GoTrue Config Manager] ✓ Manual health check passed')
        this.emit('healthCheckPassed', healthResult)
      } else {
        console.warn('[GoTrue Config Manager] Manual health check failed:', healthResult.errors)
        this.emit('healthCheckFailed', healthResult)
      }

      return healthResult

    } catch (error) {
      console.error('[GoTrue Config Manager] Manual health check error:', error)
      this.emit('healthCheckError', error)
      throw error
    }
  }

  /**
   * Gets current manager state
   */
  public getState(): ConfigManagerState {
    return { ...this.state }
  }

  /**
   * Gets configuration status summary
   */
  public getStatusSummary(): {
    overall: 'healthy' | 'warning' | 'error'
    validation: 'passed' | 'failed' | 'not_run'
    health: 'healthy' | 'unhealthy' | 'not_checked'
    hotReload: 'enabled' | 'disabled' | 'error'
    details: {
      errorCount: number
      reloadCount: number
      uptime: number
      lastValidation?: number
      lastHealthCheck?: number
    }
  } {
    const now = Date.now()
    
    // Determine overall status
    let overall: 'healthy' | 'warning' | 'error' = 'healthy'
    
    if (this.state.validationResult && !this.state.validationResult.isValid) {
      overall = 'error'
    } else if (this.state.healthResult && !this.state.healthResult.healthy) {
      overall = 'warning'
    } else if (this.state.errorCount > 0) {
      overall = 'warning'
    }

    // Determine validation status
    let validation: 'passed' | 'failed' | 'not_run' = 'not_run'
    if (this.state.validationResult) {
      validation = this.state.validationResult.isValid ? 'passed' : 'failed'
    }

    // Determine health status
    let health: 'healthy' | 'unhealthy' | 'not_checked' = 'not_checked'
    if (this.state.healthResult) {
      health = this.state.healthResult.healthy ? 'healthy' : 'unhealthy'
    }

    // Determine hot reload status
    let hotReload: 'enabled' | 'disabled' | 'error' = 'disabled'
    if (this.options.enableHotReload) {
      if (this.state.hotReloadEnabled) {
        hotReload = 'enabled'
      } else if (this.state.errorCount > 0) {
        hotReload = 'error'
      }
    }

    return {
      overall,
      validation,
      health,
      hotReload,
      details: {
        errorCount: this.state.errorCount,
        reloadCount: this.state.reloadCount,
        uptime: now - this.state.startupTime,
        lastValidation: this.state.validationResult?.timestamp,
        lastHealthCheck: this.state.healthResult?.timestamp,
      },
    }
  }

  /**
   * Handles configuration change events from hot reload
   */
  private handleConfigChangeEvent(event: ConfigChangeEvent): void {
    this.state.lastConfigChange = event
    
    // Re-validate configuration after changes if validation is enabled
    if (this.options.validateOnStartup && event.type === 'config_applied') {
      setTimeout(() => {
        this.validateConfiguration().catch(error => {
          console.error('[GoTrue Config Manager] Post-reload validation failed:', error)
        })
      }, 1000) // Small delay to allow configuration to settle
    }

    // Re-run health check after configuration changes
    if (this.options.enableHealthChecks && event.type === 'config_applied') {
      setTimeout(() => {
        this.performHealthCheck().catch(error => {
          console.error('[GoTrue Config Manager] Post-reload health check failed:', error)
        })
      }, 2000) // Delay to allow services to update
    }

    this.emit('configChange', event)
  }

  /**
   * Performs periodic health check
   */
  private async performPeriodicHealthCheck(): Promise<void> {
    try {
      const healthResult = await performConfigHealthCheck()
      const previousHealth = this.state.healthResult?.healthy
      
      this.state.healthResult = healthResult

      // Emit events for health status changes
      if (healthResult.healthy && previousHealth === false) {
        console.log('[GoTrue Config Manager] Health recovered')
        this.emit('healthRecovered', healthResult)
      } else if (!healthResult.healthy && previousHealth === true) {
        console.warn('[GoTrue Config Manager] Health degraded')
        this.emit('healthDegraded', healthResult)
      }

    } catch (error) {
      console.error('[GoTrue Config Manager] Periodic health check error:', error)
    }
  }
}

/**
 * Global configuration manager instance
 */
let globalConfigManager: GoTrueConfigManager | null = null

/**
 * Gets or creates the global configuration manager
 * 
 * @param options - Configuration manager options (only used when creating new instance)
 * @returns Global configuration manager instance
 */
export function getConfigManager(options?: Partial<ConfigManagerOptions>): GoTrueConfigManager {
  if (!globalConfigManager) {
    globalConfigManager = new GoTrueConfigManager(options)
  }
  
  return globalConfigManager
}

/**
 * Initializes GoTrue configuration management with default options
 * 
 * This is the main entry point for setting up comprehensive GoTrue configuration
 * management including validation, hot reload, and health monitoring.
 * 
 * @param options - Optional configuration manager options
 * @returns Promise resolving to initialized configuration manager
 */
export async function initializeGoTrueConfigManagement(
  options?: Partial<ConfigManagerOptions>
): Promise<GoTrueConfigManager> {
  const manager = getConfigManager(options)
  
  if (!manager.getState().initialized) {
    await manager.initialize()
  }
  
  return manager
}

/**
 * Shuts down GoTrue configuration management
 */
export function shutdownGoTrueConfigManagement(): void {
  if (globalConfigManager) {
    globalConfigManager.shutdown()
    globalConfigManager = null
  }
}

/**
 * React hook for using GoTrue configuration management
 * 
 * @param options - Configuration manager options
 * @returns Configuration manager and status
 */
export function useGoTrueConfigManager(options?: Partial<ConfigManagerOptions>) {
  const manager = getConfigManager(options)
  
  // Auto-initialize on first use (in browser environment only)
  if (typeof window !== 'undefined' && !manager.getState().initialized) {
    manager.initialize().catch(error => {
      console.error('[GoTrue Config Manager Hook] Auto-initialization failed:', error)
    })
  }
  
  return {
    manager,
    state: manager.getState(),
    status: manager.getStatusSummary(),
    validate: () => manager.validateConfiguration(),
    reload: (skipValidation?: boolean) => manager.reloadConfiguration(skipValidation),
    healthCheck: () => manager.performHealthCheck(),
  }
}