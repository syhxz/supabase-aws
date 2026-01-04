import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { databaseKeys } from '../keys'
import { PoolingQueryKeys } from '../pooling-query-keys'
import { PoolingCacheInvalidation } from '../pooling-cache-invalidation'

// Mock the pooling configuration query module
vi.mock('../pooling-configuration-query', () => ({
  detectPoolingService: vi.fn(() => 'supavisor'),
}))

describe('Pooling Keys Integration', () => {
  let queryClient: QueryClient
  const mockProjectRef = 'test-project-ref'

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    
    vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()
    vi.clearAllMocks()
  })

  describe('Database Keys Structure', () => {
    it('should have all required pooling keys defined', () => {
      expect(databaseKeys.poolingConfiguration).toBeDefined()
      expect(databaseKeys.poolingStatistics).toBeDefined()
      expect(databaseKeys.poolingHealth).toBeDefined()
      expect(databaseKeys.poolingUnified).toBeDefined()
      expect(databaseKeys.pgbouncerConfig).toBeDefined()
      expect(databaseKeys.pgbouncerStatus).toBeDefined()
      expect(databaseKeys.supavisorConfig).toBeDefined()
      expect(databaseKeys.supavisorStats).toBeDefined()
      expect(databaseKeys.supavisorHealth).toBeDefined()
      expect(databaseKeys.supavisorRecommendations).toBeDefined()
      expect(databaseKeys.dockerContainers).toBeDefined()
    })

    it('should generate consistent key formats', () => {
      const configKey = databaseKeys.poolingConfiguration(mockProjectRef)
      const statsKey = databaseKeys.poolingStatistics(mockProjectRef)
      const healthKey = databaseKeys.poolingHealth(mockProjectRef)
      const unifiedKey = databaseKeys.poolingUnified(mockProjectRef)

      expect(configKey).toEqual(['projects', mockProjectRef, 'database', 'pooling-configuration'])
      expect(statsKey).toEqual(['projects', mockProjectRef, 'database', 'pooling-statistics'])
      expect(healthKey).toEqual(['projects', mockProjectRef, 'database', 'pooling-health'])
      expect(unifiedKey).toEqual(['projects', mockProjectRef, 'database', 'pooling-unified'])
    })

    it('should generate service-specific keys correctly', () => {
      const pgbouncerKey = databaseKeys.pgbouncerConfig(mockProjectRef)
      const supavisorKey = databaseKeys.supavisorConfig(mockProjectRef)
      const supavisorStatsKey = databaseKeys.supavisorStats(mockProjectRef)
      const supavisorHealthKey = databaseKeys.supavisorHealth(mockProjectRef)

      expect(pgbouncerKey).toEqual(['projects', mockProjectRef, 'pgbouncer', 'config'])
      expect(supavisorKey).toEqual(['projects', mockProjectRef, 'supavisor', 'config'])
      expect(supavisorStatsKey).toEqual(['projects', mockProjectRef, 'supavisor', 'stats'])
      expect(supavisorHealthKey).toEqual(['projects', mockProjectRef, 'supavisor', 'health'])
    })
  })

  describe('Query Keys Integration', () => {
    it('should correctly identify pooling keys', () => {
      const poolingKeys = [
        databaseKeys.poolingConfiguration(mockProjectRef),
        databaseKeys.poolingStatistics(mockProjectRef),
        databaseKeys.poolingHealth(mockProjectRef),
        databaseKeys.pgbouncerConfig(mockProjectRef),
        databaseKeys.supavisorConfig(mockProjectRef),
        databaseKeys.dockerContainers(mockProjectRef),
      ]

      const nonPoolingKeys = [
        databaseKeys.schemas(mockProjectRef),
        databaseKeys.migrations(mockProjectRef),
        databaseKeys.databaseFunctions(mockProjectRef),
      ]

      poolingKeys.forEach(key => {
        expect(PoolingQueryKeys.isPoolingKey(key)).toBe(true)
      })

      nonPoolingKeys.forEach(key => {
        expect(PoolingQueryKeys.isPoolingKey(key)).toBe(false)
      })
    })

    it('should extract project references correctly', () => {
      const keys = [
        databaseKeys.poolingConfiguration(mockProjectRef),
        databaseKeys.supavisorConfig(mockProjectRef),
        databaseKeys.pgbouncerConfig(mockProjectRef),
      ]

      keys.forEach(key => {
        expect(PoolingQueryKeys.extractProjectRef(key)).toBe(mockProjectRef)
      })
    })

    it('should provide environment-aware key selection', () => {
      const pgbouncerConfigKey = PoolingQueryKeys.configuration(mockProjectRef, 'pgbouncer')
      const supavisorConfigKey = PoolingQueryKeys.configuration(mockProjectRef, 'supavisor')

      expect(pgbouncerConfigKey).toEqual(databaseKeys.pgbouncerConfig(mockProjectRef))
      expect(supavisorConfigKey).toEqual(databaseKeys.supavisorConfig(mockProjectRef))
    })
  })

  describe('Cache Invalidation Integration', () => {
    it('should invalidate all related keys for configuration changes', async () => {
      await PoolingCacheInvalidation.invalidateConfiguration(queryClient, mockProjectRef, 'supavisor')

      // Verify unified keys are invalidated
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: databaseKeys.poolingConfiguration(mockProjectRef),
      })
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: databaseKeys.poolingUnified(mockProjectRef),
      })

      // Verify service-specific keys are invalidated
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: databaseKeys.supavisorConfig(mockProjectRef),
      })
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: databaseKeys.supavisorStats(mockProjectRef),
      })
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: databaseKeys.supavisorHealth(mockProjectRef),
      })
    })

    it('should handle different pooling services appropriately', async () => {
      // Test PgBouncer invalidation
      await PoolingCacheInvalidation.invalidateConfiguration(queryClient, mockProjectRef, 'pgbouncer')

      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: databaseKeys.pgbouncerConfig(mockProjectRef),
      })

      // Should not call Supavisor-specific invalidations for PgBouncer
      expect(queryClient.invalidateQueries).not.toHaveBeenCalledWith({
        queryKey: databaseKeys.supavisorConfig(mockProjectRef),
      })
    })

    it('should provide targeted invalidation for monitoring updates', async () => {
      await PoolingCacheInvalidation.invalidateMonitoring(queryClient, mockProjectRef, 'supavisor')

      // Should invalidate monitoring-related keys
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: databaseKeys.poolingStatistics(mockProjectRef),
      })
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: databaseKeys.poolingHealth(mockProjectRef),
      })

      // Should not invalidate configuration keys
      expect(queryClient.invalidateQueries).not.toHaveBeenCalledWith({
        queryKey: databaseKeys.poolingConfiguration(mockProjectRef),
      })
    })

    it('should handle container status changes with health implications', async () => {
      await PoolingCacheInvalidation.invalidateContainerStatus(queryClient, mockProjectRef, 'supavisor-container')

      // Should invalidate container keys
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: databaseKeys.dockerContainers(mockProjectRef),
      })
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: databaseKeys.dockerContainers(mockProjectRef, 'supavisor-container'),
      })

      // Should also invalidate health keys for Supavisor containers
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: databaseKeys.poolingHealth(mockProjectRef),
      })
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: databaseKeys.supavisorHealth(mockProjectRef),
      })
    })
  })

  describe('Key Consistency and Validation', () => {
    it('should maintain consistent key structure across all pooling services', () => {
      const allKeys = [
        databaseKeys.poolingConfiguration(mockProjectRef),
        databaseKeys.poolingStatistics(mockProjectRef),
        databaseKeys.poolingHealth(mockProjectRef),
        databaseKeys.poolingUnified(mockProjectRef),
        databaseKeys.pgbouncerConfig(mockProjectRef),
        databaseKeys.pgbouncerStatus(mockProjectRef),
        databaseKeys.supavisorConfig(mockProjectRef),
        databaseKeys.supavisorStats(mockProjectRef),
        databaseKeys.supavisorHealth(mockProjectRef),
        databaseKeys.supavisorRecommendations(mockProjectRef),
      ]

      allKeys.forEach(key => {
        expect(Array.isArray(key)).toBe(true)
        expect(key[0]).toBe('projects')
        expect(key[1]).toBe(mockProjectRef)
        expect(key.length).toBeGreaterThanOrEqual(3)
      })
    })

    it('should handle undefined project references gracefully', () => {
      const keyWithUndefined = databaseKeys.poolingConfiguration(undefined)
      expect(keyWithUndefined).toEqual(['projects', undefined, 'database', 'pooling-configuration'])
      
      expect(PoolingQueryKeys.isPoolingKey(keyWithUndefined)).toBe(false)
      expect(PoolingQueryKeys.extractProjectRef(keyWithUndefined)).toBeUndefined()
    })

    it('should provide comprehensive invalidation key sets', () => {
      const configKeys = PoolingQueryKeys.configurationInvalidationKeys(mockProjectRef, 'supavisor')
      const monitoringKeys = PoolingQueryKeys.monitoringInvalidationKeys(mockProjectRef, 'supavisor')
      const containerKeys = PoolingQueryKeys.containerInvalidationKeys(mockProjectRef, 'supavisor-container')

      // Configuration keys should include all relevant keys
      expect(configKeys.length).toBeGreaterThan(5)
      
      // Monitoring keys should be a subset focused on statistics and health
      expect(monitoringKeys.length).toBeLessThan(configKeys.length)
      
      // Container keys should include container-specific keys
      expect(containerKeys.length).toBeGreaterThan(2)
      
      // All keys should be valid pooling keys
      configKeys.forEach(key => expect(PoolingQueryKeys.isPoolingKey(key)).toBe(true))
      monitoringKeys.forEach(key => expect(PoolingQueryKeys.isPoolingKey(key)).toBe(true))
      containerKeys.forEach(key => expect(PoolingQueryKeys.isPoolingKey(key)).toBe(true))
    })
  })
})