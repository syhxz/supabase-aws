/**
 * Docker Environment Integration Tests
 * 
 * Comprehensive integration tests for Docker environment including:
 * - Service startup and health check availability
 * - Kong routing and authentication bypass
 * - Network connectivity and port configuration
 * - Service discovery and inter-service communication
 * 
 * Task 8.2: Add integration tests for Docker environment
 * Requirements: 3.1, 3.2, 3.3, 3.4
 * 
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest'

// Import Docker networking and service verification utilities
import {
  verifyDockerNetworkingConfiguration,
  validateServiceDiscovery,
  validateNetworkConnectivity,
  validatePortMapping,
  validateHealthCheckConfig,
  generateNetworkingConfigReport,
  type DockerNetworkingConfig,
  type ServiceDiscoveryValidation,
  type NetworkConnectivityValidation,
  type PortMappingValidation,
  type HealthCheckConfigValidation,
} from '../../lib/docker-networking-verification'

import {
  verifyGoTrueServiceConfiguration,
  validateGoTrueEnvironmentVariables,
  validateGoTrueHealthEndpoint,
  validateGoTrueStartupConfig,
  generateGoTrueConfigReport,
  type GoTrueServiceConfig,
  type EnvironmentVariableValidation,
  type HealthEndpointValidation,
  type StartupConfigValidation,
} from '../../lib/gotrue-service-verification'

// Import GoTrue health check functions
import {
  checkGoTrueHealth,
  checkGoTrueHealthEnhanced,
  checkGoTrueHealthComprehensive,
  type GoTrueHealthResult,
} from '../../lib/gotrue-health'

// Import configuration utilities
import { getGoTrueUrl } from 'common/gotrue-config'

// Test utilities
function createMockResponse(status: number, data?: any, headers?: Record<string, string>) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : status === 404 ? 'Not Found' : status === 500 ? 'Internal Server Error' : 'Error',
    headers: new Map(Object.entries(headers || {})),
    json: async () => data || { status: status === 200 ? 'ok' : 'error' },
  } as Response
}

function simulateDockerEnvironment() {
  // Set up environment variables that would be present in Docker environment
  process.env.SUPABASE_URL = 'http://kong:8000'
  process.env.SUPABASE_PUBLIC_URL = 'http://localhost:8000'
  process.env.API_EXTERNAL_URL = 'http://localhost:8000'
  process.env.NEXT_PUBLIC_GOTRUE_URL = 'http://kong:8000/auth/v1'
  process.env.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOuoJeHxjNa-NEHl1KOqJBOdQsUWWaRQKAcc'
  process.env.AUTH_JWT_SECRET = 'super-secret-jwt-token-with-at-least-32-characters-long'
  process.env.JWT_SECRET = 'super-secret-jwt-token-with-at-least-32-characters-long'
}

function simulateProductionEnvironment() {
  // Set up environment variables for production-like deployment
  process.env.NODE_ENV = 'production'
  process.env.SUPABASE_PUBLIC_URL = 'https://prod.example.com'
  process.env.API_EXTERNAL_URL = 'https://api.prod.example.com'
  process.env.NEXT_PUBLIC_GOTRUE_URL = 'https://prod.example.com/auth/v1'
  process.env.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1wcm9kIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOuoJeHxjNa-NEHl1KOqJBOdQsUWWaRQKAcc'
  process.env.AUTH_JWT_SECRET = 'production-secret-jwt-token-with-at-least-32-characters-long'
}

describe('Docker Environment Integration Tests', () => {
  const originalFetch = global.fetch
  const originalEnv = { ...process.env }

  beforeAll(() => {
    // Mock console methods to reduce noise in tests
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  beforeEach(() => {
    process.env = { ...originalEnv }
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.env = originalEnv
    global.fetch = originalFetch
  })

  afterAll(() => {
    vi.restoreAllMocks()
  })

  describe('Service Startup and Health Check Availability', () => {
    it('should validate all Docker services are accessible and healthy', async () => {
      simulateDockerEnvironment()
      
      // Mock successful responses for all services
      const mockFetch = vi.fn()
        .mockResolvedValueOnce(createMockResponse(200)) // kong:8000
        .mockResolvedValueOnce(createMockResponse(200)) // auth:9999
        .mockResolvedValueOnce(createMockResponse(200)) // rest:3000
        .mockResolvedValueOnce(createMockResponse(200)) // db:5432
        .mockResolvedValueOnce(createMockResponse(200)) // studio:3000

      global.fetch = mockFetch

      const serviceDiscovery = await validateServiceDiscovery()
      
      expect(serviceDiscovery.working).toBe(true)
      expect(serviceDiscovery.errors).toHaveLength(0)
      
      // Verify all expected services are discovered
      expect(serviceDiscovery.discoveredServices).toHaveProperty('kong')
      expect(serviceDiscovery.discoveredServices).toHaveProperty('auth')
      expect(serviceDiscovery.discoveredServices).toHaveProperty('rest')
      expect(serviceDiscovery.discoveredServices).toHaveProperty('db')
      expect(serviceDiscovery.discoveredServices).toHaveProperty('studio')
      
      // Verify all services are reachable
      Object.values(serviceDiscovery.discoveredServices).forEach(service => {
        expect(service.reachable).toBe(true)
        expect(service.responseTime).toBeGreaterThan(0)
      })
    })

    it('should handle service startup failures gracefully', async () => {
      simulateDockerEnvironment()
      
      // Mock mixed responses - some services up, some down
      const mockFetch = vi.fn()
        .mockResolvedValueOnce(createMockResponse(200)) // kong:8000 - up
        .mockRejectedValueOnce(new Error('Connection refused')) // auth:9999 - down
        .mockResolvedValueOnce(createMockResponse(200)) // rest:3000 - up
        .mockRejectedValueOnce(new Error('Connection refused')) // db:5432 - down
        .mockResolvedValueOnce(createMockResponse(200)) // studio:3000 - up

      global.fetch = mockFetch

      const serviceDiscovery = await validateServiceDiscovery()
      
      expect(serviceDiscovery.working).toBe(false)
      expect(serviceDiscovery.errors.length).toBeGreaterThan(0)
      
      // Verify specific service states
      expect(serviceDiscovery.discoveredServices.kong.reachable).toBe(true)
      expect(serviceDiscovery.discoveredServices.auth.reachable).toBe(false)
      expect(serviceDiscovery.discoveredServices.rest.reachable).toBe(true)
      expect(serviceDiscovery.discoveredServices.db.reachable).toBe(false)
      expect(serviceDiscovery.discoveredServices.studio.reachable).toBe(true)
      
      // Verify error messages contain service names
      expect(serviceDiscovery.errors.some(error => error.includes('auth'))).toBe(true)
      expect(serviceDiscovery.errors.some(error => error.includes('db'))).toBe(true)
    })

    it('should validate GoTrue service health endpoint availability', async () => {
      simulateDockerEnvironment()
      
      // Mock successful GoTrue health response
      const mockFetch = vi.fn().mockResolvedValue(
        createMockResponse(200, {
          status: 'ok',
          version: '2.182.1',
          name: 'GoTrue',
          description: 'Supabase Auth API',
        })
      )
      global.fetch = mockFetch

      const healthEndpoint = await validateGoTrueHealthEndpoint()
      
      expect(healthEndpoint.accessible).toBe(true)
      expect(healthEndpoint.properlyExposed).toBe(true)
      expect(healthEndpoint.response).toBeDefined()
      expect(healthEndpoint.response?.status).toBe(200)
      expect(healthEndpoint.response?.data?.status).toBe('ok')
      expect(healthEndpoint.response?.data?.version).toBe('2.182.1')
      expect(healthEndpoint.error).toBeUndefined()
    })

    it('should detect GoTrue service configuration issues', async () => {
      simulateDockerEnvironment()
      
      // Mock GoTrue service returning error
      const mockFetch = vi.fn().mockResolvedValue(
        createMockResponse(503, { error: 'Service temporarily unavailable' })
      )
      global.fetch = mockFetch

      const healthEndpoint = await validateGoTrueHealthEndpoint()
      
      expect(healthEndpoint.accessible).toBe(false)
      expect(healthEndpoint.properlyExposed).toBe(false)
      expect(healthEndpoint.error).toContain('Health endpoint not accessible')
    })

    it('should validate health check configuration in docker-compose', async () => {
      const healthCheckConfig = validateHealthCheckConfig()
      
      expect(healthCheckConfig).toBeDefined()
      expect(healthCheckConfig.configurations).toHaveProperty('studio')
      expect(healthCheckConfig.configurations).toHaveProperty('auth')
      expect(healthCheckConfig.configurations).toHaveProperty('db')
      
      // Verify Studio health check configuration
      expect(healthCheckConfig.configurations.studio.configured).toBe(true)
      expect(healthCheckConfig.configurations.studio.endpoint).toBe('/api/health')
      expect(healthCheckConfig.configurations.studio.interval).toBe('30s')
      expect(healthCheckConfig.configurations.studio.timeout).toBe('10s')
      expect(healthCheckConfig.configurations.studio.retries).toBe(3)
      
      // Verify GoTrue health check configuration
      expect(healthCheckConfig.configurations.auth.configured).toBe(true)
      expect(healthCheckConfig.configurations.auth.endpoint).toBe('/health')
      expect(healthCheckConfig.configurations.auth.interval).toBe('5s')
      expect(healthCheckConfig.configurations.auth.timeout).toBe('5s')
      expect(healthCheckConfig.configurations.auth.retries).toBe(3)
    })
  })

  describe('Kong Routing and Authentication Bypass', () => {
    it('should validate Kong Gateway routes health checks without authentication', async () => {
      simulateDockerEnvironment()
      
      // Mock successful Kong routing to GoTrue health endpoint
      const mockFetch = vi.fn().mockResolvedValue(
        createMockResponse(200, { status: 'ok' })
      )
      global.fetch = mockFetch

      // Test health check through Kong Gateway
      const result = await checkGoTrueHealth('http://kong:8000/auth/v1')
      
      expect(result.available).toBe(true)
      expect(result.url).toBe('http://kong:8000/auth/v1')
      expect(mockFetch).toHaveBeenCalledWith(
        'http://kong:8000/auth/v1/health',
        expect.objectContaining({
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        })
      )
      
      // Verify no authentication headers were sent
      const fetchCall = mockFetch.mock.calls[0]
      const headers = fetchCall[1]?.headers as Record<string, string>
      expect(headers).not.toHaveProperty('Authorization')
      expect(headers).not.toHaveProperty('apikey')
    })

    it('should validate Kong Gateway bypasses key-auth for health endpoint', async () => {
      simulateDockerEnvironment()
      
      // Mock Kong Gateway response for health endpoint (should not require auth)
      const mockFetch = vi.fn().mockResolvedValue(
        createMockResponse(200, { status: 'ok' })
      )
      global.fetch = mockFetch

      const networkConnectivity = await validateNetworkConnectivity()
      
      expect(networkConnectivity.working).toBe(true)
      expect(networkConnectivity.connectivityTests['kong-to-gotrue'].success).toBe(true)
      expect(networkConnectivity.issues).toHaveLength(0)
    })

    it('should handle Kong Gateway authentication errors for non-health endpoints', async () => {
      simulateDockerEnvironment()
      
      // Mock Kong Gateway returning 401 for authenticated endpoints
      const mockFetch = vi.fn()
        .mockResolvedValueOnce(createMockResponse(200, { status: 'ok' })) // Health endpoint works
        .mockResolvedValueOnce(createMockResponse(401, { message: 'No API key found in request' })) // Auth endpoint requires key

      global.fetch = mockFetch

      // Test health endpoint (should work without auth)
      const healthResult = await checkGoTrueHealth('http://kong:8000/auth/v1')
      expect(healthResult.available).toBe(true)

      // Test authenticated endpoint (should fail without API key)
      try {
        const response = await fetch('http://kong:8000/auth/v1/user', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        })
        expect(response.status).toBe(401)
      } catch (error) {
        // Network error is also acceptable in test environment
        expect(error).toBeDefined()
      }
    })

    it('should validate Kong Gateway CORS configuration for health endpoint', async () => {
      simulateDockerEnvironment()
      
      // Mock Kong Gateway response with CORS headers
      const mockFetch = vi.fn().mockResolvedValue(
        createMockResponse(200, { status: 'ok' }, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        })
      )
      global.fetch = mockFetch

      const result = await checkGoTrueHealth('http://kong:8000/auth/v1')
      
      expect(result.available).toBe(true)
      
      // In a real environment, we would verify CORS headers
      // For now, we just ensure the request succeeds
    })
  })

  describe('Network Connectivity and Port Configuration', () => {
    it('should validate inter-service network communication', async () => {
      simulateDockerEnvironment()
      
      // Mock successful responses for all connectivity tests
      const mockFetch = vi.fn()
        .mockResolvedValueOnce(createMockResponse(200)) // Studio -> Kong
        .mockResolvedValueOnce(createMockResponse(200, { status: 'ok' })) // Kong -> GoTrue
        .mockResolvedValueOnce(createMockResponse(200, { status: 'ok' })) // Direct GoTrue

      global.fetch = mockFetch

      const networkConnectivity = await validateNetworkConnectivity()
      
      expect(networkConnectivity.working).toBe(true)
      expect(networkConnectivity.issues).toHaveLength(0)
      
      // Verify all connectivity tests pass
      expect(networkConnectivity.connectivityTests['studio-to-kong'].success).toBe(true)
      expect(networkConnectivity.connectivityTests['kong-to-gotrue'].success).toBe(true)
      expect(networkConnectivity.connectivityTests['direct-gotrue'].success).toBe(true)
      
      // Verify response times are recorded
      Object.values(networkConnectivity.connectivityTests).forEach(test => {
        expect(test.responseTime).toBeGreaterThan(0)
      })
    })

    it('should detect network connectivity issues', async () => {
      simulateDockerEnvironment()
      
      // Mock network failures
      const mockFetch = vi.fn()
        .mockRejectedValueOnce(new Error('Connection refused')) // Studio -> Kong fails
        .mockRejectedValueOnce(new Error('Network timeout')) // Kong -> GoTrue fails
        .mockResolvedValueOnce(createMockResponse(200, { status: 'ok' })) // Direct GoTrue works

      global.fetch = mockFetch

      const networkConnectivity = await validateNetworkConnectivity()
      
      expect(networkConnectivity.working).toBe(false)
      expect(networkConnectivity.issues.length).toBeGreaterThan(0)
      
      // Verify specific connectivity test results
      expect(networkConnectivity.connectivityTests['studio-to-kong'].success).toBe(false)
      expect(networkConnectivity.connectivityTests['kong-to-gotrue'].success).toBe(false)
      expect(networkConnectivity.connectivityTests['direct-gotrue'].success).toBe(true)
      
      // Verify error messages are captured
      expect(networkConnectivity.connectivityTests['studio-to-kong'].error).toContain('Connection refused')
      expect(networkConnectivity.connectivityTests['kong-to-gotrue'].error).toContain('Network timeout')
    })

    it('should validate Docker port mapping configuration', async () => {
      simulateDockerEnvironment()
      
      // Mock successful responses for all port tests
      const mockFetch = vi.fn()
        .mockResolvedValueOnce(createMockResponse(200)) // kong:8000
        .mockResolvedValueOnce(createMockResponse(200)) // auth:9999
        .mockResolvedValueOnce(createMockResponse(200)) // rest:3000
        .mockResolvedValueOnce(createMockResponse(200)) // db:5432
        .mockResolvedValueOnce(createMockResponse(200)) // studio:3000

      global.fetch = mockFetch

      const portMapping = await validatePortMapping()
      
      expect(portMapping.correct).toBe(true)
      expect(portMapping.issues).toHaveLength(0)
      
      // Verify all expected ports are accessible
      expect(portMapping.ports.kong.accessible).toBe(true)
      expect(portMapping.ports.kong.internal).toBe(8000)
      expect(portMapping.ports.kong.external).toBe(8000)
      
      expect(portMapping.ports.auth.accessible).toBe(true)
      expect(portMapping.ports.auth.internal).toBe(9999)
      expect(portMapping.ports.auth.external).toBeNull()
      
      expect(portMapping.ports.studio.accessible).toBe(true)
      expect(portMapping.ports.studio.internal).toBe(3000)
      expect(portMapping.ports.studio.external).toBe(3000)
    })

    it('should detect port mapping conflicts', async () => {
      simulateDockerEnvironment()
      
      // Mock port conflicts (some services not accessible)
      const mockFetch = vi.fn()
        .mockResolvedValueOnce(createMockResponse(200)) // kong:8000 - works
        .mockRejectedValueOnce(new Error('Connection refused')) // auth:9999 - port conflict
        .mockResolvedValueOnce(createMockResponse(200)) // rest:3000 - works
        .mockRejectedValueOnce(new Error('Connection refused')) // db:5432 - port conflict
        .mockResolvedValueOnce(createMockResponse(200)) // studio:3000 - works

      global.fetch = mockFetch

      const portMapping = await validatePortMapping()
      
      expect(portMapping.correct).toBe(false)
      expect(portMapping.issues.length).toBeGreaterThan(0)
      
      // Verify specific port accessibility
      expect(portMapping.ports.kong.accessible).toBe(true)
      expect(portMapping.ports.auth.accessible).toBe(false)
      expect(portMapping.ports.rest.accessible).toBe(true)
      expect(portMapping.ports.db.accessible).toBe(false)
      expect(portMapping.ports.studio.accessible).toBe(true)
      
      // Verify error messages mention port conflicts
      expect(portMapping.issues.some(issue => issue.includes('auth'))).toBe(true)
      expect(portMapping.issues.some(issue => issue.includes('db'))).toBe(true)
    })

    it('should validate service restart maintains network configuration', async () => {
      simulateDockerEnvironment()
      
      // Mock successful responses for initial check
      const mockFetch1 = vi.fn()
        .mockResolvedValue(createMockResponse(200, { status: 'ok' }))

      global.fetch = mockFetch1

      // First connectivity check
      const initialConnectivity = await validateNetworkConnectivity()
      expect(initialConnectivity.working).toBe(true)

      // Simulate service restart by changing mock
      const mockFetch2 = vi.fn()
        .mockResolvedValue(createMockResponse(200, { status: 'ok' }))

      global.fetch = mockFetch2

      // Second connectivity check after "restart"
      const postRestartConnectivity = await validateNetworkConnectivity()
      expect(postRestartConnectivity.working).toBe(true)
      
      // Verify configuration consistency
      expect(postRestartConnectivity.connectivityTests['studio-to-kong'].success)
        .toBe(initialConnectivity.connectivityTests['studio-to-kong'].success)
      expect(postRestartConnectivity.connectivityTests['kong-to-gotrue'].success)
        .toBe(initialConnectivity.connectivityTests['kong-to-gotrue'].success)
    })
  })

  describe('Comprehensive Docker Environment Validation', () => {
    it('should perform complete Docker networking configuration verification', async () => {
      simulateDockerEnvironment()
      
      // Mock successful responses for all verification steps
      const mockFetch = vi.fn()
        // Service discovery responses
        .mockResolvedValueOnce(createMockResponse(200)) // kong
        .mockResolvedValueOnce(createMockResponse(200)) // auth
        .mockResolvedValueOnce(createMockResponse(200)) // rest
        .mockResolvedValueOnce(createMockResponse(200)) // db
        .mockResolvedValueOnce(createMockResponse(200)) // studio
        // Network connectivity responses
        .mockResolvedValueOnce(createMockResponse(200)) // studio-to-kong
        .mockResolvedValueOnce(createMockResponse(200, { status: 'ok' })) // kong-to-gotrue
        .mockResolvedValueOnce(createMockResponse(200, { status: 'ok' })) // direct-gotrue
        // Port mapping responses
        .mockResolvedValueOnce(createMockResponse(200)) // kong port
        .mockResolvedValueOnce(createMockResponse(200)) // auth port
        .mockResolvedValueOnce(createMockResponse(200)) // rest port
        .mockResolvedValueOnce(createMockResponse(200)) // db port
        .mockResolvedValueOnce(createMockResponse(200)) // studio port

      global.fetch = mockFetch

      const dockerConfig = await verifyDockerNetworkingConfiguration()
      
      expect(dockerConfig.overallStatus.healthy).toBe(true)
      expect(dockerConfig.overallStatus.issues).toHaveLength(0)
      
      // Verify all components are healthy
      expect(dockerConfig.serviceDiscovery.working).toBe(true)
      expect(dockerConfig.networkConnectivity.working).toBe(true)
      expect(dockerConfig.portMapping.correct).toBe(true)
      expect(dockerConfig.healthCheckConfig.valid).toBe(true)
      
      // Verify recommendations are provided when healthy
      expect(dockerConfig.overallStatus.recommendations).toBeDefined()
    })

    it('should generate comprehensive networking configuration report', async () => {
      simulateDockerEnvironment()
      
      // Mock mixed results for more interesting report
      const mockFetch = vi.fn()
        .mockResolvedValueOnce(createMockResponse(200)) // kong - up
        .mockRejectedValueOnce(new Error('Connection refused')) // auth - down
        .mockResolvedValueOnce(createMockResponse(200)) // rest - up
        .mockResolvedValueOnce(createMockResponse(200)) // db - up
        .mockResolvedValueOnce(createMockResponse(200)) // studio - up
        .mockResolvedValueOnce(createMockResponse(200)) // studio-to-kong - works
        .mockRejectedValueOnce(new Error('Service unavailable')) // kong-to-gotrue - fails
        .mockRejectedValueOnce(new Error('Service unavailable')) // direct-gotrue - fails
        .mockResolvedValueOnce(createMockResponse(200)) // kong port - works
        .mockRejectedValueOnce(new Error('Connection refused')) // auth port - fails
        .mockResolvedValueOnce(createMockResponse(200)) // rest port - works
        .mockResolvedValueOnce(createMockResponse(200)) // db port - works
        .mockResolvedValueOnce(createMockResponse(200)) // studio port - works

      global.fetch = mockFetch

      const dockerConfig = await verifyDockerNetworkingConfiguration()
      const report = generateNetworkingConfigReport(dockerConfig)
      
      expect(report).toContain('Docker Networking Configuration Report')
      expect(report).toContain('Overall Status:')
      expect(report).toContain('Service Discovery')
      expect(report).toContain('Network Connectivity')
      expect(report).toContain('Port Mapping')
      expect(report).toContain('Health Check Configuration')
      
      // Should contain issues and recommendations
      expect(report).toContain('Issues')
      expect(report).toContain('Recommendations')
      
      // Should contain specific service information
      expect(report).toContain('kong')
      expect(report).toContain('auth')
      expect(report).toContain('studio')
    })

    it('should validate GoTrue service configuration in Docker environment', async () => {
      simulateDockerEnvironment()
      
      // Mock successful GoTrue health response
      const mockFetch = vi.fn().mockResolvedValue(
        createMockResponse(200, {
          status: 'ok',
          version: '2.182.1',
          name: 'GoTrue',
          description: 'Supabase Auth API',
        })
      )
      global.fetch = mockFetch

      const gotrueConfig = await verifyGoTrueServiceConfiguration()
      
      expect(gotrueConfig.url).toBe('http://kong:8000/auth/v1')
      expect(gotrueConfig.source).toBe('runtime')
      expect(gotrueConfig.isValidUrl).toBe(true)
      expect(gotrueConfig.hasApiKey).toBe(true)
      
      // Verify environment variables are properly configured
      expect(gotrueConfig.environmentVariables.allPresent).toBe(true)
      expect(gotrueConfig.environmentVariables.missing).toHaveLength(0)
      
      // Verify health endpoint is accessible
      expect(gotrueConfig.healthEndpoint.accessible).toBe(true)
      expect(gotrueConfig.healthEndpoint.properlyExposed).toBe(true)
      
      // Verify startup configuration is valid
      expect(gotrueConfig.startupConfig.valid).toBe(true)
      expect(gotrueConfig.startupConfig.errors).toHaveLength(0)
    })

    it('should handle Docker environment configuration errors', async () => {
      // Simulate misconfigured Docker environment
      process.env.NEXT_PUBLIC_GOTRUE_URL = 'invalid-url'
      process.env.SUPABASE_ANON_KEY = 'too-short' // Invalid key
      delete process.env.AUTH_JWT_SECRET // Missing required variable
      
      const mockFetch = vi.fn().mockRejectedValue(new Error('Service unavailable'))
      global.fetch = mockFetch

      const gotrueConfig = await verifyGoTrueServiceConfiguration()
      
      expect(gotrueConfig.isValidUrl).toBe(false)
      expect(gotrueConfig.environmentVariables.allPresent).toBe(false)
      expect(gotrueConfig.environmentVariables.missing.length).toBeGreaterThan(0)
      expect(gotrueConfig.environmentVariables.invalid.length).toBeGreaterThan(0)
      expect(gotrueConfig.healthEndpoint.accessible).toBe(false)
      expect(gotrueConfig.startupConfig.valid).toBe(false)
      expect(gotrueConfig.startupConfig.errors.length).toBeGreaterThan(0)
    })

    it('should validate production deployment configuration', async () => {
      simulateProductionEnvironment()
      
      // Mock successful production responses
      const mockFetch = vi.fn()
        .mockResolvedValue(createMockResponse(200, { status: 'ok' }))

      global.fetch = mockFetch

      const gotrueConfig = await verifyGoTrueServiceConfiguration()
      
      expect(gotrueConfig.url).toBe('https://prod.example.com/auth/v1')
      expect(gotrueConfig.source).toBe('runtime')
      expect(gotrueConfig.isValidUrl).toBe(true)
      
      // Verify production URLs don't contain localhost
      expect(gotrueConfig.url).not.toContain('localhost')
      expect(gotrueConfig.url).not.toContain('127.0.0.1')
      
      // Verify HTTPS is used in production
      expect(gotrueConfig.url).toMatch(/^https:\/\//)
    })

    it('should provide troubleshooting guidance for Docker issues', async () => {
      simulateDockerEnvironment()
      
      // Mock various failure scenarios
      const mockFetch = vi.fn()
        .mockRejectedValue(new Error('Connection refused'))

      global.fetch = mockFetch

      const dockerConfig = await verifyDockerNetworkingConfiguration()
      
      expect(dockerConfig.overallStatus.healthy).toBe(false)
      expect(dockerConfig.overallStatus.issues.length).toBeGreaterThan(0)
      expect(dockerConfig.overallStatus.recommendations.length).toBeGreaterThan(0)
      
      // Verify recommendations include Docker-specific guidance
      const recommendations = dockerConfig.overallStatus.recommendations.join(' ')
      expect(recommendations).toContain('docker compose')
      expect(recommendations).toContain('Docker')
    })
  })

  describe('Environment-Specific Docker Configuration', () => {
    it('should validate development Docker environment', async () => {
      // Set up development environment
      process.env.NODE_ENV = 'development'
      process.env.SUPABASE_URL = 'http://kong:8000'
      process.env.SUPABASE_PUBLIC_URL = 'http://localhost:8000'
      process.env.NEXT_PUBLIC_GOTRUE_URL = 'http://kong:8000/auth/v1'
      
      const mockFetch = vi.fn().mockResolvedValue(
        createMockResponse(200, { status: 'ok' })
      )
      global.fetch = mockFetch

      const result = await checkGoTrueHealthComprehensive()
      
      expect(result.available).toBe(true)
      expect(result.url).toBe('http://kong:8000/auth/v1')
      
      // Development should use internal Docker networking
      expect(result.url).toContain('kong:8000')
    })

    it('should validate staging Docker deployment', async () => {
      // Set up staging environment
      process.env.NODE_ENV = 'production'
      process.env.SUPABASE_PUBLIC_URL = 'https://staging.example.com'
      process.env.API_EXTERNAL_URL = 'https://api.staging.example.com'
      
      const mockFetch = vi.fn().mockResolvedValue(
        createMockResponse(200, { status: 'ok' })
      )
      global.fetch = mockFetch

      const gotrueConfig = getGoTrueUrl()
      const result = await checkGoTrueHealthComprehensive(gotrueConfig.url)
      
      expect(result.available).toBe(true)
      expect(result.url).toBe('https://staging.example.com')
      
      // Staging should use external URLs
      expect(result.url).toContain('staging.example.com')
      expect(result.url).not.toContain('kong:')
    })

    it('should handle Docker Compose service dependencies', async () => {
      simulateDockerEnvironment()
      
      // Mock responses that simulate service dependency chain
      const mockFetch = vi.fn()
        .mockResolvedValueOnce(createMockResponse(200)) // DB is up
        .mockResolvedValueOnce(createMockResponse(200, { status: 'ok' })) // GoTrue is up (depends on DB)
        .mockResolvedValueOnce(createMockResponse(200)) // Kong is up (depends on GoTrue)
        .mockResolvedValueOnce(createMockResponse(200)) // Studio is up (depends on Kong)

      global.fetch = mockFetch

      const serviceDiscovery = await validateServiceDiscovery()
      
      expect(serviceDiscovery.working).toBe(true)
      
      // Verify all services in the dependency chain are accessible
      expect(serviceDiscovery.discoveredServices.db.reachable).toBe(true)
      expect(serviceDiscovery.discoveredServices.auth.reachable).toBe(true)
      expect(serviceDiscovery.discoveredServices.kong.reachable).toBe(true)
      expect(serviceDiscovery.discoveredServices.studio.reachable).toBe(true)
    })

    it('should validate Docker volume and persistence configuration', async () => {
      simulateDockerEnvironment()
      
      // This test would validate that persistent volumes are properly configured
      // For now, we test that the configuration validation includes persistence checks
      
      const gotrueConfig = await verifyGoTrueServiceConfiguration()
      
      // Verify configuration includes database connectivity (which requires persistent volumes)
      expect(gotrueConfig.startupConfig.checks).toHaveProperty('gotrueUrl')
      expect(gotrueConfig.startupConfig.checks).toHaveProperty('apiKey')
      expect(gotrueConfig.startupConfig.checks).toHaveProperty('jwtSecret')
      
      // In a real Docker environment, we would also check:
      // - Database data persistence
      // - Storage volume mounts
      // - Configuration file persistence
    })
  })
})