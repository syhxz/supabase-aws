/**
 * Unit tests for runtime configuration API
 * 
 * Tests the /api/runtime-config endpoint to ensure it properly
 * resolves configuration from environment variables with correct
 * priority order and validation.
 * 
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import handler from '../../../pages/api/runtime-config'
import type { NextApiRequest, NextApiResponse } from 'next'

// Helper to create mock request/response objects
function createMocks() {
  const req = {
    method: 'GET',
  } as NextApiRequest

  const res = {
    status: function (code: number) {
      this.statusCode = code
      return this
    },
    json: function (data: any) {
      this.data = data
      return this
    },
    setHeader: function (name: string, value: string) {
      this.headers = this.headers || {}
      this.headers[name] = value
      return this
    },
    statusCode: 200,
    data: null,
    headers: {},
  } as unknown as NextApiResponse

  return { req, res }
}

describe('Runtime Config API', () => {
  // Store original env vars
  const originalEnv = { ...process.env }

  beforeEach(() => {
    // Reset environment variables before each test
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv
  })

  it('should return 405 for non-GET requests', () => {
    const { req, res } = createMocks()
    req.method = 'POST'

    handler(req, res)

    expect(res.statusCode).toBe(405)
    expect(res.data).toHaveProperty('error', 'Method not allowed')
  })

  it('should return default configuration when no env vars are set', () => {
    // Clear all relevant env vars
    delete process.env.NEXT_PUBLIC_GOTRUE_URL
    delete process.env.SUPABASE_PUBLIC_URL
    delete process.env.SUPABASE_URL
    delete process.env.API_EXTERNAL_URL
    delete process.env.NEXT_PUBLIC_API_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    process.env.NODE_ENV = 'development'

    const { req, res } = createMocks()
    handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.data).toMatchObject({
      gotrueUrl: 'http://127.0.0.1:54321/auth/v1',
      supabaseUrl: 'http://127.0.0.1:54321',
      apiUrl: 'http://127.0.0.1:8000',
      source: 'default',
      environment: 'development',
    })
    expect(res.data).toHaveProperty('timestamp')
    expect(res.data).toHaveProperty('network')
    expect(res.data.network).toHaveProperty('serverSide')
    expect(res.data.network).toHaveProperty('clientSide')
    expect(res.data.network).toHaveProperty('environment')
  })

  it('should use explicit NEXT_PUBLIC_GOTRUE_URL when set', () => {
    process.env.NEXT_PUBLIC_GOTRUE_URL = 'https://example.com/auth/v1'
    process.env.SUPABASE_PUBLIC_URL = 'https://other.com'

    const { req, res } = createMocks()
    handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.data.gotrueUrl).toBe('https://example.com/auth/v1')
    expect(res.data.source).toBe('explicit')
  })

  it('should derive GoTrue URL from SUPABASE_PUBLIC_URL', () => {
    delete process.env.NEXT_PUBLIC_GOTRUE_URL
    process.env.SUPABASE_PUBLIC_URL = 'https://example.supabase.co'

    const { req, res } = createMocks()
    handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.data.gotrueUrl).toBe('https://example.supabase.co/auth/v1')
    expect(res.data.supabaseUrl).toBe('https://example.supabase.co')
    expect(res.data.source).toBe('derived')
  })

  it('should derive GoTrue URL from SUPABASE_URL when PUBLIC_URL not set', () => {
    delete process.env.NEXT_PUBLIC_GOTRUE_URL
    delete process.env.SUPABASE_PUBLIC_URL
    process.env.SUPABASE_URL = 'http://internal.supabase.local'

    const { req, res } = createMocks()
    handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.data.gotrueUrl).toBe('http://internal.supabase.local/auth/v1')
    expect(res.data.source).toBe('derived')
  })

  it('should handle trailing slashes in base URLs', () => {
    process.env.SUPABASE_PUBLIC_URL = 'https://example.supabase.co/'

    const { req, res } = createMocks()
    handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.data.gotrueUrl).toBe('https://example.supabase.co/auth/v1')
  })

  it('should use API_EXTERNAL_URL for apiUrl when set', () => {
    process.env.API_EXTERNAL_URL = 'http://192.0.2.1:8000'

    const { req, res } = createMocks()
    handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.data.apiUrl).toBe('http://192.0.2.1:8000')
  })

  it('should include anon key when set', () => {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key-123'

    const { req, res } = createMocks()
    handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.data.anonKey).toBe('test-anon-key-123')
  })

  it('should set cache headers', () => {
    const { req, res } = createMocks()
    handler(req, res)

    expect(res.headers['Cache-Control']).toBe('public, max-age=300, s-maxage=300')
    expect(res.headers['Content-Type']).toBe('application/json')
  })

  it('should return error for invalid URL format', () => {
    process.env.NEXT_PUBLIC_GOTRUE_URL = 'not-a-valid-url'

    const { req, res } = createMocks()
    handler(req, res)

    expect(res.statusCode).toBe(500)
    expect(res.data).toHaveProperty('error')
    expect(res.data).toHaveProperty('suggestions')
  })

  it('should detect production environment', () => {
    process.env.NODE_ENV = 'production'
    process.env.SUPABASE_PUBLIC_URL = 'https://prod.supabase.co'

    const { req, res } = createMocks()
    handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.data.environment).toBe('production')
  })

  it('should detect staging environment', () => {
    process.env.SUPABASE_PUBLIC_URL = 'https://staging.supabase.co'

    const { req, res } = createMocks()
    handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.data.environment).toBe('staging')
  })

  it('should prioritize runtime over build-time configuration', () => {
    // Set both explicit and derived URLs
    process.env.NEXT_PUBLIC_GOTRUE_URL = 'https://explicit.com/auth/v1'
    process.env.SUPABASE_PUBLIC_URL = 'https://derived.com'

    const { req, res } = createMocks()
    handler(req, res)

    expect(res.statusCode).toBe(200)
    // Explicit should win
    expect(res.data.gotrueUrl).toBe('https://explicit.com/auth/v1')
    expect(res.data.source).toBe('explicit')
  })

  it('should reject non-http/https URLs', () => {
    process.env.NEXT_PUBLIC_GOTRUE_URL = 'ftp://example.com/auth/v1'

    const { req, res } = createMocks()
    handler(req, res)

    expect(res.statusCode).toBe(500)
    expect(res.data).toHaveProperty('error')
  })

  it('should provide network-aware configuration with server-side and client-side URLs', () => {
    process.env.SUPABASE_PUBLIC_URL = 'http://localhost:8000'
    process.env.NODE_ENV = 'development'

    const { req, res } = createMocks()
    handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.data).toHaveProperty('network')
    
    // Check network structure
    expect(res.data.network).toHaveProperty('serverSide')
    expect(res.data.network).toHaveProperty('clientSide')
    expect(res.data.network).toHaveProperty('environment')
    
    // Check server-side URLs
    expect(res.data.network.serverSide).toHaveProperty('gotrueUrl')
    expect(res.data.network.serverSide).toHaveProperty('supabaseUrl')
    expect(res.data.network.serverSide).toHaveProperty('apiUrl')
    
    // Check client-side URLs
    expect(res.data.network.clientSide).toHaveProperty('gotrueUrl')
    expect(res.data.network.clientSide).toHaveProperty('supabaseUrl')
    expect(res.data.network.clientSide).toHaveProperty('apiUrl')
    
    // Check network environment info
    expect(res.data.network.environment).toHaveProperty('isContainer')
    expect(res.data.network.environment).toHaveProperty('isServerSide')
    expect(res.data.network.environment).toHaveProperty('preferredProtocol')
    expect(res.data.network.environment).toHaveProperty('internalDomain')
    expect(res.data.network.environment).toHaveProperty('externalDomain')
    
    // The test environment is detected as container, so server-side should use internal addresses
    if (res.data.network.environment.isContainer) {
      expect(res.data.network.serverSide.gotrueUrl).toContain('kong:8000')
      expect(res.data.network.clientSide.gotrueUrl).toContain('localhost:8000')
    } else {
      // In non-container environment, server-side and client-side URLs should be the same
      expect(res.data.network.serverSide.gotrueUrl).toBe(res.data.network.clientSide.gotrueUrl)
    }
  })

  it('should distinguish server-side and client-side URLs in container environment', () => {
    // Mock container environment
    process.env.HOSTNAME = 'studio-container-123'
    process.env.SUPABASE_PUBLIC_URL = 'http://localhost:8000'
    process.env.NODE_ENV = 'development'

    const { req, res } = createMocks()
    handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.data).toHaveProperty('network')
    
    // In container environment, network detection should identify container
    expect(res.data.network.environment.isContainer).toBe(true)
    
    // Server-side URLs should use internal addresses (kong:8000)
    expect(res.data.network.serverSide.gotrueUrl).toContain('kong:8000')
    expect(res.data.network.serverSide.apiUrl).toContain('kong:8000')
    
    // Client-side URLs should use external addresses (localhost:8000)
    expect(res.data.network.clientSide.gotrueUrl).toContain('localhost:8000')
    expect(res.data.network.clientSide.apiUrl).toContain('localhost:8000')
  })
})
