import { useQuery } from '@tanstack/react-query'
import { get, handleError } from 'data/fetchers'
import type { ResponseError, UseCustomQueryOptions } from 'types'
import { configKeys } from './keys'

export type EnhancedRestApiConfigVariables = {
  projectRef?: string
}

export interface EnhancedRestApiConfigResponse {
  projectRef: string
  
  // Core features
  enableRPCFunctions: boolean
  enableDatabaseViews: boolean
  enableAdvancedJSON: boolean
  enableFullTextSearch: boolean
  enableAggregateQueries: boolean
  enableBulkOperations: boolean
  enableNestedResources: boolean
  enableTransactions: boolean
  enableArrayOperations: boolean
  enableContentNegotiation: boolean
  
  // Performance settings
  queryTimeout: number
  connectionPoolSize: number | null
  enableQueryLogging: boolean
  enablePerformanceMonitoring: boolean
  enableCaching: boolean
  
  // Advanced settings
  logLevel: 'error' | 'warn' | 'info' | 'debug'
  enableRequestLogging: boolean
  enableErrorLogging: boolean
  
  // Metadata
  lastUpdated: string
  containerStatus: 'healthy' | 'unhealthy' | 'unknown'
  version: string
}

export async function getEnhancedRestApiConfig(
  { projectRef }: EnhancedRestApiConfigVariables,
  signal?: AbortSignal
) {
  if (!projectRef) throw new Error('projectRef is required')

  const { data, error } = await get('/v1/projects/{ref}/config/enhanced-rest-api', {
    params: { path: { ref: projectRef } },
    signal,
  })
  
  if (error) handleError(error)
  return data as EnhancedRestApiConfigResponse
}

export type EnhancedRestApiConfigData = Awaited<ReturnType<typeof getEnhancedRestApiConfig>>
export type EnhancedRestApiConfigError = ResponseError

export const useEnhancedRestApiConfigQuery = <TData = EnhancedRestApiConfigData>(
  { projectRef }: EnhancedRestApiConfigVariables,
  {
    enabled = true,
    ...options
  }: UseCustomQueryOptions<EnhancedRestApiConfigData, EnhancedRestApiConfigError, TData> = {}
) =>
  useQuery<EnhancedRestApiConfigData, EnhancedRestApiConfigError, TData>({
    queryKey: configKeys.enhancedRestApiConfig(projectRef),
    queryFn: ({ signal }) => getEnhancedRestApiConfig({ projectRef }, signal),
    enabled: enabled && typeof projectRef !== 'undefined',
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    ...options,
  })