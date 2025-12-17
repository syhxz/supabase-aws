/**
 * Unit Tests for Configuration Health Check Module
 * 
 * These tests verify the configuration health check functionality including:
 * - Runtime configuration availability checks
 * - Service reachability checks (GoTrue and API gateway)
 * - Health check aggregation and error reporting
 * - Timeout handling
 * 
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  performConfigHealthCheck,
  quickHealthCheck,
  getHealthCheckErrorMessage,
  formatHealthCheckResult,
  type ConfigHealthResult,
} from '../../lib/config-health'
import * as runtimeConfig from 'common/runtime-config'

describe('Configuration Health Check', () => {
  beforeEach(() => {
    // Reset fetch mock before each test
    global.fetch = vi.fn()
    
    // Mock runtime config module
    vi.spyOn(runtimeConfig, 'getRuntimeConfig')
    vi.spyOn(runtimeConfig, 'fetchRuntimeConfig')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('performConfigHealthCheck', () => {
    it('should return healthy status when all checks pass', async () => {
      // Mock runtime config
      const mockConfig: runtimeConfig.RuntimeConfig = {
        gotrueUrl: 'http://example.com/auth/v1',
        supabaseUrl: 'http://example.com',
        apiUrl: 'http://example.com',
        anonKey: 'test-key',
        source: 'explicit',
        environment: 'production',
        timestamp: Date.now(),
      }

      vi.mocked(runtimeConfig.getRuntimeConfig).mockReturnValue(mockConfig)
      vi.mocked(runtimeConfig.fetchRuntimeConfig).mockResolvedValue(mockConfig)

      // Mock successful health check responses
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ version: '1.0.0', name: 'Service' }),
      })

      const result = await performConfigHealthCheck()

      expect(result.healthy).toBe(true)
      expect(result.checks.runtimeConfigAvailable.healthy).toBe(true)
      expect(result.checks.gotrueReachable.healthy).toBe(true)
      expect(result.checks.apiGatewayReachable.healthy).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.config).toEqual(mockConfig)
    })

    it('should return unhealthy status when runtime config is unavailable', async () => {
      vi.mocked(runtimeConfig.getRuntimeConfig).mockReturnValue(null)
      vi.mocked(runtimeConfig.fetchRuntimeConfig).mockRejectedValue(
        new Error('Failed to fetch config')
      )

      const result = await performConfigHealthCheck()

      expect(result.healthy).toBe(false)
      expect(result.checks.runtimeConfigAvailable.healthy).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]).toContain('Failed to fetch runtime configuration')
    })

    it('should return unhealthy status when GoTrue is unreachable', async () => {
      const mockConfig: runtimeConfig.RuntimeConfig = {
        gotrueUrl: 'http://example.com/auth/v1',
        supabaseUrl: 'http://example.com',
        apiUrl: 'http://example.com',
        anonKey: 'test-key',
        source: 'explicit',
        environment: 'production',
        timestamp: Date.now(),
      }

      vi.mocked(runtimeConfig.getRuntimeConfig).mockReturnValue(mockConfig)
      vi.mocked(runtimeConfig.fetchRuntimeConfig).mockResolvedValue(mockConfig)

      // Mock GoTrue health check failure
      ;(global.fetch as any).mockRejectedValue(new Error('Connection refused'))

      const result = await performConfigHealthCheck()

      expect(result.healthy).toBe(false)
      expect(result.checks.runtimeConfigAvailable.healthy).toBe(true)
      expect(result.checks.gotrueReachable.healthy).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors.some((e) => e.includes('GoTrue'))).toBe(true)
    })

    it('should handle GoTrue 401 authentication errors with specific guidance', async () => {
      const mockConfig: runtimeConfig.RuntimeConfig = {
        gotrueUrl: 'http://example.com/auth/v1',
        supabaseUrl: 'http://example.com',
        apiUrl: 'http://example.com',
        anonKey: 'test-key',
        source: 'explicit',
        environment: 'production',
        timestamp: Date.now(),
      }

      vi.mocked(runtimeConfig.getRuntimeConfig).mockReturnValue(mockConfig)
      vi.mocked(runtimeConfig.fetchRuntimeConfig).mockResolvedValue(mockConfig)

      let callCount = 0
      ;(global.fetch as any).mockImplementation(() => {
        callCount++
        // First call (GoTrue) returns 401, second call (API gateway) succeeds
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 401,
            statusText: 'Unauthorized',
          })
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ version: '1.0.0' }),
        })
      })

      const result = await performConfigHealthCheck()

      expect(result.healthy).toBe(false)
      expect(result.checks.gotrueReachable.healthy).toBe(false)
      expect(result.checks.gotrueReachable.error).toContain('authentication')
      expect(result.checks.gotrueReachable.error).toContain('Kong Gateway')
      expect(result.errors.some((e) => e.includes('Kong Gateway'))).toBe(true)
    })

    it('should handle GoTrue health check without authentication headers', async () => {
      const mockConfig: runtimeConfig.RuntimeConfig = {
        gotrueUrl: 'http://example.com/auth/v1',
        supabaseUrl: 'http://example.com',
        apiUrl: 'http://example.com',
        anonKey: 'test-key',
        source: 'explicit',
        environment: 'production',
        timestamp: Date.now(),
      }

      vi.mocked(runtimeConfig.getRuntimeConfig).mockReturnValue(mockConfig)
      vi.mocked(runtimeConfig.fetchRuntimeConfig).mockResolvedValue(mockConfig)

      // Mock successful GoTrue health response
      ;(global.fetch as any).mockImplementation((url, options) => {
        // Verify that no authentication headers are sent for GoTrue health check
        if (url.includes('/health')) {
          expect(options?.headers?.Authorization).toBeUndefined()
          expect(options?.headers?.apikey).toBeUndefined()
          expect(options?.credentials).toBe('omit')
          
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ 
              version: '2.0.0',
              name: 'GoTrue',
              gotrue_version: '2.0.0',
              build: 'abc123',
              timestamp: Date.now()
            }),
          })
        }
        
        // API gateway call
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ version: '1.0.0' }),
        })
      })

      const result = await performConfigHealthCheck()

      expect(result.healthy).toBe(true)
      expect(result.checks.gotrueReachable.healthy).toBe(true)
      expect(result.checks.gotrueReachable.metadata?.gotrue_version).toBe('2.0.0')
    })

    it('should validate GoTrue health response format', async () => {
      const mockConfig: runtimeConfig.RuntimeConfig = {
        gotrueUrl: 'http://example.com/auth/v1',
        supabaseUrl: 'http://example.com',
        apiUrl: 'http://example.com',
        anonKey: 'test-key',
        source: 'explicit',
        environment: 'production',
        timestamp: Date.now(),
      }

      vi.mocked(runtimeConfig.getRuntimeConfig).mockReturnValue(mockConfig)
      vi.mocked(runtimeConfig.fetchRuntimeConfig).mockResolvedValue(mockConfig)

      let callCount = 0
      ;(global.fetch as any).mockImplementation(() => {
        callCount++
        // First call (GoTrue) returns response without expected fields
        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ unexpected: 'data' }),
          })
        }
        // API gateway call
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ version: '1.0.0' }),
        })
      })

      const result = await performConfigHealthCheck()

      expect(result.healthy).toBe(true)
      expect(result.checks.gotrueReachable.healthy).toBe(true)
      expect(result.checks.gotrueReachable.metadata?.warning).toContain('missing expected service information')
    })

    it('should add warning when API gateway is unreachable', async () => {
      const mockConfig: runtimeConfig.RuntimeConfig = {
        gotrueUrl: 'http://example.com/auth/v1',
        supabaseUrl: 'http://example.com',
        apiUrl: 'http://example.com',
        anonKey: 'test-key',
        source: 'explicit',
        environment: 'production',
        timestamp: Date.now(),
      }

      vi.mocked(runtimeConfig.getRuntimeConfig).mockReturnValue(mockConfig)
      vi.mocked(runtimeConfig.fetchRuntimeConfig).mockResolvedValue(mockConfig)

      let callCount = 0
      ;(global.fetch as any).mockImplementation(() => {
        callCount++
        // First call (GoTrue) succeeds, second call (API gateway) fails
        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ version: '1.0.0' }),
          })
        }
        return Promise.reject(new Error('Connection refused'))
      })

      const result = await performConfigHealthCheck()

      expect(result.checks.gotrueReachable.healthy).toBe(true)
      expect(result.checks.apiGatewayReachable.healthy).toBe(false)
      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.warnings.some((w) => w.includes('API gateway'))).toBe(true)
    })

    it('should add error when using localhost in production', async () => {
      const mockConfig: runtimeConfig.RuntimeConfig = {
        gotrueUrl: 'http://localhost:54321/auth/v1',
        supabaseUrl: 'http://localhost:54321',
        apiUrl: 'http://localhost:8000',
        anonKey: 'test-key',
        source: 'default',
        environment: 'production',
        timestamp: Date.now(),
      }

      vi.mocked(runtimeConfig.getRuntimeConfig).mockReturnValue(mockConfig)
      vi.mocked(runtimeConfig.fetchRuntimeConfig).mockResolvedValue(mockConfig)

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
      })

      const result = await performConfigHealthCheck()

      expect(result.healthy).toBe(false)
      expect(result.errors.some((e) => e.includes('localhost'))).toBe(true)
    })

    it('should add warning when using default configuration', async () => {
      const mockConfig: runtimeConfig.RuntimeConfig = {
        gotrueUrl: 'http://127.0.0.1:54321/auth/v1',
        supabaseUrl: 'http://127.0.0.1:54321',
        apiUrl: 'http://127.0.0.1:8000',
        anonKey: '',
        source: 'default',
        environment: 'development',
        timestamp: Date.now(),
      }

      vi.mocked(runtimeConfig.getRuntimeConfig).mockReturnValue(mockConfig)
      vi.mocked(runtimeConfig.fetchRuntimeConfig).mockResolvedValue(mockConfig)

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
      })

      const result = await performConfigHealthCheck()

      expect(result.warnings.some((w) => w.includes('default configuration'))).toBe(true)
    })

    it('should handle timeout gracefully', async () => {
      const mockConfig: runtimeConfig.RuntimeConfig = {
        gotrueUrl: 'http://example.com/auth/v1',
        supabaseUrl: 'http://example.com',
        apiUrl: 'http://example.com',
        anonKey: 'test-key',
        source: 'explicit',
        environment: 'production',
        timestamp: Date.now(),
      }

      vi.mocked(runtimeConfig.getRuntimeConfig).mockReturnValue(mockConfig)
      vi.mocked(runtimeConfig.fetchRuntimeConfig).mockResolvedValue(mockConfig)

      // Mock timeout by simulating abort error
      ;(global.fetch as any).mockImplementation(() => {
        const error = new Error('The operation was aborted')
        error.name = 'AbortError'
        return Promise.reject(error)
      })

      const result = await performConfigHealthCheck()

      // Should complete within reasonable time and report timeout
      expect(result.checks.gotrueReachable.healthy).toBe(false)
      expect(result.checks.gotrueReachable.error).toContain('timeout')
    })
  })

  describe('quickHealthCheck', () => {
    it('should return true when runtime config is available', async () => {
      const mockConfig: runtimeConfig.RuntimeConfig = {
        gotrueUrl: 'http://example.com/auth/v1',
        supabaseUrl: 'http://example.com',
        apiUrl: 'http://example.com',
        anonKey: 'test-key',
        source: 'explicit',
        environment: 'production',
        timestamp: Date.now(),
      }

      vi.mocked(runtimeConfig.getRuntimeConfig).mockReturnValue(mockConfig)

      const result = await quickHealthCheck()

      expect(result).toBe(true)
    })

    it('should return false when runtime config is unavailable', async () => {
      vi.mocked(runtimeConfig.getRuntimeConfig).mockReturnValue(null)
      vi.mocked(runtimeConfig.fetchRuntimeConfig).mockRejectedValue(
        new Error('Failed to fetch')
      )

      const result = await quickHealthCheck()

      expect(result).toBe(false)
    })
  })

  describe('getHealthCheckErrorMessage', () => {
    it('should return success message for healthy result', () => {
      const result: ConfigHealthResult = {
        healthy: true,
        checks: {
          runtimeConfigAvailable: { healthy: true },
          gotrueReachable: { healthy: true },
          apiGatewayReachable: { healthy: true },
        },
        errors: [],
        warnings: [],
        timestamp: Date.now(),
      }

      const message = getHealthCheckErrorMessage(result)

      expect(message).toContain('operational')
    })

    it('should include errors and troubleshooting steps for unhealthy result', () => {
      const result: ConfigHealthResult = {
        healthy: false,
        checks: {
          runtimeConfigAvailable: { healthy: false, error: 'Config unavailable' },
          gotrueReachable: { healthy: false, error: 'GoTrue unreachable' },
          apiGatewayReachable: { healthy: true },
        },
        errors: ['Config unavailable', 'GoTrue unreachable'],
        warnings: [],
        timestamp: Date.now(),
      }

      const message = getHealthCheckErrorMessage(result)

      expect(message).toContain('Critical issues')
      expect(message).toContain('Config unavailable')
      expect(message).toContain('GoTrue unreachable')
      expect(message).toContain('Troubleshooting')
    })

    it('should provide specific troubleshooting for GoTrue 401 errors', () => {
      const result: ConfigHealthResult = {
        healthy: false,
        checks: {
          runtimeConfigAvailable: { healthy: true },
          gotrueReachable: { healthy: false, error: 'GoTrue health endpoint requires authentication (401)' },
          apiGatewayReachable: { healthy: true },
        },
        errors: ['GoTrue health endpoint requires authentication (401)'],
        warnings: [],
        timestamp: Date.now(),
      }

      const message = getHealthCheckErrorMessage(result)

      expect(message).toContain('Kong Gateway configuration')
      expect(message).toContain('key-auth plugin')
      expect(message).toContain('kong.yml')
    })

    it('should provide specific troubleshooting for GoTrue timeout errors', () => {
      const result: ConfigHealthResult = {
        healthy: false,
        checks: {
          runtimeConfigAvailable: { healthy: true },
          gotrueReachable: { healthy: false, error: 'GoTrue health check timeout after 5000ms' },
          apiGatewayReachable: { healthy: true },
        },
        errors: ['GoTrue health check timeout after 5000ms'],
        warnings: [],
        timestamp: Date.now(),
      }

      const message = getHealthCheckErrorMessage(result)

      expect(message).toContain('GoTrue service performance')
      expect(message).toContain('network connectivity')
      expect(message).toContain('timeout')
    })

    it('should include warnings when present', () => {
      const result: ConfigHealthResult = {
        healthy: false,
        checks: {
          runtimeConfigAvailable: { healthy: true },
          gotrueReachable: { healthy: false, error: 'GoTrue unreachable' },
          apiGatewayReachable: { healthy: true },
        },
        errors: ['GoTrue unreachable'],
        warnings: ['Using default configuration'],
        timestamp: Date.now(),
      }

      const message = getHealthCheckErrorMessage(result)

      expect(message).toContain('Warnings')
      expect(message).toContain('Using default configuration')
    })
  })

  describe('formatHealthCheckResult', () => {
    it('should format healthy result correctly', () => {
      const mockConfig: runtimeConfig.RuntimeConfig = {
        gotrueUrl: 'http://example.com/auth/v1',
        supabaseUrl: 'http://example.com',
        apiUrl: 'http://example.com',
        anonKey: 'test-key',
        source: 'explicit',
        environment: 'production',
        timestamp: Date.now(),
      }

      const result: ConfigHealthResult = {
        healthy: true,
        checks: {
          runtimeConfigAvailable: { healthy: true, responseTime: 50 },
          gotrueReachable: { healthy: true, responseTime: 100 },
          apiGatewayReachable: { healthy: true, responseTime: 75 },
        },
        errors: [],
        warnings: [],
        timestamp: Date.now(),
        config: mockConfig,
      }

      const formatted = formatHealthCheckResult(result)

      expect(formatted).toContain('HEALTHY')
      expect(formatted).toContain('Runtime Config: ✅')
      expect(formatted).toContain('GoTrue Service: ✅')
      expect(formatted).toContain('API Gateway:')
      expect(formatted).toContain('✅')
      expect(formatted).toContain('production')
      expect(formatted).toContain('explicit')
    })

    it('should format unhealthy result with errors', () => {
      const result: ConfigHealthResult = {
        healthy: false,
        checks: {
          runtimeConfigAvailable: { healthy: false, error: 'Config error' },
          gotrueReachable: { healthy: false, error: 'GoTrue error' },
          apiGatewayReachable: { healthy: true },
        },
        errors: ['Config error', 'GoTrue error'],
        warnings: ['Warning message'],
        timestamp: Date.now(),
      }

      const formatted = formatHealthCheckResult(result)

      expect(formatted).toContain('UNHEALTHY')
      expect(formatted).toContain('Runtime Config: ❌')
      expect(formatted).toContain('GoTrue Service: ❌')
      expect(formatted).toContain('Errors:')
      expect(formatted).toContain('Config error')
      expect(formatted).toContain('GoTrue error')
      expect(formatted).toContain('Warnings:')
      expect(formatted).toContain('Warning message')
    })
  })
})
