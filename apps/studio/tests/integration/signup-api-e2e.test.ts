import { createMocks } from 'node-mocks-http'
import handler from '../../pages/api/platform/signup'
import { NextApiRequest, NextApiResponse } from 'next'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { mswServer } from 'tests/lib/msw'

/**
 * End-to-End Integration Tests for Signup API
 * 
 * These tests simulate real-world container environment scenarios
 * and verify the complete signup flow from request to response.
 * 
 * Tests cover:
 * - Complete signup workflow in container environment
 * - Network connectivity validation
 * - Error handling and recovery scenarios
 * - Configuration validation and logging
 */

// Mock the dependencies with realistic container behavior
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

describe('Signup API - End-to-End Container Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Set up realistic container environment
    process.env.HOSTNAME = '::'
    process.env.DOCKER_CONTAINER = 'true'
    process.env.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlc3QiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY0NzUzNDAwMH0.test'
    process.env.NEXT_PUBLIC_IS_PLATFORM = 'false'
    process.env.NEXT_PUBLIC_GOTRUE_URL = 'http://kong:8000/auth/v1'
    process.env.SUPABASE_URL = 'http://kong:8000'
    process.env.SUPABASE_PUBLIC_URL = 'http://localhost:8000'
    
    // Mock realistic container environment detection
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
    delete process.env.SUPABASE_URL
    delete process.env.SUPABASE_PUBLIC_URL
  })

  describe('Complete Signup Workflow - Requirements 1.1, 1.2, 1.4', () => {
    it('should complete full signup workflow with container networking', async () => {
      // Mock realistic server-side config
      vi.mocked(getServerSideGoTrueConfig).mockReturnValue({
        internalUrl: 'http://kong:8000/auth/v1',
        externalUrl: 'http://localhost:8000/auth/v1',
        source: 'explicit',
        networkType: 'internal',
        validated: true
      })

      // Mock realistic GoTrue response
      const mockUser = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'newuser@company.com',
        email_confirmed_at: null,
        created_at: '2023-12-06T14:30:00.000Z',
        updated_at: '2023-12-06T14:30:00.000Z',
        user_metadata: {},
        app_metadata: {}
      }
      
      const mockSession = {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNjcwMzM0NjAwLCJzdWIiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJlbWFpbCI6Im5ld3VzZXJAY29tcGFueS5jb20iLCJwaG9uZSI6IiIsImFwcF9tZXRhZGF0YSI6e30sInVzZXJfbWV0YWRhdGEiOnt9LCJyb2xlIjoiYXV0aGVudGljYXRlZCJ9.test',
        refresh_token: 'refresh_token_example',
        expires_in: 3600,
        token_type: 'bearer',
        user: mockUser
      }

      mswServer.use(
        http.post('http://kong:8000/auth/v1/signup', async ({ request }) => {
          // Verify request structure
          const body = await request.json() as any
          expect(body.email).toBe('newuser@company.com')
          expect(body.password).toBe('SecurePass123!')
          expect(body.data).toEqual({})
          
          return HttpResponse.json({
            user: mockUser,
            session: mockSession
          }, { 
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'X-Request-ID': 'req_123456789'
            }
          })
        })
      )

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          email: 'newuser@company.com',
          password: 'SecurePass123!'
        }
      })

      await handler(req, res)

      // Verify successful response
      expect(res._getStatusCode()).toBe(200)
      const responseData = JSON.parse(res._getData())
      expect(responseData).toEqual({
        user: mockUser,
        session: mockSession,
        message: 'User created successfully. Please check your email to confirm your account.'
      })

      // Verify container environment was detected and logged
      expect(detectEnvironment).toHaveBeenCalled()
      expect(logConfigurationSource).toHaveBeenCalledWith(
        'Signup API',
        'explicit',
        { gotrueUrl: 'http://kong:8000/auth/v1' },
        'container',
        expect.objectContaining({
          networkType: 'internal',
          isContainer: true,
          configValidated: true
        })
      )

      // Verify successful request was logged
      expect(logSuccessfulRequest).toHaveBeenCalledWith(
        'Signup API',
        expect.objectContaining({
          url: 'http://kong:8000/auth/v1/signup',
          method: 'POST',
          status: 200,
          success: true,
          context: expect.objectContaining({
            userId: mockUser.id,
            email: mockUser.email,
            environment: 'container',
            networkType: 'internal'
          })
        })
      )
    })

    it('should handle complete signup workflow with redirect URL', async () => {
      vi.mocked(getServerSideGoTrueConfig).mockReturnValue({
        internalUrl: 'http://kong:8000/auth/v1',
        externalUrl: 'http://localhost:8000/auth/v1',
        source: 'explicit',
        networkType: 'internal',
        validated: true
      })

      const mockUser = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        email: 'redirect-user@company.com',
        created_at: '2023-12-06T14:30:00.000Z'
      }

      mswServer.use(
        http.post('http://kong:8000/auth/v1/signup', async ({ request }) => {
          const body = await request.json() as any
          expect(body.redirect_to).toBe('https://myapp.com/welcome')
          
          return HttpResponse.json({
            user: mockUser,
            session: { access_token: 'token', refresh_token: 'refresh' }
          }, { status: 200 })
        })
      )

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          email: 'redirect-user@company.com',
          password: 'SecurePass123!',
          redirectTo: 'https://myapp.com/welcome'
        }
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(200)
      const responseData = JSON.parse(res._getData())
      expect(responseData.user.email).toBe('redirect-user@company.com')
    })
  })

  describe('Network Connectivity Validation - Requirements 1.1, 1.2', () => {
    it('should validate internal network connectivity in container environment', async () => {
      vi.mocked(getServerSideGoTrueConfig).mockReturnValue({
        internalUrl: 'http://kong:8000/auth/v1',
        externalUrl: 'http://localhost:8000/auth/v1',
        source: 'explicit',
        networkType: 'internal',
        validated: true
      })

      // Mock network connectivity test
      let requestUrl = ''
      mswServer.use(
        http.post('http://kong:8000/auth/v1/signup', ({ request }) => {
          requestUrl = request.url
          return HttpResponse.json({
            user: { id: 'test', email: 'test@example.com' },
            session: { access_token: 'token' }
          }, { status: 200 })
        })
      )

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          email: 'connectivity@test.com',
          password: 'TestPass123!'
        }
      })

      await handler(req, res)

      // Verify internal URL was used
      expect(requestUrl).toBe('http://kong:8000/auth/v1/signup')
      expect(res._getStatusCode()).toBe(200)
      
      // Verify configuration was validated
      expect(validateGoTrueUrl).toHaveBeenCalledWith('http://kong:8000/auth/v1')
    })

    it('should handle container network isolation correctly', async () => {
      vi.mocked(getServerSideGoTrueConfig).mockReturnValue({
        internalUrl: 'http://kong:8000/auth/v1',
        externalUrl: 'http://localhost:8000/auth/v1',
        source: 'explicit',
        networkType: 'internal',
        validated: true
      })

      // Simulate external URL not being accessible from container
      mswServer.use(
        http.post('http://localhost:8000/auth/v1/signup', () => {
          return HttpResponse.json(
            { error: 'Connection refused - external URL not accessible from container' },
            { status: 503 }
          )
        }),
        // Internal URL should work
        http.post('http://kong:8000/auth/v1/signup', () => {
          return HttpResponse.json({
            user: { id: 'isolated-test', email: 'isolated@test.com' },
            session: { access_token: 'token' }
          }, { status: 200 })
        })
      )

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          email: 'isolated@test.com',
          password: 'IsolatedPass123!'
        }
      })

      await handler(req, res)

      // Should succeed using internal URL
      expect(res._getStatusCode()).toBe(200)
      const responseData = JSON.parse(res._getData())
      expect(responseData.user.email).toBe('isolated@test.com')
    })
  })

  describe('Error Recovery Scenarios - Requirements 1.4, 1.5', () => {
    beforeEach(() => {
      vi.mocked(getServerSideGoTrueConfig).mockReturnValue({
        internalUrl: 'http://kong:8000/auth/v1',
        externalUrl: 'http://localhost:8000/auth/v1',
        source: 'explicit',
        networkType: 'internal',
        validated: true
      })
    })

    it('should handle transient network errors with proper logging', async () => {
      // Mock transient network error
      const originalFetch = global.fetch
      const networkError = new Error('Network is unreachable')
      ;(networkError as any).code = 'ENETUNREACH'
      global.fetch = vi.fn().mockRejectedValue(networkError)

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          email: 'transient@test.com',
          password: 'TransientPass123!'
        }
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(500)
      expect(JSON.parse(res._getData())).toEqual({
        error: 'An unexpected error occurred during signup. Please try again or contact support if the problem persists.'
      })

      // Verify detailed error logging
      expect(logFailedRequest).toHaveBeenCalledWith(
        'Signup API',
        expect.objectContaining({
          error: 'Network is unreachable',
          context: expect.objectContaining({
            errorCode: 'ENETUNREACH',
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

    it('should handle GoTrue service overload scenario', async () => {
      // Mock service overload (multiple 503 responses)
      let requestCount = 0
      mswServer.use(
        http.post('http://kong:8000/auth/v1/signup', () => {
          requestCount++
          return HttpResponse.json(
            { 
              error_description: 'Service temporarily overloaded',
              retry_after: 30
            },
            { 
              status: 503,
              headers: {
                'Retry-After': '30'
              }
            }
          )
        })
      )

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          email: 'overload@test.com',
          password: 'OverloadPass123!'
        }
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(503)
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Authentication service is temporarily unavailable. Please try again in a few moments.'
      })
      expect(requestCount).toBe(1) // Should only make one request
    })

    it('should handle database connectivity issues from GoTrue', async () => {
      mswServer.use(
        http.post('http://kong:8000/auth/v1/signup', () => {
          return HttpResponse.json(
            { 
              error_description: 'Database connection failed',
              error_code: 'database_error'
            },
            { status: 500 }
          )
        })
      )

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          email: 'dbissue@test.com',
          password: 'DbIssuePass123!'
        }
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(503)
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Authentication service is temporarily unavailable. Please try again in a few moments.'
      })
    })
  })

  describe('Configuration Validation and Logging', () => {
    it('should validate and log complete configuration chain', async () => {
      const mockConfig = {
        internalUrl: 'http://kong:8000/auth/v1',
        externalUrl: 'http://localhost:8000/auth/v1',
        source: 'explicit' as const,
        networkType: 'internal' as const,
        validated: true
      }
      
      vi.mocked(getServerSideGoTrueConfig).mockReturnValue(mockConfig)

      mswServer.use(
        http.post('http://kong:8000/auth/v1/signup', () => {
          return HttpResponse.json({
            user: { id: 'config-test', email: 'config@test.com' },
            session: { access_token: 'token' }
          }, { status: 200 })
        })
      )

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          email: 'config@test.com',
          password: 'ConfigPass123!'
        }
      })

      await handler(req, res)

      // Verify configuration validation chain
      expect(getServerSideGoTrueConfig).toHaveBeenCalled()
      expect(validateGoTrueUrl).toHaveBeenCalledWith('http://kong:8000/auth/v1')
      
      // Verify configuration logging
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

      expect(res._getStatusCode()).toBe(200)
    })

    it('should handle configuration validation failure gracefully', async () => {
      vi.mocked(getServerSideGoTrueConfig).mockReturnValue({
        internalUrl: 'invalid://malformed-url',
        externalUrl: 'http://localhost:8000/auth/v1',
        source: 'derived',
        networkType: 'internal',
        validated: false
      })
      
      vi.mocked(validateGoTrueUrl).mockReturnValue(false)

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          email: 'invalid-config@test.com',
          password: 'InvalidConfigPass123!'
        }
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(500)
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Authentication service configuration error. Please contact support.'
      })
    })
  })

  describe('Real-world Scenario Simulation', () => {
    it('should handle complete user onboarding flow', async () => {
      vi.mocked(getServerSideGoTrueConfig).mockReturnValue({
        internalUrl: 'http://kong:8000/auth/v1',
        externalUrl: 'http://localhost:8000/auth/v1',
        source: 'explicit',
        networkType: 'internal',
        validated: true
      })

      // Simulate realistic user data
      const newUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'john.doe@company.com',
        email_confirmed_at: null,
        created_at: '2023-12-06T14:30:00.000Z',
        updated_at: '2023-12-06T14:30:00.000Z',
        user_metadata: {
          full_name: 'John Doe',
          avatar_url: null
        },
        app_metadata: {
          provider: 'email',
          providers: ['email']
        }
      }

      mswServer.use(
        http.post('http://kong:8000/auth/v1/signup', async ({ request }) => {
          const body = await request.json() as any
          
          // Simulate realistic validation
          if (body.email === 'john.doe@company.com' && body.password === 'SecurePassword123!') {
            return HttpResponse.json({
              user: newUser,
              session: {
                access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                refresh_token: 'refresh_token_here',
                expires_in: 3600,
                token_type: 'bearer',
                user: newUser
              }
            }, { 
              status: 200,
              headers: {
                'Content-Type': 'application/json',
                'X-Request-ID': 'req_onboarding_123'
              }
            })
          }
          
          return HttpResponse.json(
            { error_description: 'Invalid credentials' },
            { status: 400 }
          )
        })
      )

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          email: 'john.doe@company.com',
          password: 'SecurePassword123!',
          redirectTo: 'https://myapp.com/onboarding/welcome'
        }
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(200)
      const responseData = JSON.parse(res._getData())
      
      expect(responseData.user.email).toBe('john.doe@company.com')
      expect(responseData.user.user_metadata.full_name).toBe('John Doe')
      expect(responseData.session.access_token).toBeTruthy()
      expect(responseData.message).toBe('User created successfully. Please check your email to confirm your account.')
    })
  })
})