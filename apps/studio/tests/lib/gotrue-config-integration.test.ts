/**
 * Integration tests for GoTrue Configuration Management
 * 
 * Tests the integration between configuration validation, hot reload,
 * and the overall configuration management system.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { validateGoTrueConfiguration } from '../../lib/gotrue-config-validation'
import { GoTrueConfigManager } from '../../lib/gotrue-config-manager'

describe('GoTrue Configuration Integration', () => {
  const originalEnv = process.env

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv }
    
    // Clear all GoTrue-related environment variables
    delete process.env.NEXT_PUBLIC_GOTRUE_URL
    delete process.env.SUPABASE_PUBLIC_URL
    delete process.env.API_EXTERNAL_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    delete process.env.NODE_ENV
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('Configuration Validation Integration', () => {
    it('should validate a complete production configuration', () => {
      // Set up valid production configuration
      process.env.NEXT_PUBLIC_GOTRUE_URL = 'https://example.supabase.co/auth/v1'
      process.env.SUPABASE_PUBLIC_URL = 'https://example.supabase.co'
      process.env.API_EXTERNAL_URL = 'https://api.example.com'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.very-long-secure-production-key'
      process.env.NODE_ENV = 'production'

      const result = validateGoTrueConfiguration()

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.environment).toBe('production')
      expect(result.validatedConfig.gotrueUrl).toBe('https://example.supabase.co/auth/v1')
      expect(result.validatedConfig.supabaseUrl).toBe('https://example.supabase.co')
      expect(result.validatedConfig.apiUrl).toBe('https://api.example.com')
    })

    it('should validate a complete development configuration', () => {
      // Set up valid development configuration
      process.env.NODE_ENV = 'development'
      process.env.NEXT_PUBLIC_GOTRUE_URL = 'http://localhost:54321/auth/v1'
      process.env.SUPABASE_PUBLIC_URL = 'http://localhost:54321'
      process.env.API_EXTERNAL_URL = 'http://localhost:8000'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dev-key'

      const result = validateGoTrueConfiguration()

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.environment).toBe('development')
      expect(result.validatedConfig.gotrueUrl).toBe('http://localhost:54321/auth/v1')
    })

    it('should provide comprehensive error reporting for invalid configuration', () => {
      // Set up invalid configuration
      process.env.NEXT_PUBLIC_GOTRUE_URL = 'invalid-url'
      process.env.SUPABASE_PUBLIC_URL = 'also-invalid'
      // Missing API_EXTERNAL_URL and ANON_KEY

      const result = validateGoTrueConfiguration()

      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      
      // Should have specific error types
      const errorTypes = result.errors.map(e => e.type)
      expect(errorTypes).toContain('invalid_format')
      expect(errorTypes).toContain('missing_required')
      
      // Should have remediation steps
      result.errors.forEach(error => {
        expect(error.remediationSteps).toBeInstanceOf(Array)
        expect(error.remediationSteps.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Configuration Manager Integration', () => {
    it('should create configuration manager with validation disabled', async () => {
      const manager = new GoTrueConfigManager({
        validateOnStartup: false,
        enableHotReload: false,
        enableHealthChecks: false,
      })

      await manager.initialize()
      
      const state = manager.getState()
      expect(state.initialized).toBe(true)
      expect(state.validationResult).toBeNull()
      
      manager.shutdown()
    })

    it('should create configuration manager with validation enabled', async () => {
      // Set up valid configuration
      process.env.NEXT_PUBLIC_GOTRUE_URL = 'https://example.supabase.co/auth/v1'
      process.env.SUPABASE_PUBLIC_URL = 'https://example.supabase.co'
      process.env.API_EXTERNAL_URL = 'https://api.example.com'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.valid-key'

      const manager = new GoTrueConfigManager({
        validateOnStartup: true,
        enableHotReload: false,
        enableHealthChecks: false,
      })

      await manager.initialize()
      
      const state = manager.getState()
      expect(state.initialized).toBe(true)
      expect(state.validationResult).toBeDefined()
      expect(state.validationResult?.isValid).toBe(true)
      
      manager.shutdown()
    })

    it('should handle validation failure gracefully', async () => {
      // Set up invalid configuration
      process.env.NEXT_PUBLIC_GOTRUE_URL = 'invalid-url'

      const manager = new GoTrueConfigManager({
        validateOnStartup: true,
        enableHotReload: false,
        enableHealthChecks: false,
        autoRecover: true, // Allow auto-recovery
      })

      await manager.initialize()
      
      const state = manager.getState()
      expect(state.initialized).toBe(true)
      expect(state.validationResult).toBeDefined()
      expect(state.validationResult?.isValid).toBe(false)
      expect(state.errorCount).toBeGreaterThan(0)
      
      manager.shutdown()
    })

    it('should provide status summary', async () => {
      // Set up valid configuration
      process.env.NEXT_PUBLIC_GOTRUE_URL = 'https://example.supabase.co/auth/v1'
      process.env.SUPABASE_PUBLIC_URL = 'https://example.supabase.co'
      process.env.API_EXTERNAL_URL = 'https://api.example.com'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.valid-key'

      const manager = new GoTrueConfigManager({
        validateOnStartup: true,
        enableHotReload: false,
        enableHealthChecks: false,
      })

      await manager.initialize()
      
      const status = manager.getStatusSummary()
      expect(status.overall).toBe('healthy')
      expect(status.validation).toBe('passed')
      expect(status.hotReload).toBe('disabled')
      expect(status.details.errorCount).toBe(0)
      expect(status.details.uptime).toBeGreaterThan(0)
      
      manager.shutdown()
    })
  })

  describe('Error Recovery Integration', () => {
    it('should handle configuration errors with proper error classification', () => {
      // Test various error scenarios
      const testCases = [
        {
          name: 'missing required variables',
          env: {},
          expectedErrorTypes: ['missing_required'],
        },
        {
          name: 'invalid URL formats',
          env: {
            NEXT_PUBLIC_GOTRUE_URL: 'not-a-url',
            SUPABASE_PUBLIC_URL: 'also-invalid',
          },
          expectedErrorTypes: ['invalid_format'],
        },
        {
          name: 'production security issues',
          env: {
            NODE_ENV: 'production',
            NEXT_PUBLIC_GOTRUE_URL: 'http://example.com/auth/v1', // HTTP in production
            SUPABASE_PUBLIC_URL: 'https://example.supabase.co',
            API_EXTERNAL_URL: 'https://api.example.com',
            NEXT_PUBLIC_SUPABASE_ANON_KEY: 'short', // Too short
          },
          expectedErrorTypes: ['security'],
        },
      ]

      testCases.forEach(testCase => {
        // Reset environment
        process.env = { ...originalEnv }
        Object.assign(process.env, testCase.env)

        const result = validateGoTrueConfiguration()
        
        expect(result.isValid).toBe(false)
        
        const actualErrorTypes = result.errors.map(e => e.type)
        testCase.expectedErrorTypes.forEach(expectedType => {
          expect(actualErrorTypes).toContain(expectedType)
        })
      })
    })
  })
})