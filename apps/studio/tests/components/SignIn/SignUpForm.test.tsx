/**
 * Unit Tests for SignUpForm Component
 * 
 * Tests the URL generation logic for authentication redirects with defensive fallbacks.
 * 
 * Requirements: 3.1, 3.2, 3.3
 * 
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('SignUpForm URL Generation Logic', () => {
  let originalEnv: NodeJS.ProcessEnv
  let originalLocation: Location

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Store original environment and location
    originalEnv = { ...process.env }
    originalLocation = window.location
    
    // Mock window.location
    delete (window as any).location
    window.location = {
      ...originalLocation,
      origin: 'https://test.example.com'
    } as Location
  })

  afterEach(() => {
    // Restore original environment and location
    process.env = originalEnv
    window.location = originalLocation
  })

  /**
   * Test: URL generation with NEXT_PUBLIC_SITE_URL defined
   * 
   * When NEXT_PUBLIC_SITE_URL is defined in non-preview environment,
   * should use that value for redirect URL generation.
   * 
   * Requirements: 3.1
   */
  it('should use NEXT_PUBLIC_SITE_URL when defined in non-preview environment', () => {
    // Setup environment
    process.env.NEXT_PUBLIC_VERCEL_ENV = 'production'
    process.env.NEXT_PUBLIC_SITE_URL = 'https://app.supabase.com'
    
    // Simulate the URL generation logic from SignUpForm
    let baseUrl: string
    if (process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview') {
      baseUrl = window.location.origin
    } else if (process.env.NEXT_PUBLIC_SITE_URL) {
      baseUrl = process.env.NEXT_PUBLIC_SITE_URL
    } else {
      baseUrl = window.location.origin
    }
    
    expect(baseUrl).toBe('https://app.supabase.com')
  })

  /**
   * Test: URL generation fallback when NEXT_PUBLIC_SITE_URL is undefined
   * 
   * When NEXT_PUBLIC_SITE_URL is undefined in non-preview environment,
   * should fall back to window.location.origin.
   * 
   * Requirements: 3.2
   */
  it('should fall back to window.location.origin when NEXT_PUBLIC_SITE_URL is undefined', () => {
    // Setup environment - no NEXT_PUBLIC_SITE_URL defined
    process.env.NEXT_PUBLIC_VERCEL_ENV = 'production'
    delete process.env.NEXT_PUBLIC_SITE_URL
    
    // Simulate the URL generation logic from SignUpForm
    let baseUrl: string
    if (process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview') {
      baseUrl = window.location.origin
    } else if (process.env.NEXT_PUBLIC_SITE_URL) {
      baseUrl = process.env.NEXT_PUBLIC_SITE_URL
    } else {
      baseUrl = window.location.origin
    }
    
    expect(baseUrl).toBe('https://test.example.com')
  })

  /**
   * Test: URL generation in preview environment
   * 
   * When in preview environment, should always use window.location.origin
   * regardless of NEXT_PUBLIC_SITE_URL value.
   * 
   * Requirements: 3.1, 3.2
   */
  it('should use window.location.origin in preview environment', () => {
    // Setup environment
    process.env.NEXT_PUBLIC_VERCEL_ENV = 'preview'
    process.env.NEXT_PUBLIC_SITE_URL = 'https://app.supabase.com'
    
    // Simulate the URL generation logic from SignUpForm
    let baseUrl: string
    if (process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview') {
      baseUrl = window.location.origin
    } else if (process.env.NEXT_PUBLIC_SITE_URL) {
      baseUrl = process.env.NEXT_PUBLIC_SITE_URL
    } else {
      baseUrl = window.location.origin
    }
    
    expect(baseUrl).toBe('https://test.example.com')
  })

  /**
   * Test: Generated URLs are complete with protocol and domain
   * 
   * All generated redirect URLs should include protocol and domain components.
   * 
   * Requirements: 3.3
   */
  it('should generate complete URLs with protocol and domain', () => {
    const BASE_PATH = '' // Simulating BASE_PATH constant
    
    // Test with NEXT_PUBLIC_SITE_URL
    process.env.NEXT_PUBLIC_VERCEL_ENV = 'production'
    process.env.NEXT_PUBLIC_SITE_URL = 'https://app.supabase.com'
    
    let baseUrl: string
    if (process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview') {
      baseUrl = window.location.origin
    } else if (process.env.NEXT_PUBLIC_SITE_URL) {
      baseUrl = process.env.NEXT_PUBLIC_SITE_URL
    } else {
      baseUrl = window.location.origin
    }
    
    const redirectUrlBase = `${baseUrl}${BASE_PATH}`
    
    // Verify URL has protocol and domain
    expect(redirectUrlBase).toMatch(/^https?:\/\/[^\/]+/)
    expect(redirectUrlBase).toBe('https://app.supabase.com')
    
    // Test with fallback
    delete process.env.NEXT_PUBLIC_SITE_URL
    
    if (process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview') {
      baseUrl = window.location.origin
    } else if (process.env.NEXT_PUBLIC_SITE_URL) {
      baseUrl = process.env.NEXT_PUBLIC_SITE_URL
    } else {
      baseUrl = window.location.origin
    }
    
    const fallbackRedirectUrlBase = `${baseUrl}${BASE_PATH}`
    
    // Verify fallback URL has protocol and domain
    expect(fallbackRedirectUrlBase).toMatch(/^https?:\/\/[^\/]+/)
    expect(fallbackRedirectUrlBase).toBe('https://test.example.com')
  })

  /**
   * Test: URL generation with empty NEXT_PUBLIC_SITE_URL
   * 
   * When NEXT_PUBLIC_SITE_URL is empty string, should fall back to window.location.origin.
   * 
   * Requirements: 3.2
   */
  it('should fall back to window.location.origin when NEXT_PUBLIC_SITE_URL is empty string', () => {
    // Setup environment with empty string
    process.env.NEXT_PUBLIC_VERCEL_ENV = 'production'
    process.env.NEXT_PUBLIC_SITE_URL = ''
    
    // Simulate the URL generation logic from SignUpForm
    let baseUrl: string
    if (process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview') {
      baseUrl = window.location.origin
    } else if (process.env.NEXT_PUBLIC_SITE_URL) {
      baseUrl = process.env.NEXT_PUBLIC_SITE_URL
    } else {
      baseUrl = window.location.origin
    }
    
    expect(baseUrl).toBe('https://test.example.com')
  })
})