/**
 * GoTrue Service Health Check Utility
 * 
 * Provides functions to check the availability and health of the GoTrue authentication service
 * with comprehensive error handling, retry logic, and troubleshooting guidance.
 */

import { getGoTrueUrl, type GoTrueConfig } from 'common/gotrue-config'
import { 
  logFailedRequest, 
  logSuccessfulRequest, 
  type RequestLogInfo 
} from 'common/configuration-logging'
import { 
  classifyGoTrueError, 
  GoTrueErrorType,
  type ClassifiedError
} from './gotrue-error-classification'
import { 
  retryWithBackoff, 
  type RetryConfig,
  type CircuitBreakerConfig 
} from './gotrue-retry-logic'
import { 
  getTroubleshootingGuidance, 
  getActionableErrorMessage 
} from './gotrue-troubleshooting'
import {
  checkGoTrueHealthWithRateLimit,
  getHealthMonitor,
  type RateLimitConfig,
  type PerformanceThresholds
} from './gotrue-health-monitoring'
import {
  processHealthCheckForRecovery,
  getCurrentHealthState,
  getRecoveryHistory,
  onRecoveryNotification,
  triggerManualRecoveryCheck,
  type RecoveryConfig
} from './gotrue-recovery-detection'

/**
 * Extracts the base URL from a GoTrue URL by removing the /auth/v1 suffix
 * @param gotrueUrl - The full GoTrue URL (e.g., https://example.com/auth/v1)
 * @returns The base URL (e.g., https://example.com)
 */
function getBaseUrl(gotrueUrl: string): string {
  try {
    // Remove /auth/v1 suffix if present
    return gotrueUrl.replace(/\/auth\/v1$/, '')
  } catch {
    return gotrueUrl
  }
}

export interface GoTrueHealthResult {
  available: boolean
  url?: string
  source?: 'runtime' | 'explicit' | 'derived-public' | 'derived' | 'default'
  error?: string
  version?: string
  name?: string
  description?: string
  responseTime?: number
  /** Classified error information if health check failed */
  classifiedError?: ClassifiedError
  /** Number of retry attempts made */
  retryAttempts?: number
  /** Whether circuit breaker was triggered */
  circuitBreakerTripped?: boolean
}

/**
 * Checks if the GoTrue service is available and responding to health checks.
 * 
 * @param url - Optional GoTrue URL to check. If not provided, uses getGoTrueUrl()
 * @returns Promise resolving to health check result
 */
export async function checkGoTrueHealth(url?: string): Promise<GoTrueHealthResult> {
  // Get URL and source information
  let gotrueUrl: string
  let source: 'runtime' | 'explicit' | 'derived-public' | 'derived' | 'default' | undefined

  if (url) {
    // If URL is explicitly provided, use it
    gotrueUrl = url
    source = 'explicit'
  } else {
    // Otherwise, use the configuration module
    const config = getGoTrueUrl()
    gotrueUrl = config.url
    source = config.source
  }

  // If no GoTrue URL is configured, assume service is not available
  if (!gotrueUrl) {
    return {
      available: false,
      url: getBaseUrl(gotrueUrl),
      source,
      error: 'GoTrue URL not configured',
    }
  }

  const startTime = Date.now()
  const healthUrl = `${gotrueUrl}/health`

  try {
    // Call the GoTrue health endpoint
    console.log(`[GoTrue Health] Checking health at: ${healthUrl}`)
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    
    const response = await fetch(healthUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Only use signal in environments that support it properly
      ...(typeof AbortSignal !== 'undefined' && controller.signal instanceof AbortSignal ? { signal: controller.signal } : {}),
    })
    
    clearTimeout(timeoutId)
    const responseTime = Date.now() - startTime

    if (response.ok) {
      // Log successful health check with expected format
      console.log(`[GoTrue Health] Health check successful: ${healthUrl} (${response.status})`)
      
      // Also use centralized logging
      const requestInfo: RequestLogInfo = {
        url: healthUrl,
        method: 'GET',
        status: response.status,
        responseTime,
        success: true,
        context: {
          healthCheck: true,
          source,
        },
      }
      logSuccessfulRequest('GoTrue Health Check', requestInfo)
      
      // Try to parse response data
      try {
        const data = await response.json()
        return {
          available: true,
          url: getBaseUrl(gotrueUrl),
          source,
          version: data.version,
          name: data.name,
          description: data.description,
          responseTime,
        }
      } catch {
        // If JSON parsing fails, still return success
        return {
          available: true,
          url: getBaseUrl(gotrueUrl),
          source,
          responseTime,
        }
      }
    } else {
      // Log failed health check with troubleshooting steps
      const requestInfo: RequestLogInfo = {
        url: healthUrl,
        method: 'GET',
        status: response.status,
        responseTime,
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
        context: {
          healthCheck: true,
          source,
        },
      }
      
      const troubleshootingSteps = []
      if (response.status === 404) {
        troubleshootingSteps.push('GoTrue health endpoint not found - verify GoTrue service is running')
        troubleshootingSteps.push('Check if GoTrue is configured with health endpoint enabled')
        troubleshootingSteps.push('Verify the GoTrue URL is correct')
      } else if (response.status >= 500) {
        troubleshootingSteps.push('GoTrue service error - check GoTrue service logs')
        troubleshootingSteps.push('Verify GoTrue service has sufficient resources')
        troubleshootingSteps.push('Check database connectivity if GoTrue uses a database')
      } else if (response.status === 403) {
        troubleshootingSteps.push('Access forbidden - check GoTrue service configuration')
        troubleshootingSteps.push('Verify health endpoint is publicly accessible')
      }
      
      // Log with expected format
      console.log(`[GoTrue Health] Health check failed: ${healthUrl} (${response.status})`)
      
      logFailedRequest('GoTrue Health Check', requestInfo, troubleshootingSteps)
      
      return {
        available: false,
        url: getBaseUrl(gotrueUrl),
        source,
        error: `GoTrue service at ${gotrueUrl} returned status ${response.status}`,
        responseTime,
      }
    }
  } catch (error) {
    const responseTime = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    // Log failed health check with detailed troubleshooting
    const requestInfo: RequestLogInfo = {
      url: healthUrl,
      method: 'GET',
      responseTime,
      success: false,
      error: errorMessage,
      context: {
        healthCheck: true,
        source,
        errorType: error instanceof Error ? error.name : typeof error,
      },
    }
    
    const troubleshootingSteps = []
    if (error instanceof Error && error.name === 'AbortError') {
      troubleshootingSteps.push('Health check timed out after 5 seconds')
      troubleshootingSteps.push('GoTrue service may be slow to respond or unavailable')
      troubleshootingSteps.push('Check network connectivity to GoTrue service')
      troubleshootingSteps.push('Verify GoTrue service is running and healthy')
    } else if (errorMessage.includes('fetch')) {
      troubleshootingSteps.push('Network error connecting to GoTrue service')
      troubleshootingSteps.push('Check network connectivity')
      troubleshootingSteps.push('Verify GoTrue URL is correct and accessible')
      troubleshootingSteps.push('Check for firewall or proxy blocking the connection')
      
      // Environment-specific guidance
      if (gotrueUrl.includes('localhost') || gotrueUrl.includes('127.0.0.1')) {
        troubleshootingSteps.push('For local development: ensure docker-compose services are running')
        troubleshootingSteps.push('Check if port 54321 (GoTrue) is accessible')
      } else {
        troubleshootingSteps.push('For production: verify GoTrue service is deployed and accessible')
        troubleshootingSteps.push('Check DNS resolution for the GoTrue domain')
      }
    } else {
      troubleshootingSteps.push('Unexpected error during GoTrue health check')
      troubleshootingSteps.push('Check browser console for additional details')
      troubleshootingSteps.push('Verify GoTrue service configuration')
    }
    
    // Log with expected format
    console.log(`[GoTrue Health] Health check error: ${healthUrl} - ${errorMessage}`)
    
    logFailedRequest('GoTrue Health Check', requestInfo, troubleshootingSteps)
    
    return {
      available: false,
      url: getBaseUrl(gotrueUrl),
      source,
      error: `Failed to connect to GoTrue service at ${gotrueUrl}: ${errorMessage}`,
      responseTime,
    }
  }
}

/**
 * Checks GoTrue service health with retry logic and exponential backoff.
 * 
 * @param url - GoTrue URL to check
 * @param maxRetries - Maximum number of retry attempts
 * @param initialDelayMs - Initial delay between retries in milliseconds
 * @returns Promise resolving to health check result
 */
export async function checkGoTrueHealthWithRetry(
  url?: string,
  maxRetries: number = 3,
  initialDelayMs: number = 1000
): Promise<GoTrueHealthResult> {
  let lastResult: GoTrueHealthResult | undefined
  let delayMs = initialDelayMs

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await checkGoTrueHealth(url)

    if (result.available) {
      if (attempt > 0) {
        console.log(`[GoTrue Health] Service available after ${attempt} retries`)
      }
      return result
    }

    lastResult = result
    console.warn(
      `[GoTrue Health] Attempt ${attempt + 1}/${maxRetries + 1} failed:`,
      result.error
    )

    // Don't delay after the last attempt
    if (attempt < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
      // Exponential backoff: double the delay for next attempt
      delayMs *= 2
    }
  }

  // Return the last failed result with all its information
  return {
    available: false,
    url: lastResult?.url,
    source: lastResult?.source,
    error: lastResult?.error || 'Service unavailable after retries',
    responseTime: lastResult?.responseTime,
  }
}

/**
 * Categorizes GoTrue errors by type for better error handling
 * @deprecated Use classifyGoTrueError from gotrue-error-classification instead
 */
export function categorizeGoTrueError(error: string): GoTrueErrorType {
  if (error.includes('not configured')) {
    return GoTrueErrorType.CONFIGURATION_ERROR
  }
  if (error.includes('timeout') || error.includes('aborted')) {
    return GoTrueErrorType.TIMEOUT
  }
  if (error.includes('Failed to connect') || error.includes('fetch failed')) {
    return GoTrueErrorType.NETWORK_ERROR
  }
  return GoTrueErrorType.SERVICE_UNAVAILABLE
}

/**
 * Gets a user-friendly error message for GoTrue service failures
 */
export function getGoTrueErrorMessage(error: string): string {
  const errorType = categorizeGoTrueError(error)
  
  switch (errorType) {
    case GoTrueErrorType.CONFIGURATION_ERROR:
      return 'Authentication service is not configured. Please contact your administrator.'
    case GoTrueErrorType.TIMEOUT:
      return 'Authentication service is taking too long to respond. Please try again.'
    case GoTrueErrorType.NETWORK_ERROR:
      return 'Cannot connect to authentication service. Please check your network connection.'
    case GoTrueErrorType.SERVICE_UNAVAILABLE:
    default:
      return 'Authentication service is currently unavailable. Please try again later or contact your administrator.'
  }
}

/**
 * Enhanced GoTrue health check with comprehensive error handling and retry logic
 */
export async function checkGoTrueHealthEnhanced(
  url?: string,
  retryConfig?: Partial<RetryConfig>,
  circuitBreakerConfig?: Partial<CircuitBreakerConfig>
): Promise<GoTrueHealthResult> {
  // Get URL and source information
  let gotrueUrl: string
  let source: 'runtime' | 'explicit' | 'derived-public' | 'derived' | 'default' | undefined

  if (url) {
    gotrueUrl = url
    source = 'explicit'
  } else {
    const config = getGoTrueUrl()
    gotrueUrl = config.url
    source = config.source
  }

  // If no GoTrue URL is configured, return immediately
  if (!gotrueUrl) {
    const classifiedError = classifyGoTrueError(
      new Error('GoTrue URL not configured'),
      {
        url: 'unknown',
        environment: 'development',
      }
    )

    return {
      available: false,
      url: getBaseUrl(gotrueUrl),
      source,
      error: 'GoTrue URL not configured',
      classifiedError,
    }
  }

  const healthUrl = `${gotrueUrl}/health`

  try {
    // Use retry logic with exponential backoff
    const result = await retryWithBackoff(
      async () => {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000)
        
        try {
          const response = await fetch(healthUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
            // Only use signal in environments that support it properly
            ...(typeof AbortSignal !== 'undefined' && controller.signal instanceof AbortSignal ? { signal: controller.signal } : {}),
          })
          
          clearTimeout(timeoutId)
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }
          
          // Try to parse response data
          let data: any = {}
          try {
            data = await response.json()
          } catch {
            // If JSON parsing fails, continue with empty data
          }
          
          return {
            response,
            data,
          }
        } catch (error) {
          clearTimeout(timeoutId)
          throw error
        }
      },
      'GoTrue Health Check',
      healthUrl,
      retryConfig,
      circuitBreakerConfig
    )

    if (result.success && result.data) {
      const { response, data } = result.data
      
      // Log successful health check
      const requestInfo: RequestLogInfo = {
        url: healthUrl,
        method: 'GET',
        status: response.status,
        responseTime: result.totalTime,
        success: true,
        context: {
          healthCheck: true,
          source,
          retryAttempts: result.totalAttempts - 1,
        },
      }
      
      logSuccessfulRequest('GoTrue Health Check Enhanced', requestInfo)
      
      // Log recovery if retries were needed
      if (result.totalAttempts > 1) {
        console.log(`[GoTrue Health] Service recovered after ${result.totalAttempts - 1} retries`)
      }

      return {
        available: true,
        url: getBaseUrl(gotrueUrl),
        source,
        version: data.version,
        name: data.name,
        description: data.description,
        responseTime: result.totalTime,
        retryAttempts: result.totalAttempts - 1,
        circuitBreakerTripped: result.circuitBreakerTripped,
      }
    } else {
      // All retries failed
      const classifiedError = result.error!
      const troubleshootingGuidance = getTroubleshootingGuidance(classifiedError, {
        url: healthUrl,
        isHealthCheck: true,
      })
      
      // Log comprehensive failure information
      const requestInfo: RequestLogInfo = {
        url: healthUrl,
        method: 'GET',
        responseTime: result.totalTime,
        success: false,
        error: classifiedError.message,
        context: {
          healthCheck: true,
          source,
          errorType: classifiedError.type,
          severity: classifiedError.severity,
          retryAttempts: result.totalAttempts - 1,
          circuitBreakerTripped: result.circuitBreakerTripped,
        },
      }
      
      const troubleshootingSteps = [
        ...troubleshootingGuidance.primarySteps,
        ...troubleshootingGuidance.environmentSteps,
        `Failed after ${result.totalAttempts} attempts`,
        `Total time: ${result.totalTime}ms`,
      ]
      
      logFailedRequest('GoTrue Health Check Enhanced', requestInfo, troubleshootingSteps)
      
      return {
        available: false,
        url: getBaseUrl(gotrueUrl),
        source,
        error: getActionableErrorMessage(classifiedError, {
          url: healthUrl,
          isHealthCheck: true,
        }),
        responseTime: result.totalTime,
        classifiedError,
        retryAttempts: result.totalAttempts - 1,
        circuitBreakerTripped: result.circuitBreakerTripped,
      }
    }
  } catch (error) {
    // This should not happen with the retry logic, but handle it just in case
    const classifiedError = classifyGoTrueError(error, {
      url: healthUrl,
      environment: gotrueUrl.includes('localhost') ? 'development' : 'production',
    })

    const requestInfo: RequestLogInfo = {
      url: healthUrl,
      method: 'GET',
      success: false,
      error: classifiedError.message,
      context: {
        healthCheck: true,
        source,
        errorType: classifiedError.type,
        severity: classifiedError.severity,
      },
    }

    logFailedRequest('GoTrue Health Check Enhanced', requestInfo, classifiedError.troubleshootingSteps)

    return {
      available: false,
      url: getBaseUrl(gotrueUrl),
      source,
      error: getActionableErrorMessage(classifiedError, {
        url: healthUrl,
        isHealthCheck: true,
      }),
      classifiedError,
    }
  }
}

/**
 * GoTrue health check with rate limiting protection and performance monitoring
 */
export async function checkGoTrueHealthWithMonitoring(
  url?: string,
  retryConfig?: Partial<RetryConfig>,
  circuitBreakerConfig?: Partial<CircuitBreakerConfig>,
  rateLimitConfig?: Partial<RateLimitConfig>,
  performanceThresholds?: Partial<PerformanceThresholds>
): Promise<GoTrueHealthResult> {
  return checkGoTrueHealthWithRateLimit(
    () => checkGoTrueHealthEnhanced(url, retryConfig, circuitBreakerConfig),
    rateLimitConfig,
    performanceThresholds
  )
}

/**
 * Comprehensive GoTrue health check with monitoring, rate limiting, and recovery detection
 */
export async function checkGoTrueHealthComprehensive(
  url?: string,
  retryConfig?: Partial<RetryConfig>,
  circuitBreakerConfig?: Partial<CircuitBreakerConfig>,
  rateLimitConfig?: Partial<RateLimitConfig>,
  performanceThresholds?: Partial<PerformanceThresholds>,
  recoveryConfig?: Partial<RecoveryConfig>
): Promise<GoTrueHealthResult> {
  // Perform health check with monitoring
  const result = await checkGoTrueHealthWithMonitoring(
    url,
    retryConfig,
    circuitBreakerConfig,
    rateLimitConfig,
    performanceThresholds
  )

  // Process result for recovery detection
  processHealthCheckForRecovery(result, recoveryConfig)

  return result
}

/**
 * Gets current health monitoring metrics
 */
export function getHealthMetrics() {
  return getHealthMonitor().getMetrics()
}

/**
 * Gets performance analysis for health checks
 */
export function getHealthPerformanceAnalysis() {
  return getHealthMonitor().getPerformanceAnalysis()
}

/**
 * Gets current health state from recovery detection
 */
export function getHealthState() {
  return getCurrentHealthState()
}

/**
 * Gets recovery event history
 */
export function getHealthRecoveryHistory() {
  return getRecoveryHistory()
}

/**
 * Registers a callback for recovery notifications
 */
export function onHealthRecoveryNotification(callback: (notification: any) => void) {
  return onRecoveryNotification(callback)
}

/**
 * Manually triggers a recovery check
 */
export function triggerHealthRecoveryCheck() {
  return triggerManualRecoveryCheck()
}
