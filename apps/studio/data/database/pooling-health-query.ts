import { useQuery } from '@tanstack/react-query'

import { IS_PLATFORM } from 'lib/constants'
import type { ResponseError, UseCustomQueryOptions } from 'types'
import { databaseKeys } from './keys'
import { 
  getSupavisorHealth, 
  type SupavisorHealthData, 
  type SupavisorHealthError 
} from './supavisor-health-query'
import { detectPoolingService, type PoolingService } from './pooling-configuration-query'

export interface UnifiedPoolingHealth {
  poolingService: PoolingService
  healthy: boolean
  status: 'healthy' | 'unhealthy' | 'unknown'
  message?: string
  environment: 'platform' | 'self-hosted'
  lastChecked?: string
}

export type PoolingHealthVariables = {
  projectRef?: string
}

/**
 * Transforms Supavisor health data to unified format
 */
function transformSupavisorHealth(data: SupavisorHealthData): UnifiedPoolingHealth {
  return {
    poolingService: 'supavisor',
    healthy: data.healthy || false,
    status: data.healthy ? 'healthy' : 'unhealthy',
    message: data.message,
    environment: 'self-hosted',
    lastChecked: new Date().toISOString()
  }
}

/**
 * Creates platform health status (PgBouncer is managed by platform)
 */
function createPlatformHealth(): UnifiedPoolingHealth {
  return {
    poolingService: 'pgbouncer',
    healthy: true,
    status: 'healthy',
    message: 'PgBouncer is managed by Supabase Platform',
    environment: 'platform',
    lastChecked: new Date().toISOString()
  }
}

/**
 * Unified function to get pooling health from appropriate service
 */
export async function getPoolingHealth(
  { projectRef }: PoolingHealthVariables,
  signal?: AbortSignal
): Promise<UnifiedPoolingHealth> {
  if (!projectRef) throw new Error('projectRef is required')

  const poolingService = detectPoolingService()

  try {
    if (poolingService === 'pgbouncer') {
      // Platform environments have managed pooling, assume healthy
      return createPlatformHealth()
    } else {
      const supavisorData = await getSupavisorHealth({ projectRef }, signal)
      return transformSupavisorHealth(supavisorData)
    }
  } catch (error) {
    // Return unhealthy status on error
    return {
      poolingService,
      healthy: false,
      status: 'unknown',
      message: error instanceof Error ? error.message : 'Health check failed',
      environment: IS_PLATFORM ? 'platform' : 'self-hosted',
      lastChecked: new Date().toISOString()
    }
  }
}

export type PoolingHealthData = UnifiedPoolingHealth
export type PoolingHealthError = SupavisorHealthError | ResponseError

/**
 * Unified hook for pooling health that automatically detects environment
 * and uses the appropriate pooling service
 */
export const usePoolingHealthQuery = <TData = PoolingHealthData>(
  { projectRef }: PoolingHealthVariables,
  {
    enabled = true,
    ...options
  }: UseCustomQueryOptions<PoolingHealthData, PoolingHealthError, TData> = {}
) =>
  useQuery<PoolingHealthData, PoolingHealthError, TData>({
    queryKey: databaseKeys.poolingHealth(projectRef),
    queryFn: ({ signal }) => getPoolingHealth({ projectRef }, signal),
    enabled: enabled && typeof projectRef !== 'undefined',
    refetchInterval: IS_PLATFORM ? false : 60000, // Only auto-refresh for self-hosted (1 minute)
    staleTime: IS_PLATFORM ? 5 * 60 * 1000 : 60 * 1000, // Platform: 5min, Self-hosted: 1min
    cacheTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    retry: (failureCount, error) => {
      // Don't retry if it's a configuration error
      if (error && typeof error === 'object' && 'status' in error) {
        const status = (error as any).status
        if (status === 404 || status === 403) return false
      }
      return failureCount < 2
    },
    ...options,
  })