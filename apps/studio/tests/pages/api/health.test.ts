/**
 * Unit Tests for Health Check API Endpoint
 * 
 * These tests verify the health check API endpoint functionality including:
 * - Successful health check responses
 * - Error handling and status codes
 * - Response format validation
 * - Method validation
 * 
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createMocks } from 'node-mocks-http'
import handler from '../../../pages/api/health'
import * as configHealth from '../../../lib/config-health'

describe('/api/health', () => {
  beforeEach(() => {
    // Mock the config health module
    vi.spyOn(configHealth, 'performConfigHealthCheck')
    vi.spyOn(configHealth, 'formatHealthCheckResult')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('GET /api/health', () => {
    it('should return 200 and healthy status when all checks pass', async () => {
      const mockHealthResult: configHealth.ConfigHealthResult = {
        healthy: true,
        checks: {
          runtimeConfigAvailable: { 
            healthy: true, 
            responseTime: 50 
          },
          gotrueReachable: { 
            healthy: true, 
            url: 'http://example.com/auth/v1/health',
            responseTime: 100 
          },
          apiGatewayReachable: { 
            healthy: true, 
            url: 'http://example.com/health',
            responseTime: 75 
          },
        },
        errors: [],
        warnings: [],
        timestamp: Date.now(),
        config: {
          gotrueUrl: 'http://example.com/auth/v1',
          supabaseUrl: 'http://example.com',
          apiUrl: 'http://example.com',
          anonKey: 'test-key',
          source: 'explicit',
          environment: 'production',
          timestamp: Date.now(),
        },
      }

      vi.mocked(configHealth.performConfigHealthCheck).mockResolvedValue(mockHealthResult)
      vi.mocked(configHealth.formatHealthCheckResult).mockReturnValue('Health check passed')

      const { req, res } = createMocks({
        method: 'GET',
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(200)
      
      const data = JSON.parse(res._getData())
      expect(data.healthy).toBe(true)
      expect(data.checks.runtimeConfig.healthy).toBe(true)
      expect(data.checks.gotrue.healthy).toBe(true)
      expect(data.checks.apiGateway.healthy).toBe(true)
      expect(data.config).toBeDefined()
      expect(data.config.environment).toBe('production')
      expect(data.config.source).toBe('explicit')
      // Ensure anonKey is not exposed
      expect(data.config.anonKey).toBeUndefined()
    })

    it('should return 503 and unhealthy status when checks fail', async () => {
      const mockHealthResult: configHealth.ConfigHealthResult = {
        healthy: false,
        checks: {
          runtimeConfigAvailable: { 
            healthy: true, 
            responseTime: 50 
          },
          gotrueReachable: { 
            healthy: false, 
            url: 'http://example.com/auth/v1/health',
            error: 'Connection refused',
            responseTime: 5000 
          },
          apiGatewayReachable: { 
            healthy: false, 
            url: 'http://example.com/health',
            error: 'Timeout',
            responseTime: 5000 
          },
        },
        errors: ['GoTrue service is not reachable: Connection refused'],
        warnings: ['API gateway health check failed: Timeout'],
        timestamp: Date.now(),
        config: {
          gotrueUrl: 'http://example.com/auth/v1',
          supabaseUrl: 'http://example.com',
          apiUrl: 'http://example.com',
          anonKey: 'test-key',
          source: 'explicit',
          environment: 'production',
          timestamp: Date.now(),
        },
      }

      vi.mocked(configHealth.performConfigHealthCheck).mockResolvedValue(mockHealthResult)
      vi.mocked(configHealth.formatHealthCheckResult).mockReturnValue('Health check failed')

      const { req, res } = createMocks({
        method: 'GET',
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(503)
      
      const data = JSON.parse(res._getData())
      expect(data.healthy).toBe(false)
      expect(data.checks.runtimeConfig.healthy).toBe(true)
      expect(data.checks.gotrue.healthy).toBe(false)
      expect(data.checks.apiGateway.healthy).toBe(false)
      expect(data.errors).toHaveLength(1)
      expect(data.warnings).toHaveLength(1)
    })

    it('should return 500 when health check throws exception', async () => {
      vi.mocked(configHealth.performConfigHealthCheck).mockRejectedValue(
        new Error('Health check system failure')
      )

      const { req, res } = createMocks({
        method: 'GET',
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(500)
      
      const data = JSON.parse(res._getData())
      expect(data.healthy).toBe(false)
      expect(data.error).toBe('Health check failed')
      expect(data.message).toBe('Health check system failure')
      expect(data.checks.runtimeConfig.healthy).toBe(false)
      expect(data.checks.gotrue.healthy).toBe(false)
      expect(data.checks.apiGateway.healthy).toBe(false)
    })

    it('should handle missing config gracefully', async () => {
      const mockHealthResult: configHealth.ConfigHealthResult = {
        healthy: false,
        checks: {
          runtimeConfigAvailable: { 
            healthy: false, 
            error: 'Runtime configuration not available' 
          },
          gotrueReachable: { 
            healthy: false, 
            error: 'Skipped due to missing runtime configuration' 
          },
          apiGatewayReachable: { 
            healthy: false, 
            error: 'Skipped due to missing runtime configuration' 
          },
        },
        errors: ['Runtime configuration not available'],
        warnings: [],
        timestamp: Date.now(),
        // No config available
      }

      vi.mocked(configHealth.performConfigHealthCheck).mockResolvedValue(mockHealthResult)
      vi.mocked(configHealth.formatHealthCheckResult).mockReturnValue('No config available')

      const { req, res } = createMocks({
        method: 'GET',
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(503)
      
      const data = JSON.parse(res._getData())
      expect(data.healthy).toBe(false)
      expect(data.config).toBeNull()
      expect(data.errors).toHaveLength(1)
    })
  })

  describe('Method validation', () => {
    it('should return 405 for POST method', async () => {
      const { req, res } = createMocks({
        method: 'POST',
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(405)
      expect(res._getHeaders()['allow']).toEqual(['GET'])
      
      const data = JSON.parse(res._getData())
      expect(data.error).toBe('Method Not Allowed')
      expect(data.message).toContain('Method POST not allowed')
    })

    it('should return 405 for PUT method', async () => {
      const { req, res } = createMocks({
        method: 'PUT',
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(405)
      expect(res._getHeaders()['allow']).toEqual(['GET'])
    })

    it('should return 405 for DELETE method', async () => {
      const { req, res } = createMocks({
        method: 'DELETE',
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(405)
      expect(res._getHeaders()['allow']).toEqual(['GET'])
    })
  })
})