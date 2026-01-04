import { NextApiRequest, NextApiResponse } from 'next'
import { withSecureProjectAccess, ProjectIsolationContext } from 'lib/api/secure-api-wrapper'
import { getProjectLegacyJwtSecret } from 'lib/api/auth-helpers'

/**
 * Reveal Project JWT Secret API endpoint
 * POST /api/v1/projects/[ref]/config/auth/jwt-secrets/reveal
 * 
 * Returns the actual JWT secret value (DANGEROUS - use with caution)
 * Requires authentication, project ownership, and explicit confirmation
 * 
 * This endpoint should only be used for:
 * - Development and debugging
 * - Migration purposes
 * - Administrative tasks
 * 
 * SECURITY WARNING: This endpoint returns sensitive cryptographic material
 */
export default withSecureProjectAccess(handler, {
  permissions: { read: true, manageJwtKeys: true }
})

async function handler(req: NextApiRequest, res: NextApiResponse, context: ProjectIsolationContext) {
  const { method } = req

  switch (method) {
    case 'POST':
      return handleReveal(req, res)
    default:
      res.setHeader('Allow', ['POST'])
      res.status(405).json({ 
        data: null, 
        error: { message: `Method ${method} Not Allowed` } 
      })
  }
}

const handleReveal = async (req: NextApiRequest, res: NextApiResponse, context: ProjectIsolationContext) => {
  const { ref: projectRef } = req.query
  const { confirm_reveal, purpose } = req.body

  if (!projectRef || typeof projectRef !== 'string') {
    return res.status(400).json({ 
      data: null, 
      error: { message: 'Project reference is required' } 
    })
  }

  // Require explicit confirmation
  if (confirm_reveal !== true) {
    return res.status(400).json({
      data: null,
      error: { 
        message: 'Explicit confirmation required',
        details: 'Set confirm_reveal: true in request body to proceed'
      }
    })
  }

  // Require purpose statement
  if (!purpose || typeof purpose !== 'string' || purpose.trim().length < 10) {
    return res.status(400).json({
      data: null,
      error: { 
        message: 'Purpose statement required',
        details: 'Provide a detailed purpose (minimum 10 characters) for accessing the JWT secret'
      }
    })
  }

  try {
    // Only project owners can reveal JWT secrets (already verified by middleware)
    if (context.accessType !== 'owner') {
      return res.status(403).json({
        data: null,
        error: { message: 'Only project owners can reveal JWT secrets' }
      })
    }
    
    // Additional security check - require admin environment variable
    const allowReveal = process.env.ALLOW_JWT_SECRET_REVEAL === 'true'
    if (!allowReveal) {
      return res.status(403).json({
        data: null,
        error: { 
          message: 'JWT secret reveal is disabled',
          details: 'Set ALLOW_JWT_SECRET_REVEAL=true environment variable to enable this feature'
        }
      })
    }
    
    // Get JWT secrets
    const globalJwtSecret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET
    const projectSpecificSecret = process.env[`JWT_SECRET_${projectRef.toUpperCase()}`] || 
                                  process.env[`SUPABASE_JWT_SECRET_${projectRef.toUpperCase()}`]
    const legacySecret = await getProjectLegacyJwtSecret(projectRef)
    
    // Determine active secret
    let activeSecret = globalJwtSecret
    let activeSource = 'global'
    
    if (projectSpecificSecret) {
      activeSecret = projectSpecificSecret
      activeSource = 'project-specific'
    } else if (legacySecret && legacySecret !== globalJwtSecret) {
      activeSecret = legacySecret
      activeSource = 'legacy'
    }
    
    if (!activeSecret) {
      return res.status(404).json({
        data: null,
        error: { message: 'No JWT secret configured for this project' }
      })
    }
    
    // Log the access for security audit
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress
    const userAgent = req.headers['user-agent']
    
    console.warn('JWT SECRET REVEALED - SECURITY AUDIT LOG', {
      userId: context.userId,
      projectRef,
      purpose: purpose.trim(),
      activeSource,
      ip,
      userAgent,
      timestamp: new Date().toISOString(),
      warning: 'SENSITIVE CRYPTOGRAPHIC MATERIAL ACCESSED'
    })
    
    const response = {
      project_ref: projectRef,
      revealed_secret: {
        value: activeSecret,
        source: activeSource,
        algorithm: 'HS256',
        length: activeSecret.length
      },
      security_warning: 'This secret should be kept confidential and secure',
      access_log: {
        user_id: context.userId,
        purpose: purpose.trim(),
        timestamp: new Date().toISOString(),
        ip_address: typeof ip === 'string' ? ip : Array.isArray(ip) ? ip[0] : 'unknown'
      },
      usage_instructions: {
        environment_variable: `SUPABASE_JWT_SECRET=${activeSecret}`,
        verification_command: 'Use this secret to verify JWT tokens for this project',
        security_note: 'Store this secret securely and never expose it in client-side code'
      }
    }
    
    return res.status(200).json(response)
    
  } catch (error) {
    console.error('Error revealing project JWT secret:', error)
    
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