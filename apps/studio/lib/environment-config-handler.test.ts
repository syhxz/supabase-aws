/**
 * Tests for Environment Configuration Handler
 * 
 * Requirements: 3.3, 3.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { 
  EnvironmentConfigHandler, 
  createEnvironmentConfigHandler,
  getEnvironmentConfigHandler,
  setupEnvironmentWatcher,
  type EnvironmentConfig 
} from './environment-config-handler'

// Mock environment variables
const mockEnv = {
  POSTGRES_HOST: 'test-host',
  POSTGRES_PORT: '5433',
  POSTGRES_DB: 'test-db',
  POSTGRES_USER_READ_WRITE: 'test-admin',
  POSTGRES_USER_READ_ONLY: 'test-readonly',
  POSTGRES_PASSWORD: 'test-password',
  ENVIRONMENT: 'test',
  NODE_ENV: 'test'
}

describe('EnvironmentConfigHandler', () => {
  let handler: EnvironmentConfigHandler
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env }
    
    // Set mock environment variables
    Object.assign(process.env, mockEnv)
    
    // Create fresh handler instance
    handler = createEnvironmentConfigHandler()
  })

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv
    vi.clearAllMocks()
  })

  describe('Configuration Loading', () => {
    it('should load configuration from environment variables', () => {
      const config = handler.getCurrentConfig()
      
      expect(config.POSTGRES_HOST).toBe('test-host')
      expect(config.POSTGRES_PORT).toBe(5433)
      expect(config.POSTGRES_DB).toBe('test-db')
      expect(config.POSTGRES_USER_READ_WRITE).toBe('test-admin')
      expect(config.POSTGRES_USER_READ_ONLY).toBe('test-readonly')
      expect(config.POSTGRES_PASSWORD).toBe('test-password')
    })

    it('should use fallback values when environment variables are missing', () => {
      // Clear environment variables
      delete process.env.POSTGRES_HOST
      delete process.env.POSTGRES_PORT
      
      const fallbackHandler = createEnvironmentConfigHandler()
      const config = fallbackHandler.getCurrentConfig()
      
      expect(config.POSTGRES_HOST).toBe('db')
      expect(config.POSTGRES_PORT).toBe(5432)
    })

    it('should accept initial configuration overrides', () => {
      const overrides: Partial<EnvironmentConfig> = {
        POSTGRES_HOST: 'override-host',
        POSTGRES_PORT: 9999
      }
      
      const overrideHandler = createEnvironmentConfigHandler(overrides)
      const config = overrideHandler.getCurrentConfig()
      
      expect(config.POSTGRES_HOST).toBe('override-host')
      expect(config.POSTGRES_PORT).toBe(9999)
      expect(config.POSTGRES_DB).toBe('test-db') // Should still use env value
    })
  })

  describe('Configuration Updates', () => {
    it('should update configuration and notify listeners', () => {
      const listener = vi.fn()
      handler.addConfigChangeListener(listener)
      
      const updates = { POSTGRES_HOST: 'new-host', POSTGRES_PORT: 6543 }
      handler.updateConfig(updates)
      
      const config = handler.getCurrentConfig()
      expect(config.POSTGRES_HOST).toBe('new-host')
      expect(config.POSTGRES_PORT).toBe(6543)
      expect(listener).toHaveBeenCalledWith(expect.objectContaining(updates))
    })

    it('should handle multiple listeners', () => {
      const listener1 = vi.fn()
      const listener2 = vi.fn()
      
      handler.addConfigChangeListener(listener1)
      handler.addConfigChangeListener(listener2)
      
      handler.updateConfig({ POSTGRES_HOST: 'multi-host' })
      
      expect(listener1).toHaveBeenCalled()
      expect(listener2).toHaveBeenCalled()
    })

    it('should allow unsubscribing listeners', () => {
      const listener = vi.fn()
      const unsubscribe = handler.addConfigChangeListener(listener)
      
      unsubscribe()
      handler.updateConfig({ POSTGRES_HOST: 'unsubscribed-host' })
      
      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe('Connection String Generation', () => {
    it('should generate environment-adapted connection strings', () => {
      const connectionString = handler.generateEnvironmentConnectionString({
        projectRef: 'test-project',
        databaseId: 'test-db-id',
        readOnly: false,
        maskPassword: true
      })
      
      expect(connectionString).toContain('test-host')
      expect(connectionString).toContain('5433')
      expect(connectionString).toContain('test-admin')
      expect(connectionString).toContain('[YOUR_PASSWORD]')
    })

    it('should use read-only credentials when specified', () => {
      const connectionString = handler.generateEnvironmentConnectionString({
        projectRef: 'test-project',
        databaseId: 'test-db-id',
        readOnly: true,
        maskPassword: true
      })
      
      expect(connectionString).toContain('test-readonly')
    })

    it('should adapt to different environments', () => {
      // Test production environment
      handler.updateConfig({ ENVIRONMENT: 'production' })
      
      const prodConnectionString = handler.generateEnvironmentConnectionString({
        projectRef: 'test-project',
        databaseId: 'test-db-id'
      })
      
      expect(prodConnectionString).toContain('test-host')
      
      // Test development environment
      handler.updateConfig({ ENVIRONMENT: 'development' })
      
      const devConnectionString = handler.generateEnvironmentConnectionString({
        projectRef: 'test-project',
        databaseId: 'test-db-id'
      })
      
      expect(devConnectionString).toContain('test-host')
    })
  })

  describe('Configuration Validation', () => {
    it('should validate valid configuration', () => {
      const validation = handler.validateConfig()
      
      expect(validation.isValid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })

    it('should detect invalid configuration', () => {
      handler.updateConfig({
        POSTGRES_HOST: '',
        POSTGRES_PORT: -1
      })
      
      const validation = handler.validateConfig()
      
      expect(validation.isValid).toBe(false)
      expect(validation.errors.length).toBeGreaterThan(0)
      expect(validation.errors.some(error => error.includes('POSTGRES_HOST'))).toBe(true)
      expect(validation.errors.some(error => error.includes('POSTGRES_PORT'))).toBe(true)
    })
  })

  describe('Environment Reloading', () => {
    it('should reload configuration from environment', () => {
      // Change environment variable
      process.env.POSTGRES_HOST = 'reloaded-host'
      
      handler.reloadFromEnvironment()
      
      const config = handler.getCurrentConfig()
      expect(config.POSTGRES_HOST).toBe('reloaded-host')
    })

    it('should notify listeners when environment changes', () => {
      const listener = vi.fn()
      handler.addConfigChangeListener(listener)
      
      // Change environment variable
      process.env.POSTGRES_HOST = 'env-changed-host'
      
      handler.reloadFromEnvironment()
      
      expect(listener).toHaveBeenCalled()
    })

    it('should not notify listeners if environment has not changed', () => {
      const listener = vi.fn()
      handler.addConfigChangeListener(listener)
      
      // Reload without changing environment
      handler.reloadFromEnvironment()
      
      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe('All Connection Strings', () => {
    it('should generate all connection string formats', () => {
      const allStrings = handler.getAllConnectionStrings({
        projectRef: 'test-project',
        databaseId: 'test-db-id'
      })
      
      expect(allStrings.postgresql).toContain('postgresql://')
      expect(allStrings.psql).toContain('psql')
      expect(allStrings.jdbc).toContain('jdbc:postgresql://')
      expect(allStrings.dotnet).toContain('Host=')
      expect(allStrings.nodejs).toContain('DATABASE_URL=')
    })
  })
})

describe('Global Environment Config Handler', () => {
  it('should return the same instance', () => {
    const handler1 = getEnvironmentConfigHandler()
    const handler2 = getEnvironmentConfigHandler()
    
    expect(handler1).toBe(handler2)
  })
})

describe('Environment Watcher', () => {
  it('should set up periodic environment checking', () => {
    const handler = createEnvironmentConfigHandler()
    const cleanup = setupEnvironmentWatcher(handler)
    
    expect(typeof cleanup).toBe('function')
    
    // Clean up
    cleanup()
  })
})