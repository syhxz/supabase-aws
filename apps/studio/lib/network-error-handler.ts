/**
 * Network Error Handler Utility
 * 
 * Provides utilities for detecting and handling network errors with retry logic.
 */

export interface NetworkErrorResult {
  isNetworkError: boolean
  shouldRetry: boolean
  userMessage: string
  technicalMessage: string
}

/**
 * Detects if an error is a network-related error
 */
export function isNetworkError(error: any): boolean {
  if (!error) return false

  const errorMessage = error.message?.toLowerCase() || ''
  const errorName = error.name?.toLowerCase() || ''

  // Check for common network error patterns
  return (
    errorMessage.includes('network') ||
    errorMessage.includes('fetch failed') ||
    errorMessage.includes('failed to fetch') ||
    errorMessage.includes('networkerror') ||
    errorMessage.includes('connection') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('aborted') ||
    errorName === 'networkerror' ||
    errorName === 'typeerror' && errorMessage.includes('fetch')
  )
}

/**
 * Analyzes an error and provides handling recommendations
 */
export function analyzeNetworkError(error: any): NetworkErrorResult {
  const errorMessage = error?.message || 'Unknown error'
  const isNetwork = isNetworkError(error)

  if (isNetwork) {
    return {
      isNetworkError: true,
      shouldRetry: true,
      userMessage: 'Network error. Please check your connection and try again.',
      technicalMessage: errorMessage,
    }
  }

  return {
    isNetworkError: false,
    shouldRetry: false,
    userMessage: errorMessage,
    technicalMessage: errorMessage,
  }
}

/**
 * Retry a function with exponential backoff
 * 
 * @param fn - Function to retry
 * @param maxRetries - Maximum number of retry attempts
 * @param initialDelayMs - Initial delay between retries in milliseconds
 * @returns Promise resolving to the function result
 */
export async function retryWithExponentialBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelayMs: number = 1000
): Promise<T> {
  let lastError: any
  let delayMs = initialDelayMs

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      
      // Check if this is a network error that should be retried
      const analysis = analyzeNetworkError(error)
      
      if (!analysis.shouldRetry || attempt === maxRetries) {
        throw error
      }

      console.warn(
        `[Network] Attempt ${attempt + 1}/${maxRetries + 1} failed, retrying in ${delayMs}ms...`,
        analysis.technicalMessage
      )

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delayMs))
      
      // Exponential backoff: double the delay for next attempt
      delayMs *= 2
    }
  }

  throw lastError
}

/**
 * Wraps an async function with network error handling and retry logic
 */
export function withNetworkErrorHandling<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number
    initialDelayMs?: number
    onError?: (error: NetworkErrorResult) => void
  } = {}
): Promise<T> {
  const { maxRetries = 3, initialDelayMs = 1000, onError } = options

  return retryWithExponentialBackoff(fn, maxRetries, initialDelayMs).catch((error) => {
    const analysis = analyzeNetworkError(error)
    
    if (onError) {
      onError(analysis)
    }
    
    throw error
  })
}
