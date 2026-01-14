import { NextApiRequest, NextApiResponse } from 'next'
import { withSecureApiWrapper } from '../../../../../../../lib/api/secure-api-wrapper'
import { getSupabaseRestContainerClient } from 'lib/api/supabase-rest-container-client'
import { SupabaseRestContainerMetricsResponse } from 'data/monitoring/supabase-rest-container-metrics-query'

/**
 * Supabase REST Container Metrics Endpoint
 * Provides detailed performance metrics for the enhanced PostgREST container
 * Requirements: 13.1
 */
const handler = withSecureApiWrapper(async (req: NextApiRequest, res: NextApiResponse) => {
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
    const metricsData = await containerClient.getContainerMetrics(projectRef)

    // Transform container metrics data to match expected response format
    const response: SupabaseRestContainerMetricsResponse = {
      projectRef,
      timestamp: metricsData.timestamp,
      metrics: {
        activeConnections: metricsData.metrics.activeConnections,
        totalQueries: metricsData.metrics.totalQueries,
        averageResponseTime: metricsData.metrics.averageResponseTime,
        errorRate: metricsData.metrics.errorRate,
        cacheHitRate: metricsData.metrics.cacheHitRate,
        memoryUsage: metricsData.metrics.memoryUsage,
        cpuUsage: metricsData.metrics.cpuUsage,
        // These fields may not be available from the container client yet
        requestsPerSecond: (metricsData as any).requestsPerSecond ?? 0,
        slowQueries: (metricsData as any).slowQueries ?? 0,
        connectionPoolUtilization: (metricsData as any).connectionPoolUtilization ?? 0
      },
      queryStats: {
        selectQueries: metricsData.queryStats?.selectQueries ?? 0,
        insertQueries: metricsData.queryStats?.insertQueries ?? 0,
        updateQueries: metricsData.queryStats?.updateQueries ?? 0,
        deleteQueries: metricsData.queryStats?.deleteQueries ?? 0,
        rpcCalls: metricsData.queryStats?.rpcCalls ?? 0,
        bulkOperations: metricsData.queryStats?.bulkOperations ?? 0,
        transactionCount: metricsData.queryStats?.transactionCount ?? 0,
        aggregateQueries: metricsData.queryStats?.aggregateQueries ?? 0,
        nestedResourceQueries: metricsData.queryStats?.nestedResourceQueries ?? 0,
        fullTextSearchQueries: metricsData.queryStats?.fullTextSearchQueries ?? 0,
        jsonOperationQueries: metricsData.queryStats?.jsonOperationQueries ?? 0,
        arrayOperationQueries: metricsData.queryStats?.arrayOperationQueries ?? 0
      },
      errorStats: {
        totalErrors: metricsData.errorStats?.totalErrors ?? 0,
        authenticationErrors: metricsData.errorStats?.authenticationErrors ?? 0,
        authorizationErrors: metricsData.errorStats?.authorizationErrors ?? 0,
        validationErrors: metricsData.errorStats?.validationErrors ?? 0,
        databaseErrors: metricsData.errorStats?.databaseErrors ?? 0,
        timeoutErrors: metricsData.errorStats?.timeoutErrors ?? 0,
        networkErrors: metricsData.errorStats?.networkErrors ?? 0,
        internalErrors: metricsData.errorStats?.internalErrors ?? 0
      },
      performanceStats: {
        p50ResponseTime: (metricsData as any).performanceStats?.p50ResponseTime ?? 0,
        p95ResponseTime: (metricsData as any).performanceStats?.p95ResponseTime ?? 0,
        p99ResponseTime: (metricsData as any).performanceStats?.p99ResponseTime ?? 0,
        slowestQuery: (metricsData as any).performanceStats?.slowestQuery ?? null,
        fastestQuery: (metricsData as any).performanceStats?.fastestQuery ?? null
      },
      error: metricsData.error
    }

    // Set appropriate cache headers for metrics
    res.setHeader('Cache-Control', 'public, max-age=10') // Cache for 10 seconds
    res.setHeader('X-Metrics-Timestamp', response.timestamp)

    return res.status(200).json(response)

  } catch (error) {
    console.error(`Container metrics error for project ${projectRef}:`, error)
    
    // Return empty metrics with error
    const errorResponse: SupabaseRestContainerMetricsResponse = {
      projectRef,
      timestamp: new Date().toISOString(),
      metrics: {
        activeConnections: 0,
        totalQueries: 0,
        averageResponseTime: 0,
        errorRate: 0,
        cacheHitRate: 0,
        memoryUsage: 0,
        cpuUsage: 0,
        requestsPerSecond: 0,
        slowQueries: 0,
        connectionPoolUtilization: 0
      },
      queryStats: {
        selectQueries: 0,
        insertQueries: 0,
        updateQueries: 0,
        deleteQueries: 0,
        rpcCalls: 0,
        bulkOperations: 0,
        transactionCount: 0,
        aggregateQueries: 0,
        nestedResourceQueries: 0,
        fullTextSearchQueries: 0,
        jsonOperationQueries: 0,
        arrayOperationQueries: 0
      },
      errorStats: {
        totalErrors: 0,
        authenticationErrors: 0,
        authorizationErrors: 0,
        validationErrors: 0,
        databaseErrors: 0,
        timeoutErrors: 0,
        networkErrors: 0,
        internalErrors: 0
      },
      performanceStats: {
        p50ResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        slowestQuery: null,
        fastestQuery: null
      },
      error: error instanceof Error ? error.message : 'Metrics collection failed'
    }

    return res.status(503).json(errorResponse)
  }
})

export default handler