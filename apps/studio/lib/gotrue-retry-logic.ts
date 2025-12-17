/**
 * GoTrue Retry Logic with Exponential Backoff
 * 
 * Provides configurable retry mechanism for health checks with exponential backoff timing
 * and circuit breaker pattern for persistent failures.
 * 
 * Requirements: 2.3, 2.5
 */

import { 
  classifyGoTrueError, 
  isRetryableError, 
  getRetryConfig,
  type ClassifiedError,
  type GoTrueErrorType,
  type ErrorSeverity 
} from './gotrue-error-classification'
import { 
  logFailedRequest, 
  logSuccessfulRequest, 
  type RequestLogInfo 
} from 'common/configuration-logging'

/**
 * Retry configuration options
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number
  /** Initial delay between retries in milliseconds */
  initialDelay: number
  /** Maximum delay between retries in milliseconds */
  maxDelay: number
  /** Backoff multiplier for exponential backoff */
  backoffMultiplier: number
  /** Jitter factor to add randomness (0-1) */
  jitterFactor: number
  /** Timeout for each individual attempt in milliseconds */
  attemptTimeout: number
}

/**
 * Circuit breaker states
 */
export enum CircuitBreakerStateEnum {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Failing fast, not attempting requests
  HALF_OPEN = 'HALF_OPEN' // Testing if service has recovered
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Number of failures before opening circuit */
  failureThreshold: number
  /** Time to wait before attempting recovery (milliseconds) */
  recoveryTimeout: number
  /** Number of successful requests needed to close circuit */
  successThreshold: number
  /** Time window for counting failures (milliseconds) */
  failureWindow: number
}

/**
 * Circuit breaker state information
 */
interface CircuitBreakerStateInfo {
  state: CircuitBreakerStateEnum
  failureCount: number
  lastFailureTime: number
  successCount: number
  lastAttemptTime: number
  failures: Array<{ timestamp: number; error: ClassifiedError }>
}

/**
 * Retry attempt result
 */
export interface RetryAttemptResult<T> {
  /** Whether the operation succeeded */
  success: boolean
  /** Result data if successful */
  data?: T
  /** Error information if failed */
  error?: ClassifiedError
  /** Attempt number (1-based) */
  attemptNumber: number
  /** Total time spent on this attempt */
  attemptTime: number
  /** Whether this was the final attempt */
  finalAttempt: boolean
}

/**
 * Final retry result
 */
export interface RetryResult<T> {
  /** Whether the operation ultimately succeeded */
  success: boolean
  /** Result data if successful */
  data?: T
  /** Final error if all attempts failed */
  error?: ClassifiedError
  /** Total number of attempts made */
  totalAttempts: number
  /** Total time spent on all attempts */
  totalTime: number
  /** Individual attempt results */
  attempts: RetryAttemptResult<T>[]
  /** Whether circuit breaker prevented attempts */
  circuitBreakerTripped: boolean
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 4,
  initialDelay: 1000,
  maxDelay: 16000,
  backoffMultiplier: 2,
  jitterFactor: 0.1,
  attemptTimeout: 5000,
}

/**
 * Default circuit breaker configuration
 */
const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  recoveryTimeout: 30000, // 30 seconds
  successThreshold: 3,
  failureWindow: 60000, // 1 minute
}

/**
 * Circuit breaker instances per URL
 */
const circuitBreakers = new Map<string, CircuitBreakerStateInfo>()

/**
 * Retry operation with exponential backoff and circuit breaker
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  operationName: string,
  url: string,
  retryConfig: Partial<RetryConfig> = {},
  circuitBreakerConfig: Partial<CircuitBreakerConfig> = {}
): Promise<RetryResult<T>> {
  const config = { ...DEFAULT_RETRY_CONFIG, ...retryConfig }
  const cbConfig = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...circuitBreakerConfig }
  
  const startTime = Date.now()
  const attempts: RetryAttemptResult<T>[] = []
  
  // Check circuit breaker state
  const circuitBreaker = getOrCreateCircuitBreaker(url, cbConfig)
  
  if (circuitBreaker.state === CircuitBreakerStateEnum.OPEN) {
    const timeSinceLastFailure = Date.now() - circuitBreaker.lastFailureTime
    
    if (timeSinceLastFailure < cbConfig.recoveryTimeout) {
      // Circuit is open and recovery timeout hasn't passed
      console.warn(`[${operationName}] Circuit breaker is OPEN for ${url}, failing fast`)
      
      return {
        success: false,
        error: {
          type: 'SERVICE_UNAVAILABLE' as GoTrueErrorType,
          severity: 'HIGH' as ErrorSeverity,
          message: 'Service temporarily unavailable due to repeated failures',
          technicalDetails: `Circuit breaker is open for ${url}`,
          retryable: false,
          context: {
            url,
            timestamp: Date.now(),
          },
          troubleshootingSteps: [
            'Wait for the service to recover',
            'Check service health status',
            'Contact administrator if problem persists',
          ],
          environmentGuidance: [
            'Service is experiencing persistent failures',
            'Automatic recovery will be attempted shortly',
          ],
        } as ClassifiedError,
        totalAttempts: 0,
        totalTime: 0,
        attempts: [],
        circuitBreakerTripped: true,
      }
    } else {
      // Recovery timeout has passed, transition to half-open
      circuitBreaker.state = CircuitBreakerStateEnum.HALF_OPEN
      circuitBreaker.successCount = 0
      console.log(`[${operationName}] Circuit breaker transitioning to HALF_OPEN for ${url}`)
    }
  }
  
  let delay = config.initialDelay
  
  for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
    const attemptStartTime = Date.now()
    const isFinalAttempt = attempt === config.maxRetries + 1
    
    try {
      console.log(`[${operationName}] Attempt ${attempt}/${config.maxRetries + 1} for ${url}`)
      
      // Create timeout for this attempt
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), config.attemptTimeout)
      
      // Execute operation with timeout
      const result = await Promise.race([
        operation(),
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener('abort', () => {
            reject(new Error(`Operation timeout after ${config.attemptTimeout}ms`))
          })
        })
      ])
      
      clearTimeout(timeoutId)
      
      const attemptTime = Date.now() - attemptStartTime
      
      // Success!
      console.log(`[${operationName}] Attempt ${attempt} succeeded for ${url} (${attemptTime}ms)`)
      
      const attemptResult: RetryAttemptResult<T> = {
        success: true,
        data: result,
        attemptNumber: attempt,
        attemptTime,
        finalAttempt: isFinalAttempt,
      }
      
      attempts.push(attemptResult)
      
      // Update circuit breaker on success
      updateCircuitBreakerOnSuccess(circuitBreaker, cbConfig)
      
      // Log successful recovery if this wasn't the first attempt
      if (attempt > 1) {
        const requestInfo: RequestLogInfo = {
          url,
          method: 'GET',
          responseTime: attemptTime,
          success: true,
          context: {
            operationName,
            attemptNumber: attempt,
            totalAttempts: attempt,
            recovered: true,
          },
        }
        
        logSuccessfulRequest(`${operationName} Recovery`, requestInfo)
      }
      
      return {
        success: true,
        data: result,
        totalAttempts: attempt,
        totalTime: Date.now() - startTime,
        attempts,
        circuitBreakerTripped: false,
      }
      
    } catch (error) {
      const attemptTime = Date.now() - attemptStartTime
      
      // Classify the error
      const classifiedError = classifyGoTrueError(error, {
        url,
        responseTime: attemptTime,
        environment: detectEnvironment(url),
      })
      
      console.warn(`[${operationName}] Attempt ${attempt} failed for ${url}: ${classifiedError.message}`)
      
      const attemptResult: RetryAttemptResult<T> = {
        success: false,
        error: classifiedError,
        attemptNumber: attempt,
        attemptTime,
        finalAttempt: isFinalAttempt,
      }
      
      attempts.push(attemptResult)
      
      // Update circuit breaker on failure
      updateCircuitBreakerOnFailure(circuitBreaker, classifiedError, cbConfig)
      
      // Check if we should retry
      if (isFinalAttempt || !isRetryableError(classifiedError.type)) {
        // Final attempt or non-retryable error
        console.error(`[${operationName}] All attempts failed for ${url}`)
        
        const requestInfo: RequestLogInfo = {
          url,
          method: 'GET',
          responseTime: attemptTime,
          success: false,
          error: classifiedError.message,
          context: {
            operationName,
            attemptNumber: attempt,
            totalAttempts: attempt,
            errorType: classifiedError.type,
            severity: classifiedError.severity,
          },
        }
        
        logFailedRequest(`${operationName} Final Failure`, requestInfo, [
          ...classifiedError.troubleshootingSteps,
          `Failed after ${attempt} attempts`,
          `Total time: ${Date.now() - startTime}ms`,
        ])
        
        return {
          success: false,
          error: classifiedError,
          totalAttempts: attempt,
          totalTime: Date.now() - startTime,
          attempts,
          circuitBreakerTripped: false,
        }
      }
      
      // Calculate delay for next attempt
      if (attempt <= config.maxRetries) {
        const jitter = Math.random() * config.jitterFactor * delay
        const actualDelay = Math.min(delay + jitter, config.maxDelay)
        
        console.log(`[${operationName}] Waiting ${actualDelay}ms before attempt ${attempt + 1}`)
        
        await new Promise(resolve => setTimeout(resolve, actualDelay))
        
        // Exponential backoff for next iteration
        delay = Math.min(delay * config.backoffMultiplier, config.maxDelay)
      }
    }
  }
  
  // This should never be reached, but TypeScript requires it
  throw new Error('Unexpected end of retry loop')
}

/**
 * Gets or creates a circuit breaker for a URL
 */
function getOrCreateCircuitBreaker(url: string, config: CircuitBreakerConfig): CircuitBreakerStateInfo {
  if (!circuitBreakers.has(url)) {
    circuitBreakers.set(url, {
      state: CircuitBreakerStateEnum.CLOSED,
      failureCount: 0,
      lastFailureTime: 0,
      successCount: 0,
      lastAttemptTime: 0,
      failures: [],
    })
  }
  
  const breaker = circuitBreakers.get(url)!
  
  // Clean up old failures outside the failure window
  const now = Date.now()
  breaker.failures = breaker.failures.filter(
    failure => now - failure.timestamp < config.failureWindow
  )
  breaker.failureCount = breaker.failures.length
  
  return breaker
}

/**
 * Updates circuit breaker state on successful operation
 */
function updateCircuitBreakerOnSuccess(
  breaker: CircuitBreakerStateInfo,
  config: CircuitBreakerConfig
): void {
  breaker.lastAttemptTime = Date.now()
  
  if (breaker.state === CircuitBreakerStateEnum.HALF_OPEN) {
    breaker.successCount++
    
    if (breaker.successCount >= config.successThreshold) {
      // Enough successes to close the circuit
      breaker.state = CircuitBreakerStateEnum.CLOSED
      breaker.failureCount = 0
      breaker.failures = []
      breaker.successCount = 0
      console.log('Circuit breaker transitioned to CLOSED (service recovered)')
    }
  } else if (breaker.state === CircuitBreakerStateEnum.CLOSED) {
    // Reset failure count on success in closed state
    breaker.failureCount = 0
    breaker.failures = []
  }
}

/**
 * Updates circuit breaker state on failed operation
 */
function updateCircuitBreakerOnFailure(
  breaker: CircuitBreakerStateInfo,
  error: ClassifiedError,
  config: CircuitBreakerConfig
): void {
  const now = Date.now()
  breaker.lastAttemptTime = now
  breaker.lastFailureTime = now
  
  // Add failure to history
  breaker.failures.push({
    timestamp: now,
    error,
  })
  
  // Clean up old failures and update count
  breaker.failures = breaker.failures.filter(
    failure => now - failure.timestamp < config.failureWindow
  )
  breaker.failureCount = breaker.failures.length
  
  // Check if we should open the circuit
  if (breaker.state === CircuitBreakerStateEnum.CLOSED && 
      breaker.failureCount >= config.failureThreshold) {
    breaker.state = CircuitBreakerStateEnum.OPEN
    breaker.successCount = 0
    console.warn(`Circuit breaker opened due to ${breaker.failureCount} failures`)
  } else if (breaker.state === CircuitBreakerStateEnum.HALF_OPEN) {
    // Failure in half-open state, go back to open
    breaker.state = CircuitBreakerStateEnum.OPEN
    breaker.successCount = 0
    console.warn('Circuit breaker returned to OPEN state after failure in HALF_OPEN')
  }
}

/**
 * Gets circuit breaker status for a URL
 */
export function getCircuitBreakerStatus(url: string): {
  state: CircuitBreakerStateEnum
  failureCount: number
  lastFailureTime: number
  timeSinceLastFailure: number
} {
  const breaker = circuitBreakers.get(url)
  
  if (!breaker) {
    return {
      state: CircuitBreakerStateEnum.CLOSED,
      failureCount: 0,
      lastFailureTime: 0,
      timeSinceLastFailure: 0,
    }
  }
  
  return {
    state: breaker.state,
    failureCount: breaker.failureCount,
    lastFailureTime: breaker.lastFailureTime,
    timeSinceLastFailure: Date.now() - breaker.lastFailureTime,
  }
}

/**
 * Resets circuit breaker for a URL (useful for testing or manual recovery)
 */
export function resetCircuitBreaker(url: string): void {
  circuitBreakers.delete(url)
  console.log(`Circuit breaker reset for ${url}`)
}

/**
 * Gets all circuit breaker statuses (for monitoring/debugging)
 */
export function getAllCircuitBreakerStatuses(): Record<string, {
  state: CircuitBreakerStateEnum
  failureCount: number
  lastFailureTime: number
}> {
  const statuses: Record<string, any> = {}
  
  for (const [url, breaker] of Array.from(circuitBreakers.entries())) {
    statuses[url] = {
      state: breaker.state,
      failureCount: breaker.failureCount,
      lastFailureTime: breaker.lastFailureTime,
    }
  }
  
  return statuses
}

/**
 * Detects environment from URL for context
 */
function detectEnvironment(url: string): 'development' | 'staging' | 'production' {
  const lowerUrl = url.toLowerCase()
  
  if (lowerUrl.includes('localhost') || lowerUrl.includes('127.0.0.1')) {
    return 'development'
  }
  
  if (lowerUrl.includes('staging') || lowerUrl.includes('stg') || lowerUrl.includes('dev.')) {
    return 'staging'
  }
  
  return 'production'
}

/**
 * Creates a retry-enabled version of a function
 */
export function withRetry<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  operationName: string,
  getUrl: (...args: T) => string,
  retryConfig?: Partial<RetryConfig>,
  circuitBreakerConfig?: Partial<CircuitBreakerConfig>
) {
  return async (...args: T): Promise<R> => {
    const url = getUrl(...args)
    
    const result = await retryWithBackoff(
      () => fn(...args),
      operationName,
      url,
      retryConfig,
      circuitBreakerConfig
    )
    
    if (result.success) {
      return result.data!
    } else {
      throw new Error(result.error?.message || 'Operation failed after retries')
    }
  }
}

/**
 * Exponential backoff delay calculation with jitter
 */
export function calculateBackoffDelay(
  attempt: number,
  initialDelay: number,
  backoffMultiplier: number,
  maxDelay: number,
  jitterFactor: number = 0.1
): number {
  const exponentialDelay = initialDelay * Math.pow(backoffMultiplier, attempt - 1)
  const cappedDelay = Math.min(exponentialDelay, maxDelay)
  const jitter = Math.random() * jitterFactor * cappedDelay
  
  return cappedDelay + jitter
}

/**
 * Checks if an operation should be retried based on error and attempt count
 */
export function shouldRetry(
  error: ClassifiedError,
  attemptNumber: number,
  maxRetries: number
): boolean {
  if (attemptNumber > maxRetries) {
    return false
  }
  
  return isRetryableError(error.type)
}