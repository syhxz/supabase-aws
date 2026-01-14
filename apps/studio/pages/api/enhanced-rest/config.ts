import { NextApiRequest, NextApiResponse } from 'next'
import { getEnhancedRestApiService } from '../../../lib/api/enhanced-rest-api-service'
import { getEnhancedPostgRESTConfigManager } from '../../../lib/api/enhanced-postgrest-config-manager'
import { withSecureApiWrapper } from '../../../lib/api/secure-api-wrapper'

/**
 * Enhanced REST API configuration endpoint
 * Manages enhanced PostgREST configuration
 * Requirements: 1.1, 2.1
 */
async function configHandler(req: NextApiRequest, res: NextApiResponse) {
  const { method, query } = req
  
  try {
    const enhancedService = getEnhancedRestApiService()
    const configManager = getEnhancedPostgRESTConfigManager()
    
    // Get project context from secure wrapper
    const context = (req as any).projectContext
    if (!context) {
      return res.status(400).json({
        error: 'Project context not found',
        hint: 'Ensure the request includes valid project identification'
      })
    }
    
    const projectRef = context.projectRef
    
    switch (method) {
      case 'GET':
        // Get current configuration
        const configs = configManager.getAllEnhancedProjectConfigs()
        const config = configs.get(projectRef)
        
        if (!config) {
          return res.status(404).json({
            error: 'Configuration not found',
            hint: 'Project configuration has not been initialized'
          })
        }
        
        // Return sanitized configuration (without sensitive data)
        const sanitizedConfig = {
          projectRef: config.projectRef,
          schemas: config.schemas,
          extraSearchPath: config.extraSearchPath,
          maxRows: config.maxRows,
          poolSize: config.poolSize,
          enableDataApi: config.enableDataApi,
          
          // Enhanced features
          features: {
            enableRPCFunctions: config.enableRPCFunctions,
            enableDatabaseViews: config.enableDatabaseViews,
            enableAdvancedJSON: config.enableAdvancedJSON,
            enableFullTextSearch: config.enableFullTextSearch,
            enableAggregateQueries: config.enableAggregateQueries,
            enableBulkOperations: config.enableBulkOperations,
            enableNestedResources: config.enableNestedResources,
            enableTransactions: config.enableTransactions,
            enableArrayOperations: config.enableArrayOperations,
            enableContentNegotiation: config.enableContentNegotiation
          },
          
          // Performance configuration
          performance: {
            queryTimeout: config.queryTimeout,
            connectionPoolSize: config.connectionPoolSize,
            enableQueryLogging: config.enableQueryLogging,
            enablePerformanceMonitoring: config.enablePerformanceMonitoring,
            enableCaching: config.enableCaching
          },
          
          // Health monitoring
          health: {
            healthCheckInterval: config.healthCheckInterval,
            healthCheckTimeout: config.healthCheckTimeout,
            lastHealthCheck: config.lastHealthCheck,
            healthStatus: config.healthStatus
          },
          
          // Logging configuration
          logging: {
            logLevel: config.logLevel,
            enableRequestLogging: config.enableRequestLogging,
            enableErrorLogging: config.enableErrorLogging
          },
          
          lastUpdated: config.lastUpdated
        }
        
        return res.status(200).json(sanitizedConfig)
      
      case 'PATCH':
        // Update configuration
        const updates = req.body
        
        if (!updates || typeof updates !== 'object') {
          return res.status(400).json({
            error: 'Invalid request body',
            hint: 'Provide configuration updates as a JSON object'
          })
        }
        
        // Validate updates
        const validUpdates = validateConfigurationUpdates(updates)
        if (validUpdates.errors.length > 0) {
          return res.status(400).json({
            error: 'Invalid configuration updates',
            details: validUpdates.errors
          })
        }
        
        // Apply updates
        const updateResult = await enhancedService.updateProjectConfiguration(
          projectRef,
          validUpdates.updates
        )
        
        if (!updateResult.success) {
          return res.status(500).json({
            error: 'Configuration update failed',
            details: updateResult.message
          })
        }
        
        return res.status(200).json({
          message: 'Configuration updated successfully',
          updates: validUpdates.updates
        })
      
      case 'POST':
        // Reset configuration to defaults
        if (query.action === 'reset') {
          const defaultUpdates = {
            enableRPCFunctions: true,
            enableDatabaseViews: true,
            enableAdvancedJSON: true,
            enableFullTextSearch: true,
            enableAggregateQueries: true,
            enableBulkOperations: true,
            enableNestedResources: true,
            enableTransactions: true,
            enableArrayOperations: true,
            enableContentNegotiation: true,
            queryTimeout: 30000,
            connectionPoolSize: 10,
            enableQueryLogging: true,
            enablePerformanceMonitoring: true,
            enableCaching: false
          }
          
          const resetResult = await enhancedService.updateProjectConfiguration(
            projectRef,
            defaultUpdates
          )
          
          if (!resetResult.success) {
            return res.status(500).json({
              error: 'Configuration reset failed',
              details: resetResult.message
            })
          }
          
          return res.status(200).json({
            message: 'Configuration reset to defaults',
            defaults: defaultUpdates
          })
        }
        
        return res.status(400).json({
          error: 'Invalid action',
          hint: 'Use action=reset to reset configuration to defaults'
        })
      
      default:
        res.setHeader('Allow', ['GET', 'PATCH', 'POST'])
        return res.status(405).json({
          error: 'Method not allowed',
          hint: 'Use GET to retrieve configuration, PATCH to update, or POST to reset'
        })
    }
    
  } catch (error) {
    console.error('Configuration endpoint error:', error)
    
    res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

/**
 * Validate configuration updates
 * Requirements: 1.1, 2.1
 */
function validateConfigurationUpdates(updates: any): {
  updates: Record<string, any>
  errors: string[]
} {
  const validUpdates: Record<string, any> = {}
  const errors: string[] = []
  
  // Validate boolean feature flags
  const booleanFeatures = [
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
    'enableCaching'
  ]
  
  for (const feature of booleanFeatures) {
    if (updates[feature] !== undefined) {
      if (typeof updates[feature] === 'boolean') {
        validUpdates[feature] = updates[feature]
      } else {
        errors.push(`${feature} must be a boolean value`)
      }
    }
  }
  
  // Validate numeric values
  if (updates.queryTimeout !== undefined) {
    const timeout = parseInt(updates.queryTimeout, 10)
    if (isNaN(timeout) || timeout < 1000 || timeout > 300000) {
      errors.push('queryTimeout must be a number between 1000 and 300000 (1-300 seconds)')
    } else {
      validUpdates.queryTimeout = timeout
    }
  }
  
  if (updates.connectionPoolSize !== undefined) {
    const poolSize = parseInt(updates.connectionPoolSize, 10)
    if (isNaN(poolSize) || poolSize < 1 || poolSize > 100) {
      errors.push('connectionPoolSize must be a number between 1 and 100')
    } else {
      validUpdates.connectionPoolSize = poolSize
    }
  }
  
  return { updates: validUpdates, errors }
}

/**
 * Export the handler wrapped with security middleware
 */
export default withSecureApiWrapper(configHandler, {
  requireProjectContext: true,
  requireDataApiAccess: true
})