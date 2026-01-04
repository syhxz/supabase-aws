/**
 * Configuration Fallback Service
 * 
 * Provides graceful degradation strategies when runtime configuration fails.
 * This service handles:
 * - Fallback to build-time configuration
 * - Cached configuration recovery
 * - Progressive feature degradation
 * - User notification of limitations
 */

import { ConfigError } from 'common/runtime-config-errors'
import { getGoTrueUrl } from 'common/gotrue-config'
import { logConfigurationSource, logConfigurationFallback } from 'common/configuration-logging'

/**
 * Fallback configuration interface
 */
export interface FallbackConfig {
  /** GoTrue authentication service URL */
  gotrueUrl: string
  /** Base Supabase API URL */
  supabaseUrl: string
  /** External API URL (Kong gateway) */
  apiUrl: string
  /** Anonymous API key for authentication */
  anonKey: string
  /** Configuration source */
  source: 'build-time' | 'cached' | 'emergency-defaults'
  /** Environment detection */
  environment: 'development' | 'production' | 'staging'
  /** Limitations of this fallback */
  limitations: string[]
  /** Timestamp when fallback was created */
  timestamp: number
}

/**
 * Fallback strategy result
 */
export interface FallbackResult {
  /** Whether fallback was successful */
  success: boolean
  /** Fallback configuration (if successful) */
  config?: FallbackConfig
  /** Error if fallback failed */
  error?: ConfigError
  /** Strategy that was used */
  strategy: 'build-time' | 'cached' | 'emergency-defaults' | 'none'
  /** User-friendly message about the fallback */
  userMessage: string
  /** Recommendations for the user */
  recommendations: string[]
}

/**
 * Cached configuration storage key
 */
const CACHED_CONFIG_KEY = 'supabase_studio_cached_config'

/**
 * Cache expiration time (24 hours)
 */
const CACHE_EXPIRATION_MS = 24 * 60 * 60 * 1000

/**
 * Safely access localStorage
 */
function safeLocalStorage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

/**
 * Stores configuration in cache for fallback purposes
 */
export function cacheConfiguration(config: {
  gotrueUrl: string
  supabaseUrl: string
  apiUrl: string
  anonKey: string
  source: string
  environment: string
}): void {
  const storage = safeLocalStorage()
  if (!storage) {
    console.warn('[Configuration Fallback] localStorage not available, cannot cache configuration')
    return
  }

  try {
    const cachedConfig = {
      ...config,
      cachedAt: Date.now(),
    }
    
    storage.setItem(CACHED_CONFIG_KEY, JSON.stringify(cachedConfig))
    console.log('[Configuration Fallback] Configuration cached successfully')
  } catch (error) {
    console.warn('[Configuration Fallback] Failed to cache configuration:', error)
  }
}

/**
 * Retrieves cached configuration if available and not expired
 */
function getCachedConfiguration(): FallbackConfig | null {
  const storage = safeLocalStorage()
  if (!storage) {
    return null
  }

  try {
    const cached = storage.getItem(CACHED_CONFIG_KEY)
    if (!cached) {
      return null
    }

    const config = JSON.parse(cached)
    const age = Date.now() - config.cachedAt
    
    if (age > CACHE_EXPIRATION_MS) {
      console.log('[Configuration Fallback] Cached configuration expired, removing')
      storage.removeItem(CACHED_CONFIG_KEY)
      return null
    }

    console.log('[Configuration Fallback] Using cached configuration')
    return {
      gotrueUrl: config.gotrueUrl,
      supabaseUrl: config.supabaseUrl,
      apiUrl: config.apiUrl,
      anonKey: config.anonKey,
      source: 'cached',
      environment: config.environment,
      limitations: [
        'Using cached configuration from previous session',
        'Configuration may be outdated',
        'Some features may not work if URLs have changed',
      ],
      timestamp: Date.now(),
    }
  } catch (error) {
    console.warn('[Configuration Fallback] Failed to parse cached configuration:', error)
    return null
  }
}

/**
 * Gets build-time configuration as fallback
 */
function getBuildTimeConfiguration(): FallbackConfig {
  // Use the existing gotrue-config module to get build-time URLs
  const gotrueConfig = getGoTrueUrl()
  
  // Get other build-time environment variables
  const supabaseUrl = 
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_PUBLIC_URL ||
    process.env.SUPABASE_URL ||
    'http://127.0.0.1:54321'
    
  const apiUrl = 
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.API_EXTERNAL_URL ||
    process.env.SUPABASE_PUBLIC_URL ||
    process.env.SUPABASE_URL ||
    'http://127.0.0.1:8000'
    
  const anonKey = 
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ''

  // Detect environment based on URLs
  let environment: 'development' | 'production' | 'staging' = 'development'
  if (gotrueConfig.url.includes('localhost') || gotrueConfig.url.includes('127.0.0.1')) {
    environment = 'development'
  } else if (process.env.NODE_ENV === 'production') {
    environment = 'production'
  } else {
    environment = 'staging'
  }

  const limitations: string[] = [
    'Using build-time configuration compiled into the application',
  ]

  // Add environment-specific limitations
  if (environment === 'production' && (
    gotrueConfig.url.includes('localhost') || 
    gotrueConfig.url.includes('127.0.0.1')
  )) {
    limitations.push('⚠️ Using localhost URLs in production - this will not work')
    limitations.push('Set SUPABASE_PUBLIC_URL or API_EXTERNAL_URL environment variables')
  }

  if (gotrueConfig.source === 'default') {
    limitations.push('Using development defaults - may not work in production')
  }

  if (!anonKey) {
    limitations.push('No API key configured - authentication may not work')
    limitations.push('Set NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable')
  }

  return {
    gotrueUrl: gotrueConfig.url,
    supabaseUrl,
    apiUrl,
    anonKey,
    source: 'build-time',
    environment,
    limitations,
    timestamp: Date.now(),
  }
}

/**
 * Gets emergency default configuration as last resort
 */
function getEmergencyDefaults(): FallbackConfig {
  return {
    gotrueUrl: 'http://127.0.0.1:54321/auth/v1',
    supabaseUrl: 'http://127.0.0.1:54321',
    apiUrl: 'http://127.0.0.1:8000',
    anonKey: '',
    source: 'emergency-defaults',
    environment: 'development',
    limitations: [
      'Using emergency default configuration',
      'Only works for local development',
      'Will not work in production environments',
      'No API key configured - authentication will not work',
      'Requires local Supabase services to be running',
    ],
    timestamp: Date.now(),
  }
}

/**
 * Attempts to provide fallback configuration when runtime config fails
 */
export function attemptConfigurationFallback(originalError: ConfigError): FallbackResult {
  console.log('[Configuration Fallback] Attempting fallback configuration due to error:', originalError.type)
  
  // Strategy 1: Try cached configuration
  const cachedConfig = getCachedConfiguration()
  if (cachedConfig) {
    console.log('[Configuration Fallback] ✓ Using cached configuration')
    
    logConfigurationFallback(
      'Configuration Fallback Service',
      'cached',
      originalError,
      {
        gotrueUrl: cachedConfig.gotrueUrl,
        supabaseUrl: cachedConfig.supabaseUrl,
        apiUrl: cachedConfig.apiUrl,
      },
      cachedConfig.limitations
    )
    
    return {
      success: true,
      config: cachedConfig,
      strategy: 'cached',
      userMessage: 'Using cached configuration from previous session',
      recommendations: [
        'The application is using cached configuration from a previous session',
        'Try refreshing the page to fetch the latest configuration',
        'If problems persist, check your network connection',
        'Contact support if the issue continues',
      ],
    }
  }

  // Strategy 2: Use build-time configuration
  try {
    const buildTimeConfig = getBuildTimeConfiguration()
    console.log('[Configuration Fallback] ✓ Using build-time configuration')
    
    logConfigurationFallback(
      'Configuration Fallback Service',
      'build-time',
      originalError,
      {
        gotrueUrl: buildTimeConfig.gotrueUrl,
        supabaseUrl: buildTimeConfig.supabaseUrl,
        apiUrl: buildTimeConfig.apiUrl,
      },
      buildTimeConfig.limitations
    )
    
    // Determine user message based on environment and limitations
    let userMessage = 'Using build-time configuration as fallback'
    let recommendations = [
      'The application is using configuration compiled at build time',
      'Some features may be limited until runtime configuration is restored',
    ]
    
    if (buildTimeConfig.environment === 'production' && buildTimeConfig.limitations.some(l => l.includes('localhost'))) {
      userMessage = 'Configuration error detected in production environment'
      recommendations = [
        'The application cannot connect to production services',
        'Contact your system administrator immediately',
        'Verify that environment variables are properly set',
        'Check that SUPABASE_PUBLIC_URL or API_EXTERNAL_URL is configured',
      ]
    } else if (buildTimeConfig.source === 'build-time' && buildTimeConfig.environment !== 'development') {
      recommendations.push('For production deployments, ensure runtime environment variables are set')
      recommendations.push('This fallback may not work correctly in production')
    }
    
    return {
      success: true,
      config: buildTimeConfig,
      strategy: 'build-time',
      userMessage,
      recommendations,
    }
  } catch (buildTimeError) {
    console.error('[Configuration Fallback] Build-time configuration failed:', buildTimeError)
  }

  // Strategy 3: Emergency defaults (last resort)
  const emergencyConfig = getEmergencyDefaults()
  console.warn('[Configuration Fallback] ⚠️ Using emergency defaults as last resort')
  
  logConfigurationFallback(
    'Configuration Fallback Service',
    'emergency-defaults',
    originalError,
    {
      gotrueUrl: emergencyConfig.gotrueUrl,
      supabaseUrl: emergencyConfig.supabaseUrl,
      apiUrl: emergencyConfig.apiUrl,
    },
    emergencyConfig.limitations
  )
  
  return {
    success: true,
    config: emergencyConfig,
    strategy: 'emergency-defaults',
    userMessage: 'Using emergency default configuration',
    recommendations: [
      'The application is using emergency defaults',
      'This will only work for local development',
      'Ensure local Supabase services are running (docker-compose up)',
      'For production, contact your system administrator',
      'Check server logs for configuration errors',
    ],
  }
}

/**
 * Validates that a fallback configuration is usable
 */
export function validateFallbackConfiguration(config: FallbackConfig): {
  isValid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  // Validate URLs
  try {
    new URL(config.gotrueUrl)
  } catch {
    errors.push('Invalid GoTrue URL in fallback configuration')
  }

  try {
    new URL(config.supabaseUrl)
  } catch {
    errors.push('Invalid Supabase URL in fallback configuration')
  }

  try {
    new URL(config.apiUrl)
  } catch {
    errors.push('Invalid API URL in fallback configuration')
  }

  // Check for localhost in production
  if (config.environment === 'production') {
    if (config.gotrueUrl.includes('localhost') || config.gotrueUrl.includes('127.0.0.1')) {
      errors.push('GoTrue URL uses localhost in production environment')
    }
    if (config.apiUrl.includes('localhost') || config.apiUrl.includes('127.0.0.1')) {
      errors.push('API URL uses localhost in production environment')
    }
  }

  // Check for missing API key
  if (!config.anonKey) {
    warnings.push('No API key configured - authentication may not work')
  }

  // Check for emergency defaults
  if (config.source === 'emergency-defaults') {
    warnings.push('Using emergency defaults - limited functionality')
  }

  // Check for cached configuration age
  if (config.source === 'cached') {
    warnings.push('Using cached configuration - may be outdated')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Gets user-friendly explanation of configuration limitations
 */
export function explainConfigurationLimitations(config: FallbackConfig): {
  title: string
  description: string
  impacts: string[]
  actions: string[]
} {
  switch (config.source) {
    case 'cached':
      return {
        title: 'Using Cached Configuration',
        description: 'The application is using configuration saved from a previous session.',
        impacts: [
          'Configuration may be outdated',
          'New environment changes will not be reflected',
          'Some features may not work if URLs have changed',
        ],
        actions: [
          'Refresh the page to try fetching latest configuration',
          'Check network connectivity',
          'Clear browser cache if problems persist',
        ],
      }

    case 'build-time':
      return {
        title: 'Using Build-Time Configuration',
        description: 'The application is using configuration compiled when it was built.',
        impacts: [
          'Cannot adapt to environment changes without rebuild',
          'May use incorrect URLs for current environment',
          'Limited flexibility for deployment',
        ],
        actions: [
          'Check network connectivity to configuration server',
          'Verify environment variables are set correctly',
          'Contact administrator if in production environment',
        ],
      }

    case 'emergency-defaults':
      return {
        title: 'Using Emergency Defaults',
        description: 'The application is using hardcoded default values as a last resort.',
        impacts: [
          'Only works for local development',
          'Will not work in production environments',
          'Authentication may not function',
          'Limited to localhost services only',
        ],
        actions: [
          'Ensure local Supabase services are running',
          'Run: docker-compose up -d',
          'Check that ports 8000 and 54321 are available',
          'For production, contact system administrator immediately',
        ],
      }

    default:
      return {
        title: 'Unknown Configuration Source',
        description: 'The configuration source is not recognized.',
        impacts: ['Unpredictable behavior', 'May not work correctly'],
        actions: ['Contact support for assistance'],
      }
  }
}

/**
 * Clears cached configuration (useful for troubleshooting)
 */
export function clearCachedConfiguration(): boolean {
  const storage = safeLocalStorage()
  if (!storage) {
    return false
  }

  try {
    storage.removeItem(CACHED_CONFIG_KEY)
    console.log('[Configuration Fallback] Cached configuration cleared')
    return true
  } catch (error) {
    console.warn('[Configuration Fallback] Failed to clear cached configuration:', error)
    return false
  }
}