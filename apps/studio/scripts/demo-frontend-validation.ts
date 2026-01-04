#!/usr/bin/env tsx

/**
 * Frontend Client Validation Demo
 * 
 * This script demonstrates the frontend client URL validation system
 * working correctly with different environment configurations.
 */

import { validateFrontendClientUrls, getFrontendClientUrls, logFrontendClientInitialization } from 'common/frontend-client-validation'

console.log('='.repeat(80))
console.log('FRONTEND CLIENT URL VALIDATION DEMO')
console.log('='.repeat(80))

// Demo 1: Production environment with HTTPS URLs
console.log('\n📋 Demo 1: Production Environment with HTTPS URLs')
console.log('-'.repeat(50))

const productionValidation = validateFrontendClientUrls(
  'https://my-project.supabase.co',
  'https://my-project.supabase.co/auth/v1'
)

console.log(`Environment detected: ${productionValidation.detectedEnvironment}`)
console.log(`Validation result: ${productionValidation.isValid ? '✅ VALID' : '❌ INVALID'}`)
console.log(`Errors: ${productionValidation.errors.length}`)
console.log(`Warnings: ${productionValidation.warnings.length}`)

// Demo 2: Development environment with localhost URLs
console.log('\n📋 Demo 2: Development Environment with Localhost URLs')
console.log('-'.repeat(50))

// Set environment variable to simulate development
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'

const developmentValidation = validateFrontendClientUrls(
  'http://localhost:54321',
  'http://localhost:54321/auth/v1'
)

console.log(`Environment detected: ${developmentValidation.detectedEnvironment}`)
console.log(`Validation result: ${developmentValidation.isValid ? '✅ VALID' : '❌ INVALID'}`)
console.log(`Errors: ${developmentValidation.errors.length}`)
console.log(`Warnings: ${developmentValidation.warnings.length}`)

// Demo 3: Production environment with localhost URLs (ERROR CASE)
console.log('\n📋 Demo 3: Production Environment with Localhost URLs (ERROR)')
console.log('-'.repeat(50))

const errorValidation = validateFrontendClientUrls(
  'http://localhost:54321',
  'http://localhost:54321/auth/v1',
  'production' // Force production environment
)

console.log(`Environment detected: ${errorValidation.detectedEnvironment}`)
console.log(`Validation result: ${errorValidation.isValid ? '✅ VALID' : '❌ INVALID'}`)
console.log(`Errors: ${errorValidation.errors.length}`)
console.log(`Warnings: ${errorValidation.warnings.length}`)

if (errorValidation.errors.length > 0) {
  console.log('\nError details:')
  errorValidation.errors.forEach((error, index) => {
    console.log(`  ${index + 1}. ${error}`)
  })
}

// Demo 4: URL Priority System
console.log('\n📋 Demo 4: URL Priority System')
console.log('-'.repeat(50))

// Set multiple environment variables to test priority
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://priority-1.supabase.co'
process.env.SUPABASE_PUBLIC_URL = 'https://priority-2.supabase.co'
process.env.SUPABASE_URL = 'http://localhost:54321'

const { supabaseUrl, sources } = getFrontendClientUrls()

console.log(`Selected URL: ${supabaseUrl}`)
console.log(`Source: ${sources.supabaseUrl.source} (priority ${sources.supabaseUrl.priority})`)
console.log('\nThis demonstrates that NEXT_PUBLIC_SUPABASE_URL takes highest priority')

// Demo 5: Frontend Client Initialization Logging
console.log('\n📋 Demo 5: Frontend Client Initialization Logging')
console.log('-'.repeat(50))

process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'demo-key-12345'

const initLog = logFrontendClientInitialization({
  supabaseUrl: 'https://demo.supabase.co',
  anonKey: 'demo-key-12345',
  gotrueUrl: 'https://demo.supabase.co/auth/v1',
})

console.log(`\nInitialization logged at: ${initLog.timestamp}`)
console.log(`Environment: ${initLog.environment}`)
console.log(`Validation status: ${initLog.validation.isValid ? '✅ SUCCESS' : '❌ ERRORS'}`)

console.log('\n' + '='.repeat(80))
console.log('DEMO COMPLETE - Frontend client validation is working correctly!')
console.log('='.repeat(80))

// Clean up environment variables
delete process.env.NEXT_PUBLIC_SUPABASE_URL
delete process.env.SUPABASE_PUBLIC_URL
delete process.env.SUPABASE_URL
delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY