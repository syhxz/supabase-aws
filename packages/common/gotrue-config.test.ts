import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getGoTrueUrl, validateGoTrueUrl, getGoTrueUrlAsync } from './gotrue-config'
import * as runtimeConfig from './runtime-config'

describe('gotrue-config', () => {
  const originalEnv = process.env

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv }
    delete process.env.NEXT_PUBLIC_GOTRUE_URL
    delete process.env.SUPABASE_PUBLIC_URL
    delete process.env.SUPABASE_URL
    
    // Mock runtime config to return null by default (no runtime config)
    vi.spyOn(runtimeConfig, 'getRuntimeConfig').mockReturnValue(null)
    vi.spyOn(runtimeConfig, 'getOrFetchRuntimeConfig').mockResolvedValue({
      gotrueUrl: '',
      supabaseUrl: '',
      apiUrl: '',
      anonKey: '',
      source: 'default',
      environment: 'development',
      timestamp: Date.now(),
    })
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  describe('validateGoTrueUrl', () => {
    it('should validate valid http URLs', () => {
      expect(validateGoTrueUrl('http://localhost:54321/auth/v1')).toBe(true)
      expect(validateGoTrueUrl('http://127.0.0.1:54321/auth/v1')).toBe(true)
    })

    it('should validate valid https URLs', () => {
      expect(validateGoTrueUrl('https://example.com/auth/v1')).toBe(true)
      expect(validateGoTrueUrl('https://api.example.com/auth/v1')).toBe(true)
    })

    it('should reject invalid URLs', () => {
      expect(validateGoTrueUrl('')).toBe(false)
      expect(validateGoTrueUrl('not-a-url')).toBe(false)
      expect(validateGoTrueUrl('ftp://example.com')).toBe(false)
      expect(validateGoTrueUrl(undefined)).toBe(false)
    })

    it('should reject non-http/https schemes', () => {
      expect(validateGoTrueUrl('file:///path/to/file')).toBe(false)
      expect(validateGoTrueUrl('javascript:alert(1)')).toBe(false)
    })
  })

  describe('getGoTrueUrl', () => {
    it('should prioritize NEXT_PUBLIC_GOTRUE_URL over cached runtime config (corrected priority)', () => {
      // Mock window object to simulate browser environment
      global.window = {} as any
      
      // Mock runtime config to return a value
      vi.spyOn(runtimeConfig, 'getRuntimeConfig').mockReturnValue({
        gotrueUrl: 'https://runtime.example.com/auth/v1',
        supabaseUrl: 'https://runtime.example.com',
        apiUrl: 'https://runtime.example.com',
        anonKey: 'test-key',
        source: 'explicit',
        environment: 'production',
        timestamp: Date.now(),
      })
      
      // Set build-time env vars (NEXT_PUBLIC_GOTRUE_URL should have highest priority per requirements 1.3, 2.5)
      process.env.NEXT_PUBLIC_GOTRUE_URL = 'https://buildtime.example.com/auth/v1'
      
      const config = getGoTrueUrl()
      expect(config.url).toBe('https://buildtime.example.com/auth/v1')
      expect(config.source).toBe('explicit')
      
      // Clean up
      delete (global as any).window
    })

    it('should use explicit NEXT_PUBLIC_GOTRUE_URL when runtime config not available', () => {
      process.env.NEXT_PUBLIC_GOTRUE_URL = 'https://api.example.com/auth/v1'
      const config = getGoTrueUrl()
      expect(config.url).toBe('https://api.example.com/auth/v1')
      expect(config.source).toBe('explicit')
    })

    it('should derive from SUPABASE_PUBLIC_URL when NEXT_PUBLIC_GOTRUE_URL not set', () => {
      process.env.SUPABASE_PUBLIC_URL = 'https://example.com'
      const config = getGoTrueUrl()
      expect(config.url).toBe('https://example.com/auth/v1')
      expect(config.source).toBe('derived-public')
    })

    it('should derive from SUPABASE_URL when neither NEXT_PUBLIC_GOTRUE_URL nor SUPABASE_PUBLIC_URL set', () => {
      process.env.SUPABASE_URL = 'http://localhost:54321'
      const config = getGoTrueUrl()
      expect(config.url).toBe('http://localhost:54321/auth/v1')
      expect(config.source).toBe('derived')
    })

    it('should use default when no environment variables set', () => {
      const config = getGoTrueUrl()
      expect(config.url).toBe('http://127.0.0.1:54321/auth/v1')
      expect(config.source).toBe('default')
    })

    it('should handle trailing slashes in base URLs', () => {
      process.env.SUPABASE_PUBLIC_URL = 'https://example.com/'
      const config = getGoTrueUrl()
      expect(config.url).toBe('https://example.com/auth/v1')
    })

    it('should fall back when explicit URL is invalid', () => {
      process.env.NEXT_PUBLIC_GOTRUE_URL = 'invalid-url'
      process.env.SUPABASE_PUBLIC_URL = 'https://example.com'
      const config = getGoTrueUrl()
      expect(config.url).toBe('https://example.com/auth/v1')
      expect(config.source).toBe('derived-public')
    })
  })

  describe('fallback behavior', () => {
    it('should fall back through the complete chain: runtime → explicit → derived → default', () => {
      // No runtime config (mocked to return null)
      // No explicit URL
      // No derived URLs
      // Should fall back to default
      const config = getGoTrueUrl()
      expect(config.url).toBe('http://127.0.0.1:54321/auth/v1')
      expect(config.source).toBe('default')
    })

    it('should fall back to derived-public when explicit is missing', () => {
      // No explicit URL
      process.env.SUPABASE_PUBLIC_URL = 'https://example.com'
      
      const config = getGoTrueUrl()
      expect(config.url).toBe('https://example.com/auth/v1')
      expect(config.source).toBe('derived-public')
    })

    it('should fall back to derived when explicit and derived-public are missing', () => {
      // No explicit URL
      // No public URL
      process.env.SUPABASE_URL = 'http://localhost:54321'
      
      const config = getGoTrueUrl()
      expect(config.url).toBe('http://localhost:54321/auth/v1')
      expect(config.source).toBe('derived')
    })

    it('should fall back to default when all environment variables are missing', () => {
      // Explicitly ensure no env vars are set
      delete process.env.NEXT_PUBLIC_GOTRUE_URL
      delete process.env.SUPABASE_PUBLIC_URL
      delete process.env.SUPABASE_URL
      
      const config = getGoTrueUrl()
      expect(config.url).toBe('http://127.0.0.1:54321/auth/v1')
      expect(config.source).toBe('default')
    })

    it('should fall back when explicit URL is invalid', () => {
      process.env.NEXT_PUBLIC_GOTRUE_URL = 'not-a-valid-url'
      process.env.SUPABASE_PUBLIC_URL = 'https://example.com'
      
      const config = getGoTrueUrl()
      expect(config.url).toBe('https://example.com/auth/v1')
      expect(config.source).toBe('derived-public')
    })

    it('should fall back when derived URLs are invalid', () => {
      process.env.SUPABASE_PUBLIC_URL = 'not-a-valid-url'
      process.env.SUPABASE_URL = 'also-not-valid'
      
      const config = getGoTrueUrl()
      expect(config.url).toBe('http://127.0.0.1:54321/auth/v1')
      expect(config.source).toBe('default')
    })

    it('should use localhost defaults for development environment', () => {
      process.env.NODE_ENV = 'development'
      
      const config = getGoTrueUrl()
      expect(config.url).toBe('http://127.0.0.1:54321/auth/v1')
      expect(config.source).toBe('default')
      expect(config.url).toContain('127.0.0.1')
    })

    it('should use container-appropriate defaults in production environment', () => {
      const originalNodeEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'
      
      // Spy on console.error to verify warnings
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      const config = getGoTrueUrl()
      // In production with container detection, should use internal service URL
      expect(config.url).toBe('http://kong:8000/auth/v1')
      expect(config.source).toBe('default')
      expect(config.networkType).toBe('internal')
      
      // Verify that error warnings were logged (still warns about missing env vars)
      expect(consoleErrorSpy).toHaveBeenCalled()
      const errorCalls = consoleErrorSpy.mock.calls.map(call => call.join(' '))
      const hasProductionWarning = errorCalls.some(call => 
        call.includes('CRITICAL') && call.includes('production')
      )
      expect(hasProductionWarning).toBe(true)
      
      consoleErrorSpy.mockRestore()
      process.env.NODE_ENV = originalNodeEnv
    })
  })

  describe('getGoTrueUrlAsync', () => {
    it('should prioritize NEXT_PUBLIC_GOTRUE_URL over runtime config (corrected priority)', async () => {
      // Mock window object to simulate browser environment
      global.window = {} as any
      
      // Mock runtime config fetch to return a value
      vi.spyOn(runtimeConfig, 'getOrFetchRuntimeConfig').mockResolvedValue({
        gotrueUrl: 'https://runtime.example.com/auth/v1',
        supabaseUrl: 'https://runtime.example.com',
        apiUrl: 'https://runtime.example.com',
        anonKey: 'test-key',
        source: 'explicit',
        environment: 'production',
        timestamp: Date.now(),
      })
      
      // Set build-time env vars (NEXT_PUBLIC_GOTRUE_URL should have highest priority per requirements 1.3, 2.5)
      process.env.NEXT_PUBLIC_GOTRUE_URL = 'https://buildtime.example.com/auth/v1'
      
      const config = await getGoTrueUrlAsync()
      expect(config.url).toBe('https://buildtime.example.com/auth/v1')
      expect(config.source).toBe('explicit')
      
      // Clean up
      delete (global as any).window
    })

    it('should fall back to build-time config when runtime fetch fails', async () => {
      // Mock runtime config fetch to throw error
      vi.spyOn(runtimeConfig, 'getOrFetchRuntimeConfig').mockRejectedValue(
        new Error('Network error')
      )
      
      process.env.NEXT_PUBLIC_GOTRUE_URL = 'https://api.example.com/auth/v1'
      
      const config = await getGoTrueUrlAsync()
      expect(config.url).toBe('https://api.example.com/auth/v1')
      expect(config.source).toBe('explicit')
    })

    it('should fall back to build-time config when runtime config has invalid URL', async () => {
      // Mock runtime config with invalid URL
      vi.spyOn(runtimeConfig, 'getOrFetchRuntimeConfig').mockResolvedValue({
        gotrueUrl: 'invalid-url',
        supabaseUrl: 'https://runtime.example.com',
        apiUrl: 'https://runtime.example.com',
        anonKey: 'test-key',
        source: 'explicit',
        environment: 'production',
        timestamp: Date.now(),
      })
      
      process.env.SUPABASE_PUBLIC_URL = 'https://example.com'
      
      const config = await getGoTrueUrlAsync()
      expect(config.url).toBe('https://example.com/auth/v1')
      expect(config.source).toBe('derived-public')
    })

    it('should prioritize NEXT_PUBLIC_GOTRUE_URL over runtime config (corrected priority)', async () => {
      // Mock window object to simulate browser environment
      global.window = {} as any
      
      // Mock runtime config
      vi.spyOn(runtimeConfig, 'getOrFetchRuntimeConfig').mockResolvedValue({
        gotrueUrl: 'https://runtime.example.com/auth/v1',
        supabaseUrl: 'https://runtime.example.com',
        apiUrl: 'https://runtime.example.com',
        anonKey: 'test-key',
        source: 'explicit',
        environment: 'production',
        timestamp: Date.now(),
      })
      
      // Set all build-time env vars (NEXT_PUBLIC_GOTRUE_URL should have highest priority per requirements 1.3, 2.5)
      process.env.NEXT_PUBLIC_GOTRUE_URL = 'https://explicit.example.com/auth/v1'
      process.env.SUPABASE_PUBLIC_URL = 'https://public.example.com'
      process.env.SUPABASE_URL = 'https://internal.example.com'
      
      const config = await getGoTrueUrlAsync()
      expect(config.url).toBe('https://explicit.example.com/auth/v1')
      expect(config.source).toBe('explicit')
      
      // Clean up
      delete (global as any).window
    })

    it('should use runtime config when NEXT_PUBLIC_GOTRUE_URL is not set', async () => {
      // Mock window object to simulate browser environment
      global.window = {} as any
      
      // Mock runtime config
      vi.spyOn(runtimeConfig, 'getOrFetchRuntimeConfig').mockResolvedValue({
        gotrueUrl: 'https://runtime.example.com/auth/v1',
        supabaseUrl: 'https://runtime.example.com',
        apiUrl: 'https://runtime.example.com',
        anonKey: 'test-key',
        source: 'explicit',
        environment: 'production',
        timestamp: Date.now(),
      })
      
      // Don't set NEXT_PUBLIC_GOTRUE_URL, but set other env vars
      process.env.SUPABASE_PUBLIC_URL = 'https://public.example.com'
      process.env.SUPABASE_URL = 'https://internal.example.com'
      
      const config = await getGoTrueUrlAsync()
      expect(config.url).toBe('https://runtime.example.com/auth/v1')
      expect(config.source).toBe('runtime')
      
      // Clean up
      delete (global as any).window
    })

    it('should fall back through complete chain when runtime config fails', async () => {
      // Mock window object to simulate browser environment
      global.window = {} as any
      
      // Mock runtime config fetch to fail
      vi.spyOn(runtimeConfig, 'getOrFetchRuntimeConfig').mockRejectedValue(
        new Error('Network error')
      )
      
      // No explicit URL
      // No derived URLs
      // Should fall back to default
      
      const config = await getGoTrueUrlAsync()
      expect(config.url).toBe('http://127.0.0.1:54321/auth/v1')
      expect(config.source).toBe('default')
      
      // Clean up
      delete (global as any).window
    })

    it('should fall back to explicit when runtime fails', async () => {
      // Mock window object to simulate browser environment
      global.window = {} as any
      
      // Mock runtime config fetch to fail
      vi.spyOn(runtimeConfig, 'getOrFetchRuntimeConfig').mockRejectedValue(
        new Error('Network error')
      )
      
      process.env.NEXT_PUBLIC_GOTRUE_URL = 'https://api.example.com/auth/v1'
      
      const config = await getGoTrueUrlAsync()
      expect(config.url).toBe('https://api.example.com/auth/v1')
      expect(config.source).toBe('explicit')
      
      // Clean up
      delete (global as any).window
    })

    it('should fall back to derived when runtime and explicit fail', async () => {
      // Mock window object to simulate browser environment
      global.window = {} as any
      
      // Mock runtime config fetch to fail
      vi.spyOn(runtimeConfig, 'getOrFetchRuntimeConfig').mockRejectedValue(
        new Error('Network error')
      )
      
      process.env.SUPABASE_PUBLIC_URL = 'https://example.com'
      
      const config = await getGoTrueUrlAsync()
      expect(config.url).toBe('https://example.com/auth/v1')
      expect(config.source).toBe('derived-public')
      
      // Clean up
      delete (global as any).window
    })

    it('should warn when falling back to defaults in production', async () => {
      const originalNodeEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'
      
      // Mock window object to simulate browser environment
      global.window = {} as any
      
      // Mock runtime config fetch to fail
      vi.spyOn(runtimeConfig, 'getOrFetchRuntimeConfig').mockRejectedValue(
        new Error('Network error')
      )
      
      // Spy on console.error to verify warnings
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      const config = await getGoTrueUrlAsync()
      expect(config.url).toBe('http://127.0.0.1:54321/auth/v1')
      expect(config.source).toBe('default')
      
      // Verify that error warnings were logged
      expect(consoleErrorSpy).toHaveBeenCalled()
      const errorCalls = consoleErrorSpy.mock.calls.map(call => call.join(' '))
      const hasProductionWarning = errorCalls.some(call => 
        call.includes('CRITICAL') && call.includes('production')
      )
      expect(hasProductionWarning).toBe(true)
      
      consoleErrorSpy.mockRestore()
      process.env.NODE_ENV = originalNodeEnv
      
      // Clean up
      delete (global as any).window
    })

    it('should use localhost defaults in development environment', async () => {
      const originalNodeEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'
      
      // Mock window object to simulate browser environment
      global.window = {} as any
      
      // Mock runtime config fetch to fail
      vi.spyOn(runtimeConfig, 'getOrFetchRuntimeConfig').mockRejectedValue(
        new Error('Network error')
      )
      
      const config = await getGoTrueUrlAsync()
      expect(config.url).toBe('http://127.0.0.1:54321/auth/v1')
      expect(config.source).toBe('default')
      expect(config.url).toContain('127.0.0.1')
      
      process.env.NODE_ENV = originalNodeEnv
      
      // Clean up
      delete (global as any).window
    })
  })
})
