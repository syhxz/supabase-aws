#!/usr/bin/env ts-node
/**
 * Runtime Configuration Verification Script
 * 
 * This script verifies that the runtime configuration system is working correctly.
 * It checks:
 * - Runtime configuration API is accessible
 * - Configuration values are correct
 * - URLs are properly formatted
 * - Environment detection is accurate
 * 
 * Usage:
 *   pnpm tsx apps/studio/scripts/verify-runtime-config.ts
 *   
 * Options:
 *   --verbose    Show detailed output
 *   --json       Output results as JSON
 */

import { performConfigHealthCheck, formatHealthCheckResult } from '../lib/config-health'
import { fetchRuntimeConfig } from 'common/runtime-config'
import type { RuntimeConfig } from 'common/runtime-config'

interface VerificationResult {
  success: boolean
  config?: RuntimeConfig
  errors: string[]
  warnings: string[]
  checks: {
    apiAccessible: boolean
    configValid: boolean
    urlsValid: boolean
    environmentCorrect: boolean
  }
}

/**
 * Validates that a URL is properly formatted
 */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Checks if URL contains localhost or 127.0.0.1
 */
function isLocalhostUrl(url: string): boolean {
  return url.includes('localhost') || url.includes('127.0.0.1')
}

/**
 * Verifies runtime configuration
 */
async function verifyRuntimeConfig(verbose: boolean = false): Promise<VerificationResult> {
  const errors: string[] = []
  const warnings: string[] = []
  const checks = {
    apiAccessible: false,
    configValid: false,
    urlsValid: false,
    environmentCorrect: false,
  }

  if (verbose) {
    console.log('🔍 Starting runtime configuration verification...\n')
  }

  // Step 1: Try to fetch runtime configuration
  if (verbose) {
    console.log('Step 1: Fetching runtime configuration from API...')
  }

  let config: RuntimeConfig | undefined

  try {
    config = await fetchRuntimeConfig()
    checks.apiAccessible = true
    
    if (verbose) {
      console.log('✅ Runtime configuration API is accessible\n')
    }
  } catch (error) {
    checks.apiAccessible = false
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    errors.push(`Failed to fetch runtime configuration: ${errorMessage}`)
    
    if (verbose) {
      console.error('❌ Failed to fetch runtime configuration')
      console.error(`   Error: ${errorMessage}\n`)
    }
    
    return {
      success: false,
      errors,
      warnings,
      checks,
    }
  }

  // Step 2: Validate configuration structure
  if (verbose) {
    console.log('Step 2: Validating configuration structure...')
  }

  if (!config.gotrueUrl || !config.supabaseUrl || !config.apiUrl) {
    checks.configValid = false
    errors.push('Configuration is missing required fields')
    
    if (verbose) {
      console.error('❌ Configuration is missing required fields')
      console.error(`   Has gotrueUrl: ${!!config.gotrueUrl}`)
      console.error(`   Has supabaseUrl: ${!!config.supabaseUrl}`)
      console.error(`   Has apiUrl: ${!!config.apiUrl}\n`)
    }
  } else {
    checks.configValid = true
    
    if (verbose) {
      console.log('✅ Configuration structure is valid\n')
    }
  }

  // Step 3: Validate URLs
  if (verbose) {
    console.log('Step 3: Validating URLs...')
  }

  const urlValidation = {
    gotrueUrl: isValidUrl(config.gotrueUrl),
    supabaseUrl: isValidUrl(config.supabaseUrl),
    apiUrl: isValidUrl(config.apiUrl),
  }

  if (!urlValidation.gotrueUrl) {
    errors.push(`Invalid GoTrue URL: ${config.gotrueUrl}`)
  }
  if (!urlValidation.supabaseUrl) {
    errors.push(`Invalid Supabase URL: ${config.supabaseUrl}`)
  }
  if (!urlValidation.apiUrl) {
    errors.push(`Invalid API URL: ${config.apiUrl}`)
  }

  checks.urlsValid = urlValidation.gotrueUrl && urlValidation.supabaseUrl && urlValidation.apiUrl

  if (verbose) {
    if (checks.urlsValid) {
      console.log('✅ All URLs are valid\n')
    } else {
      console.error('❌ Some URLs are invalid')
      console.error(`   GoTrue URL valid: ${urlValidation.gotrueUrl}`)
      console.error(`   Supabase URL valid: ${urlValidation.supabaseUrl}`)
      console.error(`   API URL valid: ${urlValidation.apiUrl}\n`)
    }
  }

  // Step 4: Check environment-specific issues
  if (verbose) {
    console.log('Step 4: Checking environment-specific configuration...')
  }

  const environment = config.environment
  const nodeEnv = process.env.NODE_ENV || 'development'

  // Check if environment detection matches NODE_ENV
  if (
    (nodeEnv === 'production' && environment !== 'production') ||
    (nodeEnv === 'development' && environment !== 'development')
  ) {
    warnings.push(
      `Environment mismatch: NODE_ENV is "${nodeEnv}" but detected environment is "${environment}"`
    )
  }

  // Check for localhost URLs in production
  if (environment === 'production') {
    if (isLocalhostUrl(config.gotrueUrl)) {
      errors.push('GoTrue URL contains localhost in production environment')
    }
    if (isLocalhostUrl(config.apiUrl)) {
      errors.push('API URL contains localhost in production environment')
    }
    if (isLocalhostUrl(config.supabaseUrl)) {
      warnings.push('Supabase URL contains localhost in production environment')
    }

    // Check if using defaults in production
    if (config.source === 'default') {
      errors.push('Using default configuration in production environment')
    }
  }

  // Check for missing anon key
  if (!config.anonKey) {
    warnings.push('Anonymous API key is not set')
  }

  checks.environmentCorrect = errors.length === 0

  if (verbose) {
    if (checks.environmentCorrect) {
      console.log('✅ Environment configuration is correct\n')
    } else {
      console.error('❌ Environment configuration has issues\n')
    }
  }

  // Display configuration details
  if (verbose) {
    console.log('Configuration Details:')
    console.log('─────────────────────────────────────────')
    console.log(`Environment:    ${config.environment}`)
    console.log(`Source:         ${config.source}`)
    console.log(`GoTrue URL:     ${config.gotrueUrl}`)
    console.log(`Supabase URL:   ${config.supabaseUrl}`)
    console.log(`API URL:        ${config.apiUrl}`)
    console.log(`Has Anon Key:   ${config.anonKey ? 'Yes' : 'No'}`)
    console.log(`Timestamp:      ${new Date(config.timestamp).toISOString()}`)
    console.log('─────────────────────────────────────────\n')
  }

  const success = checks.apiAccessible && checks.configValid && checks.urlsValid && checks.environmentCorrect

  return {
    success,
    config,
    errors,
    warnings,
    checks,
  }
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2)
  const verbose = args.includes('--verbose')
  const jsonOutput = args.includes('--json')

  if (!jsonOutput) {
    console.log('═══════════════════════════════════════════════════════')
    console.log('  Runtime Configuration Verification')
    console.log('═══════════════════════════════════════════════════════\n')
  }

  try {
    const result = await verifyRuntimeConfig(verbose && !jsonOutput)

    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2))
      process.exit(result.success ? 0 : 1)
    }

    // Display summary
    console.log('\n═══════════════════════════════════════════════════════')
    console.log('  Verification Summary')
    console.log('═══════════════════════════════════════════════════════\n')

    console.log('Checks:')
    console.log(`  API Accessible:       ${result.checks.apiAccessible ? '✅' : '❌'}`)
    console.log(`  Config Valid:         ${result.checks.configValid ? '✅' : '❌'}`)
    console.log(`  URLs Valid:           ${result.checks.urlsValid ? '✅' : '❌'}`)
    console.log(`  Environment Correct:  ${result.checks.environmentCorrect ? '✅' : '❌'}`)
    console.log()

    if (result.errors.length > 0) {
      console.log('Errors:')
      result.errors.forEach((error) => {
        console.log(`  ❌ ${error}`)
      })
      console.log()
    }

    if (result.warnings.length > 0) {
      console.log('Warnings:')
      result.warnings.forEach((warning) => {
        console.log(`  ⚠️  ${warning}`)
      })
      console.log()
    }

    if (result.success) {
      console.log('✅ Runtime configuration verification PASSED')
      console.log()
      process.exit(0)
    } else {
      console.log('❌ Runtime configuration verification FAILED')
      console.log()
      console.log('Troubleshooting:')
      console.log('  1. Check that environment variables are properly set')
      console.log('  2. Verify the runtime configuration API is accessible')
      console.log('  3. Review server logs for detailed error information')
      console.log('  4. See apps/studio/docs/RUNTIME-CONFIG-TROUBLESHOOTING.md')
      console.log()
      process.exit(1)
    }
  } catch (error) {
    if (jsonOutput) {
      console.error(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }))
    } else {
      console.error('\n❌ Verification failed with unexpected error:')
      console.error(`   ${error instanceof Error ? error.message : 'Unknown error'}`)
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

export { verifyRuntimeConfig }
