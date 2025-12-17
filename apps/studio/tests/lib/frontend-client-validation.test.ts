/**
 * Frontend Client Validation Tests
 * 
 * Tests for the frontend client URL validation system
 * Requirements: 3.1, 3.2, 3.3, 3.5
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  validateFrontendClientUrls,
  getFrontendClientUrls,
  validateFrontendEnvironmentVariables,
  createValidatedClientConfig,
} from 'common/frontend-client-validation'

// Mock environment variables
const mockEnv = (envVars: Record<string, string | undefined>) => {
  Object.keys(envVars).forEach(key => {
    if (envVars[key] === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = envVars[key]
    }
  })
}

describe('Frontend Client Validation', () => {
  beforeEach(() => {
    // Clear environment variables before each test
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    delete process.env.NEXT_PUBLIC_GOTRUE_URL
    delete process.env.SUPABASE_PUBLIC_URL
    delete process.env.SUPABASE_URL
    delete process.env.SUPABASE_ANON_KEY
    delete process.env.ENVIRONMENT
    delete process.env.NODE_ENV
  })

  describe('getFrontendClientUrls', () => {
    it('should prioritize NEXT_PUBLIC_SUPABASE_URL over other sources', () => {
      mockEnv({
        NEXT_PUBLIC_SUPABASE_URL: 'https://production.supabase.co',
        SUPABASE_PUBLIC_URL: 'https://fallback.supabase.co',
        SUPABASE_URL: 'http://localhost:54321',
      })

      const { supabaseUrl, sources } = getFrontendClientUrls()

      expect(supabaseUrl).toBe('https://production.supabase.co')
      expect(sources.supabaseUrl.source).toBe('NEXT_PUBLIC_SUPABASE_URL')
      expect(sources.supabaseUrl.priority).toBe(1)
    })

    it('should fall back to SUPABASE_PUBLIC_URL when NEXT_PUBLIC_SUPABASE_URL is not set', () => {
      mockEnv({
        SUPABASE_PUBLIC_URL: 'https://fallback.supabase.co',
        SUPABASE_URL: 'http://localhost:54321',
      })

      const { supabaseUrl, sources } = getFrontendClientUrls()

      expect(supabaseUrl).toBe('https://fallback.supabase.co')
      expect(sources.supabaseUrl.source).toBe('SUPABASE_PUBLIC_URL')
      expect(sources.supabaseUrl.priority).toBe(2)
    })

    it('should use hardcoded localhost as final fallback', () => {
      mockEnv({})

      const { supabaseUrl, sources } = getFrontendClientUrls()

      expect(supabaseUrl).toBe('http://127.0.0.1:54321')
      expect(sources.supabaseUrl.source).toBe('hardcoded-localhost')
      expect(sources.supabaseUrl.priority).toBe(4)
    })

    it('should derive GoTrue URL from Supabase URL when not explicitly set', () => {
      mockEnv({
        NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      })

      const { gotrueUrl, sources } = getFrontendClientUrls()

      expect(gotrueUrl).toBe('https://test.supabase.co/auth/v1')
      expect(sources.gotrueUrl?.source).toBe('derived-from-supabase')
    })
  })

  describe('validateFrontendClientUrls', () => {
    it('should detect production environment from HTTPS URLs', () => {
      const validation = validateFrontendClientUrls(
        'https://production.supabase.co',
        'https://production.supabase.co/auth/v1'
      )

      expect(validation.detectedEnvironment).toBe('production')
      expect(validation.isValid).toBe(true)
    })

    it('should detect development environment from localhost URLs', () => {
      mockEnv({
        NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
      })

      const validation = validateFrontendClientUrls(
        'http://localhost:54321',
        'http://localhost:54321/auth/v1'
      )

      expect(validation.detectedEnvironment).toBe('development')
      expect(validation.isValid).toBe(true)
    })

    it('should error when production environment has localhost URLs', () => {
      const validation = validateFrontendClientUrls(
        'http://localhost:54321',
        'http://localhost:54321/auth/v1',
        'production' // Explicitly set to production
      )

      expect(validation.detectedEnvironment).toBe('production')
      expect(validation.isValid).toBe(false)
      expect(validation.errors.some(e => e.includes('Production environment detected but Supabase URL contains localhost'))).toBe(true)
      expect(validation.errors.some(e => e.includes('Production environment detected but GoTrue URL contains localhost'))).toBe(true)
    })

    it('should warn about development ports in production', () => {
      const validation = validateFrontendClientUrls(
        'https://production.supabase.co:54321',
        undefined,
        'production'
      )

      expect(validation.warnings.some(w => w.includes('Production environment using development-like port 54321'))).toBe(true)
    })

    it('should detect staging environment from staging patterns', () => {
      const validation = validateFrontendClientUrls(
        'https://staging.supabase.co',
        'https://staging.supabase.co/auth/v1'
      )

      expect(validation.detectedEnvironment).toBe('staging')
    })
  })

  describe('validateFrontendEnvironmentVariables', () => {
    it('should pass validation when all recommended variables are set', () => {
      mockEnv({
        NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-key',
      })

      const validation = validateFrontendEnvironmentVariables()

      expect(validation.isValid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })

    it('should warn when recommended variables are missing', () => {
      mockEnv({})

      const validation = validateFrontendEnvironmentVariables()

      expect(validation.isValid).toBe(false)
      expect(validation.warnings.some(w => w.includes('Missing recommended environment variables'))).toBe(true)
    })

    it('should error when no URL variables are available', () => {
      mockEnv({
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-key',
      })

      const validation = validateFrontendEnvironmentVariables()

      expect(validation.errors.some(e => e.includes('No Supabase URL environment variables found'))).toBe(true)
    })

    it('should error when no API key variables are available', () => {
      mockEnv({
        NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      })

      const validation = validateFrontendEnvironmentVariables()

      expect(validation.errors.some(e => e.includes('No Supabase API key environment variables found'))).toBe(true)
    })
  })

  describe('createValidatedClientConfig', () => {
    it('should create valid configuration with environment variables', () => {
      mockEnv({
        NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-key',
      })

      const config = createValidatedClientConfig()

      expect(config.supabaseUrl).toBe('https://test.supabase.co')
      expect(config.anonKey).toBe('test-key')
      expect(config.gotrueUrl).toBe('https://test.supabase.co/auth/v1')
    })

    it('should throw error for invalid configuration', () => {
      mockEnv({
        NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-key',
        ENVIRONMENT: 'production', // Force production with localhost URL
      })

      expect(() => {
        try {
          createValidatedClientConfig()
        } catch (error) {
          expect(error.message.includes('Frontend client configuration validation failed')).toBe(true)
          throw error
        }
      }).toThrow()
    })

    it('should allow custom configuration override', () => {
      mockEnv({
        NEXT_PUBLIC_SUPABASE_URL: 'https://default.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'default-key',
      })

      const config = createValidatedClientConfig({
        supabaseUrl: 'https://custom.supabase.co',
        anonKey: 'custom-key',
      })

      expect(config.supabaseUrl).toBe('https://custom.supabase.co')
      expect(config.anonKey).toBe('custom-key')
    })
  })

  describe('URL pattern environment detection', () => {
    it('should detect production from HTTPS URLs', () => {
      const validation = validateFrontendClientUrls('https://example.supabase.co')
      expect(validation.detectedEnvironment).toBe('production')
    })

    it('should detect production from IP addresses', () => {
      const validation = validateFrontendClientUrls('http://192.168.1.100:8000')
      expect(validation.detectedEnvironment).toBe('production')
    })

    it('should detect production from domain names', () => {
      const validation = validateFrontendClientUrls('http://api.example.com')
      expect(validation.detectedEnvironment).toBe('production')
    })

    it('should detect development from localhost patterns', () => {
      mockEnv({
        NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
      })
      
      const validation = validateFrontendClientUrls('http://localhost:54321')
      expect(validation.detectedEnvironment).toBe('development')
    })

    it('should detect development from 127.0.0.1', () => {
      mockEnv({
        NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      })
      
      const validation = validateFrontendClientUrls('http://127.0.0.1:54321')
      expect(validation.detectedEnvironment).toBe('development')
    })

    it('should detect staging from staging patterns', () => {
      const stagingUrls = [
        'https://staging.supabase.co',
        'https://stg-api.example.com',
        'https://test.example.com',
        'https://dev-preview.example.com',
      ]

      stagingUrls.forEach(url => {
        const validation = validateFrontendClientUrls(url)
        expect(validation.detectedEnvironment).toBe('staging')
      })
    })
  })
})