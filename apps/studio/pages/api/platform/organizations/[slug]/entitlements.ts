import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from 'lib/api/apiWrapper'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req

  switch (method) {
    case 'GET':
      return handleGet(req, res)
    default:
      res.setHeader('Allow', ['GET'])
      res.status(405).json({ error: { message: `Method ${method} Not Allowed` } })
  }
}

async function handleGet(req: NextApiRequest, res: NextApiResponse) {
  const { slug } = req.query

  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({
      error: { message: 'Organization slug is required' }
    })
  }

  // For self-hosted environments, return basic entitlements with proper structure
  // This matches the ListEntitlementsResponse schema
  return res.status(200).json({
    entitlements: [
      {
        feature: {
          key: 'log.retention_days',
          type: 'numeric'
        },
        type: 'numeric',
        hasAccess: true,
        config: {
          enabled: true,
          unlimited: true,
          value: 90,
          unit: 'days'
        }
      },
      {
        feature: {
          key: 'project_limit',
          type: 'numeric'
        },
        type: 'numeric',
        hasAccess: true,
        config: {
          enabled: true,
          unlimited: true,
          value: 100,
          unit: 'projects'
        }
      },
      {
        feature: {
          key: 'database_size',
          type: 'numeric'
        },
        type: 'numeric',
        hasAccess: true,
        config: {
          enabled: true,
          unlimited: true,
          value: -1,
          unit: 'bytes'
        }
      },
      {
        feature: {
          key: 'storage_size',
          type: 'numeric'
        },
        type: 'numeric',
        hasAccess: true,
        config: {
          enabled: true,
          unlimited: true,
          value: -1,
          unit: 'bytes'
        }
      },
      {
        feature: {
          key: 'edge_functions',
          type: 'numeric'
        },
        type: 'numeric',
        hasAccess: true,
        config: {
          enabled: true,
          unlimited: true,
          value: -1,
          unit: 'functions'
        }
      },
      {
        feature: {
          key: 'realtime_connections',
          type: 'numeric'
        },
        type: 'numeric',
        hasAccess: true,
        config: {
          enabled: true,
          unlimited: true,
          value: -1,
          unit: 'connections'
        }
      },
      {
        feature: {
          key: 'auth_users',
          type: 'numeric'
        },
        type: 'numeric',
        hasAccess: true,
        config: {
          enabled: true,
          unlimited: true,
          value: -1,
          unit: 'users'
        }
      }
    ]
  })
}