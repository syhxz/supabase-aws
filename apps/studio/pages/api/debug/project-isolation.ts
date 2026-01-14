import { NextApiRequest, NextApiResponse } from 'next'
import { withSecureProjectAccess, ProjectIsolationContext } from 'lib/api/secure-api-wrapper'

/**
 * Debug endpoint to test project isolation middleware
 */
async function handler(req: NextApiRequest, res: NextApiResponse, context: ProjectIsolationContext) {
  console.log('=== PROJECT ISOLATION DEBUG ===')
  console.log('Request URL:', req.url)
  console.log('Request method:', req.method)
  console.log('Request headers:', JSON.stringify(req.headers, null, 2))
  console.log('Request query:', JSON.stringify(req.query, null, 2))
  
  console.log('=== PROJECT CONTEXT ===')
  console.log('Project Ref:', context.projectRef)
  console.log('Project ID:', context.projectId)
  console.log('User ID:', context.userId)
  console.log('Access Result:', JSON.stringify(context.accessResult, null, 2))
  console.log('Permissions:', JSON.stringify(context.permissions, null, 2))
  
  return res.status(200).json({
    success: true,
    message: 'Project isolation middleware working correctly!',
    context: {
      projectRef: context.projectRef,
      projectId: context.projectId,
      userId: context.userId,
      accessResult: context.accessResult,
      permissions: context.permissions
    },
    request: {
      url: req.url,
      method: req.method,
      query: req.query
    }
  })
}

export default withSecureProjectAccess(handler, {
  permissions: { read: true }
})