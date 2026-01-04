import { NextApiRequest, NextApiResponse } from 'next'
import { withSecureProjectAccess, ProjectIsolationContext } from 'lib/api/secure-api-wrapper'
import { getProjectLegacyJwtSecret } from 'lib/api/auth-helpers'

/**
 * Project-specific JWT Secrets API endpoint
 * GET /api/v1/projects/[ref]/config/auth/jwt-secrets
 * 
 * Returns project-specific JWT secret information (masked for security)
 * Requires authentication and project access permissions
 */
export default withSecureProjectAccess(handler, {
  permissions: { read: true, manageJwtKeys: true }
})

async function handler(req: NextApiRequest, res: NextApiResponse, context: ProjectIsolationContext) {
  const { method } = req

  switch (method) {
    case 'GET':
      return handleGet(req, res)
    default:
      res.setHeader('Allow', ['GET'])
      res.status(405).json({ 
        data: null, 
        error: { message: `Method ${method} Not Allowed` } 
      })
  }
}

const handleGet = async (req: NextApiRequest, res: NextApiResponse, context: ProjectIsolationContext) => {
  const { ref: projectRef } = req.query

  if (!projectRef || typeof projectRef !== 'string') {
    return res.status(400).json({ 
      data: null, 
      error: { message: 'Project reference is required' } 
    })
  }

  try {
    // Check if user has permission to manage JWT keys (already verified by middleware)
    if (context.accessType !== 'owner') {
      return res.status(403).json({
        data: null,
        error: { message: 'Only project owners can access JWT secrets' }
      })
    }
    
    // Get various JWT secret sources
    const globalJwtSecret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET
    const projectSpecificSecret = process.env[`JWT_SECRET_${projectRef.toUpperCase()}`] || 
                                  process.env[`SUPABASE_JWT_SECRET_${projectRef.toUpperCase()}`]
    const legacySecret = await getProjectLegacyJwtSecret(projectRef)
    
    // Determine which secret would be used for this project
    let activeSecret = globalJwtSecret
    let activeSource = 'global'
    
    if (projectSpecificSecret) {
      activeSecret = projectSpecificSecret
      activeSource = 'project-specific'
    } else if (legacySecret && legacySecret !== globalJwtSecret) {
      activeSecret = legacySecret
      activeSource = 'legacy'
    }
    
    const response = {
      project_ref: projectRef,
      active_jwt_secret: activeSecret ? {
        configured: true,
        length: activeSecret.length,
        masked_value: maskSecret(activeSecret),
        source: activeSource,
        algorithm: 'HS256'
      } : null,
      available_sources: {
        global: {
          configured: !!globalJwtSecret,
          length: globalJwtSecret?.length || 0,
          masked_value: globalJwtSecret ? maskSecret(globalJwtSecret) : null,
          environment_variables: {
            SUPABASE_JWT_SECRET: !!process.env.SUPABASE_JWT_SECRET,
            JWT_SECRET: !!process.env.JWT_SECRET
          }
        },
        project_specific: {
          configured: !!projectSpecificSecret,
          length: projectSpecificSecret?.length || 0,
          masked_value: projectSpecificSecret ? maskSecret(projectSpecificSecret) : null,
          environment_variables: {
            [`JWT_SECRET_${projectRef.toUpperCase()}`]: !!process.env[`JWT_SECRET_${projectRef.toUpperCase()}`],
            [`SUPABASE_JWT_SECRET_${projectRef.toUpperCase()}`]: !!process.env[`SUPABASE_JWT_SECRET_${projectRef.toUpperCase()}`]
          }
        },
        legacy: {
          configured: !!legacySecret,
          length: legacySecret?.length || 0,
          masked_value: legacySecret ? maskSecret(legacySecret) : null,
          source: 'project_settings'
        }
      },
      priority_order: ['global', 'project-specific', 'legacy'],
      user_access: {
        user_id: context.userId,
        access_type: context.accessType,
        organization_id: context.organizationId
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    return res.status(200).json(response)
    
  } catch (error) {
    console.error('Error getting project JWT secrets:', error)
    
    if (error instanceof Error) {
      if (error.message === 'Authentication required') {
        return res.status(401).json({
          data: null,
          error: { message: 'Authentication required' }
        })
      }
      
      if (error.message.includes('Access denied')) {
        return res.status(403).json({
          data: null,
          error: { message: error.message }
        })
      }
    }
    
    return res.status(500).json({
      data: null,
      error: { message: 'Internal server error' }
    })
  }
}

/**
 * Mask a secret string for security display
 * Shows first 4 and last 4 characters, masks the middle
 */
function maskSecret(secret: string): string {
  if (secret.length <= 8) {
    return '*'.repeat(secret.length)
  }
  
  const start = secret.substring(0, 4)
  const end = secret.substring(secret.length - 4)
  const middle = '*'.repeat(Math.max(0, secret.length - 8))
  
  return `${start}${middle}${end}`
}