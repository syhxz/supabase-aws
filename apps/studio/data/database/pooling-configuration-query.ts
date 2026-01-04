import { useQuery } from '@tanstack/react-query'

import { IS_PLATFORM } from 'lib/constants'
import type { ResponseError, UseCustomQueryOptions } from 'types'
import { databaseKeys } from './keys'

import { 
  getPgbouncerConfig, 
  type PgbouncerConfigData, 
  type PgbouncerConfigError 
} from './pgbouncer-config-query'
import { 
  getSupavisorConfig, 
  type SupavisorConfigData, 
  type SupavisorConfigError 
} from './supavisor-config-query'
import { PoolingErrorHandler } from './pooling-error-handler'
import { 
  PoolingServiceDetector, 
  PoolingServiceAdapter,
  type PoolingService,
  type Environment
} from 'lib/api/self-hosted/pooling-service-detector'

export type { PoolingService }

export interface UnifiedPoolingConfig {
  poolingService: PoolingService
  poolSize: number
  maxClientConnections: number
  poolMode?: 'session' | 'transaction' | 'statement'
  isEnabled: boolean
  status?: 'running' | 'stopped' | 'error' | 'unknown'
  environment: Environment
  capabilities?: {
    configurationUpdate: boolean
    statisticsMonitoring: boolean
    healthChecks: boolean
    containerManagement: boolean
  }
  fallbackService?: PoolingService
  detectionReason?: string
}

export type PoolingConfigurationVariables = {
  projectRef?: string
}

/**
 * Detects the appropriate pooling service based on environment and availability
 */
export async function detectPoolingService(projectRef: string): Promise<{
  service: PoolingService
  environment: Environment
  capabilities: any
  reason: string
}> {
  try {
    const detection = await PoolingServiceDetector.detectServices(projectRef)
    const recommendation = PoolingServiceDetector.getRecommendedConfiguration(detection)
    
    return {
      service: recommendation.service,
      environment: detection.environment,
      capabilities: recommendation.capabilities,
      reason: recommendation.reason
    }
  } catch (error) {
    // Fallback to simple environment-based detection
    return {
      service: IS_PLATFORM ? 'pgbouncer' : 'supavisor',
      environment: IS_PLATFORM ? 'platform' : 'self-hosted',
      capabilities: {
        configurationUpdate: true,
        statisticsMonitoring: true,
        healthChecks: true,
        containerManagement: !IS_PLATFORM
      },
      reason: 'Fallback to environment-based detection'
    }
  }
}

/**
 * Transforms PgBouncer configuration to unified format
 */
function transformPgbouncerConfig(
  data: PgbouncerConfigData,
  capabilities?: any,
  fallbackService?: PoolingService,
  detectionReason?: string
): UnifiedPoolingConfig {
  return {
    poolingService: 'pgbouncer',
    poolSize: data.default_pool_size || 25,
    maxClientConnections: data.max_client_conn || 200,
    poolMode: 'transaction',
    isEnabled: true,
    status: 'running',
    environment: 'platform',
    capabilities,
    fallbackService,
    detectionReason
  }
}

/**
 * Transforms Supavisor configuration to unified format
 */
function transformSupavisorConfig(
  data: SupavisorConfigData, 
  capabilities?: any,
  fallbackService?: PoolingService,
  detectionReason?: string
): UnifiedPoolingConfig {
  return {
    poolingService: 'supavisor',
    poolSize: data.poolSize || 25,
    maxClientConnections: data.maxClientConnections || 200,
    poolMode: data.poolMode || 'transaction',
    isEnabled: data.isEnabled || false,
    status: data.status || 'unknown',
    environment: 'self-hosted',
    capabilities,
    fallbackService,
    detectionReason
  }
}

/**
 * Unified function to get pooling configuration from appropriate service with automatic detection
 */
export async function getPoolingConfiguration(
  { projectRef }: PoolingConfigurationVariables,
  signal?: AbortSignal
): Promise<UnifiedPoolingConfig> {
  if (!projectRef) throw new Error('projectRef is required')

  // Detect available services and get recommendation
  const detection = await detectPoolingService(projectRef)
  const { service: recommendedService, capabilities, reason } = detection

  let primaryError: Error | null = null
  let fallbackService: PoolingService | undefined

  try {
    if (recommendedService === 'pgbouncer') {
      const pgbouncerData = await getPgbouncerConfig({ projectRef }, signal)
      return transformPgbouncerConfig(pgbouncerData, capabilities.features, undefined, reason)
    } else {
      const supavisorData = await getSupavisorConfig({ projectRef }, signal)
      return transformSupavisorConfig(supavisorData, capabilities.features, undefined, reason)
    }
  } catch (error) {
    primaryError = error instanceof Error ? error : new Error('Unknown error')
    
    // Attempt fallback to the other service
    const fallbackServiceType: PoolingService = recommendedService === 'pgbouncer' ? 'supavisor' : 'pgbouncer'
    fallbackService = fallbackServiceType

    try {
      if (fallbackServiceType === 'pgbouncer') {
        const pgbouncerData = await getPgbouncerConfig({ projectRef }, signal)
        return transformPgbouncerConfig(
          pgbouncerData, 
          capabilities.features, 
          fallbackService,
          `Fallback to PgBouncer: ${reason}`
        )
      } else {
        const supavisorData = await getSupavisorConfig({ projectRef }, signal)
        return transformSupavisorConfig(
          supavisorData, 
          capabilities.features, 
          fallbackService,
          `Fallback to Supavisor: ${reason}`
        )
      }
    } catch (fallbackError) {
      // Both services failed, return error configuration
      return {
        poolingService: recommendedService,
        poolSize: 25,
        maxClientConnections: 200,
        poolMode: 'transaction',
        isEnabled: false,
        status: 'error',
        environment: detection.environment,
        capabilities: capabilities.features,
        fallbackService,
        detectionReason: `Both services failed: ${primaryError.message}`
      }
    }
  }
}

export type PoolingConfigurationData = UnifiedPoolingConfig
export type PoolingConfigurationError = PgbouncerConfigError | SupavisorConfigError | ResponseError

/**
 * Unified hook for pooling configuration that automatically detects environment
 * and uses the appropriate pooling service (PgBouncer for platform, Supavisor for self-hosted)
 */
export const usePoolingConfigurationQuery = <TData = PoolingConfigurationData>(
  { projectRef }: PoolingConfigurationVariables,
  {
    enabled = true,
    ...options
  }: UseCustomQueryOptions<PoolingConfigurationData, PoolingConfigurationError, TData> = {}
) =>
  useQuery<PoolingConfigurationData, PoolingConfigurationError, TData>({
    queryKey: databaseKeys.poolingConfiguration(projectRef),
    queryFn: ({ signal }) => getPoolingConfiguration({ projectRef }, signal),
    enabled: enabled && typeof projectRef !== 'undefined',
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    cacheTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    retry: (failureCount, error) => {
      // Don't retry if it's a configuration error
      if (error && typeof error === 'object' && 'status' in error) {
        const status = (error as any).status
        if (status === 404 || status === 403 || status === 422) return false
      }
      return failureCount < 2
    },
    onError: (error) => {
      const poolingService = IS_PLATFORM ? 'pgbouncer' : 'supavisor'
      const environment = IS_PLATFORM ? 'platform' : 'self-hosted'
      
      PoolingErrorHandler.handleQueryError(error, {
        operation: 'configuration fetch',
        projectRef,
        environment,
        poolingService
      })
    },
    ...options,
  })