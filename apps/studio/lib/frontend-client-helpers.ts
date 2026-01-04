/**
 * Frontend Client Helpers
 * 
 * Provides helper functions for creating and validating Supabase clients
 * with proper URL validation and environment detection.
 * 
 * This module integrates the frontend client validation system with
 * the existing Studio application architecture.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import {
  createValidatedClientConfig,
  logFrontendClientInitialization,
  validateFrontendClientUrls,
  validateFrontendEnvironmentVariables,
  FrontendClientConfig,
} from 'common/frontend-client-validation'

/**
 * Creates a validated Supabase client with comprehensive URL validation
 * and environment-appropriate configuration.
 * 
 * This function should be used instead of directly calling createClient
 * to ensure proper URL validation and logging.
 */
export function createValidatedSupabaseClient(
  customConfig?: Partial<FrontendClientConfig>
): SupabaseClient {
  try {
    // Create validated configuration with comprehensive logging
    const config = createValidatedClientConfig(customConfig)

    // Create the Supabase client
    const client = createClient(config.supabaseUrl, config.anonKey, config.options)

    console.log(`[Frontend Client Helpers] ✅ Supabase client created successfully`)
    console.log(`[Frontend Client Helpers] Environment: ${config.supabaseUrl.includes('localhost') ? 'DEVELOPMENT' : 'PRODUCTION'}`)
    
    return client
  } catch (error) {
    console.error(`[Frontend Client Helpers] ❌ Failed to create Supabase client:`, error)
    throw error
  }
}

/**
 * Validates the current frontend environment configuration
 * and provides detailed feedback about any issues.
 */
export function validateCurrentFrontendConfig(): {
  isValid: boolean
  summary: string
  details: {
    environmentVariables: ReturnType<typeof validateFrontendEnvironmentVariables>
    urlValidation: ReturnType<typeof validateFrontendClientUrls>
  }
} {
  console.log(`[Frontend Client Helpers] 🔍 Validating frontend configuration...`)

  // Validate environment variables
  const envValidation = validateFrontendEnvironmentVariables()
  
  // Get current URLs and validate them
  const config = createValidatedClientConfig()
  const urlValidation = validateFrontendClientUrls(config.supabaseUrl, config.gotrueUrl)

  const isValid = envValidation.isValid && urlValidation.isValid
  const totalErrors = envValidation.errors.length + urlValidation.errors.length
  const totalWarnings = envValidation.warnings.length + urlValidation.warnings.length

  let summary: string
  if (isValid && totalWarnings === 0) {
    summary = '✅ Frontend configuration is valid and optimal'
  } else if (isValid) {
    summary = `⚠️ Frontend configuration is valid but has ${totalWarnings} warnings`
  } else {
    summary = `❌ Frontend configuration has ${totalErrors} errors and ${totalWarnings} warnings`
  }

  console.log(`[Frontend Client Helpers] ${summary}`)

  return {
    isValid,
    summary,
    details: {
      environmentVariables: envValidation,
      urlValidation,
    },
  }
}

/**
 * Performs a comprehensive health check of the frontend client configuration
 * including network connectivity tests (when possible).
 */
export async function performFrontendHealthCheck(): Promise<{
  isHealthy: boolean
  summary: string
  checks: {
    configuration: boolean
    urlReachability?: boolean
    authentication?: boolean
  }
  details: any
}> {
  console.log(`[Frontend Client Helpers] 🏥 Performing frontend health check...`)

  // Check configuration
  const configValidation = validateCurrentFrontendConfig()
  const configHealthy = configValidation.isValid

  let urlReachable: boolean | undefined
  let authWorking: boolean | undefined

  // Only perform network tests if configuration is valid and we're in browser
  if (configHealthy && typeof window !== 'undefined') {
    try {
      // Test URL reachability
      const config = createValidatedClientConfig()
      const healthUrl = `${config.supabaseUrl}/rest/v1/`
      
      console.log(`[Frontend Client Helpers] 🌐 Testing URL reachability: ${healthUrl}`)
      
      const response = await fetch(healthUrl, {
        method: 'GET',
        headers: {
          'apikey': config.anonKey,
          'Authorization': `Bearer ${config.anonKey}`,
        },
      })
      
      urlReachable = response.ok || response.status === 401 // 401 is OK, means auth is working
      
      if (urlReachable) {
        console.log(`[Frontend Client Helpers] ✅ URL is reachable`)
        
        // Test basic authentication
        try {
          const client = createValidatedSupabaseClient()
          const { data, error } = await client.auth.getSession()
          authWorking = !error || error.message.includes('session') // Session errors are OK
          
          if (authWorking) {
            console.log(`[Frontend Client Helpers] ✅ Authentication system is working`)
          } else {
            console.warn(`[Frontend Client Helpers] ⚠️ Authentication test failed:`, error)
          }
        } catch (authError) {
          console.warn(`[Frontend Client Helpers] ⚠️ Authentication test error:`, authError)
          authWorking = false
        }
      } else {
        console.error(`[Frontend Client Helpers] ❌ URL is not reachable: ${response.status} ${response.statusText}`)
      }
    } catch (networkError) {
      console.error(`[Frontend Client Helpers] ❌ Network test failed:`, networkError)
      urlReachable = false
    }
  }

  const isHealthy = configHealthy && (urlReachable !== false) && (authWorking !== false)
  
  let summary: string
  if (isHealthy) {
    summary = '✅ Frontend client is healthy and ready'
  } else if (!configHealthy) {
    summary = '❌ Frontend client has configuration issues'
  } else if (urlReachable === false) {
    summary = '❌ Frontend client cannot reach Supabase services'
  } else if (authWorking === false) {
    summary = '❌ Frontend client authentication is not working'
  } else {
    summary = '⚠️ Frontend client health check incomplete'
  }

  console.log(`[Frontend Client Helpers] ${summary}`)

  return {
    isHealthy,
    summary,
    checks: {
      configuration: configHealthy,
      urlReachability: urlReachable,
      authentication: authWorking,
    },
    details: {
      configValidation,
      timestamp: new Date().toISOString(),
    },
  }
}

/**
 * Gets environment-specific recommendations for frontend client setup
 */
export function getFrontendSetupRecommendations(): {
  environment: string
  recommendations: string[]
  examples: {
    environmentVariables: Record<string, string>
    dockerCompose?: Record<string, any>
  }
} {
  const config = createValidatedClientConfig()
  const validation = validateFrontendClientUrls(config.supabaseUrl, config.gotrueUrl)
  const environment = validation.detectedEnvironment

  let recommendations: string[] = []
  let examples: any = { environmentVariables: {} }

  if (environment === 'production') {
    recommendations = [
      '🔒 Production Frontend Setup:',
      '• Set NEXT_PUBLIC_SUPABASE_URL to your production Supabase URL',
      '• Set NEXT_PUBLIC_SUPABASE_ANON_KEY to your production anonymous key',
      '• Use HTTPS URLs for all services',
      '• Never use localhost URLs in production',
      '• Verify URLs are accessible from your production network',
      '• Consider using environment-specific API keys',
      '• Enable proper CORS settings in Supabase dashboard',
      '• Test client initialization in production environment',
    ]

    examples.environmentVariables = {
      'NEXT_PUBLIC_SUPABASE_URL': 'https://your-project.supabase.co',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY': 'your-production-anon-key',
      'ENVIRONMENT': 'production',
    }
  } else if (environment === 'development') {
    recommendations = [
      '🔧 Development Frontend Setup:',
      '• Ensure local Supabase services are running (docker-compose up)',
      '• Use localhost URLs for local development',
      '• Set NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321',
      '• Use development anonymous key',
      '• HTTP is acceptable for localhost',
      '• Verify ports 54321 (Supabase) and 8000 (Kong) are accessible',
      '• Check that docker-compose services are healthy',
      '• Use development-specific configuration',
    ]

    examples.environmentVariables = {
      'NEXT_PUBLIC_SUPABASE_URL': 'http://127.0.0.1:54321',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY': 'your-development-anon-key',
      'ENVIRONMENT': 'development',
    }

    examples.dockerCompose = {
      'services': {
        'studio': {
          'environment': [
            'NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321',
            'NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}',
            'ENVIRONMENT=development',
          ],
        },
      },
    }
  } else if (environment === 'staging') {
    recommendations = [
      '🧪 Staging Frontend Setup:',
      '• Use staging-specific Supabase project',
      '• Set NEXT_PUBLIC_SUPABASE_URL to staging URL',
      '• Use staging anonymous key',
      '• Mirror production setup as closely as possible',
      '• Test production-like configuration',
      '• Verify staging URLs are accessible',
      '• Use staging-specific environment variables',
      '• Test client behavior in staging environment',
    ]

    examples.environmentVariables = {
      'NEXT_PUBLIC_SUPABASE_URL': 'https://your-staging-project.supabase.co',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY': 'your-staging-anon-key',
      'ENVIRONMENT': 'staging',
    }
  }

  return {
    environment,
    recommendations,
    examples,
  }
}

/**
 * Logs comprehensive frontend client setup information
 * Useful for debugging and setup verification
 */
export function logFrontendSetupInfo(): void {
  console.log(`[Frontend Client Helpers] 📋 Frontend Client Setup Information`)
  console.log(`[Frontend Client Helpers] =====================================`)

  // Validate current configuration
  const configValidation = validateCurrentFrontendConfig()
  console.log(`[Frontend Client Helpers] Configuration Status: ${configValidation.summary}`)

  // Log environment variables
  const envVars = configValidation.details.environmentVariables.environmentVariables
  console.log(`[Frontend Client Helpers] Environment Variables:`)
  envVars.forEach(envVar => {
    const status = envVar.present ? '✓' : '✗'
    const priority = envVar.priority === 1 ? '(HIGH PRIORITY)' : `(priority ${envVar.priority})`
    const value = envVar.present 
      ? envVar.name.includes('KEY') 
        ? '***' 
        : envVar.value
      : 'NOT SET'
    console.log(`[Frontend Client Helpers]   ${status} ${envVar.name}: ${value} ${priority}`)
  })

  // Log URL validation
  const urlValidation = configValidation.details.urlValidation
  console.log(`[Frontend Client Helpers] URL Validation:`)
  console.log(`[Frontend Client Helpers]   Environment: ${urlValidation.detectedEnvironment.toUpperCase()}`)
  console.log(`[Frontend Client Helpers]   Valid: ${urlValidation.isValid ? '✅' : '❌'}`)
  console.log(`[Frontend Client Helpers]   Errors: ${urlValidation.errors.length}`)
  console.log(`[Frontend Client Helpers]   Warnings: ${urlValidation.warnings.length}`)

  // Log URL sources
  console.log(`[Frontend Client Helpers] URL Sources:`)
  urlValidation.urlSources.forEach(source => {
    const status = source.used ? '🎯 USED' : '⏭️ AVAILABLE'
    console.log(`[Frontend Client Helpers]   ${source.priority}. ${source.source}: ${status}`)
    console.log(`[Frontend Client Helpers]      URL: ${source.url}`)
  })

  // Log recommendations
  const setupRecs = getFrontendSetupRecommendations()
  console.log(`[Frontend Client Helpers] Setup Recommendations for ${setupRecs.environment.toUpperCase()}:`)
  setupRecs.recommendations.forEach(rec => {
    console.log(`[Frontend Client Helpers]   ${rec}`)
  })

  console.log(`[Frontend Client Helpers] =====================================`)
}

/**
 * Development helper: Validates that hardcoded URLs are not being used
 * when environment variables are available
 */
export function detectHardcodedUrls(clientCode: string): {
  hasHardcodedUrls: boolean
  hardcodedUrls: string[]
  recommendations: string[]
} {
  const hardcodedUrls: string[] = []
  const recommendations: string[] = []

  // Common hardcoded URL patterns
  const urlPatterns = [
    /['"`]https?:\/\/[^'"`\s]+\.supabase\.co[^'"`\s]*['"`]/g,
    /['"`]https?:\/\/localhost:\d+[^'"`\s]*['"`]/g,
    /['"`]https?:\/\/127\.0\.0\.1:\d+[^'"`\s]*['"`]/g,
    /['"`]https?:\/\/0\.0\.0\.0:\d+[^'"`\s]*['"`]/g,
  ]

  urlPatterns.forEach(pattern => {
    const matches = clientCode.match(pattern)
    if (matches) {
      hardcodedUrls.push(...matches.map(match => match.slice(1, -1))) // Remove quotes
    }
  })

  if (hardcodedUrls.length > 0) {
    recommendations.push(
      'Replace hardcoded URLs with environment variables:',
      '• Use process.env.NEXT_PUBLIC_SUPABASE_URL instead of hardcoded Supabase URLs',
      '• Use process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY instead of hardcoded API keys',
      '• Consider using the createValidatedSupabaseClient() helper function',
      '• This ensures proper URL priority and environment detection'
    )
  }

  return {
    hasHardcodedUrls: hardcodedUrls.length > 0,
    hardcodedUrls,
    recommendations,
  }
}