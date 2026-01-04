/**
 * Tests for Supavisor Environment Variable Parser and Validator
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  parseSupavisorEnvironmentVariables,
  formatValidationErrors,
  isSupavisorEnvironmentConfigured,
  getDefaultSupavisorConfiguration,
  SUPAVISOR_ENV_SCHEMA,
  type SupavisorEnvironmentConfig,
  type ValidationResult
} from '../supavisor-environment-parser'

describe('Supavisor Environment Parser', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env }
    
    // Clear Supavisor-related environment variables
    for (const schema of SUPAVISOR_ENV_SCHEMA) {
      delete process.env[schema.name]
    }
  })

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv
  })

  describe('parseSupavisorEnvironmentVariables', () => {
    it('should parse valid environment variables correctly', () => {
      // Set valid environment variables
      process.env.POOLER_DEFAULT_POOL_SIZE = '25'
      process.env.POOLER_MAX_CLIENT_CONN = '150'
      process.env.POOLER_PROXY_PORT_TRANSACTION = '6543'
      process.env.POOLER_TENANT_ID = 'test-tenant'
      process.env.POOLER_DB_POOL_SIZE = '10'
      process.env.SUPAVISOR_VERSION = '1.2.3'
      process.env.SUPAVISOR_MODE = 'transaction'
      process.env.SUPAVISOR_CLUSTER_ALIAS = 'test-cluster'

      const { config, validation } = parseSupavisorEnvironmentVariables()

      expect(validation.isValid).toBe(true)
      expect(validation.errors).toHaveLength(0)
      expect(config.POOLER_DEFAULT_POOL_SIZE).toBe(25)
      expect(config.POOLER_MAX_CLIENT_CONN).toBe(150)
      expect(config.POOLER_PROXY_PORT_TRANSACTION).toBe(6543)
      expect(config.POOLER_TENANT_ID).toBe('test-tenant')
      expect(config.POOLER_DB_POOL_SIZE).toBe(10)
      expect(config.SUPAVISOR_VERSION).toBe('1.2.3')
      expect(config.SUPAVISOR_MODE).toBe('transaction')
      expect(config.SUPAVISOR_CLUSTER_ALIAS).toBe('test-cluster')
    })

    it('should use default values for missing optional variables', () => {
      // Set only required variables
      process.env.POOLER_DEFAULT_POOL_SIZE = '20'
      process.env.POOLER_MAX_CLIENT_CONN = '100'
      process.env.POOLER_PROXY_PORT_TRANSACTION = '6543'
      process.env.POOLER_TENANT_ID = 'test-tenant'
      process.env.POOLER_DB_POOL_SIZE = '5'

      const { config, validation } = parseSupavisorEnvironmentVariables()

      expect(validation.isValid).toBe(true)
      expect(config.SUPAVISOR_VERSION).toBeUndefined()
      expect(config.SUPAVISOR_MODE).toBeUndefined()
      expect(config.SUPAVISOR_CLUSTER_ALIAS).toBeUndefined()
    })

    it('should apply default values for missing required variables', () => {
      // Don't set any environment variables
      const { config, validation } = parseSupavisorEnvironmentVariables()

      expect(config.POOLER_DEFAULT_POOL_SIZE).toBe(20)
      expect(config.POOLER_MAX_CLIENT_CONN).toBe(100)
      expect(config.POOLER_PROXY_PORT_TRANSACTION).toBe(6543)
      expect(config.POOLER_TENANT_ID).toBe('default-tenant')
      expect(config.POOLER_DB_POOL_SIZE).toBe(5)
    })

    it('should validate pool size constraints', () => {
      process.env.POOLER_DEFAULT_POOL_SIZE = '0'
      process.env.POOLER_MAX_CLIENT_CONN = '100'
      process.env.POOLER_PROXY_PORT_TRANSACTION = '6543'
      process.env.POOLER_TENANT_ID = 'test-tenant'
      process.env.POOLER_DB_POOL_SIZE = '5'

      const { validation } = parseSupavisorEnvironmentVariables()

      expect(validation.isValid).toBe(false)
      expect(validation.errors).toHaveLength(1)
      expect(validation.errors[0].field).toBe('POOLER_DEFAULT_POOL_SIZE')
      expect(validation.errors[0].code).toBe('INVALID_RANGE')
    })

    it('should validate max client connections constraints', () => {
      process.env.POOLER_DEFAULT_POOL_SIZE = '20'
      process.env.POOLER_MAX_CLIENT_CONN = '-5'
      process.env.POOLER_PROXY_PORT_TRANSACTION = '6543'
      process.env.POOLER_TENANT_ID = 'test-tenant'
      process.env.POOLER_DB_POOL_SIZE = '5'

      const { validation } = parseSupavisorEnvironmentVariables()

      expect(validation.isValid).toBe(false)
      expect(validation.errors).toHaveLength(1)
      expect(validation.errors[0].field).toBe('POOLER_MAX_CLIENT_CONN')
      expect(validation.errors[0].code).toBe('INVALID_RANGE')
    })

    it('should validate port constraints', () => {
      process.env.POOLER_DEFAULT_POOL_SIZE = '20'
      process.env.POOLER_MAX_CLIENT_CONN = '100'
      process.env.POOLER_PROXY_PORT_TRANSACTION = '70000'
      process.env.POOLER_TENANT_ID = 'test-tenant'
      process.env.POOLER_DB_POOL_SIZE = '5'

      const { validation } = parseSupavisorEnvironmentVariables()

      expect(validation.isValid).toBe(false)
      expect(validation.errors).toHaveLength(1)
      expect(validation.errors[0].field).toBe('POOLER_PROXY_PORT_TRANSACTION')
      expect(validation.errors[0].code).toBe('INVALID_RANGE')
    })

    it('should validate tenant ID format', () => {
      process.env.POOLER_DEFAULT_POOL_SIZE = '20'
      process.env.POOLER_MAX_CLIENT_CONN = '100'
      process.env.POOLER_PROXY_PORT_TRANSACTION = '6543'
      process.env.POOLER_TENANT_ID = 'invalid tenant id!'
      process.env.POOLER_DB_POOL_SIZE = '5'

      const { validation } = parseSupavisorEnvironmentVariables()

      expect(validation.isValid).toBe(false)
      expect(validation.errors).toHaveLength(1)
      expect(validation.errors[0].field).toBe('POOLER_TENANT_ID')
      expect(validation.errors[0].code).toBe('INVALID_FORMAT')
    })

    it('should validate mode values', () => {
      process.env.POOLER_DEFAULT_POOL_SIZE = '20'
      process.env.POOLER_MAX_CLIENT_CONN = '100'
      process.env.POOLER_PROXY_PORT_TRANSACTION = '6543'
      process.env.POOLER_TENANT_ID = 'test-tenant'
      process.env.POOLER_DB_POOL_SIZE = '5'
      process.env.SUPAVISOR_MODE = 'invalid-mode'

      const { validation } = parseSupavisorEnvironmentVariables()

      expect(validation.isValid).toBe(false)
      expect(validation.errors).toHaveLength(1)
      expect(validation.errors[0].field).toBe('SUPAVISOR_MODE')
      expect(validation.errors[0].code).toBe('INVALID_OPTION')
    })

    it('should generate warnings for default values in production context', () => {
      process.env.POOLER_DEFAULT_POOL_SIZE = '20'
      process.env.POOLER_MAX_CLIENT_CONN = '100'
      process.env.POOLER_PROXY_PORT_TRANSACTION = '6543'
      process.env.POOLER_TENANT_ID = 'default-tenant'
      process.env.POOLER_DB_POOL_SIZE = '5'

      const { validation } = parseSupavisorEnvironmentVariables()

      expect(validation.isValid).toBe(true)
      expect(validation.warnings).toHaveLength(1)
      expect(validation.warnings[0].field).toBe('POOLER_TENANT_ID')
      expect(validation.warnings[0].code).toBe('DEFAULT_VALUE_WARNING')
    })

    it('should validate configuration consistency', () => {
      process.env.POOLER_DEFAULT_POOL_SIZE = '100'
      process.env.POOLER_MAX_CLIENT_CONN = '50' // Less than pool size
      process.env.POOLER_PROXY_PORT_TRANSACTION = '6543'
      process.env.POOLER_TENANT_ID = 'test-tenant'
      process.env.POOLER_DB_POOL_SIZE = '5'

      const { validation } = parseSupavisorEnvironmentVariables()

      expect(validation.isValid).toBe(true)
      expect(validation.warnings).toHaveLength(1)
      expect(validation.warnings[0].code).toBe('CONFIGURATION_MISMATCH')
    })

    it('should handle invalid number formats', () => {
      process.env.POOLER_DEFAULT_POOL_SIZE = 'not-a-number'
      process.env.POOLER_MAX_CLIENT_CONN = '100'
      process.env.POOLER_PROXY_PORT_TRANSACTION = '6543'
      process.env.POOLER_TENANT_ID = 'test-tenant'
      process.env.POOLER_DB_POOL_SIZE = '5'

      const { validation } = parseSupavisorEnvironmentVariables()

      expect(validation.isValid).toBe(false)
      expect(validation.errors).toHaveLength(1)
      expect(validation.errors[0].field).toBe('POOLER_DEFAULT_POOL_SIZE')
      expect(validation.errors[0].code).toBe('PARSE_ERROR')
    })
  })

  describe('formatValidationErrors', () => {
    it('should format errors and warnings correctly', () => {
      const validation: ValidationResult = {
        isValid: false,
        errors: [
          {
            field: 'POOLER_DEFAULT_POOL_SIZE',
            message: 'Pool size must be greater than 0',
            code: 'INVALID_RANGE',
            value: 0
          }
        ],
        warnings: [
          {
            field: 'POOLER_TENANT_ID',
            message: 'Using default tenant ID is not recommended for production',
            code: 'DEFAULT_VALUE_WARNING',
            value: 'default-tenant'
          }
        ]
      }

      const formatted = formatValidationErrors(validation)

      expect(formatted).toHaveLength(2)
      expect(formatted[0]).toContain('❌')
      expect(formatted[0]).toContain('POOLER_DEFAULT_POOL_SIZE')
      expect(formatted[1]).toContain('⚠️')
      expect(formatted[1]).toContain('POOLER_TENANT_ID')
    })
  })

  describe('isSupavisorEnvironmentConfigured', () => {
    it('should return true for valid configuration', () => {
      process.env.POOLER_DEFAULT_POOL_SIZE = '20'
      process.env.POOLER_MAX_CLIENT_CONN = '100'
      process.env.POOLER_PROXY_PORT_TRANSACTION = '6543'
      process.env.POOLER_TENANT_ID = 'test-tenant'
      process.env.POOLER_DB_POOL_SIZE = '5'

      expect(isSupavisorEnvironmentConfigured()).toBe(true)
    })

    it('should return false for invalid configuration', () => {
      process.env.POOLER_DEFAULT_POOL_SIZE = '0'
      process.env.POOLER_MAX_CLIENT_CONN = '100'
      process.env.POOLER_PROXY_PORT_TRANSACTION = '6543'
      process.env.POOLER_TENANT_ID = 'test-tenant'
      process.env.POOLER_DB_POOL_SIZE = '5'

      expect(isSupavisorEnvironmentConfigured()).toBe(false)
    })
  })

  describe('getDefaultSupavisorConfiguration', () => {
    it('should return configuration with all default values', () => {
      const defaultConfig = getDefaultSupavisorConfiguration()

      expect(defaultConfig.POOLER_DEFAULT_POOL_SIZE).toBe(20)
      expect(defaultConfig.POOLER_MAX_CLIENT_CONN).toBe(100)
      expect(defaultConfig.POOLER_PROXY_PORT_TRANSACTION).toBe(6543)
      expect(defaultConfig.POOLER_TENANT_ID).toBe('default-tenant')
      expect(defaultConfig.POOLER_DB_POOL_SIZE).toBe(5)
    })
  })

  describe('Edge cases', () => {
    it('should handle empty string values', () => {
      process.env.POOLER_DEFAULT_POOL_SIZE = ''
      process.env.POOLER_MAX_CLIENT_CONN = '100'
      process.env.POOLER_PROXY_PORT_TRANSACTION = '6543'
      process.env.POOLER_TENANT_ID = 'test-tenant'
      process.env.POOLER_DB_POOL_SIZE = '5'

      const { config } = parseSupavisorEnvironmentVariables()

      expect(config.POOLER_DEFAULT_POOL_SIZE).toBe(20) // Should use default
    })

    it('should handle whitespace in string values', () => {
      process.env.POOLER_DEFAULT_POOL_SIZE = '20'
      process.env.POOLER_MAX_CLIENT_CONN = '100'
      process.env.POOLER_PROXY_PORT_TRANSACTION = '6543'
      process.env.POOLER_TENANT_ID = '  test-tenant  '
      process.env.POOLER_DB_POOL_SIZE = '5'

      const { config } = parseSupavisorEnvironmentVariables()

      expect(config.POOLER_TENANT_ID).toBe('test-tenant') // Should be trimmed
    })

    it('should handle very large numbers', () => {
      process.env.POOLER_DEFAULT_POOL_SIZE = '2000'
      process.env.POOLER_MAX_CLIENT_CONN = '100'
      process.env.POOLER_PROXY_PORT_TRANSACTION = '6543'
      process.env.POOLER_TENANT_ID = 'test-tenant'
      process.env.POOLER_DB_POOL_SIZE = '5'

      const { validation } = parseSupavisorEnvironmentVariables()

      expect(validation.isValid).toBe(false)
      expect(validation.errors[0].code).toBe('EXCEEDS_MAXIMUM')
    })

    it('should handle decimal numbers for integer fields', () => {
      process.env.POOLER_DEFAULT_POOL_SIZE = '20.5'
      process.env.POOLER_MAX_CLIENT_CONN = '100'
      process.env.POOLER_PROXY_PORT_TRANSACTION = '6543'
      process.env.POOLER_TENANT_ID = 'test-tenant'
      process.env.POOLER_DB_POOL_SIZE = '5'

      const { validation } = parseSupavisorEnvironmentVariables()

      expect(validation.isValid).toBe(false)
      expect(validation.errors[0].code).toBe('INVALID_INTEGER')
    })
  })
})