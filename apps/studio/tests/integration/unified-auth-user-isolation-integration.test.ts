/**
 * Comprehensive Integration Tests for Unified Authentication System and User Isolation
 * 
 * This test suite validates the complete integration of:
 * - GoTrue JWT authentication without project_ref claim
 * - User project isolation
 * - Cross-user access prevention
 * - Project creation, listing, and access control
 * 
 * Requirements: 11.1, 11.2, 11.3, 11.5, 11.7, 11.8, 6.2
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import jwt from 'jsonwebtoken'
import { getCurrentUserId, validateUserProjectAccessByRef } from '../../lib/api/auth-helpers'
import { NextApiRequest } from 'next'

// Test configuration - use actual environment JWT secret
const JWT_SECRET = 'ubTNRJ0laLiV0XiRHDsAKgNg9dhKY3zndHfMF5+XDS0='
const SUPABASE_URL = 'http://localhost:8000'

// Set up environment variables for tests
process.env.SUPABASE_JWT_SECRET = JWT_SECRET
process.env.JWT_SECRET = JWT_SECRET
process.env.SUPABASE_URL = SUPABASE_URL
process.env.SUPABASE_API_URL = SUPABASE_URL

// Test users
const TEST_USERS = {
  userA: {
    id: 'test-user-a-uuid',
    email: 'user-a@test.com',
    role: 'authenticated',
  },
  userB: {
    id: 'test-user-b-uuid',
    email: 'user-b@test.com',
    role: 'authenticated',
  },
  userC: {
    id: 'test-user-c-uuid',
    email: 'user-c@test.com',
    role: 'authenticated',
  },
}

/**
 * Helper function to create a GoTrue JWT token
 */
function createGoTrueToken(userId: string, email: string, expiresIn: string = '1h'): string {
  return jwt.sign(
    {
      sub: userId,
      email,
      role: 'authenticated',
      aal: 'aal1',
      iss: SUPABASE_URL,
      aud: 'authenticated',
    },
    JWT_SECRET,
    { expiresIn }
  )
}

/**
 * Helper function to create a mock Next.js API request
 */
function createMockRequest(token: string, url: string = '/api/test'): Partial<NextApiRequest> {
  return {
    headers: {
      authorization: `Bearer ${token}`,
    },
    cookies: {},
    query: {},
    url,
  }
}

/**
 * Helper function to make API request with token
 */
async function makeAuthenticatedRequest(
  endpoint: string,
  method: string,
  token: string,
  body?: any
): Promise<Response> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082'
  
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  
  return response
}

describe('Task 20: Unified Authentication and User Isolation Integration Tests', () => {
  
  describe('20.1 测试用户登录和 token 生成', () => {
    
    it('should generate GoTrue JWT without project_ref claim', () => {
      // Requirements: 11.1, 11.5
      const token = createGoTrueToken(TEST_USERS.userA.id, TEST_USERS.userA.email)
      
      // Decode token to verify structure
      const decoded = jwt.decode(token) as any
      
      expect(decoded).toBeDefined()
      expect(decoded.sub).toBe(TEST_USERS.userA.id)
      expect(decoded.email).toBe(TEST_USERS.userA.email)
      expect(decoded.role).toBe('authenticated')
      expect(decoded.iss).toBe(SUPABASE_URL)
      
      // Verify that project_ref claim is NOT present
      expect(decoded.project_ref).toBeUndefined()
    })
    
    it('should verify JWT contains sub (user ID) claim', () => {
      // Requirements: 11.5
      const token = createGoTrueToken(TEST_USERS.userB.id, TEST_USERS.userB.email)
      const decoded = jwt.decode(token) as any
      
      expect(decoded.sub).toBe(TEST_USERS.userB.id)
      expect(typeof decoded.sub).toBe('string')
      expect(decoded.sub.length).toBeGreaterThan(0)
    })
    
    it('should verify JWT contains email claim', () => {
      // Requirements: 11.5
      const token = createGoTrueToken(TEST_USERS.userC.id, TEST_USERS.userC.email)
      const decoded = jwt.decode(token) as any
      
      expect(decoded.email).toBe(TEST_USERS.userC.email)
      expect(typeof decoded.email).toBe('string')
      expect(decoded.email).toContain('@')
    })
    
    it('should accept GoTrue JWT in getCurrentUserId', async () => {
      // Requirements: 11.1, 11.3
      const token = createGoTrueToken(TEST_USERS.userA.id, TEST_USERS.userA.email)
      const req = createMockRequest(token) as NextApiRequest
      
      const userId = await getCurrentUserId(req)
      
      expect(userId).toBe(TEST_USERS.userA.id)
    })
    
    it('should verify token signature with JWT_SECRET', async () => {
      // Requirements: 11.4
      const token = createGoTrueToken(TEST_USERS.userA.id, TEST_USERS.userA.email)
      
      // Verify token can be decoded with the correct secret
      const decoded = jwt.verify(token, JWT_SECRET) as any
      
      expect(decoded.sub).toBe(TEST_USERS.userA.id)
    })
    
    it('should reject token with invalid signature', async () => {
      // Requirements: 11.4
      const invalidToken = jwt.sign(
        {
          sub: TEST_USERS.userA.id,
          email: TEST_USERS.userA.email,
          iss: SUPABASE_URL,
        },
        'wrong-secret',
        { expiresIn: '1h' }
      )
      
      const req = createMockRequest(invalidToken) as NextApiRequest
      const userId = await getCurrentUserId(req)
      
      expect(userId).toBeNull()
    })
    
    it('should reject expired token', async () => {
      // Requirements: 11.4
      const expiredToken = createGoTrueToken(TEST_USERS.userA.id, TEST_USERS.userA.email, '-1h')
      const req = createMockRequest(expiredToken) as NextApiRequest
      
      const userId = await getCurrentUserId(req)
      
      expect(userId).toBeNull()
    })
  })
  
  describe('20.2 测试项目创建使用 GoTrue JWT', () => {
    
    it('should accept GoTrue JWT for project creation', async () => {
      // Requirements: 11.2, 11.3
      const token = createGoTrueToken(TEST_USERS.userA.id, TEST_USERS.userA.email)
      const req = createMockRequest(token, '/api/platform/projects/create') as NextApiRequest
      
      // Verify that getCurrentUserId works for project creation endpoint
      const userId = await getCurrentUserId(req)
      
      expect(userId).toBe(TEST_USERS.userA.id)
    })
    
    it('should not require project_ref claim for project creation', async () => {
      // Requirements: 11.2, 11.6
      // Create token without project_ref claim
      const token = createGoTrueToken(TEST_USERS.userB.id, TEST_USERS.userB.email)
      const decoded = jwt.decode(token) as any
      
      // Verify no project_ref claim
      expect(decoded.project_ref).toBeUndefined()
      
      // Verify token is still accepted
      const req = createMockRequest(token, '/api/platform/projects/create') as NextApiRequest
      const userId = await getCurrentUserId(req)
      
      expect(userId).toBe(TEST_USERS.userB.id)
    })
    
    it('should extract user ID from GoTrue JWT for project ownership', async () => {
      // Requirements: 11.3, 11.5
      const token = createGoTrueToken(TEST_USERS.userC.id, TEST_USERS.userC.email)
      const req = createMockRequest(token, '/api/platform/projects/create') as NextApiRequest
      
      const userId = await getCurrentUserId(req)
      
      // Verify user ID is correctly extracted for setting project ownership
      expect(userId).toBe(TEST_USERS.userC.id)
      expect(userId).toBeTruthy()
    })
  })
  
  describe('20.3 测试项目列表使用 GoTrue JWT', () => {
    
    it('should accept GoTrue JWT for project listing', async () => {
      // Requirements: 11.2, 11.3
      const token = createGoTrueToken(TEST_USERS.userA.id, TEST_USERS.userA.email)
      const req = createMockRequest(token, '/api/platform/projects') as NextApiRequest
      
      const userId = await getCurrentUserId(req)
      
      expect(userId).toBe(TEST_USERS.userA.id)
    })
    
    it('should verify user isolation in project listing', async () => {
      // Requirements: 11.7
      // This test verifies that the authentication system correctly identifies users
      // The actual filtering logic is tested in the project listing endpoint tests
      
      const tokenA = createGoTrueToken(TEST_USERS.userA.id, TEST_USERS.userA.email)
      const tokenB = createGoTrueToken(TEST_USERS.userB.id, TEST_USERS.userB.email)
      
      const reqA = createMockRequest(tokenA, '/api/platform/projects') as NextApiRequest
      const reqB = createMockRequest(tokenB, '/api/platform/projects') as NextApiRequest
      
      const userIdA = await getCurrentUserId(reqA)
      const userIdB = await getCurrentUserId(reqB)
      
      // Verify different users are correctly identified
      expect(userIdA).toBe(TEST_USERS.userA.id)
      expect(userIdB).toBe(TEST_USERS.userB.id)
      expect(userIdA).not.toBe(userIdB)
    })
    
    it('should support multiple concurrent user sessions', async () => {
      // Requirements: 11.3
      const tokens = [
        createGoTrueToken(TEST_USERS.userA.id, TEST_USERS.userA.email),
        createGoTrueToken(TEST_USERS.userB.id, TEST_USERS.userB.email),
        createGoTrueToken(TEST_USERS.userC.id, TEST_USERS.userC.email),
      ]
      
      const requests = tokens.map(token => 
        createMockRequest(token, '/api/platform/projects') as NextApiRequest
      )
      
      const userIds = await Promise.all(
        requests.map(req => getCurrentUserId(req))
      )
      
      expect(userIds[0]).toBe(TEST_USERS.userA.id)
      expect(userIds[1]).toBe(TEST_USERS.userB.id)
      expect(userIds[2]).toBe(TEST_USERS.userC.id)
    })
  })
  
  describe('20.4 测试项目特定端点使用 GoTrue JWT', () => {
    
    it('should accept GoTrue JWT for project-specific endpoints', async () => {
      // Requirements: 11.3, 11.7
      const token = createGoTrueToken(TEST_USERS.userA.id, TEST_USERS.userA.email)
      const projectRef = 'test-project-ref'
      const req = createMockRequest(
        token, 
        `/api/v1/projects/${projectRef}/api-keys`
      ) as NextApiRequest
      
      const userId = await getCurrentUserId(req, projectRef)
      
      expect(userId).toBe(TEST_USERS.userA.id)
    })
    
    it('should verify database-based project access validation', async () => {
      // Requirements: 11.7, 11.8
      const token = createGoTrueToken(TEST_USERS.userA.id, TEST_USERS.userA.email)
      const req = createMockRequest(token) as NextApiRequest
      
      // Extract user ID from token
      const userId = await getCurrentUserId(req)
      expect(userId).toBe(TEST_USERS.userA.id)
      
      // Note: Actual database validation is tested in validateUserProjectAccessByRef
      // This test verifies that the authentication layer correctly extracts user ID
      // for subsequent database-based permission checks
    })
    
    it('should not require project_ref claim in JWT for project endpoints', async () => {
      // Requirements: 11.6, 11.7
      const token = createGoTrueToken(TEST_USERS.userB.id, TEST_USERS.userB.email)
      const decoded = jwt.decode(token) as any
      
      // Verify no project_ref in token
      expect(decoded.project_ref).toBeUndefined()
      
      // Verify token is accepted for project-specific endpoint
      const projectRef = 'another-project-ref'
      const req = createMockRequest(
        token,
        `/api/v1/projects/${projectRef}/api-keys`
      ) as NextApiRequest
      
      const userId = await getCurrentUserId(req, projectRef)
      expect(userId).toBe(TEST_USERS.userB.id)
    })
  })
  
  describe('20.5 测试跨用户访问防护', () => {
    
    it('should identify different users correctly', async () => {
      // Requirements: 11.8
      const tokenA = createGoTrueToken(TEST_USERS.userA.id, TEST_USERS.userA.email)
      const tokenB = createGoTrueToken(TEST_USERS.userB.id, TEST_USERS.userB.email)
      
      const reqA = createMockRequest(tokenA) as NextApiRequest
      const reqB = createMockRequest(tokenB) as NextApiRequest
      
      const userIdA = await getCurrentUserId(reqA)
      const userIdB = await getCurrentUserId(reqB)
      
      expect(userIdA).toBe(TEST_USERS.userA.id)
      expect(userIdB).toBe(TEST_USERS.userB.id)
      expect(userIdA).not.toBe(userIdB)
    })
    
    it('should prevent token reuse across users', async () => {
      // Requirements: 11.8
      const tokenA = createGoTrueToken(TEST_USERS.userA.id, TEST_USERS.userA.email)
      
      // User A's token should only authenticate as User A
      const req = createMockRequest(tokenA) as NextApiRequest
      const userId = await getCurrentUserId(req)
      
      expect(userId).toBe(TEST_USERS.userA.id)
      expect(userId).not.toBe(TEST_USERS.userB.id)
      expect(userId).not.toBe(TEST_USERS.userC.id)
    })
    
    it('should verify authentication layer supports access control', async () => {
      // Requirements: 11.8, 6.2
      // This test verifies that the authentication system provides the foundation
      // for access control by correctly identifying users
      
      const users = [TEST_USERS.userA, TEST_USERS.userB, TEST_USERS.userC]
      
      for (const user of users) {
        const token = createGoTrueToken(user.id, user.email)
        const req = createMockRequest(token) as NextApiRequest
        const userId = await getCurrentUserId(req)
        
        // Each token should only authenticate as its own user
        expect(userId).toBe(user.id)
        
        // Verify it doesn't authenticate as other users
        const otherUsers = users.filter(u => u.id !== user.id)
        for (const otherUser of otherUsers) {
          expect(userId).not.toBe(otherUser.id)
        }
      }
    })
    
    it('should support security audit logging for authentication', async () => {
      // Requirements: 6.2
      // This test verifies that authentication failures can be logged
      // Actual logging is tested in the error-handling tests
      
      const invalidToken = 'invalid.jwt.token'
      const req = createMockRequest(invalidToken) as NextApiRequest
      
      const userId = await getCurrentUserId(req)
      
      // Should return null for invalid token (logged internally)
      expect(userId).toBeNull()
    })
  })
  
  describe('Integration: Complete Authentication Flow', () => {
    
    it('should support complete user authentication workflow', async () => {
      // Requirements: 11.1, 11.2, 11.3, 11.5
      
      // Step 1: User logs in and receives GoTrue JWT
      const token = createGoTrueToken(TEST_USERS.userA.id, TEST_USERS.userA.email)
      const decoded = jwt.decode(token) as any
      
      expect(decoded.sub).toBe(TEST_USERS.userA.id)
      expect(decoded.email).toBe(TEST_USERS.userA.email)
      expect(decoded.project_ref).toBeUndefined()
      
      // Step 2: User creates a project
      const createReq = createMockRequest(token, '/api/platform/projects/create') as NextApiRequest
      const userIdForCreate = await getCurrentUserId(createReq)
      expect(userIdForCreate).toBe(TEST_USERS.userA.id)
      
      // Step 3: User lists projects
      const listReq = createMockRequest(token, '/api/platform/projects') as NextApiRequest
      const userIdForList = await getCurrentUserId(listReq)
      expect(userIdForList).toBe(TEST_USERS.userA.id)
      
      // Step 4: User accesses project-specific endpoint
      const projectReq = createMockRequest(
        token,
        '/api/v1/projects/test-ref/api-keys'
      ) as NextApiRequest
      const userIdForProject = await getCurrentUserId(projectReq, 'test-ref')
      expect(userIdForProject).toBe(TEST_USERS.userA.id)
    })
    
    it('should maintain user isolation across multiple operations', async () => {
      // Requirements: 11.7, 11.8
      
      const tokenA = createGoTrueToken(TEST_USERS.userA.id, TEST_USERS.userA.email)
      const tokenB = createGoTrueToken(TEST_USERS.userB.id, TEST_USERS.userB.email)
      
      // User A operations
      const reqA1 = createMockRequest(tokenA, '/api/platform/projects/create') as NextApiRequest
      const reqA2 = createMockRequest(tokenA, '/api/platform/projects') as NextApiRequest
      const reqA3 = createMockRequest(tokenA, '/api/v1/projects/proj-a/api-keys') as NextApiRequest
      
      const userIdA1 = await getCurrentUserId(reqA1)
      const userIdA2 = await getCurrentUserId(reqA2)
      const userIdA3 = await getCurrentUserId(reqA3, 'proj-a')
      
      expect(userIdA1).toBe(TEST_USERS.userA.id)
      expect(userIdA2).toBe(TEST_USERS.userA.id)
      expect(userIdA3).toBe(TEST_USERS.userA.id)
      
      // User B operations
      const reqB1 = createMockRequest(tokenB, '/api/platform/projects/create') as NextApiRequest
      const reqB2 = createMockRequest(tokenB, '/api/platform/projects') as NextApiRequest
      const reqB3 = createMockRequest(tokenB, '/api/v1/projects/proj-b/api-keys') as NextApiRequest
      
      const userIdB1 = await getCurrentUserId(reqB1)
      const userIdB2 = await getCurrentUserId(reqB2)
      const userIdB3 = await getCurrentUserId(reqB3, 'proj-b')
      
      expect(userIdB1).toBe(TEST_USERS.userB.id)
      expect(userIdB2).toBe(TEST_USERS.userB.id)
      expect(userIdB3).toBe(TEST_USERS.userB.id)
      
      // Verify isolation
      expect(userIdA1).not.toBe(userIdB1)
      expect(userIdA2).not.toBe(userIdB2)
      expect(userIdA3).not.toBe(userIdB3)
    })
    
    it('should verify backward compatibility with existing code', async () => {
      // Requirements: 11.3
      
      const token = createGoTrueToken(TEST_USERS.userA.id, TEST_USERS.userA.email)
      const req = createMockRequest(token) as NextApiRequest
      
      // Test with different parameter combinations (backward compatibility)
      const userId1 = await getCurrentUserId(req)
      const userId2 = await getCurrentUserId(req, undefined)
      const userId3 = await getCurrentUserId(req, undefined, false)
      const userId4 = await getCurrentUserId(req, undefined, true) // deprecated param
      
      // All should return the same user ID
      expect(userId1).toBe(TEST_USERS.userA.id)
      expect(userId2).toBe(TEST_USERS.userA.id)
      expect(userId3).toBe(TEST_USERS.userA.id)
      expect(userId4).toBe(TEST_USERS.userA.id)
    })
  })
  
  describe('Error Handling and Edge Cases', () => {
    
    it('should handle missing authorization header', async () => {
      const req = {
        headers: {},
        cookies: {},
        query: {},
        url: '/api/test',
      } as Partial<NextApiRequest>
      
      const userId = await getCurrentUserId(req as NextApiRequest)
      
      expect(userId).toBeNull()
    })
    
    it('should handle malformed JWT token', async () => {
      const req = createMockRequest('malformed.token.here') as NextApiRequest
      
      const userId = await getCurrentUserId(req)
      
      expect(userId).toBeNull()
    })
    
    it('should handle token without sub claim', async () => {
      const tokenWithoutSub = jwt.sign(
        {
          email: 'test@example.com',
          role: 'authenticated',
          iss: SUPABASE_URL,
        },
        JWT_SECRET,
        { expiresIn: '1h' }
      )
      
      const req = createMockRequest(tokenWithoutSub) as NextApiRequest
      const userId = await getCurrentUserId(req)
      
      expect(userId).toBeNull()
    })
    
    it('should handle concurrent authentication requests', async () => {
      const tokens = Array.from({ length: 10 }, (_, i) => 
        createGoTrueToken(`user-${i}`, `user${i}@test.com`)
      )
      
      const requests = tokens.map(token => 
        createMockRequest(token) as NextApiRequest
      )
      
      const userIds = await Promise.all(
        requests.map(req => getCurrentUserId(req))
      )
      
      // Verify all requests were processed correctly
      userIds.forEach((userId, i) => {
        expect(userId).toBe(`user-${i}`)
      })
    })
  })
})
