/**
 * Health Check API Endpoint
 * 
 * Provides comprehensive health status for the Studio application including:
 * - Runtime configuration availability
 * - GoTrue service reachability
 * - API gateway reachability
 * - Overall system health
 * 
 * This endpoint is used by:
 * - Load balancers for health checks
 * - Monitoring systems
 * - Troubleshooting and diagnostics
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { performConfigHealthCheck, formatHealthCheckResult } from '../../lib/config-health'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req

  switch (method) {
    case 'GET':
      return handleGet(req, res)
    default:
      res.setHeader('Allow', ['GET'])
      res.status(405).json({ 
        error: 'Method Not Allowed',
        message: `Method ${method} not allowed. Use GET to check health status.`
      })
  }
}

async function handleGet(req: NextApiRequest, res: NextApiResponse) {
  try {
    console.log('[Health API] Performing comprehensive health check...')
    
    // Perform comprehensive health check
    const healthResult = await performConfigHealthCheck()
    
    // Log the result for debugging
    console.log(formatHealthCheckResult(healthResult))
    
    // Determine HTTP status code based on health
    // In development environment, be more lenient with health checks
    const isDevelopment = healthResult.config?.environment === 'development'
    const hasRuntimeConfig = healthResult.checks.runtimeConfigAvailable.healthy
    
    // For development: healthy if runtime config is available
    // For production: healthy only if all checks pass
    const isHealthy = isDevelopment ? hasRuntimeConfig : healthResult.healthy
    const statusCode = isHealthy ? 200 : 503
    
    // Return health check result
    return res.status(statusCode).json({
      healthy: healthResult.healthy,
      timestamp: new Date(healthResult.timestamp).toISOString(),
      checks: {
        runtimeConfig: {
          healthy: healthResult.checks.runtimeConfigAvailable.healthy,
          responseTime: healthResult.checks.runtimeConfigAvailable.responseTime,
          error: healthResult.checks.runtimeConfigAvailable.error,
        },
        gotrue: {
          healthy: healthResult.checks.gotrueReachable.healthy,
          url: healthResult.checks.gotrueReachable.url,
          responseTime: healthResult.checks.gotrueReachable.responseTime,
          error: healthResult.checks.gotrueReachable.error,
        },
        apiGateway: {
          healthy: healthResult.checks.apiGatewayReachable.healthy,
          url: healthResult.checks.apiGatewayReachable.url,
          responseTime: healthResult.checks.apiGatewayReachable.responseTime,
          error: healthResult.checks.apiGatewayReachable.error,
        },
      },
      config: healthResult.config ? {
        environment: healthResult.config.environment,
        source: healthResult.config.source,
        gotrueUrl: healthResult.config.gotrueUrl,
        supabaseUrl: healthResult.config.supabaseUrl,
        apiUrl: healthResult.config.apiUrl,
        // Note: We don't expose the anonKey for security reasons
      } : null,
      errors: healthResult.errors,
      warnings: healthResult.warnings,
    })
  } catch (error) {
    console.error('[Health API] Health check failed with exception:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    return res.status(500).json({
      healthy: false,
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      message: errorMessage,
      checks: {
        runtimeConfig: { healthy: false, error: 'Health check exception' },
        gotrue: { healthy: false, error: 'Health check exception' },
        apiGateway: { healthy: false, error: 'Health check exception' },
      },
    })
  }
}