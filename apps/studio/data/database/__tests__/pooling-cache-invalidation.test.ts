import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { PoolingCacheInvalidation } from '../pooling-cache-invalidation'
import { databaseKeys } from '../keys'

// Mock the pooling configuration query module
vi.mock('../pooling-configuration-query', () => ({
  detectPoolingService: vi.fn(() => 'supavisor'),
}))

describe('PoolingCacheInvalidation', () => {
  let queryClient: QueryClient
  const mockProjectRef = 'test-project-ref'

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    
    // Mock the invalidateQueries method
    vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()
    
    vi.clearAllMocks()
  })

  describe('invalidateAll', () => {
    it('should invalidate all unified pooling queries', async () => {
      await PoolingCacheInvalidation.invalidateAll(queryClient, {
        projectRef: mockProjectRef,
      })

      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: databaseKeys.poolingConfiguration(mockProjectRef),
      })
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: databaseKeys.poolingUnified(mockProjectRef),
      })
    })

    it('should invalidate statistics when includeStatistics is true', async () => {
      await PoolingCacheInvalidation.invalidateAll(queryClient, {
        projectRef: mockProjectRef,
        includeStatistics: true,
      })

      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: databaseKeys.poolingStatistics(mockProjectRef),
      })
    })

    it('should not invalidate statistics when includeStatistics is false', async () => {
      await PoolingCacheInvalidation.invalidateAll(queryClient, {
        projectRef: mockProjectRef,
        includeStatistics: false,
      })

      expect(queryClient.invalidateQueries).not.toHaveBeenCalledWith({
        queryKey: databaseKeys.poolingStatistics(mockProjectRef),
      })
    })

    it('should invalidate health when includeHealth is true', async () => {
      await PoolingCacheInvalidation.invalidateAll(queryClient, {
        projectRef: mockProjectRef,
        includeHealth: true,
      })

      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: databaseKeys.poolingHealth(mockProjectRef),
      })
    })

    it('should invalidate supavisor-specific queries for supavisor service', async () => {
      await PoolingCacheInvalidation.invalidateAll(queryClient, {
        projectRef: mockProjectRef,
        poolingService: 'supavisor',
      })

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

    it('should invalidate pgbouncer-specific queries for pgbouncer service', async () => {
      await PoolingCacheInvalidation.invalidateAll(queryClient, {
        projectRef: mockProjectRef,
        poolingService: 'pgbouncer',
      })

      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: databaseKeys.pgbouncerConfig(mockProjectRef),
      })
    })

    it('should include recommendations when specified for supavisor', async () => {
      await PoolingCacheInvalidation.invalidateAll(queryClient, {
        projectRef: mockProjectRef,
        poolingService: 'supavisor',
        includeRecommendations: true,
      })

      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: databaseKeys.supavisorRecommendations(mockProjectRef),
      })
    })

    it('should include docker containers when specified for supavisor', async () => {
      await PoolingCacheInvalidation.invalidateAll(queryClient, {
        projectRef: mockProjectRef,
        poolingService: 'supavisor',
        includeDockerContainers: true,
      })

      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: databaseKeys.dockerContainers(mockProjectRef, 'supavisor'),
      })
    })
  })

  describe('invalidateConfiguration', () => {
    it('should invalidate configuration-related queries', async () => {
      await PoolingCacheInvalidation.invalidateConfiguration(queryClient, mockProjectRef)

      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: databaseKeys.poolingConfiguration(mockProjectRef),
      })
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: databaseKeys.poolingStatistics(mockProjectRef),
      })
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: databaseKeys.poolingHealth(mockProjectRef),
      })
    })

    it('should not include recommendations and containers for configuration updates', async () => {
      await PoolingCacheInvalidation.invalidateConfiguration(queryClient, mockProjectRef, 'supavisor')

      expect(queryClient.invalidateQueries).not.toHaveBeenCalledWith({
        queryKey: databaseKeys.supavisorRecommendations(mockProjectRef),
      })
      expect(queryClient.invalidateQueries).not.toHaveBeenCalledWith({
        queryKey: databaseKeys.dockerContainers(mockProjectRef, 'supavisor'),
      })
    })
  })

  describe('invalidateMonitoring', () => {
    it('should invalidate only monitoring-related queries', async () => {
      await PoolingCacheInvalidation.invalidateMonitoring(queryClient, mockProjectRef)

      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: databaseKeys.poolingStatistics(mockProjectRef),
      })
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: databaseKeys.poolingHealth(mockProjectRef),
      })
    })

    it('should include supavisor-specific monitoring queries for supavisor service', async () => {
      await PoolingCacheInvalidation.invalidateMonitoring(queryClient, mockProjectRef, 'supavisor')

      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: databaseKeys.supavisorStats(mockProjectRef),
      })
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: databaseKeys.supavisorHealth(mockProjectRef),
      })
    })

    it('should not include configuration queries', async () => {
      await PoolingCacheInvalidation.invalidateMonitoring(queryClient, mockProjectRef)

      expect(queryClient.invalidateQueries).not.toHaveBeenCalledWith({
        queryKey: databaseKeys.poolingConfiguration(mockProjectRef),
      })
    })
  })

  describe('invalidateContainerStatus', () => {
    it('should invalidate container queries', async () => {
      await PoolingCacheInvalidation.invalidateContainerStatus(queryClient, mockProjectRef)

      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: databaseKeys.dockerContainers(mockProjectRef),
      })
    })

    it('should invalidate specific container queries when container name provided', async () => {
      const containerName = 'supavisor-container'
      await PoolingCacheInvalidation.invalidateContainerStatus(queryClient, mockProjectRef, containerName)

      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: databaseKeys.dockerContainers(mockProjectRef, containerName),
      })
    })

    it('should invalidate health queries for supavisor containers', async () => {
      const containerName = 'supavisor-container'
      await PoolingCacheInvalidation.invalidateContainerStatus(queryClient, mockProjectRef, containerName)

      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: databaseKeys.poolingHealth(mockProjectRef),
      })
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: databaseKeys.supavisorHealth(mockProjectRef),
      })
    })

    it('should not invalidate health queries for non-supavisor containers', async () => {
      const containerName = 'postgres-container'
      await PoolingCacheInvalidation.invalidateContainerStatus(queryClient, mockProjectRef, containerName)

      expect(queryClient.invalidateQueries).not.toHaveBeenCalledWith({
        queryKey: databaseKeys.poolingHealth(mockProjectRef),
      })
      expect(queryClient.invalidateQueries).not.toHaveBeenCalledWith({
        queryKey: databaseKeys.supavisorHealth(mockProjectRef),
      })
    })
  })

  describe('createMutationInvalidator', () => {
    it('should create configuration invalidator', async () => {
      const invalidator = PoolingCacheInvalidation.createMutationInvalidator(queryClient, 'configuration')
      
      await invalidator(mockProjectRef)

      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: databaseKeys.poolingConfiguration(mockProjectRef),
      })
    })

    it('should create monitoring invalidator', async () => {
      const invalidator = PoolingCacheInvalidation.createMutationInvalidator(queryClient, 'monitoring')
      
      await invalidator(mockProjectRef)

      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: databaseKeys.poolingStatistics(mockProjectRef),
      })
    })

    it('should create container status invalidator', async () => {
      const invalidator = PoolingCacheInvalidation.createMutationInvalidator(queryClient, 'container-status')
      const containerName = 'test-container'
      
      await invalidator(mockProjectRef, containerName)

      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: databaseKeys.dockerContainers(mockProjectRef, containerName),
      })
    })
  })
})