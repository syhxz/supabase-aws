/**
 * API endpoint for credential system health check
 * Provides comprehensive health assessment and recommendations
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { getCredentialMonitoringService } from '../../../../lib/api/self-hosted'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const monitoringService = getCredentialMonitoringService()
    
    // Perform health check
    const healthCheck = monitoringService.performCredentialHealthCheck()

    // Set appropriate HTTP status based on health
    let statusCode = 200
    if (healthCheck.status === 'warning') {
      statusCode = 200 // Still OK, but with warnings
    } else if (healthCheck.status === 'critical') {
      statusCode = 503 // Service degraded
    }

    res.status(statusCode).json(healthCheck)
  } catch (error) {
    console.error('[Credential Monitoring API] Error performing health check:', error)
    res.status(500).json({ 
      error: 'Failed to perform credential health check',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}