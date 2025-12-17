/**
 * Configuration Validation Service
 * 
 * Provides comprehensive configuration validation with detailed error handling
 * and user guidance. Integrates with the error handling and guidance system.
 */

import { detectEnvironment, logEnvironmentInfo } from 'common/environment-detection'
import { 
  analyzeEnvironmentForErrors,
  logConfigurationError,
  generateTroubleshootingGuide,
  generateFallbackRecommendations,
  generateProductionLocalhostError,
  generateConfigurationValidationError,
  generateUrlValidationError,
  generateDockerBuildVariableError,
  ConfigurationError,
  UserGuidanceContext,
  ErrorSeverity
} from 'common/error-handling-guidance'
import { validateFrontendClientUrls, validateFrontendEnvironmentVariables } from 'common/frontend-client-validation'

/**
 * Comprehensive configuration validation result
 */
export interface ConfigurationValidationResult {
  /** Overall validation status */
  isValid: boolean
  /** Validation summary message */
  summary: string
  /** All detected errors */
  errors: ConfigurationError[]
  /** Critical errors that prevent operation */
  criticalErrors: ConfigurationError[]
  /** Warnings that should be addressed */
  warnings: ConfigurationError[]
  /** Informational messages */
  info: ConfigurationError[]
  /** Environment detection result */
  environmentInfo: ReturnType<typeof detectEnvironment>
  /** Frontend validation result */
  frontendValidation: ReturnType<typeof validateFrontendClientUrls>
  /** Environment variables validation */
  envVarValidation: ReturnType<typeof validateFrontendEnvironmentVariables>
  /** Troubleshooting guide for current environment */
  troubleshootingGuide: ReturnType<typeof generateTroubleshootingGuide>
  /** Validation timestamp */
  timestamp: string
}

/**
 * Configuration validation options
 */
export interface ValidationOptions {
  /** Whether to include frontend validation */
  includeFrontend?: boolean
  /** Whether to include Docker-specific checks */
  includeDockerChecks?: boolean
  /** Whether to log results to console */
  logResults?: boolean
  /** Custom URLs to validate */
  customUrls?: {
    supabaseUrl?: string
    gotrueUrl?: string
    apiUrl?: string
  }
}

/**
 * Performs comprehensive configuration validation
 */
export function validateConfiguration(options: ValidationOptions = {}): ConfigurationValidationResult {
  const {
    includeFrontend = true,
    includeDockerChecks = true,
    logResults = true,
    customUrls = {}
  } = options

  const timestamp = new Date().toISOString()
  
  console.log('[Configuration Validation] 🔍 Starting comprehensive configuration validation')
  console.log('[Configuration Validation] Timestamp:', timestamp)

  // Detect environment
  const environmentInfo = detectEnvironment(customUrls)
  
  // Get current URLs
  const urls = {
    supabaseUrl: customUrls.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_PUBLIC_URL || process.env.SUPABASE_URL,
    gotrueUrl: customUrls.gotrueUrl || process.env.NEXT_PUBLIC_GOTRUE_URL,
    apiUrl: customUrls.apiUrl || process.env.API_EXTERNAL_URL,
  }

  // Analyze environment for errors
  const environmentErrors = analyzeEnvironmentForErrors(environmentInfo, urls)

  // Frontend validation
  let frontendValidation: ReturnType<typeof validateFrontendClientUrls> | null = null
  let frontendErrors: ConfigurationError[] = []
  
  if (includeFrontend && urls.supabaseUrl) {
    frontendValidation = validateFrontendClientUrls(urls.supabaseUrl, urls.gotrueUrl, environmentInfo.environment)
    
    // Convert frontend validation errors to configuration errors
    if (!frontendValidation.isValid) {
      const context: UserGuidanceContext = {
        environment: environmentInfo.environment,
        isDocker: environmentInfo.detectionPhase.dockerBuild || false,
        isBuildTime: environmentInfo.detectionPhase.isBuildTime,
        availableVariables: environmentInfo.environmentVariables.filter(v => v.available).map(v => v.name),
        missingVariables: environmentInfo.missingVariables,
        currentUrls: urls,
      }

      // Production-localhost mismatch errors
      const localhostErrors = frontendValidation.errors.filter(error => 
        error.includes('localhost') && environmentInfo.environment === 'production'
      )
      
      if (localhostErrors.length > 0) {
        const localhostUrls = Object.values(urls).filter(url => 
          url && (url.includes('localhost') || url.includes('127.0.0.1'))
        )
        frontendErrors.push(generateProductionLocalhostError(localhostUrls, context))
      }

      // URL validation errors
      const urlErrors = frontendValidation.errors.filter(error => 
        error.includes('Invalid') || error.includes('format')
      )
      
      if (urlErrors.length > 0) {
        const invalidUrls = Object.entries(urls)
          .filter(([_, url]) => {
            if (!url) return false
            try {
              new URL(url)
              return false
            } catch {
              return true
            }
          })
          .map(([key, url]) => ({ url: url!, error: 'Invalid URL format' }))

        if (invalidUrls.length > 0) {
          frontendErrors.push(generateUrlValidationError(invalidUrls, context))
        }
      }
    }
  }

  // Environment variables validation
  let envVarValidation: ReturnType<typeof validateFrontendEnvironmentVariables> | null = null
  let envVarErrors: ConfigurationError[] = []
  
  if (includeFrontend) {
    envVarValidation = validateFrontendEnvironmentVariables()
    
    if (!envVarValidation.isValid) {
      const context: UserGuidanceContext = {
        environment: environmentInfo.environment,
        isDocker: environmentInfo.detectionPhase.dockerBuild || false,
        isBuildTime: environmentInfo.detectionPhase.isBuildTime,
        availableVariables: environmentInfo.environmentVariables.filter(v => v.available).map(v => v.name),
        missingVariables: environmentInfo.missingVariables,
        currentUrls: urls,
      }

      const missingVars = envVarValidation.environmentVariables
        .filter(v => v.recommended && !v.present)
        .map(v => v.name)

      if (missingVars.length > 0) {
        envVarErrors.push(generateConfigurationValidationError(missingVars, [], context))
      }
    }
  }

  // Docker-specific validation
  let dockerErrors: ConfigurationError[] = []
  
  if (includeDockerChecks && environmentInfo.detectionPhase.dockerBuild) {
    const criticalDockerVars = ['ENVIRONMENT', 'NODE_ENV', 'SUPABASE_PUBLIC_URL']
    const missingDockerVars = criticalDockerVars.filter(varName => 
      !environmentInfo.environmentVariables.find(v => v.name === varName && v.available)
    )

    if (missingDockerVars.length > 0) {
      const context: UserGuidanceContext = {
        environment: environmentInfo.environment,
        isDocker: true,
        isBuildTime: environmentInfo.detectionPhase.isBuildTime,
        availableVariables: environmentInfo.environmentVariables.filter(v => v.available).map(v => v.name),
        missingVariables: environmentInfo.missingVariables,
        currentUrls: urls,
      }

      dockerErrors.push(generateDockerBuildVariableError(missingDockerVars, context))
    }
  }

  // Combine all errors
  const allErrors = [...environmentErrors, ...frontendErrors, ...envVarErrors, ...dockerErrors]

  // Categorize errors by severity
  const criticalErrors = allErrors.filter(e => e.severity === 'critical')
  const errors = allErrors.filter(e => e.severity === 'error')
  const warnings = allErrors.filter(e => e.severity === 'warning')
  const info = allErrors.filter(e => e.severity === 'info')

  // Determine overall validation status
  const isValid = criticalErrors.length === 0 && errors.length === 0

  // Generate summary
  let summary: string
  if (isValid && warnings.length === 0) {
    summary = '✅ Configuration is valid and optimal'
  } else if (isValid) {
    summary = `⚠️ Configuration is valid but has ${warnings.length} warnings`
  } else if (criticalErrors.length > 0) {
    summary = `🚨 Configuration has ${criticalErrors.length} critical errors that prevent operation`
  } else {
    summary = `❌ Configuration has ${errors.length} errors that need to be fixed`
  }

  // Get troubleshooting guide
  const troubleshootingGuide = generateTroubleshootingGuide(environmentInfo.environment)

  const result: ConfigurationValidationResult = {
    isValid,
    summary,
    errors: allErrors,
    criticalErrors,
    warnings,
    info,
    environmentInfo,
    frontendValidation: frontendValidation!,
    envVarValidation: envVarValidation!,
    troubleshootingGuide,
    timestamp,
  }

  // Log results if requested
  if (logResults) {
    logValidationResults(result)
  }

  return result
}

/**
 * Logs comprehensive validation results
 */
export function logValidationResults(result: ConfigurationValidationResult): void {
  const prefix = 'Configuration Validation'
  
  console.log(`[${prefix}] === VALIDATION SUMMARY ===`)
  console.log(`[${prefix}] ${result.summary}`)
  console.log(`[${prefix}] Environment: ${result.environmentInfo.environment.toUpperCase()}`)
  console.log(`[${prefix}] Timestamp: ${result.timestamp}`)
  console.log(`[${prefix}] Total Issues: ${result.errors.length}`)
  console.log(`[${prefix}]   Critical: ${result.criticalErrors.length}`)
  console.log(`[${prefix}]   Errors: ${result.errors.filter(e => e.severity === 'error').length}`)
  console.log(`[${prefix}]   Warnings: ${result.warnings.length}`)
  console.log(`[${prefix}]   Info: ${result.info.length}`)

  // Log critical errors first
  if (result.criticalErrors.length > 0) {
    console.log(`[${prefix}] === CRITICAL ERRORS ===`)
    result.criticalErrors.forEach((error, index) => {
      console.log(`[${prefix}] Critical Error ${index + 1}/${result.criticalErrors.length}:`)
      logConfigurationError(error, {
        environment: result.environmentInfo.environment,
        isDocker: result.environmentInfo.detectionPhase.dockerBuild || false,
        isBuildTime: result.environmentInfo.detectionPhase.isBuildTime,
        availableVariables: result.environmentInfo.environmentVariables.filter(v => v.available).map(v => v.name),
        missingVariables: result.environmentInfo.missingVariables,
        currentUrls: {
          supabaseUrl: process.env.SUPABASE_PUBLIC_URL || process.env.SUPABASE_URL,
          gotrueUrl: process.env.NEXT_PUBLIC_GOTRUE_URL,
          apiUrl: process.env.API_EXTERNAL_URL,
        },
      }, prefix)
    })
  }

  // Log regular errors
  const regularErrors = result.errors.filter(e => e.severity === 'error')
  if (regularErrors.length > 0) {
    console.log(`[${prefix}] === ERRORS ===`)
    regularErrors.forEach((error, index) => {
      console.log(`[${prefix}] Error ${index + 1}/${regularErrors.length}:`)
      logConfigurationError(error, {
        environment: result.environmentInfo.environment,
        isDocker: result.environmentInfo.detectionPhase.dockerBuild || false,
        isBuildTime: result.environmentInfo.detectionPhase.isBuildTime,
        availableVariables: result.environmentInfo.environmentVariables.filter(v => v.available).map(v => v.name),
        missingVariables: result.environmentInfo.missingVariables,
        currentUrls: {
          supabaseUrl: process.env.SUPABASE_PUBLIC_URL || process.env.SUPABASE_URL,
          gotrueUrl: process.env.NEXT_PUBLIC_GOTRUE_URL,
          apiUrl: process.env.API_EXTERNAL_URL,
        },
      }, prefix)
    })
  }

  // Log warnings (condensed)
  if (result.warnings.length > 0) {
    console.log(`[${prefix}] === WARNINGS ===`)
    result.warnings.forEach((warning, index) => {
      console.log(`[${prefix}] Warning ${index + 1}: ${warning.message}`)
      console.log(`[${prefix}]   ${warning.description}`)
      if (warning.recommendations.length > 0) {
        console.log(`[${prefix}]   Recommendation: ${warning.recommendations[0]}`)
      }
    })
  }

  // Log troubleshooting guide for critical/error cases
  if (result.criticalErrors.length > 0 || regularErrors.length > 0) {
    console.log(`[${prefix}] === TROUBLESHOOTING GUIDE ===`)
    console.log(`[${prefix}] ${result.troubleshootingGuide.title}`)
    
    console.log(`[${prefix}] Common Issues:`)
    result.troubleshootingGuide.commonIssues.forEach((issue, index) => {
      console.log(`[${prefix}]   ${index + 1}. ${issue}`)
    })

    console.log(`[${prefix}] Quick Fixes:`)
    result.troubleshootingGuide.quickFixes.forEach((fix, index) => {
      console.log(`[${prefix}]   ${index + 1}. ${fix}`)
    })

    console.log(`[${prefix}] Diagnostic Commands:`)
    result.troubleshootingGuide.diagnosticCommands.forEach((cmd, index) => {
      console.log(`[${prefix}]   ${index + 1}. ${cmd}`)
    })
  }

  console.log(`[${prefix}] =======================================`)
}

/**
 * Validates configuration and throws error if critical issues are found
 */
export function validateConfigurationOrThrow(options: ValidationOptions = {}): ConfigurationValidationResult {
  const result = validateConfiguration(options)
  
  if (result.criticalErrors.length > 0) {
    const errorMessages = result.criticalErrors.map(e => e.message).join('\n')
    throw new Error(`Critical configuration errors detected:\n${errorMessages}`)
  }

  return result
}

/**
 * Quick configuration health check
 */
export function quickHealthCheck(): {
  isHealthy: boolean
  summary: string
  criticalIssues: number
  recommendations: string[]
} {
  const result = validateConfiguration({ logResults: false })
  
  return {
    isHealthy: result.isValid && result.criticalErrors.length === 0,
    summary: result.summary,
    criticalIssues: result.criticalErrors.length,
    recommendations: result.criticalErrors.length > 0 
      ? result.criticalErrors[0].recommendations.slice(0, 3)
      : result.warnings.length > 0
      ? result.warnings[0].recommendations.slice(0, 2)
      : ['Configuration is healthy'],
  }
}