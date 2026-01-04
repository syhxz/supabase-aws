import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PoolingQueryKeys } from '../pooling-query-keys'
import { databaseKeys } from '../keys'

// Mock the pooling configuration query module
vi.mock('../pooling-configuration-query', () => ({
  detectPoolingService: vi.fn(() => 'supavisor'),
}))

describe('PoolingQueryKeys', () => {
  const mockProjectRef = 'test-project-ref'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('configuration', () => {
    it('should return pgbouncer config key for pgbouncer service', () => {
      const key = PoolingQueryKeys.configuration(mockProjectRef, 'pgbouncer')
      expect(key).toEqual(databaseKeys.pgbouncerConfig(mockProjectRef))
    })

    it('should return supavisor config key for supavisor service', () => {
      const key = PoolingQueryKeys.configuration(mockProjectRef, 'supavisor')
      expect(key).toEqual(databaseKeys.supavisorConfig(mockProjectRef))
    })

    it('should use detected service when no service specified', () => {
      const key = PoolingQueryKeys.configuration(mockProjectRef)
      expect(key).toEqual(databaseKeys.supavisorConfig(mockProjectRef))
    })
  })

  describe('statistics', () => {
    it('should return unified statistics key for pgbouncer service', () => {
      const key = PoolingQueryKeys.statistics(mockProjectRef, 'pgbouncer')
      expect(key).toEqual(databaseKeys.poolingStatistics(mockProjectRef))
    })

    it('should return supavisor stats key for supavisor service', () => {
      const key = PoolingQueryKeys.statistics(mockProjectRef, 'supavisor')
      expect(key).toEqual(databaseKeys.supavisorStats(mockProjectRef))
    })
  })

  describe('health', () => {
    it('should return unified health key for pgbouncer service', () => {
      const key = PoolingQueryKeys.health(mockProjectRef, 'pgbouncer')
      expect(key).toEqual(databaseKeys.poolingHealth(mockProjectRef))
    })

    it('should return supavisor health key for supavisor service', () => {
      const key = PoolingQueryKeys.health(mockProjectRef, 'supavisor')
      expect(key).toEqual(databaseKeys.supavisorHealth(mockProjectRef))
    })
  })

  describe('unified', () => {
    it('should return all unified pooling keys', () => {
      const keys = PoolingQueryKeys.unified(mockProjectRef)
      
      expect(keys).toEqual({
        configuration: databaseKeys.poolingConfiguration(mockProjectRef),
        statistics: databaseKeys.poolingStatistics(mockProjectRef),
        health: databaseKeys.poolingHealth(mockProjectRef),
        unified: databaseKeys.poolingUnified(mockProjectRef),
      })
    })
  })

  describe('serviceSpecific', () => {
    it('should return pgbouncer-specific keys for pgbouncer service', () => {
      const keys = PoolingQueryKeys.serviceSpecific(mockProjectRef, 'pgbouncer')
      
      expect(keys).toEqual({
        config: databaseKeys.pgbouncerConfig(mockProjectRef),
        status: databaseKeys.pgbouncerStatus(mockProjectRef),
      })
    })

    it('should return supavisor-specific keys for supavisor service', () => {
      const keys = PoolingQueryKeys.serviceSpecific(mockProjectRef, 'supavisor')
      
      expect(keys).toEqual({
        config: databaseKeys.supavisorConfig(mockProjectRef),
        stats: databaseKeys.supavisorStats(mockProjectRef),
        health: databaseKeys.supavisorHealth(mockProjectRef),
        recommendations: databaseKeys.supavisorRecommendations(mockProjectRef),
        containers: databaseKeys.dockerContainers(mockProjectRef, 'supavisor'),
      })
    })
  })

  describe('configurationInvalidationKeys', () => {
    it('should return all keys that need invalidation for configuration changes', () => {
      const keys = PoolingQueryKeys.configurationInvalidationKeys(mockProjectRef, 'supavisor')
      
      // Convert to JSON strings for comparison since arrays are compared by reference
      const keyStrings = keys.map(key => JSON.stringify(key))
      
      expect(keyStrings).toContain(JSON.stringify(databaseKeys.poolingConfiguration(mockProjectRef)))
      expect(keyStrings).toContain(JSON.stringify(databaseKeys.poolingStatistics(mockProjectRef)))
      expect(keyStrings).toContain(JSON.stringify(databaseKeys.poolingHealth(mockProjectRef)))
      expect(keyStrings).toContain(JSON.stringify(databaseKeys.poolingUnified(mockProjectRef)))
      expect(keyStrings).toContain(JSON.stringify(databaseKeys.supavisorConfig(mockProjectRef)))
      expect(keyStrings).toContain(JSON.stringify(databaseKeys.supavisorStats(mockProjectRef)))
      expect(keyStrings).toContain(JSON.stringify(databaseKeys.supavisorHealth(mockProjectRef)))
    })
  })

  describe('monitoringInvalidationKeys', () => {
    it('should return monitoring-related keys for supavisor', () => {
      const keys = PoolingQueryKeys.monitoringInvalidationKeys(mockProjectRef, 'supavisor')
      const keyStrings = keys.map(key => JSON.stringify(key))
      
      expect(keyStrings).toContain(JSON.stringify(databaseKeys.poolingStatistics(mockProjectRef)))
      expect(keyStrings).toContain(JSON.stringify(databaseKeys.poolingHealth(mockProjectRef)))
      expect(keyStrings).toContain(JSON.stringify(databaseKeys.supavisorStats(mockProjectRef)))
      expect(keyStrings).toContain(JSON.stringify(databaseKeys.supavisorHealth(mockProjectRef)))
    })

    it('should return only unified keys for pgbouncer', () => {
      const keys = PoolingQueryKeys.monitoringInvalidationKeys(mockProjectRef, 'pgbouncer')
      const keyStrings = keys.map(key => JSON.stringify(key))
      
      expect(keyStrings).toContain(JSON.stringify(databaseKeys.poolingStatistics(mockProjectRef)))
      expect(keyStrings).toContain(JSON.stringify(databaseKeys.poolingHealth(mockProjectRef)))
      expect(keyStrings).not.toContain(JSON.stringify(databaseKeys.supavisorStats(mockProjectRef)))
    })
  })

  describe('containerInvalidationKeys', () => {
    it('should return container-related keys', () => {
      const keys = PoolingQueryKeys.containerInvalidationKeys(mockProjectRef, 'supavisor-container')
      const keyStrings = keys.map(key => JSON.stringify(key))
      
      expect(keyStrings).toContain(JSON.stringify(databaseKeys.dockerContainers(mockProjectRef)))
      expect(keyStrings).toContain(JSON.stringify(databaseKeys.dockerContainers(mockProjectRef, 'supavisor-container')))
      expect(keyStrings).toContain(JSON.stringify(databaseKeys.poolingHealth(mockProjectRef)))
      expect(keyStrings).toContain(JSON.stringify(databaseKeys.supavisorHealth(mockProjectRef)))
    })

    it('should not include health keys for non-supavisor containers', () => {
      const keys = PoolingQueryKeys.containerInvalidationKeys(mockProjectRef, 'postgres-container')
      const keyStrings = keys.map(key => JSON.stringify(key))
      
      expect(keyStrings).toContain(JSON.stringify(databaseKeys.dockerContainers(mockProjectRef)))
      expect(keyStrings).toContain(JSON.stringify(databaseKeys.dockerContainers(mockProjectRef, 'postgres-container')))
      expect(keyStrings).not.toContain(JSON.stringify(databaseKeys.poolingHealth(mockProjectRef)))
      expect(keyStrings).not.toContain(JSON.stringify(databaseKeys.supavisorHealth(mockProjectRef)))
    })
  })

  describe('isPoolingKey', () => {
    it('should identify pooling configuration keys', () => {
      const key = databaseKeys.poolingConfiguration(mockProjectRef)
      expect(PoolingQueryKeys.isPoolingKey(key)).toBe(true)
    })

    it('should identify service-specific keys', () => {
      const pgbouncerKey = databaseKeys.pgbouncerConfig(mockProjectRef)
      const supavisorKey = databaseKeys.supavisorConfig(mockProjectRef)
      
      expect(PoolingQueryKeys.isPoolingKey(pgbouncerKey)).toBe(true)
      expect(PoolingQueryKeys.isPoolingKey(supavisorKey)).toBe(true)
    })

    it('should identify docker container keys', () => {
      const key = databaseKeys.dockerContainers(mockProjectRef)
      expect(PoolingQueryKeys.isPoolingKey(key)).toBe(true)
    })

    it('should reject non-pooling keys', () => {
      const key = databaseKeys.schemas(mockProjectRef)
      expect(PoolingQueryKeys.isPoolingKey(key)).toBe(false)
    })

    it('should reject invalid key formats', () => {
      expect(PoolingQueryKeys.isPoolingKey([])).toBe(false)
      expect(PoolingQueryKeys.isPoolingKey(['invalid'])).toBe(false)
      expect(PoolingQueryKeys.isPoolingKey(['projects', 123, 'database'])).toBe(false)
    })
  })

  describe('extractProjectRef', () => {
    it('should extract project reference from valid pooling keys', () => {
      const key = databaseKeys.poolingConfiguration(mockProjectRef)
      expect(PoolingQueryKeys.extractProjectRef(key)).toBe(mockProjectRef)
    })

    it('should return undefined for non-pooling keys', () => {
      const key = databaseKeys.schemas(mockProjectRef)
      expect(PoolingQueryKeys.extractProjectRef(key)).toBeUndefined()
    })

    it('should return undefined for invalid keys', () => {
      expect(PoolingQueryKeys.extractProjectRef([])).toBeUndefined()
      expect(PoolingQueryKeys.extractProjectRef(['invalid'])).toBeUndefined()
    })
  })
})