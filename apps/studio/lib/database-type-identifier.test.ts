/**
 * @vitest-environment node
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { 
  EnhancedDatabaseTypeIdentifier, 
  createDatabaseTypeIdentifier,
  isSimplePrimaryDatabase,
  getDatabaseTypeLabel 
} from './database-type-identifier'
import type { Database } from 'data/read-replicas/replicas-query'

describe('EnhancedDatabaseTypeIdentifier', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  const createMockDatabase = (overrides: Partial<Database> = {}): Database => ({
    identifier: 'test-project',
    region: 'us-east-1',
    db_host: 'localhost',
    db_port: 5432,
    db_name: 'postgres',
    db_user: 'postgres',
    status: 'ACTIVE_HEALTHY',
    cloud_provider: 'AWS',
    restUrl: 'https://test.supabase.co',
    size: 'micro',
    inserted_at: '2023-01-01T00:00:00Z',
    ...overrides
  })

  describe('identifyDatabaseType', () => {
    it('should identify primary database when identifier matches project ref', () => {
      const databases = [createMockDatabase({ identifier: 'project-123' })]
      const identifier = new EnhancedDatabaseTypeIdentifier(databases)

      const result = identifier.identifyDatabaseType('project-123', 'project-123')

      expect(result).toBe('primary')
    })

    it('should identify replica database when identifier does not match project ref', () => {
      const databases = [
        createMockDatabase({ identifier: 'project-123' }),
        createMockDatabase({ identifier: 'replica-456' })
      ]
      const identifier = new EnhancedDatabaseTypeIdentifier(databases)

      const result = identifier.identifyDatabaseType('project-123', 'replica-456')

      expect(result).toBe('replica')
    })

    it('should identify replica database with replica indicators', () => {
      const databases = [createMockDatabase({ identifier: 'project-123-replica' })]
      const identifier = new EnhancedDatabaseTypeIdentifier(databases)

      const result = identifier.identifyDatabaseType('project-123', 'project-123-replica')

      expect(result).toBe('replica')
    })

    it('should default to primary for single database', () => {
      const databases = [createMockDatabase({ identifier: 'single-db' })]
      const identifier = new EnhancedDatabaseTypeIdentifier(databases)

      const result = identifier.identifyDatabaseType('project-123', 'single-db')

      expect(result).toBe('primary')
    })

    it('should handle empty database list', () => {
      const identifier = new EnhancedDatabaseTypeIdentifier([])

      const result = identifier.identifyDatabaseType('project-123', 'project-123')

      expect(result).toBe('primary')
    })

    it('should handle invalid inputs', () => {
      const identifier = new EnhancedDatabaseTypeIdentifier([])

      const result1 = identifier.identifyDatabaseType('', 'db-id')
      const result2 = identifier.identifyDatabaseType('project-ref', '')

      expect(result1).toBe('primary')
      expect(result2).toBe('primary')
    })
  })

  describe('isPrimaryDatabase', () => {
    it('should return true for primary database', () => {
      const databases = [createMockDatabase({ identifier: 'project-123' })]
      const identifier = new EnhancedDatabaseTypeIdentifier(databases)

      const result = identifier.isPrimaryDatabase('project-123', 'project-123')

      expect(result).toBe(true)
    })

    it('should return false for replica database', () => {
      const databases = [createMockDatabase({ identifier: 'replica-456' })]
      const identifier = new EnhancedDatabaseTypeIdentifier(databases)

      const result = identifier.isPrimaryDatabase('project-123', 'replica-456')

      expect(result).toBe(false)
    })
  })

  describe('getDatabaseConnectionInfo', () => {
    it('should return connection info for existing database', () => {
      const databases = [createMockDatabase({ 
        identifier: 'project-123',
        db_host: 'db.example.com',
        db_port: 5432,
        db_name: 'mydb',
        db_user: 'dbuser'
      })]
      const identifier = new EnhancedDatabaseTypeIdentifier(databases)

      const result = identifier.getDatabaseConnectionInfo('project-123', 'project-123')

      expect(result).toEqual({
        host: 'db.example.com',
        port: 5432,
        database: 'mydb',
        user: 'dbuser',
        password: '[YOUR_PASSWORD]',
        isReadOnly: false,
        isPrimary: true
      })
    })

    it('should return null for non-existent database', () => {
      const identifier = new EnhancedDatabaseTypeIdentifier([])

      const result = identifier.getDatabaseConnectionInfo('project-123', 'non-existent')

      expect(result).toBe(null)
    })

    it('should use environment variables for missing database fields', () => {
      process.env.POSTGRES_HOST = 'env-host'
      process.env.POSTGRES_PORT = '5433'
      process.env.POSTGRES_USER_READ_WRITE = 'env-user'

      // Create database with empty fields to test environment fallback
      const databases = [createMockDatabase({ 
        identifier: 'project-123',
        db_host: '',
        db_port: 0,
        db_user: ''
      })]
      const identifier = new EnhancedDatabaseTypeIdentifier(databases)

      const result = identifier.getDatabaseConnectionInfo('project-123', 'project-123')

      expect(result?.host).toBe('env-host') // Should use environment variable
      expect(result?.port).toBe(5433) // Should use environment variable  
      expect(result?.user).toBe('env-user') // Should use environment variable
    })

    it('should set isReadOnly false for primary database', () => {
      const databases = [createMockDatabase({ identifier: 'project-123' })]
      const identifier = new EnhancedDatabaseTypeIdentifier(databases)

      const result = identifier.getDatabaseConnectionInfo('project-123', 'project-123')

      expect(result?.isReadOnly).toBe(false)
      expect(result?.isPrimary).toBe(true)
    })

    it('should set isReadOnly true for replica database', () => {
      const databases = [createMockDatabase({ identifier: 'replica-456' })]
      const identifier = new EnhancedDatabaseTypeIdentifier(databases)

      const result = identifier.getDatabaseConnectionInfo('project-123', 'replica-456')

      expect(result?.isReadOnly).toBe(true)
      expect(result?.isPrimary).toBe(false)
    })
  })

  describe('updateDatabases', () => {
    it('should update internal database list', () => {
      const identifier = new EnhancedDatabaseTypeIdentifier([])
      const newDatabases = [createMockDatabase({ identifier: 'new-db' })]

      identifier.updateDatabases(newDatabases)

      const result = identifier.identifyDatabaseType('project-123', 'new-db')
      expect(result).toBe('primary') // Single database defaults to primary
    })
  })
})

describe('createDatabaseTypeIdentifier', () => {
  const createMockDatabase = (overrides: Partial<Database> = {}): Database => ({
    identifier: 'test-project',
    region: 'us-east-1',
    host: 'localhost',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    status: 'ACTIVE_HEALTHY',
    ...overrides
  })

  it('should create new identifier instance', () => {
    const databases = [createMockDatabase()]
    const identifier = createDatabaseTypeIdentifier(databases)

    expect(identifier).toBeInstanceOf(EnhancedDatabaseTypeIdentifier)
  })

  it('should work with empty database list', () => {
    const identifier = createDatabaseTypeIdentifier()

    expect(identifier).toBeInstanceOf(EnhancedDatabaseTypeIdentifier)
  })
})

describe('isSimplePrimaryDatabase', () => {
  it('should return true when database ID matches project ref', () => {
    const result = isSimplePrimaryDatabase('project-123', 'project-123')

    expect(result).toBe(true)
  })

  it('should return false when database ID does not match project ref', () => {
    const result = isSimplePrimaryDatabase('project-123', 'replica-456')

    expect(result).toBe(false)
  })
})

describe('getDatabaseTypeLabel', () => {
  const createMockDatabase = (overrides: Partial<Database> = {}): Database => ({
    identifier: 'test-project',
    region: 'us-east-1',
    host: 'localhost',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    status: 'ACTIVE_HEALTHY',
    ...overrides
  })

  it('should return "Primary Database" for primary database', () => {
    const databases = [createMockDatabase({ identifier: 'project-123' })]

    const result = getDatabaseTypeLabel('project-123', 'project-123', databases)

    expect(result).toBe('Primary Database')
  })

  it('should return "Read Replica" for replica database', () => {
    const databases = [createMockDatabase({ identifier: 'replica-456' })]

    const result = getDatabaseTypeLabel('project-123', 'replica-456', databases)

    expect(result).toBe('Read Replica')
  })

  it('should work with empty database list', () => {
    const result = getDatabaseTypeLabel('project-123', 'project-123', [])

    expect(result).toBe('Primary Database')
  })
})