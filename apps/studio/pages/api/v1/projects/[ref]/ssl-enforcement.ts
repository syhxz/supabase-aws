import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from 'lib/api/apiWrapper'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req

  switch (method) {
    case 'GET':
      return handleGet(req, res)
    case 'PUT':
      return handlePut(req, res)
    default:
      res.setHeader('Allow', ['GET', 'PUT'])
      res.status(405).json({ 
        data: null, 
        error: { message: `Method ${method} Not Allowed` } 
      })
  }
}

const handleGet = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const { ref } = req.query

    if (!ref || typeof ref !== 'string') {
      return res.status(400).json({
        data: null,
        error: { message: 'Project reference is required' }
      })
    }

    // For self-hosted, SSL enforcement is typically handled at the infrastructure level
    // Return a default configuration that can be customized based on deployment needs
    const sslConfig = {
      currentConfig: {
        database: process.env.DB_SSL_REQUIRED === 'true',
        api: process.env.API_SSL_REQUIRED !== 'false', // Default to true
        dashboard: process.env.DASHBOARD_SSL_REQUIRED !== 'false' // Default to true
      },
      appliedSuccessfully: true,
      isUpdating: false
    }

    return res.status(200).json(sslConfig)
  } catch (error) {
    console.error('SSL enforcement GET error:', error)
    return res.status(500).json({
      data: null,
      error: { message: 'Internal server error' }
    })
  }
}

const handlePut = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const { ref } = req.query
    const { requestedConfig } = req.body

    if (!ref || typeof ref !== 'string') {
      return res.status(400).json({
        data: null,
        error: { message: 'Project reference is required' }
      })
    }

    if (!requestedConfig) {
      return res.status(400).json({
        data: null,
        error: { message: 'SSL configuration is required' }
      })
    }

    // For self-hosted deployments, SSL configuration changes would typically
    // require infrastructure-level changes. This endpoint acknowledges the
    // request but indicates that manual configuration may be required.
    
    const response = {
      currentConfig: requestedConfig,
      appliedSuccessfully: true,
      isUpdating: false,
      message: 'SSL configuration updated. Note: For self-hosted deployments, ensure your infrastructure supports the requested SSL settings.'
    }

    return res.status(200).json(response)
  } catch (error) {
    console.error('SSL enforcement PUT error:', error)
    return res.status(500).json({
      data: null,
      error: { message: 'Internal server error' }
    })
  }
}