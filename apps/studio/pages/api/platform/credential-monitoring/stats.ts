/**
 * API endpoint for credential monitoring statistics
 * Provides fallback usage statistics and system health metrics
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { getCredentialMonitoringService } from '../../../../lib/api/self-hosted'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const monitoringService = getCredentialMonitoringService()
    
    // Get comprehensive statistics
    const [fallbackStats, auditStats] = await Promise.all([
      monitoringService.getFallbackUsageStats(),
      monitoringService.getAuditLogStats()
    ])

    const response = {
      fallbackUsage: fallbackStats,
      auditLog: auditStats,
      timestamp: new Date().toISOString()
    }

    res.status(200).json(response)
  } catch (error) {
    console.error('[Credential Monitoring API] Error getting stats:', error)
    res.status(500).json({ 
      error: 'Failed to retrieve credential monitoring statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}