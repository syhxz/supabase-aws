import { useQuery } from '@tanstack/react-query'

import { IS_PLATFORM } from 'lib/constants'
import type { ResponseError, UseCustomQueryOptions } from 'types'
import { databaseKeys } from './keys'
import { 
  getSupavisorStats, 
  type SupavisorStatsData, 
  type SupavisorStatsError 
} from './supavisor-stats-query'
import { detectPoolingService, type PoolingService } from './pooling-configuration-query'

export interface UnifiedPoolingStats {
  poolingService: PoolingService
  activeConnections: number
  idleConnections: number
  totalConnections: number
  poolUtilization: number
  clientConnections: number
  maxClientConnections: number
  uptime?: number
  environment: 'platform' | 'self-hosted'
}

export type PoolingStatisticsVariables = {
  projectRef?: string
}

/**
 * Transforms Supavisor statistics to unified format
 */
function transformSupavisorStats(data: SupavisorStatsData): UnifiedPoolingStats {
  return {
    poolingService: 'supavisor',
    activeConnections: data.activeConnections || 0,
    idleConnections: data.idleConnections || 0,
    totalConnections: data.totalConnections || 0,
    poolUtilization: data.poolUtilization || 0,
    clientConnections: data.clientConnections || 0,
    maxClientConnections: data.maxClientConnections || 200,
    uptime: data.uptime,
    environment: 'self-hosted'
  }
}

/**
 * Creates mock PgBouncer statistics for platform environments
 * In platform environments, detailed statistics are typically not exposed
 */
function createPlatformStats(): UnifiedPoolingStats {
  return {
    poolingService: 'pgbouncer',
    activeConnections: 0,
    idleConnections: 0,
    totalConnections: 0,
    poolUtilization: 0,
    clientConnections: 0,
    maxClientConnections: 200,
    environment: 'platform'
  }
}

/**
 * Unified function to get pooling statistics from appropriate service
 */
export async function getPoolingStatistics(
  { projectRef }: PoolingStatisticsVariables,
  signal?: AbortSignal
): Promise<UnifiedPoolingStats> {
  if (!projectRef) throw new Error('projectRef is required')

  const detection = await detectPoolingService(projectRef)
  const poolingService = detection.service

  try {
    if (poolingService === 'pgbouncer') {
      // Platform environments typically don't expose detailed pooling statistics
      // Return basic structure for consistency
      return createPlatformStats()
    } else {
      const supavisorData = await getSupavisorStats({ projectRef }, signal)
      return transformSupavisorStats(supavisorData)
    }
  } catch (error) {
    // Fallback to empty statistics on error
    return {
      poolingService,
      activeConnections: 0,
      idleConnections: 0,
      totalConnections: 0,
      poolUtilization: 0,
      clientConnections: 0,
      maxClientConnections: 200,
      environment: IS_PLATFORM ? 'platform' : 'self-hosted'
    }
  }
}

export type PoolingStatisticsData = UnifiedPoolingStats
export type PoolingStatisticsError = SupavisorStatsError | ResponseError

/**
 * Unified hook for pooling statistics that automatically detects environment
 * and uses the appropriate pooling service
 */
export const usePoolingStatisticsQuery = <TData = PoolingStatisticsData>(
  { projectRef }: PoolingStatisticsVariables,
  {
    enabled = true,
    ...options
  }: UseCustomQueryOptions<PoolingStatisticsData, PoolingStatisticsError, TData> = {}
) =>
  useQuery<PoolingStatisticsData, PoolingStatisticsError, TData>({
    queryKey: databaseKeys.poolingStatistics(projectRef),
    queryFn: ({ signal }) => getPoolingStatistics({ projectRef }, signal),
    enabled: enabled && typeof projectRef !== 'undefined',
    refetchInterval: IS_PLATFORM ? false : 30000, // Only auto-refresh for self-hosted
    staleTime: IS_PLATFORM ? 5 * 60 * 1000 : 30 * 1000, // Platform: 5min, Self-hosted: 30sec
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