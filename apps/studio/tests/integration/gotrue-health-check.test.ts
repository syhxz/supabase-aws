/**
 * Integration Tests for Enhanced GoTrue Health Check
 * 
 * These tests verify the enhanced GoTrue health check implementation including:
 * - Health check requests without authentication headers
 * - Proper error handling for different response types
 * - Timeout handling for health check requests
 * - Integration with the overall health check system
 * 
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { performConfigHealthCheck } from '../../lib/config-health'
import * as runtimeConfig from 'common/runtime-config'

describe('Enhanced GoTrue Health Check Integration', () => {
  beforeEach(() => {
    // Reset fetch mock before each test
    global.fetch = vi.fn()
    
    // Mock runtime config module
    vi.spyOn(runtimeConfig, 'getRuntimeConfig')
    vi.spyOn(runtimeConfig, 'fetchRuntimeConfig')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should perform GoTrue health check without authentication headers', async () => {
    const mockConfig: runtimeConfig.RuntimeConfig = {
      gotrueUrl: 'http://localhost:54321/auth/v1',
      supabaseUrl: 'http://localhost:54321',
      apiUrl: 'http://localhost:8000',
      anonKey: 'test-anon-key',
      source: 'explicit',
      environment: 'development',
      timestamp: Date.now(),
    }

    vi.mocked(runtimeConfig.getRuntimeConfig).mockReturnValue(mockConfig)
    vi.mocked(runtimeConfig.fetchRuntimeConfig).mockResolvedValue(mockConfig)

    // Mock fetch to verify no auth headers are sent and return successful GoTrue response
    ;(global.fetch as any).mockImplementation((url: string, options: any) => {
      if (url.includes('/health')) {
        // Verify that authentication headers are NOT included
        expect(options?.headers?.Authorization).toBeUndefined()
        expect(options?.headers?.apikey).toBeUndefined()
        expect(options?.credentials).toBe('omit')
        
        // Return successful GoTrue health response
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            version: '2.0.0',
            name: 'GoTrue',
            gotrue_version: '2.0.0',
            build: 'abc123',
            timestamp: Date.now(),
          }),
        })
      }
      
      // For other requests (like API gateway), return success
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ version: '1.0.0' }),
      })
    })

    const result = await performConfigHealthCheck()

    expect(result.healthy).toBe(true)
    expect(result.checks.gotrueReachable.healthy).toBe(true)
    expect(result.checks.gotrueReachable.metadata?.gotrue_version).toBe('2.0.0')
    expect(result.errors).toHaveLength(0)
  })

  it('should handle GoTrue 401 authentication errors with specific guidance', async () => {
    const mockConfig: runtimeConfig.RuntimeConfig = {
      gotrueUrl: 'http://localhost:54321/auth/v1',
      supabaseUrl: 'http://localhost:54321',
      apiUrl: 'http://localhost:8000',
      anonKey: 'test-anon-key',
      source: 'explicit',
      environment: 'development',
      timestamp: Date.now(),
    }

    vi.mocked(runtimeConfig.getRuntimeConfig).mockReturnValue(mockConfig)
    vi.mocked(runtimeConfig.fetchRuntimeConfig).mockResolvedValue(mockConfig)

    let callCount = 0
    ;(global.fetch as any).mockImplementation((url: string) => {
      callCount++
      
      if (url.includes('/health') && callCount === 1) {
        // GoTrue health check returns 401 (authentication barrier)
        return Promise.resolve({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
        })
      }
      
      // API gateway succeeds
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ version: '1.0.0' }),
      })
    })

    const result = await performConfigHealthCheck()

    expect(result.healthy).toBe(false)
    expect(result.checks.gotrueReachable.healthy).toBe(false)
    expect(result.checks.gotrueReachable.error).toContain('authentication')
    expect(result.checks.gotrueReachable.error).toContain('Kong Gateway')
    expect(result.errors.some(e => e.includes('Kong Gateway'))).toBe(true)
    expect(result.errors.some(e => e.includes('/auth/v1/health bypasses authentication'))).toBe(true)
  })

  it('should handle GoTrue timeout with proper error handling', async () => {
    const mockConfig: runtimeConfig.RuntimeConfig = {
      gotrueUrl: 'http://localhost:54321/auth/v1',
      supabaseUrl: 'http://localhost:54321',
      apiUrl: 'http://localhost:8000',
      anonKey: 'test-anon-key',
      source: 'explicit',
      environment: 'development',
      timestamp: Date.now(),
    }

    vi.mocked(runtimeConfig.getRuntimeConfig).mockReturnValue(mockConfig)
    vi.mocked(runtimeConfig.fetchRuntimeConfig).mockResolvedValue(mockConfig)

    let callCount = 0
    ;(global.fetch as any).mockImplementation((url: string) => {
      callCount++
      
      if (url.includes('/health') && callCount === 1) {
        // GoTrue health check times out
        const error = new Error('The operation was aborted')
        error.name = 'AbortError'
        return Promise.reject(error)
      }
      
      // API gateway succeeds
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ version: '1.0.0' }),
      })
    })

    const result = await performConfigHealthCheck()

    expect(result.healthy).toBe(false)
    expect(result.checks.gotrueReachable.healthy).toBe(false)
    expect(result.checks.gotrueReachable.error).toContain('timeout')
    expect(result.checks.gotrueReachable.metadata?.timeout).toBe(true)
    expect(result.checks.gotrueReachable.metadata?.retryable).toBe(true)
    expect(result.errors.some(e => e.includes('GoTrue service performance'))).toBe(true)
  })

  it('should validate GoTrue health response format and warn about missing fields', async () => {
    const mockConfig: runtimeConfig.RuntimeConfig = {
      gotrueUrl: 'http://localhost:54321/auth/v1',
      supabaseUrl: 'http://localhost:54321',
      apiUrl: 'http://localhost:8000',
      anonKey: 'test-anon-key',
      source: 'explicit',
      environment: 'development',
      timestamp: Date.now(),
    }

    vi.mocked(runtimeConfig.getRuntimeConfig).mockReturnValue(mockConfig)
    vi.mocked(runtimeConfig.fetchRuntimeConfig).mockResolvedValue(mockConfig)

    let callCount = 0
    ;(global.fetch as any).mockImplementation((url: string) => {
      callCount++
      
      if (url.includes('/health') && callCount === 1) {
        // GoTrue returns response without expected service information
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            unexpected: 'data',
            random: 'fields',
          }),
        })
      }
      
      // API gateway succeeds
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ version: '1.0.0' }),
      })
    })

    const result = await performConfigHealthCheck()

    expect(result.healthy).toBe(true)
    expect(result.checks.gotrueReachable.healthy).toBe(true)
    expect(result.checks.gotrueReachable.metadata?.warning).toContain('missing expected service information')
  })

  it('should handle network errors with proper troubleshooting guidance', async () => {
    const mockConfig: runtimeConfig.RuntimeConfig = {
      gotrueUrl: 'http://localhost:54321/auth/v1',
      supabaseUrl: 'http://localhost:54321',
      apiUrl: 'http://localhost:8000',
      anonKey: 'test-anon-key',
      source: 'explicit',
      environment: 'development',
      timestamp: Date.now(),
    }

    vi.mocked(runtimeConfig.getRuntimeConfig).mockReturnValue(mockConfig)
    vi.mocked(runtimeConfig.fetchRuntimeConfig).mockResolvedValue(mockConfig)

    let callCount = 0
    ;(global.fetch as any).mockImplementation((url: string) => {
      callCount++
      
      if (url.includes('/health') && callCount === 1) {
        // GoTrue network error
        const error = new Error('fetch failed')
        error.name = 'TypeError'
        return Promise.reject(error)
      }
      
      // API gateway succeeds
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ version: '1.0.0' }),
      })
    })

    const result = await performConfigHealthCheck()

    expect(result.healthy).toBe(false)
    expect(result.checks.gotrueReachable.healthy).toBe(false)
    expect(result.checks.gotrueReachable.error).toContain('Network error')
    expect(result.checks.gotrueReachable.metadata?.retryable).toBe(true)
    expect(result.errors.some(e => e.includes('Docker network configuration'))).toBe(true)
  })

  it('should convert localhost URLs to internal Docker network URLs', async () => {
    const mockConfig: runtimeConfig.RuntimeConfig = {
      gotrueUrl: 'http://localhost:54321/auth/v1',
      supabaseUrl: 'http://localhost:54321',
      apiUrl: 'http://localhost:8000',
      anonKey: 'test-anon-key',
      source: 'explicit',
      environment: 'development',
      timestamp: Date.now(),
    }

    vi.mocked(runtimeConfig.getRuntimeConfig).mockReturnValue(mockConfig)
    vi.mocked(runtimeConfig.fetchRuntimeConfig).mockResolvedValue(mockConfig)

    ;(global.fetch as any).mockImplementation((url: string) => {
      // Verify that localhost URLs are converted to internal Docker network URLs
      if (url.includes('/health')) {
        expect(url).toContain('kong:8000')
        expect(url).not.toContain('localhost')
      }
      
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          version: '2.0.0',
          name: 'GoTrue',
        }),
      })
    })

    const result = await performConfigHealthCheck()

    expect(result.healthy).toBe(true)
    expect(result.checks.gotrueReachable.healthy).toBe(true)
  })
})