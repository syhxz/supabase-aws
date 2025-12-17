/**
 * Property-Based Tests for GoTrue Service Health Check
 * 
 * **Feature: add-login-page, Property 7: Service unavailability handling**
 * **Validates: Requirements 9.2**
 * 
 * These tests verify that the system properly handles GoTrue service unavailability
 * by displaying clear error messages rather than failing silently.
 * 
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fc from 'fast-check'
import { checkGoTrueHealth, checkGoTrueHealthWithRetry } from '../../lib/gotrue-health'

describe('GoTrue Health Check - Property Tests', () => {
  beforeEach(() => {
    // Reset fetch mock before each test
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  /**
   * Property 7: Service unavailability handling
   * 
   * For any GoTrue service that is unavailable (network error, service down, timeout),
   * the health check should return a clear error message indicating the service is unavailable.
   */
  it('should return clear error messages for any service unavailability scenario', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate various URL formats
        fc.webUrl(),
        // Generate various error scenarios
        fc.oneof(
          fc.constant('network-error'),
          fc.constant('timeout'),
          fc.constant('service-down'),
          fc.constant('invalid-response')
        ),
        async (url, errorType) => {
          // Mock different failure scenarios
          switch (errorType) {
            case 'network-error':
              ;(global.fetch as any).mockRejectedValue(new Error('Network request failed'))
              break
            case 'timeout':
              ;(global.fetch as any).mockRejectedValue(new Error('The operation was aborted'))
              break
            case 'service-down':
              ;(global.fetch as any).mockResolvedValue({
                ok: false,
                status: 503,
                json: async () => ({ error: 'Service Unavailable' }),
              })
              break
            case 'invalid-response':
              ;(global.fetch as any).mockResolvedValue({
                ok: false,
                status: 500,
                json: async () => ({ error: 'Internal Server Error' }),
              })
              break
          }

          const result = await checkGoTrueHealth(url)

          // Property: Service unavailability should always be clearly indicated
          expect(result.available).toBe(false)
          expect(result.error).toBeDefined()
          expect(typeof result.error).toBe('string')
          expect(result.error!.length).toBeGreaterThan(0)
          // Verify URL is included in results
          expect(result.url).toBe(url)
          expect(result.source).toBe('explicit')
          // Verify error message includes the attempted URL
          expect(result.error).toContain(url)
        }
      ),
      { numRuns: 10 }
    )
  })

  /**
   * Property: Successful health checks should always indicate availability
   * 
   * For any valid GoTrue service that responds successfully, the health check
   * should indicate the service is available.
   */
  it('should indicate availability for any successful health check response', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate various URL formats
        fc.webUrl(),
        // Generate various valid response data
        fc.record({
          version: fc.string({ minLength: 1, maxLength: 20 }),
          name: fc.constant('GoTrue'),
          description: fc.string(),
        }),
        async (url, responseData) => {
          // Mock successful response
          ;(global.fetch as any).mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => responseData,
          })

          const result = await checkGoTrueHealth(url)

          // Property: Successful responses should always indicate availability
          expect(result.available).toBe(true)
          expect(result.error).toBeUndefined()
          expect(result.version).toBe(responseData.version)
          expect(result.name).toBe(responseData.name)
          // Verify URL and source are included in results
          expect(result.url).toBe(url)
          expect(result.source).toBe('explicit')
          // Verify response time is tracked
          expect(result.responseTime).toBeDefined()
          expect(typeof result.responseTime).toBe('number')
          expect(result.responseTime!).toBeGreaterThanOrEqual(0)
        }
      ),
      { numRuns: 10 }
    )
  })

  /**
   * Property: Retry logic should eventually succeed if service becomes available
   * 
   * For any sequence of failures followed by success, the retry logic should
   * eventually return a successful result.
   */
  it('should succeed after retries when service becomes available', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.webUrl(),
        // Generate number of failures before success (0-2 failures)
        fc.integer({ min: 0, max: 2 }),
        fc.record({
          version: fc.string({ minLength: 1, maxLength: 20 }),
          name: fc.constant('GoTrue'),
        }),
        async (url, failureCount, successData) => {
          let callCount = 0

          // Mock failures followed by success
          ;(global.fetch as any).mockImplementation(() => {
            callCount++
            if (callCount <= failureCount) {
              return Promise.reject(new Error('Service temporarily unavailable'))
            }
            return Promise.resolve({
              ok: true,
              status: 200,
              json: async () => successData,
            })
          })

          const result = await checkGoTrueHealthWithRetry(url, 3, 10)

          // Property: Should eventually succeed if service becomes available within retry limit
          expect(result.available).toBe(true)
          expect(result.error).toBeUndefined()
          expect(callCount).toBe(failureCount + 1)
          // Verify URL and source information is included
          expect(result.url).toBe(url)
          expect(result.source).toBe('explicit')
        }
      ),
      { numRuns: 10 }
    )
  })

  /**
   * Property: Retry logic should fail with clear error after max retries
   * 
   * For any service that consistently fails, the retry logic should eventually
   * give up and return a clear error message.
   */
  it('should fail with clear error after exhausting all retries', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.webUrl(),
        fc.integer({ min: 1, max: 5 }),
        async (url, maxRetries) => {
          // Mock consistent failures
          ;(global.fetch as any).mockRejectedValue(new Error('Service unavailable'))

          const result = await checkGoTrueHealthWithRetry(url, maxRetries, 10)

          // Property: Should fail with clear error after max retries
          expect(result.available).toBe(false)
          expect(result.error).toBeDefined()
          expect(typeof result.error).toBe('string')
          expect(result.error!.length).toBeGreaterThan(0)
          // Verify URL and source information is included
          expect(result.url).toBe(url)
          expect(result.source).toBe('explicit')
          // Verify error message includes the attempted URL
          expect(result.error).toContain(url)
        }
      ),
      { numRuns: 10 }
    )
  })

  /**
   * Property: Health check should handle malformed URLs gracefully
   * 
   * For any URL (valid or invalid), the health check should not throw
   * and should return a proper result object.
   */
  it('should handle any URL format without throwing', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate various string formats (some may be invalid URLs)
        fc.string(),
        async (url) => {
          // Mock fetch to reject (simulating invalid URL or network error)
          ;(global.fetch as any).mockRejectedValue(new Error('Invalid URL or network error'))

          // Should not throw
          const result = await checkGoTrueHealth(url)

          // Property: Should always return a valid result object
          expect(result).toBeDefined()
          expect(typeof result.available).toBe('boolean')
          if (!result.available) {
            expect(result.error).toBeDefined()
            expect(typeof result.error).toBe('string')
          }
        }
      ),
      { numRuns: 10 }
    )
  })
})
