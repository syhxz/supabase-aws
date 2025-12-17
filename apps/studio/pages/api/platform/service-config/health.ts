import { NextApiRequest, NextApiResponse } from 'next'
import { getServiceConfigurationManager } from 'lib/service-configuration'

/**
 * API endpoint for service configuration health checks
 * 
 * GET /api/platform/service-config/health
 * - Get health status of all service configurations
 * 
 * GET /api/platform/service-config/health?project=<ref>
 * - Get health status for a specific project
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ 
      error: { message: `Method ${req.method} not allowed` } 
    })
  }

  const serviceConfigManager = getServiceConfigurationManager()
  const projectRef = req.query.project as string | undefined

  try {
    // Get health check results
    const healthResult = await serviceConfigManager.healthCheck(projectRef)
    
    // Get statistics
    const stats = serviceConfigManager.getStats()
    
    // Get recent authentication failures
    const recentFailures = serviceConfigManager.getAllAuthFailureLogs(10)

    const response = {
      healthy: healthResult.healthy,
      timestamp: new Date().toISOString(),
      statistics: stats,
      projects: healthResult.projects,
      recentAuthFailures: recentFailures.map(failure => ({
        projectRef: failure.projectRef,
        service: failure.service,
        timestamp: failure.timestamp,
        error: failure.error,
        databaseUser: failure.databaseUser
        // Note: connection string is excluded for security
      }))
    }

    const statusCode = healthResult.healthy ? 200 : 503
    return res.status(statusCode).json(response)

  } catch (error: any) {
    console.error('Service config health check error:', error)
    return res.status(500).json({ 
      error: { message: error.message || 'Health check failed' },
      healthy: false,
      timestamp: new Date().toISOString()
    })
  }
}