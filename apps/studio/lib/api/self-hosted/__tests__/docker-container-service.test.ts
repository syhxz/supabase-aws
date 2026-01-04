import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DockerContainerService } from '../docker-container-service'

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn(),
}))

// Mock fetch
global.fetch = vi.fn()

describe('DockerContainerService', () => {
  let dockerService: DockerContainerService
  
  beforeEach(() => {
    dockerService = new DockerContainerService()
    vi.clearAllMocks()
  })

  describe('getContainerStatus', () => {
    it('should return container status for supavisor', async () => {
      const mockExec = vi.fn()
      const { exec } = await import('child_process')
      vi.mocked(exec).mockImplementation(mockExec)
      
      // Mock docker ps command response
      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        if (cmd.includes('docker ps --filter')) {
          callback(null, { 
            stdout: '{"ID":"abc123","Names":"supavisor","Image":"supabase/supavisor:latest","State":"running","Status":"Up 2 hours","Ports":"0.0.0.0:6543->6543/tcp, 0.0.0.0:4000->4000/tcp"}' 
          })
        }
      })

      const status = await dockerService.getContainerStatus('supavisor')
      
      expect(status.name).toBe('supavisor')
      expect(status.status).toBe('running')
      expect(status.ports).toEqual([
        { host: 6543, container: 6543 },
        { host: 4000, container: 4000 }
      ])
    })

    it('should handle container not found', async () => {
      const mockExec = vi.fn()
      const { exec } = await import('child_process')
      vi.mocked(exec).mockImplementation(mockExec)
      
      // Mock empty docker ps response
      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        callback(null, { stdout: '' })
      })

      const status = await dockerService.getContainerStatus('nonexistent')
      
      expect(status.name).toBe('nonexistent')
      expect(status.status).toBe('stopped')
    })

    it('should handle docker command errors gracefully', async () => {
      const mockExec = vi.fn()
      const { exec } = await import('child_process')
      vi.mocked(exec).mockImplementation(mockExec)
      
      // Mock docker command error
      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        callback(new Error('Docker not found'))
      })

      // Mock the service check methods to also fail to trigger error state
      vi.spyOn(dockerService as any, 'checkContainerRunning').mockRejectedValue(new Error('Service check failed'))
      vi.spyOn(dockerService as any, 'getContainerHealth').mockRejectedValue(new Error('Health check failed'))

      const status = await dockerService.getContainerStatus('supavisor')
      
      expect(status.name).toBe('supavisor')
      expect(status.status).toBe('error')
    })
  })

  describe('getContainerHealth', () => {
    it('should perform health check for supavisor', async () => {
      // Mock successful health check
      ;(global.fetch as any) = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'healthy' })
      } as Response)

      const health = await dockerService.getContainerHealth('supavisor')
      
      expect(health.healthy).toBe(true)
      expect(health.message).toBe('healthy')
      expect(health.responseTime).toBeGreaterThanOrEqual(0)
    })

    it('should handle health check failures', async () => {
      // Mock failed health check
      ;(global.fetch as any) = vi.fn().mockRejectedValueOnce(new Error('Connection refused'))
      
      // Mock the port listening check to also fail
      vi.spyOn(dockerService as any, 'checkPortListening').mockResolvedValue(false)

      const health = await dockerService.getContainerHealth('supavisor')
      
      expect(health.healthy).toBe(false)
      expect(health.message).toContain('Neither management nor proxy port accessible')
    })
  })

  describe('restartContainer', () => {
    it('should restart container successfully', async () => {
      const mockExec = vi.fn()
      const { exec } = await import('child_process')
      vi.mocked(exec).mockImplementation(mockExec)
      
      // Mock successful restart
      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        if (cmd.includes('docker ps -a --filter')) {
          callback(null, { stdout: 'supavisor' })
        } else if (cmd.includes('docker restart')) {
          callback(null, { stdout: '' })
        } else if (cmd.includes('docker ps --filter')) {
          callback(null, { stdout: 'supavisor' })
        }
      })

      const result = await dockerService.restartContainer('supavisor')
      
      expect(result.success).toBe(true)
      expect(result.message).toContain('restarted successfully')
    })

    it('should handle container not found', async () => {
      const mockExec = vi.fn()
      const { exec } = await import('child_process')
      vi.mocked(exec).mockImplementation(mockExec)
      
      // Mock container not found
      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        callback(null, { stdout: '' })
      })

      const result = await dockerService.restartContainer('nonexistent')
      
      expect(result.success).toBe(false)
      expect(result.message).toContain('not found')
    })
  })

  describe('getContainerLogs', () => {
    it('should retrieve container logs', async () => {
      const mockExec = vi.fn()
      const { exec } = await import('child_process')
      vi.mocked(exec).mockImplementation(mockExec)
      
      // Mock logs response
      const mockLogs = 'Log line 1\nLog line 2\nLog line 3'
      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        callback(null, { stdout: mockLogs })
      })

      const logs = await dockerService.getContainerLogs('supavisor', 10)
      
      expect(logs).toEqual(['Log line 1', 'Log line 2', 'Log line 3'])
    })

    it('should handle empty logs', async () => {
      const mockExec = vi.fn()
      const { exec } = await import('child_process')
      vi.mocked(exec).mockImplementation(mockExec)
      
      // Mock empty logs
      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        callback(null, { stdout: '' })
      })

      const logs = await dockerService.getContainerLogs('supavisor')
      
      expect(logs).toEqual(['No logs available for container \'supavisor\''])
    })
  })

  describe('getAllContainersStatus', () => {
    it('should get status for all containers', async () => {
      const mockExec = vi.fn()
      const { exec } = await import('child_process')
      vi.mocked(exec).mockImplementation(mockExec)
      
      // Mock multiple containers response
      const mockContainers = [
        '{"ID":"abc123","Names":"supavisor","Image":"supabase/supavisor:latest","State":"running","Status":"Up 2 hours"}',
        '{"ID":"def456","Names":"postgres","Image":"postgres:15","State":"running","Status":"Up 3 hours"}'
      ].join('\n')
      
      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        callback(null, { stdout: mockContainers })
      })

      const containers = await dockerService.getAllContainersStatus()
      
      expect(containers).toHaveLength(2)
      expect(containers[0].name).toBe('supavisor')
      expect(containers[1].name).toBe('postgres')
    })
  })
})