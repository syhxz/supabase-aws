#!/usr/bin/env ts-node
/**
 * Active Configuration Check Script
 * 
 * This script displays the currently active runtime configuration
 * and shows how it was derived.
 * 
 * Usage:
 *   pnpm tsx apps/studio/scripts/check-active-config.ts
 *   
 * Options:
 *   --verbose    Show detailed output including all environment variables
 *   --json       Output results as JSON
 *   --urls-only  Show only the resolved URLs
 */

import { fetchRuntimeConfig, getRuntimeConfig } from 'common/runtime-config'
import type { RuntimeConfig } from 'common/runtime-config'

interface ConfigDisplay {
  config: RuntimeConfig
  derivation: {
    gotrueUrl: string
    supabaseUrl: string
    apiUrl: string
    anonKey: string
  }
  environmentVariables: {
    NODE_ENV?: string
    NEXT_PUBLIC_GOTRUE_URL?: string
    SUPABASE_PUBLIC_URL?: string
    SUPABASE_URL?: string
    API_EXTERNAL_URL?: string
    NEXT_PUBLIC_API_URL?: string
    NEXT_PUBLIC_SUPABASE_ANON_KEY?: string
  }
}

/**
 * Determines how each configuration value was derived
 */
function determineDerivation(): {
  gotrueUrl: string
  supabaseUrl: string
  apiUrl: string
  anonKey: string
} {
  const explicitGotrueUrl = process.env.NEXT_PUBLIC_GOTRUE_URL
  const publicUrl = process.env.SUPABASE_PUBLIC_URL
  const internalUrl = process.env.SUPABASE_URL
  const explicitApiUrl = process.env.API_EXTERNAL_URL || process.env.NEXT_PUBLIC_API_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Determine GoTrue URL source
  let gotrueUrlSource: string
  if (explicitGotrueUrl) {
    gotrueUrlSource = 'NEXT_PUBLIC_GOTRUE_URL (explicit)'
  } else if (publicUrl) {
    gotrueUrlSource = 'SUPABASE_PUBLIC_URL + /auth/v1 (derived)'
  } else if (internalUrl) {
    gotrueUrlSource = 'SUPABASE_URL + /auth/v1 (derived)'
  } else {
    gotrueUrlSource = 'Default (http://127.0.0.1:54321/auth/v1)'
  }

  // Determine Supabase URL source
  let supabaseUrlSource: string
  if (publicUrl) {
    supabaseUrlSource = 'SUPABASE_PUBLIC_URL (explicit)'
  } else if (internalUrl) {
    supabaseUrlSource = 'SUPABASE_URL (explicit)'
  } else {
    supabaseUrlSource = 'Default (http://127.0.0.1:54321)'
  }

  // Determine API URL source
  let apiUrlSource: string
  if (explicitApiUrl) {
    apiUrlSource = process.env.API_EXTERNAL_URL
      ? 'API_EXTERNAL_URL (explicit)'
      : 'NEXT_PUBLIC_API_URL (explicit)'
  } else if (publicUrl) {
    apiUrlSource = 'SUPABASE_PUBLIC_URL (derived)'
  } else if (internalUrl) {
    apiUrlSource = 'SUPABASE_URL (derived)'
  } else {
    apiUrlSource = 'Default (http://127.0.0.1:8000)'
  }

  // Determine anon key source
  let anonKeySource: string
  if (anonKey) {
    anonKeySource = 'NEXT_PUBLIC_SUPABASE_ANON_KEY (explicit)'
  } else {
    anonKeySource = 'Not set'
  }

  return {
    gotrueUrl: gotrueUrlSource,
    supabaseUrl: supabaseUrlSource,
    apiUrl: apiUrlSource,
    anonKey: anonKeySource,
  }
}

/**
 * Gets active configuration
 */
async function getActiveConfig(verbose: boolean = false): Promise<ConfigDisplay> {
  if (verbose) {
    console.log('🔍 Fetching active runtime configuration...\n')
  }

  // Try to get cached config first
  let config = getRuntimeConfig()

  // If no cached config, fetch it
  if (!config) {
    if (verbose) {
      console.log('No cached configuration found, fetching from API...\n')
    }
    config = await fetchRuntimeConfig()
  } else if (verbose) {
    console.log('Using cached configuration\n')
  }

  const derivation = determineDerivation()

  const environmentVariables: ConfigDisplay['environmentVariables'] = {}
  
  // Collect relevant environment variables
  if (process.env.NODE_ENV) {
    environmentVariables.NODE_ENV = process.env.NODE_ENV
  }
  if (process.env.NEXT_PUBLIC_GOTRUE_URL) {
    environmentVariables.NEXT_PUBLIC_GOTRUE_URL = process.env.NEXT_PUBLIC_GOTRUE_URL
  }
  if (process.env.SUPABASE_PUBLIC_URL) {
    environmentVariables.SUPABASE_PUBLIC_URL = process.env.SUPABASE_PUBLIC_URL
  }
  if (process.env.SUPABASE_URL) {
    environmentVariables.SUPABASE_URL = process.env.SUPABASE_URL
  }
  if (process.env.API_EXTERNAL_URL) {
    environmentVariables.API_EXTERNAL_URL = process.env.API_EXTERNAL_URL
  }
  if (process.env.NEXT_PUBLIC_API_URL) {
    environmentVariables.NEXT_PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL
  }
  if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    environmentVariables.NEXT_PUBLIC_SUPABASE_ANON_KEY = '[REDACTED]'
  }

  return {
    config,
    derivation,
    environmentVariables,
  }
}

/**
 * Displays active configuration
 */
function displayConfig(display: ConfigDisplay, verbose: boolean = false, urlsOnly: boolean = false): void {
  if (urlsOnly) {
    console.log('Active URLs:')
    console.log('─────────────────────────────────────────────────────')
    console.log(`GoTrue:    ${display.config.gotrueUrl}`)
    console.log(`Supabase:  ${display.config.supabaseUrl}`)
    console.log(`API:       ${display.config.apiUrl}`)
    console.log()
    return
  }

  console.log('\n═══════════════════════════════════════════════════════')
  console.log('  Active Runtime Configuration')
  console.log('═══════════════════════════════════════════════════════\n')

  // Configuration metadata
  console.log('Configuration Metadata:')
  console.log('─────────────────────────────────────────────────────')
  console.log(`Environment:  ${display.config.environment}`)
  console.log(`Source:       ${display.config.source}`)
  console.log(`Timestamp:    ${new Date(display.config.timestamp).toISOString()}`)
  console.log()

  // Active URLs
  console.log('Active URLs:')
  console.log('─────────────────────────────────────────────────────')
  console.log(`GoTrue URL:     ${display.config.gotrueUrl}`)
  console.log(`Supabase URL:   ${display.config.supabaseUrl}`)
  console.log(`API URL:        ${display.config.apiUrl}`)
  console.log(`Has Anon Key:   ${display.config.anonKey ? 'Yes' : 'No'}`)
  console.log()

  // URL derivation
  console.log('URL Derivation:')
  console.log('─────────────────────────────────────────────────────')
  console.log(`GoTrue URL:     ${display.derivation.gotrueUrl}`)
  console.log(`Supabase URL:   ${display.derivation.supabaseUrl}`)
  console.log(`API URL:        ${display.derivation.apiUrl}`)
  console.log(`Anon Key:       ${display.derivation.anonKey}`)
  console.log()

  // Environment variables (if verbose)
  if (verbose) {
    console.log('Environment Variables:')
    console.log('─────────────────────────────────────────────────────')
    
    const envVars = Object.entries(display.environmentVariables)
    
    if (envVars.length === 0) {
      console.log('  (No relevant environment variables set)')
    } else {
      envVars.forEach(([key, value]) => {
        console.log(`  ${key}=${value}`)
      })
    }
    console.log()
  }

  // Configuration analysis
  console.log('Configuration Analysis:')
  console.log('─────────────────────────────────────────────────────')

  const issues: string[] = []
  const notes: string[] = []

  // Check for localhost in production
  if (display.config.environment === 'production') {
    if (
      display.config.gotrueUrl.includes('localhost') ||
      display.config.gotrueUrl.includes('127.0.0.1')
    ) {
      issues.push('⚠️  GoTrue URL contains localhost in production')
    }
    if (
      display.config.apiUrl.includes('localhost') ||
      display.config.apiUrl.includes('127.0.0.1')
    ) {
      issues.push('⚠️  API URL contains localhost in production')
    }
    if (display.config.source === 'default') {
      issues.push('⚠️  Using default configuration in production')
    }
    if (!display.config.anonKey) {
      issues.push('⚠️  Anon key not set in production')
    }
  }

  // Check for derived URLs
  if (display.config.source === 'derived') {
    notes.push('ℹ️  Using derived URLs from base Supabase URL')
    if (display.config.environment === 'production') {
      notes.push('ℹ️  Consider setting explicit URLs for production')
    }
  }

  // Check for explicit configuration
  if (display.config.source === 'explicit') {
    notes.push('✅ Using explicit environment variables (recommended)')
  }

  if (issues.length > 0) {
    console.log('\nIssues:')
    issues.forEach((issue) => {
      console.log(`  ${issue}`)
    })
  }

  if (notes.length > 0) {
    console.log('\nNotes:')
    notes.forEach((note) => {
      console.log(`  ${note}`)
    })
  }

  if (issues.length === 0 && notes.length === 0) {
    console.log('  ✅ Configuration looks good')
  }

  console.log()
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2)
  const verbose = args.includes('--verbose')
  const jsonOutput = args.includes('--json')
  const urlsOnly = args.includes('--urls-only')

  if (!jsonOutput && !urlsOnly) {
    console.log('═══════════════════════════════════════════════════════')
    console.log('  Active Configuration Check')
    console.log('═══════════════════════════════════════════════════════')
  }

  try {
    const display = await getActiveConfig(verbose && !jsonOutput && !urlsOnly)

    if (jsonOutput) {
      console.log(JSON.stringify(display, null, 2))
      process.exit(0)
    }

    displayConfig(display, verbose, urlsOnly)

    if (!urlsOnly) {
      console.log('═══════════════════════════════════════════════════════')
      console.log('  Summary')
      console.log('═══════════════════════════════════════════════════════\n')

      console.log(`✅ Active configuration retrieved successfully`)
      console.log(`   Environment: ${display.config.environment}`)
      console.log(`   Source: ${display.config.source}`)
      console.log()

      if (verbose) {
        console.log('For more details, see:')
        console.log('  apps/studio/docs/RUNTIME-CONFIG-TROUBLESHOOTING.md')
        console.log()
      }
    }

    process.exit(0)
  } catch (error) {
    if (jsonOutput) {
      console.error(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }))
    } else {
      console.error('\n❌ Failed to retrieve active configuration:')
      console.error(`   ${error instanceof Error ? error.message : 'Unknown error'}`)
      console.error()
      console.error('Troubleshooting:')
      console.error('  1. Ensure the runtime configuration API is accessible')
      console.error('  2. Check that environment variables are properly set')
      console.error('  3. Review server logs for errors')
      console.error()
    }
    process.exit(1)
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}

export { getActiveConfig }
