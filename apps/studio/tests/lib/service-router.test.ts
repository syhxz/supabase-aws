/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ConnectionPoolManager } from '../../lib/service-router/ConnectionPoolManager'
import { ProjectConfigStorage, type ProjectConfig } from '../../lib/service-router/ProjectConfigStorage'
import { AccessValidator } from '../../lib/service-router/AccessValidation'
import { ServiceRouter } from '../../lib/service-router/ServiceRouter'

describe('ServiceRouter', () => {
  let serviceRouter: ServiceRouter

  beforeEach(() => {
    // Create a new instance for each test
    serviceRouter = new ServiceRouter()
  })

  afterEach(async () => {
    // Clean up after each test
    await serviceRouter.closeAllPools()
  })

  describe('Project Registration', () => {
    it('should register a project successfully', async () => {
      const config: ProjectConfig = {
        projectRef: 'test-project-1',
        databaseName: 'test_db_1',
        connectionString: 'postgresql://localhost:5432/test_db_1',
        ownerUserId: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      await serviceRouter.registerProject(config)

      const isRegistered = await serviceRouter.isProjectRegistered('test-project-1')
      expect(isRegistered).toBe(true)
    })

    it('should retrieve registered project configuration', async () => {
      const config: ProjectConfig = {
        projectRef: 'test-project-2',
        databaseName: 'test_db_2',
        connectionString: 'postgresql://localhost:5432/test_db_2',
        ownerUserId: 'user-456',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      await serviceRouter.registerProject(config)

      const retrievedConfig = await serviceRouter.getProjectConfig('test-project-2')
      expect(retrievedConfig).not.toBeNull()
      expect(retrievedConfig?.projectRef).toBe('test-project-2')
      expect(retrievedConfig?.ownerUserId).toBe('user-456')
    })

    it('should unregister a project successfully', async () => {
      const config: ProjectConfig = {
        projectRef: 'test-project-3',
        databaseName: 'test_db_3',
        connectionString: 'postgresql://localhost:5432/test_db_3',
        ownerUserId: 'user-789',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      await serviceRouter.registerProject(config)
      expect(await serviceRouter.isProjectRegistered('test-project-3')).toBe(true)

      await serviceRouter.unregisterProject('test-project-3')
      expect(await serviceRouter.isProjectRegistered('test-project-3')).toBe(false)
    })
  })

  describe('Connection Pool Management', () => {
    it('should throw error when getting connection for unregistered project', async () => {
      await expect(
        serviceRouter.getConnection('non-existent-project')
      ).rejects.toThrow('Project not registered')
    })

    it('should get pool stats for registered project', async () => {
      const config: ProjectConfig = {
        projectRef: 'test-project-4',
        databaseName: 'test_db_4',
        connectionString: 'postgresql://localhost:5432/test_db_4',
        ownerUserId: 'user-111',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      await serviceRouter.registerProject(config)

      // Pool stats should be null until pool is created
      const stats = serviceRouter.getPoolStats('test-project-4')
      expect(stats).toBeNull()
    })

    it('should get all pool stats', async () => {
      const config1: ProjectConfig = {
        projectRef: 'test-project-5',
        databaseName: 'test_db_5',
        connectionString: 'postgresql://localhost:5432/test_db_5',
        ownerUserId: 'user-222',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const config2: ProjectConfig = {
        projectRef: 'test-project-6',
        databaseName: 'test_db_6',
        connectionString: 'postgresql://localhost:5432/test_db_6',
        ownerUserId: 'user-333',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      await serviceRouter.registerProject(config1)
      await serviceRouter.registerProject(config2)

      const allStats = serviceRouter.getAllPoolStats()
      expect(allStats).toBeInstanceOf(Map)
    })
  })

  describe('Access Validation', () => {
    it('should validate project access for owner', async () => {
      const config: ProjectConfig = {
        projectRef: 'test-project-7',
        databaseName: 'test_db_7',
        connectionString: 'postgresql://localhost:5432/test_db_7',
        ownerUserId: 'user-444',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      await serviceRouter.registerProject(config)

      const hasAccess = await serviceRouter.validateProjectAccess('test-project-7', 'user-444')
      expect(hasAccess).toBe(true)
    })

    it('should deny project access for non-owner', async () => {
      const config: ProjectConfig = {
        projectRef: 'test-project-8',
        databaseName: 'test_db_8',
        connectionString: 'postgresql://localhost:5432/test_db_8',
        ownerUserId: 'user-555',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      await serviceRouter.registerProject(config)

      const hasAccess = await serviceRouter.validateProjectAccess('test-project-8', 'user-666')
      expect(hasAccess).toBe(false)
    })

    it('should deny access for non-existent project', async () => {
      const hasAccess = await serviceRouter.validateProjectAccess(
        'non-existent-project',
        'user-777'
      )
      expect(hasAccess).toBe(false)
    })
  })

  describe('Cache Management', () => {
    it('should invalidate cache for a project', async () => {
      const config: ProjectConfig = {
        projectRef: 'test-project-9',
        databaseName: 'test_db_9',
        connectionString: 'postgresql://localhost:5432/test_db_9',
        ownerUserId: 'user-888',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      await serviceRouter.registerProject(config)

      // This should not throw
      serviceRouter.invalidateCache('test-project-9')
    })

    it('should invalidate all caches', async () => {
      const config1: ProjectConfig = {
        projectRef: 'test-project-10',
        databaseName: 'test_db_10',
        connectionString: 'postgresql://localhost:5432/test_db_10',
        ownerUserId: 'user-999',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const config2: ProjectConfig = {
        projectRef: 'test-project-11',
        databaseName: 'test_db_11',
        connectionString: 'postgresql://localhost:5432/test_db_11',
        ownerUserId: 'user-1000',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      await serviceRouter.registerProject(config1)
      await serviceRouter.registerProject(config2)

      // This should not throw
      serviceRouter.invalidateAllCaches()
    })
  })

  describe('Rate Limiting', () => {
    it('should track rate limit stats', async () => {
      const config: ProjectConfig = {
        projectRef: 'test-project-12',
        databaseName: 'test_db_12',
        connectionString: 'postgresql://localhost:5432/test_db_12',
        ownerUserId: 'user-1001',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      await serviceRouter.registerProject(config)

      // Initially no rate limit stats
      const stats = serviceRouter.getRateLimitStats('test-project-12')
      expect(stats).toBeNull()
    })

    it('should reset rate limit for a project', async () => {
      const config: ProjectConfig = {
        projectRef: 'test-project-13',
        databaseName: 'test_db_13',
        connectionString: 'postgresql://localhost:5432/test_db_13',
        ownerUserId: 'user-1002',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      await serviceRouter.registerProject(config)

      // This should not throw
      serviceRouter.resetRateLimit('test-project-13')
    })
  })

})

describe('ConnectionPoolManager', () => {
  let poolManager: ConnectionPoolManager

  beforeEach(() => {
    poolManager = new ConnectionPoolManager()
  })

  afterEach(async () => {
    await poolManager.closeAllPools()
  })

  it('should register a project', () => {
    poolManager.registerProject({
      projectRef: 'test-pool-1',
      databaseName: 'test_db_pool_1',
      connectionString: 'postgresql://localhost:5432/test_db_pool_1',
    })

    const projects = poolManager.getRegisteredProjects()
    expect(projects).toContain('test-pool-1')
  })

  it('should check if pool exists', () => {
    poolManager.registerProject({
      projectRef: 'test-pool-2',
      databaseName: 'test_db_pool_2',
      connectionString: 'postgresql://localhost:5432/test_db_pool_2',
    })

    expect(poolManager.hasPool('test-pool-2')).toBe(false) // Pool not created yet
  })
})

describe('ProjectConfigStorage', () => {
  let configStorage: ProjectConfigStorage

  beforeEach(() => {
    configStorage = new ProjectConfigStorage()
  })

  afterEach(() => {
    configStorage.stopCleanupInterval()
  })

  it('should set and get configuration', async () => {
    const config: ProjectConfig = {
      projectRef: 'test-config-1',
      databaseName: 'test_db_config_1',
      connectionString: 'postgresql://localhost:5432/test_db_config_1',
      ownerUserId: 'user-config-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await configStorage.set(config)

    const retrieved = await configStorage.get('test-config-1')
    expect(retrieved).not.toBeNull()
    expect(retrieved?.projectRef).toBe('test-config-1')
  })

  it('should return null for non-existent configuration', async () => {
    const config = await configStorage.get('non-existent')
    expect(config).toBeNull()
  })

  it('should delete configuration', async () => {
    const config: ProjectConfig = {
      projectRef: 'test-config-2',
      databaseName: 'test_db_config_2',
      connectionString: 'postgresql://localhost:5432/test_db_config_2',
      ownerUserId: 'user-config-2',
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await configStorage.set(config)
    expect(await configStorage.has('test-config-2')).toBe(true)

    await configStorage.delete('test-config-2')
    expect(await configStorage.has('test-config-2')).toBe(false)
  })

  it('should invalidate cache', async () => {
    const config: ProjectConfig = {
      projectRef: 'test-config-3',
      databaseName: 'test_db_config_3',
      connectionString: 'postgresql://localhost:5432/test_db_config_3',
      ownerUserId: 'user-config-3',
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await configStorage.set(config)
    
    // This should not throw
    configStorage.invalidate('test-config-3')
  })

  it('should get cache stats', () => {
    const stats = configStorage.getCacheStats()
    expect(stats).toHaveProperty('size')
    expect(stats).toHaveProperty('hitRate')
  })
})

describe('AccessValidator', () => {
  let validator: AccessValidator

  beforeEach(() => {
    validator = new AccessValidator()
  })

  afterEach(() => {
    validator.clearAllRateLimits()
  })

  it('should allow requests within rate limit', () => {
    const result1 = validator.checkRateLimit('test-rate-1')
    expect(result1.allowed).toBe(true)

    const result2 = validator.checkRateLimit('test-rate-1')
    expect(result2.allowed).toBe(true)
  })

  it('should deny requests exceeding rate limit', () => {
    const config = { maxRequests: 2, windowMs: 60000 }

    validator.checkRateLimit('test-rate-2', config)
    validator.checkRateLimit('test-rate-2', config)
    
    const result = validator.checkRateLimit('test-rate-2', config)
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('Rate limit exceeded')
  })

  it('should reset rate limit', () => {
    const config = { maxRequests: 1, windowMs: 60000 }

    validator.checkRateLimit('test-rate-3', config)
    validator.resetRateLimit('test-rate-3')

    const result = validator.checkRateLimit('test-rate-3', config)
    expect(result.allowed).toBe(true)
  })

  it('should get rate limit stats', () => {
    validator.checkRateLimit('test-rate-4')

    const stats = validator.getRateLimitStats('test-rate-4')
    expect(stats).not.toBeNull()
    expect(stats?.count).toBeGreaterThan(0)
  })

  it('should clear all rate limits', () => {
    validator.checkRateLimit('test-rate-5')
    validator.checkRateLimit('test-rate-6')

    validator.clearAllRateLimits()

    expect(validator.getRateLimitStats('test-rate-5')).toBeNull()
    expect(validator.getRateLimitStats('test-rate-6')).toBeNull()
  })
})
