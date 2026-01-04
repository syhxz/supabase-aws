import { describe, it, expect, vi, beforeEach } from 'vitest'
import { 
  useUnifiedPoolingQueries,
  getPoolingConfiguration,
  getPoolingStatistics,
  getPoolingHealth,
  updatePoolingConfiguration
} from '../pooling-unified'

// Mock the constants to test both environments
vi.mock('lib/constants', () => ({
  IS_PLATFORM: false, // Default to self-hosted
}))

// Mock the individual service functions
vi.mock('../pgbouncer-config-query', () => ({
  getPgbouncerConfig: vi.fn(),
}))

vi.mock('../supavisor-config-query', () => ({
  getSupavisorConfig: vi.fn(),
}))

vi.mock('../supavisor-stats-query', () => ({
  getSupavisorStats: vi.fn(),
}))

vi.mock('../supavisor-health-query', () => ({
  getSupavisorHealth: vi.fn(),
}))

vi.mock('../pgbouncer-config-update-mutation', () => ({
  updatePgbouncerConfiguration: vi.fn(),
}))

vi.mock('../supavisor-config-update-mutation', () => ({
  updateSupavisorConfig: vi.fn(),
}))

// Mock the service detection
vi.mock('lib/api/self-hosted/pooling-service-detector', () => ({
  PoolingServiceDetector: {
    detectServices: vi.fn().mockResolvedValue({
      primary: {
        service: 'supavisor',
        environment: 'self-hosted',
        isAvailable: true,
        isHealthy: true,
        features: {
          configurationUpdate: true,
          statisticsMonitoring: true,
          healthChecks: true,
          containerManagement: true
        }
      },
      recommendedService: 'supavisor',
      environment: 'self-hosted'
    }),
    getRecommendedConfiguration: vi.fn().mockReturnValue({
      service: 'supavisor',
      capabilities: {
        features: {
          configurationUpdate: true,
          statisticsMonitoring: true,
          healthChecks: true,
          containerManagement: true
        }
      },
      reason: 'Mocked service detection for testing'
    })
  },
  PoolingServiceAdapter: {
    adaptConfiguration: vi.fn(),
    getUIConfiguration: vi.fn()
  }
}))

describe('Unified pooling queries integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Configuration queries', () => {
    it('should handle self-hosted environment with Supavisor', async () => {
      const mockSupavisorConfig = {
        poolSize: 25,
        maxClientConnections: 200,
        poolMode: 'transaction' as const,
        isEnabled: true,
        status: 'running' as const,
      }

      const { getSupavisorConfig } = await import('../supavisor-config-query')
      vi.mocked(getSupavisorConfig).mockResolvedValue(mockSupavisorConfig)

      const result = await getPoolingConfiguration({ projectRef: 'test-project' })

      expect(result).toEqual({
        poolingService: 'supavisor',
        poolSize: 25,
        maxClientConnections: 200,
        poolMode: 'transaction',
        isEnabled: true,
        status: 'running',
        environment: 'self-hosted',
        capabilities: {
          configurationUpdate: true,
          statisticsMonitoring: true,
          healthChecks: true,
          containerManagement: true
        },
        detectionReason: 'Mocked service detection for testing'
      })
    })
  })

  describe('Statistics queries', () => {
    it('should handle self-hosted environment with Supavisor stats', async () => {
      const mockSupavisorStats = {
        activeConnections: 5,
        idleConnections: 10,
        totalConnections: 15,
        poolUtilization: 0.6,
        clientConnections: 3,
        maxClientConnections: 200,
        uptime: 3600,
      }

      const { getSupavisorStats } = await import('../supavisor-stats-query')
      vi.mocked(getSupavisorStats).mockResolvedValue(mockSupavisorStats)

      const result = await getPoolingStatistics({ projectRef: 'test-project' })

      expect(result).toEqual({
        poolingService: 'supavisor',
        activeConnections: 5,
        idleConnections: 10,
        totalConnections: 15,
        poolUtilization: 0.6,
        clientConnections: 3,
        maxClientConnections: 200,
        uptime: 3600,
        environment: 'self-hosted'
      })
    })

    it('should provide fallback stats when service fails', async () => {
      const { getSupavisorStats } = await import('../supavisor-stats-query')
      vi.mocked(getSupavisorStats).mockRejectedValue(new Error('Service unavailable'))

      const result = await getPoolingStatistics({ projectRef: 'test-project' })

      expect(result).toEqual({
        poolingService: 'supavisor',
        activeConnections: 0,
        idleConnections: 0,
        totalConnections: 0,
        poolUtilization: 0,
        clientConnections: 0,
        maxClientConnections: 200,
        environment: 'self-hosted'
      })
    })
  })

  describe('Health queries', () => {
    it('should handle self-hosted environment with Supavisor health', async () => {
      const mockSupavisorHealth = {
        healthy: true,
        message: 'All systems operational',
      }

      const { getSupavisorHealth } = await import('../supavisor-health-query')
      vi.mocked(getSupavisorHealth).mockResolvedValue(mockSupavisorHealth)

      const result = await getPoolingHealth({ projectRef: 'test-project' })

      expect(result).toEqual({
        poolingService: 'supavisor',
        healthy: true,
        status: 'healthy',
        message: 'All systems operational',
        environment: 'self-hosted',
        lastChecked: expect.any(String)
      })
    })
  })

  describe('Update mutations', () => {
    it('should handle self-hosted environment updates', async () => {
      const mockUpdatedConfig = {
        poolSize: 30,
        maxClientConnections: 250,
        poolMode: 'session' as const,
        isEnabled: true,
        status: 'running' as const,
      }

      const { updateSupavisorConfig } = await import('../supavisor-config-update-mutation')
      vi.mocked(updateSupavisorConfig).mockResolvedValue(mockUpdatedConfig)

      const result = await updatePoolingConfiguration({
        projectRef: 'test-project',
        poolSize: 30,
        maxClientConnections: 250,
        poolMode: 'session'
      })

      expect(result).toEqual({
        poolingService: 'supavisor',
        poolSize: 30,
        maxClientConnections: 250,
        poolMode: 'session',
        isEnabled: true,
        status: 'running',
        environment: 'self-hosted'
      })

      expect(updateSupavisorConfig).toHaveBeenCalledWith({
        ref: 'test-project',
        poolSize: 30,
        maxClientConnections: 250,
        poolMode: 'session'
      })
    })
  })

  describe('Error handling', () => {
    it('should throw error when projectRef is missing', async () => {
      await expect(getPoolingConfiguration({})).rejects.toThrow('projectRef is required')
      await expect(getPoolingStatistics({})).rejects.toThrow('projectRef is required')
      await expect(getPoolingHealth({})).rejects.toThrow('projectRef is required')
    })
  })
})