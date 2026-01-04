import { NextApiRequest, NextApiResponse } from 'next'
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
      return handleGet(req, res, context)
    case 'PUT':
    case 'PATCH':
      return handleUpdate(req, res, context)
    case 'DELETE':
      return handleDelete(req, res, context)
    default:
      res.setHeader('Allow', ['GET', 'PUT', 'PATCH', 'DELETE'])
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
) => {
  const { projectRef, projectId } = context
  const { id } = req.query

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ 
      data: null, 
      error: { message: 'Key ID is required' } 
    })
  }

  // Return specific JWT signing key
  // In a real implementation, this would query the database
  const signingKey = {
    id,
    key_id: id,
    algorithm: 'HS256',
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    project_ref: projectRef,
    project_id: projectId,
    is_default: id === 'default-key-1',
  }

  return res.status(200).json(signingKey)
}

const handleUpdate = async (
  req: NextApiRequest, 
  res: NextApiResponse,
  context: ProjectIsolationContext
) => {
  const { projectRef, projectId } = context
  const { id } = req.query
  const { status, algorithm } = req.body

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ 
      data: null, 
      error: { message: 'Key ID is required' } 
    })
  }

  // Update JWT signing key
  // In a real implementation, this would update the database
  const updatedKey = {
    id,
    key_id: id,
    algorithm: algorithm || 'HS256',
    status: status || 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    project_ref: projectRef,
    project_id: projectId,
    is_default: id === 'default-key-1',
  }

  return res.status(200).json(updatedKey)
}

const handleDelete = async (
  req: NextApiRequest, 
  res: NextApiResponse,
  context: ProjectIsolationContext
) => {
  const { projectRef } = context
  const { id } = req.query

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ 
      data: null, 
      error: { message: 'Key ID is required' } 
    })
  }

  // Prevent deletion of default key
  if (id === 'default-key-1') {
    return res.status(400).json({ 
      data: null, 
      error: { message: 'Cannot delete the default signing key' } 
    })
  }

  // Delete JWT signing key
  // In a real implementation, this would delete from the database
  
  return res.status(200).json({ 
    message: `JWT signing key ${id} deleted successfully` 
  })
}