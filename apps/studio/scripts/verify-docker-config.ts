#!/usr/bin/env tsx
/**
 * Docker and Service Configuration Verification CLI Tool
 * 
 * This script performs comprehensive verification of Docker and service configuration
 * for the GoTrue authentication health check fix (Task 5).
 * 
 * Usage:
 *   npm run verify-docker-config
 *   or
 *   npx tsx scripts/verify-docker-config.ts
 */

import { 
  verifyGoTrueServiceConfiguration,
  generateGoTrueConfigReport,
  type GoTrueServiceConfig 
} from '../lib/gotrue-service-verification'
import { 
  verifyDockerNetworkingConfiguration,
  generateNetworkingConfigReport,
  type DockerNetworkingConfig 
} from '../lib/docker-networking-verification'

interface VerificationResults {
  gotrueConfig: GoTrueServiceConfig
  networkingConfig: DockerNetworkingConfig
  overallSuccess: boolean
  summary: string[]
}

/**
 * Performs comprehensive Docker and service configuration verification
 */
async function performVerification(): Promise<VerificationResults> {
  console.log('🔍 Starting Docker and Service Configuration Verification...\n')
  
  // Step 1: Verify GoTrue Service Configuration (Task 5.1)
  console.log('📋 Task 5.1: Verifying GoTrue Service Configuration')
  console.log('=' .repeat(60))
  
  const gotrueConfig = await verifyGoTrueServiceConfiguration()
  
  console.log('\n📊 GoTrue Configuration Results:')
  console.log(`   URL: ${gotrueConfig.url}`)
  console.log(`   Source: ${gotrueConfig.source}`)
  console.log(`   Valid URL: ${gotrueConfig.isValidUrl ? '✅' : '❌'}`)
  console.log(`   Has API Key: ${gotrueConfig.hasApiKey ? '✅' : '❌'}`)
  console.log(`   Environment Variables: ${gotrueConfig.environmentVariables.allPresent ? '✅' : '❌'}`)
  console.log(`   Health Endpoint: ${gotrueConfig.healthEndpoint.accessible ? '✅' : '❌'}`)
  console.log(`   Startup Config: ${gotrueConfig.startupConfig.valid ? '✅' : '❌'}`)
  
  if (gotrueConfig.environmentVariables.missing.length > 0) {
    console.log(`   Missing Variables: ${gotrueConfig.environmentVariables.missing.join(', ')}`)
  }
  
  if (gotrueConfig.environmentVariables.invalid.length > 0) {
    console.log(`   Invalid Variables: ${gotrueConfig.environmentVariables.invalid.join(', ')}`)
  }
  
  if (!gotrueConfig.healthEndpoint.accessible && gotrueConfig.healthEndpoint.error) {
    console.log(`   Health Error: ${gotrueConfig.healthEndpoint.error}`)
  }
  
  if (gotrueConfig.startupConfig.errors.length > 0) {
    console.log(`   Config Errors: ${gotrueConfig.startupConfig.errors.join(', ')}`)
  }
  
  // Step 2: Verify Docker Networking Configuration (Task 5.2)
  console.log('\n\n🌐 Task 5.2: Verifying Docker Networking Configuration')
  console.log('=' .repeat(60))
  
  const networkingConfig = await verifyDockerNetworkingConfiguration()
  
  console.log('\n📊 Docker Networking Results:')
  console.log(`   Service Discovery: ${networkingConfig.serviceDiscovery.working ? '✅' : '❌'}`)
  console.log(`   Network Connectivity: ${networkingConfig.networkConnectivity.working ? '✅' : '❌'}`)
  console.log(`   Port Mapping: ${networkingConfig.portMapping.correct ? '✅' : '❌'}`)
  console.log(`   Health Check Config: ${networkingConfig.healthCheckConfig.valid ? '✅' : '❌'}`)
  console.log(`   Overall Status: ${networkingConfig.overallStatus.healthy ? '✅ Healthy' : '❌ Issues Detected'}`)
  
  if (networkingConfig.serviceDiscovery.errors.length > 0) {
    console.log(`   Service Discovery Errors: ${networkingConfig.serviceDiscovery.errors.length}`)
  }
  
  if (networkingConfig.networkConnectivity.issues.length > 0) {
    console.log(`   Connectivity Issues: ${networkingConfig.networkConnectivity.issues.length}`)
  }
  
  if (networkingConfig.portMapping.issues.length > 0) {
    console.log(`   Port Mapping Issues: ${networkingConfig.portMapping.issues.length}`)
  }
  
  // Step 3: Overall Assessment
  console.log('\n\n🎯 Overall Assessment')
  console.log('=' .repeat(60))
  
  const gotrueSuccess = (
    gotrueConfig.isValidUrl &&
    gotrueConfig.hasApiKey &&
    gotrueConfig.environmentVariables.allPresent &&
    gotrueConfig.healthEndpoint.accessible &&
    gotrueConfig.startupConfig.valid
  )
  
  const networkingSuccess = networkingConfig.overallStatus.healthy
  const overallSuccess = gotrueSuccess && networkingSuccess
  
  const summary: string[] = []
  
  if (gotrueSuccess) {
    summary.push('✅ GoTrue Service Configuration: PASSED')
  } else {
    summary.push('❌ GoTrue Service Configuration: FAILED')
  }
  
  if (networkingSuccess) {
    summary.push('✅ Docker Networking Configuration: PASSED')
  } else {
    summary.push('❌ Docker Networking Configuration: FAILED')
  }
  
  if (overallSuccess) {
    summary.push('🎉 Overall Verification: SUCCESS')
    console.log('🎉 All configuration checks passed!')
    console.log('   Your Docker and service configuration is ready for GoTrue health checks.')
  } else {
    summary.push('⚠️  Overall Verification: ISSUES DETECTED')
    console.log('⚠️  Configuration issues detected. See details above.')
  }
  
  return {
    gotrueConfig,
    networkingConfig,
    overallSuccess,
    summary,
  }
}

/**
 * Displays detailed troubleshooting information
 */
function displayTroubleshooting(results: VerificationResults): void {
  const { gotrueConfig, networkingConfig, overallSuccess } = results
  
  if (overallSuccess) {
    return // No troubleshooting needed
  }
  
  console.log('\n\n🔧 Troubleshooting Guide')
  console.log('=' .repeat(60))
  
  // GoTrue Configuration Issues
  if (!gotrueConfig.environmentVariables.allPresent || 
      !gotrueConfig.healthEndpoint.accessible || 
      !gotrueConfig.startupConfig.valid) {
    
    console.log('\n📋 GoTrue Configuration Issues:')
    
    if (gotrueConfig.environmentVariables.missing.length > 0) {
      console.log('\n   Missing Environment Variables:')
      gotrueConfig.environmentVariables.missing.forEach(varName => {
        console.log(`   • Set ${varName} in your .env file`)
      })
    }
    
    if (gotrueConfig.environmentVariables.invalid.length > 0) {
      console.log('\n   Invalid Environment Variables:')
      gotrueConfig.environmentVariables.invalid.forEach(varName => {
        const varInfo = gotrueConfig.environmentVariables.variables[varName]
        console.log(`   • Fix ${varName}: ${varInfo.error}`)
      })
    }
    
    if (!gotrueConfig.healthEndpoint.accessible) {
      console.log('\n   Health Endpoint Issues:')
      console.log('   • Ensure Docker services are running: docker compose up')
      console.log('   • Check GoTrue service logs: docker compose logs auth')
      console.log('   • Verify Kong Gateway is routing correctly')
      if (gotrueConfig.healthEndpoint.error) {
        console.log(`   • Error: ${gotrueConfig.healthEndpoint.error}`)
      }
    }
    
    if (!gotrueConfig.startupConfig.valid) {
      console.log('\n   Startup Configuration Issues:')
      gotrueConfig.startupConfig.errors.forEach(error => {
        console.log(`   • ${error}`)
      })
    }
  }
  
  // Docker Networking Issues
  if (!networkingConfig.overallStatus.healthy) {
    console.log('\n🌐 Docker Networking Issues:')
    
    if (networkingConfig.overallStatus.recommendations.length > 0) {
      console.log('\n   Recommendations:')
      networkingConfig.overallStatus.recommendations.forEach(rec => {
        console.log(`   • ${rec}`)
      })
    }
    
    if (!networkingConfig.serviceDiscovery.working) {
      console.log('\n   Service Discovery Issues:')
      networkingConfig.serviceDiscovery.errors.forEach(error => {
        console.log(`   • ${error}`)
      })
    }
    
    if (!networkingConfig.networkConnectivity.working) {
      console.log('\n   Network Connectivity Issues:')
      networkingConfig.networkConnectivity.issues.forEach(issue => {
        console.log(`   • ${issue}`)
      })
    }
    
    if (!networkingConfig.portMapping.correct) {
      console.log('\n   Port Mapping Issues:')
      networkingConfig.portMapping.issues.forEach(issue => {
        console.log(`   • ${issue}`)
      })
    }
  }
  
  console.log('\n   General Troubleshooting Steps:')
  console.log('   • Restart Docker services: docker compose down && docker compose up')
  console.log('   • Check service logs: docker compose logs')
  console.log('   • Verify environment variables in docker/.env and apps/studio/.env')
  console.log('   • Ensure no port conflicts with other services')
  console.log('   • Check Docker network: docker network ls')
}

/**
 * Generates and saves detailed reports
 */
function generateReports(results: VerificationResults): void {
  console.log('\n\n📄 Generating Detailed Reports')
  console.log('=' .repeat(60))
  
  try {
    const gotrueReport = generateGoTrueConfigReport(results.gotrueConfig)
    const networkingReport = generateNetworkingConfigReport(results.networkingConfig)
    
    console.log('\n📋 GoTrue Configuration Report:')
    console.log(gotrueReport)
    
    console.log('\n\n🌐 Docker Networking Report:')
    console.log(networkingReport)
    
  } catch (error) {
    console.error('❌ Failed to generate reports:', error)
  }
}

/**
 * Main execution function
 */
async function main(): void {
  try {
    console.log('Docker and Service Configuration Verification Tool')
    console.log('Task 5: Update Docker and service configuration')
    console.log('=' .repeat(80))
    
    const results = await performVerification()
    
    displayTroubleshooting(results)
    
    // Show summary
    console.log('\n\n📋 Summary')
    console.log('=' .repeat(60))
    results.summary.forEach(line => console.log(line))
    
    // Generate detailed reports
    generateReports(results)
    
    // Exit with appropriate code
    process.exit(results.overallSuccess ? 0 : 1)
    
  } catch (error) {
    console.error('\n❌ Verification failed with error:', error)
    console.error('\nThis may indicate a serious configuration or environment issue.')
    console.error('Please check your Docker setup and environment variables.')
    process.exit(1)
  }
}

// Run the verification if this script is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}

export { performVerification, type VerificationResults }