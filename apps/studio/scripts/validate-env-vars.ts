#!/usr/bin/env ts-node
/**
 * Environment Variables Validation Script
 * 
 * This script validates that all required environment variables are properly set
 * and formatted for the runtime configuration system.
 * 
 * Usage:
 *   pnpm tsx apps/studio/scripts/validate-env-vars.ts
 *   
 * Options:
 *   --verbose    Show detailed output
 *   --json       Output results as JSON
 *   --strict     Fail on warnings (not just errors)
 */

interface EnvVarCheck {
  name: string
  required: boolean
  present: boolean
  valid: boolean
  value?: string
  error?: string
  warning?: string
}

interface ValidationResult {
  success: boolean
  environment: string
  checks: EnvVarCheck[]
  errors: string[]
  warnings: string[]
  recommendations: string[]
}

/**
 * Validates that a URL is properly formatted
 */
function isValidUrl(url: string | undefined): boolean {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return false
  }

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
 * Validates environment variables
 */
function validateEnvironmentVariables(verbose: boolean = false): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const recommendations: string[] = []
  const checks: EnvVarCheck[] = []

  const nodeEnv = process.env.NODE_ENV || 'development'
  const isProduction = nodeEnv === 'production'

  if (verbose) {
    console.log(`🔍 Validating environment variables for ${nodeEnv} environment...\n`)
  }

  // Define environment variables to check
  const envVars = [
    {
      name: 'NODE_ENV',
      required: false,
      validator: (value: string | undefined): { valid: boolean; error?: string; warning?: string } => {
        if (!value) return { valid: true }
        if (!['development', 'production', 'staging', 'test'].includes(value)) {
          return {
            valid: false,
            error: `Invalid value "${value}". Expected: development, production, staging, or test`,
          }
        }
        return { valid: true }
      },
    },
    {
      name: 'NEXT_PUBLIC_GOTRUE_URL',
      required: false,
      validator: (value: string | undefined): { valid: boolean; error?: string; warning?: string } => {
        if (!value) {
          if (isProduction) {
            return {
              valid: true,
              warning: 'Not set in production. Will use derived or default URL.',
            }
          }
          return { valid: true }
        }
        if (!isValidUrl(value)) {
          return {
            valid: false,
            error: `Invalid URL format: "${value}"`,
          }
        }
        if (isProduction && isLocalhostUrl(value)) {
          return {
            valid: false,
            error: 'Contains localhost in production environment',
          }
        }
        return { valid: true }
      },
    },
    {
      name: 'SUPABASE_PUBLIC_URL',
      required: false,
      validator: (value: string | undefined): { valid: boolean; error?: string; warning?: string } => {
        if (!value) {
          if (isProduction) {
            return {
              valid: true,
              warning: 'Not set in production. Will use SUPABASE_URL or defaults.',
            }
          }
          return { valid: true }
        }
        if (!isValidUrl(value)) {
          return {
            valid: false,
            error: `Invalid URL format: "${value}"`,
          }
        }
        if (isProduction && isLocalhostUrl(value)) {
          return {
            valid: false,
            error: 'Contains localhost in production environment',
          }
        }
        return { valid: true }
      },
    },
    {
      name: 'SUPABASE_URL',
      required: false,
      validator: (value: string | undefined): { valid: boolean; error?: string; warning?: string } => {
        if (!value) return { valid: true }
        if (!isValidUrl(value)) {
          return {
            valid: false,
            error: `Invalid URL format: "${value}"`,
          }
        }
        return { valid: true }
      },
    },
    {
      name: 'API_EXTERNAL_URL',
      required: false,
      validator: (value: string | undefined): { valid: boolean; error?: string; warning?: string } => {
        if (!value) {
          if (isProduction) {
            return {
              valid: true,
              warning: 'Not set in production. Will use SUPABASE_PUBLIC_URL or defaults.',
            }
          }
          return { valid: true }
        }
        if (!isValidUrl(value)) {
          return {
            valid: false,
            error: `Invalid URL format: "${value}"`,
          }
        }
        if (isProduction && isLocalhostUrl(value)) {
          return {
            valid: false,
            error: 'Contains localhost in production environment',
          }
        }
        return { valid: true }
      },
    },
    {
      name: 'NEXT_PUBLIC_API_URL',
      required: false,
      validator: (value: string | undefined): { valid: boolean; error?: string; warning?: string } => {
        if (!value) return { valid: true }
        if (!isValidUrl(value)) {
          return {
            valid: false,
            error: `Invalid URL format: "${value}"`,
          }
        }
        return { valid: true }
      },
    },
    {
      name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      required: false,
      validator: (value: string | undefined): { valid: boolean; error?: string; warning?: string } => {
        if (!value) {
          if (isProduction) {
            return {
              valid: true,
              warning: 'Not set in production. API authentication may fail.',
            }
          }
          return { valid: true }
        }
        if (value.length < 20) {
          return {
            valid: false,
            error: 'Value appears too short to be a valid anon key',
          }
        }
        return { valid: true }
      },
    },
  ]

  // Validate each environment variable
  for (const envVar of envVars) {
    const value = process.env[envVar.name]
    const present = value !== undefined && value !== ''

    const validation = envVar.validator(value)

    const check: EnvVarCheck = {
      name: envVar.name,
      required: envVar.required,
      present,
      valid: validation.valid,
      value: present ? (envVar.name.includes('KEY') ? '[REDACTED]' : value) : undefined,
      error: validation.error,
      warning: validation.warning,
    }

    checks.push(check)

    if (envVar.required && !present) {
      errors.push(`Required environment variable ${envVar.name} is not set`)
    }

    if (present && !validation.valid && validation.error) {
      errors.push(`${envVar.name}: ${validation.error}`)
    }

    if (validation.warning) {
      warnings.push(`${envVar.name}: ${validation.warning}`)
    }
  }

  // Check for configuration completeness
  const hasGotrueUrl = process.env.NEXT_PUBLIC_GOTRUE_URL
  const hasPublicUrl = process.env.SUPABASE_PUBLIC_URL
  const hasInternalUrl = process.env.SUPABASE_URL
  const hasApiUrl = process.env.API_EXTERNAL_URL || process.env.NEXT_PUBLIC_API_URL

  if (isProduction) {
    if (!hasGotrueUrl && !hasPublicUrl && !hasInternalUrl) {
      warnings.push(
        'No URL configuration found in production. System will use defaults (localhost).'
      )
      recommendations.push(
        'For production deployments, set at least one of:',
        '  - NEXT_PUBLIC_GOTRUE_URL (recommended)',
        '  - SUPABASE_PUBLIC_URL',
        '  - SUPABASE_URL'
      )
    }

    if (!hasApiUrl && !hasPublicUrl && !hasInternalUrl) {
      warnings.push('No API URL configuration found in production.')
      recommendations.push(
        'For production deployments, set at least one of:',
        '  - API_EXTERNAL_URL (recommended)',
        '  - SUPABASE_PUBLIC_URL'
      )
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      recommendations.push('Set NEXT_PUBLIC_SUPABASE_ANON_KEY for API authentication')
    }
  }

  // Add general recommendations
  if (isProduction && hasGotrueUrl && hasPublicUrl) {
    recommendations.push(
      'Both NEXT_PUBLIC_GOTRUE_URL and SUPABASE_PUBLIC_URL are set.',
      'NEXT_PUBLIC_GOTRUE_URL will take precedence.'
    )
  }

  const success = errors.length === 0

  return {
    success,
    environment: nodeEnv,
    checks,
    errors,
    warnings,
    recommendations,
  }
}

/**
 * Displays validation results
 */
function displayResults(result: ValidationResult, verbose: boolean = false): void {
  console.log('\n═══════════════════════════════════════════════════════')
  console.log('  Environment Variables Validation Results')
  console.log('═══════════════════════════════════════════════════════\n')

  console.log(`Environment: ${result.environment}`)
  console.log()

  // Display checks
  console.log('Environment Variables:')
  console.log('─────────────────────────────────────────────────────')

  for (const check of result.checks) {
    const status = check.present
      ? check.valid
        ? '✅'
        : '❌'
      : check.required
        ? '❌'
        : '⚪'

    const requiredLabel = check.required ? ' (required)' : ''
    console.log(`\n${status} ${check.name}${requiredLabel}`)

    if (verbose || !check.valid || check.warning) {
      console.log(`   Present: ${check.present ? 'Yes' : 'No'}`)
      if (check.present && check.value) {
        console.log(`   Value: ${check.value}`)
      }
      console.log(`   Valid: ${check.valid ? 'Yes' : 'No'}`)
      if (check.error) {
        console.log(`   Error: ${check.error}`)
      }
      if (check.warning) {
        console.log(`   Warning: ${check.warning}`)
      }
    }
  }

  console.log()

  // Display errors
  if (result.errors.length > 0) {
    console.log('Errors:')
    console.log('─────────────────────────────────────────────────────')
    result.errors.forEach((error, index) => {
      console.log(`${index + 1}. ❌ ${error}`)
    })
    console.log()
  }

  // Display warnings
  if (result.warnings.length > 0) {
    console.log('Warnings:')
    console.log('─────────────────────────────────────────────────────')
    result.warnings.forEach((warning, index) => {
      console.log(`${index + 1}. ⚠️  ${warning}`)
    })
    console.log()
  }

  // Display recommendations
  if (result.recommendations.length > 0) {
    console.log('Recommendations:')
    console.log('─────────────────────────────────────────────────────')
    result.recommendations.forEach((rec) => {
      console.log(`  ${rec}`)
    })
    console.log()
  }
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2)
  const verbose = args.includes('--verbose')
  const jsonOutput = args.includes('--json')
  const strict = args.includes('--strict')

  if (!jsonOutput) {
    console.log('═══════════════════════════════════════════════════════')
    console.log('  Environment Variables Validation')
    console.log('═══════════════════════════════════════════════════════')
  }

  try {
    const result = validateEnvironmentVariables(verbose && !jsonOutput)

    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2))
      const exitCode = result.success && (!strict || result.warnings.length === 0) ? 0 : 1
      process.exit(exitCode)
    }

    displayResults(result, verbose)

    console.log('═══════════════════════════════════════════════════════')
    console.log('  Validation Summary')
    console.log('═══════════════════════════════════════════════════════\n')

    const totalChecks = result.checks.length
    const validChecks = result.checks.filter((c) => c.valid).length
    const presentChecks = result.checks.filter((c) => c.present).length

    console.log(`Total Variables Checked: ${totalChecks}`)
    console.log(`Variables Present: ${presentChecks}`)
    console.log(`Variables Valid: ${validChecks}`)
    console.log(`Errors: ${result.errors.length}`)
    console.log(`Warnings: ${result.warnings.length}`)
    console.log()

    if (result.success && (!strict || result.warnings.length === 0)) {
      console.log('✅ Environment variables validation PASSED')
      console.log()
      process.exit(0)
    } else if (result.success && strict && result.warnings.length > 0) {
      console.log('⚠️  Environment variables validation PASSED with warnings')
      console.log('   (Failing due to --strict mode)')
      console.log()
      process.exit(1)
    } else {
      console.log('❌ Environment variables validation FAILED')
      console.log()
      console.log('Next steps:')
      console.log('  1. Review errors and warnings above')
      console.log('  2. Update environment variables as needed')
      console.log('  3. See apps/studio/docs/REQUIRED-ENV-VARS.md for details')
      console.log()
      process.exit(1)
    }
  } catch (error) {
    if (jsonOutput) {
      console.error(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }))
    } else {
      console.error('\n❌ Validation failed with unexpected error:')
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

export { validateEnvironmentVariables }
