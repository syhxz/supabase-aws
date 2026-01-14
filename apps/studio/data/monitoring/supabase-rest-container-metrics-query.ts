import { useQuery } from '@tanstack/react-query'
import { get, handleError } from 'data/fetchers'
import type { ResponseError, UseCustomQueryOptions } from 'types'

export type SupabaseRestContainerMetricsVariables = {
  projectRef?: string
}

export interface SupabaseRestContainerMetricsResponse {
  projectRef: string
  timestamp: string
  metrics: {
    activeConnections: number
    totalQueries: number
    averageResponseTime: number
    errorRate: number
    cacheHitRate: number
    memoryUsage: number
    cpuUsage: number
    requestsPerSecond: number
    slowQueries: number
    connectionPoolUtilization: number
  }
  queryStats: {
    selectQueries: number
    insertQueries: number
    updateQueries: number
    deleteQueries: number
    rpcCalls: number
    bulkOperations: number
    transactionCount: number
    aggregateQueries: number
    nestedResourceQueries: number
    fullTextSearchQueries: number
    jsonOperationQueries: number
    arrayOperationQueries: number
  }
  errorStats: {
    totalErrors: number
    authenticationErrors: number
    authorizationErrors: number
    validationErrors: number
    databaseErrors: number
    timeoutErrors: number
    networkErrors: number
    internalErrors: number
  }
  performanceStats: {
    p50ResponseTime: number
    p95ResponseTime: number
    p99ResponseTime: number
    slowestQuery: {
      query: string
      duration: number
      timestamp: string
    } | null
    fastestQuery: {
      query: string
      duration: number
      timestamp: string
    } | null
  }
  error?: string
}

const monitoringKeys = {
  containerHealth: (projectRef: string | undefined) => 
    ['monitoring', 'supabase-rest-container', projectRef, 'health'] as const,
  containerMetrics: (projectRef: string | undefined) => 
    ['monitoring', 'supabase-rest-container', projectRef, 'metrics'] as const,
}

export async function getSupabaseRestContainerMetrics(
  { projectRef }: SupabaseRestContainerMetricsVariables,
  signal?: AbortSignal
) {
  if (!projectRef) throw new Error('projectRef is required')

  const { data, error } = await get('/v1/projects/{ref}/monitoring/rest-container/metrics' as any, {
    params: { path: { ref: projectRef } },
    signal,
  })
  
  if (error) handleError(error)
  return data as SupabaseRestContainerMetricsResponse
}

export type SupabaseRestContainerMetricsData = Awaited<ReturnType<typeof getSupabaseRestContainerMetrics>>
export type SupabaseRestContainerMetricsError = ResponseError

export const useSupabaseRestContainerMetricsQuery = <TData = SupabaseRestContainerMetricsData>(
  { projectRef }: SupabaseRestContainerMetricsVariables,
  {
    enabled = true,
    refetchInterval,
    ...options
  }: UseCustomQueryOptions<SupabaseRestContainerMetricsData, SupabaseRestContainerMetricsError, TData> & {
    refetchInterval?: number | false
  } = {}
) =>
  useQuery<SupabaseRestContainerMetricsData, SupabaseRestContainerMetricsError, TData>({
    queryKey: monitoringKeys.containerMetrics(projectRef),
    queryFn: ({ signal }) => getSupabaseRestContainerMetrics({ projectRef }, signal),
    enabled: enabled && typeof projectRef !== 'undefined',
    refetchInterval,
    staleTime: 15000, // 15 seconds
    cacheTime: 60000, // 1 minute
    retry: (failureCount, error) => {
      // Don't retry on 404 (container not found) or 403 (no permission)
      if (error?.message?.includes('404') || error?.message?.includes('403')) {
        return false
      }
      return failureCount < 3
    },
    ...options,
  })