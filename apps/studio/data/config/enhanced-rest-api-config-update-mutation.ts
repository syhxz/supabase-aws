import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { handleError, put } from 'data/fetchers'
import type { ResponseError, UseCustomMutationOptions } from 'types'
import { configKeys } from './keys'
import { EnhancedRestApiConfigResponse, getEnhancedRestApiConfig } from './enhanced-rest-api-config-query'
import { getSupabaseRestContainerClient } from 'lib/api/supabase-rest-container-client'

export type EnhancedRestApiConfigUpdateVariables = {
  projectRef: string
  
  // Core features
  enableRPCFunctions?: boolean
  enableDatabaseViews?: boolean
  enableAdvancedJSON?: boolean
  enableFullTextSearch?: boolean
  enableAggregateQueries?: boolean
  enableBulkOperations?: boolean
  enableNestedResources?: boolean
  enableTransactions?: boolean
  enableArrayOperations?: boolean
  enableContentNegotiation?: boolean
  
  // Performance settings
  queryTimeout?: number
  connectionPoolSize?: number | null
  enableQueryLogging?: boolean
  enablePerformanceMonitoring?: boolean
  enableCaching?: boolean
  
  // Advanced settings
  logLevel?: 'error' | 'warn' | 'info' | 'debug'
  enableRequestLogging?: boolean
  enableErrorLogging?: boolean
}

export interface EnhancedRestApiConfigUpdateResponse {
  success: boolean
  config: EnhancedRestApiConfigResponse
  appliedAt: string
  containerUpdateStatus: 'success' | 'failed' | 'partial'
  containerMessage?: string
}

export async function updateEnhancedRestApiConfig({
  projectRef,
  ...config
}: EnhancedRestApiConfigUpdateVariables) {
  // First, update the Studio configuration
  const { data, error } = await put('/v1/projects/{ref}/config/enhanced-rest-api', {
    params: { path: { ref: projectRef } },
    body: config,
  })

  if (error) handleError(error)
  
  const response = data as EnhancedRestApiConfigUpdateResponse
  
  // Then, update the container configuration
  try {
    const containerClient = getSupabaseRestContainerClient()
    const containerResponse = await containerClient.updateContainerConfiguration(projectRef, {
      // Map Studio config to container config format
      databaseUrl: '', // This will be populated by the container client
      schemas: [], // This will be populated from existing config
      extraSearchPath: [], // This will be populated from existing config
      maxRows: 1000, // This will be populated from existing config
      jwtSecret: '', // This will be populated by the container client
      anonRole: 'anon', // This will be populated from existing config
      
      // Enhanced features
      enableRPCFunctions: config.enableRPCFunctions ?? false,
      enableDatabaseViews: config.enableDatabaseViews ?? false,
      enableAdvancedJSON: config.enableAdvancedJSON ?? false,
      enableFullTextSearch: config.enableFullTextSearch ?? false,
      enableAggregateQueries: config.enableAggregateQueries ?? false,
      enableBulkOperations: config.enableBulkOperations ?? false,
      enableNestedResources: config.enableNestedResources ?? false,
      enableTransactions: config.enableTransactions ?? false,
      enableArrayOperations: config.enableArrayOperations ?? false,
      enableContentNegotiation: config.enableContentNegotiation ?? false,
      
      // Performance settings
      queryTimeout: config.queryTimeout ?? 30000,
      connectionPoolSize: config.connectionPoolSize ?? 0,
      enableQueryLogging: config.enableQueryLogging ?? false,
      enablePerformanceMonitoring: config.enablePerformanceMonitoring ?? true,
      enableCaching: config.enableCaching ?? false,
      
      // Connection details (will be populated by container client)
      connectionDetails: {
        host: '',
        port: 5432,
        database: '',
        username: '',
        password: '',
        ssl: true,
        maxConnections: config.connectionPoolSize ?? 0,
        idleTimeoutMs: 30000,
        connectionTimeoutMs: 10000,
        schema: 'public'
      },
      
      // Logging configuration
      logging: {
        logLevel: config.logLevel ?? 'info',
        enableRequestLogging: config.enableRequestLogging ?? false,
        enableErrorLogging: config.enableErrorLogging ?? true
      }
    })
    
    // Update response with container status
    response.containerUpdateStatus = containerResponse.success ? 'success' : 'failed'
    response.containerMessage = containerResponse.message
    
  } catch (containerError) {
    console.warn('Container update failed:', containerError)
    response.containerUpdateStatus = 'failed'
    response.containerMessage = containerError instanceof Error ? containerError.message : 'Container update failed'
  }

  return response
}

type EnhancedRestApiConfigUpdateData = Awaited<ReturnType<typeof updateEnhancedRestApiConfig>>

export const useEnhancedRestApiConfigUpdateMutation = ({
  onSuccess,
  onError,
  ...options
}: Omit<
  UseCustomMutationOptions<
    EnhancedRestApiConfigUpdateData,
    ResponseError,
    EnhancedRestApiConfigUpdateVariables
  >,
  'mutationFn'
> = {}) => {
  const queryClient = useQueryClient()

  return useMutation<
    EnhancedRestApiConfigUpdateData,
    ResponseError,
    EnhancedRestApiConfigUpdateVariables
  >({
    mutationFn: async (vars) => {
      // Store current configuration for potential rollback
      let currentConfig: EnhancedRestApiConfigResponse | null = null
      
      try {
        currentConfig = await getEnhancedRestApiConfig({ projectRef: vars.projectRef })
      } catch (error) {
        console.warn('Could not fetch current config for rollback:', error)
      }
      
      try {
        const result = await updateEnhancedRestApiConfig(vars)
        
        // Validate that the configuration was applied successfully
        if (result.containerUpdateStatus === 'failed') {
          console.warn('Container update failed but Studio config was updated:', result.containerMessage)
          toast.warning('Configuration updated with warnings', {
            description: `Studio settings saved but container update failed: ${result.containerMessage}`
          })
        }
        
        return result
      } catch (error) {
        // If update fails, attempt rollback if we have previous config
        if (currentConfig) {
          console.warn('Configuration update failed, attempting rollback:', error)
          
          try {
            await rollbackConfiguration(vars.projectRef, currentConfig)
            toast.error('Configuration update failed and was rolled back to previous settings')
          } catch (rollbackError) {
            console.error('Rollback failed:', rollbackError)
            toast.error('Configuration update failed and rollback was unsuccessful. Please check your settings manually.')
          }
        }
        
        throw error
      }
    },
    async onSuccess(data, variables, context) {
      const { projectRef } = variables
      
      // Invalidate and refetch the configuration to ensure UI is up to date
      await queryClient.invalidateQueries({ 
        queryKey: configKeys.enhancedRestApiConfig(projectRef) 
      })
      
      // Also invalidate related queries
      await queryClient.invalidateQueries({ 
        queryKey: configKeys.dataApiConfig(projectRef) 
      })
      
      // Show appropriate success message based on container update status
      if (data.containerUpdateStatus === 'success') {
        toast.success('Enhanced REST API configuration updated successfully', {
          description: 'All features have been applied to the container'
        })
      } else if (data.containerUpdateStatus === 'partial') {
        toast.warning('Configuration partially updated', {
          description: data.containerMessage || 'Some features may not be fully active'
        })
      }
      
      await onSuccess?.(data, variables, context)
    },
    async onError(data, variables, context) {
      if (onError === undefined) {
        // Default error handling
        console.error('Enhanced REST API configuration update failed:', data.message)
        toast.error('Failed to update enhanced REST API settings', {
          description: data.message
        })
      } else {
        onError(data, variables, context)
      }
    },
    ...options,
  })
}

/**
 * Rollback configuration to previous working state
 */
async function rollbackConfiguration(
  projectRef: string, 
  previousConfig: EnhancedRestApiConfigResponse
): Promise<void> {
  const rollbackData: EnhancedRestApiConfigUpdateVariables = {
    projectRef,
    enableRPCFunctions: previousConfig.enableRPCFunctions,
    enableDatabaseViews: previousConfig.enableDatabaseViews,
    enableAdvancedJSON: previousConfig.enableAdvancedJSON,
    enableFullTextSearch: previousConfig.enableFullTextSearch,
    enableAggregateQueries: previousConfig.enableAggregateQueries,
    enableBulkOperations: previousConfig.enableBulkOperations,
    enableNestedResources: previousConfig.enableNestedResources,
    enableTransactions: previousConfig.enableTransactions,
    enableArrayOperations: previousConfig.enableArrayOperations,
    enableContentNegotiation: previousConfig.enableContentNegotiation,
    queryTimeout: previousConfig.queryTimeout,
    connectionPoolSize: previousConfig.connectionPoolSize,
    enableQueryLogging: previousConfig.enableQueryLogging,
    enablePerformanceMonitoring: previousConfig.enablePerformanceMonitoring,
    enableCaching: previousConfig.enableCaching,
    logLevel: previousConfig.logLevel,
    enableRequestLogging: previousConfig.enableRequestLogging,
    enableErrorLogging: previousConfig.enableErrorLogging,
  }
  
  await updateEnhancedRestApiConfig(rollbackData)
}