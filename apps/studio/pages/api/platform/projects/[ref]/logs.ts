import { NextApiRequest, NextApiResponse } from 'next'
import { withProjectIsolation } from '../../../../../lib/api/project-isolation-middleware'
import { getLogDataService } from '../../../../../lib/api/data-services'

/**
 * API endpoint for log data with project isolation
 * 
 * GET /api/platform/projects/[ref]/logs - Get log data for project
 * POST /api/platform/projects/[ref]/logs - Create new log data
 * 
 * Requirements: 2.5, 2.6
 */
export default withProjectIsolation(async (req, res, context) => {
  const { projectId, projectRef } = context

  try {
    const logService = getLogDataService()

    if (req.method === 'GET') {
      // Parse query parameters for filtering
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50
      const offset = req.query.offset ? parseInt(req.query.offset as string) : 0
      const search = req.query.search as string
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined
      const logLevel = req.query.logLevel as string

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

      // Validate log level if provided
      const validLogLevels = ['debug', 'info', 'warn', 'error']
      if (logLevel && !validLogLevels.includes(logLevel)) {
        return res.status(400).json({
          error: 'Invalid logLevel parameter',
          message: `logLevel must be one of: ${validLogLevels.join(', ')}`
        })
      }

      // Get log data with automatic project filtering
      const data = await logService.getLogData(projectId, {
        limit,
        offset,
        search,
        startDate,
        endDate
      })

      // Filter by log level if specified (this would typically be done in the database query)
      const filteredData = logLevel 
        ? data.filter(log => log.log_level === (logLevel as 'debug' | 'info' | 'warn' | 'error'))
        : data

      return {
        data: filteredData,
        meta: {
          count: filteredData.length,
          totalCount: data.length,
          limit,
          offset,
          filters: {
            logLevel,
            search,
            startDate,
            endDate
          },
          project: {
            id: projectId,
            ref: projectRef
          }
        }
      }
    }

    if (req.method === 'POST') {
      const { log_level, message, metadata } = req.body

      // Validate required fields
      if (!log_level || typeof log_level !== 'string') {
        return res.status(400).json({
          error: 'Invalid log_level',
          message: 'log_level is required and must be a string'
        })
      }

      // Validate log level
      const validLogLevels = ['debug', 'info', 'warn', 'error']
      if (!validLogLevels.includes(log_level)) {
        return res.status(400).json({
          error: 'Invalid log_level',
          message: `log_level must be one of: ${validLogLevels.join(', ')}`
        })
      }

      if (!message || typeof message !== 'string') {
        return res.status(400).json({
          error: 'Invalid message',
          message: 'message is required and must be a string'
        })
      }

      // Validate message length
      if (message.length > 10000) {
        return res.status(400).json({
          error: 'Message too long',
          message: 'Log message must be 10,000 characters or less'
        })
      }

      // Validate metadata if provided
      if (metadata !== undefined && (typeof metadata !== 'object' || Array.isArray(metadata))) {
        return res.status(400).json({
          error: 'Invalid metadata',
          message: 'metadata must be an object if provided'
        })
      }

      // Create new log data with automatic project association
      const newData = await logService.saveLogData(projectId, {
        log_level,
        message,
        metadata,
        timestamp: new Date()
      })

      return {
        data: newData,
        message: 'Log data created successfully'
      }
    }

    // Method not allowed
    res.status(405).json({
      error: 'Method not allowed',
      message: `Method ${req.method} is not supported for this endpoint`
    })
    return

  } catch (error) {
    console.error('Logs endpoint error:', error)
    
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
          message: 'You do not have permission to access this project\'s log data'
        })
      }
      
      if (error.message.includes('Data ownership validation failed')) {
        return res.status(403).json({
          error: 'Data isolation violation',
          message: 'Log data does not belong to the specified project'
        })
      }
    }

    // Generic server error
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process log data request'
    })
    return
  }
})