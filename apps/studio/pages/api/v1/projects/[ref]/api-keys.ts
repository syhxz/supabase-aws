import { NextApiRequest, NextApiResponse } from 'next'
import { randomBytes } from 'crypto'

import { components } from 'api-types'
import { withSecureApiKeyAccess, ProjectIsolationContext } from 'lib/api/secure-api-wrapper'
import { createApiKeysDataAccess } from 'lib/api/api-keys-data-access'

type ProjectAppConfig = components['schemas']['ProjectSettingsResponse']['app_config'] & {
  protocol?: string
}
export type ProjectSettings = components['schemas']['ProjectSettingsResponse'] & {
  app_config?: ProjectAppConfig
}

export default withSecureApiKeyAccess(handler)

async function handler(req: NextApiRequest, res: NextApiResponse, context: ProjectIsolationContext) {
  const { method } = req

  switch (method) {
    case 'GET':
      return handleGetAll(req, res, context)
    case 'POST':
      return handleCreate(req, res, context)
    default:
      res.setHeader('Allow', ['GET', 'POST'])
      res.status(405).json({ data: null, error: { message: `Method ${method} Not Allowed` } })
  }
}

const handleGetAll = async (req: NextApiRequest, res: NextApiResponse, context: ProjectIsolationContext) => {
  // Create data access layer with automatic project filtering
  const apiKeysDA = createApiKeysDataAccess(context)

  // Get all keys for this project - automatically filtered by project_id
  const keys = await apiKeysDA.getAllKeys({ revealKey: true })

  // Return the data - middleware will validate and send it
  return keys
}

const handleCreate = async (req: NextApiRequest, res: NextApiResponse, context: ProjectIsolationContext) => {
  const { name, description, type } = req.body

  if (!name || !type) {
    return res.status(400).json({ 
      data: null, 
      error: { message: 'Name and type are required' } 
    })
  }

  if (type !== 'secret' && type !== 'publishable') {
    return res.status(400).json({ 
      data: null, 
      error: { message: 'Type must be either "secret" or "publishable"' } 
    })
  }

  // Generate a secure API key
  const keyLength = type === 'secret' ? 64 : 32
  const apiKey = `sb_${type}_${randomBytes(keyLength).toString('hex')}`
  const hash = randomBytes(16).toString('hex')
  const prefix = apiKey.substring(0, 12)
  const id = randomBytes(8).toString('hex')

  // Create data access layer with automatic project association
  const apiKeysDA = createApiKeysDataAccess(context)

  // Create the key - automatically associates with project_id and created_by_user_id
  const newApiKey = await apiKeysDA.createKey({
    id,
    name,
    type,
    api_key: apiKey,
    hash,
    prefix,
    description: description || null,
    secret_jwt_template: type === 'secret' ? { role: 'service_role' } : null,
  })

  // Set status code and return data - middleware will send it
  res.status(201)
  return newApiKey
}
