import { createMocks } from 'node-mocks-http'
import handler from '../../../../pages/api/platform/signup'
import { NextApiRequest, NextApiResponse } from 'next'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { mswServer } from 'tests/lib/msw'

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

// We'll use MSW handlers instead of mocking fetch directly

describe('/api/platform/signup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Default mocks
    vi.mocked(getServerSideGoTrueConfig).mockReturnValue({
      internalUrl: 'http://kong:8000/auth/v1',
      externalUrl: 'http://localhost:8000/auth/v1',
      source: 'explicit',
      networkType: 'internal',
      validated: true
    })
    
    vi.mocked(validateGoTrueUrl).mockReturnValue(true)
    
    vi.mocked(detectEnvironment).mockReturnValue({
      environment: 'container',
      detectionMethod: 'hostname',
      context: 'docker'
    })
    
    // Set required environment variables
    process.env.SUPABASE_ANON_KEY = 'test-anon-key'
    process.env.NEXT_PUBLIC_IS_PLATFORM = 'false'
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Method validation', () => {
    it('should reject non-POST requests', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(405)
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Method not allowed'
      })
    })
  })

  describe('Platform mode validation', () => {
    it('should reject requests in platform mode', async () => {
      process.env.NEXT_PUBLIC_IS_PLATFORM = 'true'
      
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          email: 'test@example.com',
          password: 'Password123'
        }
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(404)
      expect(JSON.parse(res._getData())).toEqual({
        error: 'This endpoint is only available in self-hosted mode'
      })
    })
  })

  describe('Input validation', () => {
    it('should require email and password', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {}
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(400)
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Missing required fields: email, password. Please provide all required information.'
      })
    })

    it('should require email when only password provided', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: { password: 'Password123' }
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(400)
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Missing required fields: email. Please provide all required information.'
      })
    })

    it('should validate email format', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          email: 'invalid-email',
          password: 'Password123'
        }
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(400)
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Invalid email format. Please enter a valid email address (e.g., user@example.com).'
      })
    })

    it('should validate password complexity', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          email: 'test@example.com',
          password: 'password' // No uppercase, no numbers
        }
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(400)
      expect(JSON.parse(res._getData()).error).toContain('at least one uppercase letter')
      expect(JSON.parse(res._getData()).error).toContain('at least one number')
    })

    it('should validate data types', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          email: 123,
          password: true
        }
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(400)
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Email and password must be text strings.'
      })
    })

    it('should validate redirectTo URL format', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          email: 'test@example.com',
          password: 'Password123',
          redirectTo: 'invalid-url'
        }
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(400)
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Invalid redirect URL format. Please provide a valid URL.'
      })
    })
  })

  describe('GoTrue error handling', () => {
    it('should handle user already exists error', async () => {
      // Add MSW handler for this test
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

    it('should handle weak password error', async () => {
      // Add MSW handler for this test
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

    it('should handle rate limiting error', async () => {
      // Add MSW handler for this test
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
  })

  describe('Network error handling', () => {
    it('should handle connection refused error', async () => {
      // Mock fetch directly to throw a connection refused error
      const originalFetch = global.fetch
      const error = new Error('fetch failed')
      ;(error as any).code = 'ECONNREFUSED'
      const mockFetch = vi.fn().mockRejectedValue(error)
      global.fetch = mockFetch

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

      // Restore original fetch
      global.fetch = originalFetch
    })

    it('should handle timeout error', async () => {
      // Mock fetch directly to throw a timeout error
      const originalFetch = global.fetch
      const error = new Error('Request timeout')
      ;(error as any).code = 'ETIMEDOUT'
      const mockFetch = vi.fn().mockRejectedValue(error)
      global.fetch = mockFetch

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

      // Restore original fetch
      global.fetch = originalFetch
    })
  })

  describe('Successful signup', () => {
    it('should handle successful signup', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        created_at: '2023-01-01T00:00:00Z'
      }
      
      const mockSession = {
        access_token: 'access-token',
        refresh_token: 'refresh-token'
      }

      // Add MSW handler for successful response
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
    })
  })

  describe('Configuration errors', () => {
    it('should handle invalid GoTrue URL', async () => {
      vi.mocked(validateGoTrueUrl).mockReturnValue(false)

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

    it('should handle missing anon key', async () => {
      delete process.env.SUPABASE_ANON_KEY
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

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
})