import { NextApiRequest, NextApiResponse } from 'next'
import { randomBytes } from 'crypto'
import { withSecureJwtKeyAccess } from 'lib/api/secure-api-wrapper'
import { ProjectIsolationContext } from 'lib/api/project-isolation-middleware'

export default withSecureJwtKeyAccess(handler)

async function handler(
  req: NextApiRequest, 
  res: NextApiResponse,
  context: ProjectIsolationContext
) {
  const { method } = req

  switch (method) {
    case 'GET':
      return handleGetAll(req, res, context)
    case 'POST':
      return handleCreate(req, res, context)
    default:
      res.setHeader('Allow', ['GET', 'POST'])
      res.status(405).json({ 
        data: null, 
        error: { message: `Method ${method} Not Allowed` } 
      })
  }
}

const handleGetAll = async (
  req: NextApiRequest, 
  res: NextApiResponse,
  context: ProjectIsolationContext
) => {
  const { projectRef, projectId } = context

  // Return modern JWT signing keys for this project
  // In a real implementation, these would be stored in a database
  // For self-hosted mode, we provide a basic implementation
  
  const signingKeys = [
    {
      id: 'default-key-1',
      key_id: 'default',
      algorithm: 'HS256',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      project_ref: projectRef,
      project_id: projectId,
      is_default: true,
    }
  ]

  return res.status(200).json(signingKeys)
}

const handleCreate = async (
  req: NextApiRequest, 
  res: NextApiResponse,
  context: ProjectIsolationContext
) => {
  const { projectRef, projectId, userId } = context
  const { algorithm = 'HS256' } = req.body

  // Generate a new signing key
  const keyId = randomBytes(8).toString('hex')
  const id = randomBytes(16).toString('hex')

  const newSigningKey = {
    id,
    key_id: keyId,
    algorithm,
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    project_ref: projectRef,
    project_id: projectId,
    created_by_user_id: userId,
    is_default: false,
  }

  // In a real implementation, this would be stored in a database
  // and the actual key material would be generated and stored securely
  
  return res.status(201).json(newSigningKey)
}