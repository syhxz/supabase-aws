/**
 * GoTrue Configuration Module
 * 
 * Provides centralized URL resolution for the GoTrue authentication service.
 * Supports multiple environment configurations with fallback logic.
 */

// Import environment detection for environment-specific logging
import { detectEnvironment } from './environment-detection'
// Import logging utilities
import { logConfigurationSource } from './configuration-logging'

export interface GoTrueConfig {
  /** The resolved GoTrue URL */
  url: string
  /** How the URL was determined */
  source: 'runtime' | 'explicit' | 'derived-public' | 'derived' | 'default'
  /** Network type for server-side vs client-side usage */
  networkType?: 'internal' | 'external'
  /** Whether the URL has been validated */
  validated?: boolean
}

/**
 * Server-side specific GoTrue configuration
 */
export interface ServerSideGoTrueConfig extends GoTrueConfig {
  /** Internal network address for container communication */
  internalUrl: string
  /** External address for browser access */
  externalUrl: string
}

/**
 * Enhanced container environment detection
 */
function isRunningInContainer(): boolean {
  // Check multiple Docker indicators
  return !!(
    process.env.HOSTNAME === '::' ||
    process.env.DOCKER_CONTAINER === 'true' ||
    process.env.KUBERNETES_SERVICE_HOST || // Kubernetes
    process.env.CONTAINER === 'true' ||
    // Check for Docker-specific files (server-side only)
    (typeof window === 'undefined' && (
      process.env.NODE_ENV === 'production' || // In our setup, production runs in Docker
      process.env.SUPABASE_INTERNAL_HOST // Explicit internal host indicator
    ))
  )
}

/**
 * Get server-side appropriate GoTrue URL (internal network address)
 */
function getServerSideGoTrueUrl(): string {
  const isContainer = isRunningInContainer()
  const isServerSide = typeof window === 'undefined'
  
  if (isContainer && isServerSide) {
    // Use internal service name for container-to-container communication
    return 'http://kong:8000/auth/v1'
  }
  
  // Check for explicit server-side configuration first
  const explicitUrl = process.env.NEXT_PUBLIC_GOTRUE_URL
  if (explicitUrl) {
    return explicitUrl
  }
  
  // Check for derived URLs from Supabase base URLs
  const publicUrl = process.env.SUPABASE_PUBLIC_URL || process.env.SUPABASE_URL
  if (publicUrl) {
    const derived = deriveGoTrueUrl(publicUrl)
    if (derived) {
      return derived
    }
  }
  
  // Default for local development server-side
  return 'http://localhost:8000/auth/v1'
}

/**
 * Get client-side appropriate GoTrue URL (external address)
 */
function getClientSideGoTrueUrl(): string {
  // Check for explicit client-side configuration first
  const explicitUrl = process.env.NEXT_PUBLIC_GOTRUE_URL
  if (explicitUrl) {
    return explicitUrl
  }
  
  // Check for derived URLs from Supabase base URLs
  const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_PUBLIC_URL
  if (publicUrl) {
    const derived = deriveGoTrueUrl(publicUrl)
    if (derived) {
      return derived
    }
  }
  
  // Fallback to localhost for development
  return 'http://localhost:8000/auth/v1'
}

/**
 * Default GoTrue URL based on environment context
 */
function getDefaultGoTrueUrl(): string {
  const isServerSide = typeof window === 'undefined'
  
  if (isServerSide) {
    return getServerSideGoTrueUrl()
  } else {
    return getClientSideGoTrueUrl()
  }
}

// Note: DEFAULT_GOTRUE_URL is now dynamically determined by getDefaultGoTrueUrl()

/**
 * Validates that a URL is properly formatted and uses an allowed scheme
 * Enhanced for Requirements 3.4, 4.2: Production URL validation
 * 
 * @param url - The URL to validate
 * @param options - Validation options
 * @returns true if the URL is valid, false otherwise
 */
export function validateGoTrueUrl(
  url: string | undefined, 
  options: { 
    allowLocalhost?: boolean
    logValidation?: boolean
    context?: string 
  } = {}
): boolean {
  const { allowLocalhost = true, logValidation = false, context = 'URL validation' } = options
  
  if (!url || typeof url !== 'string' || url.trim() === '') {
    if (logValidation) {
      console.warn(`[GoTrue Config] ${context}: URL is empty or invalid type`)
    }
    return false
  }

  try {
    const parsed = new URL(url)
    
    // Only allow http and https schemes to prevent SSRF attacks
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      if (logValidation) {
        console.warn(`[GoTrue Config] ${context}: Invalid protocol "${parsed.protocol}" in URL: ${url}`)
        console.warn(`[GoTrue Config] ${context}: Only http: and https: protocols are allowed`)
      }
      return false
    }
    
    // Enhanced validation for production environments (Requirements 3.4, 4.2)
    const envInfo = detectEnvironment()
    const isLocalhostUrl = parsed.hostname === 'localhost' || 
                          parsed.hostname === '127.0.0.1' || 
                          parsed.hostname === '::1'
    
    if (!allowLocalhost && isLocalhostUrl) {
      if (logValidation) {
        console.error(`[GoTrue Config] ${context}: Localhost URL rejected: ${url}`)
        console.error(`[GoTrue Config] ${context}: Localhost URLs are not allowed in this context`)
      }
      return false
    }
    
    // Production environment validation (Requirements 3.4, 4.2)
    // Only reject localhost URLs in production if explicitly disallowed
    if (!allowLocalhost && envInfo.isProduction && isLocalhostUrl) {
      if (logValidation) {
        console.error(`[GoTrue Config] ${context}: ❌ CRITICAL: Localhost URL in production environment!`)
        console.error(`[GoTrue Config] ${context}: URL: ${url}`)
        console.error(`[GoTrue Config] ${context}: Production environments must use external URLs`)
        console.error(`[GoTrue Config] ${context}: Recommended fixes:`)
        console.error(`[GoTrue Config] ${context}:   - Set NEXT_PUBLIC_GOTRUE_URL to your production GoTrue URL`)
        console.error(`[GoTrue Config] ${context}:   - Example: https://your-project.supabase.co/auth/v1`)
        console.error(`[GoTrue Config] ${context}:   - Or set SUPABASE_PUBLIC_URL to your production Supabase URL`)
        console.error(`[GoTrue Config] ${context}:   - Example: https://your-project.supabase.co`)
      }
      return false
    }
    
    // Log warning for localhost URLs in production (even if allowed)
    if (allowLocalhost && envInfo.isProduction && isLocalhostUrl && logValidation) {
      console.warn(`[GoTrue Config] ${context}: ⚠️  Localhost URL in production environment`)
      console.warn(`[GoTrue Config] ${context}: URL: ${url}`)
      console.warn(`[GoTrue Config] ${context}: This may cause connectivity issues in production`)
    }
    
    if (logValidation) {
      // URL validation passed: ${url}
      if (isLocalhostUrl) {
        // Localhost URL accepted (development context)
      } else {
        // External URL detected (production-ready)
      }
    }
    
    return true
  } catch (error) {
    if (logValidation) {
      console.warn(`[GoTrue Config] ${context}: URL parsing failed: ${url}`)
      console.warn(`[GoTrue Config] ${context}: Error: ${error instanceof Error ? error.message : String(error)}`)
      console.warn(`[GoTrue Config] ${context}: Ensure URL is properly formatted (e.g., https://example.com/auth/v1)`)
    }
    return false
  }
}

/**
 * Derives a GoTrue URL from a Supabase base URL by appending '/auth/v1'
 * 
 * @param baseUrl - The Supabase base URL
 * @returns The derived GoTrue URL, or null if derivation fails
 */
function deriveGoTrueUrl(baseUrl: string | undefined): string | null {
  if (!baseUrl || typeof baseUrl !== 'string' || baseUrl.trim() === '') {
    return null
  }

  try {
    // Remove trailing slash if present
    const cleanUrl = baseUrl.replace(/\/$/, '')
    const derived = `${cleanUrl}/auth/v1`
    
    // Validate the derived URL
    if (validateGoTrueUrl(derived)) {
      return derived
    }
    return null
  } catch {
    return null
  }
}

/**
 * Logs URL resolution information for debugging with environment-specific context
 * Enhanced for Requirements 3.5, 4.1, 4.2: Comprehensive resolution logging and failure debugging
 * 
 * @param config - The resolved GoTrue configuration
 * @param resolutionDetails - Additional details about the resolution process
 */
function logUrlResolution(
  config: GoTrueConfig, 
  resolutionDetails?: {
    attemptedSources?: string[]
    failedSources?: Array<{ source: string; reason: string; value?: string }>
    buildTimeContext?: boolean
    runtimeConfigAttempted?: boolean
    runtimeConfigFailed?: boolean
  }
): void {
  const sourceDescriptions = {
    runtime: 'runtime configuration API',
    explicit: 'NEXT_PUBLIC_GOTRUE_URL environment variable',
    'derived-public': 'SUPABASE_PUBLIC_URL environment variable',
    derived: 'SUPABASE_URL environment variable',
    default: 'development default',
  }

  // Detect environment for context-aware logging
  let envInfo = detectEnvironment()
  
  // Override environment detection if using localhost URLs
  if (config.url.includes('localhost') || config.url.includes('127.0.0.1')) {
    envInfo = {
      environment: 'development',
      isProduction: false,
      isDevelopment: true,
      isStaging: false,
      detectionMethod: 'url-pattern',
      context: 'Forced to development due to localhost URL'
    }
  }

  // URL Resolution Process Complete
  // Resolution timestamp: new Date().toISOString()
  // Execution context: typeof window === 'undefined' ? 'server-side' : 'client-side'
  // Container environment: isRunningInContainer() ? 'detected' : 'not detected'
  // Build-time context: resolutionDetails?.buildTimeContext ? 'YES' : 'NO'
  
  // Environment variable inspection
  // Environment Variable Status:
  const envVars = {
    NEXT_PUBLIC_GOTRUE_URL: process.env.NEXT_PUBLIC_GOTRUE_URL,
    SUPABASE_PUBLIC_URL: process.env.SUPABASE_PUBLIC_URL,
    SUPABASE_URL: process.env.SUPABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    ENVIRONMENT: process.env.NEXT_PUBLIC_ENVIRONMENT || process.env.ENVIRONMENT
  }
  
  Object.entries(envVars).forEach(([key, value]) => {
    if (value) {
      // Mask sensitive URLs but show structure
      const maskedValue = key.includes('URL') ? 
        value.replace(/\/\/[^\/]+/, '//***') : value
      // ${key}: SET (${maskedValue})
    } else {
      // ${key}: NOT SET
    }
  })
  
  // Resolution priority chain analysis
  // 1. NEXT_PUBLIC_GOTRUE_URL (explicit):
  if (process.env.NEXT_PUBLIC_GOTRUE_URL) {
    const isValid = validateGoTrueUrl(process.env.NEXT_PUBLIC_GOTRUE_URL, { allowLocalhost: !envInfo.isProduction })
    // Status: FOUND - ${isValid ? 'VALID' : 'INVALID'}
    if (!isValid) {
      // Issue: URL validation failed
      // Value: ${process.env.NEXT_PUBLIC_GOTRUE_URL}
    }
  } else {
    // Status: NOT SET
  }
  
  // 2. Runtime configuration:
  if (resolutionDetails?.runtimeConfigAttempted) {
    if (resolutionDetails.runtimeConfigFailed) {
      // Status: ATTEMPTED BUT FAILED
      // Reason: API call failed or returned invalid data
    } else {
      // Status: AVAILABLE
    }
  } else {
    // Status: SKIPPED (server-side or explicit URL found)
  }
  
  // 3. SUPABASE_PUBLIC_URL + /auth/v1:
  if (process.env.SUPABASE_PUBLIC_URL) {
    const derived = deriveGoTrueUrl(process.env.SUPABASE_PUBLIC_URL)
    // Status: AVAILABLE - ${derived ? 'VALID' : 'INVALID'}
    if (!derived) {
      // Issue: URL derivation failed
      // Value: ${process.env.SUPABASE_PUBLIC_URL}
    }
  } else {
    // Status: NOT SET
  }
  
  // 4. SUPABASE_URL + /auth/v1:
  if (process.env.SUPABASE_URL) {
    const derived = deriveGoTrueUrl(process.env.SUPABASE_URL)
    // Status: AVAILABLE - ${derived ? 'VALID' : 'INVALID'}
    if (!derived) {
      // Issue: URL derivation failed
      // Value: ${process.env.SUPABASE_URL}
    }
  } else {
    // Status: NOT SET
  }
  
  // 5. Environment defaults: ALWAYS AVAILABLE
  // SELECTED SOURCE: ${config.source.toUpperCase()}
  
  // Log failed sources for debugging (Requirements 4.1, 4.2)
  if (resolutionDetails?.failedSources && resolutionDetails.failedSources.length > 0) {
    console.warn('[GoTrue Config] ⚠️  Failed Resolution Attempts:')
    resolutionDetails.failedSources.forEach(({ source, reason, value }) => {
      console.warn(`[GoTrue Config]   ${source}: ${reason}`)
      if (value) {
        console.warn(`[GoTrue Config]     Value: ${value}`)
      }
    })
  }

  // Network transformation details
  if (config.networkType) {
    // Network Configuration:
    // Network type: config.networkType
    // Final URL: config.url
    
    if (typeof window === 'undefined' && isRunningInContainer()) {
      // Server-side container detected
      // Internal networking required: YES
      
      if (config.url.includes('kong:8000')) {
        // Using internal container address
      } else if (config.url.includes('localhost') || config.url.includes('127.0.0.1')) {
        console.warn('Using localhost address in container')
        console.warn('This may cause connection issues between containers')
        console.warn('Consider using internal service names (e.g., kong:8000)')
      }
    } else {
      // Client-side or non-container environment
      // External networking: YES
    }
  }
  
  // Production environment warnings (Requirements 3.4, 4.2)
  if (envInfo.isProduction) {
    if (config.url.includes('localhost') || config.url.includes('127.0.0.1')) {
      console.error('CRITICAL: Production environment using localhost URL!')
      console.error('This will cause authentication failures!')
      console.error('URL:', config.url)
      console.error('Source:', sourceDescriptions[config.source])
    } else {
      // Production environment with external URL
    }
  }
  
  // Use centralized logging for configuration source
  logConfigurationSource(
    'GoTrue Config',
    config.source as any,
    { gotrueUrl: config.url },
    envInfo.environment,
    {
      detectionMethod: envInfo.detectionMethod,
      detectionContext: envInfo.context,
      sourceDescription: sourceDescriptions[config.source],
      networkType: config.networkType,
      validated: config.validated,
      isServerSide: typeof window === 'undefined',
      isContainer: isRunningInContainer(),
      resolutionTimestamp: new Date().toISOString(),
      priorityChainUsed: config.source,
      buildTimeContext: resolutionDetails?.buildTimeContext,
      failedSources: resolutionDetails?.failedSources,
    }
  )
}

/**
 * Validates environment configuration and logs warnings for missing or invalid values
 * Enhanced for Requirements 3.4, 3.5, 4.1, 4.2, 4.4, 4.5: Comprehensive validation with detailed guidance
 * 
 * @returns An object containing validation results and any warning messages
 */
export function validateEnvironmentConfiguration(): {
  isValid: boolean
  warnings: string[]
  suggestions: string[]
  criticalErrors: string[]
  debugInfo: Record<string, any>
} {
  const warnings: string[] = []
  const suggestions: string[] = []
  const criticalErrors: string[] = []
  let isValid = true

  const explicitUrl = process.env.NEXT_PUBLIC_GOTRUE_URL
  const publicUrl = process.env.SUPABASE_PUBLIC_URL
  const internalUrl = process.env.SUPABASE_URL
  const nodeEnv = process.env.NODE_ENV
  const environment = process.env.NEXT_PUBLIC_ENVIRONMENT || process.env.ENVIRONMENT
  
  // Enhanced debugging information (Requirements 3.5, 4.2)
  const debugInfo = {
    timestamp: new Date().toISOString(),
    executionContext: typeof window === 'undefined' ? 'server-side' : 'client-side',
    containerEnvironment: isRunningInContainer(),
    environmentVariables: {
      NEXT_PUBLIC_GOTRUE_URL: explicitUrl ? '✓ SET' : '✗ NOT SET',
      SUPABASE_PUBLIC_URL: publicUrl ? '✓ SET' : '✗ NOT SET', 
      SUPABASE_URL: internalUrl ? '✓ SET' : '✗ NOT SET',
      NODE_ENV: nodeEnv || 'NOT SET',
      ENVIRONMENT: environment || 'NOT SET'
    },
    detectedEnvironment: detectEnvironment()
  }

  // Environment Configuration Validation
  // Validation timestamp: debugInfo.timestamp
  // Execution context: debugInfo.executionContext
  // Container environment: debugInfo.containerEnvironment ? 'detected' : 'not detected'
  // Environment detection result: debugInfo.detectedEnvironment.environment
  // Detection method: debugInfo.detectedEnvironment.detectionMethod
  
  // Environment Variables Status:
  Object.entries(debugInfo.environmentVariables).forEach(([key, status]) => {
    // ${key}: ${status}
  })

  // Enhanced validation with detailed error reporting (Requirements 3.4, 4.2)
  
  // Check if explicit URL is set but invalid
  if (explicitUrl) {
    const isValidExplicit = validateGoTrueUrl(explicitUrl, { 
      logValidation: true, 
      context: 'NEXT_PUBLIC_GOTRUE_URL validation',
      allowLocalhost: !debugInfo.detectedEnvironment.isProduction 
    })
    
    if (!isValidExplicit) {
      criticalErrors.push(
        `NEXT_PUBLIC_GOTRUE_URL is set but invalid: "${explicitUrl}"`
      )
      suggestions.push(
        'Fix NEXT_PUBLIC_GOTRUE_URL format:',
        '  ✓ Correct: https://your-project.supabase.co/auth/v1',
        '  ✗ Incorrect: localhost:8000/auth/v1 (in production)',
        '  ✗ Incorrect: ftp://example.com/auth/v1 (invalid protocol)',
        '  ✗ Incorrect: not-a-url (invalid format)'
      )
      isValid = false
    } else if (debugInfo.detectedEnvironment.isProduction && (explicitUrl.includes('localhost') || explicitUrl.includes('127.0.0.1'))) {
      // Production with localhost URL (Requirements 3.4, 4.2)
      criticalErrors.push(
        `❌ CRITICAL: Production environment with localhost GoTrue URL: "${explicitUrl}"`
      )
      suggestions.push(
        'Production environment requires external URLs:',
        '  - Replace localhost with your production domain',
        '  - Example: https://your-project.supabase.co/auth/v1',
        '  - Or use your custom domain if configured'
      )
      isValid = false
    }
  }

  // Check if no configuration is provided (Requirements 4.1, 4.4)
  if (!explicitUrl && !publicUrl && !internalUrl) {
    const fallbackUrl = getDefaultGoTrueUrl()
    
    if (debugInfo.detectedEnvironment.isProduction) {
      criticalErrors.push(
        `❌ CRITICAL: No GoTrue URL configuration in production environment!`
      )
      criticalErrors.push(
        `Will fall back to development default: ${fallbackUrl}`
      )
      suggestions.push(
        'Production deployment requires explicit URL configuration:',
        '  RECOMMENDED: Set NEXT_PUBLIC_GOTRUE_URL',
        '    Example: NEXT_PUBLIC_GOTRUE_URL=https://your-project.supabase.co/auth/v1',
        '  ALTERNATIVE: Set SUPABASE_PUBLIC_URL',
        '    Example: SUPABASE_PUBLIC_URL=https://your-project.supabase.co',
        '  ALTERNATIVE: Set SUPABASE_URL',
        '    Example: SUPABASE_URL=https://your-project.supabase.co'
      )
    } else {
      warnings.push(
        `No GoTrue URL configuration found. Using development default: ${fallbackUrl}`
      )
      suggestions.push(
        'For non-development environments, consider setting:',
        '  - NEXT_PUBLIC_GOTRUE_URL: Direct GoTrue URL (recommended)',
        '  - SUPABASE_PUBLIC_URL: Base Supabase URL',
        '  - SUPABASE_URL: Internal Supabase URL'
      )
    }
    isValid = false
  }

  // Enhanced validation for derived URLs (Requirements 3.4, 4.5)
  if (publicUrl) {
    const derivedPublic = deriveGoTrueUrl(publicUrl)
    if (!derivedPublic) {
      warnings.push(
        `SUPABASE_PUBLIC_URL is set but cannot be used to derive GoTrue URL: "${publicUrl}"`
      )
      suggestions.push(
        'Fix SUPABASE_PUBLIC_URL format:',
        '  ✓ Correct: https://your-project.supabase.co',
        '  ✗ Incorrect: https://your-project.supabase.co/auth/v1 (remove /auth/v1)',
        '  ✗ Incorrect: your-project.supabase.co (missing protocol)',
        '  ✗ Incorrect: localhost (in production)'
      )
      isValid = false
    } else {
      // Validate derived URL for production (Requirements 3.4)
      const isDerivedValid = validateGoTrueUrl(derivedPublic, {
        logValidation: true,
        context: 'Derived from SUPABASE_PUBLIC_URL',
        allowLocalhost: !debugInfo.detectedEnvironment.isProduction
      })
      
      if (!isDerivedValid) {
        criticalErrors.push(
          `Derived GoTrue URL from SUPABASE_PUBLIC_URL is invalid: "${derivedPublic}"`
        )
        isValid = false
      }
    }
  }

  if (internalUrl && !publicUrl && !explicitUrl) {
    const derivedInternal = deriveGoTrueUrl(internalUrl)
    if (!derivedInternal) {
      warnings.push(
        `SUPABASE_URL is set but cannot be used to derive GoTrue URL: "${internalUrl}"`
      )
      suggestions.push(
        'Fix SUPABASE_URL format:',
        '  ✓ Correct: https://your-project.supabase.co',
        '  ✓ Correct: http://kong:8000 (for container environments)',
        '  ✗ Incorrect: your-project.supabase.co (missing protocol)'
      )
      isValid = false
    } else {
      // Validate derived internal URL
      const isDerivedValid = validateGoTrueUrl(derivedInternal, {
        logValidation: true,
        context: 'Derived from SUPABASE_URL',
        allowLocalhost: !debugInfo.detectedEnvironment.isProduction
      })
      
      if (!isDerivedValid) {
        criticalErrors.push(
          `Derived GoTrue URL from SUPABASE_URL is invalid: "${derivedInternal}"`
        )
        isValid = false
      }
    }
  }

  // Enhanced production environment warnings (Requirements 4.2, 4.3)
  if (!explicitUrl && (publicUrl || internalUrl)) {
    if (debugInfo.detectedEnvironment.isProduction) {
      warnings.push(
        `Production environment using derived URL instead of explicit NEXT_PUBLIC_GOTRUE_URL`
      )
      suggestions.push(
        'Production best practices:',
        '  - Set explicit NEXT_PUBLIC_GOTRUE_URL for better reliability',
        '  - Derived URLs may fail if base URL changes',
        '  - Explicit URLs provide better error messages'
      )
    }
  }

  // Environment mismatch detection (Requirements 4.3)
  if (debugInfo.detectedEnvironment.environment === 'development' && 
      (nodeEnv === 'production' || environment === 'production')) {
    warnings.push(
      `Environment variable mismatch detected: NODE_ENV/ENVIRONMENT suggests production but URLs suggest development`
    )
    suggestions.push(
      'Check environment configuration:',
      '  - Ensure production URLs are set for production deployments',
      '  - Verify ENVIRONMENT and NODE_ENV variables are correct',
      '  - Check that localhost URLs are not used in production'
    )
  }

  return { isValid, warnings, suggestions, criticalErrors, debugInfo }
}

/**
 * Logs configuration warnings, suggestions, and critical errors
 * Enhanced for Requirements 4.1, 4.2, 4.4, 4.5: Comprehensive error reporting
 * 
 * @param warnings - Array of warning messages
 * @param suggestions - Array of suggestion messages
 * @param criticalErrors - Array of critical error messages
 * @param debugInfo - Debug information object
 */
function logConfigurationWarnings(
  warnings: string[], 
  suggestions: string[], 
  criticalErrors: string[] = [],
  debugInfo?: Record<string, any>
): void {
  // Log critical errors first (Requirements 4.2)
  if (criticalErrors.length > 0) {
    console.error('[GoTrue Config] ❌ CRITICAL CONFIGURATION ERRORS:')
    criticalErrors.forEach((error) => {
      console.error(`[GoTrue Config]   ${error}`)
    })
    console.error('[GoTrue Config] These errors will cause authentication to fail!')
  }

  // Log warnings (Requirements 4.1, 4.3)
  if (warnings.length > 0) {
    console.warn('[GoTrue Config] ⚠️  Configuration warnings:')
    warnings.forEach((warning) => {
      console.warn(`[GoTrue Config]   ${warning}`)
    })
  }

  // Log suggestions with enhanced formatting (Requirements 4.4, 4.5)
  if (suggestions.length > 0) {
    console.warn('[GoTrue Config] 💡 Recommendations:')
    suggestions.forEach((suggestion) => {
      console.warn(`[GoTrue Config]   ${suggestion}`)
    })
  }

  // Debug information
  if (debugInfo) {
    // Debug Information:
    // Validation timestamp: debugInfo.timestamp
    // Execution context: debugInfo.executionContext
    // Container environment: debugInfo.containerEnvironment
    // Detected environment: debugInfo.detectedEnvironment?.environment
    // Detection method: debugInfo.detectedEnvironment?.detectionMethod
  }

  // Add separator for readability when there are issues
  if (criticalErrors.length > 0 || warnings.length > 0) {
    // Separator for readability
  }
}

// Import runtime configuration store
import { getOrFetchRuntimeConfig, getRuntimeConfig, isUsingFallback } from './runtime-config'

/**
 * Gets runtime configuration from the centralized store
 * 
 * @returns Promise resolving to the runtime configuration as GoTrueConfig
 */
async function getRuntimeGoTrueConfig(): Promise<GoTrueConfig | null> {
  // Only fetch in browser environment
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const runtimeConfig = await getOrFetchRuntimeConfig()
    
    if (runtimeConfig.gotrueUrl && validateGoTrueUrl(runtimeConfig.gotrueUrl)) {
      return {
        url: runtimeConfig.gotrueUrl,
        source: 'runtime',
      }
    }

    return null
  } catch (error) {
    console.warn('[GoTrue Config] Error fetching runtime config:', error)
    return null
  }
}

/**
 * Gets cached runtime configuration without fetching
 * 
 * @returns The cached runtime configuration as GoTrueConfig, or null if not available
 */
function getCachedRuntimeGoTrueConfig(): GoTrueConfig | null {
  // Only available in browser environment
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const runtimeConfig = getRuntimeConfig()
    
    if (runtimeConfig?.gotrueUrl && validateGoTrueUrl(runtimeConfig.gotrueUrl)) {
      return {
        url: runtimeConfig.gotrueUrl,
        source: 'runtime',
      }
    }

    return null
  } catch (error) {
    console.warn('[GoTrue Config] Error getting cached runtime config:', error)
    return null
  }
}

/**
 * Resolves the GoTrue URL based on environment variables with corrected priority logic
 * 
 * CORRECTED Priority order (per requirements 1.3, 2.5):
 * 1. NEXT_PUBLIC_GOTRUE_URL (explicit configuration - HIGHEST PRIORITY)
 * 2. Cached runtime configuration (if available in browser)
 * 3. SUPABASE_PUBLIC_URL + '/auth/v1' (derived from public URL)
 * 4. SUPABASE_URL + '/auth/v1' (derived from internal URL)
 * 5. Environment-appropriate default (container-aware)
 * 
 * Note: This is the synchronous version. For full runtime config support,
 * use getGoTrueUrlAsync() which will fetch runtime config if not cached.
 * 
 * @returns The resolved GoTrue configuration with URL and source
 */
export function getGoTrueUrl(): GoTrueConfig {
  const isServerSide = typeof window === 'undefined'
  const isContainer = isRunningInContainer()
  const failedSources: Array<{ source: string; reason: string; value?: string }> = []

  // Enhanced environment configuration validation (Requirements 3.4, 3.5, 4.1, 4.2)
  const validation = validateEnvironmentConfiguration()
  if (!validation.isValid || validation.criticalErrors.length > 0) {
    logConfigurationWarnings(
      validation.warnings, 
      validation.suggestions, 
      validation.criticalErrors,
      validation.debugInfo
    )
  }

  // Priority 1: NEXT_PUBLIC_GOTRUE_URL (HIGHEST PRIORITY per requirements)
  const explicitUrl = process.env.NEXT_PUBLIC_GOTRUE_URL
  if (explicitUrl) {
    const envInfo = detectEnvironment()
    const isValidExplicit = validateGoTrueUrl(explicitUrl, { 
      allowLocalhost: !envInfo.isProduction,
      logValidation: true,
      context: 'Explicit NEXT_PUBLIC_GOTRUE_URL validation'
    })
    
    if (isValidExplicit) {
      // For server-side in containers, check if we need to transform external URL to internal
      let resolvedUrl = explicitUrl
      let networkType: 'internal' | 'external' = 'external'
      
      if (isServerSide && isContainer) {
        // Transform external localhost URLs to internal container addresses
        if (explicitUrl.includes('localhost:8000') || explicitUrl.includes('127.0.0.1:8000')) {
          resolvedUrl = explicitUrl.replace(/localhost:8000|127\.0\.0\.1:8000/, 'kong:8000')
          networkType = 'internal'
          // Transformed external URL to internal for container: explicitUrl -> resolvedUrl
        }
      }
      
      const config: GoTrueConfig = {
        url: resolvedUrl,
        source: 'explicit',
        networkType,
        validated: true,
      }
      
      logUrlResolution(config, {
        buildTimeContext: isServerSide,
        attemptedSources: ['explicit'],
        failedSources
      })
      return config
    } else {
      failedSources.push({
        source: 'NEXT_PUBLIC_GOTRUE_URL',
        reason: 'URL validation failed',
        value: explicitUrl
      })
    }
  } else {
    failedSources.push({
      source: 'NEXT_PUBLIC_GOTRUE_URL',
      reason: 'Environment variable not set'
    })
  }

  // Priority 2: Check for cached runtime configuration (browser only, after explicit check)
  const cachedRuntimeConfig = getCachedRuntimeGoTrueConfig()
  if (cachedRuntimeConfig) {
    logUrlResolution(cachedRuntimeConfig, {
      buildTimeContext: isServerSide,
      attemptedSources: ['explicit', 'runtime-cached'],
      failedSources
    })
    return cachedRuntimeConfig
  } else if (typeof window !== 'undefined') {
    failedSources.push({
      source: 'Runtime configuration (cached)',
      reason: 'No cached runtime configuration available'
    })
  }

  // Priority 3: Derive from SUPABASE_PUBLIC_URL
  const publicUrl = process.env.SUPABASE_PUBLIC_URL
  if (publicUrl) {
    const derivedPublicUrl = deriveGoTrueUrl(publicUrl)
    if (derivedPublicUrl) {
      const envInfo = detectEnvironment()
      const isValidDerived = validateGoTrueUrl(derivedPublicUrl, {
        allowLocalhost: !envInfo.isProduction,
        logValidation: true,
        context: 'Derived from SUPABASE_PUBLIC_URL validation'
      })
      
      if (isValidDerived) {
        // Apply server-side container transformation if needed
        let resolvedUrl = derivedPublicUrl
        let networkType: 'internal' | 'external' = 'external'
        
        if (isServerSide && isContainer) {
          if (derivedPublicUrl.includes('localhost:8000') || derivedPublicUrl.includes('127.0.0.1:8000')) {
            resolvedUrl = derivedPublicUrl.replace(/localhost:8000|127\.0\.0\.1:8000/, 'kong:8000')
            networkType = 'internal'
            // Transformed derived public URL to internal for container: derivedPublicUrl -> resolvedUrl
          }
        }
        
        const config: GoTrueConfig = {
          url: resolvedUrl,
          source: 'derived-public',
          networkType,
          validated: true,
        }
        
        logUrlResolution(config, {
          buildTimeContext: isServerSide,
          attemptedSources: ['explicit', 'runtime-cached', 'derived-public'],
          failedSources
        })
        return config
      } else {
        failedSources.push({
          source: 'SUPABASE_PUBLIC_URL (derived)',
          reason: 'Derived URL validation failed',
          value: derivedPublicUrl
        })
      }
    } else {
      failedSources.push({
        source: 'SUPABASE_PUBLIC_URL',
        reason: 'URL derivation failed (invalid format)',
        value: publicUrl
      })
    }
  } else {
    failedSources.push({
      source: 'SUPABASE_PUBLIC_URL',
      reason: 'Environment variable not set'
    })
  }

  // Priority 4: Derive from SUPABASE_URL
  const internalUrl = process.env.SUPABASE_URL
  if (internalUrl) {
    const derivedUrl = deriveGoTrueUrl(internalUrl)
    if (derivedUrl) {
      const envInfo = detectEnvironment()
      const isValidDerived = validateGoTrueUrl(derivedUrl, {
        allowLocalhost: !envInfo.isProduction,
        logValidation: true,
        context: 'Derived from SUPABASE_URL validation'
      })
      
      if (isValidDerived) {
        // Apply server-side container transformation if needed
        let resolvedUrl = derivedUrl
        let networkType: 'internal' | 'external' = 'external'
        
        if (isServerSide && isContainer) {
          if (derivedUrl.includes('localhost:8000') || derivedUrl.includes('127.0.0.1:8000')) {
            resolvedUrl = derivedUrl.replace(/localhost:8000|127\.0\.0\.1:8000/, 'kong:8000')
            networkType = 'internal'
            // Transformed derived internal URL to internal for container: derivedUrl -> resolvedUrl
          }
        }
        
        const config: GoTrueConfig = {
          url: resolvedUrl,
          source: 'derived',
          networkType,
          validated: true,
        }
        
        logUrlResolution(config, {
          buildTimeContext: isServerSide,
          attemptedSources: ['explicit', 'runtime-cached', 'derived-public', 'derived'],
          failedSources
        })
        return config
      } else {
        failedSources.push({
          source: 'SUPABASE_URL (derived)',
          reason: 'Derived URL validation failed',
          value: derivedUrl
        })
      }
    } else {
      failedSources.push({
        source: 'SUPABASE_URL',
        reason: 'URL derivation failed (invalid format)',
        value: internalUrl
      })
    }
  } else {
    failedSources.push({
      source: 'SUPABASE_URL',
      reason: 'Environment variable not set'
    })
  }

  // Priority 5: Environment-appropriate default
  const defaultUrl = getDefaultGoTrueUrl()
  const config: GoTrueConfig = {
    url: defaultUrl,
    source: 'default',
    networkType: isServerSide && isContainer ? 'internal' : 'external',
    validated: true,
  }
  
  // Enhanced fallback logging with debugging information (Requirements 4.1, 4.2)
  const envInfo = detectEnvironment()
  console.warn('[GoTrue Config] ⚠️  Falling back to environment-appropriate defaults')
  console.warn('[GoTrue Config] All configured sources failed or were unavailable')
  console.warn('[GoTrue Config] Using fallback URL:', defaultUrl)
  
  if (envInfo.isProduction) {
    console.error('[GoTrue Config] ❌ CRITICAL: Using development defaults in production!')
    console.error('[GoTrue Config] This will cause all authentication requests to fail!')
    console.error('[GoTrue Config] Resolution failed because:')
    failedSources.forEach(({ source, reason, value }) => {
      console.error(`[GoTrue Config]   - ${source}: ${reason}`)
      if (value) {
        console.error(`[GoTrue Config]     Value: ${value}`)
      }
    })
    console.error('[GoTrue Config] Required action: Set one of these environment variables:')
    console.error('[GoTrue Config]   - NEXT_PUBLIC_GOTRUE_URL=https://your-project.supabase.co/auth/v1')
    console.error('[GoTrue Config]   - SUPABASE_PUBLIC_URL=https://your-project.supabase.co')
    console.error('[GoTrue Config]   - SUPABASE_URL=https://your-project.supabase.co')
  } else if (envInfo.isDevelopment) {
    // Development environment: localhost defaults are expected
    // This is normal for local development
    if (isContainer) {
      // Container environment detected: using internal service names
    }
    if (failedSources.length > 0) {
      // Note: Some configuration sources failed but this is OK in development:
      failedSources.forEach(({ source, reason }) => {
        // ${source}: ${reason}
      })
    }
  } else if (envInfo.isStaging) {
    console.warn('[GoTrue Config] ⚠️  Staging environment using localhost defaults')
    console.warn('[GoTrue Config] This is likely a misconfiguration')
    console.warn('[GoTrue Config] Failed sources:')
    failedSources.forEach(({ source, reason, value }) => {
      console.warn(`[GoTrue Config]   - ${source}: ${reason}`)
      if (value) {
        console.warn(`[GoTrue Config]     Value: ${value}`)
      }
    })
    console.warn('[GoTrue Config] Set appropriate staging environment variables')
  }
  
  logUrlResolution(config, {
    buildTimeContext: isServerSide,
    attemptedSources: ['explicit', 'runtime-cached', 'derived-public', 'derived', 'default'],
    failedSources
  })
  return config
}

/**
 * Asynchronous version with corrected priority order
 * 
 * CORRECTED Priority order (per requirements 1.3, 2.5):
 * 1. NEXT_PUBLIC_GOTRUE_URL (explicit configuration - HIGHEST PRIORITY)
 * 2. Runtime configuration from /api/runtime-config (fetched if not cached, browser only)
 * 3. SUPABASE_PUBLIC_URL + '/auth/v1' (derived from public URL)
 * 4. SUPABASE_URL + '/auth/v1' (derived from internal URL)
 * 5. Environment-appropriate default (container-aware)
 * 
 * @returns Promise resolving to the GoTrue configuration
 */
export async function getGoTrueUrlAsync(): Promise<GoTrueConfig> {
  const failedSources: Array<{ source: string; reason: string; value?: string }> = []
  let runtimeConfigAttempted = false
  let runtimeConfigFailed = false

  // Priority 1: NEXT_PUBLIC_GOTRUE_URL (HIGHEST PRIORITY per requirements)
  const explicitUrl = process.env.NEXT_PUBLIC_GOTRUE_URL
  if (explicitUrl) {
    const envInfo = detectEnvironment()
    const isValidExplicit = validateGoTrueUrl(explicitUrl, { 
      allowLocalhost: !envInfo.isProduction,
      logValidation: true,
      context: 'Async explicit NEXT_PUBLIC_GOTRUE_URL validation'
    })
    
    if (isValidExplicit) {
      // Using explicit NEXT_PUBLIC_GOTRUE_URL (highest priority)
      const config = getGoTrueUrl() // This will return the explicit config with proper transformations
      
      logUrlResolution(config, {
        buildTimeContext: typeof window === 'undefined',
        attemptedSources: ['explicit'],
        failedSources,
        runtimeConfigAttempted: false
      })
      return config
    } else {
      failedSources.push({
        source: 'NEXT_PUBLIC_GOTRUE_URL',
        reason: 'URL validation failed',
        value: explicitUrl
      })
    }
  } else {
    failedSources.push({
      source: 'NEXT_PUBLIC_GOTRUE_URL',
      reason: 'Environment variable not set'
    })
  }

  // Priority 2: Try to get runtime config (only in browser, after explicit check)
  if (typeof window !== 'undefined') {
    runtimeConfigAttempted = true
    try {
      const runtimeConfig = await getRuntimeGoTrueConfig()
      if (runtimeConfig) {
        // Successfully loaded runtime configuration from API
        
        logUrlResolution(runtimeConfig, {
          buildTimeContext: false,
          attemptedSources: ['explicit', 'runtime'],
          failedSources,
          runtimeConfigAttempted: true,
          runtimeConfigFailed: false
        })
        return runtimeConfig
      } else {
        runtimeConfigFailed = true
        failedSources.push({
          source: 'Runtime configuration API',
          reason: 'API returned null or invalid data'
        })
      }
    } catch (error) {
      runtimeConfigFailed = true
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      failedSources.push({
        source: 'Runtime configuration API',
        reason: `API call failed: ${errorMessage}`
      })
      
      // Check if we're using fallback configuration
      const usingFallback = isUsingFallback()
      if (usingFallback) {
        console.warn('[GoTrue Config] ⚠️  Runtime config unavailable after retries')
        console.warn('[GoTrue Config] Error:', errorMessage)
        console.warn('[GoTrue Config] Falling back to build-time configuration')
      } else {
        console.warn('[GoTrue Config] ⚠️  Failed to fetch runtime config')
        console.warn('[GoTrue Config] Error:', errorMessage)
        console.warn('[GoTrue Config] Falling back to build-time configuration')
      }
    }
  }

  // Priority 3-5: Fall back to build-time configuration
  // Using build-time configuration as fallback
  const fallbackConfig = getGoTrueUrl()
  
  // Enhanced fallback warnings with environment context and debugging (Requirements 4.1, 4.2)
  const envInfo = detectEnvironment()
  
  if (fallbackConfig.source === 'default') {
    console.warn('[GoTrue Config] ⚠️  Fallback chain reached development defaults')
    console.warn('[GoTrue Config] Fallback chain: explicit → runtime → derived-public → derived → DEFAULT')
    
    if (envInfo.isProduction) {
      console.error('[GoTrue Config] ❌ CRITICAL: Using development defaults in production!')
      console.error('[GoTrue Config] This will cause API requests to fail.')
      console.error('[GoTrue Config] Async fallback occurred because:')
      
      if (runtimeConfigAttempted) {
        console.error('[GoTrue Config]   1. Runtime config API failed or returned invalid data')
      } else {
        console.error('[GoTrue Config]   1. Runtime config not attempted (server-side context)')
      }
      
      failedSources.forEach(({ source, reason, value }, index) => {
        console.error(`[GoTrue Config]   ${index + 2}. ${source}: ${reason}`)
        if (value) {
          console.error(`[GoTrue Config]      Value: ${value}`)
        }
      })
      
      console.error('[GoTrue Config] Action required: Set one of these environment variables:')
      console.error('[GoTrue Config]   - NEXT_PUBLIC_GOTRUE_URL=https://your-project.supabase.co/auth/v1 (recommended)')
      console.error('[GoTrue Config]   - SUPABASE_PUBLIC_URL=https://your-project.supabase.co')
      console.error('[GoTrue Config]   - SUPABASE_URL=https://your-project.supabase.co')
    } else if (envInfo.isDevelopment) {
      // Development environment: Using localhost defaults
      // This is expected for local development
      // Ensure your local Supabase stack is running on fallbackConfig.url
      
      if (runtimeConfigFailed) {
        // Note: Runtime config failed but this is OK in development
        // Local development typically uses build-time configuration
      }
    } else if (envInfo.isStaging) {
      console.warn('[GoTrue Config] ⚠️  Staging environment using localhost defaults')
      console.warn('[GoTrue Config] This is likely a misconfiguration')
      console.warn('[GoTrue Config] Failed sources:')
      failedSources.forEach(({ source, reason, value }) => {
        console.warn(`[GoTrue Config]   - ${source}: ${reason}`)
        if (value) {
          console.warn(`[GoTrue Config]     Value: ${value}`)
        }
      })
      console.warn('[GoTrue Config] Set appropriate staging environment variables')
    }
  } else if (fallbackConfig.source === 'derived' || fallbackConfig.source === 'derived-public') {
    console.warn('[GoTrue Config] ⚠️  Using derived URL as fallback')
    console.warn('[GoTrue Config] Runtime config was unavailable, using build-time derived URL')
    
    if (envInfo.isProduction) {
      console.warn('[GoTrue Config] ⚠️  Production environment using derived URL')
      console.warn('[GoTrue Config] Consider setting explicit NEXT_PUBLIC_GOTRUE_URL for production')
      
      if (runtimeConfigFailed) {
        console.warn('[GoTrue Config] Runtime config failure in production may indicate infrastructure issues')
      }
    }
  } else if (fallbackConfig.source === 'explicit') {
    // Using explicit build-time configuration as fallback
    
    if (envInfo.isProduction) {
      // Production environment with explicit configuration
      
      if (runtimeConfigFailed) {
        // Runtime config failed but explicit configuration is available
        // This is acceptable but may indicate API issues
      }
    }
  }
  
  // Enhanced logging for async fallback (Requirements 3.5, 4.1, 4.2)
  logUrlResolution(fallbackConfig, {
    buildTimeContext: typeof window === 'undefined',
    attemptedSources: runtimeConfigAttempted ? 
      ['explicit', 'runtime', 'derived-public', 'derived', 'default'] :
      ['explicit', 'derived-public', 'derived', 'default'],
    failedSources,
    runtimeConfigAttempted,
    runtimeConfigFailed
  })
  
  return fallbackConfig
}

/**
 * Get server-side specific GoTrue configuration with both internal and external URLs
 * 
 * This function is designed for server-side APIs that need to:
 * - Use internal network addresses for server-to-server communication
 * - Provide external addresses for client-side usage
 * 
 * @returns ServerSideGoTrueConfig with both internal and external URLs
 */
export function getServerSideGoTrueConfig(): ServerSideGoTrueConfig {
  const baseConfig = getGoTrueUrl()
  const isContainer = isRunningInContainer()
  
  let internalUrl = baseConfig.url
  let externalUrl = baseConfig.url
  
  // If we're in a container and have an external URL, create internal version
  if (isContainer && (baseConfig.url.includes('localhost') || baseConfig.url.includes('127.0.0.1'))) {
    // Transform localhost URLs to internal container addresses for server-side use
    internalUrl = baseConfig.url.replace(/localhost:8000|127\.0\.0\.1:8000/, 'kong:8000')
    externalUrl = baseConfig.url // Keep original for client-side
    
    // Server-side container config:
    // Internal URL (server-to-server): internalUrl
    // External URL (client access): externalUrl
  } else if (isContainer && baseConfig.url.includes('kong:8000')) {
    // We already have internal URL, derive external
    internalUrl = baseConfig.url // Keep internal
    externalUrl = baseConfig.url.replace('kong:8000', 'localhost:8000') // Create external
    
    // Server-side container config:
    // Internal URL (server-to-server): internalUrl
    // External URL (client access): externalUrl
  }
  
  return {
    ...baseConfig,
    internalUrl,
    externalUrl,
    networkType: 'internal', // Server-side should use internal by default
  }
}

/**
 * Get GoTrue URL appropriate for the current execution context
 * 
 * This is a convenience function that automatically selects:
 * - Internal URL for server-side in containers
 * - External URL for client-side or non-container environments
 * 
 * @returns GoTrue URL appropriate for current context
 */
export function getContextAwareGoTrueUrl(): string {
  const isServerSide = typeof window === 'undefined'
  const isContainer = isRunningInContainer()
  
  if (isServerSide && isContainer) {
    // Server-side in container: use internal URL
    const serverConfig = getServerSideGoTrueConfig()
    // Using internal URL for server-side container communication: serverConfig.internalUrl
    return serverConfig.internalUrl
  } else {
    // Client-side or non-container: use standard URL
    const config = getGoTrueUrl()
    // Using standard URL for client-side or non-container: config.url
    return config.url
  }
}
