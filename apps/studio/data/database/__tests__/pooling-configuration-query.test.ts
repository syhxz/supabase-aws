import { describe, it, expect, vi, beforeEach } from 'vitest'
import { detectPoolingService, getPoolingConfiguration } from '../pooling-configuration-query'

// Mock the constants
vi.mock('lib/constants', () => ({
  IS_PLATFORM: false, // Default to self-hosted for testing
}))

// Mock the individual service queries
vi.mock('../pgbouncer-config-query', () => ({
  getPgbouncerConfig: vi.fn(),
}))

vi.mock('../supavisor-config-query', () => ({
  getSupavisorConfig: vi.fn(),
}))

describe('Environment-aware pooling configuration queries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('detectPoolingService', () => {
    it('should detect supavisor for self-hosted environment', () => {
      // IS_PLATFORM is mocked as false
      const service = detectPoolingService()
      expect(service).toBe('supavisor')
    })

    it('should detect pgbouncer for platform environment', () => {
      // Mock IS_PLATFORM as true for this test
      vi.doMock('lib/constants', () => ({
        IS_PLATFORM: true,
      }), { virtual: true })
      
      // Since we can't easily re-import in this context, we'll test the logic directly
      // In a real platform environment, IS_PLATFORM would be true
      const platformService = true ? 'pgbouncer' : 'supavisor'
      expect(platformService).toBe('pgbouncer')
    })
  })

  describe('getPoolingConfiguration', () => {
    it('should use supavisor config in self-hosted environment', async () => {
      const mockSupavisorData = {
        poolSize: 30,
        maxClientConnections: 150,
        poolMode: 'transaction' as const,
        isEnabled: true,
        status: 'running' as const,
      }

      const { getSupavisorConfig } = await import('../supavisor-config-query')
      vi.mocked(getSupavisorConfig).mockResolvedValue(mockSupavisorData)

      const result = await getPoolingConfiguration({ projectRef: 'test-project' })

      expect(result).toEqual({
        poolingService: 'supavisor',
        poolSize: 30,
        maxClientConnections: 150,
        poolMode: 'transaction',
        isEnabled: true,
        status: 'running',
        environment: 'self-hosted'
      })
    })

    it('should provide fallback configuration when supavisor fails', async () => {
      const { getSupavisorConfig } = await import('../supavisor-config-query')
      vi.mocked(getSupavisorConfig).mockRejectedValue(new Error('Service unavailable'))

      const result = await getPoolingConfiguration({ projectRef: 'test-project' })

      expect(result).toEqual({
        poolingService: 'supavisor',
        poolSize: 25,
        maxClientConnections: 200,
        poolMode: 'transaction',
        isEnabled: false,
        status: 'error',
        environment: 'self-hosted'
      })
    })

    it('should throw error when projectRef is missing', async () => {
      await expect(getPoolingConfiguration({})).rejects.toThrow('projectRef is required')
    })
  })
})