import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from 'lib/api/apiWrapper'
import { SupavisorConfigurationService } from 'lib/api/self-hosted/supavisor-configuration-service'
import { SupavisorErrorHandler, type SupavisorError } from 'lib/api/self-hosted/supavisor-error-handler'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req

  switch (method) {
    case 'GET':
      return handleGet(req, res)
    case 'PATCH':
      return handlePatch(req, res)
    default:
      res.setHeader('Allow', ['GET', 'PATCH'])
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
    const config = await configService.getConfiguration(projectRef)
    
    return res.status(200).json({ data: config })
  } catch (error) {
    const supavisorError = SupavisorErrorHandler.analyzeError(error)
    
    // Map error types to appropriate HTTP status codes
    let statusCode = 500
    switch (supavisorError.type) {
      case 'missing-config':
        statusCode = 422 // Unprocessable Entity
        break
      case 'service-unavailable':
        statusCode = 503 // Service Unavailable
        break
      case 'configuration-invalid':
        statusCode = 400 // Bad Request
        break
      case 'network-error':
      case 'timeout':
        statusCode = 502 // Bad Gateway
        break
      case 'permission-denied':
        statusCode = 403 // Forbidden
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
        details: supavisorError.details
      } 
    })
  }
}

const handlePatch = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const { ref: projectRef } = req.query
    const configUpdates = req.body
    
    if (!projectRef || typeof projectRef !== 'string') {
      return res.status(400).json({ 
        data: null, 
        error: { message: 'Project reference is required' } 
      })
    }

    // Validate request body
    if (configUpdates === null || configUpdates === undefined || typeof configUpdates !== 'object' || Array.isArray(configUpdates) || Object.keys(configUpdates).length === 0) {
      return res.status(400).json({ 
        data: null, 
        error: { message: 'Configuration updates are required in request body' } 
      })
    }

    const configService = new SupavisorConfigurationService()
    const updatedConfig = await configService.updateConfiguration(projectRef, configUpdates)
    
    return res.status(200).json({ 
      data: updatedConfig,
      message: 'Configuration updated successfully'
    })
  } catch (error) {
    const supavisorError = SupavisorErrorHandler.analyzeError(error)
    
    // Map error types to appropriate HTTP status codes
    let statusCode = 500
    switch (supavisorError.type) {
      case 'missing-config':
        statusCode = 422 // Unprocessable Entity
        break
      case 'service-unavailable':
        statusCode = 503 // Service Unavailable
        break
      case 'configuration-invalid':
        statusCode = 400 // Bad Request
        break
      case 'network-error':
      case 'timeout':
        statusCode = 502 // Bad Gateway
        break
      case 'permission-denied':
        statusCode = 403 // Forbidden
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
      } 
    })
  }
}