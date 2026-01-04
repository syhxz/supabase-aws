/**
 * GoTrue Health Check Recovery Detection and Logging
 * 
 * Provides health check state tracking, recovery event detection,
 * and recovery logging and notifications for GoTrue service.
 */

import { GoTrueHealthResult } from './gotrue-health'
import { 
  logFailedRequest, 
  logSuccessfulRequest, 
  type RequestLogInfo 
} from 'common/configuration-logging'

export interface HealthState {
  /** Current health status */
  status: 'healthy' | 'unhealthy' | 'unknown' | 'recovering'
  /** Timestamp of last status change */
  lastStatusChange: number
  /** Number of consecutive failures */
  consecutiveFailures: number
  /** Number of consecutive successes */
  consecutiveSuccesses: number
  /** Total downtime in milliseconds */
  totalDowntime: number
  /** Timestamp when current downtime started */
  downtimeStart?: number
  /** Last known error */
  lastError?: string
  /** Recovery attempts made */
  recoveryAttempts: number
}

export interface RecoveryEvent {
  /** Timestamp of recovery */
  timestamp: number
  /** Duration of downtime in milliseconds */
  downtimeDuration: number
  /** Number of failures before recovery */
  failureCount: number
  /** Number of recovery attempts made */
  recoveryAttempts: number
  /** Last error before recovery */
  lastError?: string
  /** Recovery trigger (manual, automatic, etc.) */
  trigger: 'automatic' | 'manual' | 'configuration_change'
  /** Additional context about the recovery */
  context?: Record<string, any>
}

export interface RecoveryNotification {
  /** Type of notification */
  type: 'recovery_detected' | 'prolonged_downtime' | 'frequent_failures' | 'performance_degradation'
  /** Severity level */
  severity: 'info' | 'warning' | 'error' | 'critical'
  /** Notification message */
  message: string
  /** Timestamp of notification */
  timestamp: number
  /** Additional data */
  data?: Record<string, any>
}

export interface RecoveryConfig {
  /** Number of consecutive successes required to consider service recovered */
  recoveryThreshold: number
  /** Number of consecutive failures to consider service down */
  failureThreshold: number
  /** Maximum downtime before escalating (milliseconds) */
  maxDowntimeMs: number
  /** Minimum time between recovery notifications (milliseconds) */
  notificationCooldownMs: number
  /** Enable automatic recovery notifications */
  enableNotifications: boolean
}

class RecoveryDetector {
  private healthState: HealthState
  private recoveryHistory: RecoveryEvent[]
  private config: RecoveryConfig
  private lastNotificationTime: number = 0
  private notificationCallbacks: Array<(notification: RecoveryNotification) => void> = []

  constructor(config?: Partial<RecoveryConfig>) {
    this.config = {
      recoveryThreshold: 3,
      failureThreshold: 3,
      maxDowntimeMs: 300000, // 5 minutes
      notificationCooldownMs: 60000, // 1 minute
      enableNotifications: true,
      ...config,
    }

    this.healthState = {
      status: 'unknown',
      lastStatusChange: Date.now(),
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      totalDowntime: 0,
      recoveryAttempts: 0,
    }

    this.recoveryHistory = []
  }

  /**
   * Processes a health check result and updates state tracking
   */
  processHealthCheckResult(result: GoTrueHealthResult): void {
    const now = Date.now()
    const wasHealthy = this.healthState.status === 'healthy'
    const wasUnhealthy = this.healthState.status === 'unhealthy'

    if (result.available) {
      // Health check succeeded
      this.healthState.consecutiveSuccesses++
      
      // Store failure count before resetting for recovery tracking
      const failureCountBeforeReset = this.healthState.consecutiveFailures
      
      // Check if this is a recovery
      if (wasUnhealthy && this.healthState.consecutiveSuccesses >= this.config.recoveryThreshold) {
        // Use the stored failure count from when service became unhealthy
        this.handleRecovery(now, result, this.healthState.recoveryAttempts)
      } else if (this.healthState.status !== 'healthy' && this.healthState.consecutiveSuccesses >= this.config.recoveryThreshold) {
        // Service is now considered healthy
        this.updateHealthStatus('healthy', now)
      }
      
      // Reset failure count after recovery handling
      this.healthState.consecutiveFailures = 0
    } else {
      // Health check failed
      this.healthState.consecutiveFailures++
      this.healthState.consecutiveSuccesses = 0
      this.healthState.lastError = result.error

      // Track recovery attempts if specified in result
      if (result.retryAttempts && result.retryAttempts > 0) {
        this.healthState.recoveryAttempts += result.retryAttempts
      }

      // Check if service should be considered down
      if (!wasUnhealthy && this.healthState.consecutiveFailures >= this.config.failureThreshold) {
        this.updateHealthStatus('unhealthy', now)
        this.healthState.downtimeStart = now
        // Store the failure count when service becomes unhealthy for later recovery tracking
        this.healthState.recoveryAttempts = this.healthState.consecutiveFailures
      }
    }

    // Update total downtime if currently unhealthy
    if (this.healthState.status === 'unhealthy' && this.healthState.downtimeStart) {
      this.healthState.totalDowntime = now - this.healthState.downtimeStart
      
      // Check for prolonged downtime
      if (this.healthState.totalDowntime > this.config.maxDowntimeMs) {
        this.sendNotification({
          type: 'prolonged_downtime',
          severity: 'critical',
          message: `GoTrue service has been down for ${Math.round(this.healthState.totalDowntime / 1000)} seconds`,
          timestamp: now,
          data: {
            downtimeDuration: this.healthState.totalDowntime,
            consecutiveFailures: this.healthState.consecutiveFailures,
            lastError: this.healthState.lastError,
          },
        })
      }
    }

    // Log state changes
    this.logHealthStateChange(result, now)
  }

  /**
   * Gets current health state
   */
  getHealthState(): HealthState {
    return { ...this.healthState }
  }

  /**
   * Gets recovery history
   */
  getRecoveryHistory(): RecoveryEvent[] {
    return [...this.recoveryHistory]
  }

  /**
   * Gets recent recovery events within specified time window
   */
  getRecentRecoveries(windowMs: number = 3600000): RecoveryEvent[] {
    const cutoff = Date.now() - windowMs
    return this.recoveryHistory.filter(event => event.timestamp > cutoff)
  }

  /**
   * Adds a callback for recovery notifications
   */
  onNotification(callback: (notification: RecoveryNotification) => void): void {
    this.notificationCallbacks.push(callback)
  }

  /**
   * Removes a notification callback
   */
  removeNotificationCallback(callback: (notification: RecoveryNotification) => void): void {
    const index = this.notificationCallbacks.indexOf(callback)
    if (index > -1) {
      this.notificationCallbacks.splice(index, 1)
    }
  }

  /**
   * Manually triggers a recovery check (useful for configuration changes)
   */
  triggerRecoveryCheck(trigger: 'manual' | 'configuration_change' = 'manual'): void {
    const now = Date.now()
    
    if (this.healthState.status === 'unhealthy') {
      // Mark as recovering and reset counters
      this.updateHealthStatus('recovering', now)
      this.healthState.consecutiveFailures = 0
      this.healthState.consecutiveSuccesses = 0
      
      this.sendNotification({
        type: 'recovery_detected',
        severity: 'info',
        message: `Manual recovery check triggered for GoTrue service`,
        timestamp: now,
        data: {
          trigger,
          previousDowntime: this.healthState.totalDowntime,
        },
      })
    }
  }

  /**
   * Resets all state and history
   */
  reset(): void {
    this.healthState = {
      status: 'unknown',
      lastStatusChange: Date.now(),
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      totalDowntime: 0,
      recoveryAttempts: 0,
    }
    this.recoveryHistory = []
    this.lastNotificationTime = 0
  }

  private handleRecovery(now: number, result: GoTrueHealthResult, failureCount?: number): void {
    const downtimeDuration = this.healthState.downtimeStart 
      ? now - this.healthState.downtimeStart 
      : this.healthState.totalDowntime

    // Create recovery event
    const actualFailureCount = failureCount !== undefined ? failureCount : this.healthState.consecutiveFailures
    const recoveryEvent: RecoveryEvent = {
      timestamp: now,
      downtimeDuration,
      failureCount: actualFailureCount,
      recoveryAttempts: this.healthState.recoveryAttempts,
      lastError: this.healthState.lastError,
      trigger: 'automatic',
      context: {
        responseTime: result.responseTime,
        retryAttempts: result.retryAttempts,
        circuitBreakerTripped: result.circuitBreakerTripped,
      },
    }

    // Add to history
    this.recoveryHistory.push(recoveryEvent)

    // Update state
    this.updateHealthStatus('healthy', now)
    this.healthState.downtimeStart = undefined
    this.healthState.recoveryAttempts = 0

    // Log recovery
    console.log(`[Recovery Detector] GoTrue service recovered after ${Math.round(downtimeDuration / 1000)} seconds`)
    
    const requestInfo: RequestLogInfo = {
      url: result.url || 'unknown',
      method: 'GET',
      status: 200,
      responseTime: result.responseTime || 0,
      success: true,
      context: {
        recovery: true,
        downtimeDuration,
        failureCount: recoveryEvent.failureCount,
        recoveryAttempts: recoveryEvent.recoveryAttempts,
      },
    }

    logSuccessfulRequest('GoTrue Service Recovery', requestInfo)

    // Send recovery notification
    this.sendNotification({
      type: 'recovery_detected',
      severity: 'info',
      message: `GoTrue service recovered after ${Math.round(downtimeDuration / 1000)} seconds of downtime`,
      timestamp: now,
      data: recoveryEvent,
    })
  }

  private updateHealthStatus(newStatus: HealthState['status'], timestamp: number): void {
    if (this.healthState.status !== newStatus) {
      console.log(`[Recovery Detector] Health status changed: ${this.healthState.status} -> ${newStatus}`)
      this.healthState.status = newStatus
      this.healthState.lastStatusChange = timestamp
    }
  }

  private logHealthStateChange(result: GoTrueHealthResult, timestamp: number): void {
    const context = {
      healthStatus: this.healthState.status,
      consecutiveFailures: this.healthState.consecutiveFailures,
      consecutiveSuccesses: this.healthState.consecutiveSuccesses,
      totalDowntime: this.healthState.totalDowntime,
      recoveryAttempts: this.healthState.recoveryAttempts,
    }

    if (result.available) {
      // Don't log every successful health check, only significant ones
      if (this.healthState.consecutiveSuccesses === 1 || this.healthState.consecutiveSuccesses === this.config.recoveryThreshold) {
        const requestInfo: RequestLogInfo = {
          url: result.url || 'unknown',
          method: 'GET',
          status: 200,
          responseTime: result.responseTime || 0,
          success: true,
          context,
        }
        logSuccessfulRequest('GoTrue Health State Update', requestInfo)
      }
    } else {
      // Log all failures with state context
      const requestInfo: RequestLogInfo = {
        url: result.url || 'unknown',
        method: 'GET',
        responseTime: result.responseTime || 0,
        success: false,
        error: result.error,
        context,
      }

      const troubleshootingSteps = [
        `Consecutive failures: ${this.healthState.consecutiveFailures}`,
        `Current status: ${this.healthState.status}`,
      ]

      if (this.healthState.totalDowntime > 0) {
        troubleshootingSteps.push(`Total downtime: ${Math.round(this.healthState.totalDowntime / 1000)} seconds`)
      }

      logFailedRequest('GoTrue Health State Update', requestInfo, troubleshootingSteps)
    }
  }

  private sendNotification(notification: RecoveryNotification): void {
    if (!this.config.enableNotifications) {
      return
    }

    // Check cooldown period
    if (Date.now() - this.lastNotificationTime < this.config.notificationCooldownMs) {
      return
    }

    this.lastNotificationTime = Date.now()

    // Log notification
    console.log(`[Recovery Detector] ${notification.type}: ${notification.message}`)

    // Call all registered callbacks
    this.notificationCallbacks.forEach(callback => {
      try {
        callback(notification)
      } catch (error) {
        console.error('[Recovery Detector] Error in notification callback:', error)
      }
    })
  }
}

// Global recovery detector instance
let globalRecoveryDetector: RecoveryDetector | null = null

/**
 * Gets or creates the global recovery detector instance
 */
export function getRecoveryDetector(config?: Partial<RecoveryConfig>): RecoveryDetector {
  if (!globalRecoveryDetector) {
    globalRecoveryDetector = new RecoveryDetector(config)
  }
  return globalRecoveryDetector
}

/**
 * Resets the global recovery detector instance
 */
export function resetRecoveryDetector(): void {
  globalRecoveryDetector = null
}

/**
 * Processes a health check result for recovery detection
 */
export function processHealthCheckForRecovery(result: GoTrueHealthResult, config?: Partial<RecoveryConfig>): void {
  const detector = getRecoveryDetector(config)
  detector.processHealthCheckResult(result)
}

/**
 * Gets current health state from the global detector
 */
export function getCurrentHealthState(): HealthState {
  return getRecoveryDetector().getHealthState()
}

/**
 * Gets recovery history from the global detector
 */
export function getRecoveryHistory(): RecoveryEvent[] {
  return getRecoveryDetector().getRecoveryHistory()
}

/**
 * Adds a notification callback to the global detector
 */
export function onRecoveryNotification(callback: (notification: RecoveryNotification) => void): void {
  getRecoveryDetector().onNotification(callback)
}

/**
 * Triggers a manual recovery check
 */
export function triggerManualRecoveryCheck(): void {
  getRecoveryDetector().triggerRecoveryCheck('manual')
}

export { RecoveryDetector }