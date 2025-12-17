import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from 'lib/api/apiWrapper'
import { SupavisorConfigurationService } from 'lib/api/self-hosted/supavisor-configuration-service'
import { SupavisorErrorHandler } from 'lib/api/self-hosted/supavisor-error-handler'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
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
    const stats = await configService.getStatistics(projectRef)
    
    return res.status(200).json({ 
      data: stats,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    const supavisorError = SupavisorErrorHandler.analyzeError(error)
    
    // Map error types to appropriate HTTP status codes
    let statusCode = 500
    switch (supavisorError.type) {
      case 'service-unavailable':
        statusCode = 503 // Service Unavailable
        break
      case 'network-error':
      case 'timeout':
        statusCode = 502 // Bad Gateway
        break
      case 'missing-config':
        statusCode = 422 // Unprocessable Entity
        break
      default:
        statusCode = 500 // Internal Server Error
    }
    
    return res.status(statusCode).json({ 
      data: null, 
      error: { 
        message: SupavisorErrorHandler.getUserFriendlyMessage(supavisorError),
        type: supavisorError.type,
        suggestions: supavisorError.suggestions,
        details: supavisorError.details,
        recoverable: SupavisorErrorHandler.isRecoverable(supavisorError)
      },
      timestamp: new Date().toISOString()
    })
  }
}