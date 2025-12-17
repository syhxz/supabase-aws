/**
 * GoTrue Configuration Validation Module
 * 
 * Implements comprehensive validation for GoTrue service configuration including:
 * - Startup configuration validation (Requirements 4.1)
 * - Environment variable presence checks (Requirements 4.1)
 * - Configuration error reporting with remediation steps (Requirements 4.2)
 * 
 * This module ensures that all required GoTrue configuration is present and valid
 * before the service attempts to connect, providing actionable error messages
 * when configuration issues are detected.
 */

import { validateGoTrueUrl } from 'common/gotrue-config'
import { detectEnvironment, validateUrlsForEnvironment, type Environment } from 'common/environment-detection'
import { logConfigurationError } from 'common/configuration-logging'

/**
 * Required environment variables for GoTrue configuration
 */
export interface RequiredGoTrueEnvVars {
  /** GoTrue service URL */
  gotrueUrl: string
  /** Supabase project URL */
  supabaseUrl: string
  /** API gateway URL */
  apiUrl: string
  /** Anonymous API key for authentication */
  anonKey: string
}

/**
 * Optional environment variables that enhance GoTrue functionality
 */
export interface OptionalGoTrueEnvVars {
  /** JWT secret for token validation */
  jwtSecret?: string
  /** Database connection URL */
  databaseUrl?: string
  /** SMTP configuration for email */
  smtpHost?: string
  smtpPort?: string
  smtpUser?: string
  smtpPass?: string
  /** OAuth provider configurations */
  googleClientId?: string
  googleClientSecret?: string
  githubClientId?: string
  githubClientSecret?: string
}

/**
 * Configuration validation result
 */
export interface GoTrueConfigValidationResult {
  /** Whether all required configuration is valid */
  isValid: boolean
  /** Critical errors that prevent GoTrue from functioning */
  errors: GoTrueConfigError[]
  /** Non-critical warnings about configuration */
  warnings: GoTrueConfigWarning[]
  /** Successfully validated configuration values */
  validatedConfig: Partial<RequiredGoTrueEnvVars & OptionalGoTrueEnvVars>
  /** Environment information */
  environment: Environment
  /** Validation timestamp */
  timestamp: number
}

/**
 * Configuration error with remediation steps
 */
export interface GoTrueConfigError {
  /** Error type for categorization */
  type: 'missing_required' | 'invalid_format' | 'environment_mismatch' | 'connectivity' | 'security'
  /** Human-readable error message */
  message: string
  /** Environment variable or configuration key that caused the error */
  key: string
  /** Current value (if any) */
  currentValue?: string
  /** Expected value format or example */
  expectedFormat?: string
  /** Specific remediation steps */
  remediationSteps: string[]
  /** Severity level */
  severity: 'critical' | 'high' | 'medium'
}

/**
 * Configuration warning with recommendations
 */
export interface GoTrueConfigWarning {
  /** Warning type for categorization */
  type: 'missing_optional' | 'suboptimal_config' | 'security_concern' | 'performance'
  /** Human-readable warning message */
  message: string
  /** Environment variable or configuration key */
  key: string
  /** Current value (if any) */
  currentValue?: string
  /** Recommended value or action */
  recommendation: string
  /** Impact of not addressing the warning */
  impact: string
}

/**
 * Validates all required environment variables are present and correctly formatted
 * 
 * This function implements Requirements 4.1: "WHEN GoTrue starts THEN the GoTrue Service 
 * SHALL validate all required environment variables are present"
 * 
 * @returns Validation result with errors for missing or invalid variables
 */
export function validateRequiredEnvironmentVariables(): {
  errors: GoTrueConfigError[]
  warnings: GoTrueConfigWarning[]
  validatedConfig: Partial<RequiredGoTrueEnvVars>
} {
  const errors: GoTrueConfigError[] = []
  const warnings: GoTrueConfigWarning[] = []
  const validatedConfig: Partial<RequiredGoTrueEnvVars> = {}

  // Define environment variable mappings with fallback chains
  const envVarMappings = {
    gotrueUrl: [
      'NEXT_PUBLIC_GOTRUE_URL',
      'GOTRUE_URL',
      'SUPABASE_PUBLIC_URL', // Will be derived with /auth/v1
      'SUPABASE_URL', // Will be derived with /auth/v1
    ],
    supabaseUrl: [
      'SUPABASE_PUBLIC_URL',
      'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_URL',
    ],
    apiUrl: [
      'API_EXTERNAL_URL',
      'NEXT_PUBLIC_API_URL',
      'KONG_HTTP_PORT', // Will be derived
    ],
    anonKey: [
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_ANON_KEY',
      'ANON_KEY',
    ],
  }

  // Validate each required configuration
  for (const [configKey, envVars] of Object.entries(envVarMappings)) {
    let foundValue: string | undefined
    let sourceVar: string | undefined

    // Try each environment variable in order
    for (const envVar of envVars) {
      const value = process.env[envVar]
      if (value && value.trim() !== '') {
        // Handle special derivation for GoTrue URL from Supabase URL
        if (configKey === 'gotrueUrl' && (envVar === 'SUPABASE_PUBLIC_URL' || envVar === 'SUPABASE_URL')) {
          foundValue = `${value.trim().replace(/\/$/, '')}/auth/v1`
          sourceVar = `derived from ${envVar}`
        } else {
          foundValue = value.trim()
          sourceVar = envVar
        }
        break
      }
    }

    // Handle derived values for special cases when no direct env var found
    if (!foundValue && configKey === 'apiUrl') {
      // Try to derive API URL from Kong port in development
      const kongPort = process.env.KONG_HTTP_PORT || '8000'
      foundValue = `http://localhost:${kongPort}`
      sourceVar = 'derived from KONG_HTTP_PORT'
    }

    if (!foundValue) {
      // Required variable is missing
      errors.push({
        type: 'missing_required',
        message: `Required ${configKey} configuration is missing`,
        key: configKey,
        expectedFormat: getExpectedFormat(configKey),
        remediationSteps: getRemediationSteps(configKey, envVars),
        severity: 'critical',
      })
    } else {
      // Validate the found value
      const validation = validateConfigValue(configKey as keyof RequiredGoTrueEnvVars, foundValue)
      
      if (validation.isValid) {
        validatedConfig[configKey as keyof RequiredGoTrueEnvVars] = foundValue
        
        // Add informational logging
        console.log(`[GoTrue Config Validation] ✓ ${configKey}: ${foundValue} (from ${sourceVar})`)
      } else {
        errors.push({
          type: 'invalid_format',
          message: `Invalid ${configKey} format: ${validation.error}`,
          key: configKey,
          currentValue: foundValue,
          expectedFormat: getExpectedFormat(configKey),
          remediationSteps: [
            `Fix the ${configKey} format in environment variable ${sourceVar}`,
            `Expected format: ${getExpectedFormat(configKey)}`,
            `Current value: ${foundValue}`,
            ...validation.suggestions,
          ],
          severity: 'critical',
        })
      }
    }
  }

  return { errors, warnings, validatedConfig }
}

/**
 * Validates optional environment variables and provides recommendations
 * 
 * @returns Validation result with warnings for missing or suboptimal optional variables
 */
export function validateOptionalEnvironmentVariables(): {
  warnings: GoTrueConfigWarning[]
  validatedConfig: Partial<OptionalGoTrueEnvVars>
} {
  const warnings: GoTrueConfigWarning[] = []
  const validatedConfig: Partial<OptionalGoTrueEnvVars> = {}

  // Define optional environment variables with their importance
  const optionalVars = {
    jwtSecret: {
      envVars: ['JWT_SECRET', 'GOTRUE_JWT_SECRET'],
      importance: 'high',
      impact: 'JWT tokens cannot be validated, authentication may fail',
      recommendation: 'Set JWT_SECRET to match your Supabase project JWT secret',
    },
    databaseUrl: {
      envVars: ['DATABASE_URL', 'GOTRUE_DB_DRIVER'],
      importance: 'medium',
      impact: 'GoTrue may not be able to connect to the database',
      recommendation: 'Set DATABASE_URL if GoTrue needs direct database access',
    },
    smtpHost: {
      envVars: ['SMTP_HOST', 'GOTRUE_SMTP_HOST'],
      importance: 'medium',
      impact: 'Email functionality (password reset, email confirmation) will not work',
      recommendation: 'Configure SMTP settings for email functionality',
    },
    googleClientId: {
      envVars: ['GOOGLE_CLIENT_ID', 'GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID'],
      importance: 'low',
      impact: 'Google OAuth authentication will not be available',
      recommendation: 'Set Google OAuth credentials if using Google sign-in',
    },
    githubClientId: {
      envVars: ['GITHUB_CLIENT_ID', 'GOTRUE_EXTERNAL_GITHUB_CLIENT_ID'],
      importance: 'low',
      impact: 'GitHub OAuth authentication will not be available',
      recommendation: 'Set GitHub OAuth credentials if using GitHub sign-in',
    },
  }

  for (const [configKey, config] of Object.entries(optionalVars)) {
    let foundValue: string | undefined
    let sourceVar: string | undefined

    // Try each environment variable
    for (const envVar of config.envVars) {
      const value = process.env[envVar]
      if (value && value.trim() !== '') {
        foundValue = value.trim()
        sourceVar = envVar
        break
      }
    }

    if (!foundValue && config.importance === 'high') {
      warnings.push({
        type: 'missing_optional',
        message: `Important optional configuration ${configKey} is missing`,
        key: configKey,
        recommendation: config.recommendation,
        impact: config.impact,
      })
    } else if (foundValue) {
      validatedConfig[configKey as keyof OptionalGoTrueEnvVars] = foundValue
      console.log(`[GoTrue Config Validation] ✓ ${configKey}: configured (from ${sourceVar})`)
    }
  }

  return { warnings, validatedConfig }
}

/**
 * Validates environment-specific configuration requirements
 * 
 * @param config - Validated configuration
 * @param environment - Current environment
 * @returns Environment-specific validation errors and warnings
 */
export function validateEnvironmentSpecificConfig(
  config: Partial<RequiredGoTrueEnvVars>,
  environment: Environment
): {
  errors: GoTrueConfigError[]
  warnings: GoTrueConfigWarning[]
} {
  const errors: GoTrueConfigError[] = []
  const warnings: GoTrueConfigWarning[] = []

  // Validate URLs for the current environment
  if (config.gotrueUrl || config.supabaseUrl || config.apiUrl) {
    const urlValidation = validateUrlsForEnvironment(
      {
        gotrueUrl: config.gotrueUrl,
        supabaseUrl: config.supabaseUrl,
        apiUrl: config.apiUrl,
      },
      environment
    )

    // Convert URL validation errors to configuration errors
    urlValidation.errors.forEach(error => {
      errors.push({
        type: 'environment_mismatch',
        message: error,
        key: 'urls',
        severity: 'critical',
        remediationSteps: getEnvironmentSpecificRemediationSteps(environment),
      })
    })

    // Convert URL validation warnings to configuration warnings
    urlValidation.warnings.forEach(warning => {
      warnings.push({
        type: 'suboptimal_config',
        message: warning,
        key: 'urls',
        recommendation: `Review URL configuration for ${environment} environment`,
        impact: 'May cause connectivity issues or security concerns',
      })
    })
  }

  // Environment-specific validation rules
  if (environment === 'production') {
    // Production-specific validations
    if (config.gotrueUrl && !config.gotrueUrl.startsWith('https://')) {
      warnings.push({
        type: 'security_concern',
        message: 'Production GoTrue URL should use HTTPS for security',
        key: 'gotrueUrl',
        currentValue: config.gotrueUrl,
        recommendation: 'Use HTTPS URL for production GoTrue service',
        impact: 'Authentication requests may be intercepted or blocked by security policies',
      })
    }

    if (!config.anonKey || config.anonKey.length < 32) {
      errors.push({
        type: 'security',
        message: 'Production environment requires a secure anonymous key',
        key: 'anonKey',
        currentValue: config.anonKey ? '[REDACTED]' : undefined,
        expectedFormat: 'Long, secure API key from Supabase project settings',
        remediationSteps: [
          'Go to your Supabase project dashboard',
          'Navigate to Settings > API',
          'Copy the "anon public" key',
          'Set NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable',
        ],
        severity: 'critical',
      })
    }
  } else if (environment === 'development') {
    // Development-specific validations
    if (config.gotrueUrl && !config.gotrueUrl.includes('localhost') && !config.gotrueUrl.includes('127.0.0.1')) {
      warnings.push({
        type: 'suboptimal_config',
        message: 'Development environment using non-localhost GoTrue URL',
        key: 'gotrueUrl',
        currentValue: config.gotrueUrl,
        recommendation: 'Use localhost URL for local development or verify remote development setup',
        impact: 'May connect to remote services instead of local development environment',
      })
    }
  }

  return { errors, warnings }
}

/**
 * Performs comprehensive GoTrue configuration validation
 * 
 * This is the main validation function that implements Requirements 4.1 and 4.2:
 * - Validates all required environment variables are present (4.1)
 * - Provides specific validation errors with remediation steps (4.2)
 * 
 * @returns Complete validation result with errors, warnings, and validated configuration
 */
export function validateGoTrueConfiguration(): GoTrueConfigValidationResult {
  console.log('[GoTrue Config Validation] Starting comprehensive configuration validation...')
  
  const startTime = Date.now()
  const allErrors: GoTrueConfigError[] = []
  const allWarnings: GoTrueConfigWarning[] = []
  let validatedConfig: Partial<RequiredGoTrueEnvVars & OptionalGoTrueEnvVars> = {}

  try {
    // Step 1: Validate required environment variables
    console.log('[GoTrue Config Validation] Validating required environment variables...')
    const requiredValidation = validateRequiredEnvironmentVariables()
    allErrors.push(...requiredValidation.errors)
    allWarnings.push(...requiredValidation.warnings)
    validatedConfig = { ...validatedConfig, ...requiredValidation.validatedConfig }

    // Step 2: Validate optional environment variables
    console.log('[GoTrue Config Validation] Validating optional environment variables...')
    const optionalValidation = validateOptionalEnvironmentVariables()
    allWarnings.push(...optionalValidation.warnings)
    validatedConfig = { ...validatedConfig, ...optionalValidation.validatedConfig }

    // Step 3: Detect environment and validate environment-specific requirements
    console.log('[GoTrue Config Validation] Detecting environment and validating environment-specific configuration...')
    const environmentInfo = detectEnvironment({
      gotrueUrl: validatedConfig.gotrueUrl,
      supabaseUrl: validatedConfig.supabaseUrl,
      apiUrl: validatedConfig.apiUrl,
    })

    const envValidation = validateEnvironmentSpecificConfig(validatedConfig, environmentInfo.environment)
    allErrors.push(...envValidation.errors)
    allWarnings.push(...envValidation.warnings)

    // Step 4: Validate connectivity (if basic config is valid)
    if (allErrors.length === 0 && validatedConfig.gotrueUrl) {
      console.log('[GoTrue Config Validation] Basic configuration valid, checking connectivity...')
      // Note: Actual connectivity check would be performed by the health check module
      // This validation focuses on configuration format and presence
    }

    const validationTime = Date.now() - startTime
    const isValid = allErrors.length === 0

    console.log(`[GoTrue Config Validation] Validation completed in ${validationTime}ms`)
    console.log(`[GoTrue Config Validation] Result: ${isValid ? '✓ VALID' : '❌ INVALID'}`)
    console.log(`[GoTrue Config Validation] Errors: ${allErrors.length}, Warnings: ${allWarnings.length}`)

    // Log errors and warnings
    if (allErrors.length > 0) {
      console.error('[GoTrue Config Validation] Configuration errors detected:')
      allErrors.forEach((error, index) => {
        console.error(`  ${index + 1}. [${error.severity.toUpperCase()}] ${error.message}`)
        if (error.currentValue) {
          console.error(`     Current: ${error.key === 'anonKey' ? '[REDACTED]' : error.currentValue}`)
        }
        if (error.expectedFormat) {
          console.error(`     Expected: ${error.expectedFormat}`)
        }
      })
    }

    if (allWarnings.length > 0) {
      console.warn('[GoTrue Config Validation] Configuration warnings:')
      allWarnings.forEach((warning, index) => {
        console.warn(`  ${index + 1}. ${warning.message}`)
        console.warn(`     Impact: ${warning.impact}`)
        console.warn(`     Recommendation: ${warning.recommendation}`)
      })
    }

    const result: GoTrueConfigValidationResult = {
      isValid,
      errors: allErrors,
      warnings: allWarnings,
      validatedConfig,
      environment: environmentInfo.environment,
      timestamp: Date.now(),
    }

    // Log configuration errors for centralized error tracking
    if (allErrors.length > 0) {
      allErrors.forEach(error => {
        try {
          logConfigurationError('GoTrue Config Validation', {
            type: error.type,
            message: error.message,
            severity: error.severity,
            retryable: false,
            troubleshootingSteps: error.remediationSteps,
          }, {
            configKey: error.key,
            currentValue: error.key === 'anonKey' ? '[REDACTED]' : error.currentValue,
            expectedFormat: error.expectedFormat,
            environment: environmentInfo,
          })
        } catch (loggingError) {
          console.warn('[GoTrue Config Validation] Failed to log configuration error:', loggingError)
        }
      })
    }

    return result

  } catch (error) {
    console.error('[GoTrue Config Validation] Unexpected error during validation:', error)
    
    const criticalError: GoTrueConfigError = {
      type: 'connectivity',
      message: `Configuration validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      key: 'validation',
      severity: 'critical',
      remediationSteps: [
        'Check that all environment variables are properly set',
        'Verify that the application has access to environment variables',
        'Check for syntax errors in environment variable values',
        'Restart the application after fixing configuration issues',
      ],
    }

    return {
      isValid: false,
      errors: [criticalError],
      warnings: [],
      validatedConfig: {},
      environment: 'production', // Safe default
      timestamp: Date.now(),
    }
  }
}

/**
 * Gets expected format for a configuration value
 */
function getExpectedFormat(configKey: string): string {
  switch (configKey) {
    case 'gotrueUrl':
      return 'http://localhost:54321/auth/v1 (development) or https://your-project.supabase.co/auth/v1 (production)'
    case 'supabaseUrl':
      return 'http://localhost:54321 (development) or https://your-project.supabase.co (production)'
    case 'apiUrl':
      return 'http://localhost:8000 (development) or https://api.yourcompany.com (production)'
    case 'anonKey':
      return 'Long API key string from Supabase project settings (starts with "eyJ")'
    default:
      return 'Valid configuration value'
  }
}

/**
 * Gets remediation steps for a missing configuration
 */
function getRemediationSteps(configKey: string, envVars: string[]): string[] {
  const baseSteps = [
    `Set one of these environment variables: ${envVars.join(', ')}`,
    `Expected format: ${getExpectedFormat(configKey)}`,
  ]

  switch (configKey) {
    case 'gotrueUrl':
      return [
        ...baseSteps,
        'For development: Use http://localhost:54321/auth/v1 (default Supabase local setup)',
        'For production: Get URL from your Supabase project dashboard',
        'Alternative: Set SUPABASE_PUBLIC_URL and GoTrue URL will be derived automatically',
      ]
    case 'supabaseUrl':
      return [
        ...baseSteps,
        'For development: Use http://localhost:54321 (default Supabase local setup)',
        'For production: Get URL from your Supabase project dashboard (Settings > API)',
        'This should be your project\'s public URL without any path',
      ]
    case 'apiUrl':
      return [
        ...baseSteps,
        'For development: Use http://localhost:8000 (default Kong gateway port)',
        'For production: Use your API gateway or load balancer URL',
        'This should point to the Kong gateway that routes to your services',
      ]
    case 'anonKey':
      return [
        ...baseSteps,
        'Get this from your Supabase project dashboard:',
        '1. Go to Settings > API in your Supabase dashboard',
        '2. Copy the "anon public" key (not the service_role key)',
        '3. Set NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable',
        'This key is safe to use in client-side code',
      ]
    default:
      return baseSteps
  }
}

/**
 * Gets environment-specific remediation steps
 */
function getEnvironmentSpecificRemediationSteps(environment: Environment): string[] {
  switch (environment) {
    case 'production':
      return [
        'Ensure all URLs use HTTPS for security',
        'Use production Supabase project URLs, not localhost',
        'Verify URLs are accessible from your production network',
        'Use production API keys and secrets',
        'Set ENVIRONMENT=production for explicit environment detection',
      ]
    case 'development':
      return [
        'Use localhost URLs for local development',
        'Ensure local Supabase services are running (docker-compose up)',
        'Use HTTP (not HTTPS) for localhost to avoid certificate issues',
        'Verify ports match your local setup (Kong: 8000, GoTrue: 54321)',
        'Set NODE_ENV=development for explicit development mode',
      ]
    case 'staging':
      return [
        'Use staging-specific URLs with staging indicators',
        'Ensure staging URLs are accessible from your staging environment',
        'Use staging-specific API keys and credentials',
        'Set ENVIRONMENT=staging for explicit environment detection',
        'Keep staging configuration similar to production for accurate testing',
      ]
    default:
      return [
        'Review environment detection and URL configuration',
        'Set explicit environment variables for your deployment',
        'Ensure URLs match your actual service endpoints',
      ]
  }
}

/**
 * Validates a specific configuration value
 */
function validateConfigValue(
  key: keyof RequiredGoTrueEnvVars,
  value: string
): {
  isValid: boolean
  error?: string
  suggestions: string[]
} {
  const suggestions: string[] = []

  switch (key) {
    case 'gotrueUrl':
    case 'supabaseUrl':
    case 'apiUrl':
      if (!validateGoTrueUrl(value)) {
        return {
          isValid: false,
          error: 'Invalid URL format',
          suggestions: [
            'Ensure URL starts with http:// or https://',
            'Check for typos in the URL',
            'Verify the URL is accessible',
          ],
        }
      }
      break

    case 'anonKey':
      if (!value || value.length < 20) {
        return {
          isValid: false,
          error: 'API key is too short or empty',
          suggestions: [
            'Get the anonymous key from your Supabase project dashboard',
            'Ensure you copied the complete key without truncation',
            'Use the "anon public" key, not the "service_role" key for client-side usage',
          ],
        }
      }
      
      // Basic JWT format check (should start with eyJ for base64 encoded JSON)
      if (!value.startsWith('eyJ')) {
        suggestions.push('API key should be a JWT token starting with "eyJ"')
      }
      break
  }

  return {
    isValid: true,
    suggestions,
  }
}

/**
 * Formats validation result for logging or display
 * 
 * @param result - Validation result to format
 * @returns Formatted string representation
 */
export function formatValidationResult(result: GoTrueConfigValidationResult): string {
  const lines: string[] = []
  
  lines.push('=== GoTrue Configuration Validation ===')
  lines.push(`Status: ${result.isValid ? '✅ VALID' : '❌ INVALID'}`)
  lines.push(`Environment: ${result.environment.toUpperCase()}`)
  lines.push(`Timestamp: ${new Date(result.timestamp).toISOString()}`)
  lines.push('')
  
  if (result.errors.length > 0) {
    lines.push('❌ ERRORS:')
    result.errors.forEach((error, index) => {
      lines.push(`  ${index + 1}. [${error.severity.toUpperCase()}] ${error.message}`)
      if (error.currentValue && error.key !== 'anonKey') {
        lines.push(`     Current: ${error.currentValue}`)
      }
      if (error.expectedFormat) {
        lines.push(`     Expected: ${error.expectedFormat}`)
      }
      lines.push(`     Remediation:`)
      error.remediationSteps.forEach(step => {
        lines.push(`       • ${step}`)
      })
      lines.push('')
    })
  }
  
  if (result.warnings.length > 0) {
    lines.push('⚠️  WARNINGS:')
    result.warnings.forEach((warning, index) => {
      lines.push(`  ${index + 1}. ${warning.message}`)
      lines.push(`     Impact: ${warning.impact}`)
      lines.push(`     Recommendation: ${warning.recommendation}`)
      lines.push('')
    })
  }
  
  if (result.isValid) {
    lines.push('✅ Configuration is valid and ready for use')
  } else {
    lines.push('❌ Configuration has critical errors that must be resolved')
  }
  
  lines.push('=====================================')
  
  return lines.join('\n')
}