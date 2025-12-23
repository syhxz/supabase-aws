import { NextApiRequest, NextApiResponse } from 'next'
import { withProjectIsolation } from '../../../../../lib/api/project-isolation-middleware'
import { getEnhancedMonitoringDataService } from '../../../../../lib/api/enhanced-data-services'
import { 
  ProjectManagementError, 
  ErrorFactory, 
  handleApiError, 
  createErrorContext 
} from '../../../../../lib/api/error-handling'

/**
 * API endpoint for monitoring data with project isolation
 * 
 * GET /api/platform/projects/[ref]/monitoring - Get monitoring data for project
 * POST /api/platform/projects/[ref]/monitoring - Create new monitoring data
 * 
 * Requirements: 2.1, 2.2
 */
export default withProjectIsolation(async (req, res, context) => {
  const { projectId, projectRef, userId } = context
  const errorContext = createErrorContext('monitoring-api', {
    projectId,
    projectRef,
    userId,
    endpoint: req.url,
    userAgent: req.headers['user-agent'],
    ip: req.headers['x-forwarded-for'] as string || req.connection.remoteAddress
  })

  try {
    const monitoringService = getEnhancedMonitoringDataService()

    if (req.method === 'GET') {
      // Parse query parameters for filtering
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50
      const offset = req.query.offset ? parseInt(req.query.offset as string) : 0
      const search = req.query.search as string
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined

      // Enhanced validation with ProjectManagementError
      if (isNaN(limit) || limit < 1 || limit > 1000) {
        throw ErrorFactory.validation.invalidInput('limit', 'Limit must be between 1 and 1000', errorContext)
      }

      if (isNaN(offset) || offset < 0) {
        throw ErrorFactory.validation.invalidInput('offset', 'Offset must be non-negative', errorContext)
      }

      if (startDate && isNaN(startDate.getTime())) {
        throw ErrorFactory.validation.invalidInput('startDate', 'Start date must be a valid ISO date string', errorContext)
      }

      if (endDate && isNaN(endDate.getTime())) {
        throw ErrorFactory.validation.invalidInput('endDate', 'End date must be a valid ISO date string', errorContext)
      }

      // Get monitoring data with automatic project filtering
      const data = await monitoringService.getMonitoringData(projectId, {
        limit,
        offset,
        search,
        startDate,
        endDate
      })

      return {
        data,
        meta: {
          count: data.length,
          limit,
          offset,
          project: {
            id: projectId,
            ref: projectRef
          }
        }
      }
    }

    if (req.method === 'POST') {
      const { metric_name, metric_value, metadata } = req.body

      // Enhanced validation with ProjectManagementError
      if (!metric_name || typeof metric_name !== 'string' || metric_name.trim().length === 0) {
        throw ErrorFactory.validation.missingRequiredField('metric_name', errorContext)
      }

      if (metric_value === undefined || typeof metric_value !== 'number' || !isFinite(metric_value)) {
        throw ErrorFactory.validation.invalidInput('metric_value', 'Metric value must be a finite number', errorContext)
      }

      if (metadata !== undefined && (typeof metadata !== 'object' || Array.isArray(metadata) || metadata === null)) {
        throw ErrorFactory.validation.invalidInput('metadata', 'Metadata must be an object', errorContext)
      }

      // Create new monitoring data with automatic project association
      const newData = await monitoringService.saveMonitoringData(projectId, {
        metric_name,
        metric_value,
        metadata,
        timestamp: new Date(),
        created_at: new Date()
      })

      return {
        data: newData,
        message: 'Monitoring data created successfully'
      }
    }

    // Method not allowed
    res.status(405).json({
      error: 'Method not allowed',
      message: `Method ${req.method} is not supported for this endpoint`
    })
    return

  } catch (error) {
    // Handle ProjectManagementError with comprehensive error handling
    if (error instanceof ProjectManagementError) {
      return handleApiError(error, res, errorContext)
    }
    
    // Handle unexpected errors
    const managementError = ErrorFactory.generic.internalServerError(
      'monitoring endpoint',
      error as Error,
      errorContext
    )
    
    return handleApiError(managementError, res, errorContext)
  }
})