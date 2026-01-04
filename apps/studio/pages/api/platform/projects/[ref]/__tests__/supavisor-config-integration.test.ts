import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMocks } from 'node-mocks-http'
import handler from '../supavisor-config'
import managementHandler from '../supavisor-config-management'

// Mock the configuration service
vi.mock('lib/api/self-hosted/supavisor-configuration-service', () => ({
  SupavisorConfigurationService: vi.fn().mockImplementation(() => ({
    getConfiguration: vi.fn().mockResolvedValue({
      poolSize: 20,
      maxClientConnections: 100,
      poolMode: 'transaction',
      tenantId: 'test-tenant',
      port: 6543,
      managementPort: 4000,
      isEnabled: true,
      status: 'running',
      version: '1.0.0'
    }),
    updateConfiguration: vi.fn().mockResolvedValue({
      poolSize: 25,
      maxClientConnections: 100,
      poolMode: 'transaction',
      tenantId: 'test-tenant',
      port: 6543,
      managementPort: 4000,
      isEnabled: true,
      status: 'running',
      version: '1.0.0'
    })
  }))
}))

// Mock the persistence service
vi.mock('lib/api/self-hosted/supavisor-config-persistence', () => ({
  SupavisorConfigPersistence: vi.fn().mockImplementation(() => ({
    listBackups: vi.fn().mockResolvedValue([
      {
        timestamp: 1640995200000,
        originalConfig: {
          POOLER_DEFAULT_POOL_SIZE: 20,
          POOLER_MAX_CLIENT_CONN: 100,
          POOLER_TENANT_ID: 'test-tenant',
          POOLER_PROXY_PORT_TRANSACTION: 6543,
          POOLER_DB_POOL_SIZE: 5
        },
        originalEnvFile: 'POOLER_DEFAULT_POOL_SIZE=20\nPOOLER_MAX_CLIENT_CONN=100\n',
        backupPath: '/path/to/backup1.env'
      }
    ]),
    rollbackConfiguration: vi.fn().mockResolvedValue(undefined),
    cleanupOldBackups: vi.fn().mockResolvedValue(undefined)
  }))
}))

describe('/api/platform/projects/[ref]/supavisor-config', () => {
  describe('GET', () => {
    it('should return Supavisor configuration', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        query: { ref: 'test-project' }
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(200)
      const data = JSON.parse(res._getData())
      expect(data.data).toEqual({
        poolSize: 20,
        maxClientConnections: 100,
        poolMode: 'transaction',
        tenantId: 'test-tenant',
        port: 6543,
        managementPort: 4000,
        isEnabled: true,
        status: 'running',
        version: '1.0.0'
      })
    })

    it('should return 400 for missing project reference', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        query: {}
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(400)
      const data = JSON.parse(res._getData())
      expect(data.error.message).toBe('Project reference is required')
    })
  })

  describe('PATCH', () => {
    it('should update Supavisor configuration', async () => {
      const { req, res } = createMocks({
        method: 'PATCH',
        query: { ref: 'test-project' },
        body: { poolSize: 25 }
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(200)
      const data = JSON.parse(res._getData())
      expect(data.data.poolSize).toBe(25)
      expect(data.message).toBe('Configuration updated successfully')
    })

    it('should return 400 for invalid request body', async () => {
      const { req, res } = createMocks({
        method: 'PATCH',
        query: { ref: 'test-project' },
        body: null
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(400)
      const data = JSON.parse(res._getData())
      expect(data.error.message).toBe('Configuration updates are required in request body')
    })
  })

  describe('unsupported methods', () => {
    it('should return 405 for POST method', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        query: { ref: 'test-project' }
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(405)
      const data = JSON.parse(res._getData())
      expect(data.error.message).toBe('Method POST Not Allowed')
    })
  })
})

describe('/api/platform/projects/[ref]/supavisor-config-management', () => {
  describe('GET - backups', () => {
    it('should return list of configuration backups', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        query: { ref: 'test-project', action: 'backups' }
      })

      await managementHandler(req, res)

      expect(res._getStatusCode()).toBe(200)
      const data = JSON.parse(res._getData())
      expect(data.data).toHaveLength(1)
      expect(data.data[0]).toEqual({
        timestamp: 1640995200000,
        date: '2022-01-01T00:00:00.000Z',
        backupPath: '/path/to/backup1.env',
        hasEnvFile: true,
        configPreview: {
          poolSize: 20,
          maxClientConnections: 100,
          tenantId: 'test-tenant',
          port: 6543
        }
      })
    })

    it('should return 400 for invalid action', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        query: { ref: 'test-project', action: 'invalid' }
      })

      await managementHandler(req, res)

      expect(res._getStatusCode()).toBe(400)
      const data = JSON.parse(res._getData())
      expect(data.error.message).toBe('Invalid action. Supported actions: backups')
    })
  })

  describe('POST - rollback', () => {
    it('should rollback configuration to specified backup', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        query: { ref: 'test-project' },
        body: {
          action: 'rollback',
          timestamp: 1640995200000
        }
      })

      await managementHandler(req, res)

      expect(res._getStatusCode()).toBe(200)
      const data = JSON.parse(res._getData())
      expect(data.data.success).toBe(true)
      expect(data.data.message).toBe('Configuration rolled back successfully')
    })

    it('should return 400 for missing timestamp', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        query: { ref: 'test-project' },
        body: {
          action: 'rollback'
        }
      })

      await managementHandler(req, res)

      expect(res._getStatusCode()).toBe(400)
      const data = JSON.parse(res._getData())
      expect(data.error.message).toBe('Backup timestamp is required for rollback')
    })
  })

  describe('POST - cleanup', () => {
    it('should cleanup old backups', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        query: { ref: 'test-project' },
        body: {
          action: 'cleanup',
          keepCount: 5
        }
      })

      await managementHandler(req, res)

      expect(res._getStatusCode()).toBe(200)
      const data = JSON.parse(res._getData())
      expect(data.data.success).toBe(true)
      expect(data.data.message).toBe('Old backups cleaned up, keeping 5 most recent backups')
    })

    it('should use default keepCount when not provided', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        query: { ref: 'test-project' },
        body: {
          action: 'cleanup'
        }
      })

      await managementHandler(req, res)

      expect(res._getStatusCode()).toBe(200)
      const data = JSON.parse(res._getData())
      expect(data.data.message).toBe('Old backups cleaned up, keeping 10 most recent backups')
    })
  })
})