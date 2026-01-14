import { useQuery } from '@tanstack/react-query'
import { get, handleError } from 'data/fetchers'
import type { ResponseError, UseCustomQueryOptions } from 'types'

export type SupabaseRestContainerHealthVariables = {
  projectRef?: string
}

export interface SupabaseRestContainerHealthResponse {
  projectRef: string
  healthy: boolean
  status: 'healthy' | 'unhealthy' | 'degraded' | 'unknown'
  responseTime: number
  timestamp: string
  details: {
    database: {
      connected: boolean
      responseTime: number
    }
    features: {
      rpcFunctions: boolean
      databaseViews: boolean
      advancedJSON: boolean
      fullTextSearch: boolean
      aggregateQueries: boolean
      bulkOperations: boolean
      nestedResources: boolean
      transactions: boolean
      arrayOperations: boolean
      contentNegotiation: boolean
    }
    performance: {
      memoryUsage: number
      cpuUsage: number
      activeConnections: number
    }
  }
  error?: string
}

const monitoringKeys = {
  containerHealth: (projectRef: string | undefined) => 
    ['monitoring', 'supabase-rest-container', projectRef, 'health'] as const,
  containerMetrics: (projectRef: string | undefined) => 
    ['monitoring', 'supabase-rest-container', projectRef, 'metrics'] as const,
}

export async function getSupabaseRestContainerHealth(
  { projectRef }: SupabaseRestContainerHealthVariables,
  signal?: AbortSignal
) {
  if (!projectRef) throw new Error('projectRef is required')

  const { data, error } = await get('/v1/projects/{ref}/monitoring/rest-container/health', {
    params: { path: { ref: projectRef } },
    signal,
  })
  
  if (error) handleError(error)
  return data as SupabaseRestContainerHealthResponse
}

export type SupabaseRestContainerHealthData = Awaited<ReturnType<typeof getSupabaseRestContainerHealth>>
export type SupabaseRestContainerHealthError = ResponseError

export const useSupabaseRestContainerHealthQuery = <TData = SupabaseRestContainerHealthData>(
  { projectRef }: SupabaseRestContainerHealthVariables,
  {
    enabled = true,
    refetchInterval,
    ...options
  }: UseCustomQueryOptions<SupabaseRestContainerHealthData, SupabaseRestContainerHealthError, TData> & {
    refetchInterval?: number | false
  } = {}
) =>
  useQuery<SupabaseRestContainerHealthData, SupabaseRestContainerHealthError, TData>({
    queryKey: monitoringKeys.containerHealth(projectRef),
    queryFn: ({ signal }) => getSupabaseRestContainerHealth({ projectRef }, signal),
    enabled: enabled && typeof projectRef !== 'undefined',
    refetchInterval,
    staleTime: 10000, // 10 seconds
    cacheTime: 30000, // 30 seconds
    retry: (failureCount, error) => {
      // Don't retry on 404 (container not found) or 403 (no permission)
      if (error?.message?.includes('404') || error?.message?.includes('403')) {
        return false
      }
      return failureCount < 3
    },
    ...options,
  })