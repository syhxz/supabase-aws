import { databaseKeys } from './keys'
import { detectPoolingService, type PoolingService } from './pooling-configuration-query'

/**
 * Unified query key utilities for pooling services
 * Provides consistent key generation and management across PgBouncer and Supavisor
 */
export class PoolingQueryKeys {
  /**
   * Gets the appropriate configuration query key based on environment
   */
  static configuration(projectRef: string | undefined, service?: PoolingService) {
    const poolingService = service || detectPoolingService()
    
    if (poolingService === 'pgbouncer') {
      return databaseKeys.pgbouncerConfig(projectRef)
    } else {
      return databaseKeys.supavisorConfig(projectRef)
    }
  }

  /**
   * Gets the appropriate statistics query key based on environment
   */
  static statistics(projectRef: string | undefined, service?: PoolingService) {
    const poolingService = service || detectPoolingService()
    
    if (poolingService === 'pgbouncer') {
      // PgBouncer doesn't have dedicated statistics endpoint in platform
      return databaseKeys.poolingStatistics(projectRef)
    } else {
      return databaseKeys.supavisorStats(projectRef)
    }
  }

  /**
   * Gets the appropriate health query key based on environment
   */
  static health(projectRef: string | undefined, service?: PoolingService) {
    const poolingService = service || detectPoolingService()
    
    if (poolingService === 'pgbouncer') {
      // PgBouncer health is managed by platform
      return databaseKeys.poolingHealth(projectRef)
    } else {
      return databaseKeys.supavisorHealth(projectRef)
    }
  }

  /**
   * Gets all unified pooling query keys for a project
   */
  static unified(projectRef: string | undefined) {
    return {
      configuration: databaseKeys.poolingConfiguration(projectRef),
      statistics: databaseKeys.poolingStatistics(projectRef),
      health: databaseKeys.poolingHealth(projectRef),
      unified: databaseKeys.poolingUnified(projectRef),
    }
  }

  /**
   * Gets all service-specific query keys for a project
   */
  static serviceSpecific(projectRef: string | undefined, service?: PoolingService) {
    const poolingService = service || detectPoolingService()
    
    if (poolingService === 'pgbouncer') {
      return {
        config: databaseKeys.pgbouncerConfig(projectRef),
        status: databaseKeys.pgbouncerStatus(projectRef),
      }
    } else {
      return {
        config: databaseKeys.supavisorConfig(projectRef),
        stats: databaseKeys.supavisorStats(projectRef),
        health: databaseKeys.supavisorHealth(projectRef),
        recommendations: databaseKeys.supavisorRecommendations(projectRef),
        containers: databaseKeys.dockerContainers(projectRef, 'supavisor'),
      }
    }
  }

  /**
   * Gets all query keys that should be invalidated for configuration changes
   */
  static configurationInvalidationKeys(projectRef: string | undefined, service?: PoolingService) {
    const unified = this.unified(projectRef)
    const serviceSpecific = this.serviceSpecific(projectRef, service)
    
    return [
      unified.configuration,
      unified.statistics,
      unified.health,
      unified.unified,
      ...Object.values(serviceSpecific),
    ]
  }

  /**
   * Gets all query keys that should be invalidated for monitoring updates
   */
  static monitoringInvalidationKeys(projectRef: string | undefined, service?: PoolingService) {
    const unified = this.unified(projectRef)
    const serviceSpecific = this.serviceSpecific(projectRef, service)
    
    const keys = [unified.statistics, unified.health]
    
    if (service === 'supavisor') {
      keys.push(serviceSpecific.stats, serviceSpecific.health)
    }
    
    return keys
  }

  /**
   * Gets all query keys that should be invalidated for container status changes
   */
  static containerInvalidationKeys(projectRef: string | undefined, containerName?: string) {
    const keys = [
      databaseKeys.dockerContainers(projectRef),
    ]
    
    if (containerName) {
      keys.push(databaseKeys.dockerContainers(projectRef, containerName))
    }
    
    // If it's a Supavisor container, also include health keys
    if (containerName?.includes('supavisor')) {
      keys.push(
        databaseKeys.poolingHealth(projectRef),
        databaseKeys.supavisorHealth(projectRef)
      )
    }
    
    return keys
  }

  /**
   * Validates that a query key belongs to pooling services
   */
  static isPoolingKey(queryKey: readonly unknown[]): boolean {
    if (!Array.isArray(queryKey) || queryKey.length < 3) return false
    
    const [projects, projectRef, category, ...rest] = queryKey
    
    if (projects !== 'projects' || typeof projectRef !== 'string') return false
    
    // Check for database pooling keys
    if (category === 'database') {
      const subcategory = rest[0]
      return typeof subcategory === 'string' && subcategory.startsWith('pooling')
    }
    
    // Check for service-specific keys
    if (category === 'pgbouncer' || category === 'supavisor') {
      return true
    }
    
    // Check for Docker container keys (may affect pooling)
    if (category === 'docker-containers') {
      return true
    }
    
    return false
  }

  /**
   * Extracts project reference from a pooling query key
   */
  static extractProjectRef(queryKey: readonly unknown[]): string | undefined {
    if (!this.isPoolingKey(queryKey)) return undefined
    
    const [, projectRef] = queryKey
    return typeof projectRef === 'string' ? projectRef : undefined
  }
}

/**
 * Legacy utility functions for backward compatibility
 */
export const poolingQueryKeys = {
  configuration: PoolingQueryKeys.configuration,
  statistics: PoolingQueryKeys.statistics,
  health: PoolingQueryKeys.health,
  unified: PoolingQueryKeys.unified,
  serviceSpecific: PoolingQueryKeys.serviceSpecific,
}