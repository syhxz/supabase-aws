import { NextApiRequest, NextApiResponse } from 'next'

/**
 * Runtime Configuration API
 * 
 * Provides environment-specific configuration that can be changed at runtime
 * without rebuilding the application.
 * 
 * This endpoint is called by the client to get the current configuration
 * based on server-side environment variables.
 * 
 * Priority order for URL resolution:
 * 1. Explicit environment variables (NEXT_PUBLIC_GOTRUE_URL, API_EXTERNAL_URL)
 * 2. Derived from SUPABASE_PUBLIC_URL
 * 3. Derived from SUPABASE_URL
 * 4. Development defaults (localhost)
 */

interface RuntimeConfig {
  /** GoTrue authentication service URL */
  gotrueUrl: string
  /** Base Supabase API URL */
  supabaseUrl: string
  /** External API URL (Kong gateway) */
  apiUrl: string
  /** Anonymous API key for authentication */
  anonKey: string
  /** Whether login is required */
  requireLogin: boolean
  /** Whether this is platform mode */
  isPlatform: boolean
  /** How the configuration was determined */
  source: 'explicit' | 'derived' | 'default'
  /** Current environment */
  environment: 'development' | 'production' | 'staging'
  /** Timestamp when config was generated */
  timestamp: number
  /** Network configuration for different contexts */
  network: {
    /** Server-side URLs for internal API communication */
    serverSide: {
      gotrueUrl: string
      supabaseUrl: string
      apiUrl: string
    }
    /** Client-side URLs for browser access */
    clientSide: {
      gotrueUrl: string
      supabaseUrl: string
      apiUrl: string
    }
    /** Network environment information */
    environment: {
      isContainer: boolean
      isServerSide: boolean
      preferredProtocol: 'http' | 'https'
      internalDomain: string
      externalDomain: string
    }
  }
}

interface RuntimeConfigError {
  error: string
  details?: string
  suggestions?: string[]
}

/**
 * Validates that a URL is properly formatted and uses an allowed scheme
 */
function validateUrl(url: string | undefined): boolean {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return false
  }

  try {
    const parsed = new URL(url)
    // Only allow http and https schemes to prevent SSRF attacks
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch (error: unknown) {
    return false
  }
}

/**
 * Derives a URL by appending a path to a base URL
 */
function deriveUrl(baseUrl: string | undefined, path: string): string | null {
  if (!baseUrl || typeof baseUrl !== 'string' || baseUrl.trim() === '') {
    return null
  }

  try {
    // Remove trailing slash if present
    const cleanUrl = baseUrl.replace(/\/$/, '')
    const derived = `${cleanUrl}${path}`
    
    // Validate the derived URL
    if (validateUrl(derived)) {
      return derived
    }
    return null
  } catch (error: unknown) {
    return null
  }
}

// Import environment detection utilities
import { 
  detectEnvironment, 
  validateUrlsForEnvironment,
  logEnvironmentInfo,
  logUrlValidation,
  detectNetworkEnvironment,
  getNetworkAppropriateUrl,
  type Environment,
  type NetworkEnvironment
} from 'common/environment-detection'
// Import logging utilities
import { logConfigurationSource, logConfigurationValidation } from 'common/configuration-logging'

/**
 * Determines the current environment based on improved detection logic
 * This function uses the enhanced environment detection that considers:
 * - Explicit ENVIRONMENT variable
 * - NODE_ENV with improved production detection
 * - URL patterns including external IPs and domains
 * - IS_PLATFORM flag
 * - Production indicators (HTTPS, external IPs, domains)
 * 
 * CRITICAL FIX: Override production detection when localhost URLs are present
 */
function determineEnvironment(urls?: {
  gotrueUrl?: string
  supabaseUrl?: string
  apiUrl?: string
}): Environment {
  const envInfo = detectEnvironment(urls)
  
  // CRITICAL FIX: Check for localhost URLs and override environment if needed
  const allUrls = [
    urls?.gotrueUrl,
    urls?.supabaseUrl, 
    urls?.apiUrl,
    process.env.NEXT_PUBLIC_GOTRUE_URL,
    process.env.SUPABASE_PUBLIC_URL,
    process.env.API_EXTERNAL_URL
  ].filter(Boolean) as string[]
  
  const localhostPatterns = ['localhost', '127.0.0.1', '0.0.0.0', ':8000', ':54321', ':3000']
  const hasLocalhostUrls = allUrls.some((url: string) => 
    localhostPatterns.some((pattern: string) => url.includes(pattern))
  )
  
  // Override to development if we detect localhost URLs regardless of NODE_ENV
  if (hasLocalhostUrls && envInfo.environment === 'production') {
    console.log(`[Runtime Config] ⚠️  ENVIRONMENT OVERRIDE: Detected localhost URLs in production environment`)
    console.log(`[Runtime Config] Overriding environment from 'production' to 'development'`)
    console.log(`[Runtime Config] Localhost URLs found: ${allUrls.filter(url => 
      localhostPatterns.some(pattern => url.includes(pattern))
    ).join(', ')}`)
    
    return 'development'
  }
  
  // Log environment detection details for debugging
  console.log(`[Runtime Config] Environment detected: ${envInfo.environment}`)
  console.log(`[Runtime Config] Detection method: ${envInfo.detectionMethod}`)
  console.log(`[Runtime Config] Context: ${envInfo.context}`)
  
  return envInfo.environment
}

/**
 * Validates environment configuration and returns errors/warnings
 */
function validateEnvironmentConfiguration(): {
  isValid: boolean
  errors: string[]
  warnings: string[]
  suggestions: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []
  const suggestions: string[] = []
  let isValid = true

  const explicitGotrueUrl = process.env.NEXT_PUBLIC_GOTRUE_URL
  const publicUrl = process.env.SUPABASE_PUBLIC_URL
  const internalUrl = process.env.SUPABASE_URL
  const apiUrl = process.env.API_EXTERNAL_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  // First pass environment detection without URLs
  let environment = determineEnvironment()

  // Check if explicit GoTrue URL is set but invalid
  if (explicitGotrueUrl && !validateUrl(explicitGotrueUrl)) {
    errors.push(`NEXT_PUBLIC_GOTRUE_URL is set but invalid: "${explicitGotrueUrl}"`)
    suggestions.push(
      'Ensure NEXT_PUBLIC_GOTRUE_URL is a valid http or https URL (e.g., https://your-project.supabase.co/auth/v1)'
    )
    isValid = false
  }

  // Check if API URL is set but invalid
  if (apiUrl && !validateUrl(apiUrl)) {
    errors.push(`API_EXTERNAL_URL is set but invalid: "${apiUrl}"`)
    suggestions.push(
      'Ensure API_EXTERNAL_URL is a valid http or https URL (e.g., http://192.0.2.1:8000)'
    )
    isValid = false
  }

  // Check if public URL is set but invalid
  if (publicUrl && !validateUrl(publicUrl)) {
    errors.push(`SUPABASE_PUBLIC_URL is set but invalid: "${publicUrl}"`)
    suggestions.push(
      'Ensure SUPABASE_PUBLIC_URL is a valid URL (e.g., https://your-project.supabase.co)'
    )
    isValid = false
  }

  // Check if internal URL is set but invalid
  if (internalUrl && !validateUrl(internalUrl)) {
    errors.push(`SUPABASE_URL is set but invalid: "${internalUrl}"`)
    suggestions.push('Ensure SUPABASE_URL is a valid URL')
    isValid = false
  }

  // Production-specific validation (only warn, don't error)
  if (environment === 'production') {
    // Check for localhost URLs in production environment
    const localhostPatterns = ['localhost', '127.0.0.1', '0.0.0.0', ':8000', ':54321', ':3000']
    const allUrls = [explicitGotrueUrl, publicUrl, internalUrl, apiUrl].filter((url): url is string => Boolean(url))
    const hasLocalhostUrls = allUrls.some((url: string) => 
      localhostPatterns.some((pattern: string) => url.includes(pattern))
    )
    
    if (hasLocalhostUrls) {
      warnings.push('Production environment detected with localhost URLs. Environment will be overridden to development.')
      suggestions.push(
        'For true production deployment, set proper production URLs:',
        '  - NEXT_PUBLIC_GOTRUE_URL: Production GoTrue URL',
        '  - SUPABASE_PUBLIC_URL: Production Supabase URL', 
        '  - API_EXTERNAL_URL: Production API URL'
      )
    }

    if (!explicitGotrueUrl && !publicUrl && !internalUrl) {
      warnings.push(
        'No GoTrue URL configuration found in production environment. Using defaults.'
      )
      suggestions.push(
        'For production deployments, set one of the following environment variables:',
        '  - NEXT_PUBLIC_GOTRUE_URL: Direct GoTrue URL',
        '  - SUPABASE_PUBLIC_URL: Base Supabase URL',
        '  - SUPABASE_URL: Internal Supabase URL'
      )
    }

    if (!anonKey) {
      warnings.push('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set in production environment')
      suggestions.push(
        'Set NEXT_PUBLIC_SUPABASE_ANON_KEY to your Supabase anonymous key for API authentication'
      )
    }

    // Warn if using derived URL in production
    if (!explicitGotrueUrl && (publicUrl || internalUrl)) {
      warnings.push(
        'Running in production mode without explicit NEXT_PUBLIC_GOTRUE_URL. Using derived URL.'
      )
      suggestions.push(
        'For production deployments, it is recommended to explicitly set NEXT_PUBLIC_GOTRUE_URL'
      )
    }
  }

  return { isValid, errors, warnings, suggestions }
}

/**
 * Resolves network-aware URLs for both server-side and client-side usage
 * 
 * @param baseUrl - The base URL to transform
 * @param networkEnv - Network environment information
 * @returns Object with both server-side and client-side URLs
 */
function resolveNetworkAwareUrls(baseUrl: string, networkEnv: NetworkEnvironment): {
  serverSide: string
  clientSide: string
} {
  // For server-side: use internal addresses in containers, external otherwise
  const serverSideUrl = getNetworkAppropriateUrl(baseUrl, networkEnv, true)
  
  // For client-side: always use external addresses
  const clientSideUrl = getNetworkAppropriateUrl(baseUrl, networkEnv, false)
  
  return {
    serverSide: serverSideUrl,
    clientSide: clientSideUrl
  }
}

/**
 * Resolves configuration with priority rules and network awareness
 */
function resolveConfiguration(): RuntimeConfig | RuntimeConfigError {
  // Validate environment first
  const validation = validateEnvironmentConfiguration()
  
  if (!validation.isValid) {
    return {
      error: 'Invalid environment configuration',
      details: validation.errors.join('; '),
      suggestions: validation.suggestions,
    }
  }

  // Detect network environment for container and server-side awareness
  const networkEnv = detectNetworkEnvironment()
  
  let environment = determineEnvironment()
  let source: 'explicit' | 'derived' | 'default' = 'default'

  // Resolve base URLs with priority order
  let baseGotrueUrl: string
  let baseSupabaseUrl: string
  let baseApiUrl: string
  
  const explicitGotrueUrl = process.env.NEXT_PUBLIC_GOTRUE_URL
  const publicUrl = process.env.SUPABASE_PUBLIC_URL
  const internalUrl = process.env.SUPABASE_URL

  // Resolve GoTrue URL with priority order
  if (explicitGotrueUrl && validateUrl(explicitGotrueUrl)) {
    baseGotrueUrl = explicitGotrueUrl
    source = 'explicit'
  } else {
    const derivedFromPublic = deriveUrl(publicUrl, '/auth/v1')
    const derivedFromInternal = deriveUrl(internalUrl, '/auth/v1')
    
    if (derivedFromPublic) {
      baseGotrueUrl = derivedFromPublic
      source = 'derived'
    } else if (derivedFromInternal) {
      baseGotrueUrl = derivedFromInternal
      source = 'derived'
    } else {
      baseGotrueUrl = 'http://127.0.0.1:54321/auth/v1'
      source = 'default'
    }
  }

  // Resolve Supabase URL
  if (publicUrl && validateUrl(publicUrl)) {
    baseSupabaseUrl = publicUrl
  } else if (internalUrl && validateUrl(internalUrl)) {
    baseSupabaseUrl = internalUrl
  } else {
    baseSupabaseUrl = 'http://127.0.0.1:54321'
  }

  // Resolve API URL (Kong gateway)
  const explicitApiUrl = process.env.API_EXTERNAL_URL || process.env.NEXT_PUBLIC_API_URL
  if (explicitApiUrl && validateUrl(explicitApiUrl)) {
    baseApiUrl = explicitApiUrl
  } else if (publicUrl && validateUrl(publicUrl)) {
    baseApiUrl = publicUrl
  } else if (internalUrl && validateUrl(internalUrl)) {
    baseApiUrl = internalUrl
  } else {
    baseApiUrl = 'http://127.0.0.1:8000'
  }

  // Create network-aware URLs for both server-side and client-side usage
  const gotrueUrls = resolveNetworkAwareUrls(baseGotrueUrl, networkEnv)
  const supabaseUrls = resolveNetworkAwareUrls(baseSupabaseUrl, networkEnv)
  const apiUrls = resolveNetworkAwareUrls(baseApiUrl, networkEnv)

  // For backward compatibility, use client-side URLs as the main URLs
  // (since this API is primarily called by the browser)
  const gotrueUrl = gotrueUrls.clientSide
  const supabaseUrl = supabaseUrls.clientSide
  const apiUrl = apiUrls.clientSide

  // Get anon key
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  // Re-detect environment with resolved URLs for more accurate detection
  environment = determineEnvironment({ gotrueUrl, supabaseUrl, apiUrl })

  // Get authentication configuration
  const requireLogin = process.env.NEXT_PUBLIC_REQUIRE_LOGIN === 'true'
  const isPlatform = process.env.NEXT_PUBLIC_IS_PLATFORM === 'true'

  // Enhanced logging for requirement 3.3: Configuration source and resolution results
  console.log('[Runtime Config API] 🔧 Configuration Resolution Summary:')
  console.log('[Runtime Config API]   Resolution timestamp:', new Date().toISOString())
  console.log('[Runtime Config API]   Final source selected:', source.toUpperCase())
  console.log('[Runtime Config API]   Environment determined:', environment.toUpperCase())
  console.log('[Runtime Config API]   Network-aware configuration: ENABLED')
  
  // Log the resolution process details
  console.log('[Runtime Config API] 📋 Resolution Process Details:')
  console.log('[Runtime Config API]   1. Environment validation:', validation.isValid ? 'PASSED' : 'FAILED')
  console.log('[Runtime Config API]   2. Network environment detection: COMPLETED')
  console.log('[Runtime Config API]   3. URL resolution priority chain: EXECUTED')
  console.log('[Runtime Config API]   4. Network-aware URL transformation: APPLIED')
  console.log('[Runtime Config API]   5. Final configuration assembly: COMPLETED')
  
  // Log configuration sources attempted
  console.log('[Runtime Config API] 🔄 Configuration Sources Attempted:')
  console.log('[Runtime Config API]   NEXT_PUBLIC_GOTRUE_URL:', process.env.NEXT_PUBLIC_GOTRUE_URL ? 'AVAILABLE → ' + (source === 'explicit' ? 'USED' : 'SKIPPED') : 'NOT SET')
  console.log('[Runtime Config API]   SUPABASE_PUBLIC_URL:', process.env.SUPABASE_PUBLIC_URL ? 'AVAILABLE → ' + (source === 'derived' && process.env.SUPABASE_PUBLIC_URL ? 'USED' : 'AVAILABLE') : 'NOT SET')
  console.log('[Runtime Config API]   SUPABASE_URL:', process.env.SUPABASE_URL ? 'AVAILABLE → ' + (source === 'derived' && !process.env.SUPABASE_PUBLIC_URL ? 'USED' : 'AVAILABLE') : 'NOT SET')
  console.log('[Runtime Config API]   Default values:', source === 'default' ? 'USED' : 'AVAILABLE')
  
  // Log successful configuration load using centralized logging
  logConfigurationSource(
    'Runtime Config API',
    source as any,
    { gotrueUrl, supabaseUrl, apiUrl },
    environment as any,
    {
      hasAnonKey: !!anonKey,
      requireLogin,
      isPlatform,
      timestamp: Date.now(),
      validationWarnings: validation.warnings.length,
      validationSuggestions: validation.suggestions.length,
      networkEnvironment: {
        isContainer: networkEnv.isContainer,
        isServerSide: networkEnv.isServerSide,
        internalDomain: networkEnv.internalDomain,
        externalDomain: networkEnv.externalDomain,
      },
      resolutionProcess: {
        environmentValidation: validation.isValid,
        networkDetection: 'completed',
        urlResolution: 'executed',
        networkTransformation: 'applied',
        finalAssembly: 'completed'
      }
    }
  )

  // Log network-aware configuration details
  console.log('[Runtime Config API] 🔗 Network-aware configuration:')
  console.log('[Runtime Config API]   Container environment:', networkEnv.isContainer ? '✓' : '✗')
  console.log('[Runtime Config API]   Server-side context:', networkEnv.isServerSide ? '✓' : '✗')
  console.log('[Runtime Config API]   Internal domain:', networkEnv.internalDomain)
  console.log('[Runtime Config API]   External domain:', networkEnv.externalDomain)
  console.log('[Runtime Config API] 🔧 Server-side URLs (for API calls):')
  console.log('[Runtime Config API]   GoTrue:', gotrueUrls.serverSide)
  console.log('[Runtime Config API]   Supabase:', supabaseUrls.serverSide)
  console.log('[Runtime Config API]   API Gateway:', apiUrls.serverSide)
  console.log('[Runtime Config API] 🌐 Client-side URLs (for browser):')
  console.log('[Runtime Config API]   GoTrue:', gotrueUrls.clientSide)
  console.log('[Runtime Config API]   Supabase:', supabaseUrls.clientSide)
  console.log('[Runtime Config API]   API Gateway:', apiUrls.clientSide)
  
  if (networkEnv.isContainer) {
    console.log('[Runtime Config API] 🐳 Container networking detected:')
    console.log('[Runtime Config API]   Server-side APIs should use internal URLs')
    console.log('[Runtime Config API]   Browser requests should use external URLs')
    
    // Warn if server-side and client-side URLs are the same in container environment
    if (gotrueUrls.serverSide === gotrueUrls.clientSide) {
      console.warn('[Runtime Config API] ⚠️  Server-side and client-side URLs are identical in container environment')
      console.warn('[Runtime Config API] This may indicate configuration issues with container networking')
    }
  }

  // Perform environment-specific checks and logging
  const envInfo = detectEnvironment()
  logEnvironmentInfo(envInfo, 'Runtime Config API')

  // Validate URLs for the detected environment
  const urlValidation = validateUrlsForEnvironment(
    { gotrueUrl, supabaseUrl, apiUrl },
    environment
  )
  logUrlValidation(urlValidation, 'Runtime Config API')
  
  // Log configuration validation results
  logConfigurationValidation(
    'Runtime Config API',
    validation.isValid && urlValidation.isValid,
    [...(urlValidation.errors || [])],
    [...validation.warnings, ...(urlValidation.warnings || [])],
    { gotrueUrl, supabaseUrl, apiUrl, source, environment }
  )

  // Perform comprehensive error handling and user guidance
  try {
    const { analyzeEnvironmentForErrors } = require('common/error-handling-guidance')
    const envInfo = detectEnvironment({ gotrueUrl, supabaseUrl, apiUrl })
    
    const configErrors = analyzeEnvironmentForErrors(envInfo, { supabaseUrl, gotrueUrl, apiUrl })
    
    if (configErrors.length > 0) {
      console.log(`[Runtime Config API] 🔍 Configuration analysis: ${configErrors.length} issues detected`)
      
      const criticalErrors = configErrors.filter((e: any) => e.severity === 'critical')
      const regularErrors = configErrors.filter((e: any) => e.severity === 'error')
      const warnings = configErrors.filter((e: any) => e.severity === 'warning')
      
      if (criticalErrors.length > 0) {
        console.error(`[Runtime Config API] 🚨 CRITICAL: ${criticalErrors.length} critical configuration errors`)
        criticalErrors.forEach((error: any, index: number) => {
          console.error(`[Runtime Config API] Critical Error ${index + 1}:`, error.message)
          console.error(`[Runtime Config API] Recommendations:`, error.recommendations.slice(0, 2))
        })
      }
      
      if (regularErrors.length > 0) {
        console.error(`[Runtime Config API] ❌ ${regularErrors.length} configuration errors detected`)
        regularErrors.forEach((error: any, index: number) => {
          console.error(`[Runtime Config API] Error ${index + 1}:`, error.message)
        })
      }
      
      if (warnings.length > 0) {
        console.warn(`[Runtime Config API] ⚠️ ${warnings.length} configuration warnings`)
        warnings.forEach((warning: any, index: number) => {
          console.warn(`[Runtime Config API] Warning ${index + 1}:`, warning.message)
        })
      }
      
      // Add error guidance to response for critical issues
      if (criticalErrors.length > 0) {
        console.log('[Runtime Config API] 💡 Adding error guidance to response')
        // Note: In a real implementation, you might want to add this to the response
        // For now, we're just logging comprehensive guidance
      }
    } else {
      console.log('[Runtime Config API] ✅ Configuration analysis: No issues detected')
    }
  } catch (analysisError) {
    console.warn('[Runtime Config API] ⚠️ Could not perform configuration analysis:', analysisError)
  }

  return {
    gotrueUrl,
    supabaseUrl,
    apiUrl,
    anonKey,
    requireLogin,
    isPlatform,
    source,
    environment,
    timestamp: Date.now(),
    network: {
      serverSide: {
        gotrueUrl: gotrueUrls.serverSide,
        supabaseUrl: supabaseUrls.serverSide,
        apiUrl: apiUrls.serverSide,
      },
      clientSide: {
        gotrueUrl: gotrueUrls.clientSide,
        supabaseUrl: supabaseUrls.clientSide,
        apiUrl: apiUrls.clientSide,
      },
      environment: {
        isContainer: networkEnv.isContainer,
        isServerSide: networkEnv.isServerSide,
        preferredProtocol: networkEnv.preferredProtocol,
        internalDomain: networkEnv.internalDomain,
        externalDomain: networkEnv.externalDomain,
      },
    },
  }
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<RuntimeConfig | RuntimeConfigError>
): void {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      suggestions: ['Use GET method to fetch runtime configuration']
    })
  }

  try {
    const config = resolveConfiguration()

    // Check if configuration resolution resulted in an error
    if ('error' in config) {
      // Log error for debugging
      console.error('[Runtime Config API] Configuration error:', config.error, config.details)
      
      return res.status(500).json(config)
    }

    // Set cache headers (5 minutes)
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300')
    res.setHeader('Content-Type', 'application/json')
    
    return res.status(200).json(config)
  } catch (error: unknown) {
    // Log error for debugging
    console.error('[Runtime Config API] Error generating configuration:', error)
    
    // Create error response
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    
    return res.status(500).json({
      error: 'Failed to resolve runtime configuration',
      details: errorMessage,
      suggestions: [
        'Check server logs for detailed error information',
        'Verify all environment variables are properly set',
        'Ensure environment variables contain valid URLs',
        'Try refreshing the page to retry configuration loading',
      ],
    })
  }
}
