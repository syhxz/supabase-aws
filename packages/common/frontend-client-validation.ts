/**
 * Frontend Client URL Validation Module
 * 
 * Implements Requirements 3.1, 3.2, 3.3, 3.5 for frontend client URL validation:
 * - Add validation that production environments use production URLs
 * - Ensure NEXT_PUBLIC_SUPABASE_URL takes priority over hardcoded URLs
 * - Add logging for frontend client initialization URLs
 * - Implement URL pattern-based environment detection
 */

import { Environment, detectEnvironment, validateUrlsForEnvironment } from './environment-detection'

/**
 * Frontend client configuration interface
 */
export interface FrontendClientConfig {
  /** Supabase client URL */
  supabaseUrl: string
  /** Anonymous API key */
  anonKey: string
  /** GoTrue authentication URL */
  gotrueUrl?: string
  /** Additional client options */
  options?: {
    auth?: {
      persistSession?: boolean
      autoRefreshToken?: boolean
      detectSessionInUrl?: boolean
    }
    global?: {
      headers?: Record<string, string>
    }
  }
}

/**
 * URL validation result for frontend clients
 */
export interface FrontendUrlValidationResult {
  /** Whether the configuration is valid */
  isValid: boolean
  /** Critical errors that prevent client initialization */
  errors: string[]
  /** Warnings about potential issues */
  warnings: string[]
  /** Recommendations for fixing issues */
  recommendations: string[]
  /** Detected environment based on URLs */
  detectedEnvironment: Environment
  /** URL sources used in priority order */
  urlSources: {
    source: string
    url: string
    priority: number
    used: boolean
    reason: string
  }[]
}

/**
 * Frontend client initialization logging information
 */
export interface FrontendClientInitLog {
  /** Timestamp of initialization */
  timestamp: string
  /** Environment detected during initialization */
  environment: Environment
  /** URLs being used for client initialization */
  urls: {
    supabaseUrl: string
    gotrueUrl?: string
  }
  /** API key information (masked) */
  apiKey: {
    present: boolean
    source: string
    masked: string
  }
  /** Validation results */
  validation: FrontendUrlValidationResult
  /** Client options being used */
  clientOptions?: any
}

/**
 * Gets frontend client URLs with proper priority handling
 * Requirements 3.2: Ensure NEXT_PUBLIC_SUPABASE_URL takes priority over hardcoded URLs
 */
export function getFrontendClientUrls(): {
  supabaseUrl: string
  gotrueUrl?: string
  anonKey: string
  sources: {
    supabaseUrl: { source: string; priority: number }
    gotrueUrl?: { source: string; priority: number }
    anonKey: { source: string; priority: number }
  }
} {
  // Priority order for Supabase URL (highest to lowest)
  const supabaseUrlSources = [
    { source: 'NEXT_PUBLIC_SUPABASE_URL', value: process.env.NEXT_PUBLIC_SUPABASE_URL, priority: 1 },
    { source: 'SUPABASE_PUBLIC_URL', value: process.env.SUPABASE_PUBLIC_URL, priority: 2 },
    { source: 'SUPABASE_URL', value: process.env.SUPABASE_URL, priority: 3 },
    { source: 'hardcoded-localhost', value: 'http://127.0.0.1:54321', priority: 4 },
  ]

  // Priority order for GoTrue URL
  const gotrueUrlSources = [
    { source: 'NEXT_PUBLIC_GOTRUE_URL', value: process.env.NEXT_PUBLIC_GOTRUE_URL, priority: 1 },
    { source: 'derived-from-supabase', value: undefined, priority: 2 }, // Will be derived
  ]

  // Priority order for anonymous key
  const anonKeySources = [
    { source: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', value: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, priority: 1 },
    { source: 'SUPABASE_ANON_KEY', value: process.env.SUPABASE_ANON_KEY, priority: 2 },
    { source: 'empty-fallback', value: '', priority: 3 },
  ]

  // Select Supabase URL with highest priority
  const selectedSupabaseSource = supabaseUrlSources.find(source => source.value)
  const supabaseUrl = selectedSupabaseSource?.value || 'http://127.0.0.1:54321'

  // Select GoTrue URL with highest priority
  let gotrueUrl: string | undefined
  let selectedGotrueSource = gotrueUrlSources.find(source => source.value)
  
  if (!selectedGotrueSource) {
    // Derive from Supabase URL
    try {
      const parsed = new URL(supabaseUrl)
      gotrueUrl = `${parsed.protocol}//${parsed.host}/auth/v1`
      selectedGotrueSource = { source: 'derived-from-supabase', value: gotrueUrl, priority: 2 }
    } catch {
      // Invalid Supabase URL, leave gotrueUrl undefined
    }
  } else {
    gotrueUrl = selectedGotrueSource.value
  }

  // Select anonymous key with highest priority
  const selectedAnonSource = anonKeySources.find(source => source.value)
  const anonKey = selectedAnonSource?.value || ''

  return {
    supabaseUrl,
    gotrueUrl,
    anonKey,
    sources: {
      supabaseUrl: { 
        source: selectedSupabaseSource?.source || 'hardcoded-localhost', 
        priority: selectedSupabaseSource?.priority || 4 
      },
      gotrueUrl: selectedGotrueSource ? { 
        source: selectedGotrueSource.source, 
        priority: selectedGotrueSource.priority 
      } : undefined,
      anonKey: { 
        source: selectedAnonSource?.source || 'empty-fallback', 
        priority: selectedAnonSource?.priority || 3 
      },
    },
  }
}

/**
 * Validates frontend client URLs for the current environment
 * Requirements 3.1: Add validation that production environments use production URLs
 * Requirements 3.3: Implement URL pattern-based environment detection
 */
export function validateFrontendClientUrls(
  supabaseUrl: string,
  gotrueUrl?: string,
  explicitEnvironment?: Environment
): FrontendUrlValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const recommendations: string[] = []

  // Get URL sources for logging
  const { sources } = getFrontendClientUrls()
  const urlSources = [
    {
      source: sources.supabaseUrl.source,
      url: supabaseUrl,
      priority: sources.supabaseUrl.priority,
      used: true,
      reason: 'Primary Supabase client URL'
    }
  ]

  if (gotrueUrl && sources.gotrueUrl) {
    urlSources.push({
      source: sources.gotrueUrl.source,
      url: gotrueUrl,
      priority: sources.gotrueUrl.priority,
      used: true,
      reason: 'GoTrue authentication URL'
    })
  }

  // Detect environment based on URLs if not explicitly provided
  let detectedEnvironment: Environment
  if (explicitEnvironment) {
    detectedEnvironment = explicitEnvironment
  } else {
    const envInfo = detectEnvironment({ supabaseUrl, gotrueUrl })
    detectedEnvironment = envInfo.environment
  }

  // Frontend-specific validations
  
  // Requirement 3.1: Production environments must use production URLs
  if (detectedEnvironment === 'production') {
    const localhostPatterns = ['localhost', '127.0.0.1', '0.0.0.0', '::1']
    
    // Check Supabase URL
    const supabaseHasLocalhost = localhostPatterns.some(pattern => supabaseUrl.includes(pattern))
    if (supabaseHasLocalhost) {
      errors.push(
        `Production environment detected but Supabase URL contains localhost: ${supabaseUrl}. ` +
        `Frontend clients will fail to connect in production. ` +
        `Set NEXT_PUBLIC_SUPABASE_URL to your production Supabase URL.`
      )
      recommendations.push(
        'Set NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co in your production environment'
      )
    }

    // Check GoTrue URL
    if (gotrueUrl) {
      const gotrueHasLocalhost = localhostPatterns.some(pattern => gotrueUrl.includes(pattern))
      if (gotrueHasLocalhost) {
        errors.push(
          `Production environment detected but GoTrue URL contains localhost: ${gotrueUrl}. ` +
          `Authentication will fail in production. ` +
          `Set NEXT_PUBLIC_GOTRUE_URL to your production GoTrue URL.`
        )
        recommendations.push(
          'Set NEXT_PUBLIC_GOTRUE_URL=https://your-project.supabase.co/auth/v1 in your production environment'
        )
      }
    }

    // Check for development ports in production
    const developmentPorts = ['3000', '3001', '5000', '5173', '8080', '54321']
    try {
      const parsed = new URL(supabaseUrl)
      if (developmentPorts.includes(parsed.port)) {
        warnings.push(
          `Production environment using development-like port ${parsed.port} in Supabase URL: ${supabaseUrl}. ` +
          `Verify this is correct for your production setup.`
        )
      }
    } catch {
      errors.push(`Invalid Supabase URL format: ${supabaseUrl}`)
    }

    // Recommend HTTPS for production
    if (!supabaseUrl.startsWith('https://')) {
      warnings.push(
        `Production Supabase URL should use HTTPS for security: ${supabaseUrl}. ` +
        `Consider upgrading to HTTPS if possible.`
      )
      recommendations.push('Use HTTPS URLs for all production services for better security')
    }
  }

  // Validate URLs for the detected environment (add after frontend-specific checks)
  const envValidation = validateUrlsForEnvironment(
    { supabaseUrl, gotrueUrl },
    detectedEnvironment
  )

  // Only add environment validation errors if we haven't already added frontend-specific ones
  const frontendErrorMessages = errors.map(e => e.toLowerCase())
  const newEnvErrors = envValidation.errors.filter(error => {
    const errorLower = error.toLowerCase()
    return !frontendErrorMessages.some(frontendError => 
      frontendError.includes('localhost') && errorLower.includes('localhost')
    )
  })
  
  errors.push(...newEnvErrors)
  warnings.push(...envValidation.warnings)

  // Requirement 3.2: Validate URL priority is working correctly
  if (sources.supabaseUrl.source === 'hardcoded-localhost' && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    warnings.push(
      'NEXT_PUBLIC_SUPABASE_URL is set but hardcoded localhost URL is being used. ' +
      'Check your client initialization code for hardcoded URLs.'
    )
    recommendations.push(
      'Ensure your Supabase client initialization uses environment variables instead of hardcoded URLs'
    )
  }

  // Development environment validations
  if (detectedEnvironment === 'development') {
    const localhostPatterns = ['localhost', '127.0.0.1', '0.0.0.0']
    const hasLocalhost = localhostPatterns.some(pattern => supabaseUrl.includes(pattern))
    
    if (!hasLocalhost) {
      warnings.push(
        `Development environment detected but Supabase URL is not localhost: ${supabaseUrl}. ` +
        `This may be intentional if connecting to remote development services.`
      )
    }

    // Check for HTTPS with localhost (can cause certificate issues)
    if (supabaseUrl.startsWith('https://') && hasLocalhost) {
      warnings.push(
        `Development environment using HTTPS with localhost: ${supabaseUrl}. ` +
        `This may cause certificate issues. Consider using HTTP for local development.`
      )
      recommendations.push('Use HTTP URLs for localhost development to avoid certificate issues')
    }
  }

  // Staging environment validations
  if (detectedEnvironment === 'staging') {
    const stagingPatterns = ['staging', 'stg', 'test', 'dev-', 'preview']
    const looksLikeStaging = stagingPatterns.some(pattern => 
      supabaseUrl.includes(pattern) || (gotrueUrl && gotrueUrl.includes(pattern))
    )
    
    if (!looksLikeStaging) {
      warnings.push(
        `Staging environment detected but URLs don't contain staging indicators. ` +
        `Verify these are the correct staging URLs: ${supabaseUrl}`
      )
    }
  }

  // General URL format validation
  try {
    new URL(supabaseUrl)
  } catch {
    errors.push(`Invalid Supabase URL format: ${supabaseUrl}`)
  }

  if (gotrueUrl) {
    try {
      new URL(gotrueUrl)
    } catch {
      errors.push(`Invalid GoTrue URL format: ${gotrueUrl}`)
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    recommendations,
    detectedEnvironment,
    urlSources,
  }
}
/*
*
 * Logs frontend client initialization with comprehensive URL information
 * Requirements 3.5: Add logging for frontend client initialization URLs
 */
export function logFrontendClientInitialization(
  config: FrontendClientConfig,
  validation?: FrontendUrlValidationResult
): FrontendClientInitLog {
  const timestamp = new Date().toISOString()
  
  // Perform validation if not provided
  const validationResult = validation || validateFrontendClientUrls(
    config.supabaseUrl,
    config.gotrueUrl
  )

  // Mask API key for logging
  const apiKeyMasked = config.anonKey 
    ? config.anonKey.length > 8 
      ? `${config.anonKey.substring(0, 4)}...${config.anonKey.substring(config.anonKey.length - 4)}`
      : '***'
    : 'NOT SET'

  const { sources } = getFrontendClientUrls()

  const initLog: FrontendClientInitLog = {
    timestamp,
    environment: validationResult.detectedEnvironment,
    urls: {
      supabaseUrl: config.supabaseUrl,
      gotrueUrl: config.gotrueUrl,
    },
    apiKey: {
      present: !!config.anonKey,
      source: sources.anonKey.source,
      masked: apiKeyMasked,
    },
    validation: validationResult,
    clientOptions: config.options,
  }

  // Log initialization details
  console.log(`[Frontend Client] 🚀 Supabase client initialization at ${timestamp}`)
  console.log(`[Frontend Client] Environment: ${validationResult.detectedEnvironment.toUpperCase()}`)
  console.log(`[Frontend Client] === CLIENT CONFIGURATION ===`)
  console.log(`[Frontend Client] Supabase URL: ${config.supabaseUrl}`)
  console.log(`[Frontend Client]   Source: ${sources.supabaseUrl.source} (priority ${sources.supabaseUrl.priority})`)
  
  if (config.gotrueUrl) {
    console.log(`[Frontend Client] GoTrue URL: ${config.gotrueUrl}`)
    if (sources.gotrueUrl) {
      console.log(`[Frontend Client]   Source: ${sources.gotrueUrl.source} (priority ${sources.gotrueUrl.priority})`)
    }
  } else {
    console.log(`[Frontend Client] GoTrue URL: Derived from Supabase URL`)
  }

  console.log(`[Frontend Client] API Key: ${apiKeyMasked}`)
  console.log(`[Frontend Client]   Source: ${sources.anonKey.source} (priority ${sources.anonKey.priority})`)
  console.log(`[Frontend Client]   Present: ${initLog.apiKey.present ? '✓' : '✗'}`)

  // Log URL sources and priority
  console.log(`[Frontend Client] === URL PRIORITY CHAIN ===`)
  validationResult.urlSources.forEach(source => {
    const status = source.used ? '🎯 USED' : '⏭️ AVAILABLE'
    console.log(`[Frontend Client] ${source.priority}. ${source.source}: ${status}`)
    console.log(`[Frontend Client]    URL: ${source.url}`)
    console.log(`[Frontend Client]    Reason: ${source.reason}`)
  })

  // Log validation results
  if (validationResult.errors.length > 0) {
    console.error(`[Frontend Client] ❌ CRITICAL ERRORS (${validationResult.errors.length}):`)
    validationResult.errors.forEach((error, index) => {
      console.error(`[Frontend Client]   ${index + 1}. ${error}`)
    })
  }

  if (validationResult.warnings.length > 0) {
    console.warn(`[Frontend Client] ⚠️  WARNINGS (${validationResult.warnings.length}):`)
    validationResult.warnings.forEach((warning, index) => {
      console.warn(`[Frontend Client]   ${index + 1}. ${warning}`)
    })
  }

  if (validationResult.recommendations.length > 0) {
    console.log(`[Frontend Client] 💡 RECOMMENDATIONS (${validationResult.recommendations.length}):`)
    validationResult.recommendations.forEach((rec, index) => {
      console.log(`[Frontend Client]   ${index + 1}. ${rec}`)
    })
  }

  // Environment-specific guidance
  if (validationResult.detectedEnvironment === 'production') {
    console.log(`[Frontend Client] 🔒 PRODUCTION MODE ACTIVE`)
    console.log(`[Frontend Client] ✓ Ensure all URLs point to production services`)
    console.log(`[Frontend Client] ✓ Verify HTTPS is used for security`)
    console.log(`[Frontend Client] ✓ No localhost URLs should be present`)
    
    if (validationResult.errors.length > 0) {
      console.error(`[Frontend Client] 🚨 PRODUCTION DEPLOYMENT BLOCKED`)
      console.error(`[Frontend Client] Fix the above errors before deploying to production`)
    }
  } else if (validationResult.detectedEnvironment === 'development') {
    console.log(`[Frontend Client] 🔧 DEVELOPMENT MODE ACTIVE`)
    console.log(`[Frontend Client] ✓ Using local development services`)
    console.log(`[Frontend Client] ✓ Localhost URLs are expected`)
    console.log(`[Frontend Client] ✓ Ensure docker-compose services are running`)
  } else if (validationResult.detectedEnvironment === 'staging') {
    console.log(`[Frontend Client] 🧪 STAGING MODE ACTIVE`)
    console.log(`[Frontend Client] ✓ Using staging environment services`)
    console.log(`[Frontend Client] ✓ Configuration should mirror production`)
  }

  // Log client options if provided
  if (config.options) {
    console.log(`[Frontend Client] === CLIENT OPTIONS ===`)
    if (config.options.auth) {
      console.log(`[Frontend Client] Auth options:`)
      console.log(`[Frontend Client]   persistSession: ${config.options.auth.persistSession ?? 'default'}`)
      console.log(`[Frontend Client]   autoRefreshToken: ${config.options.auth.autoRefreshToken ?? 'default'}`)
      console.log(`[Frontend Client]   detectSessionInUrl: ${config.options.auth.detectSessionInUrl ?? 'default'}`)
    }
    if (config.options.global?.headers) {
      console.log(`[Frontend Client] Global headers: ${Object.keys(config.options.global.headers).length} headers`)
    }
  }

  console.log(`[Frontend Client] === INITIALIZATION COMPLETE ===`)
  console.log(`[Frontend Client] Status: ${validationResult.isValid ? '✅ SUCCESS' : '❌ ERRORS DETECTED'}`)
  console.log(`[Frontend Client] Environment: ${validationResult.detectedEnvironment.toUpperCase()}`)
  console.log(`[Frontend Client] Timestamp: ${timestamp}`)

  return initLog
}

/**
 * Creates a validated Supabase client configuration
 * This function should be used instead of directly calling createClient
 */
export function createValidatedClientConfig(
  customConfig?: Partial<FrontendClientConfig>
): FrontendClientConfig {
  // Get URLs with proper priority handling
  const { supabaseUrl, gotrueUrl, anonKey } = getFrontendClientUrls()

  // Merge with custom configuration
  const config: FrontendClientConfig = {
    supabaseUrl: customConfig?.supabaseUrl || supabaseUrl,
    anonKey: customConfig?.anonKey || anonKey,
    gotrueUrl: customConfig?.gotrueUrl || gotrueUrl,
    options: customConfig?.options,
  }

  // Validate the configuration
  const validation = validateFrontendClientUrls(config.supabaseUrl, config.gotrueUrl)

  // Log the initialization
  logFrontendClientInitialization(config, validation)

  // Throw error if critical issues are found
  if (!validation.isValid) {
    const errorMessage = `Frontend client configuration validation failed:\n${validation.errors.join('\n')}`
    console.error(`[Frontend Client] 🚨 ${errorMessage}`)
    throw new Error(errorMessage)
  }

  return config
}

/**
 * Validates that environment variables are properly set for frontend clients
 * Requirements 3.2: Ensure NEXT_PUBLIC_SUPABASE_URL takes priority over hardcoded URLs
 */
export function validateFrontendEnvironmentVariables(): {
  isValid: boolean
  errors: string[]
  warnings: string[]
  recommendations: string[]
  environmentVariables: {
    name: string
    value: string | null
    present: boolean
    priority: number
    recommended: boolean
  }[]
} {
  const errors: string[] = []
  const warnings: string[] = []
  const recommendations: string[] = []

  const envVars = [
    {
      name: 'NEXT_PUBLIC_SUPABASE_URL',
      value: process.env.NEXT_PUBLIC_SUPABASE_URL || null,
      present: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      priority: 1,
      recommended: true,
    },
    {
      name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      value: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || null,
      present: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      priority: 1,
      recommended: true,
    },
    {
      name: 'NEXT_PUBLIC_GOTRUE_URL',
      value: process.env.NEXT_PUBLIC_GOTRUE_URL || null,
      present: !!process.env.NEXT_PUBLIC_GOTRUE_URL,
      priority: 1,
      recommended: false,
    },
    {
      name: 'SUPABASE_PUBLIC_URL',
      value: process.env.SUPABASE_PUBLIC_URL || null,
      present: !!process.env.SUPABASE_PUBLIC_URL,
      priority: 2,
      recommended: false,
    },
    {
      name: 'SUPABASE_URL',
      value: process.env.SUPABASE_URL || null,
      present: !!process.env.SUPABASE_URL,
      priority: 3,
      recommended: false,
    },
    {
      name: 'SUPABASE_ANON_KEY',
      value: process.env.SUPABASE_ANON_KEY || null,
      present: !!process.env.SUPABASE_ANON_KEY,
      priority: 2,
      recommended: false,
    },
  ]

  // Check for missing recommended variables
  const missingRecommended = envVars.filter(v => v.recommended && !v.present)
  if (missingRecommended.length > 0) {
    warnings.push(
      `Missing recommended environment variables: ${missingRecommended.map(v => v.name).join(', ')}`
    )
    recommendations.push(
      'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY for proper frontend client configuration'
    )
  }

  // Check if any URL is available
  const urlVars = envVars.filter(v => v.name.includes('URL') && v.present)
  if (urlVars.length === 0) {
    errors.push(
      'No Supabase URL environment variables found. Frontend clients will use hardcoded localhost URLs.'
    )
    recommendations.push(
      'Set NEXT_PUBLIC_SUPABASE_URL to your Supabase project URL'
    )
  }

  // Check if any API key is available
  const keyVars = envVars.filter(v => v.name.includes('KEY') && v.present)
  if (keyVars.length === 0) {
    errors.push(
      'No Supabase API key environment variables found. Frontend clients will not be able to authenticate.'
    )
    recommendations.push(
      'Set NEXT_PUBLIC_SUPABASE_ANON_KEY to your Supabase anonymous key'
    )
  }

  // Detect environment and provide environment-specific recommendations
  const { supabaseUrl } = getFrontendClientUrls()
  const validation = validateFrontendClientUrls(supabaseUrl)
  
  if (validation.detectedEnvironment === 'production') {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      errors.push(
        'Production environment detected but NEXT_PUBLIC_SUPABASE_URL is not set. ' +
        'This is required for frontend clients in production.'
      )
    }
    
    if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      errors.push(
        'Production environment detected but NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. ' +
        'This is required for frontend authentication in production.'
      )
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    recommendations,
    environmentVariables: envVars,
  }
}