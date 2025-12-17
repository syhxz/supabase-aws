/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ProjectInitializationService } from '../../lib/project-initialization'
import type { PoolClient } from 'pg'

// Mock pg module
vi.mock('pg', () => {
  const mockClient = {
    query: vi.fn((sql: string) => {
      // Mock successful responses for all queries
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
        return Promise.resolve({ rows: [], rowCount: 0 })
      }
      if (sql.includes('pg_settings')) {
        return Promise.resolve({ rows: [{ setting: 'logical' }], rowCount: 1 })
      }
      if (sql.includes('pg_publication')) {
        return Promise.resolve({ rows: [], rowCount: 0 })
      }
      // Default success response
      return Promise.resolve({ rows: [], rowCount: 0 })
    }),
    release: vi.fn(),
  }

  const mockPool = {
    connect: vi.fn(() => Promise.resolve(mockClient)),
    end: vi.fn(() => Promise.resolve()),
  }

  return {
    Pool: vi.fn(() => mockPool),
  }
})

// Mock fs/promises
vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn((path: string) => {
      if (path.includes('auth-schema.sql')) {
        return Promise.resolve('CREATE SCHEMA IF NOT EXISTS auth;')
      }
      if (path.includes('migrate-auth-schema.sql')) {
        return Promise.resolve('ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS instance_id UUID;')
      }
      if (path.includes('storage-schema.sql')) {
        return Promise.resolve('CREATE SCHEMA IF NOT EXISTS storage;')
      }
      if (path.includes('webhooks-schema.sql')) {
        return Promise.resolve('CREATE SCHEMA IF NOT EXISTS webhooks;')
      }
      if (path.includes('analytics-schema.sql')) {
        return Promise.resolve('CREATE SCHEMA IF NOT EXISTS analytics;')
      }
      if (path.includes('rollback-schemas.sql')) {
        return Promise.resolve('DROP SCHEMA IF EXISTS auth CASCADE;')
      }
      return Promise.resolve('')
    }),
    mkdir: vi.fn(() => Promise.resolve()),
    rm: vi.fn(() => Promise.resolve()),
  },
}))

describe('ProjectInitializationService', () => {
  let service: ProjectInitializationService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new ProjectInitializationService('postgresql://localhost:5432/test')
  })

  afterEach(async () => {
    await service.close()
  })

  describe('initializeProject', () => {
    it('should successfully initialize a project with all schemas', async () => {
      const result = await service.initializeProject('test-project', 'test_db')

      expect(result.success).toBe(true)
      expect(result.projectRef).toBe('test-project')
      expect(result.databaseName).toBe('test_db')
      expect(result.schemasCreated).toEqual(['auth', 'storage', 'webhooks', 'analytics'])
      expect(result.error).toBeUndefined()
    })

    it('should include all required schemas in schemasCreated', async () => {
      const result = await service.initializeProject('test-project', 'test_db')

      expect(result.schemasCreated).toContain('auth')
      expect(result.schemasCreated).toContain('storage')
      expect(result.schemasCreated).toContain('webhooks')
      expect(result.schemasCreated).toContain('analytics')
    })

    it('should return error information when initialization fails', async () => {
      // Mock a failure
      const { Pool } = await import('pg')
      const mockPool = new Pool()
      const mockClient = await mockPool.connect()
      vi.mocked(mockClient.query).mockRejectedValueOnce(new Error('Database connection failed'))

      const result = await service.initializeProject('test-project', 'test_db')

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error).toContain('Database connection failed')
    })
  })

  describe('createProjectDirectories', () => {
    it('should create all required directories', async () => {
      const fs = await import('fs/promises')
      
      await service.createProjectDirectories('test-project', '/tmp/test')

      expect(fs.default.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('functions/test-project'),
        { recursive: true }
      )
      expect(fs.default.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('storage/test-project'),
        { recursive: true }
      )
      expect(fs.default.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('logs/test-project'),
        { recursive: true }
      )
    })
  })

  describe('rollbackInitialization', () => {
    it('should execute rollback script without throwing', async () => {
      await expect(
        service.rollbackInitialization('test-project', 'test_db')
      ).resolves.not.toThrow()
    })
  })

  describe('deleteProjectDirectories', () => {
    it('should delete all project directories', async () => {
      const fs = await import('fs/promises')
      
      await service.deleteProjectDirectories('test-project', '/tmp/test')

      expect(fs.default.rm).toHaveBeenCalledWith(
        expect.stringContaining('functions/test-project'),
        { recursive: true, force: true }
      )
      expect(fs.default.rm).toHaveBeenCalledWith(
        expect.stringContaining('storage/test-project'),
        { recursive: true, force: true }
      )
      expect(fs.default.rm).toHaveBeenCalledWith(
        expect.stringContaining('logs/test-project'),
        { recursive: true, force: true }
      )
    })
  })

  describe('migrateAuthSchema', () => {
    it('should skip auth schema migration during project initialization', async () => {
      const fs = await import('fs/promises')
      const readFileSpy = vi.mocked(fs.default.readFile)

      await service.initializeProject('test-project', 'test_db')

      // Verify migration script was NOT read (because it's skipped to avoid transaction conflicts)
      const migrationCalls = readFileSpy.mock.calls.filter(call => 
        typeof call[0] === 'string' && call[0].includes('migrate-auth-schema.sql')
      )
      expect(migrationCalls.length).toBe(0)
    })

    it('should handle migration errors gracefully without failing initialization', async () => {
      const { Pool } = await import('pg')
      const mockPool = new Pool()
      const mockClient = await mockPool.connect()
      
      // Mock migration failure
      const fs = await import('fs/promises')
      vi.mocked(fs.default.readFile).mockImplementation((path: string) => {
        if (path.includes('migrate-auth-schema.sql')) {
          return Promise.reject(new Error('Migration file not found'))
        }
        if (path.includes('auth-schema.sql')) {
          return Promise.resolve('CREATE SCHEMA IF NOT EXISTS auth;')
        }
        if (path.includes('storage-schema.sql')) {
          return Promise.resolve('CREATE SCHEMA IF NOT EXISTS storage;')
        }
        if (path.includes('webhooks-schema.sql')) {
          return Promise.resolve('CREATE SCHEMA IF NOT EXISTS webhooks;')
        }
        if (path.includes('analytics-schema.sql')) {
          return Promise.resolve('CREATE SCHEMA IF NOT EXISTS analytics;')
        }
        return Promise.resolve('')
      })

      const result = await service.initializeProject('test-project', 'test_db')

      // Initialization should still succeed even if migration fails
      expect(result.success).toBe(true)
      expect(result.schemasCreated).toContain('auth')
    })
  })
})
