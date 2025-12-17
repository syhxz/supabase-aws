/**
 * API endpoint for accessing credential audit logs
 * Provides filtered access to audit log entries with pagination
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { getCredentialMonitoringService } from '../../../../lib/api/self-hosted'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const monitoringService = getCredentialMonitoringService()
    
    // Parse query parameters
    const {
      limit = '100',
      eventType,
      projectRef
    } = req.query

    const parsedLimit = Math.min(parseInt(limit as string, 10) || 100, 1000) // Max 1000 entries

    // Validate eventType if provided
    const validEventTypes = ['fallback_used', 'credentials_migrated', 'validation_failed', 'health_check', 'report_generated']
    if (eventType && !validEventTypes.includes(eventType as string)) {
      return res.status(400).json({ 
        error: 'Invalid event type',
        validEventTypes
      })
    }

    // Get audit log entries
    const auditLog = await monitoringService.getAuditLog(
      parsedLimit,
      eventType as any
    )

    // Filter by project reference if provided
    let filteredLog = auditLog
    if (projectRef) {
      filteredLog = auditLog.filter(entry => entry.project_ref === projectRef)
    }

    const response = {
      entries: filteredLog,
      totalReturned: filteredLog.length,
      filters: {
        limit: parsedLimit,
        eventType: eventType || null,
        projectRef: projectRef || null
      },
      timestamp: new Date().toISOString()
    }

    res.status(200).json(response)
  } catch (error) {
    console.error('[Credential Monitoring API] Error getting audit log:', error)
    res.status(500).json({ 
      error: 'Failed to retrieve audit log',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}