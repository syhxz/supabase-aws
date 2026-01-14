import { NextApiRequest, NextApiResponse } from 'next'
import { withSecureProjectAccess, ProjectIsolationContext } from 'lib/api/secure-api-wrapper'
import { createDataApiConfigDataAccess } from 'lib/api/data-api-config-data-access'
import { createProjectRestProxy } from 'lib/api/project-rest-proxy'

/**
 * Project-specific REST API proxy
 * Routes: /rest/v1/projects/{projectRef}/* -> Project-specific PostgREST instance
 */
export default withSecureProjectAccess(handler, {
  permissions: { read: true, write: true }
})

async function handler(req: NextApiRequest, res: NextApiResponse, context: ProjectIsolationContext) {
  const { method, query } = req
  const { ref: projectRef, path } = query
  
  try {
    // Check if Data API is enabled for this project
    const dataApiConfigDA = createDataApiConfigDataAccess(context)
    const config = await dataApiConfigDA.getConfiguration()
    
    if (!config.enableDataApi) {
      return res.status(403).json({
        code: 'DATA_API_DISABLED',
        message: 'Data API is disabled for this project',
        hint: 'Enable Data API in project settings to access the REST API'
      })
    }
    
    // Create project-specific REST proxy
    const restProxy = createProjectRestProxy(context, config)
    
    // Construct the target path
    const targetPath = Array.isArray(path) ? path.join('/') : (path || '')
    
    // Proxy the request to the project-specific PostgREST instance
    await restProxy.proxyRequest(req, res, targetPath)
    
  } catch (error) {
    console.error('Project REST API proxy error:', error)
    
    if (error instanceof Error && error.message.includes('DATA_API_DISABLED')) {
      return res.status(403).json({
        code: 'DATA_API_DISABLED',
        message: 'Data API is disabled for this project',
        hint: 'Enable Data API in project settings to access the REST API'
      })
    }
    
    if (error instanceof Error && error.message.includes('PROJECT_NOT_FOUND')) {
      return res.status(404).json({
        code: 'PROJECT_NOT_FOUND',
        message: 'Project not found or access denied',
        hint: 'Verify the project reference and your permissions'
      })
    }
    
    return res.status(500).json({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An error occurred while processing the request',
      hint: 'Please try again or contact support if the issue persists'
    })
  }
}