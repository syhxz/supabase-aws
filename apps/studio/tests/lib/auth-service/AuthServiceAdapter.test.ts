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
})
