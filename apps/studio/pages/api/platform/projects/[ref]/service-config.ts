import { NextApiRequest, NextApiResponse } from 'next'
import { getServiceConfigurationManager } from 'lib/service-configuration'

/**
 * API endpoint for managing project service configurations
 * 
 * GET /api/platform/projects/[ref]/service-config
 * - Get service configuration for a project
 * 
 * POST /api/platform/projects/[ref]/service-config
 * - Configure or reconfigure services for a project
 * 
 * DELETE /api/platform/projects/[ref]/service-config
 * - Remove service configuration for a project
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { ref } = req.query

  if (typeof ref !== 'string') {
    return res.status(400).json({ 
      error: { message: 'Project ref is required' } 
    })
  }

  const serviceConfigManager = getServiceConfigurationManager()

  try {
    switch (req.method) {
      case 'GET':
        return await handleGet(req, res, ref, serviceConfigManager)
      case 'POST':
        return await handlePost(req, res, ref, serviceConfigManager)
      case 'DELETE':
        return await handleDelete(req, res, ref, serviceConfigManager)
      default:
        res.setHeader('Allow', ['GET', 'POST', 'DELETE'])
        return res.status(405).json({ 
          error: { message: `Method ${req.method} not allowed` } 
        })
    }
  } catch (error: any) {
    console.error(`Service config API error for project ${ref}:`, error)
    return res.status(500).json({ 
      error: { message: error.message || 'Internal server error' } 
    })
  }
}

/**
 * Handle GET request - get service configuration
 */
async function handleGet(
  req: NextApiRequest,
  res: NextApiResponse,
  projectRef: string,
  serviceConfigManager: any
) {
  const config = await serviceConfigManager.getProjectServiceConfig(projectRef)

  if (!config) {
    return res.status(404).json({ 
      error: { message: 'Service configuration not found' } 
    })
  }

  // Include authentication failure logs if requested
  const includeLogs = req.query.include_logs === 'true'
  const response: any = {
    projectRef: config.projectRef,
    databaseName: config.databaseName,
    databaseUser: config.databaseUser,
    services: Object.fromEntries(
      Object.entries(config.services).map(([name, serviceConfig]: [string, any]) => [
        name,
        {
          enabled: serviceConfig.enabled,
          lastUpdated: serviceConfig.lastUpdated,
          errorCount: serviceConfig.errorCount,
          lastError: serviceConfig.lastError
        }
      ])
    )
  }

  if (includeLogs) {
    response.authFailureLogs = serviceConfigManager.getAuthFailureLogs(projectRef, 20)
  }

  return res.status(200).json(response)
}

/**
 * Handle POST request - configure or reconfigure services
 */
async function handlePost(
  req: NextApiRequest,
  res: NextApiResponse,
  projectRef: string,
  serviceConfigManager: any
) {
  const result = await serviceConfigManager.configureProjectServices(projectRef)

  const response = {
    success: result.success,
    updatedServices: result.updatedServices,
    errors: result.errors,
    message: result.success 
      ? 'Services configured successfully'
      : 'Some services failed to configure'
  }

  const statusCode = result.success ? 200 : 207 // 207 Multi-Status for partial success
  return res.status(statusCode).json(response)
}

/**
 * Handle DELETE request - remove service configuration
 */
async function handleDelete(
  req: NextApiRequest,
  res: NextApiResponse,
  projectRef: string,
  serviceConfigManager: any
) {
  await serviceConfigManager.removeProjectServiceConfig(projectRef)

  return res.status(200).json({ 
    message: 'Service configuration removed successfully' 
  })
}