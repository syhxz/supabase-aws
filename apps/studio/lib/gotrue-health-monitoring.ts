/**
 * GoTrue Health Check Rate Limiting Protection and Performance Monitoring
 * 
 * Provides rate limiting immunity for health endpoints, request throttling,
 * and performance monitoring capabilities for GoTrue health checks.
 */

import { GoTrueHealthResult } from './gotrue-health'

export interface HealthCheckMetrics {
  /** Total number of health check requests made */
  totalRequests: number
  /** Number of successful health check requests */
  successfulRequests: number
  /** Number of failed health check requests */
  failedRequests: number
  /** Average response time in milliseconds */
  averageResponseTime: number
  /** Minimum response time in milliseconds */
  minResponseTime: number
  /** Maximum response time in milliseconds */
  maxResponseTime: number
  /** Last health check timestamp */
  lastCheckTime: number
  /** Current health status */
  currentStatus: 'healthy' | 'unhealthy' | 'unknown'
  /** Rate limiting status */
  rateLimitingActive: boolean
  /** Number of throttled requests */
  throttledRequests: number
}

export interface RateLimitConfig {
  /** Maximum requests per window */
  maxRequests: number
  /** Time window in milliseconds */
  windowMs: number
  /** Whether health checks are immune to rate limiting */
  healthCheckImmunity: boolean
  /** Minimum interval between health checks in milliseconds */
  minHealthCheckInterval: number
}

export interface PerformanceThresholds {
  /** Warning threshold for response time in milliseconds */
  responseTimeWarning: number
  /** Critical threshold for response time in milliseconds */
  responseTimeCritical: number
  /** Maximum acceptable failure rate (0-1) */
  maxFailureRate: number
  /** Time window for calculating failure rate in milliseconds */
  failureRateWindow: number
}

class HealthCheckMonitor {
  private metrics: HealthCheckMetrics
  private rateLimitConfig: RateLimitConfig
  private performanceThresholds: PerformanceThresholds
  private requestHistory: Array<{ timestamp: number; success: boolean; responseTime: number }>
  private lastHealthCheckTime: number = 0
  private rateLimitWindow: Array<{ timestamp: number; isHealthCheck: boolean }>

  constructor(
    rateLimitConfig?: Partial<RateLimitConfig>,
    performanceThresholds?: Partial<PerformanceThresholds>
  ) {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0,
      lastCheckTime: 0,
      currentStatus: 'unknown',
      rateLimitingActive: false,
      throttledRequests: 0,
    }

    this.rateLimitConfig = {
      maxRequests: 100,
      windowMs: 60000, // 1 minute
      healthCheckImmunity: true,
      minHealthCheckInterval: 5000, // 5 seconds
      ...rateLimitConfig,
    }

    this.performanceThresholds = {
      responseTimeWarning: 2000, // 2 seconds
      responseTimeCritical: 5000, // 5 seconds
      maxFailureRate: 0.1, // 10%
      failureRateWindow: 300000, // 5 minutes
      ...performanceThresholds,
    }

    this.requestHistory = []
    this.rateLimitWindow = []
  }

  /**
   * Checks if a health check request should be allowed based on rate limiting rules
   */
  shouldAllowHealthCheck(): boolean {
    const now = Date.now()

    // Health checks have immunity from rate limiting
    if (this.rateLimitConfig.healthCheckImmunity) {
      // But still enforce minimum interval to prevent excessive requests
      if (now - this.lastHealthCheckTime < this.rateLimitConfig.minHealthCheckInterval) {
        console.log('[Health Monitor] Health check throttled due to minimum interval')
        this.metrics.throttledRequests++
        return false
      }
      return true
    }

    // Clean old entries from rate limit window
    this.cleanRateLimitWindow(now)

    // Check if we're within rate limits
    const healthCheckRequests = this.rateLimitWindow.filter(entry => entry.isHealthCheck).length
    const totalRequests = this.rateLimitWindow.length

    if (totalRequests >= this.rateLimitConfig.maxRequests) {
      console.log('[Health Monitor] Rate limit exceeded, health check denied')
      this.metrics.rateLimitingActive = true
      this.metrics.throttledRequests++
      return false
    }

    this.metrics.rateLimitingActive = false
    return true
  }

  /**
   * Records a health check request for rate limiting tracking
   */
  recordHealthCheckRequest(): void {
    const now = Date.now()
    this.rateLimitWindow.push({ timestamp: now, isHealthCheck: true })
    this.lastHealthCheckTime = now
  }

  /**
   * Records the result of a health check for performance monitoring
   */
  recordHealthCheckResult(result: GoTrueHealthResult): void {
    const now = Date.now()
    const responseTime = result.responseTime || 0

    // Update basic metrics
    this.metrics.totalRequests++
    this.metrics.lastCheckTime = now

    if (result.available) {
      this.metrics.successfulRequests++
      this.metrics.currentStatus = 'healthy'
    } else {
      this.metrics.failedRequests++
      this.metrics.currentStatus = 'unhealthy'
    }

    // Update response time metrics (include 0 response times for throttled requests)
    this.metrics.minResponseTime = Math.min(this.metrics.minResponseTime, responseTime)
    this.metrics.maxResponseTime = Math.max(this.metrics.maxResponseTime, responseTime)
    
    // Calculate rolling average
    const totalResponseTime = this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + responseTime
    this.metrics.averageResponseTime = totalResponseTime / this.metrics.totalRequests

    // Add to request history for trend analysis
    this.requestHistory.push({
      timestamp: now,
      success: result.available,
      responseTime,
    })

    // Clean old history entries
    this.cleanRequestHistory(now)

    // Check performance thresholds and log warnings
    this.checkPerformanceThresholds(result)
  }

  /**
   * Gets current health check metrics
   */
  getMetrics(): HealthCheckMetrics {
    return { ...this.metrics }
  }

  /**
   * Gets performance analysis based on recent history
   */
  getPerformanceAnalysis(): {
    recentFailureRate: number
    averageRecentResponseTime: number
    performanceStatus: 'good' | 'warning' | 'critical'
    recommendations: string[]
  } {
    const now = Date.now()
    const recentHistory = this.requestHistory.filter(
      entry => now - entry.timestamp <= this.performanceThresholds.failureRateWindow
    )

    if (recentHistory.length === 0) {
      return {
        recentFailureRate: 0,
        averageRecentResponseTime: 0,
        performanceStatus: 'good',
        recommendations: [],
      }
    }

    const failures = recentHistory.filter(entry => !entry.success).length
    const recentFailureRate = failures / recentHistory.length

    const totalRecentResponseTime = recentHistory.reduce((sum, entry) => sum + entry.responseTime, 0)
    const averageRecentResponseTime = totalRecentResponseTime / recentHistory.length

    let performanceStatus: 'good' | 'warning' | 'critical' = 'good'
    const recommendations: string[] = []

    // Check failure rate
    if (recentFailureRate > this.performanceThresholds.maxFailureRate) {
      performanceStatus = 'critical'
      recommendations.push(`High failure rate: ${(recentFailureRate * 100).toFixed(1)}%`)
      recommendations.push('Check GoTrue service health and configuration')
    }

    // Check response times
    if (averageRecentResponseTime > this.performanceThresholds.responseTimeCritical) {
      performanceStatus = 'critical'
      recommendations.push(`Critical response time: ${averageRecentResponseTime.toFixed(0)}ms`)
      recommendations.push('GoTrue service may be overloaded or experiencing issues')
    } else if (averageRecentResponseTime > this.performanceThresholds.responseTimeWarning) {
      if (performanceStatus !== 'critical') {
        performanceStatus = 'warning'
      }
      recommendations.push(`Slow response time: ${averageRecentResponseTime.toFixed(0)}ms`)
      recommendations.push('Monitor GoTrue service performance')
    }

    // Check rate limiting
    if (this.metrics.rateLimitingActive) {
      recommendations.push('Rate limiting is active - consider adjusting limits')
    }

    if (this.metrics.throttledRequests > 0) {
      recommendations.push(`${this.metrics.throttledRequests} requests were throttled`)
    }

    return {
      recentFailureRate,
      averageRecentResponseTime,
      performanceStatus,
      recommendations,
    }
  }

  /**
   * Resets all metrics and history
   */
  reset(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0,
      lastCheckTime: 0,
      currentStatus: 'unknown',
      rateLimitingActive: false,
      throttledRequests: 0,
    }
    this.requestHistory = []
    this.rateLimitWindow = []
    this.lastHealthCheckTime = 0
  }

  private cleanRateLimitWindow(now: number): void {
    const cutoff = now - this.rateLimitConfig.windowMs
    this.rateLimitWindow = this.rateLimitWindow.filter(entry => entry.timestamp > cutoff)
  }

  private cleanRequestHistory(now: number): void {
    const cutoff = now - this.performanceThresholds.failureRateWindow
    this.requestHistory = this.requestHistory.filter(entry => entry.timestamp > cutoff)
  }

  private checkPerformanceThresholds(result: GoTrueHealthResult): void {
    const responseTime = result.responseTime || 0

    if (responseTime > this.performanceThresholds.responseTimeCritical) {
      console.warn(`[Health Monitor] Critical response time: ${responseTime}ms (threshold: ${this.performanceThresholds.responseTimeCritical}ms)`)
    } else if (responseTime > this.performanceThresholds.responseTimeWarning) {
      console.warn(`[Health Monitor] Slow response time: ${responseTime}ms (threshold: ${this.performanceThresholds.responseTimeWarning}ms)`)
    }

    if (!result.available) {
      console.warn('[Health Monitor] Health check failed:', result.error)
    }
  }
}

// Global health monitor instance
let globalHealthMonitor: HealthCheckMonitor | null = null

/**
 * Gets or creates the global health monitor instance
 */
export function getHealthMonitor(
  rateLimitConfig?: Partial<RateLimitConfig>,
  performanceThresholds?: Partial<PerformanceThresholds>
): HealthCheckMonitor {
  if (!globalHealthMonitor) {
    globalHealthMonitor = new HealthCheckMonitor(rateLimitConfig, performanceThresholds)
  }
  return globalHealthMonitor
}

/**
 * Resets the global health monitor instance
 */
export function resetHealthMonitor(): void {
  globalHealthMonitor = null
}

/**
 * Wrapper function that adds rate limiting protection to health checks
 */
export async function checkGoTrueHealthWithRateLimit(
  healthCheckFn: () => Promise<GoTrueHealthResult>,
  rateLimitConfig?: Partial<RateLimitConfig>,
  performanceThresholds?: Partial<PerformanceThresholds>
): Promise<GoTrueHealthResult> {
  const monitor = getHealthMonitor(rateLimitConfig, performanceThresholds)

  // Check if request should be allowed
  if (!monitor.shouldAllowHealthCheck()) {
    const throttledResult: GoTrueHealthResult = {
      available: false,
      error: 'Health check throttled due to rate limiting',
      responseTime: 0,
    }
    
    // Still record the throttled result for metrics
    monitor.recordHealthCheckResult(throttledResult)
    
    return throttledResult
  }

  // Record the request
  monitor.recordHealthCheckRequest()

  try {
    // Perform the health check
    const result = await healthCheckFn()
    
    // Record the result for monitoring
    monitor.recordHealthCheckResult(result)
    
    return result
  } catch (error) {
    // Record failed result
    const failedResult: GoTrueHealthResult = {
      available: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime: 0,
    }
    
    monitor.recordHealthCheckResult(failedResult)
    
    return failedResult
  }
}

export { HealthCheckMonitor }