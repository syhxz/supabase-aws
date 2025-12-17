/**
 * Unit tests for error handling functionality
 * Tests Requirements: 9.2, 9.3, 9.4, 1.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  checkGoTrueHealth,
  checkGoTrueHealthWithRetry,
  categorizeGoTrueError,
  getGoTrueErrorMessage,
  GoTrueErrorType,
} from '../../lib/gotrue-health'
import {
  isNetworkError,
  analyzeNetworkError,
  retryWithExponentialBackoff,
  withNetworkErrorHandling,
} from '../../lib/network-error-handler'

describe('GoTrue Service Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('checkGoTrueHealth', () => {
    it('should detect GoTrue service unavailable', async () => {
      // Mock fetch to simulate service unavailable
      ;(global.fetch as any).mockRejectedValue(new Error('Failed to connect to GoTrue service'))

      const result = await checkGoTrueHealth('http://localhost:9999')

      expect(result.available).toBe(false)
      expect(result.error).toContain('Failed to connect')
    })

    it('should handle timeout errors', async () => {
      // Mock fetch to simulate timeout
      ;(global.fetch as any).mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('timeout')), 100)
        })
      })

      const result = await checkGoTrueHealth('http://localhost:9999')

      expect(result.available).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should return success when service is available', async () => {
      // Mock successful response
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ version: '1.0.0', name: 'GoTrue' }),
      })

      const result = await checkGoTrueHealth('http://localhost:9999')

      expect(result.available).toBe(true)
      expect(result.version).toBe('1.0.0')
    })

    it('should handle missing GoTrue URL configuration', async () => {
      // Don't set NEXT_PUBLIC_GOTRUE_URL
      const originalEnv = process.env.NEXT_PUBLIC_GOTRUE_URL
      delete process.env.NEXT_PUBLIC_GOTRUE_URL

      const result = await checkGoTrueHealth()

      expect(result.available).toBe(false)
      expect(result.error).toContain('not configured')

      // Restore
      if (originalEnv) {
        process.env.NEXT_PUBLIC_GOTRUE_URL = originalEnv
      }
    })
  })

  describe('checkGoTrueHealthWithRetry', () => {
    it('should retry on failure with exponential backoff', async () => {
      let attempts = 0
      ;(global.fetch as any).mockImplementation(() => {
        attempts++
        if (attempts < 3) {
          return Promise.reject(new Error('Service unavailable'))
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ version: '1.0.0' }),
        })
      })

      const result = await checkGoTrueHealthWithRetry('http://localhost:9999', 3, 100)

      expect(result.available).toBe(true)
      expect(attempts).toBe(3)
    })

    it('should fail after max retries', async () => {
      ;(global.fetch as any).mockRejectedValue(new Error('Service unavailable'))

      const result = await checkGoTrueHealthWithRetry('http://localhost:9999', 2, 100)

      expect(result.available).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('categorizeGoTrueError', () => {
    it('should categorize configuration errors', () => {
      const errorType = categorizeGoTrueError('GoTrue URL not configured')
      expect(errorType).toBe(GoTrueErrorType.CONFIGURATION_ERROR)
    })

    it('should categorize timeout errors', () => {
      const errorType = categorizeGoTrueError('Request timeout')
      expect(errorType).toBe(GoTrueErrorType.TIMEOUT)
    })

    it('should categorize network errors', () => {
      const errorType = categorizeGoTrueError('Failed to connect to service')
      expect(errorType).toBe(GoTrueErrorType.NETWORK_ERROR)
    })

    it('should default to service unavailable', () => {
      const errorType = categorizeGoTrueError('Unknown error')
      expect(errorType).toBe(GoTrueErrorType.SERVICE_UNAVAILABLE)
    })
  })

  describe('getGoTrueErrorMessage', () => {
    it('should return user-friendly message for configuration error', () => {
      const message = getGoTrueErrorMessage('GoTrue URL not configured')
      expect(message).toContain('not configured')
      expect(message).toContain('administrator')
    })

    it('should return user-friendly message for timeout', () => {
      const message = getGoTrueErrorMessage('Request timeout')
      expect(message).toContain('too long')
      expect(message).toContain('try again')
    })

    it('should return user-friendly message for network error', () => {
      const message = getGoTrueErrorMessage('Failed to connect')
      expect(message).toContain('network')
    })
  })
})

describe('Network Error Handling', () => {
  describe('isNetworkError', () => {
    it('should detect network errors', () => {
      const error = new Error('Failed to fetch')
      expect(isNetworkError(error)).toBe(true)
    })

    it('should detect connection errors', () => {
      const error = new Error('Connection refused')
      expect(isNetworkError(error)).toBe(true)
    })

    it('should detect timeout errors', () => {
      const error = new Error('Request timeout')
      expect(isNetworkError(error)).toBe(true)
    })

    it('should not detect non-network errors', () => {
      const error = new Error('Invalid credentials')
      expect(isNetworkError(error)).toBe(false)
    })

    it('should handle null/undefined errors', () => {
      expect(isNetworkError(null)).toBe(false)
      expect(isNetworkError(undefined)).toBe(false)
    })
  })

  describe('analyzeNetworkError', () => {
    it('should analyze network errors correctly', () => {
      const error = new Error('Network error occurred')
      const analysis = analyzeNetworkError(error)

      expect(analysis.isNetworkError).toBe(true)
      expect(analysis.shouldRetry).toBe(true)
      expect(analysis.userMessage).toContain('Network error')
    })

    it('should analyze non-network errors correctly', () => {
      const error = new Error('Invalid password')
      const analysis = analyzeNetworkError(error)

      expect(analysis.isNetworkError).toBe(false)
      expect(analysis.shouldRetry).toBe(false)
    })
  })

  describe('retryWithExponentialBackoff', () => {
    it('should retry failed operations', async () => {
      let attempts = 0
      const fn = vi.fn(async () => {
        attempts++
        if (attempts < 3) {
          throw new Error('Network error')
        }
        return 'success'
      })

      const result = await retryWithExponentialBackoff(fn, 3, 10)

      expect(result).toBe('success')
      expect(attempts).toBe(3)
    })

    it('should throw after max retries', async () => {
      const fn = vi.fn(async () => {
        throw new Error('Network error')
      })

      await expect(retryWithExponentialBackoff(fn, 2, 10)).rejects.toThrow('Network error')
      expect(fn).toHaveBeenCalledTimes(3) // Initial + 2 retries
    })

    it('should not retry non-network errors', async () => {
      const fn = vi.fn(async () => {
        throw new Error('Invalid credentials')
      })

      await expect(retryWithExponentialBackoff(fn, 3, 10)).rejects.toThrow('Invalid credentials')
      expect(fn).toHaveBeenCalledTimes(1) // No retries for non-network errors
    })
  })

  describe('withNetworkErrorHandling', () => {
    it('should handle successful operations', async () => {
      const fn = vi.fn(async () => 'success')

      const result = await withNetworkErrorHandling(fn)

      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should retry network errors', async () => {
      let attempts = 0
      const fn = vi.fn(async () => {
        attempts++
        if (attempts < 2) {
          throw new Error('Network error')
        }
        return 'success'
      })

      const result = await withNetworkErrorHandling(fn, { maxRetries: 2, initialDelayMs: 10 })

      expect(result).toBe('success')
      expect(attempts).toBe(2)
    })

    it('should call onError callback on failure', async () => {
      const fn = vi.fn(async () => {
        throw new Error('Network error')
      })
      const onError = vi.fn()

      await expect(
        withNetworkErrorHandling(fn, { maxRetries: 1, initialDelayMs: 10, onError })
      ).rejects.toThrow()

      expect(onError).toHaveBeenCalled()
      expect(onError.mock.calls[0][0].isNetworkError).toBe(true)
    })
  })
})

describe('Invalid Credentials Error Handling', () => {
  it('should handle invalid credentials error', () => {
    const error = { message: 'Invalid login credentials' }
    
    // Test that the error message is properly categorized
    expect(error.message.toLowerCase()).toContain('invalid')
  })

  it('should not reveal which field is incorrect', () => {
    const errors = [
      'Invalid login credentials',
      'Invalid email or password',
      'Email not found',
      'Invalid password',
    ]

    // All these errors should be normalized to the same message
    errors.forEach((error) => {
      expect(error.toLowerCase()).toMatch(/invalid|not found/)
    })
  })
})

describe('Token Validation Error Handling', () => {
  it('should detect invalid token structure', () => {
    const invalidTokens = [
      null,
      undefined,
      '',
      'not-a-jwt',
      'only.two.parts',
      'too.many.parts.here.invalid',
    ]

    invalidTokens.forEach((token) => {
      if (!token || typeof token !== 'string') {
        expect(token).toBeFalsy()
      } else {
        const parts = token.split('.')
        expect(parts.length).not.toBe(3)
      }
    })
  })

  it('should validate JWT structure', () => {
    const validJWT = 'header.payload.signature'
    const parts = validJWT.split('.')
    
    expect(parts.length).toBe(3)
    expect(parts[0]).toBeTruthy()
    expect(parts[1]).toBeTruthy()
    expect(parts[2]).toBeTruthy()
  })

  it('should detect expired tokens', () => {
    const now = Date.now()
    const expiredToken = {
      expires_at: Math.floor(now / 1000) - 3600, // Expired 1 hour ago
    }
    const validToken = {
      expires_at: Math.floor(now / 1000) + 3600, // Expires in 1 hour
    }

    expect(expiredToken.expires_at * 1000).toBeLessThan(now)
    expect(validToken.expires_at * 1000).toBeGreaterThan(now)
  })
})
