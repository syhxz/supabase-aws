import { createMocks } from 'node-mocks-http'
import handler from '../../pages/api/platform/signup'
import { NextApiRequest, NextApiResponse } from 'next'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { mswServer } from 'tests/lib/msw'

/**
 * Simplified Integration Tests for Signup API Container Environment
 * 
 * These tests focus on the core requirements:
 * - Container environment network connectivity (Requirements 1.1, 1.2)
 * - Error scenario handling (Requirements 1.4, 1.5)
 * - Configuration validation and logging
 * 
 * This simplified version avoids complex MSW setup issues while still
 * providing comprehensive coverage of the integration requirements.
 */

// Mock the dependencies
vi.mock('common/gotrue-config', () => ({
  getServerSideGoTrueConfig: vi.fn(),
  validateGoTrueUrl: vi.fn()
}))

vi.mock('common/configuration-logging', () => ({
  logFailedRequest: vi.fn(),
  logSuccessfulRequest: vi.fn(),
  logConfigurationSource: vi.fn()
}))

vi.mock('common/environment-detection', () => ({
  detectEnvironment: vi.fn()
}))

// Import mocked functions
import { getServerSideGoTrueConfig, validateGoTrueUrl } from 'common/gotrue-config'
import { logFailedRequest, logSuccessfulRequest, logConfigurationSource } from 'common/configuration-logging'
import { detectEnvironment } from 'common/environment-detection'

describe('Signup API - Simplified Container Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Set up container environment
    process.env.HOSTNAME = '::'
    process.env.DOCKER_CONTAINER = 'true'
    process.env.SUPABASE_ANON_KEY = 'test-anon-key'
    process.env.NEXT_PUBLIC_IS_PLATFORM = 'false'
    process.env.NEXT_PUBLIC_GOTRUE_URL = 'http://kong:8000/auth/v1'
    
    // Mock container environment detection
    vi.mocked(detectEnvironment).mockReturnValue({
      environment: 'container',
      detectionMethod: 'hostname',
      context: 'docker'
    })
    
    // Mock URL validation to pass
    vi.mocked(validateGoTrueUrl).mockReturnValue(true)
  })

  afterEach(() => {
    vi.resetAllMocks()
    // Clean up environment variables
    delete process.env.HOSTNAME
    delete process.env.DOCKER_CONTAINER
  })

  describe('Container Network Configuration Validation - Requirements 1.1, 1.2', () => {
    it('should use internal kong:8000 address for container environment', async () => {
      // Mock server-side config to return internal URL
      vi.mocked(getServerSideGoTrueConfig).mockReturnValue({
        internalUrl: 'http://kong:8000/auth/v1',
        externalUrl: 'http://localhost:8000/auth/v1',
        source: 'explicit',
        networkType: 'internal',
        validated: true
      })

      // Mock successful GoTrue response
      mswServer.use(
        http.post('http://kong:8000/auth/v1/signup', () => {
          return HttpResponse.json({
            user: {
              id: 'container-test-user',
              email: 'container@test.com',
              created_at: '2023-12-06T14:30:00.000Z'
            },
            session: {
              access_token: 'container-access-token',
              refresh_token: 'container-refresh-token'
            }
          }, { status: 200 })
        })
      )

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          email: 'container@test.com',
          password: 'ContainerPass123!'
        }
      })

      await handler(req, res)

      // Verify successful response
      expect(res._getStatusCode()).toBe(200)
      const responseData = JSON.parse(res._getData())
      expect(responseData.user.email).toBe('container@test.com')
      
      // Verify container environment was detected
      expect(detectEnvironment).toHaveBeenCalled()
      
      // Verify server-side config was used (internal URL)
      expect(getServerSideGoTrueConfig).toHaveBeenCalled()
      
      // Verify configuration logging with container context
      expect(logConfigurationSource).toHaveBeenCalledWith(
        'Signup API',
        'explicit',
        { gotrueUrl: 'http://kong:8000/auth/v1' },
        'container',
        expect.objectContaining({
          networkType: 'internal',
          isContainer: true
        })
      )
    })

    it('should validate GoTrue URL configuration in container environment', async () => {
      vi.mocked(getServerSideGoTrueConfig).mockReturnValue({
        internalUrl: 'http://kong:8000/auth/v1',
        externalUrl: 'http://localhost:8000/auth/v1',
        source: 'explicit',
        networkType: 'internal',
        validated: true
      })

      mswServer.use(
        http.post('http://kong:8000/auth/v1/signup', () => {
          return HttpResponse.json({
            user: { id: 'validation-test', email: 'validation@test.com' },
            session: { access_token: 'token' }
          }, { status: 200 })
        })
      )

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          email: 'validation@test.com',
          password: 'ValidationPass123!'
        }
      })

      await handler(req, res)

      // Verify URL validation was called
      expect(validateGoTrueUrl).toHaveBeenCalledWith('http://kong:8000/auth/v1')
      expect(res._getStatusCode()).toBe(200)
    })
  })

  describe('Error Scenario Handling - Requirements 1.4, 1.5', () => {
    beforeEach(() => {
      vi.mocked(getServerSideGoTrueConfig).mockReturnValue({
        internalUrl: 'http://kong:8000/auth/v1',
        externalUrl: 'http://localhost:8000/auth/v1',
        source: 'explicit',
        networkType: 'internal',
        validated: true
      })
    })

    it('should handle network connection errors in container environment', async () => {
      // Mock network connection error
      const originalFetch = global.fetch
      const connectionError = new Error('fetch failed')
      ;(connectionError as any).code = 'ECONNREFUSED'
      global.fetch = vi.fn().mockRejectedValue(connectionError)

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          email: 'network-error@test.com',
          password: 'NetworkErrorPass123!'
        }
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(503)
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Authentication service is not responding. Please ensure all services are running and try again in a few moments.'
      })

      // Verify error logging with container context
      expect(logFailedRequest).toHaveBeenCalledWith(
        'Signup API',
        expect.objectContaining({
          error: 'fetch failed',
          context: expect.objectContaining({
            errorCode: 'ECONNREFUSED',
            environment: 'container',
            isConnectionError: true
          })
        }),
        expect.arrayContaining([
          expect.stringContaining('Check if GoTrue service is running'),
          expect.stringContaining('Verify network connectivity between containers')
        ])
      )

      global.fetch = originalFetch
    })

    it('should handle GoTrue service errors properly', async () => {
      mswServer.use(
        http.post('http://kong:8000/auth/v1/signup', () => {
          return HttpResponse.json(
            { error_description: 'User already registered' },
            { status: 400 }
          )
        })
      )

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          email: 'existing@test.com',
          password: 'ExistingPass123!'
        }
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(400)
      expect(JSON.parse(res._getData())).toEqual({
        error: 'A user with this email already exists. Please try signing in instead or use the password reset option if you forgot your password.'
      })
    })

    it('should handle configuration validation failures', async () => {
      vi.mocked(validateGoTrueUrl).mockReturnValue(false)
      vi.mocked(getServerSideGoTrueConfig).mockReturnValue({
        internalUrl: 'invalid-url',
        externalUrl: 'http://localhost:8000/auth/v1',
        source: 'explicit',
        networkType: 'internal',
        validated: false
      })

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          email: 'config-error@test.com',
          password: 'ConfigErrorPass123!'
        }
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(500)
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Authentication service configuration error. Please contact support.'
      })
    })
  })

  describe('Container Environment Logging and Monitoring', () => {
    it('should log detailed container environment information', async () => {
      vi.mocked(getServerSideGoTrueConfig).mockReturnValue({
        internalUrl: 'http://kong:8000/auth/v1',
        externalUrl: 'http://localhost:8000/auth/v1',
        source: 'explicit',
        networkType: 'internal',
        validated: true
      })

      mswServer.use(
        http.post('http://kong:8000/auth/v1/signup', () => {
          return HttpResponse.json({
            user: { id: 'logging-test', email: 'logging@test.com' },
            session: { access_token: 'token' }
          }, { status: 200 })
        })
      )

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          email: 'logging@test.com',
          password: 'LoggingPass123!'
        }
      })

      await handler(req, res)

      // Verify environment detection was called
      expect(detectEnvironment).toHaveBeenCalled()
      
      // Verify configuration logging with container details
      expect(logConfigurationSource).toHaveBeenCalledWith(
        'Signup API',
        'explicit',
        { gotrueUrl: 'http://kong:8000/auth/v1' },
        'container',
        expect.objectContaining({
          networkType: 'internal',
          isContainer: true,
          configValidated: true,
          externalUrl: 'http://localhost:8000/auth/v1'
        })
      )

      // Verify successful request logging
      expect(logSuccessfulRequest).toHaveBeenCalledWith(
        'Signup API',
        expect.objectContaining({
          success: true,
          status: 200,
          context: expect.objectContaining({
            environment: 'container',
            networkType: 'internal'
          })
        })
      )

      expect(res._getStatusCode()).toBe(200)
    })
  })

  describe('Complete Integration Workflow', () => {
    it('should complete full signup workflow in container environment', async () => {
      vi.mocked(getServerSideGoTrueConfig).mockReturnValue({
        internalUrl: 'http://kong:8000/auth/v1',
        externalUrl: 'http://localhost:8000/auth/v1',
        source: 'explicit',
        networkType: 'internal',
        validated: true
      })

      const mockUser = {
        id: 'integration-test-user-123',
        email: 'integration@company.com',
        email_confirmed_at: null,
        created_at: '2023-12-06T14:30:00.000Z',
        user_metadata: {},
        app_metadata: {}
      }

      mswServer.use(
        http.post('http://kong:8000/auth/v1/signup', async ({ request }) => {
          const body = await request.json() as any
          
          // Verify request structure
          expect(body.email).toBe('integration@company.com')
          expect(body.password).toBe('IntegrationPass123!')
          expect(body.data).toEqual({})
          
          return HttpResponse.json({
            user: mockUser,
            session: {
              access_token: 'integration-access-token',
              refresh_token: 'integration-refresh-token',
              expires_in: 3600,
              token_type: 'bearer'
            }
          }, { status: 200 })
        })
      )

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          email: 'integration@company.com',
          password: 'IntegrationPass123!'
        }
      })

      await handler(req, res)

      // Verify successful response
      expect(res._getStatusCode()).toBe(200)
      const responseData = JSON.parse(res._getData())
      
      expect(responseData.user.email).toBe('integration@company.com')
      expect(responseData.session.access_token).toBe('integration-access-token')
      expect(responseData.message).toBe('User created successfully. Please check your email to confirm your account.')

      // Verify all integration points were called
      expect(detectEnvironment).toHaveBeenCalled()
      expect(getServerSideGoTrueConfig).toHaveBeenCalled()
      expect(validateGoTrueUrl).toHaveBeenCalled()
      expect(logConfigurationSource).toHaveBeenCalled()
      expect(logSuccessfulRequest).toHaveBeenCalled()
    })
  })
})