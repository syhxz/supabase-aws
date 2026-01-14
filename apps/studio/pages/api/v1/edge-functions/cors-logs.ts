/**
 * CORS Error Logs Endpoint for Edge Functions
 * 
 * Provides access to CORS error logs and statistics for troubleshooting.
 * Helps developers understand and resolve CORS configuration issues.
 * 
 * Requirements: 22.1, 22.4
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { withCORS } from 'lib/functions-service/cors/CORSMiddleware'
import { getCORSErrorHandler } from 'lib/functions-service/cors/CORSErrorHandler'

/**
 * CORS logs response interface
 */
interface CORSLogsResponse {
  timestamp: string
  statistics: {
    total: number
    byType: Record<string, number>
    byLevel: Record<string, number>
    recentErrors: number
  }
  logs: Array<{
    timestamp: string
    level: string
    type: string
    message: string
    details: any
    troubleshooting: {
      steps: string[]
      suggestions: string[]
      documentation?: string[]
    }
  }>
  actions: Array<{
    label: string
    description: string
    endpoint: string
  }>
}

/**
 * CORS logs handler
 */
async function corsLogsHandler(req: NextApiRequest, res: NextApiResponse) {
  console.log('[CORS Logs] Processing logs request:', {
    method: req.method,
    query: req.query,
  })

  try {
    const errorHandler = getCORSErrorHandler()
    
    // Parse query parameters
    const limit = parseInt(req.query.limit as string) || 50
    const type = req.query.type as string
    const level = req.query.level as string

    // Get logs based on filters
    let logs = errorHandler.getRecentLogs(limit)
    
    if (type) {
      logs = errorHandler.getLogsByType(type as any, limit)
    }
    
    if (level) {
      logs = logs.filter(log => log.level === level)
    }

    // Get statistics
    const statistics = errorHandler.getErrorStatistics()

    // Build response
    const response: CORSLogsResponse = {
      timestamp: new Date().toISOString(),
      statistics,
      logs,
      actions: [
        {
          label: 'Run CORS Diagnostics',
          description: 'Test and validate current CORS configuration',
          endpoint: '/api/v1/edge-functions/cors-diagnostics?runTests=true',
        },
        {
          label: 'Check Health Status',
          description: 'Verify Edge Functions service health and CORS status',
          endpoint: '/api/v1/edge-functions/health',
        },
        {
          label: 'Clear Error Logs',
          description: 'Clear all CORS error logs (POST request)',
          endpoint: '/api/v1/edge-functions/cors-logs',
        },
      ],
    }

    // Handle POST request to clear logs
    if (req.method === 'POST' && req.query.action === 'clear') {
      errorHandler.clearLogs()
      console.log('[CORS Logs] Error logs cleared by request')
      
      return res.status(200).json({
        ...response,
        logs: [],
        statistics: {
          total: 0,
          byType: {},
          byLevel: {},
          recentErrors: 0,
        },
        message: 'CORS error logs cleared successfully',
      })
    }

    console.log('[CORS Logs] Returning logs:', {
      totalLogs: logs.length,
      totalErrors: statistics.total,
      recentErrors: statistics.recentErrors,
    })

    return res.status(200).json(response)

  } catch (error) {
    console.error('[CORS Logs] Failed to retrieve logs:', error)

    const errorResponse = {
      timestamp: new Date().toISOString(),
      error: 'Failed to retrieve CORS logs',
      message: error instanceof Error ? error.message : 'Unknown error',
      statistics: {
        total: 0,
        byType: {},
        byLevel: {},
        recentErrors: 0,
      },
      logs: [],
      actions: [],
    }

    return res.status(500).json(errorResponse)
  }
}

/**
 * Export handler with CORS middleware
 */
export default withCORS(corsLogsHandler, {
  handlePreflight: true,
  addHeaders: true,
  corsConfig: {
    allowedMethods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: [
      'user-agent',
      'content-type',
      'authorization',
      'x-client-info',
      'apikey',
    ],
  },
})