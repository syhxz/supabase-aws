import { AuthClient, navigatorLock, User } from '@supabase/auth-js'
import { getGoTrueUrl, getGoTrueUrlAsync } from './gotrue-config'
import { subscribeToConfigChanges } from './runtime-config'

export const STORAGE_KEY = process.env.NEXT_PUBLIC_STORAGE_KEY || 'supabase.dashboard.auth.token'
export const AUTH_DEBUG_KEY =
  process.env.NEXT_PUBLIC_AUTH_DEBUG_KEY || 'supabase.dashboard.auth.debug'
export const AUTH_DEBUG_PERSISTED_KEY =
  process.env.NEXT_PUBLIC_AUTH_DEBUG_PERSISTED_KEY || 'supabase.dashboard.auth.debug.persist'
export const AUTH_NAVIGATOR_LOCK_DISABLED_KEY =
  process.env.NEXT_PUBLIC_AUTH_NAVIGATOR_LOCK_KEY ||
  'supabase.dashboard.auth.navigatorLock.disabled'

/**
 * Catches errors thrown when accessing localStorage. Safari with certain
 * security settings throws when localStorage is accessed.
 */
function safeGetLocalStorage(key: string) {
  try {
    return globalThis?.localStorage?.getItem(key)
  } catch {
    return null
  }
}

const debug =
  process.env.NEXT_PUBLIC_IS_PLATFORM === 'true' && safeGetLocalStorage(AUTH_DEBUG_KEY) === 'true'

const persistedDebug =
  process.env.NEXT_PUBLIC_IS_PLATFORM === 'true' &&
  safeGetLocalStorage(AUTH_DEBUG_PERSISTED_KEY) === 'true'

const shouldEnableNavigatorLock =
  process.env.NEXT_PUBLIC_IS_PLATFORM === 'true' &&
  !(safeGetLocalStorage(AUTH_NAVIGATOR_LOCK_DISABLED_KEY) === 'true')

const shouldDetectSessionInUrl = process.env.NEXT_PUBLIC_AUTH_DETECT_SESSION_IN_URL
  ? process.env.NEXT_PUBLIC_AUTH_DETECT_SESSION_IN_URL === 'true'
  : true

const navigatorLockEnabled = !!(shouldEnableNavigatorLock && globalThis?.navigator?.locks)

if (shouldEnableNavigatorLock && !globalThis?.navigator?.locks) {
  console.warn('This browser does not support the Navigator Locks API. Please update it.')
}

const tabId = Math.random().toString(16).substring(2)

let dbHandle = new Promise<IDBDatabase | null>((accept, _) => {
  if (!persistedDebug) {
    accept(null)
    return
  }

  const request = indexedDB.open('auth-debug-log', 1)

  request.onupgradeneeded = (event: any) => {
    const db = event?.target?.result

    if (!db) {
      return
    }

    db.createObjectStore('events', { autoIncrement: true })
  }

  request.onsuccess = (event: any) => {
    console.log('Opened persisted auth debug log IndexedDB database', tabId)
    accept(event.target.result)
  }

  request.onerror = (event: any) => {
    console.error('Failed to open persisted auth debug log IndexedDB database', event)
    accept(null)
  }
})

const logIndexedDB = (message: string, ...args: any[]) => {
  console.log(message, ...args)

  const copyArgs = structuredClone(args)

  copyArgs.forEach((value) => {
    if (typeof value === 'object' && value !== null) {
      delete value.user
      delete value.access_token
      delete value.token_type
      delete value.provider_token
    }
  })
  ;(async () => {
    try {
      const db = await dbHandle

      if (!db) {
        return
      }

      const tx = db.transaction(['events'], 'readwrite')
      tx.onerror = (event: any) => {
        console.error('Failed to write to persisted auth debug log IndexedDB database', event)
        dbHandle = Promise.resolve(null)
      }

      const events = tx.objectStore('events')

      events.add({
        m: message.replace(/^GoTrueClient@/i, ''),
        a: copyArgs,
        l: window.location.pathname,
        t: tabId,
      })
    } catch (e: any) {
      console.error('Failed to log to persisted auth debug log IndexedDB database', e)
      dbHandle = Promise.resolve(null)
    }
  })()
}

/**
 * Reference to a function that captures exceptions for debugging purposes to be sent to Sentry.
 */
let captureException: ((e: any) => any) | null = null

export function setCaptureException(fn: typeof captureException) {
  captureException = fn
}

async function debuggableNavigatorLock<R>(
  name: string,
  acquireTimeout: number,
  fn: () => Promise<R>
): Promise<R> {
  let stackException: any

  try {
    throw new Error('Lock is being held for over 10s here')
  } catch (e: any) {
    stackException = e
  }

  const debugTimeout = setTimeout(() => {
    ;(async () => {
      const bc = new BroadcastChannel('who-is-holding-the-lock')
      try {
        bc.postMessage({})
      } finally {
        bc.close()
      }

      console.error(
        `Waited for over 10s to acquire an Auth client lock, will steal the lock to unblock`,
        await navigator.locks.query(),
        stackException
      )

      // quickly steal the lock and release it so that others can acquire it,
      // while leaving the code that was holding it to continue running
      navigator.locks
        .request(
          name,
          {
            steal: true,
          },
          async () => {
            await new Promise((accept) => {
              setTimeout(accept, 0)
            })

            console.error('Lock was stolen and now released', stackException)
          }
        )
        .catch((e: any) => {
          if (captureException) {
            captureException(e)
          }
        })
    })()
  }, 10000)

  try {
    return await navigatorLock(name, acquireTimeout, async () => {
      clearTimeout(debugTimeout)

      const bc = new BroadcastChannel('who-is-holding-the-lock')
      bc.addEventListener('message', () => {
        console.error('Lock is held here', stackException)

        if (captureException) {
          captureException(stackException)
        }
      })

      try {
        return await fn()
      } finally {
        bc.close()
      }
    })
  } finally {
    clearTimeout(debugTimeout)
  }
}

// Import logging utilities
import {
  logFailedRequest,
  logSuccessfulRequest,
  type RequestLogInfo,
} from './configuration-logging'

// Wrap fetch with 30-second timeout to prevent indefinite hangs and add comprehensive URL logging
const fetchWithTimeout: typeof fetch = async (input, init) => {
  const startTime = Date.now()
  const timeoutSignal = AbortSignal.timeout(30000) // 30 seconds
  const existingSignal = init?.signal
  const combinedSignal = existingSignal
    ? AbortSignal.any([existingSignal, timeoutSignal])
    : timeoutSignal

  // Extract URL for logging
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
  const method = init?.method || 'GET'

  // Making request to: ${url}

  try {
    const response = await fetch(input, {
      ...init,
      signal: combinedSignal,
    })

    const responseTime = Date.now() - startTime

    // Create request log info
    const requestInfo: RequestLogInfo = {
      url,
      method,
      status: response.status,
      responseTime,
      success: response.ok,
      context: {
        timeout: 30000,
        hasAuth: !!(init?.headers && 
          (typeof init.headers === 'object' && 'Authorization' in init.headers)),
      },
    }

    if (response.ok) {
      logSuccessfulRequest('GoTrue Client', requestInfo)
    } else {
      // Request failed: ${url} (${response.status})
      requestInfo.error = `HTTP ${response.status}: ${response.statusText}`
      
      // Provide specific troubleshooting based on status code
      const troubleshootingSteps = []
      if (response.status === 401) {
        troubleshootingSteps.push('Authentication failed - check API key configuration')
        troubleshootingSteps.push('Verify NEXT_PUBLIC_SUPABASE_ANON_KEY is set correctly')
        troubleshootingSteps.push('Check if the API key has the required permissions')
      } else if (response.status === 403) {
        troubleshootingSteps.push('Access forbidden - check API key permissions')
        troubleshootingSteps.push('Verify the API key is valid for this environment')
      } else if (response.status === 404) {
        troubleshootingSteps.push('GoTrue endpoint not found - check URL configuration')
        troubleshootingSteps.push('Verify GoTrue service is running and accessible')
        troubleshootingSteps.push('Check if the correct GoTrue URL is configured')
      } else if (response.status >= 500) {
        troubleshootingSteps.push('GoTrue service error - check server logs')
        troubleshootingSteps.push('Verify GoTrue service is healthy and has resources')
        troubleshootingSteps.push('Check database connectivity if applicable')
      }
      
      logFailedRequest('GoTrue Client', requestInfo, troubleshootingSteps)
    }

    return response
  } catch (error) {
    const responseTime = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    // Create request log info for failed request
    const requestInfo: RequestLogInfo = {
      url,
      method,
      responseTime,
      success: false,
      error: errorMessage,
      context: {
        timeout: 30000,
        errorType: error instanceof Error ? error.name : typeof error,
        isTimeout: error instanceof Error && error.name === 'AbortError',
      },
    }
    
    // Provide specific troubleshooting based on error type
    const troubleshootingSteps = []
    if (error instanceof Error && error.name === 'AbortError') {
      troubleshootingSteps.push('Request timed out after 30 seconds')
      troubleshootingSteps.push('GoTrue service may be slow to respond')
      troubleshootingSteps.push('Check network connectivity to GoTrue service')
      troubleshootingSteps.push('Verify GoTrue service is running and healthy')
    } else if (errorMessage.includes('fetch')) {
      troubleshootingSteps.push('Network error connecting to GoTrue service')
      troubleshootingSteps.push('Check network connectivity')
      troubleshootingSteps.push('Verify GoTrue URL is correct and accessible')
      troubleshootingSteps.push('Check for firewall or proxy blocking the connection')
    } else {
      troubleshootingSteps.push('Unexpected error during GoTrue request')
      troubleshootingSteps.push('Check browser console for additional details')
      troubleshootingSteps.push('Verify GoTrue service configuration')
    }
    
    // Request error: ${url} - ${errorMessage}
    logFailedRequest('GoTrue Client', requestInfo, troubleshootingSteps)
    throw error
  }
}

// Get API key from environment
// In self-hosted mode, this should be the anon key from your Supabase setup
const GOTRUE_API_KEY = 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_GOTRUE_API_KEY ||
  ''

/**
 * Initialize GoTrue client with enhanced runtime configuration support.
 * 
 * This function creates the GoTrue client with the best available configuration:
 * 1. Uses cached runtime config if available (browser environment)
 * 2. Falls back to build-time configuration
 * 3. Provides mechanisms to update URL when runtime config becomes available
 */
function initializeGoTrueClient() {
  // Resolve GoTrue URL using configuration module
  // This will use cached runtime config if available, otherwise build-time config
  const gotrueConfig = getGoTrueUrl()

  // Initialization configuration
  // Initializing with URL: ${gotrueConfig.url} (source: ${gotrueConfig.source})

  if (GOTRUE_API_KEY) {
    // API key configured
  } else {
    console.warn('No API key found. Set NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY environment variable.')
  }

  // Configuration source validation
  if (gotrueConfig.source === 'runtime') {
    // Using runtime configuration (optimal)
  } else if (gotrueConfig.source === 'explicit') {
    // Using explicit build-time configuration
  } else if (gotrueConfig.source === 'derived-public' || gotrueConfig.source === 'derived') {
    // Using derived build-time configuration
    // Consider setting explicit NEXT_PUBLIC_GOTRUE_URL for production
  } else if (gotrueConfig.source === 'default') {
    console.warn('Using development defaults')
    if (typeof window !== 'undefined') {
      console.warn('Runtime config will be fetched and client updated automatically')
    }
  }

  return new AuthClient({
    url: gotrueConfig.url,
    storageKey: STORAGE_KEY,
    // Add API key headers for self-hosted GoTrue and Kong gateway
    // Kong requires both 'apikey' and 'Authorization: Bearer' headers
    headers: GOTRUE_API_KEY ? {
      apikey: GOTRUE_API_KEY,
      Authorization: `Bearer ${GOTRUE_API_KEY}`,
    } : undefined,
    // Only enable these features in browser environment
    detectSessionInUrl: typeof window !== 'undefined' && shouldDetectSessionInUrl,
    debug: typeof window !== 'undefined' && debug ? (persistedDebug ? logIndexedDB : true) : false,
    lock: typeof window !== 'undefined' && navigatorLockEnabled ? debuggableNavigatorLock : undefined,
    fetch: fetchWithTimeout,
    // Disable auto-refresh in SSR environment
    autoRefreshToken: typeof window !== 'undefined',
    persistSession: typeof window !== 'undefined',
    ...('localStorage' in globalThis
      ? { storage: globalThis.localStorage, userStorage: globalThis.localStorage }
      : null),
  })
}

// Initialize the GoTrue client
export const gotrueClient = initializeGoTrueClient()

/**
 * Updates the GoTrue client URL when runtime configuration changes.
 * This allows the client to use production URLs without rebuilding.
 * 
 * @param force - Force update even if URL hasn't changed (useful for initialization)
 * @returns Promise that resolves to true if URL was updated, false otherwise
 */
export async function updateGoTrueClientUrl(force: boolean = false): Promise<boolean> {
  // Only update in browser environment
  if (typeof window === 'undefined') {
    // Skipping URL update in server environment
    return false
  }

  try {
    // Fetching latest runtime configuration...
    const config = await getGoTrueUrlAsync()
    
    // Validate the new URL
    if (!config.url || typeof config.url !== 'string') {
      console.error('Invalid URL received from runtime config:', config.url)
      return false
    }

    // Check if URL has changed or force update requested
    const currentUrl = (gotrueClient as any).url
    const urlChanged = config.url !== currentUrl
    
    if (urlChanged || force) {
      // ${force ? 'Force updating' : 'Updating'} URL from ${currentUrl} to ${config.url} (source: ${config.source})
      
      // Validate URL format before updating
      try {
        new URL(config.url)
      } catch (urlError) {
        console.error('Invalid URL format:', config.url, urlError)
        return false
      }
      
      // Update the client URL
      // Note: AuthClient doesn't have a public method to update URL,
      // but we can access the internal property
      ;(gotrueClient as any).url = config.url
      
      // URL updated successfully
      // New URL: ${config.url}
      // Configuration source: ${config.source}
      
      // Environment-specific information
      if (config.source === 'runtime') {
        // Now using runtime configuration (optimal)
      } else if (config.source === 'default') {
        console.warn('Still using development defaults')
        console.warn('Ensure production environment variables are set')
      }
      
      return true
    } else {
      // URL unchanged, no update needed
      // Current URL: ${currentUrl} (source: ${config.source})
      return false
    }
  } catch (error) {
    console.error('Failed to update URL from runtime config:', error)
    
    // Provide helpful error context
    if (error instanceof Error) {
      if (error.message.includes('fetch')) {
        console.error('Network error - runtime config API may be unavailable')
        console.error('Client will continue using current URL:', (gotrueClient as any).url)
      } else if (error.message.includes('timeout')) {
        console.error('Timeout error - runtime config API is slow to respond')
        console.error('Client will continue using current URL:', (gotrueClient as any).url)
      } else {
        console.error('Unexpected error during URL update')
      }
    }
    
    return false
  }
}

/**
 * Initialize runtime configuration monitoring and automatic URL updates.
 * This ensures the GoTrue client always uses the latest available configuration.
 */
function initializeRuntimeConfigMonitoring(): void {
  // Only monitor in browser environment
  if (typeof window === 'undefined') {
    return
  }

  // Setting up runtime configuration monitoring

  // Subscribe to runtime config changes to update the client URL automatically
  const unsubscribe = subscribeToConfigChanges((config, error) => {
    if (error) {
      console.warn('Runtime config error:', error)
      return
    }

    if (config?.gotrueUrl) {
      const currentUrl = (gotrueClient as any).url
      
      if (config.gotrueUrl !== currentUrl) {
        // Runtime config changed, updating URL from ${currentUrl} to ${config.gotrueUrl}
        
        // Validate URL before updating
        try {
          new URL(config.gotrueUrl)
          ;(gotrueClient as any).url = config.gotrueUrl
          // URL updated from runtime config change
        } catch (urlError) {
          console.error('Invalid URL from runtime config:', config.gotrueUrl, urlError)
        }
      }
    }
  })

  // Attempt to update URL with runtime config on initialization
  // This handles cases where runtime config becomes available after client creation
  setTimeout(async () => {
    try {
      const updated = await updateGoTrueClientUrl()
      if (updated) {
        // Successfully updated to runtime configuration on initialization
      }
    } catch (error) {
      console.warn('Could not update to runtime config on initialization:', error)
    }
  }, 100) // Small delay to allow runtime config to be fetched

  // Store unsubscribe function for cleanup if needed
  ;(globalThis as any).__gotrueConfigUnsubscribe = unsubscribe
}

// Initialize runtime configuration monitoring
initializeRuntimeConfigMonitoring()

/**
 * Ensures the GoTrue client is configured with the best available configuration.
 * This function should be called before making authentication requests to ensure
 * the client is using runtime configuration if available.
 * 
 * @returns Promise that resolves when configuration is optimized
 */
export async function ensureOptimalGoTrueConfig(): Promise<void> {
  // Only relevant in browser environment
  if (typeof window === 'undefined') {
    return
  }

  try {
    // Ensuring optimal configuration...
    const updated = await updateGoTrueClientUrl()
    
    if (updated) {
      // Configuration optimized with runtime config
    } else {
      // Already using optimal configuration
    }
  } catch (error) {
    console.warn('Could not optimize configuration:', error)
    console.warn('Continuing with current configuration')
  }
}

/**
 * Gets the current GoTrue configuration being used by the client.
 * Useful for debugging and verification.
 * 
 * @returns Current configuration information
 */
export function getCurrentGoTrueConfig(): {
  url: string
  hasApiKey: boolean
  isInitialized: boolean
} {
  return {
    url: (gotrueClient as any).url,
    hasApiKey: !!GOTRUE_API_KEY,
    isInitialized: true,
  }
}

export type { User }
