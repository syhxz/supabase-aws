#!/usr/bin/env tsx
/**
 * Deployment Verification Script
 * 
 * This script verifies that all correctness properties are satisfied
 * and the deployment is ready for production.
 * 
 * Usage:
 *   tsx apps/studio/scripts/verify-deployment.ts [--host HOST] [--port PORT]
 * 
 * Options:
 *   --host    Studio host (default: localhost)
 *   --port    Studio port (default: 3000)
 *   --verbose Show detailed output
 */

interface VerificationResult {
  property: string
  requirement: string
  passed: boolean
  message: string
  details?: string
}

interface DeploymentCheckResult {
  passed: boolean
  message: string
  details?: string
}

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(message: string, color: keyof typeof COLORS = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`)
}

function parseArgs() {
  const args = process.argv.slice(2)
  const config = {
    host: 'localhost',
    port: 3000,
    verbose: false,
  }

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--host' && args[i + 1]) {
      config.host = args[i + 1]
      i++
    } else if (args[i] === '--port' && args[i + 1]) {
      config.port = parseInt(args[i + 1], 10)
      i++
    } else if (args[i] === '--verbose') {
      config.verbose = true
    }
  }

  return config
}

async function fetchRuntimeConfig(host: string, port: number) {
  const url = `http://${host}:${port}/api/runtime-config`
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    return await response.json()
  } catch (error) {
    throw new Error(`Failed to fetch runtime config: ${error}`)
  }
}

async function verifyProperty1(host: string, port: number): Promise<VerificationResult> {
  // Property 1: Runtime configuration loading
  try {
    const config = await fetchRuntimeConfig(host, port)
    
    const hasRequiredFields = 
      config.gotrueUrl && 
      config.supabaseUrl && 
      config.apiUrl && 
      config.anonKey

    return {
      property: 'Property 1: Runtime configuration loading',
      requirement: 'Requirements 1.1',
      passed: hasRequiredFields,
      message: hasRequiredFields 
        ? 'Runtime configuration loads successfully with all required fields'
        : 'Runtime configuration missing required fields',
      details: JSON.stringify(config, null, 2),
    }
  } catch (error) {
    return {
      property: 'Property 1: Runtime configuration loading',
      requirement: 'Requirements 1.1',
      passed: false,
      message: 'Failed to load runtime configuration',
      details: String(error),
    }
  }
}

async function verifyProperty2(host: string, port: number): Promise<VerificationResult> {
  // Property 2: Production URL usage
  try {
    const config = await fetchRuntimeConfig(host, port)
    
    const hasLocalhost = 
      config.gotrueUrl?.includes('localhost') ||
      config.gotrueUrl?.includes('127.0.0.1') ||
      config.supabaseUrl?.includes('localhost') ||
      config.supabaseUrl?.includes('127.0.0.1') ||
      config.apiUrl?.includes('localhost') ||
      config.apiUrl?.includes('127.0.0.1')

    const isProduction = config.environment === 'production'

    if (isProduction && hasLocalhost) {
      return {
        property: 'Property 2: Production URL usage',
        requirement: 'Requirements 1.2',
        passed: false,
        message: 'Production environment is using localhost URLs',
        details: JSON.stringify(config, null, 2),
      }
    }

    return {
      property: 'Property 2: Production URL usage',
      requirement: 'Requirements 1.2',
      passed: true,
      message: isProduction 
        ? 'Production URLs are correctly configured'
        : 'Development environment (localhost URLs are acceptable)',
      details: JSON.stringify(config, null, 2),
    }
  } catch (error) {
    return {
      property: 'Property 2: Production URL usage',
      requirement: 'Requirements 1.2',
      passed: false,
      message: 'Failed to verify URL configuration',
      details: String(error),
    }
  }
}

async function verifyProperty3(host: string, port: number): Promise<VerificationResult> {
  // Property 3: Runtime config API correctness
  try {
    const config = await fetchRuntimeConfig(host, port)
    
    const validUrls = 
      config.gotrueUrl?.startsWith('http') &&
      config.supabaseUrl?.startsWith('http') &&
      config.apiUrl?.startsWith('http')

    const noTrailingSlash =
      !config.gotrueUrl?.endsWith('/') &&
      !config.supabaseUrl?.endsWith('/') &&
      !config.apiUrl?.endsWith('/')

    const hasSource = ['explicit', 'derived', 'default'].includes(config.source)

    const passed = validUrls && noTrailingSlash && hasSource

    return {
      property: 'Property 3: Runtime config API correctness',
      requirement: 'Requirements 1.3',
      passed,
      message: passed
        ? 'Runtime config API returns correctly formatted URLs'
        : 'Runtime config API has formatting issues',
      details: JSON.stringify({
        validUrls,
        noTrailingSlash,
        hasSource,
        config,
      }, null, 2),
    }
  } catch (error) {
    return {
      property: 'Property 3: Runtime config API correctness',
      requirement: 'Requirements 1.3',
      passed: false,
      message: 'Failed to verify runtime config API',
      details: String(error),
    }
  }
}

async function verifyProperty10(host: string, port: number): Promise<VerificationResult> {
  // Property 10: Configuration source logging
  try {
    const config = await fetchRuntimeConfig(host, port)
    
    const hasSource = config.source && ['explicit', 'derived', 'default'].includes(config.source)
    const hasEnvironment = config.environment && ['development', 'production', 'staging'].includes(config.environment)

    return {
      property: 'Property 10: Configuration source logging',
      requirement: 'Requirements 2.5',
      passed: hasSource && hasEnvironment,
      message: hasSource && hasEnvironment
        ? `Configuration source: ${config.source}, environment: ${config.environment}`
        : 'Configuration missing source or environment information',
      details: JSON.stringify(config, null, 2),
    }
  } catch (error) {
    return {
      property: 'Property 10: Configuration source logging',
      requirement: 'Requirements 2.5',
      passed: false,
      message: 'Failed to verify configuration source',
      details: String(error),
    }
  }
}

async function checkDeploymentItem(
  name: string,
  check: () => Promise<boolean>,
  details?: string
): Promise<DeploymentCheckResult> {
  try {
    const passed = await check()
    return {
      passed,
      message: name,
      details,
    }
  } catch (error) {
    return {
      passed: false,
      message: name,
      details: String(error),
    }
  }
}

async function verifyDeploymentChecklist(host: string, port: number) {
  log('\n📋 Deployment Checklist Verification', 'cyan')
  log('=' .repeat(60), 'cyan')

  const checks: DeploymentCheckResult[] = []

  // Check 1: Runtime config API accessible
  checks.push(await checkDeploymentItem(
    'Runtime config API accessible',
    async () => {
      try {
        await fetchRuntimeConfig(host, port)
        return true
      } catch {
        return false
      }
    }
  ))

  // Check 2: Environment variables set
  checks.push(await checkDeploymentItem(
    'Environment variables configured',
    async () => {
      const config = await fetchRuntimeConfig(host, port)
      return config.source !== 'default'
    },
    'Source should be "explicit" or "derived", not "default"'
  ))

  // Check 3: No localhost in production
  checks.push(await checkDeploymentItem(
    'No localhost URLs in production',
    async () => {
      const config = await fetchRuntimeConfig(host, port)
      if (config.environment !== 'production') return true
      
      return !(
        config.gotrueUrl?.includes('localhost') ||
        config.gotrueUrl?.includes('127.0.0.1') ||
        config.supabaseUrl?.includes('localhost') ||
        config.supabaseUrl?.includes('127.0.0.1') ||
        config.apiUrl?.includes('localhost') ||
        config.apiUrl?.includes('127.0.0.1')
      )
    }
  ))

  // Check 4: Valid URL formats
  checks.push(await checkDeploymentItem(
    'All URLs properly formatted',
    async () => {
      const config = await fetchRuntimeConfig(host, port)
      return (
        config.gotrueUrl?.startsWith('http') &&
        config.supabaseUrl?.startsWith('http') &&
        config.apiUrl?.startsWith('http') &&
        !config.gotrueUrl?.endsWith('/') &&
        !config.supabaseUrl?.endsWith('/') &&
        !config.apiUrl?.endsWith('/')
      )
    }
  ))

  // Check 5: Anon key present
  checks.push(await checkDeploymentItem(
    'Anon key configured',
    async () => {
      const config = await fetchRuntimeConfig(host, port)
      return !!config.anonKey && config.anonKey.length > 0
    }
  ))

  // Print results
  checks.forEach((check, index) => {
    const icon = check.passed ? '✅' : '❌'
    const color = check.passed ? 'green' : 'red'
    log(`${icon} ${index + 1}. ${check.message}`, color)
    if (check.details && !check.passed) {
      log(`   ${check.details}`, 'yellow')
    }
  })

  const allPassed = checks.every(c => c.passed)
  log('\n' + '='.repeat(60), 'cyan')
  log(
    allPassed 
      ? '✅ All deployment checks passed!' 
      : '❌ Some deployment checks failed',
    allPassed ? 'green' : 'red'
  )

  return allPassed
}

async function main() {
  const config = parseArgs()

  log('\n🔍 Supabase Studio Deployment Verification', 'blue')
  log('=' .repeat(60), 'blue')
  log(`Host: ${config.host}`, 'cyan')
  log(`Port: ${config.port}`, 'cyan')
  log('=' .repeat(60) + '\n', 'blue')

  // Verify correctness properties
  log('🎯 Verifying Correctness Properties', 'cyan')
  log('=' .repeat(60), 'cyan')

  const properties = [
    await verifyProperty1(config.host, config.port),
    await verifyProperty2(config.host, config.port),
    await verifyProperty3(config.host, config.port),
    await verifyProperty10(config.host, config.port),
  ]

  properties.forEach((result, index) => {
    const icon = result.passed ? '✅' : '❌'
    const color = result.passed ? 'green' : 'red'
    log(`\n${icon} ${result.property}`, color)
    log(`   Validates: ${result.requirement}`, 'cyan')
    log(`   ${result.message}`, color)
    
    if (config.verbose && result.details) {
      log(`   Details:`, 'yellow')
      result.details.split('\n').forEach(line => {
        log(`   ${line}`, 'yellow')
      })
    }
  })

  const propertiesPassed = properties.every(p => p.passed)

  // Verify deployment checklist
  const checklistPassed = await verifyDeploymentChecklist(config.host, config.port)

  // Final summary
  log('\n' + '='.repeat(60), 'blue')
  log('📊 Verification Summary', 'blue')
  log('=' .repeat(60), 'blue')
  log(`Properties verified: ${properties.filter(p => p.passed).length}/${properties.length}`, 
    propertiesPassed ? 'green' : 'red')
  log(`Deployment checks: ${checklistPassed ? 'PASSED' : 'FAILED'}`,
    checklistPassed ? 'green' : 'red')
  
  const allPassed = propertiesPassed && checklistPassed
  log('\n' + (allPassed 
    ? '✅ Deployment verification PASSED - Ready for production!' 
    : '❌ Deployment verification FAILED - Please fix issues before deploying'),
    allPassed ? 'green' : 'red'
  )
  log('=' .repeat(60) + '\n', 'blue')

  process.exit(allPassed ? 0 : 1)
}

main().catch((error) => {
  log(`\n❌ Verification failed with error: ${error}`, 'red')
  process.exit(1)
})
