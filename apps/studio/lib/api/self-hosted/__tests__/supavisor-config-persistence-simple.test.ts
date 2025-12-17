import { describe, it, expect } from 'vitest'
import { SupavisorConfigPersistence } from '../supavisor-config-persistence'

describe('SupavisorConfigPersistence - Validation', () => {
  let persistence: SupavisorConfigPersistence

  beforeEach(() => {
    persistence = new SupavisorConfigPersistence()
  })

  describe('validateUpdateRequest', () => {
    it('should reject empty configuration updates', async () => {
      await expect(
        persistence.updateConfiguration('test-project', {})
      ).rejects.toThrow('No configuration updates provided')
    })

    it('should validate pool size is positive integer', async () => {
      await expect(
        persistence.updateConfiguration('test-project', {
          poolSize: -5
        })
      ).rejects.toThrow('Pool size must be a positive integer')
    })

    it('should validate pool size maximum limit', async () => {
      await expect(
        persistence.updateConfiguration('test-project', {
          poolSize: 1500
        })
      ).rejects.toThrow('Pool size cannot exceed 1000 connections')
    })

    it('should validate max client connections is positive integer', async () => {
      await expect(
        persistence.updateConfiguration('test-project', {
          maxClientConnections: -10
        })
      ).rejects.toThrow('Max client connections must be a positive integer')
    })

    it('should validate max client connections maximum limit', async () => {
      await expect(
        persistence.updateConfiguration('test-project', {
          maxClientConnections: 15000
        })
      ).rejects.toThrow('Max client connections cannot exceed 10000')
    })

    it('should validate pool mode values', async () => {
      await expect(
        persistence.updateConfiguration('test-project', {
          poolMode: 'invalid-mode' as any
        })
      ).rejects.toThrow('Pool mode must be one of: session, transaction, statement')
    })

    it('should validate port range', async () => {
      await expect(
        persistence.updateConfiguration('test-project', {
          port: 70000
        })
      ).rejects.toThrow('Port must be an integer between 1 and 65535')
    })

    it('should validate tenant ID format', async () => {
      await expect(
        persistence.updateConfiguration('test-project', {
          tenantId: 'invalid@tenant!'
        })
      ).rejects.toThrow('Tenant ID can only contain letters, numbers, hyphens, and underscores')
    })

    it('should validate tenant ID length', async () => {
      const longTenantId = 'a'.repeat(70)
      
      await expect(
        persistence.updateConfiguration('test-project', {
          tenantId: longTenantId
        })
      ).rejects.toThrow('Tenant ID cannot exceed 64 characters')
    })

    it('should validate database pool size limits', async () => {
      await expect(
        persistence.updateConfiguration('test-project', {
          dbPoolSize: 150
        })
      ).rejects.toThrow('Database pool size cannot exceed 100 connections')
    })

    it('should accept valid configuration updates', () => {
      // This should not throw during validation phase
      const validUpdates = {
        poolSize: 25,
        maxClientConnections: 150,
        poolMode: 'session' as const,
        tenantId: 'valid-tenant-123',
        port: 6543,
        dbPoolSize: 10
      }

      // We can't test the full update without mocking, but we can test that validation passes
      expect(() => {
        // Access the private validation method for testing
        ;(persistence as any).validateUpdateRequest(validUpdates)
      }).not.toThrow()
    })
  })

  describe('applyConfigurationUpdates', () => {
    it('should correctly apply pool size updates', () => {
      const currentConfig = {
        POOLER_DEFAULT_POOL_SIZE: 20,
        POOLER_MAX_CLIENT_CONN: 100,
        POOLER_PROXY_PORT_TRANSACTION: 6543,
        POOLER_TENANT_ID: 'test-tenant',
        POOLER_DB_POOL_SIZE: 5
      }

      const updates = { poolSize: 30 }
      
      const result = (persistence as any).applyConfigurationUpdates(currentConfig, updates)
      
      expect(result.POOLER_DEFAULT_POOL_SIZE).toBe(30)
      expect(result.POOLER_MAX_CLIENT_CONN).toBe(100) // Should remain unchanged
    })

    it('should correctly apply multiple updates', () => {
      const currentConfig = {
        POOLER_DEFAULT_POOL_SIZE: 20,
        POOLER_MAX_CLIENT_CONN: 100,
        POOLER_PROXY_PORT_TRANSACTION: 6543,
        POOLER_TENANT_ID: 'test-tenant',
        POOLER_DB_POOL_SIZE: 5
      }

      const updates = {
        poolSize: 30,
        maxClientConnections: 150,
        poolMode: 'session' as const,
        tenantId: 'new-tenant'
      }
      
      const result = (persistence as any).applyConfigurationUpdates(currentConfig, updates)
      
      expect(result.POOLER_DEFAULT_POOL_SIZE).toBe(30)
      expect(result.POOLER_MAX_CLIENT_CONN).toBe(150)
      expect(result.SUPAVISOR_MODE).toBe('session')
      expect(result.POOLER_TENANT_ID).toBe('new-tenant')
      expect(result.POOLER_PROXY_PORT_TRANSACTION).toBe(6543) // Should remain unchanged
    })
  })

  describe('parseEnvFileContent', () => {
    it('should parse environment file content correctly', () => {
      const envContent = `
# Database configuration
POSTGRES_PASSWORD=secret123

# Supavisor configuration
POOLER_DEFAULT_POOL_SIZE=25
POOLER_MAX_CLIENT_CONN=150
POOLER_TENANT_ID=test-tenant

# Other services
KONG_HTTP_PORT=8000
`

      const result = (persistence as any).parseEnvFileContent(envContent)
      
      expect(result.POOLER_DEFAULT_POOL_SIZE).toBe(25)
      expect(result.POOLER_MAX_CLIENT_CONN).toBe(150)
      expect(result.POOLER_TENANT_ID).toBe('test-tenant')
      // Should not include non-Supavisor variables
      expect(result.POSTGRES_PASSWORD).toBeUndefined()
      expect(result.KONG_HTTP_PORT).toBeUndefined()
    })

    it('should handle malformed lines gracefully', () => {
      const envContent = `
POOLER_DEFAULT_POOL_SIZE=25
INVALID_LINE_WITHOUT_EQUALS
POOLER_MAX_CLIENT_CONN=150
=INVALID_EMPTY_KEY
POOLER_TENANT_ID=test-tenant
`

      const result = (persistence as any).parseEnvFileContent(envContent)
      
      expect(result.POOLER_DEFAULT_POOL_SIZE).toBe(25)
      expect(result.POOLER_MAX_CLIENT_CONN).toBe(150)
      expect(result.POOLER_TENANT_ID).toBe('test-tenant')
    })

    it('should handle numeric values correctly', () => {
      const envContent = `
POOLER_DEFAULT_POOL_SIZE=30
POOLER_MAX_CLIENT_CONN=200
POOLER_PROXY_PORT_TRANSACTION=6543
POOLER_DB_POOL_SIZE=8
`

      const result = (persistence as any).parseEnvFileContent(envContent)
      
      expect(typeof result.POOLER_DEFAULT_POOL_SIZE).toBe('number')
      expect(typeof result.POOLER_MAX_CLIENT_CONN).toBe('number')
      expect(typeof result.POOLER_PROXY_PORT_TRANSACTION).toBe('number')
      expect(typeof result.POOLER_DB_POOL_SIZE).toBe('number')
      
      expect(result.POOLER_DEFAULT_POOL_SIZE).toBe(30)
      expect(result.POOLER_MAX_CLIENT_CONN).toBe(200)
    })
  })
})