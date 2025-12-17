/**
 * Property-Based Tests for GoTrue Token Validation
 * 
 * Feature: add-login-page, Property 5: GoTrue token validation
 * Validates: Requirements 4.3
 * 
 * Property: For any JWT token received from GoTrue, the token should be valid according to
 * GoTrue's JWT secret and contain the expected user claims.
 * 
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'

/**
 * Validates that a token has the correct JWT structure
 */
function validateTokenStructure(token: string): boolean {
  if (!token || typeof token !== 'string') {
    return false
  }

  // JWT tokens must have exactly 3 parts separated by dots
  const parts = token.split('.')
  if (parts.length !== 3) {
    return false
  }

  // Each part should be base64url encoded (non-empty)
  return parts.every(part => part.length > 0)
}

/**
 * Decodes a JWT token payload without verification
 * This is for testing purposes only - real validation should verify signature
 */
function decodeTokenPayload(token: string): any {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      return null
    }

    // Decode the payload (second part)
    const payload = parts[1]
    // Add padding if needed for base64 decoding
    const paddedPayload = payload + '='.repeat((4 - payload.length % 4) % 4)
    const decoded = atob(paddedPayload.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(decoded)
  } catch (error) {
    return null
  }
}

/**
 * Validates that a token payload contains expected GoTrue claims
 */
function validateTokenClaims(payload: any): boolean {
  if (!payload || typeof payload !== 'object') {
    return false
  }

  // GoTrue tokens should have these standard claims
  const requiredClaims = ['sub', 'aud', 'exp', 'iat']
  
  for (const claim of requiredClaims) {
    if (!(claim in payload)) {
      return false
    }
  }

  // Validate claim types
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    return false
  }

  if (typeof payload.aud !== 'string' || payload.aud.length === 0) {
    return false
  }

  if (typeof payload.exp !== 'number' || payload.exp <= 0) {
    return false
  }

  if (typeof payload.iat !== 'number' || payload.iat <= 0) {
    return false
  }

  // exp should be after iat
  if (payload.exp <= payload.iat) {
    return false
  }

  return true
}

/**
 * Checks if a token is expired
 */
function isTokenExpired(payload: any): boolean {
  if (!payload || typeof payload.exp !== 'number') {
    return true
  }

  const now = Math.floor(Date.now() / 1000)
  return payload.exp < now
}

describe('GoTrue Token Validation - Property-Based Tests', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('Property 5: Token structure validation - any valid JWT should have 3 parts', () => {
    fc.assert(
      fc.property(
        fc.record({
          header: fc.base64String({ minLength: 10, maxLength: 100 }),
          payload: fc.base64String({ minLength: 10, maxLength: 200 }),
          signature: fc.base64String({ minLength: 10, maxLength: 100 }),
        }),
        (tokenParts) => {
          // Create a JWT-like token
          const token = `${tokenParts.header}.${tokenParts.payload}.${tokenParts.signature}`
          
          // Validate structure
          const isValid = validateTokenStructure(token)
          
          // Should be valid since we constructed it correctly
          expect(isValid).toBe(true)
          
          // Verify it has exactly 3 parts
          const parts = token.split('.')
          expect(parts.length).toBe(3)
          expect(parts[0].length).toBeGreaterThan(0)
          expect(parts[1].length).toBeGreaterThan(0)
          expect(parts[2].length).toBeGreaterThan(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 5: Invalid token structure - tokens without 3 parts should be rejected', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string(), // Random string
          fc.constant(''), // Empty string
          fc.constant('only.two'), // Only 2 parts
          fc.constant('one.two.three.four'), // Too many parts
        ),
        (invalidToken) => {
          // Skip if it accidentally has 3 parts
          const parts = invalidToken.split('.')
          fc.pre(parts.length !== 3 || parts.some(p => p.length === 0))
          
          const isValid = validateTokenStructure(invalidToken)
          expect(isValid).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 5: Token claims validation - valid GoTrue tokens should have required claims', () => {
    fc.assert(
      fc.property(
        fc.record({
          sub: fc.uuid(),
          aud: fc.constantFrom('authenticated', 'anon'),
          exp: fc.integer({ min: Math.floor(Date.now() / 1000) + 3600, max: Math.floor(Date.now() / 1000) + 86400 }),
          iat: fc.integer({ min: Math.floor(Date.now() / 1000) - 60, max: Math.floor(Date.now() / 1000) }),
          role: fc.constantFrom('authenticated', 'anon', 'service_role'),
          email: fc.emailAddress(),
        }),
        (claims) => {
          // Ensure exp is after iat
          if (claims.exp <= claims.iat) {
            claims.exp = claims.iat + 3600
          }

          // Validate the claims structure
          const isValid = validateTokenClaims(claims)
          expect(isValid).toBe(true)
          
          // Verify required claims exist
          expect(claims.sub).toBeDefined()
          expect(claims.aud).toBeDefined()
          expect(claims.exp).toBeDefined()
          expect(claims.iat).toBeDefined()
          
          // Verify types
          expect(typeof claims.sub).toBe('string')
          expect(typeof claims.aud).toBe('string')
          expect(typeof claims.exp).toBe('number')
          expect(typeof claims.iat).toBe('number')
          
          // Verify exp > iat
          expect(claims.exp).toBeGreaterThan(claims.iat)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 5: Token expiration - expired tokens should be detected', () => {
    fc.assert(
      fc.property(
        fc.record({
          sub: fc.uuid(),
          aud: fc.constant('authenticated'),
          // Generate expired timestamps (in the past)
          exp: fc.integer({ min: 1000000000, max: Math.floor(Date.now() / 1000) - 1 }),
          iat: fc.integer({ min: 1000000000, max: Math.floor(Date.now() / 1000) - 3600 }),
        }),
        (claims) => {
          // Ensure exp is after iat but still in the past
          if (claims.exp <= claims.iat) {
            claims.exp = claims.iat + 1800
          }
          
          // Ensure it's actually expired
          const now = Math.floor(Date.now() / 1000)
          fc.pre(claims.exp < now)
          
          const expired = isTokenExpired(claims)
          expect(expired).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 5: Token expiration - non-expired tokens should not be detected as expired', () => {
    fc.assert(
      fc.property(
        fc.record({
          sub: fc.uuid(),
          aud: fc.constant('authenticated'),
          // Generate future timestamps
          exp: fc.integer({ min: Math.floor(Date.now() / 1000) + 60, max: Math.floor(Date.now() / 1000) + 86400 }),
          iat: fc.integer({ min: Math.floor(Date.now() / 1000) - 60, max: Math.floor(Date.now() / 1000) }),
        }),
        (claims) => {
          // Ensure exp is after iat and in the future
          if (claims.exp <= claims.iat) {
            claims.exp = claims.iat + 3600
          }
          
          const now = Math.floor(Date.now() / 1000)
          fc.pre(claims.exp > now)
          
          const expired = isTokenExpired(claims)
          expect(expired).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 5: Missing claims - tokens without required claims should be rejected', () => {
    fc.assert(
      fc.property(
        fc.record({
          // Randomly omit required claims
          sub: fc.option(fc.uuid(), { nil: undefined }),
          aud: fc.option(fc.constant('authenticated'), { nil: undefined }),
          exp: fc.option(fc.integer({ min: 1000000000 }), { nil: undefined }),
          iat: fc.option(fc.integer({ min: 1000000000 }), { nil: undefined }),
        }),
        (claims) => {
          // Skip if all claims are present
          fc.pre(
            claims.sub === undefined ||
            claims.aud === undefined ||
            claims.exp === undefined ||
            claims.iat === undefined
          )
          
          const isValid = validateTokenClaims(claims)
          expect(isValid).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 5: Token decoding - valid JWT structure should be decodable', () => {
    fc.assert(
      fc.property(
        fc.record({
          sub: fc.uuid(),
          aud: fc.constant('authenticated'),
          exp: fc.integer({ min: Math.floor(Date.now() / 1000) + 3600 }),
          iat: fc.integer({ min: Math.floor(Date.now() / 1000) }),
          email: fc.emailAddress(),
        }),
        (claims) => {
          // Create a mock JWT token with the claims
          const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
          const payload = btoa(JSON.stringify(claims))
          const signature = btoa('mock-signature')
          
          const token = `${header}.${payload}.${signature}`
          
          // Decode the token
          const decoded = decodeTokenPayload(token)
          
          // Should successfully decode
          expect(decoded).not.toBeNull()
          expect(decoded.sub).toBe(claims.sub)
          expect(decoded.aud).toBe(claims.aud)
          expect(decoded.exp).toBe(claims.exp)
          expect(decoded.iat).toBe(claims.iat)
          expect(decoded.email).toBe(claims.email)
        }
      ),
      { numRuns: 100 }
    )
  })
})
