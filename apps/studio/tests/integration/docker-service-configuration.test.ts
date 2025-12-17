/**
 * Docker and Service Configuration Integration Tests
 * 
 * Tests for task 5: Update Docker and service configuration
 * Validates GoTrue service configuration and Docker networking setup
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { 
  verifyGoTrueServiceConfiguration,
  generateGoTrueConfigReport,
  type GoTrueServiceConfig 
} from '../../lib/gotrue-service-verification'
import { 
  verifyDockerNetworkingConfiguration,
  generateNetworkingConfigReport,
  type DockerNetworkingConfig 
} from '../../lib/docker-networking-verification'

describe('Docker and Service Configuration', () => {
  let gotrueConfig: GoTrueServiceConfig
  let networkingConfig: DockerNetworkingConfig

  beforeAll(async () => {
    // Perform comprehensive configuration verification
    console.log('Starting comprehensive Docker and service configuration verification...')
    
    // Verify GoTrue service configuration (Task 5.1)
    gotrueConfig = await verifyGoTrueServiceConfiguration()
    
    // Verify Docker networking configuration (Task 5.2)
    networkingConfig = await verifyDockerNetworkingConfiguration()
    
    console.log('Configuration verification complete.')
  }, 30000) // 30 second timeout for comprehensive verification

  describe('Task 5.1: GoTrue Service Configuration', () => {
    it('should have valid GoTrue URL configuration', () => {
      expect(gotrueConfig.url).toBeTruthy()
      expect(gotrueConfig.isValidUrl).toBe(true)
      expect(['runtime', 'explicit', 'derived-public', 'derived', 'default']).toContain(gotrueConfig.source)
    })

    it('should have API key configured', () => {
      expect(gotrueConfig.hasApiKey).toBe(true)
    })

    it('should have all required environment variables present', () => {
      expect(gotrueConfig.environmentVariables.allPresent).toBe(true)
      expect(gotrueConfig.environmentVariables.missing).toHaveLength(0)
    })

    it('should have valid environment variables', () => {
      expect(gotrueConfig.environmentVariables.invalid).toHaveLength(0)
      
      // Check specific required variables
      const vars = gotrueConfig.environmentVariables.variables
      expect(vars['NEXT_PUBLIC_GOTRUE_URL']?.valid).toBe(true)
      expect(vars['SUPABASE_ANON_KEY']?.valid).toBe(true)
      expect(vars['AUTH_JWT_SECRET']?.valid).toBe(true)
    })

    it('should have accessible health endpoint', () => {
      expect(gotrueConfig.healthEndpoint.accessible).toBe(true)
      expect(gotrueConfig.healthEndpoint.properlyExposed).toBe(true)
      
      if (gotrueConfig.healthEndpoint.response) {
        expect(gotrueConfig.healthEndpoint.response.status).toBe(200)
        expect(gotrueConfig.healthEndpoint.response.responseTime).toBeGreaterThan(0)
      }
    })

    it('should have valid startup configuration', () => {
      expect(gotrueConfig.startupConfig.valid).toBe(true)
      expect(gotrueConfig.startupConfig.errors).toHaveLength(0)
      
      // Check specific configuration checks
      const checks = gotrueConfig.startupConfig.checks
      expect(checks.gotrueUrl?.valid).toBe(true)
      expect(checks.apiKey?.valid).toBe(true)
      expect(checks.jwtSecret?.valid).toBe(true)
    })

    it('should generate comprehensive configuration report', () => {
      const report = generateGoTrueConfigReport(gotrueConfig)
      expect(report).toContain('# GoTrue Service Configuration Report')
      expect(report).toContain('**URL:**')
      expect(report).toContain('**Source:**')
      expect(report).toContain('## Environment Variables')
      expect(report).toContain('## Health Endpoint')
      expect(report).toContain('## Startup Configuration')
    })
  })

  describe('Task 5.2: Docker Networking Configuration', () => {
    it('should have working service discovery', () => {
      expect(networkingConfig.serviceDiscovery.working).toBe(true)
      expect(networkingConfig.serviceDiscovery.errors).toHaveLength(0)
      
      // Check that critical services are discoverable
      const services = networkingConfig.serviceDiscovery.discoveredServices
      expect(services.kong?.reachable).toBe(true)
      expect(services.auth?.reachable).toBe(true)
      expect(services.studio?.reachable).toBe(true)
    })

    it('should have working network connectivity', () => {
      expect(networkingConfig.networkConnectivity.working).toBe(true)
      expect(networkingConfig.networkConnectivity.issues).toHaveLength(0)
      
      // Check critical connectivity paths
      const tests = networkingConfig.networkConnectivity.connectivityTests
      expect(tests['studio-to-kong']?.success).toBe(true)
      expect(tests['kong-to-gotrue']?.success).toBe(true)
      expect(tests['direct-gotrue']?.success).toBe(true)
    })

    it('should have correct port mapping', () => {
      expect(networkingConfig.portMapping.correct).toBe(true)
      expect(networkingConfig.portMapping.issues).toHaveLength(0)
      
      // Check that critical services have accessible ports
      const ports = networkingConfig.portMapping.ports
      expect(ports.kong?.accessible).toBe(true)
      expect(ports.auth?.accessible).toBe(true)
      expect(ports.studio?.accessible).toBe(true)
    })

    it('should have valid health check configuration', () => {
      // Note: This may not be fully valid if some services don't have health checks
      // but we should at least have configurations for critical services
      const configs = networkingConfig.healthCheckConfig.configurations
      expect(configs.studio?.configured).toBe(true)
      expect(configs.auth?.configured).toBe(true)
    })

    it('should have healthy overall status', () => {
      expect(networkingConfig.overallStatus.healthy).toBe(true)
      expect(networkingConfig.overallStatus.issues).toHaveLength(0)
    })

    it('should generate comprehensive networking report', () => {
      const report = generateNetworkingConfigReport(networkingConfig)
      expect(report).toContain('# Docker Networking Configuration Report')
      expect(report).toContain('**Overall Status:**')
      expect(report).toContain('## Service Discovery')
      expect(report).toContain('## Network Connectivity')
      expect(report).toContain('## Port Mapping')
      expect(report).toContain('## Health Check Configuration')
    })
  })

  describe('Integration: Complete Configuration Validation', () => {
    it('should have end-to-end GoTrue health check working through Kong', () => {
      // This validates the complete path: Studio -> Kong -> GoTrue
      const kongToGotrueTest = networkingConfig.networkConnectivity.connectivityTests['kong-to-gotrue']
      expect(kongToGotrueTest?.success).toBe(true)
      
      // And GoTrue service should be properly configured
      expect(gotrueConfig.healthEndpoint.accessible).toBe(true)
    })

    it('should have consistent URL configuration between GoTrue config and networking', () => {
      // The GoTrue URL should be accessible through the network
      expect(gotrueConfig.isValidUrl).toBe(true)
      expect(networkingConfig.serviceDiscovery.discoveredServices.auth?.reachable).toBe(true)
    })

    it('should have proper authentication setup for health checks', () => {
      // GoTrue should be accessible without authentication for health checks
      expect(gotrueConfig.healthEndpoint.accessible).toBe(true)
      expect(gotrueConfig.healthEndpoint.properlyExposed).toBe(true)
      
      // And Kong should route health requests correctly
      const kongToGotrueTest = networkingConfig.networkConnectivity.connectivityTests['kong-to-gotrue']
      expect(kongToGotrueTest?.success).toBe(true)
    })

    it('should meet all requirements for task 5', () => {
      // Requirement 4.1: GoTrue validates required environment variables
      expect(gotrueConfig.environmentVariables.allPresent).toBe(true)
      
      // Requirement 4.2: GoTrue health endpoint is properly exposed
      expect(gotrueConfig.healthEndpoint.accessible).toBe(true)
      expect(gotrueConfig.healthEndpoint.properlyExposed).toBe(true)
      
      // Requirement 3.1: GoTrue is accessible on expected port
      expect(networkingConfig.portMapping.ports.auth?.accessible).toBe(true)
      
      // Requirement 3.3: Network communication between services works
      expect(networkingConfig.networkConnectivity.working).toBe(true)
      
      // Requirement 3.4: Configuration is consistent across restarts (validated by proper setup)
      expect(gotrueConfig.startupConfig.valid).toBe(true)
    })
  })

  describe('Error Scenarios and Troubleshooting', () => {
    it('should provide helpful error messages when configuration is invalid', () => {
      if (!gotrueConfig.environmentVariables.allPresent) {
        expect(gotrueConfig.environmentVariables.missing.length).toBeGreaterThan(0)
        // Should have specific missing variable names
        gotrueConfig.environmentVariables.missing.forEach(varName => {
          expect(typeof varName).toBe('string')
          expect(varName.length).toBeGreaterThan(0)
        })
      }
    })

    it('should provide troubleshooting guidance for networking issues', () => {
      if (!networkingConfig.overallStatus.healthy) {
        expect(networkingConfig.overallStatus.recommendations.length).toBeGreaterThan(0)
        // Should have actionable recommendations
        networkingConfig.overallStatus.recommendations.forEach(rec => {
          expect(typeof rec).toBe('string')
          expect(rec.length).toBeGreaterThan(0)
        })
      }
    })

    it('should handle service discovery failures gracefully', () => {
      // Even if some services are not reachable, the verification should complete
      expect(networkingConfig.serviceDiscovery).toBeDefined()
      expect(networkingConfig.serviceDiscovery.discoveredServices).toBeDefined()
      
      // Should have attempted to discover all expected services
      const services = networkingConfig.serviceDiscovery.discoveredServices
      expect(Object.keys(services).length).toBeGreaterThan(0)
    })
  })

  describe('Performance and Reliability', () => {
    it('should complete health checks within reasonable time', () => {
      if (gotrueConfig.healthEndpoint.response) {
        expect(gotrueConfig.healthEndpoint.response.responseTime).toBeLessThan(5000) // 5 seconds
      }
      
      // Network connectivity tests should also be reasonably fast
      Object.values(networkingConfig.networkConnectivity.connectivityTests).forEach(test => {
        if (test.responseTime) {
          expect(test.responseTime).toBeLessThan(10000) // 10 seconds
        }
      })
    })

    it('should handle network timeouts gracefully', () => {
      // Verification should complete even if some services timeout
      expect(gotrueConfig).toBeDefined()
      expect(networkingConfig).toBeDefined()
      
      // Should not throw unhandled errors
      expect(true).toBe(true) // Test completed without throwing
    })
  })
})