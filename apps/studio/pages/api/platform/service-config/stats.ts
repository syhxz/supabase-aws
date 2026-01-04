import { NextApiRequest, NextApiResponse } from 'next'
import { getServiceConfigurationManager } from 'lib/service-configuration'

/**
 * API endpoint for service configuration statistics
 * 
 * GET /api/platform/service-config/stats
 * - Get detailed statistics about service configurations
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ 
      error: { message: `Method ${req.method} not allowed` } 
    })
  }

  const serviceConfigManager = getServiceConfigurationManager()

  try {
    // Get basic statistics
    const stats = serviceConfigManager.getStats()
    
    // Get authentication failure logs grouped by project and service
    const allFailures = serviceConfigManager.getAllAuthFailureLogs(500)
    
    // Group failures by project
    const failuresByProject: Record<string, any> = {}
    const failuresByService: Record<string, number> = {
      gotrue: 0,
      storage: 0,
      realtime: 0,
      postgrest: 0
    }

    for (const failure of allFailures) {
      // Count by project
      if (!failuresByProject[failure.projectRef]) {
        failuresByProject[failure.projectRef] = {
          projectRef: failure.projectRef,
          totalFailures: 0,
          services: {} as Record<string, number>,
          lastFailure: failure.timestamp
        }
      }
      
      const projectStats = failuresByProject[failure.projectRef]
      projectStats.totalFailures++
      
      if (!projectStats.services[failure.service]) {
        projectStats.services[failure.service] = 0
      }
      projectStats.services[failure.service]++
      
      // Update last failure if this one is more recent
      if (failure.timestamp > projectStats.lastFailure) {
        projectStats.lastFailure = failure.timestamp
      }

      // Count by service
      if (failuresByService.hasOwnProperty(failure.service)) {
        failuresByService[failure.service]++
      }
    }

    // Calculate failure rates over different time periods
    const now = Date.now()
    const oneHourAgo = now - (60 * 60 * 1000)
    const oneDayAgo = now - (24 * 60 * 60 * 1000)
    const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000)

    const recentFailures = {
      lastHour: allFailures.filter(f => f.timestamp.getTime() > oneHourAgo).length,
      lastDay: allFailures.filter(f => f.timestamp.getTime() > oneDayAgo).length,
      lastWeek: allFailures.filter(f => f.timestamp.getTime() > oneWeekAgo).length
    }

    const response = {
      timestamp: new Date().toISOString(),
      overview: {
        configuredProjects: stats.configuredProjects,
        totalAuthFailures: stats.totalAuthFailures,
        recentAuthFailures: stats.recentAuthFailures,
        serviceStats: stats.serviceStats
      },
      failureAnalysis: {
        recentFailures,
        failuresByProject: Object.values(failuresByProject),
        failuresByService,
        topFailingProjects: Object.values(failuresByProject)
          .sort((a: any, b: any) => b.totalFailures - a.totalFailures)
          .slice(0, 10)
      },
      serviceHealth: {
        gotrue: {
          configured: stats.serviceStats.gotrue?.configured || 0,
          errors: stats.serviceStats.gotrue?.errors || 0,
          failures: failuresByService.gotrue
        },
        storage: {
          configured: stats.serviceStats.storage?.configured || 0,
          errors: stats.serviceStats.storage?.errors || 0,
          failures: failuresByService.storage
        },
        realtime: {
          configured: stats.serviceStats.realtime?.configured || 0,
          errors: stats.serviceStats.realtime?.errors || 0,
          failures: failuresByService.realtime
        },
        postgrest: {
          configured: stats.serviceStats.postgrest?.configured || 0,
          errors: stats.serviceStats.postgrest?.errors || 0,
          failures: failuresByService.postgrest
        }
      }
    }

    return res.status(200).json(response)

  } catch (error: any) {
    console.error('Service config stats error:', error)
    return res.status(500).json({ 
      error: { message: error.message || 'Failed to get statistics' } 
    })
  }
}