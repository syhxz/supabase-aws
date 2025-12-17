#!/usr/bin/env ts-node
/**
 * Comprehensive Diagnostic Script
 * 
 * This script runs all diagnostic checks in sequence and provides
 * a comprehensive report of the runtime configuration system status.
 * 
 * Usage:
 *   pnpm tsx apps/studio/scripts/diagnose-all.ts
 *   
 * Options:
 *   --verbose    Show detailed output from all checks
 *   --json       Output results as JSON
 *   --continue   Continue running checks even if one fails
 */

import { verifyRuntimeConfig } from './verify-runtime-config'
import { testHealthChecks } from './test-health-checks'
import { validateEnvironmentVariables } from './validate-env-vars'
import { getActiveConfig } from './check-active-config'

interface DiagnosticResults {
  timestamp: string
  environment: string
  checks: {
    environmentVariables: {
      passed: boolean
      errors: number
      warnings: number
    }
    runtimeConfig: {
      passed: boolean
      errors: number
      warnings: number
    }
    healthChecks: {
      passed: boolean
      errors: number
      warnings: number
    }
    activeConfig: {
      retrieved: boolean
      source?: string
      environment?: string
    }
  }
  overallStatus: 'healthy' | 'degraded' | 'unhealthy'
  summary: string[]
}

/**
 * Runs all diagnostic checks
 */
async function runAllDiagnostics(
  verbose: boolean = false,
  continueOnFailure: boolean = false
): Promise<DiagnosticResults> {
  const results: DiagnosticResults = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    checks: {
      environmentVariables: {
        passed: false,
        errors: 0,
        warnings: 0,
      },
      runtimeConfig: {
        passed: false,
        errors: 0,
        warnings: 0,
      },
      healthChecks: {
        passed: false,
        errors: 0,
        warnings: 0,
      },
      activeConfig: {
        retrieved: false,
      },
    },
    overallStatus: 'unhealthy',
    summary: [],
  }

  console.log('═══════════════════════════════════════════════════════')
  console.log('  Comprehensive Runtime Configuration Diagnostics')
  console.log('═══════════════════════════════════════════════════════\n')
  console.log(`Environment: ${results.environment}`)
  console.log(`Timestamp: ${results.timestamp}`)
  console.log()

  // Check 1: Validate Environment Variables
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  1/4: Validating Environment Variables')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  try {
    const envValidation = validateEnvironmentVariables(verbose)
    results.checks.environmentVariables.passed = envValidation.success
    results.checks.environmentVariables.errors = envValidation.errors.length
    results.checks.environmentVariables.warnings = envValidation.warnings.length

    if (envValidation.success) {
      console.log('✅ Environment variables validation PASSED')
    } else {
      console.log('❌ Environment variables validation FAILED')
      console.log(`   ${envValidation.errors.length} error(s), ${envValidation.warnings.length} warning(s)`)
      
      if (!continueOnFailure) {
        console.log('\n⚠️  Stopping diagnostics due to environment variable errors')
        console.log('   Use --continue to run all checks regardless of failures')
        results.summary.push('Environment variables validation failed')
        return results
      }
    }
  } catch (error) {
    console.error('❌ Environment variables check failed with error:')
    console.error(`   ${error instanceof Error ? error.message : 'Unknown error'}`)
    
    if (!continueOnFailure) {
      results.summary.push('Environment variables check crashed')
      return results
    }
  }

  console.log()

  // Check 2: Verify Runtime Configuration
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  2/4: Verifying Runtime Configuration')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  try {
    const configVerification = await verifyRuntimeConfig(verbose)
    results.checks.runtimeConfig.passed = configVerification.success
    results.checks.runtimeConfig.errors = configVerification.errors.length
    results.checks.runtimeConfig.warnings = configVerification.warnings.length

    if (configVerification.success) {
      console.log('✅ Runtime configuration verification PASSED')
    } else {
      console.log('❌ Runtime configuration verification FAILED')
      console.log(`   ${configVerification.errors.length} error(s), ${configVerification.warnings.length} warning(s)`)
      
      if (!continueOnFailure) {
        console.log('\n⚠️  Stopping diagnostics due to runtime configuration errors')
        console.log('   Use --continue to run all checks regardless of failures')
        results.summary.push('Runtime configuration verification failed')
        return results
      }
    }
  } catch (error) {
    console.error('❌ Runtime configuration check failed with error:')
    console.error(`   ${error instanceof Error ? error.message : 'Unknown error'}`)
    
    if (!continueOnFailure) {
      results.summary.push('Runtime configuration check crashed')
      return results
    }
  }

  console.log()

  // Check 3: Test Health Checks
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  3/4: Testing Health Checks')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  try {
    const healthResult = await testHealthChecks(verbose, false)
    
    if (typeof healthResult !== 'boolean') {
      results.checks.healthChecks.passed = healthResult.healthy
      results.checks.healthChecks.errors = healthResult.errors.length
      results.checks.healthChecks.warnings = healthResult.warnings.length

      if (healthResult.healthy) {
        console.log('✅ Health checks PASSED')
      } else {
        console.log('❌ Health checks FAILED')
        console.log(`   ${healthResult.errors.length} error(s), ${healthResult.warnings.length} warning(s)`)
      }
    }
  } catch (error) {
    console.error('❌ Health checks failed with error:')
    console.error(`   ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  console.log()

  // Check 4: Get Active Configuration
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  4/4: Retrieving Active Configuration')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  try {
    const activeConfig = await getActiveConfig(verbose)
    results.checks.activeConfig.retrieved = true
    results.checks.activeConfig.source = activeConfig.config.source
    results.checks.activeConfig.environment = activeConfig.config.environment

    console.log('✅ Active configuration retrieved')
    console.log(`   Source: ${activeConfig.config.source}`)
    console.log(`   Environment: ${activeConfig.config.environment}`)
  } catch (error) {
    console.error('❌ Failed to retrieve active configuration:')
    console.error(`   ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  console.log()

  // Determine overall status
  const allPassed =
    results.checks.environmentVariables.passed &&
    results.checks.runtimeConfig.passed &&
    results.checks.healthChecks.passed &&
    results.checks.activeConfig.retrieved

  const somePassed =
    results.checks.environmentVariables.passed ||
    results.checks.runtimeConfig.passed ||
    results.checks.healthChecks.passed

  if (allPassed) {
    results.overallStatus = 'healthy'
    results.summary.push('All diagnostic checks passed')
  } else if (somePassed) {
    results.overallStatus = 'degraded'
    results.summary.push('Some diagnostic checks failed')
  } else {
    results.overallStatus = 'unhealthy'
    results.summary.push('All diagnostic checks failed')
  }

  // Add specific issues to summary
  if (!results.checks.environmentVariables.passed) {
    results.summary.push(
      `Environment variables: ${results.checks.environmentVariables.errors} error(s)`
    )
  }
  if (!results.checks.runtimeConfig.passed) {
    results.summary.push(
      `Runtime configuration: ${results.checks.runtimeConfig.errors} error(s)`
    )
  }
  if (!results.checks.healthChecks.passed) {
    results.summary.push(`Health checks: ${results.checks.healthChecks.errors} error(s)`)
  }
  if (!results.checks.activeConfig.retrieved) {
    results.summary.push('Failed to retrieve active configuration')
  }

  return results
}

/**
 * Displays diagnostic summary
 */
function displaySummary(results: DiagnosticResults): void {
  console.log('═══════════════════════════════════════════════════════')
  console.log('  Diagnostic Summary')
  console.log('═══════════════════════════════════════════════════════\n')

  // Overall status
  const statusIcon =
    results.overallStatus === 'healthy'
      ? '✅'
      : results.overallStatus === 'degraded'
        ? '⚠️'
        : '❌'

  console.log(`Overall Status: ${statusIcon} ${results.overallStatus.toUpperCase()}`)
  console.log()

  // Individual check results
  console.log('Check Results:')
  console.log('─────────────────────────────────────────────────────')
  console.log(
    `  Environment Variables:  ${results.checks.environmentVariables.passed ? '✅' : '❌'} (${results.checks.environmentVariables.errors} errors, ${results.checks.environmentVariables.warnings} warnings)`
  )
  console.log(
    `  Runtime Configuration:  ${results.checks.runtimeConfig.passed ? '✅' : '❌'} (${results.checks.runtimeConfig.errors} errors, ${results.checks.runtimeConfig.warnings} warnings)`
  )
  console.log(
    `  Health Checks:          ${results.checks.healthChecks.passed ? '✅' : '❌'} (${results.checks.healthChecks.errors} errors, ${results.checks.healthChecks.warnings} warnings)`
  )
  console.log(
    `  Active Configuration:   ${results.checks.activeConfig.retrieved ? '✅' : '❌'}`
  )
  console.log()

  // Summary points
  if (results.summary.length > 0) {
    console.log('Summary:')
    console.log('─────────────────────────────────────────────────────')
    results.summary.forEach((point) => {
      console.log(`  • ${point}`)
    })
    console.log()
  }

  // Recommendations
  if (results.overallStatus !== 'healthy') {
    console.log('Recommendations:')
    console.log('─────────────────────────────────────────────────────')

    if (!results.checks.environmentVariables.passed) {
      console.log('  1. Fix environment variable issues')
      console.log('     Run: pnpm config:validate-env:verbose')
    }

    if (!results.checks.runtimeConfig.passed) {
      console.log('  2. Fix runtime configuration issues')
      console.log('     Run: pnpm config:verify:verbose')
    }

    if (!results.checks.healthChecks.passed) {
      console.log('  3. Fix service connectivity issues')
      console.log('     Run: pnpm config:health:verbose')
    }

    console.log()
    console.log('For detailed troubleshooting, see:')
    console.log('  apps/studio/docs/RUNTIME-CONFIG-TROUBLESHOOTING.md')
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
  const continueOnFailure = args.includes('--continue')

  try {
    const results = await runAllDiagnostics(verbose && !jsonOutput, continueOnFailure)

    if (jsonOutput) {
      console.log(JSON.stringify(results, null, 2))
      process.exit(results.overallStatus === 'healthy' ? 0 : 1)
    }

    displaySummary(results)

    console.log('═══════════════════════════════════════════════════════')
    console.log(`  Diagnostics Complete - ${results.overallStatus.toUpperCase()}`)
    console.log('═══════════════════════════════════════════════════════\n')

    process.exit(results.overallStatus === 'healthy' ? 0 : 1)
  } catch (error) {
    if (jsonOutput) {
      console.error(
        JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' })
      )
    } else {
      console.error('\n❌ Diagnostics failed with unexpected error:')
      console.error(`   ${error instanceof Error ? error.message : 'Unknown error'}`)
      if (error instanceof Error && error.stack) {
        console.error('\nStack trace:')
        console.error(error.stack)
      }
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

export { runAllDiagnostics }
