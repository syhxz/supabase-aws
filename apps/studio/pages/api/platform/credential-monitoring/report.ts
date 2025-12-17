/**
 * API endpoint for generating comprehensive credential reports
 * Provides detailed analysis and recommendations for credential management
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { getCredentialMonitoringService } from '../../../../lib/api/self-hosted'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const monitoringService = getCredentialMonitoringService()
    
    // Generate comprehensive report
    const report = monitoringService.generateCredentialReport()

    // Set content type for potential download
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="credential-report-${new Date().toISOString().split('T')[0]}.json"`)

    res.status(200).json(report)
  } catch (error) {
    console.error('[Credential Monitoring API] Error generating report:', error)
    res.status(500).json({ 
      error: 'Failed to generate credential report',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}