/**
 * Tests for GoTrue Configuration Validation Module
 * 
 * Tests the comprehensive configuration validation functionality including:
 * - Required environment variable validation
 * - Optional environment variable validation  
 * - Environment-specific configuration validation
 * - Error reporting and remediation steps
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  validateGoTrueConfiguration,
  validateRequiredEnvironmentVariables,
  validateOptionalEnvironmentVariables,
  validateEnvironmentSpecificConfig,
  formatValidationResult,
  type GoTrueConfigValidationResult,
} from '../../lib/gotrue-config-validation'

describe('GoTrue Configuration Validation', () => {
  const originalEnv = process.env

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv }
    
    // Clear all GoTrue-related environment variables
    delete process.env.NEXT_PUBLIC_GOTRUE_URL
    delete process.env.GOTRUE_URL
    delete process.env.SUPABASE_PUBLIC_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.SUPABASE_URL
    delete process.env.API_EXTERNAL_URL
    delete process.env.NEXT_PUBLIC_API_URL
    delete process.env.KONG_HTTP_PORT
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    delete process.env.SUPABASE_ANON_KEY
    delete process.env.ANON_KEY
    delete process.env.JWT_SECRET
    delete process.env.GOTRUE_JWT_SECRET
    delete process.env.DATABASE_URL
    delete process.env.GOTRUE_DB_DRIVER
    delete process.env.NODE_ENV
    delete process.env.ENVIRONMENT
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('validateRequiredEnvironmentVariables', () => {
    it('should pass validation when all required variables are set', () => {
      // Set all required environment variables
      process.env.NEXT_PUBLIC_GOTRUE_URL = 'https://example.supabase.co/auth/v1'
      process.env.SUPABASE_PUBLIC_URL = 'https://example.supabase.co'
      process.env.API_EXTERNAL_URL = 'https://api.example.com'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-anon-key'

      const result = validateRequiredEnvironmentVariables()

      expect(result.errors).toHaveLength(0)
      expect(result.validatedConfig.gotrueUrl).toBe('https://example.supabase.co/auth/v1')
      expect(result.validatedConfig.supabaseUrl).toBe('https://example.supabase.co')
      expect(result.validatedConfig.apiUrl).toBe('https://api.example.com')
      expect(result.validatedConfig.anonKey).toBe('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-anon-key')
    })

    it('should derive GoTrue URL from Supabase URL when not explicitly set', () => {
      process.env.SUPABASE_PUBLIC_URL = 'https://example.supabase.co'
      process.env.API_EXTERNAL_URL = 'https://api.example.com'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-anon-key'

      const result = validateRequiredEnvironmentVariables()

      expect(result.errors).toHaveLength(0)
      expect(result.validatedConfig.gotrueUrl).toBe('https://example.supabase.co/auth/v1')
      expect(result.validatedConfig.supabaseUrl).toBe('https://example.supabase.co')
    })

    it('should derive API URL from Kong port in development', () => {
      process.env.NODE_ENV = 'development'
      process.env.NEXT_PUBLIC_GOTRUE_URL = 'http://localhost:54321/auth/v1'
      process.env.SUPABASE_PUBLIC_URL = 'http://localhost:54321'
      process.env.KONG_HTTP_PORT = '8000'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-anon-key'

      const result = validateRequiredEnvironmentVariables()

      // Should have no errors since API URL will be derived
      expect(result.errors.filter(e => e.key !== 'apiUrl')).toHaveLength(0)
      expect(result.validatedConfig.apiUrl).toBe('http://localhost:8000')
    })

    it('should report errors for missing required variables', () => {
      // No environment variables set
      const result = validateRequiredEnvironmentVariables()

      expect(result.errors.length).toBeGreaterThanOrEqual(3) // At least 3 required variables missing (API URL might be derived)
      
      const errorKeys = result.errors.map(e => e.key)
      expect(errorKeys).toContain('gotrueUrl')
      expect(errorKeys).toContain('supabaseUrl')
      expect(errorKeys).toContain('apiUrl')
      expect(errorKeys).toContain('anonKey')

      // Check that all errors are critical
      result.errors.forEach(error => {
        expect(error.severity).toBe('critical')
        expect(error.type).toBe('missing_required')
        expect(error.remediationSteps).toBeInstanceOf(Array)
        expect(error.remediationSteps.length).toBeGreaterThan(0)
      })
    })

    it('should report errors for invalid URL formats', () => {
      process.env.NEXT_PUBLIC_GOTRUE_URL = 'not-a-valid-url'
      process.env.SUPABASE_PUBLIC_URL = 'also-invalid'
      process.env.API_EXTERNAL_URL = 'still-invalid'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'short' // Too short

      const result = validateRequiredEnvironmentVariables()

      expect(result.errors.length).toBeGreaterThan(0)
      
      const invalidFormatErrors = result.errors.filter(e => e.type === 'invalid_format')
      expect(invalidFormatErrors.length).toBeGreaterThan(0)

      invalidFormatErrors.forEach(error => {
        expect(error.severity).toBe('critical')
        expect(error.currentValue).toBeDefined()
        expect(error.expectedFormat).toBeDefined()
        expect(error.remediationSteps).toBeInstanceOf(Array)
      })
    })

    it('should use fallback environment variables in correct priority order', () => {
      // Set fallback variables only
      process.env.SUPABASE_URL = 'http://localhost:54321' // Fallback for both gotrue and supabase
      process.env.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fallback-key' // Fallback for anon key
      process.env.NODE_ENV = 'development'
      process.env.KONG_HTTP_PORT = '8080' // Custom port

      const result = validateRequiredEnvironmentVariables()

      // Should have no errors since all can be derived or found
      expect(result.errors.filter(e => e.severity === 'critical')).toHaveLength(0)
      expect(result.validatedConfig.gotrueUrl).toBe('http://localhost:54321/auth/v1')
      expect(result.validatedConfig.supabaseUrl).toBe('http://localhost:54321')
      expect(result.validatedConfig.apiUrl).toBe('http://localhost:8080')
      expect(result.validatedConfig.anonKey).toBe('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fallback-key')
    })

    it('should provide specific remediation steps for each configuration type', () => {
      const result = validateRequiredEnvironmentVariables()

      const gotrueError = result.errors.find(e => e.key === 'gotrueUrl')
      if (gotrueError) {
        expect(gotrueError.remediationSteps.some(step => step.includes('NEXT_PUBLIC_GOTRUE_URL'))).toBe(true)
        expect(gotrueError.remediationSteps.some(step => step.includes('development') && step.includes('localhost'))).toBe(true)
      }

      const anonKeyError = result.errors.find(e => e.key === 'anonKey')
      if (anonKeyError) {
        expect(anonKeyError.remediationSteps.some(step => step.includes('Supabase') && step.includes('dashboard'))).toBe(true)
        expect(anonKeyError.remediationSteps.some(step => step.includes('anon public') && step.includes('key'))).toBe(true)
      }
    })
  })

  describe('validateOptionalEnvironmentVariables', () => {
    it('should validate optional variables when present', () => {
      process.env.JWT_SECRET = 'test-jwt-secret'
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test'
      process.env.SMTP_HOST = 'smtp.example.com'
      process.env.GOOGLE_CLIENT_ID = 'google-client-id'

      const result = validateOptionalEnvironmentVariables()

      expect(result.validatedConfig.jwtSecret).toBe('test-jwt-secret')
      expect(result.validatedConfig.databaseUrl).toBe('postgresql://localhost:5432/test')
      expect(result.validatedConfig.smtpHost).toBe('smtp.example.com')
      expect(result.validatedConfig.googleClientId).toBe('google-client-id')
    })

    it('should warn about missing high-importance optional variables', () => {
      // No optional variables set
      const result = validateOptionalEnvironmentVariables()

      const jwtSecretWarning = result.warnings.find(w => w.key === 'jwtSecret')
      expect(jwtSecretWarning).toBeDefined()
      expect(jwtSecretWarning?.type).toBe('missing_optional')
      expect(jwtSecretWarning?.impact).toContain('JWT tokens')
      expect(jwtSecretWarning?.recommendation).toContain('JWT_SECRET')
    })

    it('should use fallback environment variable names', () => {
      // Use alternative environment variable names
      process.env.GOTRUE_JWT_SECRET = 'gotrue-jwt-secret'
      process.env.GOTRUE_DB_DRIVER = 'postgres'
      process.env.GOTRUE_SMTP_HOST = 'gotrue-smtp.example.com'

      const result = validateOptionalEnvironmentVariables()

      expect(result.validatedConfig.jwtSecret).toBe('gotrue-jwt-secret')
      expect(result.validatedConfig.databaseUrl).toBe('postgres')
      expect(result.validatedConfig.smtpHost).toBe('gotrue-smtp.example.com')
    })
  })

  describe('validateEnvironmentSpecificConfig', () => {
    it('should validate production environment requirements', () => {
      const config = {
        gotrueUrl: 'https://example.supabase.co/auth/v1',
        supabaseUrl: 'https://example.supabase.co',
        apiUrl: 'https://api.example.com',
        anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.very-long-secure-production-key-that-meets-requirements',
      }

      const result = validateEnvironmentSpecificConfig(config, 'production')

      expect(result.errors).toHaveLength(0)
      expect(result.warnings).toHaveLength(0)
    })

    it('should warn about HTTP URLs in production', () => {
      const config = {
        gotrueUrl: 'http://example.com/auth/v1', // HTTP in production
        supabaseUrl: 'https://example.supabase.co',
        apiUrl: 'https://api.example.com',
        anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.long-secure-key',
      }

      const result = validateEnvironmentSpecificConfig(config, 'production')

      const httpWarning = result.warnings.find(w => w.type === 'security_concern')
      expect(httpWarning).toBeDefined()
      expect(httpWarning?.message).toContain('HTTPS')
      expect(httpWarning?.key).toBe('gotrueUrl')
    })

    it('should error on short anon keys in production', () => {
      const config = {
        gotrueUrl: 'https://example.supabase.co/auth/v1',
        supabaseUrl: 'https://example.supabase.co',
        apiUrl: 'https://api.example.com',
        anonKey: 'short-key', // Too short for production
      }

      const result = validateEnvironmentSpecificConfig(config, 'production')

      const keyError = result.errors.find(e => e.type === 'security')
      expect(keyError).toBeDefined()
      expect(keyError?.message).toContain('secure anonymous key')
      expect(keyError?.severity).toBe('critical')
    })

    it('should warn about non-localhost URLs in development', () => {
      const config = {
        gotrueUrl: 'https://remote-dev.example.com/auth/v1', // Remote URL in development
        supabaseUrl: 'https://remote-dev.example.com',
        apiUrl: 'https://api.remote-dev.example.com',
        anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dev-key',
      }

      const result = validateEnvironmentSpecificConfig(config, 'development')

      const devWarning = result.warnings.find(w => w.type === 'suboptimal_config')
      expect(devWarning).toBeDefined()
      expect(devWarning?.message).toContain('localhost')
    })

    it('should handle localhost URLs correctly in development', () => {
      const config = {
        gotrueUrl: 'http://localhost:54321/auth/v1',
        supabaseUrl: 'http://localhost:54321',
        apiUrl: 'http://localhost:8000',
        anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dev-key',
      }

      const result = validateEnvironmentSpecificConfig(config, 'development')

      // Should have no errors or warnings for proper localhost setup
      expect(result.errors).toHaveLength(0)
      const localhostWarnings = result.warnings.filter(w => w.message.includes('localhost'))
      expect(localhostWarnings).toHaveLength(0)
    })
  })

  describe('validateGoTrueConfiguration', () => {
    it('should perform comprehensive validation with valid configuration', () => {
      // Set up valid production configuration
      process.env.NEXT_PUBLIC_GOTRUE_URL = 'https://example.supabase.co/auth/v1'
      process.env.SUPABASE_PUBLIC_URL = 'https://example.supabase.co'
      process.env.API_EXTERNAL_URL = 'https://api.example.com'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.very-long-secure-production-key-that-meets-all-requirements'
      process.env.NODE_ENV = 'production'

      const result = validateGoTrueConfiguration()

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.environment).toBe('production')
      expect(result.validatedConfig.gotrueUrl).toBe('https://example.supabase.co/auth/v1')
      expect(result.timestamp).toBeTypeOf('number')
    })

    it('should perform comprehensive validation with invalid configuration', () => {
      // Set up invalid configuration
      process.env.NEXT_PUBLIC_GOTRUE_URL = 'invalid-url'
      process.env.SUPABASE_PUBLIC_URL = 'also-invalid'
      // Missing API_EXTERNAL_URL and ANON_KEY

      const result = validateGoTrueConfiguration()

      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.environment).toBeDefined()
      expect(result.timestamp).toBeTypeOf('number')
    })

    it('should detect development environment correctly', () => {
      // Set up development configuration
      process.env.NODE_ENV = 'development'
      process.env.NEXT_PUBLIC_GOTRUE_URL = 'http://localhost:54321/auth/v1'
      process.env.SUPABASE_PUBLIC_URL = 'http://localhost:54321'
      process.env.API_EXTERNAL_URL = 'http://localhost:8000'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dev-key'

      const result = validateGoTrueConfiguration()

      expect(result.environment).toBe('development')
      expect(result.isValid).toBe(true)
    })

    it('should handle validation errors gracefully', () => {
      // Mock console methods to avoid noise in test output
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      try {
        // Set up a scenario that will cause validation to fail
        process.env.NEXT_PUBLIC_GOTRUE_URL = 'invalid-url'
        
        const result = validateGoTrueConfiguration()
        
        // Should handle the error and return a result
        expect(result.isValid).toBe(false)
        expect(result.errors.length).toBeGreaterThan(0)
        
      } finally {
        consoleSpy.mockRestore()
      }
    })
  })

  describe('formatValidationResult', () => {
    it('should format valid configuration result', () => {
      const result: GoTrueConfigValidationResult = {
        isValid: true,
        errors: [],
        warnings: [{
          type: 'missing_optional',
          message: 'JWT secret not configured',
          key: 'jwtSecret',
          recommendation: 'Set JWT_SECRET environment variable',
          impact: 'JWT validation may not work',
        }],
        validatedConfig: {
          gotrueUrl: 'https://example.supabase.co/auth/v1',
          supabaseUrl: 'https://example.supabase.co',
        },
        environment: 'production',
        timestamp: Date.now(),
      }

      const formatted = formatValidationResult(result)

      expect(formatted).toContain('✅ VALID')
      expect(formatted).toContain('PRODUCTION')
      expect(formatted).toContain('⚠️  WARNINGS:')
      expect(formatted).toContain('JWT secret not configured')
      expect(formatted).toContain('Configuration is valid and ready for use')
    })

    it('should format invalid configuration result', () => {
      const result: GoTrueConfigValidationResult = {
        isValid: false,
        errors: [{
          type: 'missing_required',
          message: 'GoTrue URL is missing',
          key: 'gotrueUrl',
          severity: 'critical',
          remediationSteps: [
            'Set NEXT_PUBLIC_GOTRUE_URL environment variable',
            'Use format: https://your-project.supabase.co/auth/v1',
          ],
        }],
        warnings: [],
        validatedConfig: {},
        environment: 'production',
        timestamp: Date.now(),
      }

      const formatted = formatValidationResult(result)

      expect(formatted).toContain('❌ INVALID')
      expect(formatted).toContain('❌ ERRORS:')
      expect(formatted).toContain('GoTrue URL is missing')
      expect(formatted).toContain('CRITICAL')
      expect(formatted).toContain('Set NEXT_PUBLIC_GOTRUE_URL')
      expect(formatted).toContain('Configuration has critical errors')
    })

    it('should handle results with both errors and warnings', () => {
      const result: GoTrueConfigValidationResult = {
        isValid: false,
        errors: [{
          type: 'invalid_format',
          message: 'Invalid URL format',
          key: 'gotrueUrl',
          currentValue: 'invalid-url',
          expectedFormat: 'https://example.com/auth/v1',
          severity: 'critical',
          remediationSteps: ['Fix URL format'],
        }],
        warnings: [{
          type: 'security_concern',
          message: 'Using HTTP in production',
          key: 'gotrueUrl',
          recommendation: 'Use HTTPS',
          impact: 'Security risk',
        }],
        validatedConfig: {},
        environment: 'production',
        timestamp: Date.now(),
      }

      const formatted = formatValidationResult(result)

      expect(formatted).toContain('❌ ERRORS:')
      expect(formatted).toContain('⚠️  WARNINGS:')
      expect(formatted).toContain('Invalid URL format')
      expect(formatted).toContain('Using HTTP in production')
      expect(formatted).toContain('Current: invalid-url')
      expect(formatted).toContain('Expected: https://example.com/auth/v1')
    })
  })
})