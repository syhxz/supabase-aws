/**
 * @vitest-environment node
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { 
  CredentialFallbackManager,
  getCredentialFallbackManager,
  resetCredentialFallbackManager,
  type ProjectCredentials,
  type SystemCredentials,
  type FallbackUsageEntry
} from './credential-fallback-manager'

// Mock the environment config handler
vi.mock('../../environment-config-handler', () => ({
  getEnvironmentConfigHandler: vi.fn(() => ({
    getCurrentConfig: vi.fn(() => ({
      POSTGRES_HOST: 'test-host',
      POSTGRES_PORT: '5432',
      POSTGRES_PASSWORD: 'test-env-password',
      POSTGRES_USER_READ_WRITE: 'test-env-admin',
      POSTGRES_USER_READ_ONLY: 'test-env-readonly'
    }))
  }))
}))

describe('CredentialFallbackManager', () => {
  let manager: CredentialFallbackManager
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
    manager = new CredentialFallbackManager()
  })

  afterEach(() => {
    process.env = originalEnv
    vi.clearAllMocks()
  })

  describe('getProjectCredentials', () => {
    it('should return complete credentials when both user and password are provided', () => {
      const result = manager.getProjectCredentials('test-project', 'test_user', 'test_password_hash')

      expect(result).toEqual({
        user: 'test_user',
        passwordHash: 'test_password_hash',
        isComplete: true
      })
    })

    it('should return incomplete credentials when user is missing', () => {
      const result = manager.getProjectCredentials('test-project', null, 'test_password_hash')

      expect(result).toEqual({
        user: null,
        passwordHash: 'test_password_hash',
        isComplete: false
      })
    })

    it('should return incomplete credentials when password is missing', () => {
      const result = manager.getProjectCredentials('test-project', 'test_user', null)

      expect(result).toEqual({
        user: 'test_user',
        passwordHash: null,
        isComplete: false
      })
    })

    it('should return incomplete credentials when both are missing', () => {
      const result = manager.getProjectCredentials('test-project', null, null)

      expect(result).toEqual({
        user: null,
        passwordHash: null,
        isComplete: false
      })
    })

    it('should normalize empty strings to null', () => {
      const result = manager.getProjectCredentials('test-project', '', '   ')

      expect(result).toEqual({
        user: null,
        passwordHash: null,
        isComplete: false
      })
    })

    it('should trim whitespace from credentials', () => {
      const result = manager.getProjectCredentials('test-project', '  test_user  ', '  test_password  ')

      expect(result).toEqual({
        user: 'test_user',
        passwordHash: 'test_password',
        isComplete: true
      })
    })

    it('should handle undefined values', () => {
      const result = manager.getProjectCredentials('test-project', undefined, undefined)

      expect(result).toEqual({
        user: null,
        passwordHash: null,
        isComplete: false
      })
    })
  })

  describe('getFallbackCredentials', () => {
    it('should return read-write credentials by default', async () => {
      const result = await manager.getFallbackCredentials()

      expect(result.user).toBe('test-env-admin')
      expect(result.password).toBe('test-env-password')
      expect(result.source).toBe('environment')
    })

    it('should return read-only credentials when readOnly is true', async () => {
      const result = await manager.getFallbackCredentials(true)

      expect(result.user).toBe('test-env-readonly')
      expect(result.password).toBe('test-env-password')
      expect(result.source).toBe('environment')
    })

    it('should validate fallback credentials are not empty', async () => {
      // Test that the current environment has valid fallback credentials
      const result = await manager.getFallbackCredentials()
      
      expect(result.user).toBeTruthy()
      expect(result.password).toBeTruthy()
      expect(result.source).toMatch(/^(environment|default)$/)
    })

    it('should handle environment config handler failure gracefully', async () => {
      // Mock environment config handler to throw error
      const envConfigModule = await import('../../environment-config-handler')
      vi.mocked(envConfigModule.getEnvironmentConfigHandler).mockImplementation(() => {
        throw new Error('Config handler not available')
      })

      // Should fall back to constants
      const result = await manager.getFallbackCredentials()

      expect(result.user).toBe('postgres')
      expect(result.password).toBe('postgres')
    })

    it('should trim whitespace from fallback credentials', async () => {
      // Mock environment config with whitespace
      const envConfigModule = await import('../../environment-config-handler')
      vi.mocked(envConfigModule.getEnvironmentConfigHandler).mockReturnValue({
        getCurrentConfig: () => ({
          POSTGRES_USER_READ_WRITE: '  test-user  ',
          POSTGRES_PASSWORD: '  test-password  '
        })
      })

      const result = await manager.getFallbackCredentials()

      expect(result.user).toBe('test-user')
      expect(result.password).toBe('test-password')
    })
  })

  describe('shouldUseFallback', () => {
    it('should return true when credentials are null', () => {
      const result = manager.shouldUseFallback(null as any)
      expect(result).toBe(true)
    })

    it('should return true when credentials are undefined', () => {
      const result = manager.shouldUseFallback(undefined as any)
      expect(result).toBe(true)
    })

    it('should return false when isComplete is explicitly true', () => {
      const credentials: ProjectCredentials = {
        user: 'test_user',
        passwordHash: 'test_password',
        isComplete: true
      }

      const result = manager.shouldUseFallback(credentials)
      expect(result).toBe(false)
    })

    it('should return true when isComplete is explicitly false', () => {
      const credentials: ProjectCredentials = {
        user: 'test_user',
        passwordHash: 'test_password',
        isComplete: false
      }

      const result = manager.shouldUseFallback(credentials)
      expect(result).toBe(true)
    })

    it('should return true when user is missing', () => {
      const credentials = {
        user: null,
        passwordHash: 'test_password'
      }

      const result = manager.shouldUseFallback(credentials)
      expect(result).toBe(true)
    })

    it('should return true when password is missing', () => {
      const credentials = {
        user: 'test_user',
        passwordHash: null
      }

      const result = manager.shouldUseFallback(credentials)
      expect(result).toBe(true)
    })

    it('should return false when both user and password are present', () => {
      const credentials = {
        user: 'test_user',
        passwordHash: 'test_password'
      }

      const result = manager.shouldUseFallback(credentials)
      expect(result).toBe(false)
    })

    it('should return true when user is empty string', () => {
      const credentials = {
        user: '',
        passwordHash: 'test_password'
      }

      const result = manager.shouldUseFallback(credentials)
      expect(result).toBe(true)
    })

    it('should return true when password is empty string', () => {
      const credentials = {
        user: 'test_user',
        passwordHash: ''
      }

      const result = manager.shouldUseFallback(credentials)
      expect(result).toBe(true)
    })
  })

  describe('logFallbackUsage', () => {
    it('should log fallback usage with default credential type', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      manager.logFallbackUsage('test-project', 'Missing user credentials')

      const recentUsage = manager.getRecentFallbackUsage(1)
      expect(recentUsage).toHaveLength(1)
      expect(recentUsage[0]).toMatchObject({
        projectRef: 'test-project',
        reason: 'Missing user credentials',
        credentialType: 'both'
      })
      expect(recentUsage[0].timestamp).toBeDefined()

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Credential Fallback] Project: test-project, Reason: Missing user credentials, Type: both')
      )

      consoleSpy.mockRestore()
    })

    it('should log fallback usage with specific credential type', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      manager.logFallbackUsage('test-project', 'Missing password', 'password')

      const recentUsage = manager.getRecentFallbackUsage(1)
      expect(recentUsage[0]).toMatchObject({
        projectRef: 'test-project',
        reason: 'Missing password',
        credentialType: 'password'
      })

      consoleSpy.mockRestore()
    })

    it('should maintain log size limit', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      // Add more than 1000 entries
      for (let i = 0; i < 1005; i++) {
        manager.logFallbackUsage(`project-${i}`, `reason-${i}`)
      }

      const allUsage = manager.getRecentFallbackUsage(2000)
      expect(allUsage.length).toBe(1000)

      consoleSpy.mockRestore()
    })
  })

  describe('getRecentFallbackUsage', () => {
    beforeEach(() => {
      vi.spyOn(console, 'log').mockImplementation(() => {})
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should return recent usage entries in reverse chronological order', async () => {
      manager.logFallbackUsage('project-1', 'reason-1')
      // Add small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 5))
      manager.logFallbackUsage('project-2', 'reason-2')
      await new Promise(resolve => setTimeout(resolve, 5))
      manager.logFallbackUsage('project-3', 'reason-3')

      const recentUsage = manager.getRecentFallbackUsage(3)

      expect(recentUsage).toHaveLength(3)
      expect(recentUsage[0].projectRef).toBe('project-3')
      expect(recentUsage[1].projectRef).toBe('project-2')
      expect(recentUsage[2].projectRef).toBe('project-1')
    })

    it('should respect the limit parameter', async () => {
      manager.logFallbackUsage('project-1', 'reason-1')
      await new Promise(resolve => setTimeout(resolve, 10))
      manager.logFallbackUsage('project-2', 'reason-2')
      await new Promise(resolve => setTimeout(resolve, 1))
      manager.logFallbackUsage('project-3', 'reason-3')

      const recentUsage = manager.getRecentFallbackUsage(2)

      expect(recentUsage).toHaveLength(2)
      expect(recentUsage[0].projectRef).toBe('project-3')
      expect(recentUsage[1].projectRef).toBe('project-2')
    })

    it('should default to 100 entries when no limit specified', () => {
      // Add 150 entries
      for (let i = 0; i < 150; i++) {
        manager.logFallbackUsage(`project-${i}`, `reason-${i}`)
      }

      const recentUsage = manager.getRecentFallbackUsage()

      expect(recentUsage.length).toBe(100)
    })
  })

  describe('getFallbackUsageStats', () => {
    beforeEach(() => {
      vi.spyOn(console, 'log').mockImplementation(() => {})
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should return correct statistics', () => {
      manager.logFallbackUsage('project-1', 'Missing user')
      manager.logFallbackUsage('project-2', 'Missing password')
      manager.logFallbackUsage('project-1', 'Missing user') // Same project, same reason
      manager.logFallbackUsage('project-3', 'Missing both')

      const stats = manager.getFallbackUsageStats()

      expect(stats.totalEntries).toBe(4)
      expect(stats.uniqueProjects).toBe(3)
      expect(stats.recentUsage).toHaveLength(4)
      expect(stats.mostCommonReasons).toEqual([
        { reason: 'Missing user', count: 2 },
        { reason: 'Missing password', count: 1 },
        { reason: 'Missing both', count: 1 }
      ])
    })

    it('should limit most common reasons to top 10', () => {
      // Add 15 different reasons
      for (let i = 0; i < 15; i++) {
        manager.logFallbackUsage('project-1', `reason-${i}`)
      }

      const stats = manager.getFallbackUsageStats()

      expect(stats.mostCommonReasons.length).toBe(10)
    })

    it('should return empty stats when no usage logged', () => {
      const stats = manager.getFallbackUsageStats()

      expect(stats.totalEntries).toBe(0)
      expect(stats.uniqueProjects).toBe(0)
      expect(stats.recentUsage).toEqual([])
      expect(stats.mostCommonReasons).toEqual([])
    })
  })

  describe('clearFallbackUsageLog', () => {
    beforeEach(() => {
      vi.spyOn(console, 'log').mockImplementation(() => {})
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should clear all fallback usage logs', () => {
      manager.logFallbackUsage('project-1', 'reason-1')
      manager.logFallbackUsage('project-2', 'reason-2')

      expect(manager.getRecentFallbackUsage()).toHaveLength(2)

      manager.clearFallbackUsageLog()

      expect(manager.getRecentFallbackUsage()).toHaveLength(0)
      expect(manager.getFallbackUsageStats().totalEntries).toBe(0)
    })
  })
})

describe('Singleton functions', () => {
  beforeEach(() => {
    resetCredentialFallbackManager()
  })

  describe('getCredentialFallbackManager', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = getCredentialFallbackManager()
      const instance2 = getCredentialFallbackManager()

      expect(instance1).toBe(instance2)
    })

    it('should return a CredentialFallbackManager instance', () => {
      const instance = getCredentialFallbackManager()

      expect(instance).toBeInstanceOf(CredentialFallbackManager)
    })
  })

  describe('resetCredentialFallbackManager', () => {
    it('should create a new instance after reset', () => {
      const instance1 = getCredentialFallbackManager()
      resetCredentialFallbackManager()
      const instance2 = getCredentialFallbackManager()

      expect(instance1).not.toBe(instance2)
    })

    it('should clear state after reset', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const instance1 = getCredentialFallbackManager()
      instance1.logFallbackUsage('test-project', 'test-reason')

      expect(instance1.getRecentFallbackUsage()).toHaveLength(1)

      resetCredentialFallbackManager()
      const instance2 = getCredentialFallbackManager()

      expect(instance2.getRecentFallbackUsage()).toHaveLength(0)

      consoleSpy.mockRestore()
    })
  })
})