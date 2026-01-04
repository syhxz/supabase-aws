import { NextApiRequest, NextApiResponse } from 'next'
import { withSecureProjectAccess, ProjectIsolationContext } from 'lib/api/secure-api-wrapper'
import { SupavisorConfigurationService } from 'lib/api/self-hosted/supavisor-configuration-service'
import { SupavisorErrorHandler } from 'lib/api/self-hosted/supavisor-error-handler'

export default withSecureProjectAccess(handler, {
  permissions: { read: true }
})

async function handler(req: NextApiRequest, res: NextApiResponse, context: ProjectIsolationContext) {
  const { method } = req

  switch (method) {
    case 'GET':
      return handleGet(req, res)
    default:
      res.setHeader('Allow', ['GET'])
      res.status(405).json({ data: null, error: { message: `Method ${method} Not Allowed` } })
  }
}

const handleGet = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const { ref: projectRef } = req.query
    
    if (!projectRef || typeof projectRef !== 'string') {
      return res.status(400).json({ 
        data: null, 
        error: { message: 'Project reference is required' } 
      })
    }

    const configService = new SupavisorConfigurationService()
    const healthStatus = await configService.getHealthStatus(projectRef)
    
    // Return appropriate status code based on health
    const statusCode = healthStatus.healthy ? 200 : 503
    
    return res.status(statusCode).json({ 
      data: healthStatus,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    const supavisorError = SupavisorErrorHandler.analyzeError(error)
    
    // Health checks should always return some data, even on error
    const healthStatus = {
      healthy: false,
      message: SupavisorErrorHandler.getUserFriendlyMessage(supavisorError),
      error: {
        type: supavisorError.type,
        suggestions: supavisorError.suggestions
      }
    }
    
    return res.status(503).json({ 
      data: healthStatus,
      timestamp: new Date().toISOString()
    })
  }
}