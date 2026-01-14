import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { handleError, put, get } from 'data/fetchers'
import type { ResponseError, UseCustomMutationOptions } from 'types'
import { configKeys } from './keys'
import { DataApiConfigResponse, getDataApiConfig } from './data-api-config-query'

export type DataApiConfigUpdateVariables = {
  projectRef: string
  enableDataApi?: boolean
  exposedSchemas?: string[]
  extraSearchPath?: string[]
  maxRows?: number
  poolSize?: number | null
}

export interface DataApiConfigUpdateResponse {
  success: boolean
  config: DataApiConfigResponse
  appliedAt: string
}

export async function updateDataApiConfig({
  projectRef,
  ...config
}: DataApiConfigUpdateVariables) {
  const { data, error } = await put('/v1/projects/{ref}/config/data-api', {
    params: { path: { ref: projectRef } },
    body: config,
  })

  if (error) handleError(error)
  return data as DataApiConfigUpdateResponse
}

type DataApiConfigUpdateData = Awaited<ReturnType<typeof updateDataApiConfig>>

export const useDataApiConfigUpdateMutation = ({
  onSuccess,
  onError,
  ...options
}: Omit<
  UseCustomMutationOptions<
    DataApiConfigUpdateData,
    ResponseError,
    DataApiConfigUpdateVariables
  >,
  'mutationFn'
> = {}) => {
  const queryClient = useQueryClient()

  return useMutation<
    DataApiConfigUpdateData,
    ResponseError,
    DataApiConfigUpdateVariables
  >({
    mutationFn: async (vars) => {
      // Store current configuration for potential rollback
      const currentConfig = await getDataApiConfig({ projectRef: vars.projectRef })
      
      try {
        const result = await updateDataApiConfig(vars)
        
        // Validate that the API is still healthy after the update
        await validateApiHealth(vars.projectRef)
        
        return result
      } catch (error) {
        // If update fails or API becomes unhealthy, attempt rollback
        console.warn('Configuration update failed, attempting rollback:', error)
        
        try {
          await rollbackConfiguration(vars.projectRef, currentConfig)
          toast.error('Configuration update failed and was rolled back to previous settings')
        } catch (rollbackError) {
          console.error('Rollback failed:', rollbackError)
          toast.error('Configuration update failed and rollback was unsuccessful. Please check your settings manually.')
        }
        
        throw error
      }
    },
    async onSuccess(data, variables, context) {
      const { projectRef } = variables
      
      // Invalidate and refetch the configuration to ensure UI is up to date
      await queryClient.invalidateQueries({ queryKey: configKeys.dataApiConfig(projectRef) })
      
      // Show success feedback
      toast.success('Data API configuration updated successfully')
      
      await onSuccess?.(data, variables, context)
    },
    async onError(data, variables, context) {
      if (onError === undefined) {
        // Error handling is already done in mutationFn, so we don't need to show another toast
        console.error('Data API configuration update failed:', data.message)
      } else {
        onError(data, variables, context)
      }
    },
    ...options,
  })
}

/**
 * Validate that the Data API is healthy after configuration changes
 */
async function validateApiHealth(projectRef: string): Promise<void> {
  try {
    // Make a simple health check request to the Data API
    const { data, error } = await get('/v1/projects/{ref}/config/data-api', {
      params: { path: { ref: projectRef } },
    })
    
    if (error) {
      throw new Error(`API health check failed: ${error.message}`)
    }
    
    // Additional validation could be added here, such as:
    // - Testing a simple query to ensure the API is responding correctly
    // - Validating that exposed schemas are accessible
    // - Checking that connection pool is functioning
    
  } catch (error) {
    throw new Error(`Data API health validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Rollback configuration to previous working state
 */
async function rollbackConfiguration(
  projectRef: string, 
  previousConfig: DataApiConfigResponse
): Promise<void> {
  const rollbackData: DataApiConfigUpdateVariables = {
    projectRef,
    enableDataApi: previousConfig.enableDataApi,
    exposedSchemas: previousConfig.exposedSchemas,
    extraSearchPath: previousConfig.extraSearchPath,
    maxRows: previousConfig.maxRows,
    poolSize: previousConfig.poolSize,
  }
  
  await updateDataApiConfig(rollbackData)
}