import { QueryClient } from '@tanstack/react-query'
import { IS_PLATFORM } from 'lib/constants'
import { databaseKeys } from './keys'
import { detectPoolingService, type PoolingService } from './pooling-configuration-query'

export interface PoolingCacheInvalidationOptions {
  projectRef: string
  poolingService?: PoolingService
  includeStatistics?: boolean
  includeHealth?: boolean
  includeRecommendations?: boolean
  includeDockerContainers?: boolean
}

/**
 * Centralized cache invalidation for all pooling-related queries
 * Ensures consistent cache management across both PgBouncer and Supavisor
 */
export class PoolingCacheInvalidation {
  /**
   * Invalidates all pooling-related queries for a project
   */
  static async invalidateAll(
    queryClient: QueryClient,
    options: PoolingCacheInvalidationOptions
  ): Promise<void> {
    const {
      projectRef,
      poolingService = detectPoolingService(),
      includeStatistics = true,
      includeHealth = true,
      includeRecommendations = true,
      includeDockerContainers = true,
    } = options

    // Always invalidate unified pooling queries
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: databaseKeys.poolingConfiguration(projectRef),
      }),
      queryClient.invalidateQueries({
        queryKey: databaseKeys.poolingUnified(projectRef),
      }),
    ])

    // Conditionally invalidate statistics and health
    if (includeStatistics) {
      await queryClient.invalidateQueries({
        queryKey: databaseKeys.poolingStatistics(projectRef),
      })
    }

    if (includeHealth) {
      await queryClient.invalidateQueries({
        queryKey: databaseKeys.poolingHealth(projectRef),
      })
    }

    // Invalidate service-specific queries
    if (poolingService === 'pgbouncer') {
      await this.invalidatePgbouncerQueries(queryClient, projectRef)
    } else {
      await this.invalidateSupavisorQueries(queryClient, projectRef, {
        includeRecommendations,
        includeDockerContainers,
      })
    }
  }

  /**
   * Invalidates only configuration-related queries (for configuration updates)
   */
  static async invalidateConfiguration(
    queryClient: QueryClient,
    projectRef: string,
    poolingService: PoolingService = detectPoolingService()
  ): Promise<void> {
    await this.invalidateAll(queryClient, {
      projectRef,
      poolingService,
      includeStatistics: true,
      includeHealth: true,
      includeRecommendations: false,
      includeDockerContainers: false,
    })
  }

  /**
   * Invalidates only statistics and health queries (for monitoring updates)
   */
  static async invalidateMonitoring(
    queryClient: QueryClient,
    projectRef: string,
    poolingService: PoolingService = detectPoolingService()
  ): Promise<void> {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: databaseKeys.poolingStatistics(projectRef),
      }),
      queryClient.invalidateQueries({
        queryKey: databaseKeys.poolingHealth(projectRef),
      }),
    ])

    if (poolingService === 'supavisor') {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: databaseKeys.supavisorStats(projectRef),
        }),
        queryClient.invalidateQueries({
          queryKey: databaseKeys.supavisorHealth(projectRef),
        }),
      ])
    }
  }

  /**
   * Invalidates Docker container queries (for service status updates)
   */
  static async invalidateContainerStatus(
    queryClient: QueryClient,
    projectRef: string,
    containerName?: string
  ): Promise<void> {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: databaseKeys.dockerContainers(projectRef),
      }),
      containerName
        ? queryClient.invalidateQueries({
            queryKey: databaseKeys.dockerContainers(projectRef, containerName),
          })
        : Promise.resolve(),
    ])

    // If it's a Supavisor container, also invalidate health
    if (containerName?.includes('supavisor')) {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: databaseKeys.poolingHealth(projectRef),
        }),
        queryClient.invalidateQueries({
          queryKey: databaseKeys.supavisorHealth(projectRef),
        }),
      ])
    }
  }

  /**
   * Invalidates PgBouncer-specific queries
   */
  private static async invalidatePgbouncerQueries(
    queryClient: QueryClient,
    projectRef: string
  ): Promise<void> {
    await queryClient.invalidateQueries({
      queryKey: databaseKeys.pgbouncerConfig(projectRef),
    })
  }

  /**
   * Invalidates Supavisor-specific queries
   */
  private static async invalidateSupavisorQueries(
    queryClient: QueryClient,
    projectRef: string,
    options: {
      includeRecommendations?: boolean
      includeDockerContainers?: boolean
    } = {}
  ): Promise<void> {
    const { includeRecommendations = true, includeDockerContainers = true } = options

    const invalidationPromises = [
      queryClient.invalidateQueries({
        queryKey: databaseKeys.supavisorConfig(projectRef),
      }),
      queryClient.invalidateQueries({
        queryKey: databaseKeys.supavisorStats(projectRef),
      }),
      queryClient.invalidateQueries({
        queryKey: databaseKeys.supavisorHealth(projectRef),
      }),
    ]

    if (includeRecommendations) {
      invalidationPromises.push(
        queryClient.invalidateQueries({
          queryKey: databaseKeys.supavisorRecommendations(projectRef),
        })
      )
    }

    if (includeDockerContainers) {
      invalidationPromises.push(
        queryClient.invalidateQueries({
          queryKey: databaseKeys.dockerContainers(projectRef, 'supavisor'),
        })
      )
    }

    await Promise.all(invalidationPromises)
  }

  /**
   * Creates a standardized cache invalidation function for mutations
   */
  static createMutationInvalidator(
    queryClient: QueryClient,
    type: 'configuration' | 'monitoring' | 'container-status' = 'configuration'
  ) {
    return async (projectRef: string, containerName?: string) => {
      switch (type) {
        case 'configuration':
          await this.invalidateConfiguration(queryClient, projectRef)
          break
        case 'monitoring':
          await this.invalidateMonitoring(queryClient, projectRef)
          break
        case 'container-status':
          await this.invalidateContainerStatus(queryClient, projectRef, containerName)
          break
      }
    }
  }
}

/**
 * Utility function for backward compatibility
 * @deprecated Use PoolingCacheInvalidation.invalidateAll instead
 */
export function invalidatePoolingQueries(
  queryClient: QueryClient,
  projectRef: string,
  poolingService?: PoolingService
): Promise<void> {
  return PoolingCacheInvalidation.invalidateAll(queryClient, {
    projectRef,
    poolingService,
  })
}