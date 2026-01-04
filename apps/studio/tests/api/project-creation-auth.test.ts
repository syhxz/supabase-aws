/**
 * Tests for project creation endpoint authentication
 * Validates that GoTrue JWT tokens without project_ref claim are accepted
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextApiRequest } from 'next'
import jwt from 'jsonwebtoken'
import { getCurrentUserId } from '../../lib/api/auth-helpers'

describe('Project Creation Authentication', () => {
  const JWT_SECRET = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET || 'test-secret'
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.SUPABASE_API_URL || 'http://localhost:54321'
  
  // Set environment variables for tests
  beforeEach(() => {
    process.env.SUPABASE_JWT_SECRET = JWT_SECRET
    process.env.SUPABASE_URL = SUPABASE_URL
  })
  
  // Helper to create a mock request with JWT token
  function createMockRequest(token: string): Partial<NextApiRequest> {
    return {
      headers: {
        authorization: `Bearer ${token}`,
      },
      cookies: {},
      url: '/api/platform/projects/create',
      method: 'POST',
    } as Partial<NextApiRequest>
  }
  
  describe('GoTrue JWT without project_ref', () => {
    it('should accept GoTrue JWT with only user identity claims', async () => {
      // Create a GoTrue JWT without project_ref claim
      const goTrueToken = jwt.sign(
        {
          sub: 'test-user-123',
          email: 'test@example.com',
          iss: SUPABASE_URL,
          aud: 'authenticated',
          role: 'authenticated',
        },
        JWT_SECRET,
        { algorithm: 'HS256' }
      )
      
      const req = createMockRequest(goTrueToken) as NextApiRequest
      
      // Should successfully extract user ID without requiring project_ref
      const userId = await getCurrentUserId(req, undefined, false)
      
      expect(userId).toBe('test-user-123')
    })
    
    it('should accept GoTrue JWT for project creation even without project_ref', async () => {
      // Create a GoTrue JWT without project_ref claim
      const goTrueToken = jwt.sign(
        {
          sub: 'new-user-456',
          email: 'newuser@example.com',
          iss: SUPABASE_URL,
          aud: 'authenticated',
          role: 'authenticated',
        },
        JWT_SECRET,
        { algorithm: 'HS256' }
      )
      
      const req = createMockRequest(goTrueToken) as NextApiRequest
      
      // Should successfully extract user ID for project creation
      const userId = await getCurrentUserId(req, undefined, false)
      
      expect(userId).toBe('new-user-456')
    })
    
    it('should reject token when project_ref is explicitly required but missing', async () => {
      // Create a GoTrue JWT without project_ref claim
      const goTrueToken = jwt.sign(
        {
          sub: 'test-user-789',
          email: 'test@example.com',
          iss: SUPABASE_URL,
          aud: 'authenticated',
          role: 'authenticated',
        },
        JWT_SECRET,
        { algorithm: 'HS256' }
      )
      
      const req = createMockRequest(goTrueToken) as NextApiRequest
      
      // Should reject when project_ref is explicitly required
      const userId = await getCurrentUserId(req, undefined, true)
      
      // When requireProjectRef is true, tokens without project_ref should be rejected
      expect(userId).toBeNull()
    })
  })
  
  describe('Project-specific JWT with project_ref', () => {
    it('should accept project-specific JWT with project_ref claim', async () => {
      // Create a project-specific JWT with project_ref claim
      const projectToken = jwt.sign(
        {
          sub: 'test-user-123',
          email: 'test@example.com',
          project_ref: 'test-project-ref',
          iss: SUPABASE_URL,
          aud: 'authenticated',
          role: 'authenticated',
        },
        JWT_SECRET,
        { algorithm: 'HS256' }
      )
      
      const req = createMockRequest(projectToken) as NextApiRequest
      
      // Should successfully extract user ID
      const userId = await getCurrentUserId(req, 'test-project-ref', false)
      
      expect(userId).toBe('test-user-123')
    })
  })
  
  describe('Invalid tokens', () => {
    it('should reject token with invalid signature', async () => {
      // Create a token with wrong secret
      const invalidToken = jwt.sign(
        {
          sub: 'test-user-123',
          email: 'test@example.com',
          iss: SUPABASE_URL,
        },
        'wrong-secret',
        { algorithm: 'HS256' }
      )
      
      const req = createMockRequest(invalidToken) as NextApiRequest
      
      const userId = await getCurrentUserId(req, undefined, false)
      
      expect(userId).toBeNull()
    })
    
    it('should reject expired token', async () => {
      // Create an expired token
      const expiredToken = jwt.sign(
        {
          sub: 'test-user-123',
          email: 'test@example.com',
          iss: SUPABASE_URL,
          exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
        },
        JWT_SECRET,
        { algorithm: 'HS256' }
      )
      
      const req = createMockRequest(expiredToken) as NextApiRequest
      
      const userId = await getCurrentUserId(req, undefined, false)
      
      expect(userId).toBeNull()
    })
    
    it('should reject token without sub claim', async () => {
      // Create a token without sub claim
      const noSubToken = jwt.sign(
        {
          email: 'test@example.com',
          iss: SUPABASE_URL,
        },
        JWT_SECRET,
        { algorithm: 'HS256' }
      )
      
      const req = createMockRequest(noSubToken) as NextApiRequest
      
      const userId = await getCurrentUserId(req, undefined, false)
      
      expect(userId).toBeNull()
    })
  })
})
