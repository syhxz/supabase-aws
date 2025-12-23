import { NextApiRequest, NextApiResponse } from 'next'
import { withProjectIsolation } from '../../../../../lib/api/project-isolation-middleware'
import { getAdvisorDataService } from '../../../../../lib/api/data-services'

/**
 * API endpoint for advisor data with project isolation
 * 
 * GET /api/platform/projects/[ref]/advisor - Get advisor data for project
 * POST /api/platform/projects/[ref]/advisor - Create new advisor data
 * 
 * Requirements: 2.3, 2.4
 */
export default withProjectIsolation(async (req, res, context) => {
  const { projectId, projectRef } = context

  try {
    const advisorService = getAdvisorDataService()

    if (req.method === 'GET') {
      // Parse query parameters for filtering
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50
      const offset = req.query.offset ? parseInt(req.query.offset as string) : 0
      const search = req.query.search as string
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined

      // Validate pagination parameters
      if (isNaN(limit) || limit < 1 || limit > 1000) {
        return res.status(400).json({
          error: 'Invalid limit parameter',
          message: 'Limit must be between 1 and 1000'
        })
      }

      if (isNaN(offset) || offset < 0) {
        return res.status(400).json({
          error: 'Invalid offset parameter',
          message: 'Offset must be non-negative'
        })
      }

      // Validate date parameters
      if (startDate && isNaN(startDate.getTime())) {
        return res.status(400).json({
          error: 'Invalid startDate parameter',
          message: 'startDate must be a valid ISO date string'
        })
      }

      if (endDate && isNaN(endDate.getTime())) {
        return res.status(400).json({
          error: 'Invalid endDate parameter',
          message: 'endDate must be a valid ISO date string'
        })
      }

      // Get advisor data with automatic project filtering
      const data = await advisorService.getAdvisorData(projectId, {
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
      const { advisor_type, recommendation, severity, metadata } = req.body

      // Validate required fields
      if (!advisor_type || typeof advisor_type !== 'string') {
        return res.status(400).json({
          error: 'Invalid advisor_type',
          message: 'advisor_type is required and must be a string'
        })
      }

      if (!recommendation || typeof recommendation !== 'string') {
        return res.status(400).json({
          error: 'Invalid recommendation',
          message: 'recommendation is required and must be a string'
        })
      }

      // Validate severity
      const validSeverities = ['info', 'warning', 'critical']
      if (!severity || !validSeverities.includes(severity)) {
        return res.status(400).json({
          error: 'Invalid severity',
          message: `severity is required and must be one of: ${validSeverities.join(', ')}`
        })
      }

      // Validate metadata if provided
      if (metadata !== undefined && (typeof metadata !== 'object' || Array.isArray(metadata))) {
        return res.status(400).json({
          error: 'Invalid metadata',
          message: 'metadata must be an object if provided'
        })
      }

      // Create new advisor data with automatic project association
      const newData = await advisorService.saveAdvisorData(projectId, {
        advisor_type,
        recommendation,
        severity,
        metadata,
        created_at: new Date(),
        resolved_at: undefined
      })

      return {
        data: newData,
        message: 'Advisor data created successfully'
      }
    }

    if (req.method === 'PATCH') {
      // Handle resolving advisor recommendations
      const { id, resolved_at } = req.body

      if (!id || typeof id !== 'number') {
        return res.status(400).json({
          error: 'Invalid id',
          message: 'id is required and must be a number'
        })
      }

      // For now, we'll return a mock response since we don't have update functionality in the service
      // In a real implementation, this would update the advisor data record
      return {
        data: {
          id,
          resolved_at: resolved_at || new Date(),
          message: 'Advisor recommendation resolved successfully'
        }
      }
    }

    // Method not allowed
    res.status(405).json({
      error: 'Method not allowed',
      message: `Method ${req.method} is not supported for this endpoint`
    })
    return

  } catch (error) {
    console.error('Advisor endpoint error:', error)
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('Project not found')) {
        return res.status(404).json({
          error: 'Project not found',
          message: `Project ${projectRef} does not exist`
        })
      }
      
      if (error.message.includes('Access denied')) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You do not have permission to access this project\'s advisor data'
        })
      }
      
      if (error.message.includes('Data ownership validation failed')) {
        return res.status(403).json({
          error: 'Data isolation violation',
          message: 'Advisor data does not belong to the specified project'
        })
      }
    }

    // Generic server error
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process advisor data request'
    })
    return
  }
})