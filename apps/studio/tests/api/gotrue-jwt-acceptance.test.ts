/**
 * Tests for GoTrue JWT acceptance without project_ref claim
 * Validates that the unified authentication system accepts GoTrue tokens
 * 
 * Requirements: 11.1, 11.2, 11.3, 11.5, 11.6
 */

import { NextApiRequest } from 'next'
import jwt from 'jsonwebtoken'
import { getCurrentUserId, isAuthenticated, requireAuthentication } from '../../lib/api/auth-helpers'

// Mock environment variables
const JWT_SECRET = 'test-jwt-secret-for-gotrue-acceptance'
const SUPABASE_URL = 'https://test.supabase.co'

// Set up environment
process.env.JWT_SECRET = JWT_SECRET
process.env.SUPABASE_JWT_SECRET = JWT_SECRET
process.env.SUPABASE_URL = SUPABASE_URL

/**
 * Create a mock Next.js API request with JWT token
 */
function createMockRequest(token: string): Partial<NextApiRequest> {
  return {
    headers: {
      authorization: `Bearer ${token}`,
    },
    cookies: {},
    query: {},
    url: '/api/test',
  }
}

describe('GoTrue JWT Acceptance Tests', () => {
  
  describe('GoTrue JWT without project_ref claim', () => {
    
    it('should accept GoTrue JWT with only user identity claims', async () => {
      // Create a GoTrue JWT without project_ref claim (standard GoTrue format)
      const goTrueToken = jwt.sign(
        {
          sub: 'gotrue-user-123',
          email: 'gotrue@example.com',
          role: 'authenticated',
          aal: 'aal1',
          iss: SUPABASE_URL,
          aud: 'authenticated',
        },
        JWT_SECRET,
        { expiresIn: '1h' }
      )
      
      const req = createMockRequest(goTrueToken) as NextApiRequest
      
      // Should successfully extract user ID without requiring project_ref
      const userId = await getCurrentUserId(req)
      
      expect(userId).toBe('gotrue-user-123')
    })
    
    it('should accept GoTrue JWT even when projectRef parameter is provided', async () => {
      // Create a GoTrue JWT without project_ref claim
      const goTrueToken = jwt.sign(
        {
          sub: 'gotrue-user-456',
          email: 'user@example.com',
          role: 'authenticated',
          iss: SUPABASE_URL,
        },
        JWT_SECRET,
        { expiresIn: '1h' }
      )
      
      const req = createMockRequest(goTrueToken) as NextApiRequest
      
      // Should accept token even when projectRef is provided
      // (projectRef is used for project-specific secret lookup, not for validation)
      const userId = await getCurrentUserId(req, 'some-project-ref')
      
      expect(userId).toBe('gotrue-user-456')
    })
    
    it('should accept GoTrue JWT with requireProjectRef=true (deprecated parameter)', async () => {
      // Create a GoTrue JWT without project_ref claim
      const goTrueToken = jwt.sign(
        {
          sub: 'gotrue-user-789',
          email: 'test@example.com',
          role: 'authenticated',
          iss: SUPABASE_URL,
        },
        JWT_SECRET,
        { expiresIn: '1h' }
      )
      
      const req = createMockRequest(goTrueToken) as NextApiRequest
      
      // Should accept token even when requireProjectRef=true
      // (this parameter is now deprecated and ignored)
      const userId = await getCurrentUserId(req, undefined, true)
      
      expect(userId).toBe('gotrue-user-789')
    })
    
    it('should work with isAuthenticated helper', async () => {
      const goTrueToken = jwt.sign(
        {
          sub: 'gotrue-user-abc',
          email: 'auth@example.com',
          iss: SUPABASE_URL,
        },
        JWT_SECRET,
        { expiresIn: '1h' }
      )
      
      const req = createMockRequest(goTrueToken) as NextApiRequest
      
      const authenticated = await isAuthenticated(req)
      
      expect(authenticated).toBe(true)
    })
    
    it('should work with requireAuthentication helper', async () => {
      const goTrueToken = jwt.sign(
        {
          sub: 'gotrue-user-xyz',
          email: 'required@example.com',
          iss: SUPABASE_URL,
        },
        JWT_SECRET,
        { expiresIn: '1h' }
      )
      
      const req = createMockRequest(goTrueToken) as NextApiRequest
      
      const userId = await requireAuthentication(req)
      
      expect(userId).toBe('gotrue-user-xyz')
    })
  })
  
  describe('Project-specific JWT with project_ref claim (legacy support)', () => {
    
    it('should still accept project-specific JWT with project_ref claim', async () => {
      // Create a project-specific JWT with project_ref claim (legacy format)
      const projectToken = jwt.sign(
        {
          sub: 'project-user-123',
          email: 'project@example.com',
          project_ref: 'legacy-project-ref',
          role: 'authenticated',
          iss: SUPABASE_URL,
        },
        JWT_SECRET,
        { expiresIn: '1h' }
      )
      
      const req = createMockRequest(projectToken) as NextApiRequest
      
      // Should accept token with project_ref claim (backward compatibility)
      const userId = await getCurrentUserId(req)
      
      expect(userId).toBe('project-user-123')
    })
    
    it('should not require project_ref claim even for project-specific endpoints', async () => {
      // Create a GoTrue JWT without project_ref
      const goTrueToken = jwt.sign(
        {
          sub: 'gotrue-user-project',
          email: 'project-endpoint@example.com',
          iss: SUPABASE_URL,
        },
        JWT_SECRET,
        { expiresIn: '1h' }
      )
      
      const req = createMockRequest(goTrueToken) as NextApiRequest
      req.url = '/api/v1/projects/my-project/api-keys'
      
      // Should accept GoTrue JWT for project-specific endpoint
      // Project access will be verified separately via database
      const userId = await getCurrentUserId(req, 'my-project')
      
      expect(userId).toBe('gotrue-user-project')
    })
  })
  
  describe('Invalid tokens', () => {
    
    it('should reject token with invalid signature', async () => {
      const invalidToken = jwt.sign(
        {
          sub: 'invalid-user',
          email: 'invalid@example.com',
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
      const expiredToken = jwt.sign(
        {
          sub: 'expired-user',
          email: 'expired@example.com',
          iss: SUPABASE_URL,
        },
        JWT_SECRET,
        { expiresIn: '-1h' } // Already expired
      )
      
      const req = createMockRequest(expiredToken) as NextApiRequest
      
      const userId = await getCurrentUserId(req)
      
      expect(userId).toBeNull()
    })
    
    it('should reject token without sub claim', async () => {
      const noSubToken = jwt.sign(
        {
          email: 'nosub@example.com',
          iss: SUPABASE_URL,
        },
        JWT_SECRET,
        { expiresIn: '1h' }
      )
      
      const req = createMockRequest(noSubToken) as NextApiRequest
      
      const userId = await getCurrentUserId(req)
      
      expect(userId).toBeNull()
    })
  })
  
  describe('Backward compatibility', () => {
    
    it('should maintain backward compatibility with existing code using requireProjectRef=false', async () => {
      const goTrueToken = jwt.sign(
        {
          sub: 'compat-user-1',
          email: 'compat@example.com',
          iss: SUPABASE_URL,
        },
        JWT_SECRET,
        { expiresIn: '1h' }
      )
      
      const req = createMockRequest(goTrueToken) as NextApiRequest
      
      // Existing code with requireProjectRef=false should continue to work
      const userId = await getCurrentUserId(req, undefined, false)
      
      expect(userId).toBe('compat-user-1')
    })
    
    it('should ignore requireProjectRef parameter (deprecated)', async () => {
      const goTrueToken = jwt.sign(
        {
          sub: 'compat-user-2',
          email: 'compat2@example.com',
          iss: SUPABASE_URL,
        },
        JWT_SECRET,
        { expiresIn: '1h' }
      )
      
      const req = createMockRequest(goTrueToken) as NextApiRequest
      
      // Both calls should return the same result
      const userId1 = await getCurrentUserId(req, undefined, false)
      const userId2 = await getCurrentUserId(req, undefined, true)
      
      expect(userId1).toBe('compat-user-2')
      expect(userId2).toBe('compat-user-2')
    })
  })
})
