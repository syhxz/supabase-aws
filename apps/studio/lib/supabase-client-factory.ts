/**
 * Supabase Client Factory
 * 
 * Centralized factory for creating validated Supabase clients throughout the Studio application.
 * This ensures consistent URL validation, environment detection, and logging across all client usage.
 * 
 * Requirements implemented:
 * - 3.1: Add validation that production environments use production URLs
 * - 3.2: Ensure NEXT_PUBLIC_SUPABASE_URL takes priority over hardcoded URLs
 * - 3.5: Add logging for frontend client initialization URLs
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { createValidatedSupabaseClient } from './frontend-client-helpers'
import { FrontendClientConfig } from 'common/frontend-client-validation'

/**
 * Default Supabase client instance for the Studio application
 * This client is created with full validation and environment detection
 */
let defaultClient: SupabaseClient | null = null

/**
 * Gets or creates the default Supabase client for the Studio application
 * This client uses validated configuration and proper URL priority handling
 */
export function getSupabaseClient(): SupabaseClient {
  if (!defaultClient) {
    console.log('[Supabase Client Factory] Creating default Supabase client')
    defaultClient = createValidatedSupabaseClient()
  }
  return defaultClient
}

/**
 * Creates a new Supabase client with custom configuration
 * while still maintaining URL validation and environment detection
 */
export function createCustomSupabaseClient(
  customConfig: Partial<FrontendClientConfig>
): SupabaseClient {
  console.log('[Supabase Client Factory] Creating custom Supabase client')
  return createValidatedSupabaseClient(customConfig)
}

/**
 * Creates a Supabase client for administrative operations
 * This typically uses service role keys and may have different configuration
 */
export function createAdminSupabaseClient(
  serviceRoleKey: string,
  customConfig?: Partial<FrontendClientConfig>
): SupabaseClient {
  console.log('[Supabase Client Factory] Creating admin Supabase client')
  
  return createValidatedSupabaseClient({
    ...customConfig,
    anonKey: serviceRoleKey,
    options: {
      ...customConfig?.options,
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        ...customConfig?.options?.auth,
      },
    },
  })
}

/**
 * Creates a Supabase client for support operations
 * Uses the support API URL and key if configured
 */
export function createSupportSupabaseClient(): SupabaseClient {
  const supportApiUrl = process.env.NEXT_PUBLIC_SUPPORT_API_URL
  const supportApiKey = process.env.SUPPORT_SUPABASE_SECRET_KEY

  if (!supportApiUrl || !supportApiKey) {
    throw new Error(
      'Support Supabase client requires NEXT_PUBLIC_SUPPORT_API_URL and SUPPORT_SUPABASE_SECRET_KEY environment variables'
    )
  }

  console.log('[Supabase Client Factory] Creating support Supabase client')
  
  return createValidatedSupabaseClient({
    supabaseUrl: supportApiUrl,
    anonKey: supportApiKey,
    options: {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  })
}

/**
 * Resets the default client instance
 * Useful for testing or when configuration changes
 */
export function resetDefaultClient(): void {
  console.log('[Supabase Client Factory] Resetting default Supabase client')
  defaultClient = null
}

/**
 * Legacy compatibility function
 * Provides a direct replacement for createClient calls with validation
 * 
 * @deprecated Use getSupabaseClient() or createValidatedSupabaseClient() instead
 */
export function createClientWithValidation(
  supabaseUrl?: string,
  supabaseKey?: string,
  options?: any
): SupabaseClient {
  console.warn('[Supabase Client Factory] Using deprecated createClientWithValidation. Consider using getSupabaseClient() instead.')
  
  if (supabaseUrl && supabaseKey) {
    // Custom URL and key provided, use them but still validate
    return createValidatedSupabaseClient({
      supabaseUrl,
      anonKey: supabaseKey,
      options,
    })
  } else {
    // No custom config, use default validated client
    return getSupabaseClient()
  }
}

/**
 * Validates that a Supabase client is properly configured
 * Useful for runtime checks and debugging
 */
export function validateSupabaseClient(client: SupabaseClient): {
  isValid: boolean
  issues: string[]
  recommendations: string[]
} {
  const issues: string[] = []
  const recommendations: string[] = []

  try {
    // Check if client has required properties
    if (!client.supabaseUrl) {
      issues.push('Client missing supabaseUrl property')
    }

    if (!client.supabaseKey) {
      issues.push('Client missing supabaseKey property')
    }

    // Check URL format
    if (client.supabaseUrl) {
      try {
        new URL(client.supabaseUrl)
      } catch {
        issues.push(`Invalid supabaseUrl format: ${client.supabaseUrl}`)
      }

      // Check for localhost in production
      if (typeof window !== 'undefined' && 
          window.location.hostname !== 'localhost' && 
          client.supabaseUrl.includes('localhost')) {
        issues.push('Client using localhost URL in non-localhost environment')
        recommendations.push('Set NEXT_PUBLIC_SUPABASE_URL to production URL')
      }
    }

    // Check if client can perform basic operations
    if (typeof client.auth?.getSession !== 'function') {
      issues.push('Client missing auth.getSession method')
    }

    if (typeof client.from !== 'function') {
      issues.push('Client missing from method for database operations')
    }

  } catch (error) {
    issues.push(`Client validation error: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  return {
    isValid: issues.length === 0,
    issues,
    recommendations,
  }
}

/**
 * Development helper: Logs information about all active Supabase clients
 */
export function debugSupabaseClients(): void {
  console.log('[Supabase Client Factory] === SUPABASE CLIENT DEBUG INFO ===')
  
  if (defaultClient) {
    console.log('[Supabase Client Factory] Default client:')
    console.log('[Supabase Client Factory]   URL:', defaultClient.supabaseUrl)
    console.log('[Supabase Client Factory]   Key:', defaultClient.supabaseKey ? '***' : 'NOT SET')
    
    const validation = validateSupabaseClient(defaultClient)
    console.log('[Supabase Client Factory]   Valid:', validation.isValid ? '✅' : '❌')
    if (validation.issues.length > 0) {
      console.log('[Supabase Client Factory]   Issues:', validation.issues)
    }
  } else {
    console.log('[Supabase Client Factory] No default client created yet')
  }
  
  console.log('[Supabase Client Factory] Environment variables:')
  console.log('[Supabase Client Factory]   NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT SET')
  console.log('[Supabase Client Factory]   NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '***' : 'NOT SET')
  console.log('[Supabase Client Factory]   SUPABASE_PUBLIC_URL:', process.env.SUPABASE_PUBLIC_URL || 'NOT SET')
  
  console.log('[Supabase Client Factory] =======================================')
}