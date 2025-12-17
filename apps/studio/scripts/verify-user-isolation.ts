#!/usr/bin/env tsx
/**
 * User Isolation Verification Script
 * 
 * This script verifies that project-specific database users have proper isolation
 * and cannot access databases from other projects.
 * 
 * Usage:
 *   npm run verify-isolation
 *   or
 *   tsx scripts/verify-user-isolation.ts
 */

import { runIsolationVerification, generateIsolationVerificationScript } from '../lib/api/self-hosted/user-isolation-security'

async function main() {
  console.log('🔍 Starting user isolation verification...\n')

  try {
    const result = await runIsolationVerification()
    
    if (result.error) {
      console.error('❌ Verification failed:', result.error.message)
      process.exit(1)
    }

    const report = result.data!
    
    console.log('📊 Isolation Verification Report')
    console.log('================================')
    console.log(`Timestamp: ${report.timestamp.toISOString()}`)
    console.log(`Status: ${report.isolationStatus}`)
    console.log(`Users checked: ${report.usersChecked.length}`)
    console.log(`Databases checked: ${report.databasesChecked.length}`)
    console.log(`Violations found: ${report.violations.length}`)
    console.log()

    if (report.violations.length > 0) {
      console.log('🚨 Security Violations Found:')
      console.log('=============================')
      
      for (const violation of report.violations) {
        const severityIcon = {
          'CRITICAL': '🔴',
          'HIGH': '🟠',
          'MEDIUM': '🟡',
          'LOW': '🟢'
        }[violation.severity]
        
        console.log(`${severityIcon} ${violation.severity}: ${violation.type}`)
        console.log(`   User: ${violation.username}`)
        console.log(`   Database: ${violation.database}`)
        console.log(`   Description: ${violation.description}`)
        console.log(`   Recommendation: ${violation.recommendation}`)
        console.log()
      }
    }

    console.log('📋 Summary:')
    console.log(report.summary)
    console.log()

    if (report.isolationStatus === 'SECURE') {
      console.log('✅ User isolation is properly configured!')
      process.exit(0)
    } else {
      console.log('❌ User isolation issues detected. Please review and fix the violations above.')
      process.exit(1)
    }

  } catch (error) {
    console.error('💥 Unexpected error during verification:', error)
    process.exit(1)
  }
}

// Also provide the SQL script for manual verification
function printSqlScript() {
  console.log('📝 Manual Verification SQL Script:')
  console.log('==================================')
  console.log(generateIsolationVerificationScript())
}

// Check command line arguments
const args = process.argv.slice(2)
if (args.includes('--sql') || args.includes('-s')) {
  printSqlScript()
} else {
  main()
}