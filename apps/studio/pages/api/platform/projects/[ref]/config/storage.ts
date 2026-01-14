import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from 'lib/api/apiWrapper'

/**
 * Storage Configuration API
 * GET /api/platform/projects/{ref}/config/storage - Get storage config
 * PUT /api/platform/projects/{ref}/config/storage - Update storage config
 */

interface StorageConfig {
  fileSizeLimit: number
  features: {
    imageTransformation: {
      enabled: boolean
    }
  }
  capabilities: {
    list_v2: boolean
  }
  external: {
    upstreamTarget: string
  }
}

const DEFAULT_CONFIG: StorageConfig = {
  fileSizeLimit: 52428800, // 50MB in bytes
  features: {
    imageTransformation: {
      enabled: true
    }
  },
  capabilities: {
    list_v2: true
  },
  external: {
    upstreamTarget: 'main'
  }
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req

  try {
    switch (method) {
      case 'GET':
        return handleGet(req, res)
      case 'PUT':
        return handlePut(req, res)
      default:
        res.setHeader('Allow', ['GET', 'PUT'])
        return res.status(405).json({ error: `Method ${method} Not Allowed` })
    }
  } catch (error) {
    console.error('Storage config API error:', error)
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

async function handleGet(req: NextApiRequest, res: NextApiResponse) {
  // Return default config
  return res.status(200).json(DEFAULT_CONFIG)
}

async function handlePut(req: NextApiRequest, res: NextApiResponse) {
  const { fileSizeLimit, features } = req.body

  // Validate input
  if (fileSizeLimit !== undefined) {
    if (typeof fileSizeLimit !== 'number' || fileSizeLimit < 0) {
      return res.status(400).json({
        error: 'Invalid fileSizeLimit',
        message: 'fileSizeLimit must be a positive number'
      })
    }
  }

  // Update config
  const updatedConfig: StorageConfig = {
    ...DEFAULT_CONFIG,
    fileSizeLimit: fileSizeLimit ?? DEFAULT_CONFIG.fileSizeLimit,
    features: {
      imageTransformation: {
        enabled: features?.imageTransformation?.enabled ?? DEFAULT_CONFIG.features.imageTransformation.enabled
      }
    }
  }

  return res.status(200).json(updatedConfig)
}

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)
