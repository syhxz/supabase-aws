import { promises as fs } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SupavisorConfigPersistence } from '../supavisor-config-persistence'
import { DockerContainerService } from '../docker-container-service'
import { SupavisorErrorHandler } from '../supavisor-error-handler'

// Mock the DockerContainerService
vi.mock('../docker-container-service')
const MockedDockerContainerService = DockerContainerService as any

// Create hoisted mocks for fs
const mockFsPromises = vi.hoisted(() => ({
  mkdir: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  readdir: vi.fn(),
  unlink: vi.fn(),
}))

// Mock fs operations for testing
vi.mock('fs', () => ({
  default: {},
  promises: mockFsPromises
}))

describe('SupavisorConfigPersistence', () => {
  let persistence: SupavisorConfigPersistence
  let mockDockerService: any
  let tempDir: string
  let tempEnvFile: string
  let mockFs: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Use the hoisted mocks
    mockFs = mockFsPromises
    
    // Create temporary paths for testing
    tempDir = join(tmpdir(), 'supavisor-test-' + Date.now())
    tempEnvFile = join(tempDir, '.env')
    
    persistence = new SupavisorConfigPersistence(tempEnvFile, join(tempDir, 'backups'))
    
    // Setup mock docker service
    mockDockerService = new MockedDockerContainerService()
    ;(persistence as any).dockerService = mockDockerService
    
    // Mock successful docker operations by default
    mockDockerService.restartContainer = vi.fn().mockResolvedValue({
      success: true,
      message: 'Container restarted successfully'
    })
    
    mockDockerService.getContainerStatus = vi.fn().mockResolvedValue({
      name: 'supavisor',
      status: 'running',
      health: 'healthy',
      uptime: '5 minutes',
      ports: [{ host: 6543, container: 6543 }]
    })

    // Setup default mock implementations
    mockFs.mkdir.mockResolvedValue(undefined)
    mockFs.readFile.mockResolvedValue('POOLER_DEFAULT_POOL_SIZE=20\nPOOLER_MAX_CLIENT_CONN=100\n')
    mockFs.writeFile.mockResolvedValue(undefined)
    mockFs.readdir.mockResolvedValue([])
    mockFs.unlink.mockResolvedValue(undefined)

    // Mock environment variables
    process.env.POOLER_DEFAULT_POOL_SIZE = '20'
    process.env.POOLER_MAX_CLIENT_CONN = '100'
    process.env.POOLER_PROXY_PORT_TRANSACTION = '6543'
    process.env.POOLER_TENANT_ID = 'test-tenant'
    process.env.POOLER_DB_POOL_SIZE = '5'
  })

  afterEach(() => {
    // Clean up environment variables
    delete process.env.POOLER_DEFAULT_POOL_SIZE
    delete process.env.POOLER_MAX_CLIENT_CONN
    delete process.env.POOLER_PROXY_PORT_TRANSACTION
    delete process.env.POOLER_TENANT_ID
    delete process.env.POOLER_DB_POOL_SIZE
  })

  describe('updateConfiguration', () => {
    it('should successfully update pool size configuration', async () => {
      // Mock file operations
      mockFs.mkdir.mockResolvedValue(undefined)
      mockFs.readFile.mockResolvedValue('POOLER_DEFAULT_POOL_SIZE=20\nPOOLER_MAX_CLIENT_CONN=100\n')
      mockFs.writeFile.mockResolvedValue(undefined)
      mockFs.readdir.mockResolvedValue([])

      const result = await persistence.updateConfiguration('test-project', {
        poolSize: 30
      })

      expect(result.success).toBe(true)
      expect(result.updatedConfig.POOLER_DEFAULT_POOL_SIZE).toBe(30)
      expect(result.serviceRestarted).toBe(true)
      expect(result.rollbackAvailable).toBe(true)
      expect(mockDockerService.restartContainer).toHaveBeenCalledWith('supavisor')
    })

    it('should validate configuration updates before applying', async () => {
      await expect(
        persistence.updateConfiguration('test-project', {
          poolSize: -5 // Invalid negative pool size
        })
      ).rejects.toThrow('Pool size must be a positive integer')
    })

    it('should validate maximum pool size limits', async () => {
      await expect(
        persistence.updateConfiguration('test-project', {
          poolSize: 1500 // Exceeds maximum
        })
      ).rejects.toThrow('Pool size cannot exceed 1000 connections')
    })

    it('should validate max client connections', async () => {
      await expect(
        persistence.updateConfiguration('test-project', {
          maxClientConnections: 15000 // Exceeds maximum
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

    it('should validate tenant ID format', async () => {
      await expect(
        persistence.updateConfiguration('test-project', {
          tenantId: 'invalid@tenant!' // Invalid characters
        })
      ).rejects.toThrow('Tenant ID can only contain letters, numbers, hyphens, and underscores')
    })

    it('should create backup before updating configuration', async () => {
      mockFs.mkdir.mockResolvedValue(undefined)
      mockFs.readFile.mockResolvedValue('POOLER_DEFAULT_POOL_SIZE=20\n')
      mockFs.writeFile.mockResolvedValue(undefined)
      mockFs.readdir.mockResolvedValue([])

      const result = await persistence.updateConfiguration('test-project', {
        poolSize: 25
      })

      expect(result.backup).toBeDefined()
      expect(result.backup.originalConfig.POOLER_DEFAULT_POOL_SIZE).toBe(20)
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('env-backup-'),
        expect.any(String),
        'utf-8'
      )
    })

    it('should rollback configuration if service restart fails', async () => {
      mockFs.mkdir.mockResolvedValue(undefined)
      mockFs.readFile.mockResolvedValue('POOLER_DEFAULT_POOL_SIZE=20\n')
      mockFs.writeFile.mockResolvedValue(undefined)
      mockFs.readdir.mockResolvedValue([])

      // Mock service restart failure
      mockDockerService.restartContainer.mockResolvedValueOnce({
        success: false,
        message: 'Container restart failed'
      })

      await expect(
        persistence.updateConfiguration('test-project', {
          poolSize: 25
        })
      ).rejects.toThrow('Configuration update failed and was rolled back')

      // Should have attempted rollback
      expect(mockFs.writeFile).toHaveBeenCalledTimes(3) // backup, update, rollback
    })

    it('should handle multiple configuration updates in one request', async () => {
      mockFs.mkdir.mockResolvedValue(undefined)
      mockFs.readFile.mockResolvedValue('POOLER_DEFAULT_POOL_SIZE=20\nPOOLER_MAX_CLIENT_CONN=100\n')
      mockFs.writeFile.mockResolvedValue(undefined)
      mockFs.readdir.mockResolvedValue([])

      const result = await persistence.updateConfiguration('test-project', {
        poolSize: 30,
        maxClientConnections: 150,
        poolMode: 'session'
      })

      expect(result.success).toBe(true)
      expect(result.updatedConfig.POOLER_DEFAULT_POOL_SIZE).toBe(30)
      expect(result.updatedConfig.POOLER_MAX_CLIENT_CONN).toBe(150)
      expect(result.updatedConfig.SUPAVISOR_MODE).toBe('session')
    })

    it('should preserve non-Supavisor environment variables', async () => {
      const existingEnvContent = `
# Database configuration
POSTGRES_PASSWORD=secret123
POSTGRES_DB=postgres

# Supavisor configuration
POOLER_DEFAULT_POOL_SIZE=20
POOLER_MAX_CLIENT_CONN=100

# Other services
KONG_HTTP_PORT=8000
`

      mockFs.mkdir.mockResolvedValue(undefined)
      mockFs.readFile.mockResolvedValue(existingEnvContent)
      mockFs.writeFile.mockResolvedValue(undefined)
      mockFs.readdir.mockResolvedValue([])

      await persistence.updateConfiguration('test-project', {
        poolSize: 25
      })

      // Check that writeFile was called with content that preserves other variables
      const writeCall = mockFs.writeFile.mock.calls.find(call => 
        call[0] === tempEnvFile && typeof call[1] === 'string'
      )
      
      expect(writeCall).toBeDefined()
      const updatedContent = writeCall![1] as string
      
      expect(updatedContent).toContain('POSTGRES_PASSWORD=secret123')
      expect(updatedContent).toContain('KONG_HTTP_PORT=8000')
      expect(updatedContent).toContain('POOLER_DEFAULT_POOL_SIZE=25')
    })
  })

  describe('rollbackConfiguration', () => {
    it('should restore configuration from backup', async () => {
      const backup = {
        timestamp: Date.now(),
        originalConfig: {
          POOLER_DEFAULT_POOL_SIZE: 15,
          POOLER_MAX_CLIENT_CONN: 80,
          POOLER_PROXY_PORT_TRANSACTION: 6543,
          POOLER_TENANT_ID: 'original-tenant',
          POOLER_DB_POOL_SIZE: 3
        },
        originalEnvFile: 'POOLER_DEFAULT_POOL_SIZE=15\nPOOLER_MAX_CLIENT_CONN=80\n'
      }

      mockFs.writeFile.mockResolvedValue(undefined)

      await persistence.rollbackConfiguration(backup)

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        tempEnvFile,
        backup.originalEnvFile,
        'utf-8'
      )
    })

    it('should handle rollback when backup file is not available', async () => {
      const backup = {
        timestamp: Date.now(),
        originalConfig: {
          POOLER_DEFAULT_POOL_SIZE: 15,
          POOLER_MAX_CLIENT_CONN: 80,
          POOLER_PROXY_PORT_TRANSACTION: 6543,
          POOLER_TENANT_ID: 'original-tenant',
          POOLER_DB_POOL_SIZE: 3
        }
      }

      mockFs.writeFile.mockResolvedValue(undefined)

      await persistence.rollbackConfiguration(backup)

      // Should still work by reconstructing the env file from config object
      expect(mockFs.writeFile).toHaveBeenCalled()
    })
  })

  describe('listBackups', () => {
    it('should list available configuration backups', async () => {
      const backupFiles = [
        'env-backup-1640995200000.env',
        'env-backup-1640995300000.env',
        'other-file.txt'
      ]

      mockFs.readdir.mockResolvedValue(backupFiles as any)
      mockFs.readFile.mockImplementation((path) => {
        if (path.toString().includes('env-backup-1640995200000.env')) {
          return Promise.resolve('POOLER_DEFAULT_POOL_SIZE=20\nPOOLER_MAX_CLIENT_CONN=100\n')
        }
        if (path.toString().includes('env-backup-1640995300000.env')) {
          return Promise.resolve('POOLER_DEFAULT_POOL_SIZE=25\nPOOLER_MAX_CLIENT_CONN=120\n')
        }
        return Promise.reject(new Error('File not found'))
      })

      const backups = await persistence.listBackups()

      expect(backups).toHaveLength(2)
      expect(backups[0].timestamp).toBe(1640995300000) // Most recent first
      expect(backups[1].timestamp).toBe(1640995200000)
      expect(backups[0].originalConfig.POOLER_DEFAULT_POOL_SIZE).toBe(25)
    })

    it('should handle empty backup directory', async () => {
      mockFs.readdir.mockRejectedValue(new Error('Directory not found'))

      const backups = await persistence.listBackups()

      expect(backups).toHaveLength(0)
    })
  })

  describe('cleanupOldBackups', () => {
    it('should remove old backup files beyond keep count', async () => {
      const backupFiles = [
        'env-backup-1640995400000.env', // Keep (most recent)
        'env-backup-1640995300000.env', // Keep
        'env-backup-1640995200000.env', // Remove (oldest)
      ]

      mockFs.readdir.mockResolvedValue(backupFiles as any)
      mockFs.readFile.mockResolvedValue('POOLER_DEFAULT_POOL_SIZE=20\n')
      mockFs.unlink.mockResolvedValue(undefined)

      await persistence.cleanupOldBackups(2) // Keep only 2 most recent

      expect(mockFs.unlink).toHaveBeenCalledTimes(1)
      expect(mockFs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('env-backup-1640995200000.env')
      )
    })

    it('should not remove files if count is within limit', async () => {
      const backupFiles = [
        'env-backup-1640995300000.env',
        'env-backup-1640995200000.env',
      ]

      mockFs.readdir.mockResolvedValue(backupFiles as any)
      mockFs.readFile.mockResolvedValue('POOLER_DEFAULT_POOL_SIZE=20\n')
      mockFs.unlink.mockResolvedValue(undefined)

      await persistence.cleanupOldBackups(5) // Keep 5, but only have 2

      expect(mockFs.unlink).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should handle file system errors gracefully', async () => {
      mockFs.mkdir.mockRejectedValue(new Error('Permission denied'))

      await expect(
        persistence.updateConfiguration('test-project', {
          poolSize: 25
        })
      ).rejects.toThrow()
    })

    it('should handle docker service errors', async () => {
      mockFs.mkdir.mockResolvedValue(undefined)
      mockFs.readFile.mockResolvedValue('POOLER_DEFAULT_POOL_SIZE=20\n')
      mockFs.writeFile.mockResolvedValue(undefined)
      mockFs.readdir.mockResolvedValue([])

      mockDockerService.restartContainer.mockRejectedValue(new Error('Docker daemon not running'))

      await expect(
        persistence.updateConfiguration('test-project', {
          poolSize: 25
        })
      ).rejects.toThrow('Failed to restart Supavisor service')
    })

    it('should provide appropriate error types for different failures', async () => {
      // Test configuration validation error
      try {
        await persistence.updateConfiguration('test-project', {
          poolSize: -1
        })
      } catch (error) {
        expect(SupavisorErrorHandler.isSupavisorError(error)).toBe(true)
        expect((error as any).type).toBe('configuration-invalid')
      }
    })
  })

  describe('validation edge cases', () => {
    it('should reject empty configuration updates', async () => {
      await expect(
        persistence.updateConfiguration('test-project', {})
      ).rejects.toThrow('No configuration updates provided')
    })

    it('should validate port ranges', async () => {
      await expect(
        persistence.updateConfiguration('test-project', {
          port: 70000 // Above valid range
        })
      ).rejects.toThrow('Port must be an integer between 1 and 65535')
    })

    it('should validate tenant ID length', async () => {
      const longTenantId = 'a'.repeat(70) // Exceeds 64 character limit
      
      await expect(
        persistence.updateConfiguration('test-project', {
          tenantId: longTenantId
        })
      ).rejects.toThrow('Tenant ID cannot exceed 64 characters')
    })

    it('should validate database pool size limits', async () => {
      await expect(
        persistence.updateConfiguration('test-project', {
          dbPoolSize: 150 // Exceeds maximum
        })
      ).rejects.toThrow('Database pool size cannot exceed 100 connections')
    })
  })
})