import { NextApiRequest, NextApiResponse } from 'next'
import { getEnhancedRestApiService } from '../../../lib/api/enhanced-rest-api-service'
import { getContainerHealthMonitor } from '../../../lib/api/container-health-monitor'
import { getContainerLoggingService } from '../../../lib/api/container-logging-service'
import { withSecureApiWrapper } from '../../../lib/api/secure-api-wrapper'

/**
 * Enhanced REST API health endpoint
 * Provides health status and monitoring information
 * Requirements: 13.1
 */
async function healthHandler(req: NextApiRequest, res: NextApiResponse) {
  const { method, query } = req
  
  try {
    const enhancedService = getEnhancedRestApiService()
    const healthMonitor = getContainerHealthMonitor()
    const loggingService = getContainerLoggingService()
    
    switch (method) {
      case 'GET':
        // Get overall service health
        if (!query.project) {
          const serviceHealth = await enhancedService.getServiceHealth()
          return res.status(serviceHealth.healthy ? 200 : 503).json(serviceHealth)
        }
        
        // Get specific project health
        const projectRef = query.project as string
        const projectStatus = await enhancedService.getProjectStatus(projectRef)
        return res.status(projectStatus.healthy ? 200 : 503).json(projectStatus)
      
      case 'POST':
        // Manual health check trigger
        if (query.action === 'check') {
          const projectRef = query.project as string
          if (projectRef) {
            // Trigger health check for specific project
            const healthStatus = healthMonitor.getCurrentHealthStatus(projectRef)
            return res.status(200).json({
              message: 'Health check triggered',
              status: healthStatus
            })
          } else {
            // Trigger global health check
            const summary = healthMonitor.getHealthSummary()
            return res.status(200).json({
              message: 'Global health check triggered',
              summary
            })
          }
        }
        
        return res.status(400).json({
          error: 'Invalid action',
          hint: 'Use action=check to trigger health checks'
        })
      
      default:
        res.setHeader('Allow', ['GET', 'POST'])
        return res.status(405).json({
          error: 'Method not allowed',
          hint: 'Use GET to retrieve health status or POST to trigger health checks'
        })
    }
    
  } catch (error) {
    console.error('Health endpoint error:', error)
    
    res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

/**
 * Export the handler wrapped with security middleware
 */
export default withSecureApiWrapper(healthHandler, {
  requireProjectContext: false, // Health endpoint can be accessed globally
  requireDataApiAccess: false
})