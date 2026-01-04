import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { IS_PLATFORM } from 'lib/constants'
import type { ResponseError, UseCustomMutationOptions } from 'types'
import { databaseKeys } from './keys'
import { PoolingCacheInvalidation } from './pooling-cache-invalidation'
import { 
  updatePgbouncerConfiguration, 
  type PgbouncerConfigurationUpdateVariables 
} from './pgbouncer-config-update-mutation'
import { 
  updateSupavisorConfig, 
  type SupavisorConfigUpdateVariables 
} from './supavisor-config-update-mutation'
import { detectPoolingService, type UnifiedPoolingConfig } from './pooling-configuration-query'
import { PoolingErrorHandler } from './pooling-error-handler'

export interface UnifiedPoolingConfigurationUpdate {
  projectRef: string
  poolSize?: number
  maxClientConnections?: number
  poolMode?: 'session' | 'transaction' | 'statement'
}

/**
 * Transforms unified update to PgBouncer format
 */
function transformToPgbouncerUpdate(
  update: UnifiedPoolingConfigurationUpdate
): PgbouncerConfigurationUpdateVariables {
  return {
    ref: update.projectRef,
    default_pool_size: update.poolSize,
    max_client_conn: update.maxClientConnections,
    // PgBouncer doesn't support pool mode changes via API
  }
}

/**
 * Transforms unified update to Supavisor format
 */
function transformToSupavisorUpdate(
  update: UnifiedPoolingConfigurationUpdate
): SupavisorConfigUpdateVariables {
  return {
    ref: update.projectRef,
    poolSize: update.poolSize,
    maxClientConnections: update.maxClientConnections,
    poolMode: update.poolMode,
  }
}

/**
 * Unified function to update pooling configuration for appropriate service
 */
export async function updatePoolingConfiguration(
  variables: UnifiedPoolingConfigurationUpdate
): Promise<UnifiedPoolingConfig> {
  const detection = await detectPoolingService(variables.projectRef)
  const poolingService = detection.service

  if (poolingService === 'pgbouncer') {
    const pgbouncerUpdate = transformToPgbouncerUpdate(variables)
    const result = await updatePgbouncerConfiguration(pgbouncerUpdate)
    
    // Transform result back to unified format
    return {
      poolingService: 'pgbouncer',
      poolSize: result?.default_pool_size || variables.poolSize || 25,
      maxClientConnections: result?.max_client_conn || variables.maxClientConnections || 200,
      poolMode: 'transaction',
      isEnabled: true,
      status: 'running',
      environment: 'platform'
    }
  } else {
    const supavisorUpdate = transformToSupavisorUpdate(variables)
    const result = await updateSupavisorConfig(supavisorUpdate)
    
    // Transform result back to unified format
    return {
      poolingService: 'supavisor',
      poolSize: result.poolSize || 25,
      maxClientConnections: result.maxClientConnections || 200,
      poolMode: result.poolMode || 'transaction',
      isEnabled: result.isEnabled || false,
      status: result.status || 'unknown',
      environment: 'self-hosted'
    }
  }
}

export type PoolingConfigurationUpdateData = UnifiedPoolingConfig
export type PoolingConfigurationUpdateError = ResponseError

/**
 * Unified mutation hook for updating pooling configuration
 * Automatically detects environment and uses appropriate service
 */
export const usePoolingConfigurationUpdateMutation = ({
  onSuccess,
  onError,
  ...options
}: Omit<
  UseCustomMutationOptions<
    PoolingConfigurationUpdateData,
    PoolingConfigurationUpdateError,
    UnifiedPoolingConfigurationUpdate
  >,
  'mutationFn'
> = {}) => {
  const queryClient = useQueryClient()

  return useMutation<
    PoolingConfigurationUpdateData,
    PoolingConfigurationUpdateError,
    UnifiedPoolingConfigurationUpdate
  >({
    mutationFn: (vars) => updatePoolingConfiguration(vars),
    async onSuccess(data, variables, context) {
      const { projectRef } = variables
      
      // Use centralized cache invalidation for configuration updates
      await PoolingCacheInvalidation.invalidateConfiguration(queryClient, projectRef)

      // Show success feedback
      const detection = await detectPoolingService(projectRef)
      const serviceName = detection.service === 'pgbouncer' ? 'PgBouncer' : 'Supavisor'
      
      PoolingErrorHandler.showUpdateSuccess(serviceName, {
        poolSize: data.poolSize,
        maxClientConnections: data.maxClientConnections,
        poolMode: data.poolMode
      })

      await onSuccess?.(data, variables, context)
    },
    async onError(data, variables, context) {
      if (onError === undefined) {
        const detection = await detectPoolingService(variables.projectRef)
        const environment = IS_PLATFORM ? 'platform' : 'self-hosted'
        
        PoolingErrorHandler.handleMutationError(data, {
          operation: 'configuration update',
          projectRef: variables.projectRef,
          environment,
          poolingService: detection.service,
          updates: {
            poolSize: variables.poolSize,
            maxClientConnections: variables.maxClientConnections,
            poolMode: variables.poolMode
          }
        })
      } else {
        onError(data, variables, context)
      }
    },
    ...options,
  })
}