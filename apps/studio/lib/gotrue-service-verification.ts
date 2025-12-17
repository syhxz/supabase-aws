/**
 * GoTrue Service Configuration Verification
 * 
 * Validates GoTrue service configuration including environment variables,
 * health endpoint exposure, and startup configuration according to requirements 4.1 and 4.2.
 */

import { getGoTrueUrl, validateGoTrueUrl } from 'common/gotrue-config'
import { checkGoTrueHealth } from './gotrue-health'
import { 
  logFailedRequest, 
  logSuccessfulRequest, 
  type RequestLogInfo 
} from 'common/configuration-logging'

export interface GoTrueServiceConfig {
  /** GoTrue service URL */
  url: string
  /** Source of the URL configuration */
  source: 'runtime' | 'explicit' | 'derived-public' | 'derived' | 'default'
  /** Whether the URL is valid */
  isValidUrl: boolean
  /** API key configuration status */
  hasApiKey: boolean
  /** Environment variables validation */
  environmentVariables: EnvironmentVariableValidation
  /** Health endpoint accessibility */
  healthEndpoint: HealthEndpointValidation
  /** Service startup configuration */
  startupConfig: StartupConfigValidation
}

export interface EnvironmentVariableValidation {
  /** Whether all required environment variables are present */
  allPresent: boolean
  /** Individual variable validation results */
  variables: {
    [key: string]: {
      present: boolean
      valid: boolean
      value?: string
      error?: string
    }
  }
  /** Missing required variables */
  missing: string[]
  /** Invalid variables */
  invalid: string[]
}

export interface HealthEndpointValidation {
  /** Whether health endpoint is accessible */
  accessible: boolean
  /** Whether health endpoint is properly exposed */
  properlyExposed: boolean
  /** Health check response details */
  response?: {
    status: number
    responseTime: number
    data?: any
  }
  /** Error details if health check failed */
  error?: string
}

export interface StartupConfigValidation {
  /** Whether GoTrue service startup configuration is valid */
  valid: boolean
  /** Configuration validation results */
  checks: {
    [key: string]: {
      valid: boolean
      error?: string
    }
  }
  /** Validation errors */
  errors: string[]
}

/**
 * Required environment variables for GoTrue service configuration
 */
const REQUIRED_ENV_VARIABLES = [
  'NEXT_PUBLIC_GOTRUE_URL',
  'SUPABASE_ANON_KEY',
  'AUTH_JWT_SECRET',
] as const

/**
 * Optional but recommended environment variables
 */
const RECOMMENDED_ENV_VARIABLES = [
  'SUPABASE_PUBLIC_URL',
  'SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
] as const

/**
 * Validates GoTrue environment variables for health endpoint setup
 */
export function validateGoTrueEnvironmentVariables(): EnvironmentVariableValidation {
  const variables: EnvironmentVariableValidation['variables'] = {}
  const missing: string[] = []
  const invalid: string[] = []

  // Check required variables
  for (const varName of REQUIRED_ENV_VARIABLES) {
    const value = process.env[varName]
    const present = !!value
    let valid = present
    let error: string | undefined

    if (!present) {
      missing.push(varName)
      valid = false
      error = 'Environment variable not set'
    } else {
      // Validate specific variable formats
      if (varName.includes('URL') && !validateGoTrueUrl(value)) {
        valid = false
        invalid.push(varName)
        error = 'Invalid URL format'
      } else if (varName.includes('KEY') && value.length < 32) {
        valid = false
        invalid.push(varName)
        error = 'Key too short (minimum 32 characters required)'
      }
    }

    variables[varName] = {
      present,
      valid,
      value: present ? value : undefined,
      error,
    }
  }

  // Check recommended variables
  for (const varName of RECOMMENDED_ENV_VARIABLES) {
    const value = process.env[varName]
    const present = !!value
    let valid = present
    let error: string | undefined

    if (present && varName.includes('URL') && !validateGoTrueUrl(value)) {
      valid = false
      error = 'Invalid URL format'
    }

    variables[varName] = {
      present,
      valid,
      value: present ? value : undefined,
      error,
    }
  }

  const allPresent = missing.length === 0

  return {
    allPresent,
    variables,
    missing,
    invalid,
  }
}

/**
 * Validates that GoTrue health endpoint is properly exposed
 */
export async function validateGoTrueHealthEndpoint(url?: string): Promise<HealthEndpointValidation> {
  try {
    console.log('[GoTrue Service Verification] Validating health endpoint exposure...')
    
    const healthResult = await checkGoTrueHealth(url)
    
    if (healthResult.available) {
      console.log('[GoTrue Service Verification] ✓ Health endpoint is accessible')
      
      return {
        accessible: true,
        properlyExposed: true,
        response: {
          status: 200,
          responseTime: healthResult.responseTime || 0,
          data: {
            version: healthResult.version,
            name: healthResult.name,
            description: healthResult.description,
          },
        },
      }
    } else {
      console.log('[GoTrue Service Verification] ✗ Health endpoint is not accessible')
      
      return {
        accessible: false,
        properlyExposed: false,
        error: healthResult.error || 'Health endpoint not accessible',
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.log('[GoTrue Service Verification] ✗ Health endpoint validation failed:', errorMessage)
    
    return {
      accessible: false,
      properlyExposed: false,
      error: `Health endpoint validation failed: ${errorMessage}`,
    }
  }
}

/**
 * Validates GoTrue service startup configuration
 */
export function validateGoTrueStartupConfig(): StartupConfigValidation {
  const checks: StartupConfigValidation['checks'] = {}
  const errors: string[] = []

  // Check GoTrue URL configuration
  const gotrueConfig = getGoTrueUrl()
  checks.gotrueUrl = {
    valid: !!gotrueConfig.url && validateGoTrueUrl(gotrueConfig.url),
    error: !gotrueConfig.url 
      ? 'GoTrue URL not configured' 
      : !validateGoTrueUrl(gotrueConfig.url)
      ? 'Invalid GoTrue URL format'
      : undefined,
  }

  if (!checks.gotrueUrl.valid) {
    errors.push(checks.gotrueUrl.error!)
  }

  // Check API key configuration
  const apiKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  checks.apiKey = {
    valid: !!apiKey && apiKey.length >= 32,
    error: !apiKey 
      ? 'API key not configured' 
      : apiKey.length < 32
      ? 'API key too short'
      : undefined,
  }

  if (!checks.apiKey.valid) {
    errors.push(checks.apiKey.error!)
  }

  // Check JWT secret configuration
  const jwtSecret = process.env.AUTH_JWT_SECRET || process.env.JWT_SECRET
  checks.jwtSecret = {
    valid: !!jwtSecret && jwtSecret.length >= 32,
    error: !jwtSecret 
      ? 'JWT secret not configured' 
      : jwtSecret.length < 32
      ? 'JWT secret too short'
      : undefined,
  }

  if (!checks.jwtSecret.valid) {
    errors.push(checks.jwtSecret.error!)
  }

  // Check environment consistency
  const gotrueUrl = process.env.NEXT_PUBLIC_GOTRUE_URL
  const supabaseUrl = process.env.SUPABASE_PUBLIC_URL || process.env.SUPABASE_URL
  
  if (gotrueUrl && supabaseUrl) {
    const expectedGotrueUrl = `${supabaseUrl.replace(/\/$/, '')}/auth/v1`
    const urlsConsistent = gotrueUrl === expectedGotrueUrl || gotrueUrl.startsWith(supabaseUrl)
    
    checks.urlConsistency = {
      valid: urlsConsistent,
      error: urlsConsistent 
        ? undefined 
        : `GoTrue URL (${gotrueUrl}) is not consistent with Supabase URL (${supabaseUrl})`,
    }

    if (!checks.urlConsistency.valid) {
      errors.push(checks.urlConsistency.error!)
    }
  }

  const valid = errors.length === 0

  return {
    valid,
    checks,
    errors,
  }
}

/**
 * Performs comprehensive GoTrue service configuration verification
 */
export async function verifyGoTrueServiceConfiguration(url?: string): Promise<GoTrueServiceConfig> {
  console.log('[GoTrue Service Verification] Starting comprehensive configuration verification...')
  
  // Get GoTrue URL configuration
  const gotrueConfig = getGoTrueUrl()
  const targetUrl = url || gotrueConfig.url
  
  // Validate environment variables
  console.log('[GoTrue Service Verification] Validating environment variables...')
  const environmentVariables = validateGoTrueEnvironmentVariables()
  
  // Validate health endpoint
  console.log('[GoTrue Service Verification] Validating health endpoint...')
  const healthEndpoint = await validateGoTrueHealthEndpoint(targetUrl)
  
  // Validate startup configuration
  console.log('[GoTrue Service Verification] Validating startup configuration...')
  const startupConfig = validateGoTrueStartupConfig()
  
  // Check API key availability
  const hasApiKey = !!(
    process.env.SUPABASE_ANON_KEY || 
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_GOTRUE_API_KEY
  )

  const config: GoTrueServiceConfig = {
    url: targetUrl,
    source: gotrueConfig.source,
    isValidUrl: validateGoTrueUrl(targetUrl),
    hasApiKey,
    environmentVariables,
    healthEndpoint,
    startupConfig,
  }

  // Log comprehensive verification results
  console.log('[GoTrue Service Verification] Configuration verification complete:')
  console.log(`  URL: ${config.url} (source: ${config.source})`)
  console.log(`  Valid URL: ${config.isValidUrl}`)
  console.log(`  Has API Key: ${config.hasApiKey}`)
  console.log(`  Environment Variables: ${environmentVariables.allPresent ? '✓' : '✗'} (${environmentVariables.missing.length} missing, ${environmentVariables.invalid.length} invalid)`)
  console.log(`  Health Endpoint: ${healthEndpoint.accessible ? '✓' : '✗'}`)
  console.log(`  Startup Config: ${startupConfig.valid ? '✓' : '✗'} (${startupConfig.errors.length} errors)`)

  // Log detailed issues if any
  if (environmentVariables.missing.length > 0) {
    console.log(`  Missing variables: ${environmentVariables.missing.join(', ')}`)
  }
  if (environmentVariables.invalid.length > 0) {
    console.log(`  Invalid variables: ${environmentVariables.invalid.join(', ')}`)
  }
  if (!healthEndpoint.accessible && healthEndpoint.error) {
    console.log(`  Health endpoint error: ${healthEndpoint.error}`)
  }
  if (!startupConfig.valid) {
    console.log(`  Startup config errors: ${startupConfig.errors.join(', ')}`)
  }

  // Create comprehensive log entry
  const requestInfo: RequestLogInfo = {
    url: targetUrl,
    method: 'VERIFICATION',
    success: config.isValidUrl && environmentVariables.allPresent && healthEndpoint.accessible && startupConfig.valid,
    context: {
      verification: true,
      source: config.source,
      hasApiKey: config.hasApiKey,
      environmentVariablesValid: environmentVariables.allPresent,
      healthEndpointAccessible: healthEndpoint.accessible,
      startupConfigValid: startupConfig.valid,
    },
  }

  if (requestInfo.success) {
    logSuccessfulRequest('GoTrue Service Verification', requestInfo)
  } else {
    const troubleshootingSteps = []
    
    if (!config.isValidUrl) {
      troubleshootingSteps.push('Fix GoTrue URL configuration - ensure valid HTTP/HTTPS URL')
    }
    if (!environmentVariables.allPresent) {
      troubleshootingSteps.push(`Set missing environment variables: ${environmentVariables.missing.join(', ')}`)
    }
    if (environmentVariables.invalid.length > 0) {
      troubleshootingSteps.push(`Fix invalid environment variables: ${environmentVariables.invalid.join(', ')}`)
    }
    if (!healthEndpoint.accessible) {
      troubleshootingSteps.push('Ensure GoTrue service is running and health endpoint is accessible')
      troubleshootingSteps.push('Check Docker services are started: docker compose up')
      troubleshootingSteps.push('Verify Kong Gateway is routing health requests correctly')
    }
    if (!startupConfig.valid) {
      troubleshootingSteps.push('Fix startup configuration errors')
      startupConfig.errors.forEach(error => {
        troubleshootingSteps.push(`  - ${error}`)
      })
    }

    requestInfo.error = 'GoTrue service configuration verification failed'
    logFailedRequest('GoTrue Service Verification', requestInfo, troubleshootingSteps)
  }

  return config
}

/**
 * Generates a configuration validation report
 */
export function generateGoTrueConfigReport(config: GoTrueServiceConfig): string {
  const lines = [
    '# GoTrue Service Configuration Report',
    '',
    `**URL:** ${config.url}`,
    `**Source:** ${config.source}`,
    `**Valid URL:** ${config.isValidUrl ? '✓' : '✗'}`,
    `**Has API Key:** ${config.hasApiKey ? '✓' : '✗'}`,
    '',
    '## Environment Variables',
    `**All Present:** ${config.environmentVariables.allPresent ? '✓' : '✗'}`,
  ]

  if (config.environmentVariables.missing.length > 0) {
    lines.push(`**Missing:** ${config.environmentVariables.missing.join(', ')}`)
  }

  if (config.environmentVariables.invalid.length > 0) {
    lines.push(`**Invalid:** ${config.environmentVariables.invalid.join(', ')}`)
  }

  lines.push(
    '',
    '## Health Endpoint',
    `**Accessible:** ${config.healthEndpoint.accessible ? '✓' : '✗'}`,
    `**Properly Exposed:** ${config.healthEndpoint.properlyExposed ? '✓' : '✗'}`
  )

  if (config.healthEndpoint.response) {
    lines.push(`**Response Time:** ${config.healthEndpoint.response.responseTime}ms`)
  }

  if (config.healthEndpoint.error) {
    lines.push(`**Error:** ${config.healthEndpoint.error}`)
  }

  lines.push(
    '',
    '## Startup Configuration',
    `**Valid:** ${config.startupConfig.valid ? '✓' : '✗'}`
  )

  if (config.startupConfig.errors.length > 0) {
    lines.push('**Errors:**')
    config.startupConfig.errors.forEach(error => {
      lines.push(`  - ${error}`)
    })
  }

  return lines.join('\n')
}