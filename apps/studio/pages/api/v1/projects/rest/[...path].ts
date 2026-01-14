import { NextApiRequest, NextApiResponse } from 'next'
import { withSecureProjectAccess, ProjectIsolationContext } from 'lib/api/secure-api-wrapper'
import { createDataApiConfigDataAccess } from 'lib/api/data-api-config-data-access'
import { createProjectRestProxy } from 'lib/api/project-rest-proxy'

/**
 * Project-specific REST API proxy (Kong route handler)
 * Routes: /rest/v1/projects/{projectRef}/* -> /api/v1/projects/rest/{projectRef}/*
 * 
 * This endpoint proxies requests to PostgREST with project-specific database configuration
 */
async function handler(req: NextApiRequest, res: NextApiResponse, context: ProjectIsolationContext) {
  const { query } = req
  const { path } = query
  
  try {
    // Extract project ref and target path from the URL
    // Kong transforms /rest/v1/projects/{projectRef}/table to /api/v1/projects/rest/{projectRef}/table
    const pathArray = Array.isArray(path) ? path : [path || '']
    
    console.log('Project REST API Debug:', {
      url: req.url,
      query: req.query,
      path,
      pathArray,
      context: {
        projectRef: context.projectRef,
        projectId: context.projectId,
        userId: context.userId
      }
    })
    
    // SUCCESS: If we reach this point, the project isolation middleware worked!
    console.log('SUCCESS: Project isolation middleware passed, context available:', {
      projectRef: context.projectRef,
      projectId: context.projectId,
      userId: context.userId,
      permissions: context.permissions,
      accessResult: context.accessResult
    })
    
    if (pathArray.length < 1) {
      return res.status(400).json({
        code: 'INVALID_PATH',
        message: 'Project reference is required in the path',
        hint: 'Use /rest/v1/projects/{projectRef}/table format'
      })
    }
    
    const projectRef = pathArray[0]
    const targetPath = pathArray.slice(1).join('/')
    
    // Verify that the project ref matches the context
    if (projectRef !== context.projectRef) {
      console.warn('Project ref mismatch:', { pathProjectRef: projectRef, contextProjectRef: context.projectRef })
      return res.status(400).json({
        code: 'PROJECT_REF_MISMATCH',
        message: 'Project reference in path does not match authenticated project',
        hint: 'Ensure the project reference in the URL is correct',
        debug: {
          pathProjectRef: projectRef,
          contextProjectRef: context.projectRef
        }
      })
    }
    
    // Check if Data API is enabled for this project
    const dataApiConfigDA = createDataApiConfigDataAccess(context)
    const config = await dataApiConfigDA.getConfiguration()
    
    console.log('Data API Configuration:', {
      enableDataApi: config.enableDataApi,
      exposedSchemas: config.exposedSchemas,
      maxRows: config.maxRows
    })
    
    if (!config.enableDataApi) {
      return res.status(403).json({
        code: 'DATA_API_DISABLED',
        message: 'Data API is disabled for this project',
        hint: 'Enable Data API in project settings to access the REST API'
      })
    }
    
    // Create project REST proxy and forward the request to PostgREST
    const restProxy = createProjectRestProxy(context, config)
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
      hint: 'Please try again or contact support if the issue persists',
      debug: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

export default withSecureProjectAccess(handler, {
  permissions: { read: true, write: true }
})