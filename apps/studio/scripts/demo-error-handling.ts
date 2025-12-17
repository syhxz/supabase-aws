#!/usr/bin/env tsx

/**
 * Error Handling and User Guidance Demo
 * 
 * This script demonstrates the comprehensive error handling and user guidance system
 * working with different configuration scenarios.
 */

import {
  generateFallbackRecommendations,
  generateProductionLocalhostError,
  generateConfigurationValidationError,
  generateTroubleshootingGuide,
  logConfigurationError,
  UserGuidanceContext,
} from 'common/error-handling-guidance'
import { validateConfiguration } from '../lib/configuration-validation-service'

console.log('='.repeat(80))
console.log('ERROR HANDLING AND USER GUIDANCE DEMO')
console.log('='.repeat(80))

// Demo 1: Production-Localhost Mismatch Error
console.log('\n📋 Demo 1: Production-Localhost Mismatch (CRITICAL ERROR)')
console.log('-'.repeat(60))

const productionContext: UserGuidanceContext = {
  environment: 'production',
  isDocker: false,
  isBuildTime: false,
  availableVariables: ['NODE_ENV'],
  missingVariables: ['SUPABASE_PUBLIC_URL', 'API_EXTERNAL_URL'],
  currentUrls: {
    supabaseUrl: 'http://localhost:54321',
    gotrueUrl: 'http://localhost:54321/auth/v1',
  },
}

const productionError = generateProductionLocalhostError(
  ['http://localhost:54321', 'http://localhost:54321/auth/v1'],
  productionContext
)

logConfigurationError(productionError, productionContext, 'Demo 1')

// Demo 2: Fallback Configuration Recommendations
console.log('\n📋 Demo 2: Fallback Configuration (WARNING)')
console.log('-'.repeat(60))

const fallbackContext: UserGuidanceContext = {
  environment: 'production',
  isDocker: true,
  isBuildTime: false,
  availableVariables: ['NODE_ENV'],
  missingVariables: ['ENVIRONMENT', 'SUPABASE_PUBLIC_URL'],
  currentUrls: {},
}

const fallbackError = generateFallbackRecommendations('build-time', fallbackContext)
logConfigurationError(fallbackError, fallbackContext, 'Demo 2')

// Demo 3: Missing Configuration Variables
console.log('\n📋 Demo 3: Missing Configuration Variables (ERROR)')
console.log('-'.repeat(60))

const missingVarsContext: UserGuidanceContext = {
  environment: 'production',
  isDocker: false,
  isBuildTime: false,
  availableVariables: [],
  missingVariables: ['SUPABASE_PUBLIC_URL', 'API_EXTERNAL_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'],
  currentUrls: {},
}

const missingVarsError = generateConfigurationValidationError(
  ['SUPABASE_PUBLIC_URL', 'API_EXTERNAL_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'],
  [],
  missingVarsContext
)

logConfigurationError(missingVarsError, missingVarsContext, 'Demo 3')

// Demo 4: Troubleshooting Guides
console.log('\n📋 Demo 4: Environment-Specific Troubleshooting Guides')
console.log('-'.repeat(60))

const environments: Array<'production' | 'development' | 'staging'> = ['production', 'development', 'staging']

environments.forEach(env => {
  console.log(`\n🔧 ${env.toUpperCase()} Troubleshooting Guide:`)
  const guide = generateTroubleshootingGuide(env)
  
  console.log(`Title: ${guide.title}`)
  console.log(`Common Issues (top 3):`)
  guide.commonIssues.slice(0, 3).forEach((issue, index) => {
    console.log(`  ${index + 1}. ${issue}`)
  })
  
  console.log(`Quick Fixes (top 3):`)
  guide.quickFixes.slice(0, 3).forEach((fix, index) => {
    console.log(`  ${index + 1}. ${fix}`)
  })
  
  console.log(`Diagnostic Commands (top 2):`)
  guide.diagnosticCommands.slice(0, 2).forEach((cmd, index) => {
    console.log(`  ${index + 1}. ${cmd}`)
  })
})

// Demo 5: Comprehensive Configuration Validation
console.log('\n📋 Demo 5: Comprehensive Configuration Validation')
console.log('-'.repeat(60))

// Set up a problematic configuration for demonstration
process.env.ENVIRONMENT = 'production'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321' // This will cause errors
delete process.env.SUPABASE_PUBLIC_URL
delete process.env.API_EXTERNAL_URL

console.log('Testing configuration with production environment but localhost URLs...')

try {
  const validation = validateConfiguration({
    includeFrontend: true,
    includeDockerChecks: false,
    logResults: false, // We'll log manually for demo
  })

  console.log(`\nValidation Result: ${validation.isValid ? '✅ VALID' : '❌ INVALID'}`)
  console.log(`Summary: ${validation.summary}`)
  console.log(`Environment: ${validation.environmentInfo.environment}`)
  console.log(`Critical Errors: ${validation.criticalErrors.length}`)
  console.log(`Warnings: ${validation.warnings.length}`)
  
  if (validation.criticalErrors.length > 0) {
    console.log('\n🚨 Critical Errors Detected:')
    validation.criticalErrors.forEach((error, index) => {
      console.log(`  ${index + 1}. ${error.message}`)
      console.log(`     Severity: ${error.severity}`)
      console.log(`     Type: ${error.type}`)
      console.log(`     Top Recommendation: ${error.recommendations[0]}`)
    })
  }
  
  if (validation.warnings.length > 0) {
    console.log('\n⚠️ Warnings:')
    validation.warnings.forEach((warning, index) => {
      console.log(`  ${index + 1}. ${warning.message}`)
    })
  }

} catch (error) {
  console.error('Configuration validation failed:', error)
}

// Demo 6: Quick Health Check
console.log('\n📋 Demo 6: Quick Health Check')
console.log('-'.repeat(60))

try {
  const { quickHealthCheck } = require('../lib/configuration-validation-service')
  const healthCheck = quickHealthCheck()
  
  console.log(`Health Status: ${healthCheck.isHealthy ? '✅ HEALTHY' : '❌ UNHEALTHY'}`)
  console.log(`Summary: ${healthCheck.summary}`)
  console.log(`Critical Issues: ${healthCheck.criticalIssues}`)
  console.log(`Recommendations:`)
  healthCheck.recommendations.forEach((rec, index) => {
    console.log(`  ${index + 1}. ${rec}`)
  })
} catch (error) {
  console.error('Health check failed:', error)
}

console.log('\n' + '='.repeat(80))
console.log('DEMO COMPLETE - Error handling and user guidance system working!')
console.log('Key Features Demonstrated:')
console.log('✅ Production-localhost mismatch detection with critical errors')
console.log('✅ Fallback configuration recommendations')
console.log('✅ Missing variable validation with examples')
console.log('✅ Environment-specific troubleshooting guides')
console.log('✅ Comprehensive configuration validation')
console.log('✅ Quick health check functionality')
console.log('='.repeat(80))

// Clean up environment variables
delete process.env.ENVIRONMENT
delete process.env.NEXT_PUBLIC_SUPABASE_URL