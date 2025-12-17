#!/usr/bin/env ts-node
/**
 * Health Check Testing Script
 * 
 * This script tests the configuration health check system.
 * It performs comprehensive health checks and reports the results.
 * 
 * Usage:
 *   pnpm tsx apps/studio/scripts/test-health-checks.ts
 *   
 * Options:
 *   --verbose    Show detailed output
 *   --json       Output results as JSON
 *   --quick      Perform quick health check only
 */

import {
  performConfigHealthCheck,
  quickHealthCheck,
  formatHealthCheckResult,
  getHealthCheckErrorMessage,
} from '../lib/config-health'
import type { ConfigHealthResult } from '../lib/config-health'

/**
 * Performs and displays health check results
 */
async function testHealthChecks(verbose: boolean = false, quick: boolean = false): Promise<ConfigHealthResult | boolean> {
  if (quick) {
    if (verbose) {
      console.log('🔍 Performing quick health check...\n')
    }

    const isHealthy = await quickHealthCheck()

    if (verbose) {
      if (isHealthy) {
        console.log('✅ Quick health check PASSED')
        console.log('   Runtime configuration is available\n')
      } else {
        console.log('❌ Quick health check FAILED')
        console.log('   Runtime configuration is not available\n')
      }
    }

    return isHealthy
  }

  if (verbose) {
    console.log('🔍 Performing comprehensive health check...\n')
    console.log('This will check:')
    console.log('  1. Runtime configuration availability')
    console.log('  2. GoTrue service reachability')
    console.log('  3. API gateway reachability')
    console.log()
  }

  const result = await performConfigHealthCheck()

  if (verbose) {
    console.log(formatHealthCheckResult(result))
  }

  return result
}

/**
 * Displays detailed health check analysis
 */
function displayDetailedAnalysis(result: ConfigHealthResult): void {
  console.log('\n═══════════════════════════════════════════════════════')
  console.log('  Detailed Health Check Analysis')
  console.log('═══════════════════════════════════════════════════════\n')

  // Overall status
  console.log(`Overall Status: ${result.healthy ? '✅ HEALTHY' : '❌ UNHEALTHY'}`)
  console.log(`Timestamp: ${new Date(result.timestamp).toISOString()}`)
  console.log()

  // Individual checks
  console.log('Individual Checks:')
  console.log('─────────────────────────────────────────────────────')

  const { runtimeConfigAvailable, gotrueReachable, apiGatewayReachable } = result.checks

  // Runtime config check
  console.log('\n1. Runtime Configuration:')
  console.log(`   Status: ${runtimeConfigAvailable.healthy ? '✅ Available' : '❌ Unavailable'}`)
  if (runtimeConfigAvailable.responseTime !== undefined) {
    console.log(`   Response Time: ${runtimeConfigAvailable.responseTime}ms`)
  }
  if (runtimeConfigAvailable.error) {
    console.log(`   Error: ${runtimeConfigAvailable.error}`)
  }
  if (runtimeConfigAvailable.metadata) {
    console.log(`   Metadata:`)
    Object.entries(runtimeConfigAvailable.metadata).forEach(([key, value]) => {
      console.log(`     ${key}: ${value}`)
    })
  }

  // GoTrue check
  console.log('\n2. GoTrue Service:')
  console.log(`   Status: ${gotrueReachable.healthy ? '✅ Reachable' : '❌ Unreachable'}`)
  if (gotrueReachable.url) {
    console.log(`   URL: ${gotrueReachable.url}`)
  }
  if (gotrueReachable.responseTime !== undefined) {
    console.log(`   Response Time: ${gotrueReachable.responseTime}ms`)
  }
  if (gotrueReachable.error) {
    console.log(`   Error: ${gotrueReachable.error}`)
  }
  if (gotrueReachable.metadata) {
    console.log(`   Metadata:`)
    Object.entries(gotrueReachable.metadata).forEach(([key, value]) => {
      console.log(`     ${key}: ${value}`)
    })
  }

  // API gateway check
  console.log('\n3. API Gateway:')
  console.log(`   Status: ${apiGatewayReachable.healthy ? '✅ Reachable' : '❌ Unreachable'}`)
  if (apiGatewayReachable.url) {
    console.log(`   URL: ${apiGatewayReachable.url}`)
  }
  if (apiGatewayReachable.responseTime !== undefined) {
    console.log(`   Response Time: ${apiGatewayReachable.responseTime}ms`)
  }
  if (apiGatewayReachable.error) {
    console.log(`   Error: ${apiGatewayReachable.error}`)
  }
  if (apiGatewayReachable.metadata) {
    console.log(`   Metadata:`)
    Object.entries(apiGatewayReachable.metadata).forEach(([key, value]) => {
      console.log(`     ${key}: ${value}`)
    })
  }

  console.log()

  // Configuration details
  if (result.config) {
    console.log('Configuration Details:')
    console.log('─────────────────────────────────────────────────────')
    console.log(`Environment:    ${result.config.environment}`)
    console.log(`Source:         ${result.config.source}`)
    console.log(`GoTrue URL:     ${result.config.gotrueUrl}`)
    console.log(`Supabase URL:   ${result.config.supabaseUrl}`)
    console.log(`API URL:        ${result.config.apiUrl}`)
    console.log(`Has Anon Key:   ${result.config.anonKey ? 'Yes' : 'No'}`)
    console.log()
  }

  // Errors
  if (result.errors.length > 0) {
    console.log('Critical Errors:')
    console.log('─────────────────────────────────────────────────────')
    result.errors.forEach((error, index) => {
      console.log(`${index + 1}. ❌ ${error}`)
    })
    console.log()
  }

  // Warnings
  if (result.warnings.length > 0) {
    console.log('Warnings:')
    console.log('─────────────────────────────────────────────────────')
    result.warnings.forEach((warning, index) => {
      console.log(`${index + 1}. ⚠️  ${warning}`)
    })
    console.log()
  }

  // Recommendations
  if (!result.healthy) {
    console.log('Recommendations:')
    console.log('─────────────────────────────────────────────────────')
    
    if (!runtimeConfigAvailable.healthy) {
      console.log('• Fix runtime configuration issues first')
      console.log('  - Check environment variables are set correctly')
      console.log('  - Verify the runtime config API is accessible')
      console.log('  - Review server logs for errors')
    }

    if (!gotrueReachable.healthy && runtimeConfigAvailable.healthy) {
      console.log('• Verify GoTrue service is running and accessible')
      console.log('  - Check GoTrue container/service status')
      console.log('  - Verify network connectivity')
      console.log('  - Check firewall rules')
    }

    if (!apiGatewayReachable.healthy && runtimeConfigAvailable.healthy) {
      console.log('• Verify API gateway is running and accessible')
      console.log('  - Check Kong/API gateway container status')
      console.log('  - Verify network connectivity')
      console.log('  - Check firewall rules')
    }

    console.log()
    console.log('For more help, see:')
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
  const quick = args.includes('--quick')

  if (!jsonOutput) {
    console.log('═══════════════════════════════════════════════════════')
    console.log('  Configuration Health Check Test')
    console.log('═══════════════════════════════════════════════════════\n')
  }

  try {
    const result = await testHealthChecks(verbose && !jsonOutput, quick)

    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2))
      
      if (typeof result === 'boolean') {
        process.exit(result ? 0 : 1)
      } else {
        process.exit(result.healthy ? 0 : 1)
      }
    }

    // Quick check result
    if (quick) {
      console.log('\n═══════════════════════════════════════════════════════')
      console.log('  Quick Health Check Result')
      console.log('═══════════════════════════════════════════════════════\n')

      if (result === true) {
        console.log('✅ Quick health check PASSED')
        console.log('   Runtime configuration is available')
        console.log()
        process.exit(0)
      } else {
        console.log('❌ Quick health check FAILED')
        console.log('   Runtime configuration is not available')
        console.log()
        console.log('Next steps:')
        console.log('  1. Run with --verbose for more details')
        console.log('  2. Run without --quick for comprehensive checks')
        console.log('  3. Check environment variables')
        console.log()
        process.exit(1)
      }
    }

    // Comprehensive check result
    if (typeof result !== 'boolean') {
      displayDetailedAnalysis(result)

      console.log('═══════════════════════════════════════════════════════')
      console.log('  Test Summary')
      console.log('═══════════════════════════════════════════════════════\n')

      if (result.healthy) {
        console.log('✅ All health checks PASSED')
        console.log('   System is ready for operation')
        console.log()
        process.exit(0)
      } else {
        console.log('❌ Health checks FAILED')
        console.log(`   ${result.errors.length} error(s), ${result.warnings.length} warning(s)`)
        console.log()
        console.log('Review the detailed analysis above for specific issues.')
        console.log()
        process.exit(1)
      }
    }
  } catch (error) {
    if (jsonOutput) {
      console.error(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }))
    } else {
      console.error('\n❌ Health check test failed with unexpected error:')
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

export { testHealthChecks }
