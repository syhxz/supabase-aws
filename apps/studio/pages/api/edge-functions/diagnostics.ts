/**
 * Edge Functions Diagnostics API Endpoint
 * 
 * Provides diagnostic information and health checks for Edge Functions
 * configuration and services.
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { 
  generateEdgeFunctionsDiagnostics,
  quickHealthCheck,
  validateProductionReadiness,
  getConfigurationDiagnostics,
} from 'lib/edge-functions-config'
import { withCORS } from 'lib/functions-service/cors/CORSMiddleware'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { type = 'full' } = req.query

  try {
    switch (type) {
      case 'health':
        const healthCheck = await quickHealthCheck()
        return res.status(200).json(healthCheck)

      case 'config':
        const configDiagnostics = await getConfigurationDiagnostics()
        return res.status(200).json(configDiagnostics)

      case 'production':
        const productionReadiness = await validateProductionReadiness()
        return res.status(200).json(productionReadiness)

      case 'full':
      default:
        const fullDiagnostics = await generateEdgeFunctionsDiagnostics()
        return res.status(200).json(fullDiagnostics)
    }
  } catch (error) {
    console.error('Error generating diagnostics:', error)
    return res.status(500).json({
      error: 'Failed to generate diagnostics',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

export default withCORS(handler, {
  handlePreflight: true,
  addHeaders: true,
})