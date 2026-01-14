import { NextApiRequest, NextApiResponse } from 'next'
import { withSecureProjectAccess, ProjectIsolationContext } from 'lib/api/secure-api-wrapper'
import { getSupabaseRestContainerClient } from 'lib/api/supabase-rest-container-client'
import { SupabaseRestContainerHealthResponse } from 'data/monitoring/supabase-rest-container-health-query'

/**
 * Supabase REST Container Health Endpoint
 * Provides health status and basic diagnostics for the enhanced PostgREST container
 * Requirements: 13.1
 */
export default withSecureProjectAccess(handler, {
  permissions: { read: true }
})

async function handler(req: NextApiRequest, res: NextApiResponse, context: ProjectIsolationContext) {
  const { ref: projectRef } = req.query as { ref: string }

  if (!projectRef) {
    return res.status(400).json({
      error: 'Missing project reference',
      message: 'Project reference is required'
    })
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({
      error: 'Method not allowed',
      message: `Method ${req.method} is not allowed for this endpoint`
    })
  }

  try {
    const containerClient = getSupabaseRestContainerClient()
    const healthData = await containerClient.getContainerHealth(projectRef)

    // Transform container health data to match expected response format
    const response: SupabaseRestContainerHealthResponse = {
      projectRef,
      healthy: healthData.healthy,
      status: healthData.healthy ? 'healthy' : 'unhealthy',
      responseTime: healthData.responseTime,
      timestamp: healthData.timestamp,
      details: {
        database: {
          connected: healthData.details?.database?.connected ?? false,
          responseTime: healthData.details?.database?.responseTime ?? 0
        },
        features: {
          rpcFunctions: healthData.details?.features?.rpcFunctions ?? false,
          databaseViews: healthData.details?.features?.databaseViews ?? false,
          advancedJSON: healthData.details?.features?.advancedJSON ?? false,
          fullTextSearch: healthData.details?.features?.fullTextSearch ?? false,
          aggregateQueries: healthData.details?.features?.aggregateQueries ?? false,
          bulkOperations: healthData.details?.features?.bulkOperations ?? false,
          nestedResources: healthData.details?.features?.nestedResources ?? false,
          transactions: healthData.details?.features?.transactions ?? false,
          arrayOperations: healthData.details?.features?.arrayOperations ?? false,
          contentNegotiation: healthData.details?.features?.contentNegotiation ?? false
        },
        performance: {
          memoryUsage: healthData.details?.performance?.memoryUsage ?? 0,
          cpuUsage: healthData.details?.performance?.cpuUsage ?? 0,
          activeConnections: healthData.details?.performance?.activeConnections ?? 0
        }
      },
      error: healthData.error
    }

    // Set appropriate cache headers for health checks
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')

    return res.status(200).json(response)

  } catch (error) {
    console.error(`Container health check error for project ${projectRef}:`, error)
    
    // Return unhealthy status with error details
    const errorResponse: SupabaseRestContainerHealthResponse = {
      projectRef,
      healthy: false,
      status: 'unknown',
      responseTime: 0,
      timestamp: new Date().toISOString(),
      details: {
        database: { connected: false, responseTime: 0 },
        features: {
          rpcFunctions: false,
          databaseViews: false,
          advancedJSON: false,
          fullTextSearch: false,
          aggregateQueries: false,
          bulkOperations: false,
          nestedResources: false,
          transactions: false,
          arrayOperations: false,
          contentNegotiation: false
        },
        performance: {
          memoryUsage: 0,
          cpuUsage: 0,
          activeConnections: 0
        }
      },
      error: error instanceof Error ? error.message : 'Health check failed'
    }

    return res.status(503).json(errorResponse)
  }
}