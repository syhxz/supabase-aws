import { createMocks } from 'node-mocks-http'
import handler from '../../pages/api/platform/signup'
import { NextApiRequest, NextApiResponse } from 'next'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { mswServer } from 'tests/lib/msw'

/**
 * Integration tests for signup API in container environment
 * 
 * These tests verify:
 * - Network connectivity uses correct internal addresses (Requirements 1.1, 1.2)
 * - Various error scenarios are handled properly (Requirements 1.4, 1.5)
 * - Container environment detection works correctly
 * - GoTrue service integration functions as expected
 */

// Mock the dependencies with container-specific behavior
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

describe('Signup API - Container Environment Integration Tests', () => {
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

  describe('Container Network Configuration - Requirements 1.1, 1.2', () => {
    it('should use internal kong:8000 address for server-side API calls', async () => {
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
              id: 'user-123',
              email: 'test@example.com',
              created_at: '2023-01-01T00:00:00Z'
            },
            session: {
              access_token: 'access-token',
              refresh_token: 'refresh-token'
            }
          }, { status: 200 })
        })
      )

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          email: 'test@example.com',
          password: 'Password123'
        }
      })

      await handler(req, res)

      // Verify the request was successful
      expect(res._getStatusCode()).toBe(200)
      
      // Verify that server-side config was called (indicating internal URL usage)
      expect(getServerSideGoTrueConfig).toHaveBeenCalled()
      
      // Verify configuration logging was called with internal network type
      expect(logConfigurationSource).toHaveBeenCalledWith(
        'Signup API',
        'explicit',
        { gotrueUrl: 'http://kong:8000/auth/v1' },
        'container',
        expect.objectContaining({
          networkType: 'internal'
        })
      )
    })

    it('should detect container environment correctly', async () => {
      vi.mocked(getServerSideGoTrueConfig).mockReturnValue({
        internalUrl: 'http://kong:8000/auth/v1',
        externalUrl: 'http://localhost:8000/auth/v1',
        source: 'explicit',
        networkType: 'internal',
        validated: true
      })

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          email: 'test@example.com',
          password: 'Password123'
        }
      })

      // Mock network error to test error handling path
      const originalFetch = global.fetch
      const error = new Error('fetch failed')
      ;(error as any).code = 'ECONNREFUSED'
      global.fetch = vi.fn().mockRejectedValue(error)

      await handler(req, res)

      // Verify environment detection was called
      expect(detectEnvironment).toHaveBeenCalled()
      
      // Verify container environment was detected in logging
      expect(logFailedRequest).toHaveBeenCalledWith(
        'Signup API',
        expect.objectContaining({
          context: expect.objectContaining({
            environment: 'container'
          })
        }),
        expect.any(Array)
      )

      // Restore original fetch
      global.fetch = originalFetch
    })

    it('should prefer internal URL over external URL in container environment', async () => {
      // Mock config with both internal and external URLs
      const mockConfig = {
        internalUrl: 'http://kong:8000/auth/v1',
        externalUrl: 'http://localhost:8000/auth/v1',
        source: 'explicit' as const,
        networkType: 'internal' as const,
        validated: true
      }
      
      vi.mocked(getServerSideGoTrueConfig).mockReturnValue(mockConfig)

      // Set up MSW to only respond to internal URL
      mswServer.use(
        http.post('http://kong:8000/auth/v1/signup', () => {
          return HttpResponse.json({
            user: { id: 'user-123', email: 'test@example.com' },
            session: { access_token: 'token' }
          }, { status: 200 })
        }),
        // External URL should not be called
        http.post('http://localhost:8000/auth/v1/signup', () => {
          return HttpResponse.json({ error: 'Should not use external URL' }, { status: 500 })
        })
      )

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          email: 'test@example.com',
          password: 'Password123'
        }
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(200)
      
      // Verify internal URL was used by checking the config call
      expect(getServerSideGoTrueConfig).toHaveBeenCalled()
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

    it('should handle GoTrue service unavailable (503 error)', async () => {
      // Mock GoTrue service returning 503
      mswServer.use(
        http.post('http://kong:8000/auth/v1/signup', () => {
          return HttpResponse.json(
            { error_description: 'Service temporarily unavailable' },
            { status: 503 }
          )
        })
      )

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          email: 'test@example.com',
          password: 'Password123'
        }
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(503)
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Authentication service is temporarily unavailable. Please try again in a few moments.'
      })

      // Verify error logging
      expect(logFailedRequest).toHaveBeenCalledWith(
        'Signup API',
        expect.objectContaining({
          success: false,
          status: 503
        }),
        expect.arrayContaining([
          expect.stringContaining('Verify GoTrue service is running'),
          expect.stringContaining('Check network connectivity')
        ])
      )
    })

    it('should handle network connection refused error', async () => {
      const originalFetch = global.fetch
      const error = new Error('fetch failed')
      ;(error as any).code = 'ECONNREFUSED'
      global.fetch = vi.fn().mockRejectedValue(error)

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          email: 'test@example.com',
          password: 'Password123'
        }
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(503)
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Authentication service is not responding. Please ensure all services are running and try again in a few moments.'
      })

      // Verify detailed error logging for container environment
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
          expect.stringContaining('Verify network connectivity between containers'),
          expect.stringContaining('Check Kong gateway configuration')
        ])
      )

      global.fetch = originalFetch
    })

    it('should handle network timeout error', async () => {
      const originalFetch = global.fetch
      const error = new Error('Request timeout')
      ;(error as any).code = 'ETIMEDOUT'
      global.fetch = vi.fn().mockRejectedValue(error)

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          email: 'test@example.com',
          password: 'Password123'
        }
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(503)
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Authentication service is taking too long to respond. Please try again in a few moments.'
      })

      global.fetch = originalFetch
    })

    it('should handle DNS resolution error (ENOTFOUND)', async () => {
      const originalFetch = global.fetch
      const error = new Error('getaddrinfo ENOTFOUND kong')
      ;(error as any).code = 'ENOTFOUND'
      global.fetch = vi.fn().mockRejectedValue(error)

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          email: 'test@example.com',
          password: 'Password123'
        }
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(503)
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Authentication service cannot be reached. Please check your network configuration and try again.'
      })

      global.fetch = originalFetch
    })

    it('should handle user already exists error correctly', async () => {
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
          email: 'existing@example.com',
          password: 'Password123'
        }
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(400)
      expect(JSON.parse(res._getData())).toEqual({
        error: 'A user with this email already exists. Please try signing in instead or use the password reset option if you forgot your password.'
      })
    })

    it('should handle rate limiting error', async () => {
      mswServer.use(
        http.post('http://kong:8000/auth/v1/signup', () => {
          return HttpResponse.json(
            { error_description: 'Rate limit exceeded' },
            { status: 429 }
          )
        })
      )

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          email: 'test@example.com',
          password: 'Password123'
        }
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(429)
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Too many signup attempts. Please wait a few minutes before trying again.'
      })
    })

    it('should handle weak password error from GoTrue', async () => {
      mswServer.use(
        http.post('http://kong:8000/auth/v1/signup', () => {
          return HttpResponse.json(
            { error_description: 'Password is too weak' },
            { status: 400 }
          )
        })
      )

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          email: 'test@example.com',
          password: 'Password123'
        }
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(400)
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Password is too weak'
      })
    })
  })

  describe('Configuration Validation - Requirements 1.1, 1.2', () => {
    it('should handle invalid GoTrue URL configuration', async () => {
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
          email: 'test@example.com',
          password: 'Password123'
        }
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(500)
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Authentication service configuration error. Please contact support.'
      })
    })

    it('should handle missing SUPABASE_ANON_KEY', async () => {
      delete process.env.SUPABASE_ANON_KEY
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      vi.mocked(getServerSideGoTrueConfig).mockReturnValue({
        internalUrl: 'http://kong:8000/auth/v1',
        externalUrl: 'http://localhost:8000/auth/v1',
        source: 'explicit',
        networkType: 'internal',
        validated: true
      })

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          email: 'test@example.com',
          password: 'Password123'
        }
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(500)
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Server configuration error. Please contact support.'
      })
    })
  })

  describe('Successful Signup Flow - Requirement 1.4', () => {
    it('should complete successful signup with proper logging', async () => {
      vi.mocked(getServerSideGoTrueConfig).mockReturnValue({
        internalUrl: 'http://kong:8000/auth/v1',
        externalUrl: 'http://localhost:8000/auth/v1',
        source: 'explicit',
        networkType: 'internal',
        validated: true
      })

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        created_at: '2023-01-01T00:00:00Z'
      }
      
      const mockSession = {
        access_token: 'access-token',
        refresh_token: 'refresh-token'
      }

      mswServer.use(
        http.post('http://kong:8000/auth/v1/signup', () => {
          return HttpResponse.json({
            user: mockUser,
            session: mockSession
          }, { status: 200 })
        })
      )

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          email: 'test@example.com',
          password: 'Password123'
        }
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(200)
      const responseData = JSON.parse(res._getData())
      expect(responseData).toEqual({
        user: mockUser,
        session: mockSession,
        message: 'User created successfully. Please check your email to confirm your account.'
      })

      // Verify successful request logging
      expect(logSuccessfulRequest).toHaveBeenCalledWith(
        'Signup API',
        expect.objectContaining({
          success: true,
          status: 200,
          context: expect.objectContaining({
            userId: mockUser.id,
            email: mockUser.email,
            environment: 'container',
            networkType: 'internal'
          })
        })
      )
    })

    it('should handle signup with redirect URL', async () => {
      vi.mocked(getServerSideGoTrueConfig).mockReturnValue({
        internalUrl: 'http://kong:8000/auth/v1',
        externalUrl: 'http://localhost:8000/auth/v1',
        source: 'explicit',
        networkType: 'internal',
        validated: true
      })

      const mockUser = {
        id: 'user-456',
        email: 'redirect@example.com',
        created_at: '2023-01-01T00:00:00Z'
      }

      mswServer.use(
        http.post('http://kong:8000/auth/v1/signup', ({ request }) => {
          // Verify redirect_to is included in request
          return request.json().then((body: any) => {
            expect(body.redirect_to).toBe('http://localhost:3000/welcome')
            return HttpResponse.json({
              user: mockUser,
              session: { access_token: 'token' }
            }, { status: 200 })
          })
        })
      )

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          email: 'redirect@example.com',
          password: 'Password123',
          redirectTo: 'http://localhost:3000/welcome'
        }
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(200)
    })
  })

  describe('Container Environment Logging', () => {
    it('should log detailed container environment information', async () => {
      vi.mocked(getServerSideGoTrueConfig).mockReturnValue({
        internalUrl: 'http://kong:8000/auth/v1',
        externalUrl: 'http://localhost:8000/auth/v1',
        source: 'explicit',
        networkType: 'internal',
        validated: true
      })

      // Mock a network error to trigger detailed logging
      const originalFetch = global.fetch
      const error = new Error('fetch failed')
      ;(error as any).code = 'ECONNREFUSED'
      global.fetch = vi.fn().mockRejectedValue(error)

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          email: 'test@example.com',
          password: 'Password123'
        }
      })

      await handler(req, res)

      // Verify configuration source logging was called with container context
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

      global.fetch = originalFetch
    })
  })
})