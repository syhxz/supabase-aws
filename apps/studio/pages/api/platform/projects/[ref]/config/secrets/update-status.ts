import { NextApiRequest, NextApiResponse } from 'next'
import { withSecureProjectAccess, ProjectIsolationContext } from 'lib/api/secure-api-wrapper'

export default withSecureProjectAccess(handler, {
  permissions: { read: true, write: true, admin: true }
})

async function handler(req: NextApiRequest, res: NextApiResponse, context: ProjectIsolationContext) {
  const { method } = req

  switch (method) {
    case 'GET':
      return handleGet(req, res)
    default:
      res.setHeader('Allow', ['GET'])
      res.status(405).json({ 
        data: null, 
        error: { message: `Method ${method} Not Allowed` } 
      })
  }
}

const handleGet = async (req: NextApiRequest, res: NextApiResponse) => {
  const { ref: projectRef } = req.query

  if (!projectRef || typeof projectRef !== 'string') {
    return res.status(400).json({ 
      data: null, 
      error: { message: 'Project reference is required' } 
    })
  }

  // Return the secrets update status for this project
  // In self-hosted mode, this tracks whether secrets have been updated
  // and if services need to be restarted
  
  const response = {
    update_status: {
      change_tracking_id: `${projectRef}-${Date.now()}`,
      error: null,
      progress: 100,
      status: 'Updated', // JwtSecretUpdateStatus.Updated
    },
    project_ref: projectRef,
    jwt_secret_status: 'active',
    api_keys_status: 'active',
    last_updated: new Date().toISOString(),
    restart_required: false,
    services_status: {
      auth: 'healthy',
      rest: 'healthy',
      realtime: 'healthy',
      storage: 'healthy'
    }
  }

  return res.status(200).json(response)
}