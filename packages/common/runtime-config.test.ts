import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  fetchRuntimeConfig,
  getRuntimeConfig,
  getRuntimeConfigStore,
  isConfigStale,
  refreshRuntimeConfig,
  getOrFetchRuntimeConfig,
  resetRuntimeConfigStore,
  isConfigLoading,
  getConfigError,
  subscribeToConfigChanges,
  type RuntimeConfig,
} from './runtime-config'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch as any

describe('runtime-config', () => {
  const mockConfig: RuntimeConfig = {
    gotrueUrl: 'http://example.com/auth/v1',
    supabaseUrl: 'http://example.com',
    apiUrl: 'http://example.com',
    anonKey: 'test-anon-key',
    source: 'explicit',
    environment: 'production',
    timestamp: Date.now(),
  }

  beforeEach(() => {
    // Reset store before each test
    resetRuntimeConfigStore()
    mockFetch.mockReset()
    vi.clearAllTimers()
  })

  afterEach(() => {
    resetRuntimeConfigStore()
  })

  describe('fetchRuntimeConfig', () => {
    it('should fetch configuration successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockConfig,
      })

      const config = await fetchRuntimeConfig()

      expect(config).toEqual(mockConfig)
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/runtime-config',
        expect.objectContaining({
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })

    it('should update store state on successful fetch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockConfig,
      })

      await fetchRuntimeConfig()

      const store = getRuntimeConfigStore()
      expect(store.config).toEqual(mockConfig)
      expect(store.isLoading).toBe(false)
      expect(store.error).toBe(null)
      expect(store.fetchedAt).toBeGreaterThan(0)
      expect(store.attempts).toBe(0)
    })

    it('should handle HTTP errors', async () => {
      // Mock all retry attempts to return the same error
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: 'Server error' }),
      })

      await expect(fetchRuntimeConfig()).rejects.toThrow('Server error')
    })

    it('should handle network errors', async () => {
      // Mock all retry attempts to return the same error
      mockFetch.mockRejectedValue(new Error('Network error'))

      await expect(fetchRuntimeConfig()).rejects.toThrow('Network error')
    })

    it('should validate response structure', async () => {
      // Mock all retry attempts to return the same invalid response
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ invalid: 'response' }),
      })

      await expect(fetchRuntimeConfig()).rejects.toThrow(
        'Invalid configuration response: missing required fields'
      )
    })

    it('should handle concurrent requests by reusing ongoing fetch', async () => {
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => mockConfig,
                }),
              100
            )
          )
      )

      // Start multiple fetches concurrently
      const promise1 = fetchRuntimeConfig()
      const promise2 = fetchRuntimeConfig()
      const promise3 = fetchRuntimeConfig()

      const [config1, config2, config3] = await Promise.all([promise1, promise2, promise3])

      // All should return the same config
      expect(config1).toEqual(mockConfig)
      expect(config2).toEqual(mockConfig)
      expect(config3).toEqual(mockConfig)

      // Fetch should only be called once
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should retry on failure up to max attempts', async () => {
      vi.useFakeTimers()

      // Fail first two attempts, succeed on third
      mockFetch
        .mockRejectedValueOnce(new Error('Attempt 1 failed'))
        .mockRejectedValueOnce(new Error('Attempt 2 failed'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockConfig,
        })

      const fetchPromise = fetchRuntimeConfig()

      // Fast-forward through retry delays
      await vi.runAllTimersAsync()

      const config = await fetchPromise

      expect(config).toEqual(mockConfig)
      expect(mockFetch).toHaveBeenCalledTimes(3)

      vi.useRealTimers()
    })

    it('should throw after max retry attempts', async () => {
      vi.useFakeTimers()

      // Fail all attempts
      mockFetch.mockRejectedValue(new Error('Persistent failure'))

      const fetchPromise = fetchRuntimeConfig()

      // Fast-forward through all retry delays
      await vi.runAllTimersAsync()

      await expect(fetchPromise).rejects.toThrow('Persistent failure')
      expect(mockFetch).toHaveBeenCalledTimes(3) // Initial + 2 retries

      vi.useRealTimers()
    })
  })

  describe('getRuntimeConfig', () => {
    it('should return null when no config is loaded', () => {
      expect(getRuntimeConfig()).toBe(null)
    })

    it('should return cached config after successful fetch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockConfig,
      })

      await fetchRuntimeConfig()

      expect(getRuntimeConfig()).toEqual(mockConfig)
    })
  })

  describe('getRuntimeConfigStore', () => {
    it('should return current store state', () => {
      const store = getRuntimeConfigStore()

      expect(store).toHaveProperty('config')
      expect(store).toHaveProperty('isLoading')
      expect(store).toHaveProperty('error')
      expect(store).toHaveProperty('fetchedAt')
      expect(store).toHaveProperty('attempts')
    })

    it('should return a copy of the store', () => {
      const store1 = getRuntimeConfigStore()
      const store2 = getRuntimeConfigStore()

      expect(store1).not.toBe(store2) // Different objects
      expect(store1).toEqual(store2) // Same values
    })
  })

  describe('isConfigStale', () => {
    it('should return true when config has not been fetched', () => {
      expect(isConfigStale()).toBe(true)
    })

    it('should return false for fresh config', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockConfig,
      })

      await fetchRuntimeConfig()

      expect(isConfigStale()).toBe(false)
    })

    it('should return true for stale config (older than 5 minutes)', async () => {
      vi.useFakeTimers()

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockConfig,
      })

      await fetchRuntimeConfig()

      // Fast-forward 6 minutes
      vi.advanceTimersByTime(6 * 60 * 1000)

      expect(isConfigStale()).toBe(true)

      vi.useRealTimers()
    })
  })

  describe('refreshRuntimeConfig', () => {
    it('should clear cache and fetch fresh config', async () => {
      // First fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockConfig,
      })

      await fetchRuntimeConfig()

      const firstConfig = getRuntimeConfig()
      expect(firstConfig).toEqual(mockConfig)

      // Refresh with new config
      const newConfig = { ...mockConfig, timestamp: Date.now() + 1000 }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => newConfig,
      })

      const refreshedConfig = await refreshRuntimeConfig()

      expect(refreshedConfig).toEqual(newConfig)
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('should reset attempts counter', async () => {
      vi.useFakeTimers()

      // Fail initial fetch
      mockFetch.mockRejectedValueOnce(new Error('Initial failure'))

      const fetchPromise = fetchRuntimeConfig()
      await vi.runAllTimersAsync()

      await expect(fetchPromise).rejects.toThrow()

      const storeBeforeRefresh = getRuntimeConfigStore()
      expect(storeBeforeRefresh.attempts).toBeGreaterThan(0)

      // Refresh should reset attempts
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockConfig,
      })

      await refreshRuntimeConfig()

      const storeAfterRefresh = getRuntimeConfigStore()
      expect(storeAfterRefresh.attempts).toBe(0)

      vi.useRealTimers()
    })
  })

  describe('getOrFetchRuntimeConfig', () => {
    it('should fetch config when not cached', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockConfig,
      })

      const config = await getOrFetchRuntimeConfig()

      expect(config).toEqual(mockConfig)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should return cached config when available and not stale', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockConfig,
      })

      // First call fetches
      await getOrFetchRuntimeConfig()

      // Second call uses cache
      const config = await getOrFetchRuntimeConfig()

      expect(config).toEqual(mockConfig)
      expect(mockFetch).toHaveBeenCalledTimes(1) // Only called once
    })

    it('should fetch fresh config when cached config is stale', async () => {
      vi.useFakeTimers()

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockConfig,
      })

      // First fetch
      await getOrFetchRuntimeConfig()

      // Fast-forward to make config stale
      vi.advanceTimersByTime(6 * 60 * 1000)

      // Second fetch should get fresh config
      const newConfig = { ...mockConfig, timestamp: Date.now() }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => newConfig,
      })

      const config = await getOrFetchRuntimeConfig()

      expect(config).toEqual(newConfig)
      expect(mockFetch).toHaveBeenCalledTimes(2)

      vi.useRealTimers()
    })
  })

  describe('isConfigLoading', () => {
    it('should return false initially', () => {
      expect(isConfigLoading()).toBe(false)
    })

    it('should return true during fetch', async () => {
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => mockConfig,
                }),
              100
            )
          )
      )

      const fetchPromise = fetchRuntimeConfig()

      // Should be loading
      expect(isConfigLoading()).toBe(true)

      await fetchPromise

      // Should not be loading after completion
      expect(isConfigLoading()).toBe(false)
    })
  })

  describe('getConfigError', () => {
    it('should return null when no error', () => {
      expect(getConfigError()).toBe(null)
    })

    it('should return error after failed fetch', async () => {
      // Mock all retry attempts to return the same error
      mockFetch.mockRejectedValue(new Error('Test error'))

      await expect(fetchRuntimeConfig()).rejects.toThrow()

      const error = getConfigError()
      expect(error).toBeInstanceOf(Error)
      expect(error?.message).toBe('Test error')
    })
  })

  describe('subscribeToConfigChanges', () => {
    it('should notify listeners on successful fetch', async () => {
      const listener = vi.fn()
      const unsubscribe = subscribeToConfigChanges(listener)

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockConfig,
      })

      await fetchRuntimeConfig()

      expect(listener).toHaveBeenCalled()
      expect(listener).toHaveBeenCalledWith(mockConfig, null)

      unsubscribe()
    })

    it('should notify listeners on error', async () => {
      const listener = vi.fn()
      const unsubscribe = subscribeToConfigChanges(listener)

      // Mock all retry attempts to return the same error
      mockFetch.mockRejectedValue(new Error('Test error'))

      await expect(fetchRuntimeConfig()).rejects.toThrow()

      expect(listener).toHaveBeenCalled()
      const lastCall = listener.mock.calls[listener.mock.calls.length - 1]
      expect(lastCall[0]).toBe(null) // config is null
      expect(lastCall[1]).toBeInstanceOf(Error) // error is set

      unsubscribe()
    })

    it('should allow unsubscribing', async () => {
      const listener = vi.fn()
      const unsubscribe = subscribeToConfigChanges(listener)

      unsubscribe()

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockConfig,
      })

      await fetchRuntimeConfig()

      expect(listener).not.toHaveBeenCalled()
    })

    it('should handle multiple listeners', async () => {
      const listener1 = vi.fn()
      const listener2 = vi.fn()

      subscribeToConfigChanges(listener1)
      subscribeToConfigChanges(listener2)

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockConfig,
      })

      await fetchRuntimeConfig()

      expect(listener1).toHaveBeenCalled()
      expect(listener2).toHaveBeenCalled()
    })

    it('should handle listener errors gracefully', async () => {
      const errorListener = vi.fn(() => {
        throw new Error('Listener error')
      })
      const normalListener = vi.fn()

      subscribeToConfigChanges(errorListener)
      subscribeToConfigChanges(normalListener)

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockConfig,
      })

      // Should not throw even if listener throws
      await expect(fetchRuntimeConfig()).resolves.toEqual(mockConfig)

      // Both listeners should have been called
      expect(errorListener).toHaveBeenCalled()
      expect(normalListener).toHaveBeenCalled()
    })
  })

  describe('resetRuntimeConfigStore', () => {
    it('should clear all state', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockConfig,
      })

      await fetchRuntimeConfig()

      expect(getRuntimeConfig()).not.toBe(null)

      resetRuntimeConfigStore()

      const store = getRuntimeConfigStore()
      expect(store.config).toBe(null)
      expect(store.isLoading).toBe(false)
      expect(store.error).toBe(null)
      expect(store.fetchedAt).toBe(null)
      expect(store.attempts).toBe(0)
    })

    it('should clear all listeners', async () => {
      const listener = vi.fn()
      subscribeToConfigChanges(listener)

      resetRuntimeConfigStore()

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockConfig,
      })

      await fetchRuntimeConfig()

      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe('error state management', () => {
    it('should update error state on fetch failure', async () => {
      // Mock all retry attempts to return the same error
      mockFetch.mockRejectedValue(new Error('Fetch failed'))

      await expect(fetchRuntimeConfig()).rejects.toThrow()

      const store = getRuntimeConfigStore()
      expect(store.error).toBeInstanceOf(Error)
      expect(store.error?.message).toBe('Fetch failed')
      expect(store.isLoading).toBe(false)
    })

    it('should clear error state on successful fetch', async () => {
      // First fetch fails (all retries)
      mockFetch.mockRejectedValue(new Error('First failure'))

      await expect(fetchRuntimeConfig()).rejects.toThrow()

      expect(getConfigError()).not.toBe(null)

      // Second fetch succeeds
      mockFetch.mockReset()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockConfig,
      })

      await refreshRuntimeConfig()

      expect(getConfigError()).toBe(null)
    })
  })
})
