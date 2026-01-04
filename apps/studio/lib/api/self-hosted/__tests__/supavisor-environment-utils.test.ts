/**
 * Tests for Supavisor Environment Utilities
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  getSupavisorConfigurationStatus,
  getEnvironmentVariableInfo,
  getSupavisorConfigurationWithValidation,
  isEnvironmentVariableValid,
  getEnvironmentVariableMessages,
  generateSetupGuidance,
  validateConfigurationObject,
  getConfigurationSummary,
  SUPAVISOR_ENV_SCHEMA
} from '../supavisor-environment-utils'

describe('Supavisor Environment Utilities', () => {
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

  describe('getSupavisorConfigurationStatus', () => {
    it('should return proper status for valid configuration', () => {
      process.env.POOLER_DEFAULT_POOL_SIZE = '25'
      process.env.POOLER_MAX_CLIENT_CONN = '150'
      process.env.POOLER_PROXY_PORT_TRANSACTION = '6543'
      process.env.POOLER_TENANT_ID = 'test-tenant'
      process.env.POOLER_DB_POOL_SIZE = '10'

      const status = getSupavisorConfigurationStatus()

      expect(status.isConfigured).toBe(true)
      expect(status.hasErrors).toBe(false)
      expect(status.hasWarnings).toBe(false)
      expect(status.errorCount).toBe(0)
      expect(status.warningCount).toBe(0)
      expect(status.missingRequired).toHaveLength(0)
      expect(status.summary).toBe('Supavisor is properly configured')
    })

    it('should return proper status for configuration with errors', () => {
      process.env.POOLER_DEFAULT_POOL_SIZE = '0' // Invalid
      process.env.POOLER_MAX_CLIENT_CONN = '150'
      process.env.POOLER_PROXY_PORT_TRANSACTION = '6543'
      process.env.POOLER_TENANT_ID = 'test-tenant'
      process.env.POOLER_DB_POOL_SIZE = '10'

      const status = getSupavisorConfigurationStatus()

      expect(status.isConfigured).toBe(false)
      expect(status.hasErrors).toBe(true)
      expect(status.errorCount).toBe(1)
      expect(status.summary).toContain('1 error')
    })

    it('should return proper status for configuration with warnings', () => {
      process.env.POOLER_DEFAULT_POOL_SIZE = '25'
      process.env.POOLER_MAX_CLIENT_CONN = '150'
      process.env.POOLER_PROXY_PORT_TRANSACTION = '6543'
      process.env.POOLER_TENANT_ID = 'default-tenant' // Generates warning
      process.env.POOLER_DB_POOL_SIZE = '10'

      const status = getSupavisorConfigurationStatus()

      expect(status.isConfigured).toBe(true)
      expect(status.hasWarnings).toBe(true)
      expect(status.warningCount).toBe(1)
      expect(status.summary).toContain('1 warning')
    })

    it('should identify missing required variables', () => {
      // Don't set any environment variables
      const status = getSupavisorConfigurationStatus()

      expect(status.missingRequired).toContain('POOLER_DEFAULT_POOL_SIZE')
      expect(status.missingRequired).toContain('POOLER_MAX_CLIENT_CONN')
      expect(status.missingRequired).toContain('POOLER_PROXY_PORT_TRANSACTION')
      expect(status.missingRequired).toContain('POOLER_TENANT_ID')
      expect(status.missingRequired).toContain('POOLER_DB_POOL_SIZE')
    })
  })

  describe('getEnvironmentVariableInfo', () => {
    it('should return correct info for set variables', () => {
      process.env.POOLER_DEFAULT_POOL_SIZE = '25'
      process.env.POOLER_TENANT_ID = 'test-tenant'

      const info = getEnvironmentVariableInfo()
      const poolSizeInfo = info.find(i => i.name === 'POOLER_DEFAULT_POOL_SIZE')
      const tenantIdInfo = info.find(i => i.name === 'POOLER_TENANT_ID')

      expect(poolSizeInfo?.isSet).toBe(true)
      expect(poolSizeInfo?.value).toBe('25')
      expect(poolSizeInfo?.hasError).toBe(false)

      expect(tenantIdInfo?.isSet).toBe(true)
      expect(tenantIdInfo?.value).toBe('test-tenant')
      expect(tenantIdInfo?.hasError).toBe(false)
    })

    it('should return correct info for unset variables', () => {
      const info = getEnvironmentVariableInfo()
      const versionInfo = info.find(i => i.name === 'SUPAVISOR_VERSION')

      expect(versionInfo?.isSet).toBe(false)
      expect(versionInfo?.value).toBeUndefined()
      expect(versionInfo?.isRequired).toBe(false)
    })

    it('should identify errors and warnings', () => {
      process.env.POOLER_DEFAULT_POOL_SIZE = '0' // Invalid
      process.env.POOLER_TENANT_ID = 'default-tenant' // Warning

      const info = getEnvironmentVariableInfo()
      const poolSizeInfo = info.find(i => i.name === 'POOLER_DEFAULT_POOL_SIZE')
      const tenantIdInfo = info.find(i => i.name === 'POOLER_TENANT_ID')

      expect(poolSizeInfo?.hasError).toBe(true)
      expect(poolSizeInfo?.errorMessage).toContain('greater than 0')

      expect(tenantIdInfo?.hasWarning).toBe(true)
      expect(tenantIdInfo?.warningMessage).toContain('not recommended for production')
    })
  })

  describe('isEnvironmentVariableValid', () => {
    it('should return true for valid variables', () => {
      process.env.POOLER_DEFAULT_POOL_SIZE = '25'
      process.env.POOLER_MAX_CLIENT_CONN = '150'
      process.env.POOLER_PROXY_PORT_TRANSACTION = '6543'
      process.env.POOLER_TENANT_ID = 'test-tenant'
      process.env.POOLER_DB_POOL_SIZE = '10'

      expect(isEnvironmentVariableValid('POOLER_DEFAULT_POOL_SIZE')).toBe(true)
      expect(isEnvironmentVariableValid('POOLER_TENANT_ID')).toBe(true)
    })

    it('should return false for invalid variables', () => {
      process.env.POOLER_DEFAULT_POOL_SIZE = '0'
      process.env.POOLER_MAX_CLIENT_CONN = '150'
      process.env.POOLER_PROXY_PORT_TRANSACTION = '6543'
      process.env.POOLER_TENANT_ID = 'test-tenant'
      process.env.POOLER_DB_POOL_SIZE = '10'

      expect(isEnvironmentVariableValid('POOLER_DEFAULT_POOL_SIZE')).toBe(false)
    })
  })

  describe('getEnvironmentVariableMessages', () => {
    it('should return error messages for invalid variables', () => {
      process.env.POOLER_DEFAULT_POOL_SIZE = '0'
      process.env.POOLER_MAX_CLIENT_CONN = '150'
      process.env.POOLER_PROXY_PORT_TRANSACTION = '6543'
      process.env.POOLER_TENANT_ID = 'test-tenant'
      process.env.POOLER_DB_POOL_SIZE = '10'

      const messages = getEnvironmentVariableMessages('POOLER_DEFAULT_POOL_SIZE')

      expect(messages.errors).toHaveLength(1)
      expect(messages.errors[0]).toContain('greater than 0')
      // Note: There might be warnings from cross-field validation, so we don't check warnings length
    })

    it('should return warning messages for variables with warnings', () => {
      process.env.POOLER_DEFAULT_POOL_SIZE = '25'
      process.env.POOLER_MAX_CLIENT_CONN = '150'
      process.env.POOLER_PROXY_PORT_TRANSACTION = '6543'
      process.env.POOLER_TENANT_ID = 'default-tenant'
      process.env.POOLER_DB_POOL_SIZE = '10'

      const messages = getEnvironmentVariableMessages('POOLER_TENANT_ID')

      expect(messages.errors).toHaveLength(0)
      expect(messages.warnings).toHaveLength(1)
      expect(messages.warnings[0]).toContain('not recommended for production')
    })
  })

  describe('generateSetupGuidance', () => {
    it('should generate guidance for missing configuration', () => {
      // Don't set any environment variables - this will use defaults but generate warnings
      const guidance = generateSetupGuidance()

      expect(guidance.hasIssues).toBe(true) // Should have warnings about default values
      expect(guidance.exampleConfiguration).toHaveProperty('POOLER_DEFAULT_POOL_SIZE')
      expect(guidance.exampleConfiguration).toHaveProperty('POOLER_TENANT_ID')
      // Should have recommendations about using custom values instead of defaults
      expect(guidance.recommendations.length).toBeGreaterThan(0)
    })

    it('should generate recommendations for warnings', () => {
      process.env.POOLER_DEFAULT_POOL_SIZE = '25'
      process.env.POOLER_MAX_CLIENT_CONN = '150'
      process.env.POOLER_PROXY_PORT_TRANSACTION = '6543'
      process.env.POOLER_TENANT_ID = 'default-tenant'
      process.env.POOLER_DB_POOL_SIZE = '10'

      const guidance = generateSetupGuidance()

      expect(guidance.hasIssues).toBe(true)
      expect(guidance.recommendations.length).toBeGreaterThan(0)
      expect(guidance.recommendations[0]).toContain('POOLER_TENANT_ID')
    })

    it('should return no issues for valid configuration', () => {
      process.env.POOLER_DEFAULT_POOL_SIZE = '25'
      process.env.POOLER_MAX_CLIENT_CONN = '150'
      process.env.POOLER_PROXY_PORT_TRANSACTION = '6543'
      process.env.POOLER_TENANT_ID = 'test-tenant'
      process.env.POOLER_DB_POOL_SIZE = '10'

      const guidance = generateSetupGuidance()

      expect(guidance.hasIssues).toBe(false)
      expect(guidance.requiredActions).toHaveLength(0)
      expect(guidance.recommendations).toHaveLength(0)
    })
  })

  describe('validateConfigurationObject', () => {
    it('should validate a configuration object', () => {
      const config = {
        POOLER_DEFAULT_POOL_SIZE: 25,
        POOLER_MAX_CLIENT_CONN: 150,
        POOLER_PROXY_PORT_TRANSACTION: 6543,
        POOLER_TENANT_ID: 'test-tenant',
        POOLER_DB_POOL_SIZE: 10
      }

      const validation = validateConfigurationObject(config)

      expect(validation.isValid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })

    it('should detect errors in configuration object', () => {
      const config = {
        POOLER_DEFAULT_POOL_SIZE: 0, // Invalid
        POOLER_MAX_CLIENT_CONN: 150,
        POOLER_PROXY_PORT_TRANSACTION: 6543,
        POOLER_TENANT_ID: 'test-tenant',
        POOLER_DB_POOL_SIZE: 10
      }

      const validation = validateConfigurationObject(config)

      expect(validation.isValid).toBe(false)
      expect(validation.errors).toHaveLength(1)
    })

    it('should not affect actual environment variables', () => {
      process.env.POOLER_DEFAULT_POOL_SIZE = '20'
      
      const config = {
        POOLER_DEFAULT_POOL_SIZE: 30
      }

      validateConfigurationObject(config)

      // Environment should be unchanged
      expect(process.env.POOLER_DEFAULT_POOL_SIZE).toBe('20')
    })
  })

  describe('getConfigurationSummary', () => {
    it('should generate a readable summary', () => {
      process.env.POOLER_DEFAULT_POOL_SIZE = '25'
      process.env.POOLER_MAX_CLIENT_CONN = '150'
      process.env.POOLER_PROXY_PORT_TRANSACTION = '6543'
      process.env.POOLER_TENANT_ID = 'test-tenant'
      process.env.POOLER_DB_POOL_SIZE = '10'

      const summary = getConfigurationSummary()

      expect(summary).toContain('Supavisor Configuration Status')
      expect(summary).toContain('Environment Variables')
      expect(summary).toContain('POOLER_DEFAULT_POOL_SIZE')
      expect(summary).toContain('✓') // Should have checkmarks for set variables
    })

    it('should show errors in summary', () => {
      process.env.POOLER_DEFAULT_POOL_SIZE = '0'
      process.env.POOLER_MAX_CLIENT_CONN = '150'
      process.env.POOLER_PROXY_PORT_TRANSACTION = '6543'
      process.env.POOLER_TENANT_ID = 'test-tenant'
      process.env.POOLER_DB_POOL_SIZE = '10'

      const summary = getConfigurationSummary()

      expect(summary).toContain('❌ Errors:')
      expect(summary).toContain('POOLER_DEFAULT_POOL_SIZE')
    })

    it('should show warnings in summary', () => {
      process.env.POOLER_DEFAULT_POOL_SIZE = '25'
      process.env.POOLER_MAX_CLIENT_CONN = '150'
      process.env.POOLER_PROXY_PORT_TRANSACTION = '6543'
      process.env.POOLER_TENANT_ID = 'default-tenant'
      process.env.POOLER_DB_POOL_SIZE = '10'

      const summary = getConfigurationSummary()

      expect(summary).toContain('⚠️  Warnings:')
      expect(summary).toContain('POOLER_TENANT_ID')
    })
  })

  describe('getSupavisorConfigurationWithValidation', () => {
    it('should return comprehensive configuration data', () => {
      process.env.POOLER_DEFAULT_POOL_SIZE = '25'
      process.env.POOLER_MAX_CLIENT_CONN = '150'
      process.env.POOLER_PROXY_PORT_TRANSACTION = '6543'
      process.env.POOLER_TENANT_ID = 'test-tenant'
      process.env.POOLER_DB_POOL_SIZE = '10'

      const result = getSupavisorConfigurationWithValidation()

      expect(result.config).toBeDefined()
      expect(result.validation).toBeDefined()
      expect(result.status).toBeDefined()
      expect(result.variables).toBeDefined()
      expect(result.config.POOLER_DEFAULT_POOL_SIZE).toBe(25)
      expect(result.status.isConfigured).toBe(true)
      expect(result.variables).toHaveLength(SUPAVISOR_ENV_SCHEMA.length)
    })
  })
})