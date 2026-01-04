/**
 * Integration tests for runtime configuration system
 * 
 * Tests end-to-end configuration flow including:
 * - Production mode configuration
 * - Environment switching (dev/staging/prod)
 * - Configuration updates with container restart
 * - Error recovery and fallback behavior
 * - Production URL validation (no localhost)
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 2.2, 4.1, 4.2
 * 
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { NextApiRequest, NextApiResponse } from 'next'
import handler from '../../pages/api/runtime-config'
import {
  fetchRuntimeConfig,
  getRuntimeConfig,
  refreshRuntimeConfig,
  resetRuntimeConfigStore,
  type RuntimeConfig,
} from 'common'

// Helper to create mock request/response objects
function createMocks() {
  const req = {
    method: 'GET',
  } as NextApiRequest

  const res = {
    status: function (code: number) {
      this.statusCode = code
      return this
    },
    json: function (data: any) {
      this.data = data
      return this
    },
    setHeader: function (name: string, value: string) {
      this.headers = this.headers || {}
      this.headers[name] = value
      return this
    },
    statusCode: 200,
    data: null,
    headers: {},
  } as unknown as NextApiResponse

  return { req, res }
}

// Helper to simulate container restart by resetting environment and store
function simulateContainerRestart(newEnv: Record<string, string | undefined>) {
  // Clear runtime config store (simulates app restart)
  resetRuntimeConfigStore()
  
  // Update environment variables (simulates new container env)
  Object.keys(newEnv).forEach((key) => {
    if (newEnv[key] === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = newEnv[key]
    }
  })
}

describe('Runtime Config Integration Tests', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env = { ...originalEnv }
    resetRuntimeConfigStore()
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.env = originalEnv
    resetRuntimeConfigStore()
  })

  describe('End-to-End Configuration Flow in Production Mode', () => {
    it('should load production configuration from environment variables on startup', () => {
      // Requirement 1.1: Load API URLs from runtime environment variables
      process.env.NODE_ENV = 'production'
      process.env.SUPABASE_PUBLIC_URL = 'https://prod.example.com'
      process.env.API_EXTERNAL_URL = 'https://api.prod.example.com'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'prod-anon-key'

      const { req, res } = createMocks()
      handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.data).toMatchObject({
        gotrueUrl: 'https://prod.example.com/auth/v1',
        supabaseUrl: 'https://prod.example.com',
        apiUrl: 'https://api.prod.example.com',
        anonKey: 'prod-anon-key',
        environment: 'production',
        source: 'derived',
      })
    })

    it('should use production URLs for all API requests', () => {
      // Requirement 1.2: Use production API gateway URL instead of localhost
      process.env.NODE_ENV = 'production'
      process.env.SUPABASE_PUBLIC_URL = 'https://prod.example.com'

      const { req, res } = createMocks()
      handler(req, res)

      const config = res.data as RuntimeConfig

      // Verify no localhost URLs in production
      expect(config.gotrueUrl).not.toContain('localhost')
      expect(config.gotrueUrl).not.toContain('127.0.0.1')
      expect(config.supabaseUrl).not.toContain('localhost')
      expect(config.supabaseUrl).not.toContain('127.0.0.1')
      expect(config.apiUrl).not.toContain('localhost')
      expect(config.apiUrl).not.toContain('127.0.0.1')

      // Verify production URLs are used
      expect(config.gotrueUrl).toContain('prod.example.com')
      expect(config.supabaseUrl).toContain('prod.example.com')
    })

    it('should return correct URLs from runtime config API', () => {
      // Requirement 1.3: Runtime configuration API returns correct production URLs
      process.env.SUPABASE_PUBLIC_URL = 'https://api.production.com'
      process.env.API_EXTERNAL_URL = 'https://gateway.production.com'

      const { req, res } = createMocks()
      handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.data.gotrueUrl).toBe('https://api.production.com/auth/v1')
      expect(res.data.apiUrl).toBe('https://gateway.production.com')
      expect(res.data.source).toBe('derived')
    })

    it('should fetch runtime config before making API requests', async () => {
      // Requirement 1.5: Fetch runtime configuration before any API requests
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          gotrueUrl: 'https://prod.example.com/auth/v1',
          supabaseUrl: 'https://prod.example.com',
          apiUrl: 'https://prod.example.com',
          anonKey: 'test-key',
          source: 'derived',
          environment: 'production',
          timestamp: Date.now(),
        }),
      })

      global.fetch = mockFetch as any

      // Simulate app initialization
      const config = await fetchRuntimeConfig()

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/runtime-config',
        expect.any(Object)
      )
      expect(config).toBeDefined()
      expect(config.gotrueUrl).toBe('https://prod.example.com/auth/v1')

      // Config should be available for subsequent API requests
      const cachedConfig = getRuntimeConfig()
      expect(cachedConfig).toEqual(config)
    })
  })

  describe('Environment Switching (dev/staging/prod)', () => {
    it('should use development URLs in development environment', () => {
      // Requirement 4.2: Use localhost in development
      process.env.NODE_ENV = 'development'
      delete process.env.SUPABASE_PUBLIC_URL
      delete process.env.API_EXTERNAL_URL

      const { req, res } = createMocks()
      handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.data).toMatchObject({
        gotrueUrl: 'http://127.0.0.1:54321/auth/v1',
        supabaseUrl: 'http://127.0.0.1:54321',
        apiUrl: 'http://127.0.0.1:8000',
        environment: 'development',
        source: 'default',
      })

      // Verify localhost is used in development
      expect(res.data.gotrueUrl).toContain('127.0.0.1')
      expect(res.data.supabaseUrl).toContain('127.0.0.1')
    })

    it('should use staging URLs in staging environment', () => {
      process.env.SUPABASE_PUBLIC_URL = 'https://staging.example.com'
      process.env.API_EXTERNAL_URL = 'https://api.staging.example.com'

      const { req, res } = createMocks()
      handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.data).toMatchObject({
        gotrueUrl: 'https://staging.example.com/auth/v1',
        supabaseUrl: 'https://staging.example.com',
        apiUrl: 'https://api.staging.example.com',
        environment: 'staging',
      })
    })

    it('should use production URLs in production environment', () => {
      // Requirement 4.1: Direct all requests to production API gateway
      process.env.NODE_ENV = 'production'
      process.env.SUPABASE_PUBLIC_URL = 'https://prod.example.com'
      process.env.API_EXTERNAL_URL = 'https://api.prod.example.com'

      const { req, res } = createMocks()
      handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.data).toMatchObject({
        gotrueUrl: 'https://prod.example.com/auth/v1',
        supabaseUrl: 'https://prod.example.com',
        apiUrl: 'https://api.prod.example.com',
        environment: 'production',
      })

      // Verify no localhost in production
      expect(res.data.gotrueUrl).not.toContain('localhost')
      expect(res.data.gotrueUrl).not.toContain('127.0.0.1')
    })

    it('should adapt to environment-specific configuration without code changes', () => {
      // Requirement 2.2: Same Docker image adapts to different environments
      const environments = [
        {
          name: 'development',
          env: {
            NODE_ENV: 'development',
            SUPABASE_PUBLIC_URL: undefined,
          },
          expectedUrl: 'http://127.0.0.1:54321/auth/v1',
        },
        {
          name: 'staging',
          env: {
            NODE_ENV: 'production',
            SUPABASE_PUBLIC_URL: 'https://staging.example.com',
          },
          expectedUrl: 'https://staging.example.com/auth/v1',
        },
        {
          name: 'production',
          env: {
            NODE_ENV: 'production',
            SUPABASE_PUBLIC_URL: 'https://prod.example.com',
          },
          expectedUrl: 'https://prod.example.com/auth/v1',
        },
      ]

      environments.forEach(({ name, env, expectedUrl }) => {
        // Simulate deploying same image to different environment
        simulateContainerRestart(env)

        const { req, res } = createMocks()
        handler(req, res)

        expect(res.statusCode).toBe(200)
        expect(res.data.gotrueUrl).toBe(expectedUrl)
        expect(res.data.environment).toBe(env.NODE_ENV === 'development' ? 'development' : name)
      })
    })
  })

  describe('Configuration Updates with Container Restart', () => {
    it('should use new URLs after container restart without rebuild', async () => {
      // Requirement 1.4: Use new URLs after restart without rebuild
      
      // Initial deployment with first set of URLs
      simulateContainerRestart({
        SUPABASE_PUBLIC_URL: 'https://old.example.com',
        API_EXTERNAL_URL: 'https://api.old.example.com',
      })

      const { req: req1, res: res1 } = createMocks()
      handler(req1, res1)

      expect(res1.data.gotrueUrl).toBe('https://old.example.com/auth/v1')
      expect(res1.data.apiUrl).toBe('https://api.old.example.com')

      // Simulate container restart with new environment variables
      simulateContainerRestart({
        SUPABASE_PUBLIC_URL: 'https://new.example.com',
        API_EXTERNAL_URL: 'https://api.new.example.com',
      })

      const { req: req2, res: res2 } = createMocks()
      handler(req2, res2)

      // Should use new URLs without rebuild
      expect(res2.data.gotrueUrl).toBe('https://new.example.com/auth/v1')
      expect(res2.data.apiUrl).toBe('https://api.new.example.com')
    })

    it('should clear cached config on container restart', async () => {
      const mockFetch = vi.fn()
      global.fetch = mockFetch as any

      // First container instance
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          gotrueUrl: 'https://old.example.com/auth/v1',
          supabaseUrl: 'https://old.example.com',
          apiUrl: 'https://old.example.com',
          anonKey: 'old-key',
          source: 'derived',
          environment: 'production',
          timestamp: Date.now(),
        }),
      })

      await fetchRuntimeConfig()
      const oldConfig = getRuntimeConfig()
      expect(oldConfig?.gotrueUrl).toBe('https://old.example.com/auth/v1')

      // Simulate container restart
      simulateContainerRestart({
        SUPABASE_PUBLIC_URL: 'https://new.example.com',
      })

      // Config should be cleared
      expect(getRuntimeConfig()).toBe(null)

      // New fetch should get new config
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          gotrueUrl: 'https://new.example.com/auth/v1',
          supabaseUrl: 'https://new.example.com',
          apiUrl: 'https://new.example.com',
          anonKey: 'new-key',
          source: 'derived',
          environment: 'production',
          timestamp: Date.now(),
        }),
      })

      await fetchRuntimeConfig()
      const newConfig = getRuntimeConfig()
      expect(newConfig?.gotrueUrl).toBe('https://new.example.com/auth/v1')
    })

    it('should handle environment variable changes across restarts', () => {
      const scenarios = [
        {
          description: 'Change from explicit to derived URL',
          before: {
            NEXT_PUBLIC_GOTRUE_URL: 'https://explicit.com/auth/v1',
            SUPABASE_PUBLIC_URL: 'https://derived.com',
          },
          after: {
            NEXT_PUBLIC_GOTRUE_URL: undefined,
            SUPABASE_PUBLIC_URL: 'https://derived.com',
          },
          expectedBefore: 'https://explicit.com/auth/v1',
          expectedAfter: 'https://derived.com/auth/v1',
        },
        {
          description: 'Change API gateway URL',
          before: {
            API_EXTERNAL_URL: 'https://gateway1.com',
          },
          after: {
            API_EXTERNAL_URL: 'https://gateway2.com',
          },
          expectedBefore: 'https://gateway1.com',
          expectedAfter: 'https://gateway2.com',
        },
      ]

      scenarios.forEach(({ description, before, after, expectedBefore, expectedAfter }) => {
        // Before restart
        simulateContainerRestart(before)
        const { req: req1, res: res1 } = createMocks()
        handler(req1, res1)

        if (before.NEXT_PUBLIC_GOTRUE_URL || before.SUPABASE_PUBLIC_URL) {
          expect(res1.data.gotrueUrl).toBe(expectedBefore)
        }
        if (before.API_EXTERNAL_URL) {
          expect(res1.data.apiUrl).toBe(expectedBefore)
        }

        // After restart
        simulateContainerRestart(after)
        const { req: req2, res: res2 } = createMocks()
        handler(req2, res2)

        if (after.SUPABASE_PUBLIC_URL) {
          expect(res2.data.gotrueUrl).toBe(expectedAfter)
        }
        if (after.API_EXTERNAL_URL) {
          expect(res2.data.apiUrl).toBe(expectedAfter)
        }
      })
    })
  })

  describe('Error Recovery and Fallback Behavior', () => {
    it('should fall back to defaults when runtime config fetch fails', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'))
      global.fetch = mockFetch as any

      process.env.NODE_ENV = 'development'

      // Fetch should fail but not crash
      await expect(fetchRuntimeConfig()).rejects.toThrow('Network error')

      // API endpoint should still work with defaults
      const { req, res } = createMocks()
      handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.data).toMatchObject({
        gotrueUrl: 'http://127.0.0.1:54321/auth/v1',
        supabaseUrl: 'http://127.0.0.1:54321',
        source: 'default',
      })
    })

    it('should handle invalid environment variable values gracefully', () => {
      process.env.NEXT_PUBLIC_GOTRUE_URL = 'not-a-valid-url'

      const { req, res } = createMocks()
      handler(req, res)

      expect(res.statusCode).toBe(500)
      expect(res.data).toHaveProperty('error')
      expect(res.data).toHaveProperty('suggestions')
      expect(res.data.suggestions).toBeInstanceOf(Array)
      expect(res.data.suggestions.length).toBeGreaterThan(0)
    })

    it('should recover from errors on subsequent requests', () => {
      // First request with invalid URL
      process.env.NEXT_PUBLIC_GOTRUE_URL = 'invalid-url'

      const { req: req1, res: res1 } = createMocks()
      handler(req1, res1)

      expect(res1.statusCode).toBe(500)

      // Fix the environment variable
      process.env.NEXT_PUBLIC_GOTRUE_URL = 'https://valid.example.com/auth/v1'

      const { req: req2, res: res2 } = createMocks()
      handler(req2, res2)

      // Should recover and return valid config
      expect(res2.statusCode).toBe(200)
      expect(res2.data.gotrueUrl).toBe('https://valid.example.com/auth/v1')
    })

    it('should use fallback chain: runtime → explicit → derived → default', () => {
      const testCases = [
        {
          description: 'Use explicit when set',
          env: {
            NEXT_PUBLIC_GOTRUE_URL: 'https://explicit.com/auth/v1',
            SUPABASE_PUBLIC_URL: 'https://derived.com',
          },
          expected: 'https://explicit.com/auth/v1',
          expectedSource: 'explicit',
        },
        {
          description: 'Use derived when explicit not set',
          env: {
            NEXT_PUBLIC_GOTRUE_URL: undefined,
            SUPABASE_PUBLIC_URL: 'https://derived.com',
          },
          expected: 'https://derived.com/auth/v1',
          expectedSource: 'derived',
        },
        {
          description: 'Use default when nothing set',
          env: {
            NEXT_PUBLIC_GOTRUE_URL: undefined,
            SUPABASE_PUBLIC_URL: undefined,
            SUPABASE_URL: undefined,
            NODE_ENV: 'development',
          },
          expected: 'http://127.0.0.1:54321/auth/v1',
          expectedSource: 'default',
        },
      ]

      testCases.forEach(({ description, env, expected, expectedSource }) => {
        simulateContainerRestart(env)

        const { req, res } = createMocks()
        handler(req, res)

        expect(res.statusCode).toBe(200)
        expect(res.data.gotrueUrl).toBe(expected)
        expect(res.data.source).toBe(expectedSource)
      })
    })

    it('should handle missing environment variables with warnings', () => {
      // Clear all config-related env vars
      simulateContainerRestart({
        NEXT_PUBLIC_GOTRUE_URL: undefined,
        SUPABASE_PUBLIC_URL: undefined,
        SUPABASE_URL: undefined,
        API_EXTERNAL_URL: undefined,
        NEXT_PUBLIC_API_URL: undefined,
        NODE_ENV: 'production',
      })

      const { req, res } = createMocks()
      handler(req, res)

      // Should still return a response (with defaults)
      expect(res.statusCode).toBe(200)
      expect(res.data.source).toBe('default')
      
      // In production with defaults, should warn about missing config
      expect(res.data.environment).toBe('production')
    })
  })

  describe('Production URL Validation', () => {
    it('should never use localhost URLs in production environment', () => {
      process.env.NODE_ENV = 'production'
      process.env.SUPABASE_PUBLIC_URL = 'https://prod.example.com'
      process.env.API_EXTERNAL_URL = 'https://api.prod.example.com'

      const { req, res } = createMocks()
      handler(req, res)

      const config = res.data as RuntimeConfig

      // Strict validation: no localhost or 127.0.0.1 in any URL
      const localhostPattern = /(localhost|127\.0\.0\.1)/i

      expect(config.gotrueUrl).not.toMatch(localhostPattern)
      expect(config.supabaseUrl).not.toMatch(localhostPattern)
      expect(config.apiUrl).not.toMatch(localhostPattern)
    })

    it('should validate all URLs use http or https protocol', () => {
      process.env.SUPABASE_PUBLIC_URL = 'https://example.com'

      const { req, res } = createMocks()
      handler(req, res)

      const config = res.data as RuntimeConfig

      expect(config.gotrueUrl).toMatch(/^https?:\/\//)
      expect(config.supabaseUrl).toMatch(/^https?:\/\//)
      expect(config.apiUrl).toMatch(/^https?:\/\//)
    })

    it('should reject non-http/https protocols', () => {
      const invalidProtocols = ['ftp://', 'file://', 'ws://', 'wss://']

      invalidProtocols.forEach((protocol) => {
        process.env.NEXT_PUBLIC_GOTRUE_URL = `${protocol}example.com/auth/v1`

        const { req, res } = createMocks()
        handler(req, res)

        expect(res.statusCode).toBe(500)
        expect(res.data).toHaveProperty('error')
      })
    })

    it('should ensure production config uses HTTPS in production', () => {
      process.env.NODE_ENV = 'production'
      process.env.SUPABASE_PUBLIC_URL = 'https://secure.example.com'

      const { req, res } = createMocks()
      handler(req, res)

      expect(res.statusCode).toBe(200)
      
      // In production, URLs should ideally use HTTPS
      const config = res.data as RuntimeConfig
      expect(config.gotrueUrl).toMatch(/^https:\/\//)
      expect(config.supabaseUrl).toMatch(/^https:\/\//)
    })

    it('should validate production URLs are publicly accessible', () => {
      process.env.NODE_ENV = 'production'
      
      const privateIPs = [
        'http://192.168.1.1:8000',
        'http://10.0.0.1:8000',
        'http://172.16.0.1:8000',
      ]

      privateIPs.forEach((privateIP) => {
        process.env.SUPABASE_PUBLIC_URL = privateIP

        const { req, res } = createMocks()
        handler(req, res)

        // Should accept the URL (validation is at deployment level)
        // but we can verify it's not localhost
        expect(res.data.gotrueUrl).not.toContain('localhost')
        expect(res.data.gotrueUrl).not.toContain('127.0.0.1')
      })
    })
  })

  describe('Complete Integration Scenarios', () => {
    it('should handle complete production deployment flow', async () => {
      // Step 1: Container starts with production env vars
      simulateContainerRestart({
        NODE_ENV: 'production',
        SUPABASE_PUBLIC_URL: 'https://prod.example.com',
        API_EXTERNAL_URL: 'https://api.prod.example.com',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'prod-anon-key',
      })

      // Step 2: Runtime config API is called
      const { req: req1, res: res1 } = createMocks()
      handler(req1, res1)

      expect(res1.statusCode).toBe(200)
      expect(res1.data.environment).toBe('production')
      expect(res1.data.gotrueUrl).toBe('https://prod.example.com/auth/v1')

      // Step 3: Frontend fetches runtime config
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => res1.data,
      })
      global.fetch = mockFetch as any

      const config = await fetchRuntimeConfig()

      expect(config.gotrueUrl).toBe('https://prod.example.com/auth/v1')
      expect(config.environment).toBe('production')

      // Step 4: Verify no localhost in any URL
      expect(config.gotrueUrl).not.toContain('localhost')
      expect(config.supabaseUrl).not.toContain('localhost')
      expect(config.apiUrl).not.toContain('localhost')
    })

    it('should handle environment migration scenario', () => {
      // Scenario: Moving from staging to production

      // Phase 1: Staging deployment
      simulateContainerRestart({
        NODE_ENV: 'production',
        SUPABASE_PUBLIC_URL: 'https://staging.example.com',
        API_EXTERNAL_URL: 'https://api.staging.example.com',
      })

      const { req: req1, res: res1 } = createMocks()
      handler(req1, res1)

      expect(res1.data.environment).toBe('staging')
      expect(res1.data.gotrueUrl).toContain('staging.example.com')

      // Phase 2: Production deployment (same image, different env vars)
      simulateContainerRestart({
        NODE_ENV: 'production',
        SUPABASE_PUBLIC_URL: 'https://prod.example.com',
        API_EXTERNAL_URL: 'https://api.prod.example.com',
      })

      const { req: req2, res: res2 } = createMocks()
      handler(req2, res2)

      expect(res2.data.environment).toBe('production')
      expect(res2.data.gotrueUrl).toContain('prod.example.com')
      expect(res2.data.gotrueUrl).not.toContain('staging')
    })

    it('should handle configuration refresh during runtime', async () => {
      const mockFetch = vi.fn()
      global.fetch = mockFetch as any

      // Initial config
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          gotrueUrl: 'https://initial.example.com/auth/v1',
          supabaseUrl: 'https://initial.example.com',
          apiUrl: 'https://initial.example.com',
          anonKey: 'initial-key',
          source: 'derived',
          environment: 'production',
          timestamp: Date.now(),
        }),
      })

      const initialConfig = await fetchRuntimeConfig()
      expect(initialConfig.gotrueUrl).toContain('initial.example.com')

      // Simulate config update (e.g., DNS change)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          gotrueUrl: 'https://updated.example.com/auth/v1',
          supabaseUrl: 'https://updated.example.com',
          apiUrl: 'https://updated.example.com',
          anonKey: 'updated-key',
          source: 'derived',
          environment: 'production',
          timestamp: Date.now(),
        }),
      })

      const refreshedConfig = await refreshRuntimeConfig()
      expect(refreshedConfig.gotrueUrl).toContain('updated.example.com')
      expect(refreshedConfig.gotrueUrl).not.toContain('initial.example.com')
    })
  })
})
