import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from 'lib/api/apiWrapper'
import { SupavisorConfigurationService } from 'lib/api/self-hosted/supavisor-configuration-service'

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
    const { ref: projectRef, computeSize } = req.query
    
    if (!projectRef || typeof projectRef !== 'string') {
      return res.status(400).json({ 
        data: null, 
        error: { message: 'Project reference is required' } 
      })
    }

    if (!computeSize || typeof computeSize !== 'string') {
      return res.status(400).json({ 
        data: null, 
        error: { message: 'Compute size is required' } 
      })
    }

    const configService = new SupavisorConfigurationService()
    const recommendations = await configService.getConfigurationRecommendations(computeSize)
    
    return res.status(200).json({ data: recommendations })
  } catch (error) {
    console.error('Error getting Supavisor recommendations:', error)
    return res.status(500).json({ 
      data: null, 
      error: { 
        message: 'Failed to get Supavisor recommendations',
        details: error instanceof Error ? error.message : 'Unknown error'
      } 
    })
  }
}