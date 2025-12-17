import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SupavisorConfigurationService } from '../supavisor-configuration-service'

// Mock the DockerContainerService
vi.mock('../docker-container-service', () => ({
  DockerContainerService: vi.fn().mockImplementation(() => ({
    getContainerStatus: vi.fn().mockResolvedValue({
      name: 'supavisor',
      status: 'running',
      health: 'healthy',
      uptime: '1h',
      ports: [{ host: 6543, container: 6543 }],
    }),
  })),
}))

// Mock environment variables
const mockEnv = {
  POOLER_DEFAULT_POOL_SIZE: '20',
  POOLER_MAX_CLIENT_CONN: '100',
  POOLER_PROXY_PORT_TRANSACTION: '6543',
  POOLER_TENANT_ID: 'test-tenant',
  POOLER_DB_POOL_SIZE: '5',
}

describe('SupavisorConfigurationService', () => {
  let service: SupavisorConfigurationService

  beforeEach(() => {
    // Set up environment variables
    Object.entries(mockEnv).forEach(([key, value]) => {
      process.env[key] = value
    })
    
    service = new SupavisorConfigurationService()
  })

  describe('getConfiguration', () => {
    it('should return Supavisor configuration from environment variables', async () => {
      const config = await service.getConfiguration('test-project')

      expect(config).toEqual({
        poolSize: 20,
        maxClientConnections: 100,
        poolMode: 'transaction',
        tenantId: 'test-tenant',
        port: 6543,
        managementPort: 4000,
        isEnabled: true,
        status: 'running',
        version: undefined,
      })
    })

    it('should throw error when tenant ID is not configured', async () => {
      process.env.POOLER_TENANT_ID = 'invalid tenant id!' // Invalid format

      await expect(service.getConfiguration('test-project')).rejects.toThrow(
        'Supavisor environment configuration is invalid'
      )
    })

    it('should throw error when pool size is invalid', async () => {
      process.env.POOLER_DEFAULT_POOL_SIZE = '0'

      await expect(service.getConfiguration('test-project')).rejects.toThrow(
        'Supavisor environment configuration is invalid'
      )
    })
  })

  describe('updateConfiguration', () => {
    it('should return updated configuration', async () => {
      const updates = { poolSize: 30 }
      const updatedConfig = await service.updateConfiguration('test-project', updates)

      expect(updatedConfig.poolSize).toBe(30)
      expect(updatedConfig.maxClientConnections).toBe(100) // Should preserve other values
    })
  })

  describe('getStatistics', () => {
    it('should return mock statistics when metrics endpoint is unavailable', async () => {
      // Mock fetch to simulate unavailable metrics endpoint
      global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'))

      const stats = await service.getStatistics('test-project')

      expect(stats).toHaveProperty('activeConnections')
      expect(stats).toHaveProperty('idleConnections')
      expect(stats).toHaveProperty('totalConnections')
      expect(stats).toHaveProperty('poolUtilization')
      expect(stats).toHaveProperty('clientConnections')
      expect(stats).toHaveProperty('maxClientConnections')
      expect(stats).toHaveProperty('uptime')
      
      expect(stats.totalConnections).toBe(20) // Should match pool size
      expect(stats.maxClientConnections).toBe(100) // Should match max client connections
    })
  })

  describe('getHealthStatus', () => {
    it('should return healthy status when service is running', async () => {
      // Mock successful health check
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
      } as Response)

      const health = await service.getHealthStatus('test-project')

      expect(health.healthy).toBe(true)
      expect(health.message).toBe('Supavisor is healthy')
    })

    it('should return unhealthy status when health endpoint fails', async () => {
      // Mock failed health check
      global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'))

      const health = await service.getHealthStatus('test-project')

      expect(health.healthy).toBe(false)
      expect(health.message).toContain('Cannot connect to Supavisor management port')
    })
  })
})