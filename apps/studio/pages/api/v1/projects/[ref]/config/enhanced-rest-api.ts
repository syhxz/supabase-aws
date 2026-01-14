import { NextApiRequest, NextApiResponse } from 'next'
import { withSecureProjectAccess, ProjectIsolationContext } from 'lib/api/secure-api-wrapper'
import { getEnhancedPostgRESTConfigManager } from 'lib/api/enhanced-postgrest-config-manager'
import { getSupabaseRestContainerClient } from 'lib/api/supabase-rest-container-client'
import { EnhancedRestApiConfigResponse } from 'data/config/enhanced-rest-api-config-query'
import { EnhancedRestApiConfigUpdateVariables } from 'data/config/enhanced-rest-api-config-update-mutation'

/**
 * Enhanced REST API Configuration Endpoint
 * Handles configuration for advanced PostgREST features
 * Requirements: All requirements integration
 */

async function handler(req: NextApiRequest, res: NextApiResponse, context: ProjectIsolationContext) {
  const { ref: projectRef } = req.query as { ref: string }

  if (!projectRef) {
    return res.status(400).json({
      error: 'Missing project reference',
      message: 'Project reference is required'
    })
  }

  try {
    const configManager = getEnhancedPostgRESTConfigManager()

    if (req.method === 'GET') {
      // Get current enhanced REST API configuration
      const config = await configManager.getEnhancedProjectConfig(context, req)
      
      // Get container health status
      const containerClient = getSupabaseRestContainerClient()
      const healthStatus = await containerClient.getContainerHealth(projectRef)

      const response: EnhancedRestApiConfigResponse = {
        projectRef,
        
        // Core features
        enableRPCFunctions: config.enableRPCFunctions,
        enableDatabaseViews: config.enableDatabaseViews,
        enableAdvancedJSON: config.enableAdvancedJSON,
        enableFullTextSearch: config.enableFullTextSearch,
        enableAggregateQueries: config.enableAggregateQueries,
        enableBulkOperations: config.enableBulkOperations,
        enableNestedResources: config.enableNestedResources,
        enableTransactions: config.enableTransactions,
        enableArrayOperations: config.enableArrayOperations,
        enableContentNegotiation: config.enableContentNegotiation,
        
        // Performance settings
        queryTimeout: config.queryTimeout,
        connectionPoolSize: config.connectionPoolSize,
        enableQueryLogging: config.enableQueryLogging,
        enablePerformanceMonitoring: config.enablePerformanceMonitoring,
        enableCaching: config.enableCaching,
        
        // Advanced settings
        logLevel: config.logLevel,
        enableRequestLogging: config.enableRequestLogging,
        enableErrorLogging: config.enableErrorLogging,
        
        // Metadata
        lastUpdated: new Date().toISOString(),
        containerStatus: healthStatus.healthy ? 'healthy' : 'unhealthy',
        version: '1.0.0'
      }

      return res.status(200).json(response)

    } else if (req.method === 'PUT') {
      // Update enhanced REST API configuration
      const updateData = req.body as Partial<EnhancedRestApiConfigUpdateVariables>
      
      // Validate the update data
      const validatedData = validateEnhancedConfigUpdate(updateData)
      if (!validatedData.valid) {
        return res.status(400).json({
          error: 'Invalid configuration data',
          message: validatedData.message,
          details: validatedData.errors
        })
      }

      // Get current configuration for comparison
      const currentConfig = await configManager.getEnhancedProjectConfig(context, req)
      
      // Merge with current configuration
      const updatedConfig = {
        ...currentConfig,
        ...updateData,
        // Ensure projectRef is not overwritten
        projectRef: currentConfig.projectRef
      }

      // Update the configuration
      await configManager.updateEnhancedProjectConfig(context, req, updatedConfig)

      // Update container configuration
      const containerClient = getSupabaseRestContainerClient()
      const containerUpdateResult = await containerClient.updateContainerConfiguration(
        projectRef,
        updatedConfig
      )

      // Get updated configuration for response
      const finalConfig = await configManager.getEnhancedProjectConfig(context, req)
      
      const response = {
        success: true,
        config: {
          projectRef,
          ...finalConfig,
          lastUpdated: new Date().toISOString(),
          containerStatus: containerUpdateResult.success ? 'healthy' : 'unhealthy',
          version: '1.0.0'
        } as EnhancedRestApiConfigResponse,
        appliedAt: new Date().toISOString(),
        containerUpdateStatus: containerUpdateResult.success ? 'success' : 'failed',
        containerMessage: containerUpdateResult.message
      }

      return res.status(200).json(response)

    } else {
      res.setHeader('Allow', ['GET', 'PUT'])
      return res.status(405).json({
        error: 'Method not allowed',
        message: `Method ${req.method} is not allowed for this endpoint`
      })
    }

  } catch (error) {
    console.error(`Enhanced REST API config ${req.method} error for project ${projectRef}:`, error)
    
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
      code: 'ENHANCED_REST_API_CONFIG_ERROR'
    })
  }
}

/**
 * Validate enhanced configuration update data
 */
function validateEnhancedConfigUpdate(data: Partial<EnhancedRestApiConfigUpdateVariables>) {
  const errors: string[] = []

  // Validate query timeout
  if (data.queryTimeout !== undefined) {
    if (typeof data.queryTimeout !== 'number' || data.queryTimeout < 1000 || data.queryTimeout > 300000) {
      errors.push('queryTimeout must be a number between 1000 and 300000 (1s to 5min)')
    }
  }

  // Validate connection pool size
  if (data.connectionPoolSize !== undefined && data.connectionPoolSize !== null) {
    if (typeof data.connectionPoolSize !== 'number' || data.connectionPoolSize < 1 || data.connectionPoolSize > 1000) {
      errors.push('connectionPoolSize must be a number between 1 and 1000, or null for auto-sizing')
    }
  }

  // Validate log level
  if (data.logLevel !== undefined) {
    const validLogLevels = ['error', 'warn', 'info', 'debug']
    if (!validLogLevels.includes(data.logLevel)) {
      errors.push(`logLevel must be one of: ${validLogLevels.join(', ')}`)
    }
  }

  // Validate boolean fields
  const booleanFields = [
    'enableRPCFunctions',
    'enableDatabaseViews',
    'enableAdvancedJSON',
    'enableFullTextSearch',
    'enableAggregateQueries',
    'enableBulkOperations',
    'enableNestedResources',
    'enableTransactions',
    'enableArrayOperations',
    'enableContentNegotiation',
    'enableQueryLogging',
    'enablePerformanceMonitoring',
    'enableCaching',
    'enableRequestLogging',
    'enableErrorLogging'
  ]

  for (const field of booleanFields) {
    const value = (data as any)[field]
    if (value !== undefined && typeof value !== 'boolean') {
      errors.push(`${field} must be a boolean value`)
    }
  }

  return {
    valid: errors.length === 0,
    message: errors.length > 0 ? 'Validation failed' : 'Validation passed',
    errors
  }
}

export default withSecureProjectAccess(handler, {
  permissions: { read: true, write: true }
})