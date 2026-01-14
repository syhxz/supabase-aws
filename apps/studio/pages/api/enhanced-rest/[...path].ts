import { NextApiRequest, NextApiResponse } from 'next'
import { getEnhancedRestApiService } from '../../../lib/api/enhanced-rest-api-service'
import { withSecureApiWrapper } from '../../../lib/api/secure-api-wrapper'
import { getDataApiConfig } from '../../../lib/api/data-api-config-data-access'
import { 
  withEnhancedErrorHandling, 
  createErrorHandlingMiddleware,
  RequestValidationRules,
  PerformanceLimits
} from '../../../lib/api/enhanced-error-middleware'
import { getEnhancedErrorHandler, PostgRESTErrorCode, extractRequestId } from '../../../lib/api/enhanced-error-handler'

/**
 * Enhanced REST API endpoint
 * Handles all enhanced PostgREST requests with advanced features and error handling
 * Requirements: 1.1, 2.1, 13.1, 12.1, 12.2, 12.3, 12.4, 12.5
 */
async function enhancedRestHandler(req: NextApiRequest, res: NextApiResponse) {
  const enhancedService = getEnhancedRestApiService()
  const errorHandler = getEnhancedErrorHandler()
  const requestId = extractRequestId(req)
  
  try {
    // Extract path from query parameters
    const pathArray = req.query.path as string[]
    const resourcePath = pathArray ? pathArray.join('/') : ''
    
    // Get project context from secure wrapper (will be injected by middleware)
    const context = (req as any).projectContext
    if (!context) {
      return errorHandler.handleAuthError('authentication', res, requestId, 'Project context not found')
    }
    
    // Get data API configuration
    const dataApiConfig = await getDataApiConfig(context.projectRef)
    if (!dataApiConfig.enableDataApi) {
      const errorResponse = {
        code: PostgRESTErrorCode.PGRST001,
        message: 'Data API is disabled',
        details: 'The Data API is currently disabled for this project',
        hint: 'Enable the Data API in project settings to use this endpoint',
        requestId,
        timestamp: new Date().toISOString()
      }
      
      return res.status(503).json(errorResponse)
    }
    
    // Handle the enhanced REST request
    await enhancedService.handleRequest(req, res, context, dataApiConfig, resourcePath)
    
  } catch (error) {
    console.error('Enhanced REST API error:', error)
    
    if (!res.headersSent) {
      errorHandler.handleGenericError(error, res, requestId, 'Enhanced REST API Handler')
    }
  }
}

/**
 * Export the handler wrapped with security middleware and enhanced error handling
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
 */
const validationRules: RequestValidationRules = {
  allowedMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
  expectedContentType: 'application/json',
  queryValidation: {
    allowedParams: [
      // Standard PostgREST parameters
      'select', 'order', 'limit', 'offset', 'range',
      // Filtering parameters (dynamic, so we allow all)
      // Advanced parameters
      'prefer', 'accept', 'content-type',
      // Custom parameters for enhanced features
      'transaction', 'bulk', 'format'
    ]
  }
}

const performanceLimits: PerformanceLimits = {
  timeoutMs: 30000, // 30 seconds
  maxExecutionTimeMs: 25000, // 25 seconds (leave buffer for cleanup)
  maxMemoryUsageMB: 256, // 256MB
  maxResponseSizeMB: 50 // 50MB
}

export default withSecureApiWrapper(
  withEnhancedErrorHandling(enhancedRestHandler),
  {
    requireProjectContext: true,
    requireDataApiAccess: true,
    errorHandling: {
      validation: validationRules,
      performance: performanceLimits,
      contentTypes: ['application/json', 'text/csv', 'application/vnd.pgrst.object+json']
    }
  }
)

/**
 * API route configuration
 */
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', // Support larger payloads for bulk operations
    },
    responseLimit: false, // Allow large responses
  },
}