import { NextApiRequest, NextApiResponse } from 'next'

import { withSecureApiKeyAccess, ProjectIsolationContext } from 'lib/api/secure-api-wrapper'
import { createApiKeysDataAccess } from 'lib/api/api-keys-data-access'

export default withSecureApiKeyAccess(handler)

async function handler(req: NextApiRequest, res: NextApiResponse, context: ProjectIsolationContext) {
  const { method } = req

  switch (method) {
    case 'GET':
      return handleGet(req, res, context)
    case 'DELETE':
      return handleDelete(req, res, context)
    default:
      res.setHeader('Allow', ['GET', 'DELETE'])
      res.status(405).json({ data: null, error: { message: `Method ${method} Not Allowed` } })
  }
}

const handleGet = async (req: NextApiRequest, res: NextApiResponse, context: ProjectIsolationContext) => {
  const { id } = req.query
  const { reveal } = req.query

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ 
      data: null, 
      error: { message: 'API key ID is required' } 
    })
  }

  // Create data access layer with automatic project filtering
  const apiKeysDA = createApiKeysDataAccess(context)

  // Get the key - automatically validates project ownership
  const key = await apiKeysDA.getKeyById(id, { revealKey: reveal === 'true' })

  if (!key) {
    return res.status(404).json({ 
      data: null, 
      error: { message: 'API key not found' } 
    })
  }

  return res.status(200).json(key)
}

const handleDelete = async (req: NextApiRequest, res: NextApiResponse, context: ProjectIsolationContext) => {
  const { id } = req.query

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ 
      data: null, 
      error: { message: 'API key ID is required' } 
    })
  }

  // Create data access layer with automatic project filtering
  const apiKeysDA = createApiKeysDataAccess(context)

  try {
    // Delete the key - automatically validates project ownership
    const deleted = await apiKeysDA.deleteKey(id)

    if (!deleted) {
      return res.status(404).json({ 
        data: null, 
        error: { message: 'API key not found' } 
      })
    }

    return res.status(200).json({ 
      message: `API key ${id} deleted successfully`,
      project_id: context.projectId,
      deleted_by_user_id: context.userId
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Cannot delete legacy')) {
      return res.status(400).json({ 
        data: null, 
        error: { message: error.message } 
      })
    }
    throw error
  }
}