import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from 'lib/api/apiWrapper'
import { DockerContainerService } from 'lib/api/self-hosted/docker-container-service'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req

  switch (method) {
    case 'GET':
      return handleGet(req, res)
    case 'POST':
      return handlePost(req, res)
    default:
      res.setHeader('Allow', ['GET', 'POST'])
      res.status(405).json({ data: null, error: { message: `Method ${method} Not Allowed` } })
  }
}

const handleGet = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const { ref: projectRef, container, action } = req.query
    
    if (!projectRef || typeof projectRef !== 'string') {
      return res.status(400).json({ 
        data: null, 
        error: { message: 'Project reference is required' } 
      })
    }

    const dockerService = new DockerContainerService()

    if (action === 'logs' && container && typeof container === 'string') {
      // Get container logs
      const lines = parseInt(req.query.lines as string || '100', 10)
      const logs = await dockerService.getContainerLogs(container, lines)
      
      return res.status(200).json({ 
        data: { 
          container,
          logs,
          timestamp: new Date().toISOString()
        }
      })
    }

    if (action === 'health' && container && typeof container === 'string') {
      // Get container health
      const health = await dockerService.getContainerHealth(container)
      
      return res.status(200).json({ 
        data: { 
          container,
          health,
          timestamp: new Date().toISOString()
        }
      })
    }

    if (container && typeof container === 'string') {
      // Get specific container status
      const status = await dockerService.getContainerStatus(container)
      
      return res.status(200).json({ 
        data: status,
        timestamp: new Date().toISOString()
      })
    }

    // Get all Supabase containers status
    const containers = await dockerService.getSupabaseContainersStatus()
    
    return res.status(200).json({ 
      data: containers,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Docker containers API error:', error)
    
    return res.status(500).json({ 
      data: null,
      error: { 
        message: error instanceof Error ? error.message : 'Failed to get container status',
        type: 'docker_error'
      }
    })
  }
}

const handlePost = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const { ref: projectRef } = req.query
    const { container, action } = req.body
    
    if (!projectRef || typeof projectRef !== 'string') {
      return res.status(400).json({ 
        data: null, 
        error: { message: 'Project reference is required' } 
      })
    }

    if (!container || typeof container !== 'string') {
      return res.status(400).json({ 
        data: null, 
        error: { message: 'Container name is required' } 
      })
    }

    if (!action || !['start', 'stop', 'restart'].includes(action)) {
      return res.status(400).json({ 
        data: null, 
        error: { message: 'Valid action (start, stop, restart) is required' } 
      })
    }

    const dockerService = new DockerContainerService()
    let result: { success: boolean; message: string }

    switch (action) {
      case 'start':
        result = await dockerService.startContainer(container)
        break
      case 'stop':
        result = await dockerService.stopContainer(container)
        break
      case 'restart':
        result = await dockerService.restartContainer(container)
        break
      default:
        throw new Error(`Unsupported action: ${action}`)
    }

    const statusCode = result.success ? 200 : 500
    
    return res.status(statusCode).json({ 
      data: {
        container,
        action,
        success: result.success,
        message: result.message
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Docker container action error:', error)
    
    return res.status(500).json({ 
      data: null,
      error: { 
        message: error instanceof Error ? error.message : 'Container action failed',
        type: 'docker_action_error'
      }
    })
  }
}