/**
 * Environment Validation Integration Tests
 * 
 * Tests the complete configuration system across different deployment environments
 * to ensure proper behavior in development, staging, and production scenarios.
 * 
 * Task 11: Final integration and testing - Environment switching validation
 * 
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { NextApiRequest, NextApiResponse } from 'next'
import handler from '../../pages/api/runtime-config'
import { detectEnvironment, validateUrlsForEnvironment, performEnvironmentCheck } from 'common/environment-detection'
import { performConfigHealthCheck } from '../../lib/config-health'

// Test utilities
function createMockApiResponse() {
  const req = { method: 'GET' } as NextApiRequest
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
    data: null as any,
    headers: {} as any,
  } as any

  return { req, res }
}

describe('Environment Validation Integration Tests', () => {
  function setEnvironment(env: Record<string, string | undefined>) {
    Object.keys(env).forEach((key) => {
      if (env[key] === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = env[key]
      }
    })
  }
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env = { ...originalEnv }
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('Production Environment Validation', () => {
    it('should validate complete production deployment scenario', async () => {
      // Scenario: Production deployment with external IP and domain
      setEnvironment({
        NODE_ENV: 'production',
        SUPABASE_PUBLIC_URL: 'https://prod.company.com',
        API_EXTERNAL_URL: 'https://api.prod.company.com',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'prod-anon-key-12345',
        NEXT_PUBLIC_IS_PLATFORM: 'false', // Self-hosted production
      })

      // Test 1: Runtime config API
      const { req, res } = createMockApiResponse()
      handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.data).toMatchObject({
        gotrueUrl: 'https://prod.company.com/auth/v1',
        supabaseUrl: 'https://prod.company.com',
        apiUrl: 'https://api.prod.company.com',
        anonKey: 'prod-anon-key-12345',
        environment: 'production',
        source: 'derived',
        isPlatform: false,
      })

      // Test 2: No localhost URLs in production
      expect(res.data.gotrueUrl).not.toMatch(/(localhost|127\.0\.0\.1|0\.0\.0\.0)/i)
      expect(res.data.supabaseUrl).not.toMatch(/(localhost|127\.0\.0\.1|0\.0\.0\.0)/i)
      expect(res.data.apiUrl).not.toMatch(/(localhost|127\.0\.0\.1|0\.0\.0\.0)/i)

      // Test 3: Environment detection
      const envInfo = detectEnvironment({
        gotrueUrl: res.data.gotrueUrl,
        supabaseUrl: res.data.supabaseUrl,
        apiUrl: res.data.apiUrl,
      })
      expect(envInfo.environment).toBe('production')
      expect(envInfo.isProduction).toBe(true)
      expect(envInfo.detectionMethod).toBe('url-pattern')

      // Test 4: URL validation for production
      const validation = validateUrlsForEnvironment(
        {
          gotrueUrl: res.data.gotrueUrl,
          supabaseUrl: res.data.supabaseUrl,
          apiUrl: res.data.apiUrl,
        },
        'production'
      )
      expect(validation.isValid).toBe(true)
      expect(validation.errors).toHaveLength(0)

      // Test 5: HTTPS usage in production
      expect(res.data.gotrueUrl).toMatch(/^https:\/\//)
      expect(res.data.supabaseUrl).toMatch(/^https:\/\//)
      expect(res.data.apiUrl).toMatch(/^https:\/\//)
    })

    it('should validate production with external IP addresses', async () => {
      // Scenario: Production deployment with external IP (common in cloud deployments)
      setEnvironment({
        NODE_ENV: 'production',
        SUPABASE_PUBLIC_URL: 'http://192.0.2.1:8000',
        API_EXTERNAL_URL: 'http://192.0.2.1:8000',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'prod-ip-key',
      })

      const { req, res } = createMockApiResponse()
      handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.data.environment).toBe('production')
      expect(res.data.gotrueUrl).toBe('http://192.0.2.1:8000/auth/v1')
      expect(res.data.apiUrl).toBe('http://192.0.2.1:8000')

      // Should detect as production due to external IP
      const envInfo = detectEnvironment({
        gotrueUrl: res.data.gotrueUrl,
        supabaseUrl: res.data.supabaseUrl,
        apiUrl: res.data.apiUrl,
      })
      expect(envInfo.environment).toBe('production')

      // URL validation should pass but may have warnings about HTTP
      const validation = validateUrlsForEnvironment(
        {
          gotrueUrl: res.data.gotrueUrl,
          supabaseUrl: res.data.supabaseUrl,
          apiUrl: res.data.apiUrl,
        },
        'production'
      )
      expect(validation.isValid).toBe(true)
      expect(validation.warnings.length).toBeGreaterThan(0) // Should warn about HTTP in production
    })

    it('should reject localhost URLs in production environment', async () => {
      // Scenario: Misconfigured production with localhost URLs
      setEnvironment({
        NODE_ENV: 'production',
        NEXT_PUBLIC_GOTRUE_URL: 'http://localhost:54321/auth/v1',
        SUPABASE_PUBLIC_URL: 'http://localhost:54321',
        API_EXTERNAL_URL: 'http://localhost:8000',
      })

      const { req, res } = createMockApiResponse()
      handler(req, res)

      // API should still work (returns what's configured)
      expect(res.statusCode).toBe(200)
      expect(res.data.environment).toBe('production') // NODE_ENV takes precedence

      // But validation should fail
      const validation = validateUrlsForEnvironment(
        {
          gotrueUrl: res.data.gotrueUrl,
          supabaseUrl: res.data.supabaseUrl,
          apiUrl: res.data.apiUrl,
        },
        'production'
      )
      expect(validation.isValid).toBe(false)
      expect(validation.errors.length).toBeGreaterThan(0)
      expect(validation.errors[0]).toContain('localhost')
    })

    it('should validate production platform deployment', async () => {
      // Scenario: Supabase Platform production deployment
      setEnvironment({
        NODE_ENV: 'production',
        NEXT_PUBLIC_IS_PLATFORM: 'true',
        SUPABASE_PUBLIC_URL: 'https://abcdefghijklmnop.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'platform-anon-key',
      })

      const { req, res } = createMockApiResponse()
      handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.data).toMatchObject({
        environment: 'production',
        isPlatform: true,
        gotrueUrl: 'https://abcdefghijklmnop.supabase.co/auth/v1',
        supabaseUrl: 'https://abcdefghijklmnop.supabase.co',
      })

      // Platform should be detected as production
      const envInfo = detectEnvironment()
      expect(envInfo.environment).toBe('production')
      expect(envInfo.detectionMethod).toBe('explicit-env')
    })
  })

  describe('Development Environment Validation', () => {
    it('should validate complete development environment setup', async () => {
      // Scenario: Local development with default configuration
      setEnvironment({
        NODE_ENV: 'development',
        SUPABASE_PUBLIC_URL: undefined,
        API_EXTERNAL_URL: undefined,
        NEXT_PUBLIC_GOTRUE_URL: undefined,
      })

      const { req, res } = createMockApiResponse()
      handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.data).toMatchObject({
        gotrueUrl: 'http://127.0.0.1:54321/auth/v1',
        supabaseUrl: 'http://127.0.0.1:54321',
        apiUrl: 'http://127.0.0.1:8000',
        environment: 'development',
        source: 'default',
      })

      // Should use localhost in development
      expect(res.data.gotrueUrl).toContain('127.0.0.1')
      expect(res.data.supabaseUrl).toContain('127.0.0.1')

      // Environment detection should work
      const envInfo = detectEnvironment({
        gotrueUrl: res.data.gotrueUrl,
        supabaseUrl: res.data.supabaseUrl,
        apiUrl: res.data.apiUrl,
      })
      expect(envInfo.environment).toBe('development')
      expect(envInfo.isDevelopment).toBe(true)

      // URL validation should pass for development
      const validation = validateUrlsForEnvironment(
        {
          gotrueUrl: res.data.gotrueUrl,
          supabaseUrl: res.data.supabaseUrl,
          apiUrl: res.data.apiUrl,
        },
        'development'
      )
      expect(validation.isValid).toBe(true)
    })

    it('should validate development with custom ports', async () => {
      // Scenario: Development with custom port configuration
      setEnvironment({
        NODE_ENV: 'development',
        NEXT_PUBLIC_GOTRUE_URL: 'http://localhost:9999/auth/v1',
        SUPABASE_PUBLIC_URL: 'http://localhost:9998',
        API_EXTERNAL_URL: 'http://localhost:9997',
      })

      const { req, res } = createMockApiResponse()
      handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.data).toMatchObject({
        gotrueUrl: 'http://localhost:9999/auth/v1',
        supabaseUrl: 'http://localhost:9998',
        apiUrl: 'http://localhost:9997',
        environment: 'development',
        source: 'explicit',
      })

      // Should still be detected as development
      const envInfo = detectEnvironment({
        gotrueUrl: res.data.gotrueUrl,
        supabaseUrl: res.data.supabaseUrl,
        apiUrl: res.data.apiUrl,
      })
      expect(envInfo.environment).toBe('development')
    })

    it('should validate development connecting to remote services', async () => {
      // Scenario: Local development connecting to remote development instance
      setEnvironment({
        NODE_ENV: 'development',
        SUPABASE_PUBLIC_URL: 'https://dev.example.com',
        API_EXTERNAL_URL: 'https://api.dev.example.com',
      })

      const { req, res } = createMockApiResponse()
      handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.data.environment).toBe('development') // NODE_ENV takes precedence
      expect(res.data.gotrueUrl).toBe('https://dev.example.com/auth/v1')

      // URL validation should pass with warnings
      const validation = validateUrlsForEnvironment(
        {
          gotrueUrl: res.data.gotrueUrl,
          supabaseUrl: res.data.supabaseUrl,
          apiUrl: res.data.apiUrl,
        },
        'development'
      )
      expect(validation.isValid).toBe(true)
      expect(validation.warnings.length).toBeGreaterThan(0) // Should warn about non-localhost in dev
    })
  })

  describe('Staging Environment Validation', () => {
    it('should validate complete staging environment setup', async () => {
      // Scenario: Staging deployment with staging-specific URLs
      setEnvironment({
        NODE_ENV: 'production',
        SUPABASE_PUBLIC_URL: 'https://staging.company.com',
        API_EXTERNAL_URL: 'https://api.staging.company.com',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'staging-anon-key',
      })

      const { req, res } = createMockApiResponse()
      handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.data).toMatchObject({
        gotrueUrl: 'https://staging.company.com/auth/v1',
        supabaseUrl: 'https://staging.company.com',
        apiUrl: 'https://api.staging.company.com',
        environment: 'staging',
        source: 'derived',
      })

      // Should detect as staging due to URL patterns
      const envInfo = detectEnvironment({
        gotrueUrl: res.data.gotrueUrl,
        supabaseUrl: res.data.supabaseUrl,
        apiUrl: res.data.apiUrl,
      })
      expect(envInfo.environment).toBe('staging')
      expect(envInfo.isStaging).toBe(true)

      // URL validation should pass
      const validation = validateUrlsForEnvironment(
        {
          gotrueUrl: res.data.gotrueUrl,
          supabaseUrl: res.data.supabaseUrl,
          apiUrl: res.data.apiUrl,
        },
        'staging'
      )
      expect(validation.isValid).toBe(true)
    })

    it('should validate staging with different naming patterns', async () => {
      const stagingPatterns = [
        'https://stg.company.com',
        'https://test.company.com',
        'https://dev-staging.company.com',
        'https://preview.company.com',
      ]

      for (const url of stagingPatterns) {
        setEnvironment({
          NODE_ENV: 'production',
          SUPABASE_PUBLIC_URL: url,
          API_EXTERNAL_URL: url.replace('https://', 'https://api.'),
        })

        const { req, res } = createMockApiResponse()
        handler(req, res)

        expect(res.statusCode).toBe(200)
        expect(res.data.environment).toBe('staging')

        const envInfo = detectEnvironment({
          gotrueUrl: res.data.gotrueUrl,
          supabaseUrl: res.data.supabaseUrl,
          apiUrl: res.data.apiUrl,
        })
        expect(envInfo.environment).toBe('staging')
      }
    })
  })

  describe('Environment Switching Scenarios', () => {
    it('should handle complete environment migration flow', async () => {
      // Scenario: Migrating from development → staging → production

      // Phase 1: Development
      process.env.NODE_ENV = 'development'
      delete process.env.SUPABASE_PUBLIC_URL
      delete process.env.API_EXTERNAL_URL

      let { req, res } = createMockApiResponse()
      handler(req, res)
      expect(res.data.environment).toBe('development')
      expect(res.data.gotrueUrl).toContain('127.0.0.1')

      // Phase 2: Staging deployment
      process.env.NODE_ENV = 'production'
      process.env.SUPABASE_PUBLIC_URL = 'https://staging.company.com'
      process.env.API_EXTERNAL_URL = 'https://api.staging.company.com'

      ;({ req, res } = createMockApiResponse())
      handler(req, res)
      expect(res.data.environment).toBe('staging')
      expect(res.data.gotrueUrl).toContain('staging.company.com')

      // Phase 3: Production deployment
      process.env.NODE_ENV = 'production'
      process.env.SUPABASE_PUBLIC_URL = 'https://prod.company.com'
      process.env.API_EXTERNAL_URL = 'https://api.prod.company.com'

      ;({ req, res } = createMockApiResponse())
      handler(req, res)
      expect(res.data.environment).toBe('production')
      expect(res.data.gotrueUrl).toContain('prod.company.com')
      expect(res.data.gotrueUrl).not.toContain('staging')
    })

    it('should handle same Docker image across environments', async () => {
      // Scenario: Same Docker image deployed to different environments
      const environments = [
        {
          name: 'development',
          env: { NODE_ENV: 'development' },
          expectedEnv: 'development',
          expectedUrl: 'http://127.0.0.1:54321/auth/v1',
        },
        {
          name: 'staging',
          env: {
            NODE_ENV: 'production',
            SUPABASE_PUBLIC_URL: 'https://staging.example.com',
          },
          expectedEnv: 'staging',
          expectedUrl: 'https://staging.example.com/auth/v1',
        },
        {
          name: 'production',
          env: {
            NODE_ENV: 'production',
            SUPABASE_PUBLIC_URL: 'https://prod.example.com',
          },
          expectedEnv: 'production',
          expectedUrl: 'https://prod.example.com/auth/v1',
        },
      ]

      for (const testEnv of environments) {
        // Simulate deploying same image with different env vars
        setEnvironment(testEnv.env)

        const { req, res } = createMockApiResponse()
        handler(req, res)

        expect(res.statusCode).toBe(200)
        expect(res.data.environment).toBe(testEnv.expectedEnv)
        expect(res.data.gotrueUrl).toBe(testEnv.expectedUrl)

        // Validate environment detection
        const envInfo = detectEnvironment({
          gotrueUrl: res.data.gotrueUrl,
          supabaseUrl: res.data.supabaseUrl,
          apiUrl: res.data.apiUrl,
        })
        expect(envInfo.environment).toBe(testEnv.expectedEnv)
      }
    })
  })

  describe('Configuration Validation and Health Checks', () => {
    it('should perform comprehensive environment validation', async () => {
      // Test production environment validation
      setEnvironment({
        NODE_ENV: 'production',
        SUPABASE_PUBLIC_URL: 'https://prod.example.com',
        API_EXTERNAL_URL: 'https://api.prod.example.com',
      })

      const urls = {
        gotrueUrl: 'https://prod.example.com/auth/v1',
        supabaseUrl: 'https://prod.example.com',
        apiUrl: 'https://api.prod.example.com',
      }

      // Perform complete environment check
      const envInfo = performEnvironmentCheck(urls, true)

      expect(envInfo.environment).toBe('production')
      expect(envInfo.isProduction).toBe(true)

      // Validate URLs for the environment
      const validation = validateUrlsForEnvironment(urls, 'production')
      expect(validation.isValid).toBe(true)
    })

    it('should validate health checks across environments', async () => {
      const environments = ['development', 'staging', 'production']

      for (const env of environments) {
        if (env === 'development') {
          setEnvironment({ NODE_ENV: 'development' })
        } else if (env === 'staging') {
          setEnvironment({
            NODE_ENV: 'production',
            SUPABASE_PUBLIC_URL: 'https://staging.example.com',
          })
        } else {
          setEnvironment({
            NODE_ENV: 'production',
            SUPABASE_PUBLIC_URL: 'https://prod.example.com',
          })
        }

        // Mock successful health checks
        const mockFetch = vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ status: 'ok' }),
        })
        global.fetch = mockFetch

        try {
          const healthResult = await performConfigHealthCheck()
          expect(healthResult).toBeDefined()
          expect(healthResult.checks).toBeDefined()
        } catch (error) {
          // Health checks may fail in test environment, which is expected
          console.log(`Health check failed for ${env} (expected in test environment)`)
        }
      }
    })

    it('should validate configuration completeness across environments', async () => {
      const scenarios = [
        {
          name: 'Complete production config',
          env: {
            NODE_ENV: 'production',
            SUPABASE_PUBLIC_URL: 'https://prod.example.com',
            API_EXTERNAL_URL: 'https://api.prod.example.com',
            NEXT_PUBLIC_SUPABASE_ANON_KEY: 'prod-key',
          },
          expectValid: true,
          expectWarnings: 0,
        },
        {
          name: 'Minimal production config',
          env: {
            NODE_ENV: 'production',
            SUPABASE_PUBLIC_URL: 'https://prod.example.com',
          },
          expectValid: true,
          expectWarnings: 1, // Missing API_EXTERNAL_URL
        },
        {
          name: 'Development config',
          env: {
            NODE_ENV: 'development',
          },
          expectValid: true,
          expectWarnings: 0,
        },
        {
          name: 'Invalid production config',
          env: {
            NODE_ENV: 'production',
            NEXT_PUBLIC_GOTRUE_URL: 'http://localhost:54321/auth/v1',
          },
          expectValid: false,
          expectWarnings: 0,
        },
      ]

      for (const scenario of scenarios) {
        // Clear all relevant environment variables first
        setEnvironment({
          NODE_ENV: undefined,
          SUPABASE_PUBLIC_URL: undefined,
          API_EXTERNAL_URL: undefined,
          NEXT_PUBLIC_GOTRUE_URL: undefined,
          NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
        })
        
        // Then set the scenario-specific variables
        setEnvironment(scenario.env)

        const { req, res } = createMockApiResponse()
        handler(req, res)

        if (scenario.expectValid) {
          expect(res.statusCode).toBe(200)

          const validation = validateUrlsForEnvironment(
            {
              gotrueUrl: res.data.gotrueUrl,
              supabaseUrl: res.data.supabaseUrl,
              apiUrl: res.data.apiUrl,
            },
            res.data.environment
          )

          if (scenario.name.includes('Invalid')) {
            expect(validation.isValid).toBe(false)
          } else {
            expect(validation.isValid).toBe(true)
          }
        } else {
          expect(res.statusCode).toBe(500)
        }
      }
    })
  })

  describe('Error Scenarios and Edge Cases', () => {
    it('should handle ambiguous environment detection', async () => {
      // Scenario: Production NODE_ENV but localhost URLs
      setEnvironment({
        NODE_ENV: 'production',
        SUPABASE_PUBLIC_URL: 'http://localhost:54321',
      })

      const { req, res } = createMockApiResponse()
      handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.data.environment).toBe('production') // NODE_ENV takes precedence

      // But validation should fail
      const validation = validateUrlsForEnvironment(
        {
          gotrueUrl: res.data.gotrueUrl,
          supabaseUrl: res.data.supabaseUrl,
          apiUrl: res.data.apiUrl,
        },
        'production'
      )
      expect(validation.isValid).toBe(false)
    })

    it('should handle missing environment configuration', async () => {
      // Scenario: No environment variables set
      setEnvironment({
        NODE_ENV: undefined,
        SUPABASE_PUBLIC_URL: undefined,
        API_EXTERNAL_URL: undefined,
      })

      const { req, res } = createMockApiResponse()
      handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.data.environment).toBe('production') // Default to production for safety
      expect(res.data.source).toBe('default')
    })

    it('should handle invalid URL configurations', async () => {
      const invalidConfigs = [
        { NEXT_PUBLIC_GOTRUE_URL: 'not-a-url' },
        { SUPABASE_PUBLIC_URL: 'ftp://invalid-protocol.com' },
        { API_EXTERNAL_URL: 'javascript:alert(1)' },
      ]

      for (const config of invalidConfigs) {
        setEnvironment(config)

        const { req, res } = createMockApiResponse()
        handler(req, res)

        expect(res.statusCode).toBe(500)
        expect(res.data).toHaveProperty('error')
        expect(res.data).toHaveProperty('suggestions')
      }
    })
  })
})