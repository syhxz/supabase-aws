/**
 * Runtime Configuration Store
 * 
 * Manages runtime configuration state with caching, staleness detection,
 * and concurrent request handling.
 * 
 * This module provides a centralized way to fetch and cache runtime configuration
 * from the server-side API endpoint, ensuring that:
 * 1. Configuration is fetched only once per session (or when stale)
 * 2. Concurrent requests are handled gracefully
 * 3. Errors are properly managed and reported
 * 4. Configuration can be refreshed when needed
 * 5. Fallback to build-time configuration when runtime config fails
 */

import {
  ConfigError,
  analyzeConfigError,
  logConfigError,
  createNetworkTimeoutError,
  createInvalidResponseError,
  createServerError,
} from './runtime-config-errors'
import {
  logConfigurationSource,
  logFailedRequest,
  logSuccessfulRequest,
  logConfigurationChange,
  logConfigurationError,
  ConfigOperation,
  type RequestLogInfo,
} from './configuration-logging'

/**
 * Runtime configuration interface matching the API response
 */
export interface RuntimeConfig {
  /** GoTrue authentication service URL */
  gotrueUrl: string
  /** Base Supabase API URL */
  supabaseUrl: string
  /** External API URL (Kong gateway) */
  apiUrl: string
  /** Anonymous API key for authentication */
  anonKey: string
  /** How the configuration was determined */
  source: 'explicit' | 'derived' | 'default'
  /** Current environment */
  environment: 'development' | 'production' | 'staging'
  /** Timestamp when config was generated */
  timestamp: number
}

/**
 * Runtime configuration store state
 */
export interface RuntimeConfigStore {
  /** Current configuration (null if not loaded) */
  config: RuntimeConfig | null
  /** Whether configuration is currently being fetched */
  isLoading: boolean
  /** Error that occurred during fetch (null if successful) */
  error: ConfigError | null
  /** Unix timestamp when config was fetched */
  fetchedAt: number | null
  /** Number of fetch attempts */
  attempts: number
  /** Whether fallback to build-time config is active */
  usingFallback: boolean
}

/**
 * Configuration staleness threshold (5 minutes in milliseconds)
 */
const STALENESS_THRESHOLD = 5 * 60 * 1000

/**
 * Maximum number of retry attempts
 */
const MAX_RETRY_ATTEMPTS = 3

/**
 * Fetch timeout in milliseconds
 */
const FETCH_TIMEOUT = 3000

/**
 * Global store instance
 */
let store: RuntimeConfigStore = {
  config: null,
  isLoading: false,
  error: null,
  fetchedAt: null,
  attempts: 0,
  usingFallback: false,
}

/**
 * Promise for ongoing fetch request (to handle concurrent requests)
 */
let ongoingFetch: Promise<RuntimeConfig> | null = null

/**
 * Subscribers to configuration changes
 */
type ConfigChangeListener = (config: RuntimeConfig | null, error: ConfigError | null) => void
const listeners: Set<ConfigChangeListener> = new Set()

/**
 * Subscribe to configuration changes
 * @param listener Function to call when configuration changes
 * @returns Unsubscribe function
 */
export function subscribeToConfigChanges(listener: ConfigChangeListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Notify all listeners of configuration changes
 */
function notifyListeners(): void {
  listeners.forEach((listener) => {
    try {
      listener(store.config, store.error)
    } catch (error) {
      console.error('[Runtime Config Store] Error in listener:', error)
    }
  })
}

/**
 * Fetches runtime configuration from the API with timeout and comprehensive logging
 */
async function fetchWithTimeout(url: string, timeout: number): Promise<Response> {
  const startTime = Date.now()
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    console.log(`[Runtime Config Store] Making request to: ${url}`)
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
      },
    })
    
    clearTimeout(timeoutId)
    const responseTime = Date.now() - startTime
    
    // Log request details
    const requestInfo: RequestLogInfo = {
      url,
      method: 'GET',
      status: response.status,
      responseTime,
      success: response.ok,
      context: {
        timeout,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    }
    
    if (response.ok) {
      logSuccessfulRequest('Runtime Config Store', requestInfo)
    } else {
      requestInfo.error = `HTTP ${response.status}: ${response.statusText}`
      logFailedRequest('Runtime Config Store', requestInfo, [
        'Check server logs for detailed error information',
        'Verify server environment variables are properly configured',
        'Ensure the runtime configuration API endpoint is working',
        'Check network connectivity to the server',
      ])
    }
    
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    const responseTime = Date.now() - startTime
    
    // Log failed request with detailed information
    const requestInfo: RequestLogInfo = {
      url,
      method: 'GET',
      responseTime,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      context: {
        timeout,
        errorType: error instanceof Error ? error.name : typeof error,
      },
    }
    
    if (error instanceof Error && error.name === 'AbortError') {
      requestInfo.error = `Request timeout after ${timeout}ms`
      logFailedRequest('Runtime Config Store', requestInfo, [
        'Request timed out - server may be slow to respond',
        'Check network connectivity',
        'Verify server is running and accessible',
        'Consider increasing timeout if server is consistently slow',
      ])
      throw createNetworkTimeoutError(timeout, url)
    } else {
      logFailedRequest('Runtime Config Store', requestInfo, [
        'Network error occurred during request',
        'Check network connectivity',
        'Verify server is running',
        'Check for firewall or proxy issues',
      ])
      throw error
    }
  }
}

/**
 * Fetch runtime configuration from the server
 * 
 * This function handles:
 * - Concurrent request deduplication
 * - Timeout handling
 * - Error management
 * - State updates
 * 
 * @returns Promise resolving to RuntimeConfig
 * @throws Error if fetch fails after retries
 */
export async function fetchRuntimeConfig(): Promise<RuntimeConfig> {
  // If there's already an ongoing fetch, return that promise
  if (ongoingFetch) {
    console.log('[Runtime Config Store] Reusing ongoing fetch request')
    return ongoingFetch
  }

  // Create new fetch promise
  ongoingFetch = (async () => {
    try {
      // Update loading state
      store.isLoading = true
      store.error = null
      store.attempts += 1
      notifyListeners()

      console.log(
        `[Runtime Config Store] Fetching configuration (attempt ${store.attempts}/${MAX_RETRY_ATTEMPTS})`
      )

      // Determine the correct URL for the runtime config API
      // In server-side context (like health checks), we need to use localhost
      const isServerSide = typeof window === 'undefined'
      const configUrl = isServerSide 
        ? 'http://localhost:3000/api/runtime-config'
        : '/api/runtime-config'
      
      // Fetch with timeout
      const response = await fetchWithTimeout(configUrl, FETCH_TIMEOUT)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw createServerError(
          response.status,
          errorData.error || response.statusText
        )
      }

      const config: RuntimeConfig = await response.json()

      // Validate response structure
      if (!config.gotrueUrl || !config.supabaseUrl || !config.apiUrl) {
        throw createInvalidResponseError('missing required fields (gotrueUrl, supabaseUrl, or apiUrl)')
      }

      // Validate URL formats
      if (!config.gotrueUrl.startsWith('http://') && !config.gotrueUrl.startsWith('https://')) {
        throw createInvalidResponseError(`gotrueUrl has invalid protocol: ${config.gotrueUrl}`)
      }
      if (!config.supabaseUrl.startsWith('http://') && !config.supabaseUrl.startsWith('https://')) {
        throw createInvalidResponseError(`supabaseUrl has invalid protocol: ${config.supabaseUrl}`)
      }
      if (!config.apiUrl.startsWith('http://') && !config.apiUrl.startsWith('https://')) {
        throw createInvalidResponseError(`apiUrl has invalid protocol: ${config.apiUrl}`)
      }

      // Update store with successful result
      store.config = config
      store.isLoading = false
      store.error = null
      store.fetchedAt = Date.now()
      store.attempts = 0 // Reset attempts on success
      store.usingFallback = false

      // Log successful configuration load using centralized logging
      logConfigurationSource(
        'Runtime Config Store',
        config.source as any,
        {
          gotrueUrl: config.gotrueUrl,
          supabaseUrl: config.supabaseUrl,
          apiUrl: config.apiUrl,
        },
        config.environment as any,
        {
          hasAnonKey: !!config.anonKey,
          timestamp: config.timestamp,
          fetchAttempts: store.attempts,
        }
      )

      notifyListeners()
      return config
    } catch (error) {
      // Convert to ConfigError for consistent error handling
      const configError = analyzeConfigError(error)

      // Update store with error
      store.isLoading = false
      store.error = configError

      // Log the error with enhanced context and troubleshooting
      logConfigurationError('Runtime Config Store', configError, {
        fetchAttempts: store.attempts,
        maxRetries: MAX_RETRY_ATTEMPTS,
        timeout: FETCH_TIMEOUT,
        url: '/api/runtime-config',
      })

      // Retry logic
      if (store.attempts < MAX_RETRY_ATTEMPTS) {
        console.log(
          `[Runtime Config Store] Will retry (${store.attempts}/${MAX_RETRY_ATTEMPTS})`
        )
        // Clear ongoing fetch to allow retry
        ongoingFetch = null
        notifyListeners()
        
        // Wait a bit before retry (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, store.attempts - 1), 5000)
        await new Promise((resolve) => setTimeout(resolve, delay))
        
        // Retry
        return fetchRuntimeConfig()
      }

      // Mark as using fallback after all retries exhausted
      store.usingFallback = true
      console.warn('[Runtime Config Store] ⚠ All retry attempts exhausted')
      console.warn('[Runtime Config Store] Application will use build-time configuration as fallback')
      console.warn('[Runtime Config Store] This may cause issues if build-time URLs are incorrect for this environment')

      notifyListeners()
      throw configError
    } finally {
      // Clear ongoing fetch promise
      ongoingFetch = null
    }
  })()

  return ongoingFetch
}

/**
 * Get cached runtime configuration or fetch if not available
 * 
 * This function:
 * - Returns cached config if available and not stale
 * - Fetches new config if not cached or stale
 * - Returns null if fetch is in progress (check isLoading)
 * 
 * @returns RuntimeConfig if available, null otherwise
 */
export function getRuntimeConfig(): RuntimeConfig | null {
  return store.config
}

/**
 * Get the current store state
 * 
 * @returns Current RuntimeConfigStore state
 */
export function getRuntimeConfigStore(): RuntimeConfigStore {
  return { ...store }
}

/**
 * Check if cached configuration is stale
 * 
 * Configuration is considered stale if:
 * - It hasn't been fetched yet
 * - It was fetched more than 5 minutes ago
 * 
 * @returns true if configuration is stale, false otherwise
 */
export function isConfigStale(): boolean {
  if (!store.fetchedAt) {
    return true
  }

  const age = Date.now() - store.fetchedAt
  return age > STALENESS_THRESHOLD
}

/**
 * Force refresh runtime configuration
 * 
 * This will:
 * - Clear the current cache
 * - Fetch fresh configuration from the server
 * - Update all subscribers
 * 
 * @returns Promise resolving to fresh RuntimeConfig
 */
export async function refreshRuntimeConfig(): Promise<RuntimeConfig> {
  console.log('[Runtime Config Store] 🔄 Forcing configuration refresh')
  console.log('[Runtime Config Store] Clearing cached configuration')
  
  // Clear cache
  store.config = null
  store.fetchedAt = null
  store.attempts = 0
  
  // Fetch fresh config
  console.log('[Runtime Config Store] Fetching fresh configuration from API')
  return fetchRuntimeConfig()
}

/**
 * Get or fetch runtime configuration
 * 
 * This is the main function to use for getting configuration.
 * It will:
 * - Return cached config if available and not stale
 * - Fetch new config if not cached or stale
 * - Handle concurrent requests gracefully
 * 
 * @returns Promise resolving to RuntimeConfig
 */
export async function getOrFetchRuntimeConfig(): Promise<RuntimeConfig> {
  // If we have a valid, non-stale config, return it
  if (store.config && !isConfigStale()) {
    const age = store.fetchedAt ? Math.floor((Date.now() - store.fetchedAt) / 1000) : 0
    console.log('[Runtime Config Store] ✓ Using cached configuration')
    console.log(`[Runtime Config Store] Cache age: ${age} seconds`)
    console.log('[Runtime Config Store] Source:', store.config.source)
    return store.config
  }

  // If config is stale, log it
  if (store.config && isConfigStale()) {
    const age = store.fetchedAt ? Math.floor((Date.now() - store.fetchedAt) / 1000) : 0
    console.log('[Runtime Config Store] ⚠ Cached configuration is stale')
    console.log(`[Runtime Config Store] Cache age: ${age} seconds (threshold: ${STALENESS_THRESHOLD / 1000}s)`)
    console.log('[Runtime Config Store] Fetching fresh configuration')
  }

  // Fetch new config
  return fetchRuntimeConfig()
}

/**
 * Reset the configuration store
 * 
 * This is primarily for testing purposes.
 * Clears all state and cancels ongoing requests.
 */
export function resetRuntimeConfigStore(): void {
  store = {
    config: null,
    isLoading: false,
    error: null,
    fetchedAt: null,
    attempts: 0,
    usingFallback: false,
  }
  ongoingFetch = null
  listeners.clear()
  console.log('[Runtime Config Store] Store reset')
}

/**
 * Check if configuration is currently loading
 * 
 * @returns true if a fetch is in progress
 */
export function isConfigLoading(): boolean {
  return store.isLoading
}

/**
 * Get the last error that occurred during fetch
 * 
 * @returns ConfigError object or null if no error
 */
export function getConfigError(): ConfigError | null {
  return store.error
}

/**
 * Check if the application is using fallback configuration
 * 
 * @returns true if using build-time fallback configuration
 */
export function isUsingFallback(): boolean {
  return store.usingFallback
}
