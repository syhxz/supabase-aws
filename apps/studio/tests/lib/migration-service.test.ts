/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MigrationService } from '../../lib/migration/MigrationService'
import type { PoolClient } from 'pg'

// Mock pg module
vi.mock('pg', () => {
  const mockClient = {
    query: vi.fn((sql: string, params?: any[]) => {
      // Mock BEGIN/COMMIT/ROLLBACK
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
        return Promise.resolve({ rows: [], rowCount: 0 })
      }
      
      // Mock COUNT queries
      if (sql.includes('COUNT(*)')) {
        return Promise.resolve({ rows: [{ count: '10' }], rowCount: 1 })
      }
      
      // Mock SELECT queries for auth data
      if (sql.includes('FROM auth.users')) {
        return Promise.resolve({
          rows: [
            {
              id: 'user-1',
              email: 'test@example.com',
              encrypted_password: 'hashed',
              created_at: new Date(),
              updated_at: new Date(),
              raw_app_meta_data: { project_ref: params?.[0] || 'test-project' },
              raw_user_meta_data: {},
            },
          ],
          rowCount: 1,
        })
      }
      
      // Mock SELECT queries for sessions
      if (sql.includes('FROM auth.sessions')) {
        return Promise.resolve({
          rows: [
            {
              id: 'session-1',
              user_id: 'user-1',
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
          rowCount: 1,
        })
      }
      
      // Mock SELECT queries for refresh tokens
      if (sql.includes('FROM auth.refresh_tokens')) {
        return Promise.resolve({
          rows: [
            {
              id: 1,
              token: 'token-1',
              user_id: 'user-1',
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
          rowCount: 1,
        })
      }
      
      // Mock SELECT queries for storage buckets
      if (sql.includes('FROM storage.buckets')) {
        return Promise.resolve({
          rows: [
            {
              id: 'test-project-bucket-1',
              name: 'bucket-1',
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
          rowCount: 1,
        })
      }
      
      // Mock SELECT queries for storage objects
      if (sql.includes('FROM storage.objects')) {
        return Promise.resolve({
          rows: [
            {
              id: 'object-1',
              bucket_id: 'test-project-bucket-1',
              name: 'file.txt',
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
          rowCount: 1,
        })
      }
      
      // Mock INSERT queries
      if (sql.includes('INSERT INTO')) {
        return Promise.resolve({ rows: [], rowCount: 1 })
      }
      
      // Mock TRUNCATE queries
      if (sql.includes('TRUNCATE TABLE')) {
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
    options: {
      connectionString: 'postgresql://localhost:5432/postgres',
    },
  }

  return {
    Pool: vi.fn(() => mockPool),
  }
})

// Mock fs/promises
vi.mock('fs/promises', () => ({
  default: {
    mkdir: vi.fn(() => Promise.resolve()),
    writeFile: vi.fn(() => Promise.resolve()),
    readFile: vi.fn((path: string) => {
      if (path.includes('metadata.json')) {
        return Promise.resolve(JSON.stringify({
          backupId: 'backup_test-project_123',
          projectRef: 'test-project',
          databaseName: 'test_db',
          timestamp: new Date().toISOString(),
          backupPath: '/var/lib/backups/backup_test-project_123',
          tables: ['auth.users', 'auth.sessions', 'storage.buckets'],
          rowCounts: {
            'auth.users': 10,
            'auth.sessions': 5,
            'storage.buckets': 3,
          },
        }))
      }
      // Mock table data files
      return Promise.resolve(JSON.stringify([
        { id: 'test-1', name: 'test' },
      ]))
    }),
    rm: vi.fn(() => Promise.resolve()),
  },
}))

// Mock ProjectInitializationService
vi.mock('../../lib/project-initialization/ProjectInitializationService', () => ({
  ProjectInitializationService: vi.fn().mockImplementation(() => ({
    initializeProject: vi.fn(() => Promise.resolve({
      success: true,
      projectRef: 'test-project',
      databaseName: 'test_db',
      schemasCreated: ['auth', 'storage', 'webhooks', 'analytics'],
    })),
    close: vi.fn(() => Promise.resolve()),
  })),
}))

describe('MigrationService', () => {
  let service: MigrationService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new MigrationService(
      'postgresql://localhost:5432/postgres',
      '/var/lib/backups'
    )
  })

  afterEach(async () => {
    await service.close()
  })

  describe('backupProjectData', () => {
    it('should create a backup with metadata', async () => {
      const backup = await service.backupProjectData('test-project', 'test_db')

      expect(backup.projectRef).toBe('test-project')
      expect(backup.databaseName).toBe('test_db')
      expect(backup.backupId).toMatch(/^backup_test-project_\d+$/)
      expect(backup.tables).toContain('auth.users')
      expect(backup.tables).toContain('storage.buckets')
      expect(backup.rowCounts).toBeDefined()
    })

    it('should create backup directory', async () => {
      const fs = await import('fs/promises')
      
      await service.backupProjectData('test-project', 'test_db')

      expect(fs.default.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('backup_test-project_'),
        { recursive: true }
      )
    })

    it('should save backup metadata', async () => {
      const fs = await import('fs/promises')
      
      await service.backupProjectData('test-project', 'test_db')

      expect(fs.default.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('metadata.json'),
        expect.stringContaining('test-project')
      )
    })

    it('should backup all required tables', async () => {
      const fs = await import('fs/promises')
      
      await service.backupProjectData('test-project', 'test_db')

      // Check that all table files were written
      expect(fs.default.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('auth_users.json'),
        expect.any(String)
      )
      expect(fs.default.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('storage_buckets.json'),
        expect.any(String)
      )
    })

    it('should throw error on backup failure', async () => {
      const { Pool } = await import('pg')
      const mockPool = new Pool()
      const mockClient = await mockPool.connect()
      vi.mocked(mockClient.query).mockRejectedValueOnce(new Error('Database error'))

      await expect(
        service.backupProjectData('test-project', 'test_db')
      ).rejects.toThrow('Backup failed')
    })
  })

  describe('migrateAuthData', () => {
    it('should migrate users from source to target', async () => {
      const { Pool } = await import('pg')
      const mockPool = new Pool()
      const sourceClient = await mockPool.connect()
      const targetClient = await mockPool.connect()

      await service.migrateAuthData(sourceClient, targetClient, 'test-project')

      // Verify INSERT was called for users
      expect(targetClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO auth.users'),
        expect.any(Array)
      )
    })

    it('should migrate sessions from source to target', async () => {
      const { Pool } = await import('pg')
      const mockPool = new Pool()
      const sourceClient = await mockPool.connect()
      const targetClient = await mockPool.connect()

      await service.migrateAuthData(sourceClient, targetClient, 'test-project')

      // Verify INSERT was called for sessions
      expect(targetClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO auth.sessions'),
        expect.any(Array)
      )
    })

    it('should migrate refresh tokens from source to target', async () => {
      const { Pool } = await import('pg')
      const mockPool = new Pool()
      const sourceClient = await mockPool.connect()
      const targetClient = await mockPool.connect()

      await service.migrateAuthData(sourceClient, targetClient, 'test-project')

      // Verify INSERT was called for refresh tokens
      expect(targetClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO auth.refresh_tokens'),
        expect.any(Array)
      )
    })
  })

  describe('migrateStorageData', () => {
    it('should migrate buckets from source to target', async () => {
      const { Pool } = await import('pg')
      const mockPool = new Pool()
      const sourceClient = await mockPool.connect()
      const targetClient = await mockPool.connect()

      await service.migrateStorageData(sourceClient, targetClient, 'test-project')

      // Verify INSERT was called for buckets
      expect(targetClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO storage.buckets'),
        expect.any(Array)
      )
    })

    it('should migrate objects from source to target', async () => {
      const { Pool } = await import('pg')
      const mockPool = new Pool()
      const sourceClient = await mockPool.connect()
      const targetClient = await mockPool.connect()

      await service.migrateStorageData(sourceClient, targetClient, 'test-project')

      // Verify INSERT was called for objects
      expect(targetClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO storage.objects'),
        expect.any(Array)
      )
    })
  })

  describe('verifyDataIntegrity', () => {
    it('should verify auth data integrity', async () => {
      const backupMetadata = {
        backupId: 'backup_test_123',
        projectRef: 'test-project',
        databaseName: 'test_db',
        timestamp: new Date(),
        backupPath: '/var/lib/backups/backup_test_123',
        tables: ['auth.users'],
        rowCounts: {
          'auth.users': 10,
          'storage.buckets': 3,
        },
      }

      const result = await service.verifyDataIntegrity(
        'test-project',
        'test_db',
        backupMetadata
      )

      expect(result.checks.authDataIntegrity).toBe(true)
    })

    it('should verify storage data integrity', async () => {
      const backupMetadata = {
        backupId: 'backup_test_123',
        projectRef: 'test-project',
        databaseName: 'test_db',
        timestamp: new Date(),
        backupPath: '/var/lib/backups/backup_test_123',
        tables: ['storage.buckets'],
        rowCounts: {
          'auth.users': 10,
          'storage.buckets': 3,
        },
      }

      const result = await service.verifyDataIntegrity(
        'test-project',
        'test_db',
        backupMetadata
      )

      expect(result.checks.storageDataIntegrity).toBe(true)
    })

    it('should compare row counts with backup', async () => {
      const backupMetadata = {
        backupId: 'backup_test_123',
        projectRef: 'test-project',
        databaseName: 'test_db',
        timestamp: new Date(),
        backupPath: '/var/lib/backups/backup_test_123',
        tables: ['auth.users', 'storage.buckets'],
        rowCounts: {
          'auth.users': 10,
          'storage.buckets': 10,
        },
      }

      const result = await service.verifyDataIntegrity(
        'test-project',
        'test_db',
        backupMetadata
      )

      expect(result.details.rowCountComparison).toBeDefined()
      expect(result.details.rowCountComparison.authUsers).toBeDefined()
      expect(result.details.rowCountComparison.storageBuckets).toBeDefined()
    })

    it('should return success false on verification failure', async () => {
      const { Pool } = await import('pg')
      const mockPool = new Pool()
      const mockClient = await mockPool.connect()
      vi.mocked(mockClient.query).mockRejectedValueOnce(new Error('Query failed'))

      const backupMetadata = {
        backupId: 'backup_test_123',
        projectRef: 'test-project',
        databaseName: 'test_db',
        timestamp: new Date(),
        backupPath: '/var/lib/backups/backup_test_123',
        tables: ['auth.users'],
        rowCounts: { 'auth.users': 10 },
      }

      const result = await service.verifyDataIntegrity(
        'test-project',
        'test_db',
        backupMetadata
      )

      expect(result.success).toBe(false)
      expect(result.details.error).toBeDefined()
    })
  })

  describe('restoreFromBackup', () => {
    it('should read backup metadata', async () => {
      const fs = await import('fs/promises')
      
      await service.restoreFromBackup('backup_test-project_123', 'test_db')

      expect(fs.default.readFile).toHaveBeenCalledWith(
        expect.stringContaining('metadata.json'),
        'utf-8'
      )
    })

    it('should truncate tables before restore', async () => {
      const { Pool } = await import('pg')
      const mockPool = new Pool()
      const mockClient = await mockPool.connect()

      await service.restoreFromBackup('backup_test-project_123', 'test_db')

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('TRUNCATE TABLE')
      )
    })

    it('should restore data from backup files', async () => {
      const fs = await import('fs/promises')
      
      await service.restoreFromBackup('backup_test-project_123', 'test_db')

      // Verify table data files were read
      expect(fs.default.readFile).toHaveBeenCalledWith(
        expect.stringContaining('auth_users.json'),
        'utf-8'
      )
    })

    it('should use transactions for restore', async () => {
      const { Pool } = await import('pg')
      const mockPool = new Pool()
      const mockClient = await mockPool.connect()

      await service.restoreFromBackup('backup_test-project_123', 'test_db')

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN')
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT')
    })

    it('should rollback on restore failure', async () => {
      const { Pool } = await import('pg')
      const mockPool = new Pool()
      const mockClient = await mockPool.connect()
      
      // Make TRUNCATE fail
      vi.mocked(mockClient.query).mockImplementation((sql: string) => {
        if (sql === 'BEGIN') return Promise.resolve({ rows: [], rowCount: 0 })
        if (sql.includes('TRUNCATE')) return Promise.reject(new Error('Truncate failed'))
        return Promise.resolve({ rows: [], rowCount: 0 })
      })

      await expect(
        service.restoreFromBackup('backup_test-project_123', 'test_db')
      ).rejects.toThrow('Restore failed')

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK')
    })
  })

  describe('migrateProject', () => {
    it('should create backup before migration', async () => {
      const fs = await import('fs/promises')
      
      await service.migrateProject('test-project', 'test_db', 'user-123')

      expect(fs.default.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('backup_test-project_'),
        { recursive: true }
      )
    })

    it('should return error details on failure', async () => {
      const { Pool } = await import('pg')
      const mockPool = new Pool()
      const mockClient = await mockPool.connect()
      vi.mocked(mockClient.query).mockRejectedValueOnce(new Error('Database error'))

      const result = await service.migrateProject('test-project', 'test_db', 'user-123')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Database error')
    })
  })
})
