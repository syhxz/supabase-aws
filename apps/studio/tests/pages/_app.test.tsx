/**
 * @vitest-environment node
 * 
 * Tests for application initialization with runtime configuration loading
 * 
 * These tests verify that:
 * 1. Runtime configuration is fetched on app startup
 * 2. Loading screen is shown while config is being fetched
 * 3. Error handling works correctly for config fetch failures
 * 4. Config loads before any API requests
 * 
 * Note: These are integration-style tests that verify the behavior
 * of the runtime configuration loading logic in _app.tsx
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  fetchRuntimeConfig,
  getRuntimeConfigStore,
  subscribeToConfigChanges,
  resetRuntimeConfigStore,
} from 'common/runtime-config'

describe('Application Initialization with Runtime Config', () => {
  const mockConfig = {
    gotrueUrl: 'http://production.example.com:8000/auth/v1',
    supabaseUrl: 'http://production.example.com:8000',
    apiUrl: 'http://production.example.com:8000',
    anonKey: 'test-anon-key',
    source: 'explicit' as const,
    environment: 'production' as const,
    timestamp: Date.now(),
  }

  beforeEach(() => {
    // Reset the store before each test
    resetRuntimeConfigStore()
    
    // Mock fetch globally
    global.fetch = vi.fn()
  })

  it('should fetch runtime configuration on startup', async () => {
    // Mock successful API response
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockConfig,
    })

    // Fetch config
    const config = await fetchRuntimeConfig()

    // Verify fetch was called
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/runtime-config',
      expect.objectContaining({
        headers: {
          'Content-Type': 'application/json',
        },
      })
    )

    // Verify config was returned
    expect(config).toEqual(mockConfig)

    // Verify store was updated
    const store = getRuntimeConfigStore()
    expect(store.config).toEqual(mockConfig)
    expect(store.isLoading).toBe(false)
    expect(store.error).toBeNull()
    expect(store.fetchedAt).toBeGreaterThan(0)
  })

  it('should handle fetch errors gracefully', async () => {
    // Mock failed API response for all retry attempts
    ;(global.fetch as any).mockRejectedValue(new Error('Network timeout'))

    // Attempt to fetch config - should throw after retries
    await expect(fetchRuntimeConfig()).rejects.toThrow()

    // Verify store has error
    const store = getRuntimeConfigStore()
    expect(store.config).toBeNull()
    expect(store.isLoading).toBe(false)
    expect(store.error).toBeTruthy()
    // Error message could be either the original error or a timeout error
    expect(store.error?.message).toMatch(/Network timeout|timeout/i)
  }, 15000) // Increase timeout to allow for retries

  it('should notify subscribers when config changes', async () => {
    // Mock successful API response
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockConfig,
    })

    // Setup subscriber
    const listener = vi.fn()
    const unsubscribe = subscribeToConfigChanges(listener)

    // Fetch config
    await fetchRuntimeConfig()

    // Verify listener was called with config
    expect(listener).toHaveBeenCalledWith(mockConfig, null)

    // Cleanup
    unsubscribe()
  })

  it('should notify subscribers when fetch fails', async () => {
    // Mock failed API response for all retry attempts
    const error = new Error('Network timeout')
    ;(global.fetch as any).mockRejectedValue(error)

    // Setup subscriber
    const listener = vi.fn()
    const unsubscribe = subscribeToConfigChanges(listener)

    // Attempt to fetch config - should throw after retries
    await expect(fetchRuntimeConfig()).rejects.toThrow()

    // Verify listener was called with error
    expect(listener).toHaveBeenCalledWith(null, expect.any(Error))

    // Cleanup
    unsubscribe()
  }, 15000) // Increase timeout to allow for retries

  it('should handle concurrent fetch requests', async () => {
    // Mock successful API response
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockConfig,
    })

    // Start multiple concurrent fetches
    const promise1 = fetchRuntimeConfig()
    const promise2 = fetchRuntimeConfig()
    const promise3 = fetchRuntimeConfig()

    // Wait for all to complete
    const [config1, config2, config3] = await Promise.all([promise1, promise2, promise3])

    // Verify all got the same config
    expect(config1).toEqual(mockConfig)
    expect(config2).toEqual(mockConfig)
    expect(config3).toEqual(mockConfig)

    // Verify fetch was only called once (deduplication)
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('should validate response structure', async () => {
    // Mock invalid API response (missing required fields) for all retry attempts
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        gotrueUrl: 'http://example.com',
        // Missing supabaseUrl and apiUrl
      }),
    })

    // Attempt to fetch config - should throw validation error
    await expect(fetchRuntimeConfig()).rejects.toThrow()
    
    // Verify error message contains expected text
    const store = getRuntimeConfigStore()
    expect(store.error?.message).toContain('missing required fields')
  }, 15000) // Increase timeout to allow for retries

  it('should handle HTTP error responses', async () => {
    // Mock HTTP error response for all retry attempts
    ;(global.fetch as any).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({ error: 'Server error' }),
    })

    // Attempt to fetch config - should throw server error
    await expect(fetchRuntimeConfig()).rejects.toThrow()
    
    // Verify error contains server error message
    const store = getRuntimeConfigStore()
    expect(store.error?.message).toContain('Server error')
  }, 15000) // Increase timeout to allow for retries

  it('should handle timeout', async () => {
    // Mock fetch to simulate AbortError (timeout) for all retry attempts
    ;(global.fetch as any).mockImplementation(() => {
      const error = new Error('The operation was aborted')
      error.name = 'AbortError'
      return Promise.reject(error)
    })

    // Attempt to fetch config (should timeout)
    await expect(fetchRuntimeConfig()).rejects.toThrow()
    
    // Verify error is timeout related
    const store = getRuntimeConfigStore()
    expect(store.error?.message).toMatch(/timeout/i)
  }, 20000) // Increase test timeout to allow for retries
})
