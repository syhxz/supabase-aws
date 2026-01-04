/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AuthServiceAdapter } from '../../../lib/auth-service/AuthServiceAdapter'
import { getServiceRouter, resetServiceRouter } from '../../../lib/service-router'

describe('AuthServiceAdapter', () => {
  let authService: AuthServiceAdapter
  const testProjectRef = 'test-project'

  beforeEach(() => {
    authService = new AuthServiceAdapter()
  })

  afterEach(() => {
    resetServiceRouter()
  })

  describe('validateIssuerConfiguration', () => {
    let consoleWarnSpy: any
    let consoleLogSpy: any
    let originalSupabaseUrl: string | undefined
    let originalApiExternalUrl: string | undefined

    beforeEach(() => {
      // Save original environment variables
      originalSupabaseUrl = process.env.SUPABASE_URL
      originalApiExternalUrl = process.env.API_EXTERNAL_URL
      
      // Spy on console methods
      consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    })

    afterEach(() => {
      // Restore original environment variables
      if (originalSupabaseUrl !== undefined) {
        process.env.SUPABASE_URL = originalSupabaseUrl
      } else {
        delete process.env.SUPABASE_URL
      }
      
      if (originalApiExternalUrl !== undefined) {
        process.env.API_EXTERNAL_URL = originalApiExternalUrl
      } else {
        delete process.env.API_EXTERNAL_URL
      }
      
      // Restore console methods
      consoleWarnSpy.mockRestore()
      consoleLogSpy.mockRestore()
    })

    it('should log confirmation when SUPABASE_URL is configured', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co'
      delete process.env.API_EXTERNAL_URL
      
      const service = new AuthServiceAdapter()
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[AuthServiceAdapter] JWT issuer configured:',
        'https://test.supabase.co'
      )
      expect(consoleWarnSpy).not.toHaveBeenCalled()
    })

    it('should log confirmation when only API_EXTERNAL_URL is configured', () => {
      delete process.env.SUPABASE_URL
      process.env.API_EXTERNAL_URL = 'https://api.example.com'
      
      const service = new AuthServiceAdapter()
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[AuthServiceAdapter] JWT issuer configured:',
        'https://api.example.com'
      )
      expect(consoleWarnSpy).not.toHaveBeenCalled()
    })

    it('should prefer SUPABASE_URL over API_EXTERNAL_URL when both are set', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co'
      process.env.API_EXTERNAL_URL = 'https://api.example.com'
      
      const service = new AuthServiceAdapter()
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[AuthServiceAdapter] JWT issuer configured:',
        'https://test.supabase.co'
      )
      expect(consoleWarnSpy).not.toHaveBeenCalled()
    })

    it('should log warning when neither environment variable is configured', () => {
      delete process.env.SUPABASE_URL
      delete process.env.API_EXTERNAL_URL
      
      const service = new AuthServiceAdapter()
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[AuthServiceAdapter] Warning: Neither SUPABASE_URL nor API_EXTERNAL_URL is configured. JWT issuer claim will be undefined.'
      )
      expect(consoleLogSpy).not.toHaveBeenCalled()
    })
  })

  describe('signUp', () => {
    it('should validate email format', async () => {
      await expect(
        authService.signUp(testProjectRef, {
          email: 'invalid-email',
          password: 'password123',
        })
      ).rejects.toThrow('Invalid email address')
    })

    it('should validate password length', async () => {
      await expect(
        authService.signUp(testProjectRef, {
          email: 'test@example.com',
          password: '12345', // Too short
        })
      ).rejects.toThrow('Password must be at least 6 characters')
    })

    it('should require email', async () => {
      await expect(
        authService.signUp(testProjectRef, {
          email: '',
          password: 'password123',
        })
      ).rejects.toThrow('Invalid email address')
    })
  })

  describe('signIn', () => {
    it('should require email and password', async () => {
      await expect(
        authService.signIn(testProjectRef, {
          email: '',
          password: '',
        })
      ).rejects.toThrow('Email and password are required')
    })

    it('should require email', async () => {
      await expect(
        authService.signIn(testProjectRef, {
          email: '',
          password: 'password123',
        })
      ).rejects.toThrow('Email and password are required')
    })

    it('should require password', async () => {
      await expect(
        authService.signIn(testProjectRef, {
          email: 'test@example.com',
          password: '',
        })
      ).rejects.toThrow('Email and password are required')
    })
  })

  describe('verifyToken', () => {
    it('should throw error for invalid token', () => {
      expect(() => {
        authService.verifyToken('invalid-token')
      }).toThrow('Invalid or expired token')
    })

    it('should throw error for malformed token', () => {
      expect(() => {
        authService.verifyToken('not.a.valid.jwt.token')
      }).toThrow('Invalid or expired token')
    })
  })

  describe('listUsers', () => {
    it('should use default limit and offset', async () => {
      // This test would require a mock database connection
      // For now, we just verify the method exists and has the right signature
      expect(authService.listUsers).toBeDefined()
      expect(typeof authService.listUsers).toBe('function')
    })
  })

  describe('getUser', () => {
    it('should accept projectRef and userId', async () => {
      // This test would require a mock database connection
      // For now, we just verify the method exists and has the right signature
      expect(authService.getUser).toBeDefined()
      expect(typeof authService.getUser).toBe('function')
    })
  })

  describe('deleteUser', () => {
    it('should accept projectRef and userId', async () => {
      // This test would require a mock database connection
      // For now, we just verify the method exists and has the right signature
      expect(authService.deleteUser).toBeDefined()
      expect(typeof authService.deleteUser).toBe('function')
    })
  })

  describe('refreshSession', () => {
    it('should accept projectRef and refreshToken', async () => {
      // This test would require a mock database connection
      // For now, we just verify the method exists and has the right signature
      expect(authService.refreshSession).toBeDefined()
      expect(typeof authService.refreshSession).toBe('function')
    })
  })

  describe('signOut', () => {
    it('should handle invalid tokens gracefully', async () => {
      // Sign out should not throw even with invalid token
      await expect(
        authService.signOut(testProjectRef, 'invalid-token')
      ).resolves.not.toThrow()
    })
  })

  describe('backward compatibility', () => {
    let originalSupabaseUrl: string | undefined
    let originalApiExternalUrl: string | undefined
    let originalJwtSecret: string | undefined

    beforeEach(() => {
      // Save original environment variables
      originalSupabaseUrl = process.env.SUPABASE_URL
      originalApiExternalUrl = process.env.API_EXTERNAL_URL
      originalJwtSecret = process.env.JWT_SECRET
    })

    afterEach(() => {
      // Restore original environment variables
      if (originalSupabaseUrl !== undefined) {
        process.env.SUPABASE_URL = originalSupabaseUrl
      } else {
        delete process.env.SUPABASE_URL
      }
      
      if (originalApiExternalUrl !== undefined) {
        process.env.API_EXTERNAL_URL = originalApiExternalUrl
      } else {
        delete process.env.API_EXTERNAL_URL
      }

      if (originalJwtSecret !== undefined) {
        process.env.JWT_SECRET = originalJwtSecret
      } else {
        delete process.env.JWT_SECRET
      }
    })

    it('should use HS256 algorithm for JWT signing', () => {
      // Set environment variables
      process.env.SUPABASE_URL = 'https://test.supabase.co'
      process.env.JWT_SECRET = 'test-secret-key'

      // Create service instance
      const service = new AuthServiceAdapter()

      // Create a mock user for testing
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_super_admin: false,
      }

      // Generate JWT token
      const createSessionMethod = (service as any).createSession.bind(service)
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      }

      return createSessionMethod(mockClient, testProjectRef, mockUser).then((session: any) => {
        // Decode the JWT token header to verify the algorithm
        const jwt = require('jsonwebtoken')
        const decoded = jwt.decode(session.access_token, { complete: true })
        
        // Verify that the algorithm is HS256 (HMAC SHA256)
        expect(decoded.header.alg).toBe('HS256')
      })
    })

    it('should preserve JWT expiration time configuration', () => {
      // Set environment variables
      process.env.SUPABASE_URL = 'https://test.supabase.co'
      process.env.JWT_SECRET = 'test-secret-key'

      // Create service instance
      const service = new AuthServiceAdapter()

      // Create a mock user for testing
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_super_admin: false,
      }

      // Generate JWT token
      const createSessionMethod = (service as any).createSession.bind(service)
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      }

      const beforeGeneration = Math.floor(Date.now() / 1000)

      return createSessionMethod(mockClient, testProjectRef, mockUser).then((session: any) => {
        // Decode the JWT token to verify expiration
        const jwt = require('jsonwebtoken')
        const decoded = jwt.decode(session.access_token)
        
        // Verify that the expiration time is approximately 1 hour (3600 seconds) from now
        const expectedExpiry = beforeGeneration + 3600
        const actualExpiry = decoded.exp
        
        // Allow 5 second tolerance for test execution time
        expect(actualExpiry).toBeGreaterThanOrEqual(expectedExpiry - 5)
        expect(actualExpiry).toBeLessThanOrEqual(expectedExpiry + 5)
        
        // Verify that expires_in matches the expected value
        expect(session.expires_in).toBe(3600)
      })
    })

    it('should verify JWT with the same JWT_SECRET used for signing', () => {
      // Set environment variables
      process.env.SUPABASE_URL = 'https://test.supabase.co'
      process.env.JWT_SECRET = 'test-secret-key-for-verification'

      // Create service instance
      const service = new AuthServiceAdapter()

      // Create a mock user for testing
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_super_admin: false,
      }

      // Generate JWT token
      const createSessionMethod = (service as any).createSession.bind(service)
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      }

      return createSessionMethod(mockClient, testProjectRef, mockUser).then((session: any) => {
        // Verify the token using the same service instance (same JWT_SECRET)
        const verifiedPayload = service.verifyToken(session.access_token)
        
        // Verify that the token was successfully verified
        expect(verifiedPayload).toBeDefined()
        expect(verifiedPayload.sub).toBe(mockUser.id)
        expect(verifiedPayload.email).toBe(mockUser.email)
      })
    })

    it('should fail to verify JWT with different JWT_SECRET', () => {
      // Set environment variables
      process.env.SUPABASE_URL = 'https://test.supabase.co'
      process.env.JWT_SECRET = 'original-secret-key'

      // Create service instance with original secret
      const service1 = new AuthServiceAdapter()

      // Create a mock user for testing
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_super_admin: false,
      }

      // Generate JWT token with original secret
      const createSessionMethod = (service1 as any).createSession.bind(service1)
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      }

      return createSessionMethod(mockClient, testProjectRef, mockUser).then((session: any) => {
        // Change JWT_SECRET
        process.env.JWT_SECRET = 'different-secret-key'
        
        // Create new service instance with different secret
        const service2 = new AuthServiceAdapter()
        
        // Attempt to verify the token with different secret should fail
        expect(() => {
          service2.verifyToken(session.access_token)
        }).toThrow('Invalid or expired token')
      })
    })

    it('should maintain JWT payload structure after adding issuer', () => {
      // Set environment variables
      process.env.SUPABASE_URL = 'https://test.supabase.co'
      process.env.JWT_SECRET = 'test-secret-key'

      // Create service instance
      const service = new AuthServiceAdapter()

      // Create a mock user for testing
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_super_admin: false,
      }

      // Generate JWT token
      const createSessionMethod = (service as any).createSession.bind(service)
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      }

      return createSessionMethod(mockClient, testProjectRef, mockUser).then((session: any) => {
        // Decode the JWT token to verify payload structure
        const jwt = require('jsonwebtoken')
        const decoded = jwt.decode(session.access_token)
        
        // Verify all expected payload fields are present
        expect(decoded.sub).toBe(mockUser.id)
        expect(decoded.email).toBe(mockUser.email)
        expect(decoded.project_ref).toBe(testProjectRef)
        expect(decoded.role).toBe('authenticated')
        expect(decoded.aal).toBe('aal1')
        expect(decoded.session_id).toBeDefined()
        
        // Verify standard JWT claims are present
        expect(decoded.exp).toBeDefined()
        expect(decoded.iat).toBeDefined()
        
        // Verify issuer is present (new addition)
        expect(decoded.iss).toBe('https://test.supabase.co')
        
        // Verify no unexpected fields were added
        const expectedFields = ['sub', 'email', 'project_ref', 'role', 'aal', 'session_id', 'exp', 'iat', 'iss']
        const actualFields = Object.keys(decoded)
        expect(actualFields.sort()).toEqual(expectedFields.sort())
      })
    })
  })

  describe('issuer configuration consistency', () => {
    let originalSupabaseUrl: string | undefined
    let originalApiExternalUrl: string | undefined
    let originalJwtSecret: string | undefined

    beforeEach(() => {
      // Save original environment variables
      originalSupabaseUrl = process.env.SUPABASE_URL
      originalApiExternalUrl = process.env.API_EXTERNAL_URL
      originalJwtSecret = process.env.JWT_SECRET
    })

    afterEach(() => {
      // Restore original environment variables
      if (originalSupabaseUrl !== undefined) {
        process.env.SUPABASE_URL = originalSupabaseUrl
      } else {
        delete process.env.SUPABASE_URL
      }
      
      if (originalApiExternalUrl !== undefined) {
        process.env.API_EXTERNAL_URL = originalApiExternalUrl
      } else {
        delete process.env.API_EXTERNAL_URL
      }

      if (originalJwtSecret !== undefined) {
        process.env.JWT_SECRET = originalJwtSecret
      } else {
        delete process.env.JWT_SECRET
      }
    })

    it('should use SUPABASE_URL as issuer when configured', () => {
      // Set environment variables
      process.env.SUPABASE_URL = 'https://test.supabase.co'
      process.env.JWT_SECRET = 'test-secret-key'
      delete process.env.API_EXTERNAL_URL

      // Create a new service instance to pick up the environment variables
      const service = new AuthServiceAdapter()

      // Create a mock user for testing
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_super_admin: false,
      }

      // Generate a JWT token using the private createSession method
      // We'll use reflection to access the private method for testing
      const createSessionMethod = (service as any).createSession.bind(service)
      
      // Mock the database client
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      }

      // Call createSession to generate a token
      return createSessionMethod(mockClient, testProjectRef, mockUser).then((session: any) => {
        // Decode the JWT token to verify the issuer claim
        const decoded = require('jsonwebtoken').decode(session.access_token)
        
        // Verify that the issuer matches SUPABASE_URL
        expect(decoded.iss).toBe('https://test.supabase.co')
      })
    })

    it('should use API_EXTERNAL_URL as issuer when SUPABASE_URL is not set', () => {
      // Set environment variables
      delete process.env.SUPABASE_URL
      process.env.API_EXTERNAL_URL = 'https://api.example.com'
      process.env.JWT_SECRET = 'test-secret-key'

      // Create a new service instance to pick up the environment variables
      const service = new AuthServiceAdapter()

      // Create a mock user for testing
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_super_admin: false,
      }

      // Generate a JWT token using the private createSession method
      const createSessionMethod = (service as any).createSession.bind(service)
      
      // Mock the database client
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      }

      // Call createSession to generate a token
      return createSessionMethod(mockClient, testProjectRef, mockUser).then((session: any) => {
        // Decode the JWT token to verify the issuer claim
        const decoded = require('jsonwebtoken').decode(session.access_token)
        
        // Verify that the issuer matches API_EXTERNAL_URL
        expect(decoded.iss).toBe('https://api.example.com')
      })
    })

    it('should prefer SUPABASE_URL over API_EXTERNAL_URL when both are set', () => {
      // Set both environment variables
      process.env.SUPABASE_URL = 'https://test.supabase.co'
      process.env.API_EXTERNAL_URL = 'https://api.example.com'
      process.env.JWT_SECRET = 'test-secret-key'

      // Create a new service instance to pick up the environment variables
      const service = new AuthServiceAdapter()

      // Create a mock user for testing
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_super_admin: false,
      }

      // Generate a JWT token using the private createSession method
      const createSessionMethod = (service as any).createSession.bind(service)
      
      // Mock the database client
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      }

      // Call createSession to generate a token
      return createSessionMethod(mockClient, testProjectRef, mockUser).then((session: any) => {
        // Decode the JWT token to verify the issuer claim
        const decoded = require('jsonwebtoken').decode(session.access_token)
        
        // Verify that the issuer matches SUPABASE_URL (preferred)
        expect(decoded.iss).toBe('https://test.supabase.co')
      })
    })

    it('should generate JWT without issuer when neither environment variable is set', () => {
      // Clear both environment variables
      delete process.env.SUPABASE_URL
      delete process.env.API_EXTERNAL_URL
      process.env.JWT_SECRET = 'test-secret-key'

      // Create a new service instance to pick up the environment variables
      const service = new AuthServiceAdapter()

      // Create a mock user for testing
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_super_admin: false,
      }

      // Generate a JWT token using the private createSession method
      const createSessionMethod = (service as any).createSession.bind(service)
      
      // Mock the database client
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      }

      // Call createSession to generate a token
      return createSessionMethod(mockClient, testProjectRef, mockUser).then((session: any) => {
        // Decode the JWT token to verify the issuer claim
        const decoded = require('jsonwebtoken').decode(session.access_token)
        
        // Verify that the issuer is undefined
        expect(decoded.iss).toBeUndefined()
      })
    })

    it('should update issuer when environment variable changes', () => {
      // First configuration
      process.env.SUPABASE_URL = 'https://first.supabase.co'
      process.env.JWT_SECRET = 'test-secret-key'
      delete process.env.API_EXTERNAL_URL

      // Create first service instance
      const service1 = new AuthServiceAdapter()

      // Create a mock user for testing
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_super_admin: false,
      }

      // Generate first JWT token
      const createSessionMethod1 = (service1 as any).createSession.bind(service1)
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      }

      return createSessionMethod1(mockClient, testProjectRef, mockUser).then((session1: any) => {
        // Decode first token
        const decoded1 = require('jsonwebtoken').decode(session1.access_token)
        expect(decoded1.iss).toBe('https://first.supabase.co')

        // Change environment variable
        process.env.SUPABASE_URL = 'https://second.supabase.co'

        // Create second service instance (simulating restart or new instance)
        const service2 = new AuthServiceAdapter()
        const createSessionMethod2 = (service2 as any).createSession.bind(service2)

        // Generate second JWT token
        return createSessionMethod2(mockClient, testProjectRef, mockUser).then((session2: any) => {
          // Decode second token
          const decoded2 = require('jsonwebtoken').decode(session2.access_token)
          
          // Verify that the issuer has changed
          expect(decoded2.iss).toBe('https://second.supabase.co')
          expect(decoded2.iss).not.toBe(decoded1.iss)
        })
      })
    })

    it('should maintain consistency between generation and verification configuration', () => {
      // Set environment variables for both generation and verification
      process.env.SUPABASE_URL = 'https://test.supabase.co'
      process.env.JWT_SECRET = 'test-secret-key'
      delete process.env.API_EXTERNAL_URL

      // Create service instance
      const service = new AuthServiceAdapter()

      // Create a mock user for testing
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_super_admin: false,
      }

      // Generate JWT token
      const createSessionMethod = (service as any).createSession.bind(service)
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      }

      return createSessionMethod(mockClient, testProjectRef, mockUser).then((session: any) => {
        // Decode the token to get the issuer
        const decoded = require('jsonwebtoken').decode(session.access_token)
        const generatedIssuer = decoded.iss

        // Verify that the issuer used in generation matches the environment configuration
        const expectedIssuer = process.env.SUPABASE_URL || process.env.API_EXTERNAL_URL
        expect(generatedIssuer).toBe(expectedIssuer)

        // Verify the token using the same configuration
        const verifiedPayload = service.verifyToken(session.access_token)
        
        // Verify that the verified token has the same issuer
        expect(verifiedPayload.iss).toBe(generatedIssuer)
      })
    })
  })

  describe('logging behavior', () => {
    let consoleDebugSpy: any
    let consoleErrorSpy: any
    let consoleWarnSpy: any
    let originalSupabaseUrl: string | undefined
    let originalApiExternalUrl: string | undefined
    let originalJwtSecret: string | undefined

    beforeEach(() => {
      // Save original environment variables
      originalSupabaseUrl = process.env.SUPABASE_URL
      originalApiExternalUrl = process.env.API_EXTERNAL_URL
      originalJwtSecret = process.env.JWT_SECRET
      
      // Spy on console methods
      consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    })

    afterEach(() => {
      // Restore original environment variables
      if (originalSupabaseUrl !== undefined) {
        process.env.SUPABASE_URL = originalSupabaseUrl
      } else {
        delete process.env.SUPABASE_URL
      }
      
      if (originalApiExternalUrl !== undefined) {
        process.env.API_EXTERNAL_URL = originalApiExternalUrl
      } else {
        delete process.env.API_EXTERNAL_URL
      }

      if (originalJwtSecret !== undefined) {
        process.env.JWT_SECRET = originalJwtSecret
      } else {
        delete process.env.JWT_SECRET
      }
      
      // Restore console methods
      consoleDebugSpy.mockRestore()
      consoleErrorSpy.mockRestore()
      consoleWarnSpy.mockRestore()
    })

    it('should log debug information during JWT generation with issuer value', () => {
      // Set environment variables
      process.env.SUPABASE_URL = 'https://test.supabase.co'
      process.env.JWT_SECRET = 'test-secret-key'

      // Create service instance
      const service = new AuthServiceAdapter()

      // Create a mock user for testing
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_super_admin: false,
      }

      // Generate JWT token
      const createSessionMethod = (service as any).createSession.bind(service)
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      }

      return createSessionMethod(mockClient, testProjectRef, mockUser).then((session: any) => {
        // Verify debug log was called with correct information
        expect(consoleDebugSpy).toHaveBeenCalledWith(
          '[AuthServiceAdapter] Generating JWT',
          expect.objectContaining({
            userId: 'test-user-id',
            projectRef: testProjectRef,
            issuer: 'https://test.supabase.co',
            role: 'authenticated',
            sessionId: expect.any(String),
          })
        )
        
        // Verify that the log does NOT contain sensitive information
        const logCalls = consoleDebugSpy.mock.calls
        logCalls.forEach((call: any) => {
          const logMessage = JSON.stringify(call)
          expect(logMessage).not.toContain('test-secret-key')
          expect(logMessage).not.toContain(session.access_token)
        })
      })
    })

    it('should log issuer as undefined when no environment variables are set', () => {
      // Clear environment variables
      delete process.env.SUPABASE_URL
      delete process.env.API_EXTERNAL_URL
      process.env.JWT_SECRET = 'test-secret-key'

      // Create service instance
      const service = new AuthServiceAdapter()

      // Create a mock user for testing
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_super_admin: false,
      }

      // Generate JWT token
      const createSessionMethod = (service as any).createSession.bind(service)
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      }

      return createSessionMethod(mockClient, testProjectRef, mockUser).then(() => {
        // Verify debug log includes issuer as 'undefined'
        expect(consoleDebugSpy).toHaveBeenCalledWith(
          '[AuthServiceAdapter] Generating JWT',
          expect.objectContaining({
            issuer: 'undefined',
          })
        )
      })
    })

    it('should include context (user ID, project ref) in debug logs', () => {
      // Set environment variables
      process.env.SUPABASE_URL = 'https://test.supabase.co'
      process.env.JWT_SECRET = 'test-secret-key'

      // Create service instance
      const service = new AuthServiceAdapter()

      // Create a mock user for testing
      const mockUser = {
        id: 'specific-user-123',
        email: 'test@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_super_admin: true, // Test admin role
      }

      // Generate JWT token
      const createSessionMethod = (service as any).createSession.bind(service)
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      }

      const specificProjectRef = 'specific-project-456'

      return createSessionMethod(mockClient, specificProjectRef, mockUser).then(() => {
        // Verify debug log includes all context information
        expect(consoleDebugSpy).toHaveBeenCalledWith(
          '[AuthServiceAdapter] Generating JWT',
          expect.objectContaining({
            userId: 'specific-user-123',
            projectRef: 'specific-project-456',
            role: 'admin', // Should be admin for super_admin users
          })
        )
      })
    })

    it('should NOT expose JWT secrets or full tokens in logs', () => {
      // Set environment variables
      process.env.SUPABASE_URL = 'https://test.supabase.co'
      process.env.JWT_SECRET = 'super-secret-key-do-not-log'

      // Create service instance
      const service = new AuthServiceAdapter()

      // Create a mock user for testing
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_super_admin: false,
      }

      // Generate JWT token
      const createSessionMethod = (service as any).createSession.bind(service)
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      }

      return createSessionMethod(mockClient, testProjectRef, mockUser).then((session: any) => {
        // Check all console spy calls
        const allCalls = [
          ...consoleDebugSpy.mock.calls,
          ...consoleErrorSpy.mock.calls,
          ...consoleWarnSpy.mock.calls,
        ]
        
        // Verify that no call contains the JWT secret
        allCalls.forEach((call: any) => {
          const logMessage = JSON.stringify(call)
          expect(logMessage).not.toContain('super-secret-key-do-not-log')
        })
        
        // Verify that no call contains the full JWT token
        allCalls.forEach((call: any) => {
          const logMessage = JSON.stringify(call)
          expect(logMessage).not.toContain(session.access_token)
        })
      })
    })
  })
})
