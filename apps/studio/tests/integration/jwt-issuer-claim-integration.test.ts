/**
 * @vitest-environment node
 * 
 * Integration tests for JWT Issuer Claim Fix
 * 
 * These tests validate the complete authentication flow:
 * - Login → JWT generation → API request → JWT verification
 * - Different environment configurations
 * - Multiple projects
 * 
 * Requirements: All requirements (end-to-end validation)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AuthServiceAdapter } from '../../lib/auth-service/AuthServiceAdapter'
import jwt from 'jsonwebtoken'

describe('JWT Issuer Claim Integration Tests', () => {
  let authService: AuthServiceAdapter
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env }
    
    // Set up test environment
    process.env.JWT_SECRET = 'test-integration-secret-key'
    process.env.SUPABASE_URL = 'https://test-integration.supabase.co'
    
    // Create fresh auth service instance
    authService = new AuthServiceAdapter()
  })

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv
  })

  describe('Full Authentication Flow', () => {
    it('should complete full flow: login → JWT generation → verification', async () => {
      // Step 1: Simulate user login (create mock user)
      const mockUser = {
        id: 'integration-user-001',
        email: 'integration@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_super_admin: false,
      }

      const projectRef = 'integration-project-001'

      // Step 2: Generate JWT token (simulating login)
      const createSessionMethod = (authService as any).createSession.bind(authService)
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      }

      const session = await createSessionMethod(mockClient, projectRef, mockUser)

      // Verify session was created
      expect(session).toBeDefined()
      expect(session.access_token).toBeDefined()
      expect(session.refresh_token).toBeDefined()
      expect(session.expires_in).toBe(3600)

      // Step 3: Decode JWT to verify structure
      const decodedToken = jwt.decode(session.access_token) as any
      
      expect(decodedToken).toBeDefined()
      expect(decodedToken.sub).toBe(mockUser.id)
      expect(decodedToken.email).toBe(mockUser.email)
      expect(decodedToken.project_ref).toBe(projectRef)
      expect(decodedToken.role).toBe('authenticated')
      expect(decodedToken.aal).toBe('aal1')
      expect(decodedToken.session_id).toBeDefined()
      expect(decodedToken.iss).toBe('https://test-integration.supabase.co')

      // Step 4: Verify JWT token (simulating API request verification)
      const verifiedPayload = authService.verifyToken(session.access_token)
      
      expect(verifiedPayload).toBeDefined()
      expect(verifiedPayload.sub).toBe(mockUser.id)
      expect(verifiedPayload.email).toBe(mockUser.email)
      expect(verifiedPayload.iss).toBe('https://test-integration.supabase.co')

      // Step 5: Verify the complete flow succeeded
      expect(verifiedPayload.sub).toBe(decodedToken.sub)
      expect(verifiedPayload.iss).toBe(decodedToken.iss)
    })

    it('should handle admin user authentication flow', async () => {
      // Test with super admin user
      const mockAdminUser = {
        id: 'admin-user-001',
        email: 'admin@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_super_admin: true,
      }

      const projectRef = 'admin-project-001'

      const createSessionMethod = (authService as any).createSession.bind(authService)
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      }

      const session = await createSessionMethod(mockClient, projectRef, mockAdminUser)

      // Verify admin role is set correctly
      const decodedToken = jwt.decode(session.access_token) as any
      expect(decodedToken.role).toBe('admin')

      // Verify token can be verified
      const verifiedPayload = authService.verifyToken(session.access_token)
      expect(verifiedPayload.role).toBe('admin')
    })

    it('should detect issuer mismatch in token payload', async () => {
      // Generate token with one issuer
      const mockUser = {
        id: 'user-mismatch-test',
        email: 'mismatch@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_super_admin: false,
      }

      const projectRef = 'mismatch-project'

      const createSessionMethod = (authService as any).createSession.bind(authService)
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      }

      const session = await createSessionMethod(mockClient, projectRef, mockUser)

      // Verify token was generated with correct issuer
      const decodedToken = jwt.decode(session.access_token) as any
      expect(decodedToken.iss).toBe('https://test-integration.supabase.co')

      // Change environment to simulate different issuer configuration
      process.env.SUPABASE_URL = 'https://different-issuer.supabase.co'
      
      // Create new service instance with different issuer
      const newAuthService = new AuthServiceAdapter()

      // Note: AuthServiceAdapter.verifyToken only validates signature, not issuer
      // The token will still verify because the JWT_SECRET is the same
      // However, we can verify that the issuer in the token doesn't match the new configuration
      const verifiedPayload = newAuthService.verifyToken(session.access_token)
      expect(verifiedPayload.iss).toBe('https://test-integration.supabase.co')
      expect(verifiedPayload.iss).not.toBe(process.env.SUPABASE_URL)
      
      // In a real application, the auth-helpers.ts verifyJwtToken function
      // would reject this token due to issuer mismatch
    })

    it('should handle token expiration correctly', async () => {
      // Generate token
      const mockUser = {
        id: 'expiry-test-user',
        email: 'expiry@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_super_admin: false,
      }

      const projectRef = 'expiry-project'

      const createSessionMethod = (authService as any).createSession.bind(authService)
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      }

      const session = await createSessionMethod(mockClient, projectRef, mockUser)

      // Verify token is valid now
      const verifiedPayload = authService.verifyToken(session.access_token)
      expect(verifiedPayload).toBeDefined()

      // Create an expired token manually
      const expiredToken = jwt.sign(
        {
          sub: mockUser.id,
          email: mockUser.email,
          project_ref: projectRef,
          role: 'authenticated',
          aal: 'aal1',
          session_id: 'test-session',
        },
        process.env.JWT_SECRET!,
        {
          expiresIn: -1, // Already expired
          issuer: process.env.SUPABASE_URL,
        }
      )

      // Verify expired token is rejected
      expect(() => {
        authService.verifyToken(expiredToken)
      }).toThrow('Invalid or expired token')
    })
  })

  describe('Different Environment Configurations', () => {
    it('should work with SUPABASE_URL configuration', async () => {
      // Configure with SUPABASE_URL only
      process.env.SUPABASE_URL = 'https://supabase-only.supabase.co'
      delete process.env.API_EXTERNAL_URL
      process.env.JWT_SECRET = 'test-secret'

      const service = new AuthServiceAdapter()

      const mockUser = {
        id: 'supabase-url-user',
        email: 'supabase@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_super_admin: false,
      }

      const createSessionMethod = (service as any).createSession.bind(service)
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      }

      const session = await createSessionMethod(mockClient, 'test-project', mockUser)

      // Verify issuer is from SUPABASE_URL
      const decodedToken = jwt.decode(session.access_token) as any
      expect(decodedToken.iss).toBe('https://supabase-only.supabase.co')

      // Verify token can be verified
      const verifiedPayload = service.verifyToken(session.access_token)
      expect(verifiedPayload.iss).toBe('https://supabase-only.supabase.co')
    })

    it('should work with API_EXTERNAL_URL configuration', async () => {
      // Configure with API_EXTERNAL_URL only
      delete process.env.SUPABASE_URL
      process.env.API_EXTERNAL_URL = 'https://api-external-only.example.com'
      process.env.JWT_SECRET = 'test-secret'

      const service = new AuthServiceAdapter()

      const mockUser = {
        id: 'api-external-user',
        email: 'api@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_super_admin: false,
      }

      const createSessionMethod = (service as any).createSession.bind(service)
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      }

      const session = await createSessionMethod(mockClient, 'test-project', mockUser)

      // Verify issuer is from API_EXTERNAL_URL
      const decodedToken = jwt.decode(session.access_token) as any
      expect(decodedToken.iss).toBe('https://api-external-only.example.com')

      // Verify token can be verified
      const verifiedPayload = service.verifyToken(session.access_token)
      expect(verifiedPayload.iss).toBe('https://api-external-only.example.com')
    })

    it('should prefer SUPABASE_URL when both are configured', async () => {
      // Configure both
      process.env.SUPABASE_URL = 'https://preferred.supabase.co'
      process.env.API_EXTERNAL_URL = 'https://fallback.example.com'
      process.env.JWT_SECRET = 'test-secret'

      const service = new AuthServiceAdapter()

      const mockUser = {
        id: 'both-configured-user',
        email: 'both@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_super_admin: false,
      }

      const createSessionMethod = (service as any).createSession.bind(service)
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      }

      const session = await createSessionMethod(mockClient, 'test-project', mockUser)

      // Verify SUPABASE_URL is preferred
      const decodedToken = jwt.decode(session.access_token) as any
      expect(decodedToken.iss).toBe('https://preferred.supabase.co')
      expect(decodedToken.iss).not.toBe('https://fallback.example.com')
    })

    it('should work without issuer when neither is configured', async () => {
      // Configure without issuer
      delete process.env.SUPABASE_URL
      delete process.env.API_EXTERNAL_URL
      process.env.JWT_SECRET = 'test-secret'

      const service = new AuthServiceAdapter()

      const mockUser = {
        id: 'no-issuer-user',
        email: 'noissuer@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_super_admin: false,
      }

      const createSessionMethod = (service as any).createSession.bind(service)
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      }

      const session = await createSessionMethod(mockClient, 'test-project', mockUser)

      // Verify token has no issuer
      const decodedToken = jwt.decode(session.access_token) as any
      expect(decodedToken.iss).toBeUndefined()

      // Verify token can still be verified (backward compatibility)
      const verifiedPayload = service.verifyToken(session.access_token)
      expect(verifiedPayload.sub).toBe(mockUser.id)
    })

    it('should handle environment variable changes dynamically', async () => {
      // First configuration
      process.env.SUPABASE_URL = 'https://first-config.supabase.co'
      process.env.JWT_SECRET = 'test-secret'

      const service1 = new AuthServiceAdapter()

      const mockUser = {
        id: 'dynamic-config-user',
        email: 'dynamic@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_super_admin: false,
      }

      const createSessionMethod1 = (service1 as any).createSession.bind(service1)
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      }

      const session1 = await createSessionMethod1(mockClient, 'test-project', mockUser)
      const decodedToken1 = jwt.decode(session1.access_token) as any
      expect(decodedToken1.iss).toBe('https://first-config.supabase.co')

      // Change configuration
      process.env.SUPABASE_URL = 'https://second-config.supabase.co'

      // Create new service instance (simulating restart)
      const service2 = new AuthServiceAdapter()
      const createSessionMethod2 = (service2 as any).createSession.bind(service2)

      const session2 = await createSessionMethod2(mockClient, 'test-project', mockUser)
      const decodedToken2 = jwt.decode(session2.access_token) as any
      expect(decodedToken2.iss).toBe('https://second-config.supabase.co')

      // Verify tokens have different issuers
      expect(decodedToken1.iss).not.toBe(decodedToken2.iss)
    })
  })

  describe('Multiple Projects', () => {
    it('should generate unique tokens for different projects', async () => {
      process.env.SUPABASE_URL = 'https://multi-project.supabase.co'
      process.env.JWT_SECRET = 'test-secret'

      const service = new AuthServiceAdapter()

      const mockUser = {
        id: 'multi-project-user',
        email: 'multiproject@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_super_admin: false,
      }

      const createSessionMethod = (service as any).createSession.bind(service)
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      }

      // Generate tokens for different projects
      const session1 = await createSessionMethod(mockClient, 'project-alpha', mockUser)
      const session2 = await createSessionMethod(mockClient, 'project-beta', mockUser)
      const session3 = await createSessionMethod(mockClient, 'project-gamma', mockUser)

      // Decode all tokens
      const token1 = jwt.decode(session1.access_token) as any
      const token2 = jwt.decode(session2.access_token) as any
      const token3 = jwt.decode(session3.access_token) as any

      // Verify all have same issuer
      expect(token1.iss).toBe('https://multi-project.supabase.co')
      expect(token2.iss).toBe('https://multi-project.supabase.co')
      expect(token3.iss).toBe('https://multi-project.supabase.co')

      // Verify different project refs
      expect(token1.project_ref).toBe('project-alpha')
      expect(token2.project_ref).toBe('project-beta')
      expect(token3.project_ref).toBe('project-gamma')

      // Verify different session IDs
      expect(token1.session_id).not.toBe(token2.session_id)
      expect(token2.session_id).not.toBe(token3.session_id)
      expect(token1.session_id).not.toBe(token3.session_id)

      // Verify all tokens can be verified
      const verified1 = service.verifyToken(session1.access_token)
      const verified2 = service.verifyToken(session2.access_token)
      const verified3 = service.verifyToken(session3.access_token)

      expect(verified1.project_ref).toBe('project-alpha')
      expect(verified2.project_ref).toBe('project-beta')
      expect(verified3.project_ref).toBe('project-gamma')
    })

    it('should handle different users across multiple projects', async () => {
      process.env.SUPABASE_URL = 'https://multi-user-project.supabase.co'
      process.env.JWT_SECRET = 'test-secret'

      const service = new AuthServiceAdapter()

      const users = [
        {
          id: 'user-001',
          email: 'user1@example.com',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_super_admin: false,
        },
        {
          id: 'user-002',
          email: 'user2@example.com',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_super_admin: true,
        },
        {
          id: 'user-003',
          email: 'user3@example.com',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_super_admin: false,
        },
      ]

      const projects = ['project-x', 'project-y', 'project-z']

      const createSessionMethod = (service as any).createSession.bind(service)
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      }

      // Generate tokens for all combinations
      const tokens: any[] = []
      for (const user of users) {
        for (const project of projects) {
          const session = await createSessionMethod(mockClient, project, user)
          const decoded = jwt.decode(session.access_token) as any
          tokens.push({
            userId: user.id,
            projectRef: project,
            token: session.access_token,
            decoded,
          })
        }
      }

      // Verify all tokens have correct issuer
      tokens.forEach((t) => {
        expect(t.decoded.iss).toBe('https://multi-user-project.supabase.co')
      })

      // Verify all tokens have correct user and project mapping
      tokens.forEach((t) => {
        expect(t.decoded.sub).toBe(t.userId)
        expect(t.decoded.project_ref).toBe(t.projectRef)
      })

      // Verify all tokens can be verified
      tokens.forEach((t) => {
        const verified = service.verifyToken(t.token)
        expect(verified.sub).toBe(t.userId)
        expect(verified.project_ref).toBe(t.projectRef)
      })
    })

    it('should maintain project isolation with issuer claim', async () => {
      process.env.SUPABASE_URL = 'https://project-isolation.supabase.co'
      process.env.JWT_SECRET = 'test-secret'

      const service = new AuthServiceAdapter()

      const mockUser = {
        id: 'isolation-test-user',
        email: 'isolation@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_super_admin: false,
      }

      const createSessionMethod = (service as any).createSession.bind(service)
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      }

      // Generate token for project A
      const sessionA = await createSessionMethod(mockClient, 'project-a', mockUser)
      const tokenA = jwt.decode(sessionA.access_token) as any

      // Generate token for project B
      const sessionB = await createSessionMethod(mockClient, 'project-b', mockUser)
      const tokenB = jwt.decode(sessionB.access_token) as any

      // Verify both have same issuer (same environment)
      expect(tokenA.iss).toBe(tokenB.iss)

      // Verify different project refs
      expect(tokenA.project_ref).toBe('project-a')
      expect(tokenB.project_ref).toBe('project-b')

      // Verify both tokens are valid
      const verifiedA = service.verifyToken(sessionA.access_token)
      const verifiedB = service.verifyToken(sessionB.access_token)

      expect(verifiedA.project_ref).toBe('project-a')
      expect(verifiedB.project_ref).toBe('project-b')

      // Verify tokens are different (different session IDs)
      expect(sessionA.access_token).not.toBe(sessionB.access_token)
      expect(tokenA.session_id).not.toBe(tokenB.session_id)
    })
  })

  describe('Backward Compatibility Integration', () => {
    it('should maintain compatibility with existing JWT structure', async () => {
      process.env.SUPABASE_URL = 'https://backward-compat.supabase.co'
      process.env.JWT_SECRET = 'test-secret'

      const service = new AuthServiceAdapter()

      const mockUser = {
        id: 'compat-user',
        email: 'compat@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_super_admin: false,
      }

      const createSessionMethod = (service as any).createSession.bind(service)
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      }

      const session = await createSessionMethod(mockClient, 'compat-project', mockUser)
      const decoded = jwt.decode(session.access_token, { complete: true }) as any

      // Verify algorithm is still HS256
      expect(decoded.header.alg).toBe('HS256')

      // Verify all expected payload fields exist
      expect(decoded.payload.sub).toBe(mockUser.id)
      expect(decoded.payload.email).toBe(mockUser.email)
      expect(decoded.payload.project_ref).toBe('compat-project')
      expect(decoded.payload.role).toBe('authenticated')
      expect(decoded.payload.aal).toBe('aal1')
      expect(decoded.payload.session_id).toBeDefined()
      expect(decoded.payload.exp).toBeDefined()
      expect(decoded.payload.iat).toBeDefined()

      // Verify issuer is added (new field)
      expect(decoded.payload.iss).toBe('https://backward-compat.supabase.co')

      // Verify no unexpected fields
      const expectedFields = ['sub', 'email', 'project_ref', 'role', 'aal', 'session_id', 'exp', 'iat', 'iss']
      const actualFields = Object.keys(decoded.payload)
      expect(actualFields.sort()).toEqual(expectedFields.sort())
    })

    it('should verify tokens using same secret as generation', async () => {
      const testSecret = 'integration-test-secret-12345'
      process.env.SUPABASE_URL = 'https://secret-test.supabase.co'
      process.env.JWT_SECRET = testSecret

      const service = new AuthServiceAdapter()

      const mockUser = {
        id: 'secret-test-user',
        email: 'secret@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_super_admin: false,
      }

      const createSessionMethod = (service as any).createSession.bind(service)
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      }

      const session = await createSessionMethod(mockClient, 'secret-project', mockUser)

      // Verify token with same service (same secret)
      const verified = service.verifyToken(session.access_token)
      expect(verified.sub).toBe(mockUser.id)

      // Manually verify with jwt library using same secret
      const manualVerified = jwt.verify(session.access_token, testSecret, {
        algorithms: ['HS256'],
        issuer: 'https://secret-test.supabase.co',
      }) as any

      expect(manualVerified.sub).toBe(mockUser.id)
      expect(manualVerified.iss).toBe('https://secret-test.supabase.co')
    })
  })

  describe('Error Scenarios Integration', () => {
    it('should handle invalid tokens gracefully', async () => {
      process.env.SUPABASE_URL = 'https://error-test.supabase.co'
      process.env.JWT_SECRET = 'test-secret'

      const service = new AuthServiceAdapter()

      // Test various invalid tokens
      const invalidTokens = [
        'invalid-token',
        'not.a.valid.jwt',
        '',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
      ]

      invalidTokens.forEach((token) => {
        expect(() => {
          service.verifyToken(token)
        }).toThrow('Invalid or expired token')
      })
    })

    it('should handle token tampering detection', async () => {
      process.env.SUPABASE_URL = 'https://tamper-test.supabase.co'
      process.env.JWT_SECRET = 'test-secret'

      const service = new AuthServiceAdapter()

      const mockUser = {
        id: 'tamper-test-user',
        email: 'tamper@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_super_admin: false,
      }

      const createSessionMethod = (service as any).createSession.bind(service)
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      }

      const session = await createSessionMethod(mockClient, 'tamper-project', mockUser)

      // Tamper with the token by modifying the payload
      const parts = session.access_token.split('.')
      const tamperedPayload = Buffer.from(
        JSON.stringify({ sub: 'hacker-id', email: 'hacker@evil.com' })
      ).toString('base64url')
      const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`

      // Verify tampered token is rejected
      expect(() => {
        service.verifyToken(tamperedToken)
      }).toThrow('Invalid or expired token')
    })

    it('should handle missing environment configuration gracefully', async () => {
      // Clear all environment variables
      delete process.env.SUPABASE_URL
      delete process.env.API_EXTERNAL_URL
      process.env.JWT_SECRET = 'test-secret'

      // Should not throw during initialization
      expect(() => {
        new AuthServiceAdapter()
      }).not.toThrow()

      const service = new AuthServiceAdapter()

      const mockUser = {
        id: 'no-env-user',
        email: 'noenv@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_super_admin: false,
      }

      const createSessionMethod = (service as any).createSession.bind(service)
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      }

      // Should still generate token (without issuer)
      const session = await createSessionMethod(mockClient, 'no-env-project', mockUser)
      expect(session.access_token).toBeDefined()

      // Token should be verifiable
      const verified = service.verifyToken(session.access_token)
      expect(verified.sub).toBe(mockUser.id)
    })
  })

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent token generations', async () => {
      process.env.SUPABASE_URL = 'https://concurrent-test.supabase.co'
      process.env.JWT_SECRET = 'test-secret'

      const service = new AuthServiceAdapter()

      const createSessionMethod = (service as any).createSession.bind(service)
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      }

      // Generate multiple tokens concurrently
      const promises = Array.from({ length: 10 }, (_, i) => {
        const mockUser = {
          id: `concurrent-user-${i}`,
          email: `user${i}@example.com`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_super_admin: false,
        }
        return createSessionMethod(mockClient, `project-${i}`, mockUser)
      })

      const sessions = await Promise.all(promises)

      // Verify all tokens were generated
      expect(sessions).toHaveLength(10)

      // Verify all tokens are unique
      const tokens = sessions.map((s) => s.access_token)
      const uniqueTokens = new Set(tokens)
      expect(uniqueTokens.size).toBe(10)

      // Verify all tokens can be verified
      sessions.forEach((session, i) => {
        const verified = service.verifyToken(session.access_token)
        expect(verified.sub).toBe(`concurrent-user-${i}`)
        expect(verified.project_ref).toBe(`project-${i}`)
        expect(verified.iss).toBe('https://concurrent-test.supabase.co')
      })
    })
  })
})
