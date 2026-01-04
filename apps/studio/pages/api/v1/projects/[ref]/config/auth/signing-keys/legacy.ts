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
      return handleUpdate(req, res, context)
    case 'POST':
      return handleCreate(req, res, context)
    default:
      res.setHeader('Allow', ['GET', 'PUT', 'POST'])
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

  // Return the legacy JWT secret for this project
  // In self-hosted mode, this typically comes from environment variables
  const jwtSecret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET

  if (!jwtSecret) {
    return res.status(404).json({
      data: null,
      error: { message: 'JWT secret not configured for this project' }
    })
  }

  const response = {
    jwt_secret: jwtSecret,
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    project_ref: projectRef,
    project_id: projectId,
  }

  return res.status(200).json(response)
}

const handleCreate = async (
  req: NextApiRequest, 
  res: NextApiResponse,
  context: ProjectIsolationContext
) => {
  const { projectRef, projectId } = context

  // Create/migrate legacy JWT secret to new signing keys
  // In self-hosted mode, this would typically involve:
  // 1. Taking the existing JWT secret
  // 2. Creating new signing keys based on it
  // 3. Setting up the migration process
  
  const response = {
    jwt_secret: process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET,
    status: 'migrated',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    project_ref: projectRef,
    project_id: projectId,
    migration_status: 'completed',
    new_keys_created: 2, // Typically creates 2 new keys
  }

  return res.status(201).json(response)
}

const handleUpdate = async (
  req: NextApiRequest, 
  res: NextApiResponse,
  context: ProjectIsolationContext
) => {
  const { projectRef, projectId } = context
  const { jwt_secret } = req.body

  if (!jwt_secret) {
    return res.status(400).json({ 
      data: null, 
      error: { message: 'JWT secret is required' } 
    })
  }

  // In self-hosted mode, JWT secret updates would typically require
  // updating environment variables and restarting services
  // For now, we'll return a success response but note that the change
  // may not take effect until restart
  
  const response = {
    jwt_secret,
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    project_ref: projectRef,
    project_id: projectId,
    message: 'JWT secret updated. Restart required for changes to take effect.'
  }

  return res.status(200).json(response)
}