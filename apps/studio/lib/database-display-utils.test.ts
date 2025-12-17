import { describe, expect, it } from 'vitest'
import { 
  getDatabaseDisplayLabel, 
  isDatabasePrimary, 
  getDatabaseDisplayInfo,
  formatDatabaseForDisplay,
  formatDatabasesForDisplay,
  getPrimaryDatabases,
  getReplicaDatabases
} from './database-display-utils'
import type { Database } from 'data/read-replicas/replicas-query'

const mockPrimaryDatabase: Database = {
  identifier: 'test-project-ref',
  region: 'us-east-1',
  status: 'ACTIVE_HEALTHY',
  inserted_at: '2023-01-01T00:00:00Z',
  host: 'localhost',
  port: 5432,
  database: 'postgres',
  user: 'postgres'
}

const mockReplicaDatabase: Database = {
  identifier: 'replica-123',
  region: 'us-west-2', 
  status: 'ACTIVE_HEALTHY',
  inserted_at: '2023-01-02T00:00:00Z',
  host: 'replica-host',
  port: 5432,
  database: 'postgres',
  user: 'postgres'
}

describe('Database Display Utilities', () => {
  describe('getDatabaseDisplayLabel', () => {
    it('should return "Primary Database" for primary database', () => {
      const label = getDatabaseDisplayLabel('test-project-ref', 'test-project-ref', [mockPrimaryDatabase])
      expect(label).toBe('Primary Database')
    })

    it('should return "Primary Database" when database ID matches project ref', () => {
      const label = getDatabaseDisplayLabel('test-project-ref', 'test-project-ref', [])
      expect(label).toBe('Primary Database')
    })

    it('should return "Read Replica" for replica database', () => {
      const label = getDatabaseDisplayLabel('test-project-ref', 'replica-123', [mockPrimaryDatabase, mockReplicaDatabase])
      expect(label).toBe('Read Replica')
    })

    it('should default to "Primary Database" for invalid inputs', () => {
      const label = getDatabaseDisplayLabel('', '', [])
      expect(label).toBe('Primary Database')
    })
  })

  describe('isDatabasePrimary', () => {
    it('should return true for primary database', () => {
      const isPrimary = isDatabasePrimary('test-project-ref', 'test-project-ref', [mockPrimaryDatabase])
      expect(isPrimary).toBe(true)
    })

    it('should return false for replica database', () => {
      const isPrimary = isDatabasePrimary('test-project-ref', 'replica-123', [mockPrimaryDatabase, mockReplicaDatabase])
      expect(isPrimary).toBe(false)
    })
  })

  describe('getDatabaseDisplayInfo', () => {
    it('should return correct display info for primary database', () => {
      const info = getDatabaseDisplayInfo('test-project-ref', 'test-project-ref', [mockPrimaryDatabase])
      
      expect(info.type).toBe('primary')
      expect(info.label).toBe('Primary Database')
      expect(info.isPrimary).toBe(true)
      expect(info.displayName).toBe('Primary Database (test-project-ref)')
    })

    it('should return correct display info for replica database', () => {
      const info = getDatabaseDisplayInfo('test-project-ref', 'replica-123', [mockPrimaryDatabase, mockReplicaDatabase])
      
      expect(info.type).toBe('replica')
      expect(info.label).toBe('Read Replica')
      expect(info.isPrimary).toBe(false)
      expect(info.displayName).toBe('Read Replica (replica-123)')
    })
  })

  describe('formatDatabaseForDisplay', () => {
    it('should format primary database correctly', () => {
      const formatted = formatDatabaseForDisplay(mockPrimaryDatabase, 'test-project-ref', [mockPrimaryDatabase])
      
      expect(formatted.label).toBe('Primary Database')
      expect(formatted.isPrimary).toBe(true)
      expect(formatted.isAccessible).toBe(true)
      expect(formatted.formattedName).toBe('Primary Database - test-project-ref')
    })

    it('should format replica database correctly', () => {
      const formatted = formatDatabaseForDisplay(mockReplicaDatabase, 'test-project-ref', [mockPrimaryDatabase, mockReplicaDatabase])
      
      expect(formatted.label).toBe('Read Replica')
      expect(formatted.isPrimary).toBe(false)
      expect(formatted.isAccessible).toBe(true) // ACTIVE_HEALTHY status
      expect(formatted.formattedName).toBe('Read Replica - replica-123')
    })
  })

  describe('formatDatabasesForDisplay', () => {
    it('should format multiple databases correctly', () => {
      const databases = [mockPrimaryDatabase, mockReplicaDatabase]
      const formatted = formatDatabasesForDisplay(databases, 'test-project-ref')
      
      expect(formatted).toHaveLength(2)
      expect(formatted[0].label).toBe('Primary Database')
      expect(formatted[1].label).toBe('Read Replica')
    })
  })

  describe('getPrimaryDatabases', () => {
    it('should return only primary databases', () => {
      const databases = [mockPrimaryDatabase, mockReplicaDatabase]
      const primaries = getPrimaryDatabases(databases, 'test-project-ref')
      
      expect(primaries).toHaveLength(1)
      expect(primaries[0].identifier).toBe('test-project-ref')
    })
  })

  describe('getReplicaDatabases', () => {
    it('should return only replica databases', () => {
      const databases = [mockPrimaryDatabase, mockReplicaDatabase]
      const replicas = getReplicaDatabases(databases, 'test-project-ref')
      
      expect(replicas).toHaveLength(1)
      expect(replicas[0].identifier).toBe('replica-123')
    })
  })
})