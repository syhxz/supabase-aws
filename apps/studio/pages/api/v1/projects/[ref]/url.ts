import { NextApiRequest, NextApiResponse } from 'next'
import { withSecureProjectAccess, ProjectIsolationContext } from 'lib/api/secure-api-wrapper'
import { getProjectSettings } from 'lib/api/self-hosted/settings'

interface ProjectUrlResponse {
  projectUrl: string
  protocol: string
  host: string
  apiVersion: string
}

export default withSecureProjectAccess(handler, {
  permissions: { read: true }
})

async function handler(req: NextApiRequest, res: NextApiResponse, context: ProjectIsolationContext) {
  const { method } = req

  switch (method) {
    case 'GET':
      return handleGet(req, res, context)
    default:
      res.setHeader('Allow', ['GET'])
      res.status(405).json({ 
        data: null, 
        error: { message: `Method ${method} Not Allowed` } 
      })
  }
}

const handleGet = async (
  req: NextApiRequest, 
  res: NextApiResponse, 
  context: ProjectIsolationContext
): Promise<void> => {
  try {
    // Get project settings to construct the URL
    const settings = getProjectSettings()
    
    if (!settings?.app_config?.endpoint) {
      res.status(404).json({ 
        data: null, 
        error: { message: 'Project endpoint not found' } 
      })
      return
    }

    const protocol = settings.app_config.protocol ?? 'https'
    const host = settings.app_config.endpoint
    const apiVersion = 'v1'
    const projectUrl = `${protocol}://${host}/rest/${apiVersion}`

    const response: ProjectUrlResponse = {
      projectUrl,
      protocol,
      host,
      apiVersion
    }

    res.status(200).json({ data: response, error: null })
  } catch (error) {
    console.error('Error fetching project URL:', error)
    res.status(500).json({ 
      data: null, 
      error: { message: 'Failed to fetch project URL' } 
    })
  }
}