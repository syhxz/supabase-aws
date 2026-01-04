/**
 * Demo script for GoTrue Configuration Validation
 * 
 * This script demonstrates the configuration validation and hot reload functionality
 * implemented for Requirements 4.1, 4.2, and 4.5.
 */

import { validateGoTrueConfiguration, formatValidationResult } from './gotrue-config-validation'
import { GoTrueConfigManager } from './gotrue-config-manager'

/**
 * Demonstrates configuration validation with different scenarios
 */
export async function demoConfigurationValidation() {
  console.log('=== GoTrue Configuration Validation Demo ===\n')

  // Scenario 1: Valid production configuration
  console.log('1. Testing valid production configuration...')
  process.env.NEXT_PUBLIC_GOTRUE_URL = 'https://example.supabase.co/auth/v1'
  process.env.SUPABASE_PUBLIC_URL = 'https://example.supabase.co'
  process.env.API_EXTERNAL_URL = 'https://api.example.com'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.valid-production-key'
  process.env.NODE_ENV = 'production'

  let result = validateGoTrueConfiguration()
  console.log(`✓ Valid: ${result.isValid}`)
  console.log(`✓ Environment: ${result.environment}`)
  console.log(`✓ Errors: ${result.errors.length}`)
  console.log(`✓ Warnings: ${result.warnings.length}\n`)

  // Scenario 2: Invalid configuration
  console.log('2. Testing invalid configuration...')
  process.env.NEXT_PUBLIC_GOTRUE_URL = 'invalid-url'
  process.env.SUPABASE_PUBLIC_URL = 'also-invalid'
  delete process.env.API_EXTERNAL_URL
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  result = validateGoTrueConfiguration()
  console.log(`✗ Valid: ${result.isValid}`)
  console.log(`✗ Errors: ${result.errors.length}`)
  console.log('Error types:', result.errors.map(e => e.type))
  console.log('Error messages:', result.errors.map(e => e.message))
  console.log()

  // Scenario 3: Development configuration with derivation
  console.log('3. Testing development configuration with URL derivation...')
  process.env.NODE_ENV = 'development'
  delete process.env.NEXT_PUBLIC_GOTRUE_URL
  process.env.SUPABASE_PUBLIC_URL = 'http://localhost:54321'
  delete process.env.API_EXTERNAL_URL // Will be derived
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dev-key'

  result = validateGoTrueConfiguration()
  console.log(`✓ Valid: ${result.isValid}`)
  console.log(`✓ Environment: ${result.environment}`)
  console.log(`✓ GoTrue URL (derived): ${result.validatedConfig.gotrueUrl}`)
  console.log(`✓ API URL (derived): ${result.validatedConfig.apiUrl}`)
  console.log()

  // Scenario 4: Formatted validation result
  console.log('4. Formatted validation result:')
  console.log(formatValidationResult(result))
}

/**
 * Demonstrates configuration manager functionality
 */
export async function demoConfigurationManager() {
  console.log('\n=== GoTrue Configuration Manager Demo ===\n')

  // Set up valid configuration
  process.env.NEXT_PUBLIC_GOTRUE_URL = 'https://example.supabase.co/auth/v1'
  process.env.SUPABASE_PUBLIC_URL = 'https://example.supabase.co'
  process.env.API_EXTERNAL_URL = 'https://api.example.com'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.valid-key'

  console.log('1. Creating configuration manager...')
  const manager = new GoTrueConfigManager({
    validateOnStartup: true,
    enableHotReload: false, // Disable for demo
    enableHealthChecks: false, // Disable for demo
  })

  console.log('2. Initializing manager...')
  await manager.initialize()

  console.log('3. Getting manager state...')
  const state = manager.getState()
  console.log(`✓ Initialized: ${state.initialized}`)
  console.log(`✓ Validation passed: ${state.validationResult?.isValid}`)
  console.log(`✓ Error count: ${state.errorCount}`)

  console.log('4. Getting status summary...')
  const status = manager.getStatusSummary()
  console.log(`✓ Overall status: ${status.overall}`)
  console.log(`✓ Validation status: ${status.validation}`)
  console.log(`✓ Hot reload status: ${status.hotReload}`)

  console.log('5. Manual validation...')
  const validationResult = await manager.validateConfiguration()
  console.log(`✓ Manual validation passed: ${validationResult.isValid}`)

  console.log('6. Shutting down manager...')
  manager.shutdown()
  console.log('✓ Manager shut down successfully')
}

/**
 * Demonstrates error scenarios and recovery
 */
export async function demoErrorRecovery() {
  console.log('\n=== Error Recovery Demo ===\n')

  // Test different error scenarios
  const errorScenarios = [
    {
      name: 'Missing required variables',
      setup: () => {
        delete process.env.NEXT_PUBLIC_GOTRUE_URL
        delete process.env.SUPABASE_PUBLIC_URL
        delete process.env.API_EXTERNAL_URL
        delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      },
    },
    {
      name: 'Invalid URL formats',
      setup: () => {
        process.env.NEXT_PUBLIC_GOTRUE_URL = 'not-a-url'
        process.env.SUPABASE_PUBLIC_URL = 'also-invalid'
        process.env.API_EXTERNAL_URL = 'still-invalid'
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'short'
      },
    },
    {
      name: 'Production security issues',
      setup: () => {
        process.env.NODE_ENV = 'production'
        process.env.NEXT_PUBLIC_GOTRUE_URL = 'http://example.com/auth/v1' // HTTP in production
        process.env.SUPABASE_PUBLIC_URL = 'https://example.supabase.co'
        process.env.API_EXTERNAL_URL = 'https://api.example.com'
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'short' // Too short for production
      },
    },
  ]

  errorScenarios.forEach((scenario, index) => {
    console.log(`${index + 1}. Testing: ${scenario.name}`)
    
    // Reset and setup scenario
    const originalEnv = { ...process.env }
    scenario.setup()
    
    const result = validateGoTrueConfiguration()
    console.log(`   ✗ Valid: ${result.isValid}`)
    console.log(`   ✗ Errors: ${result.errors.length}`)
    console.log(`   ✗ Error types: ${result.errors.map(e => e.type).join(', ')}`)
    
    // Show remediation steps for first error
    if (result.errors.length > 0) {
      console.log(`   ✓ Remediation steps for ${result.errors[0].key}:`)
      result.errors[0].remediationSteps.slice(0, 2).forEach(step => {
        console.log(`     • ${step}`)
      })
    }
    
    // Restore environment
    process.env = originalEnv
    console.log()
  })
}

/**
 * Main demo function
 */
export async function runConfigurationDemo() {
  try {
    await demoConfigurationValidation()
    await demoConfigurationManager()
    await demoErrorRecovery()
    
    console.log('=== Demo completed successfully! ===')
  } catch (error) {
    console.error('Demo failed:', error)
  }
}

// Run demo if this file is executed directly
if (require.main === module) {
  runConfigurationDemo()
}