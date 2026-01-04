import { NextApiRequest, NextApiResponse } from 'next'
import { withSecureProjectAccess, ProjectIsolationContext } from 'lib/api/secure-api-wrapper'
import { validateJwtTokenWithMultipleSources } from 'lib/api/auth-helpers'

/**
 * JWT Token Verification API endpoint
 * POST /api/v1/projects/[ref]/config/auth/jwt-secrets/verify
 * 
 * Verifies a JWT token against project-specific secrets
 * Returns detailed verification information
 */
export default withSecureProjectAccess(handler, {
  permissions: { read: true, manageJwtKeys: true }
})

async function handler(req: NextApiRequest, res: NextApiResponse, context: ProjectIsolationContext) {
  const { method } = req

  switch (method) {
    case 'POST':
      return handleVerify(req, res)
    default:
      res.setHeader('Allow', ['POST'])
      res.status(405).json({ 
        data: null, 
        error: { message: `Method ${method} Not Allowed` } 
      })
  }
}

const handleVerify = async (req: NextApiRequest, res: NextApiResponse, context: ProjectIsolationContext) => {
  const { ref: projectRef } = req.query
  const { jwt_token } = req.body

  if (!projectRef || typeof projectRef !== 'string') {
    return res.status(400).json({ 
      data: null, 
      error: { message: 'Project reference is required' } 
    })
  }

  if (!jwt_token || typeof jwt_token !== 'string') {
    return res.status(400).json({
      data: null,
      error: { message: 'JWT token is required in request body' }
    })
  }

  try {
    // Check if user has permission to verify JWT tokens (already verified by middleware)
    if (context.accessType !== 'owner') {
      return res.status(403).json({
        data: null,
        error: { message: 'Only project owners can verify JWT tokens' }
      })
    }
    
    // Verify the JWT token using multiple sources
    const verification = await validateJwtTokenWithMultipleSources(jwt_token, projectRef)
    
    let response
    
    if (verification.isValid) {
      // Token is valid
      response = {
        project_ref: projectRef,
        verification_result: {
          is_valid: true,
          secret_source: verification.secretSource,
          decoded_payload: {
            sub: verification.decoded.sub,
            iat: verification.decoded.iat,
            exp: verification.decoded.exp,
            iss: verification.decoded.iss,
            aud: verification.decoded.aud,
            role: verification.decoded.role,
            email: verification.decoded.email,
            // Include other common JWT claims
            ...Object.fromEntries(
              Object.entries(verification.decoded).filter(([key]) => 
                !['sub', 'iat', 'exp', 'iss', 'aud', 'role', 'email'].includes(key)
              )
            )
          },
          token_info: {
            algorithm: 'HS256',
            issued_at: verification.decoded.iat ? new Date(verification.decoded.iat * 1000).toISOString() : null,
            expires_at: verification.decoded.exp ? new Date(verification.decoded.exp * 1000).toISOString() : null,
            is_expired: verification.decoded.exp ? verification.decoded.exp < Math.floor(Date.now() / 1000) : false,
            time_to_expiry: verification.decoded.exp ? Math.max(0, verification.decoded.exp - Math.floor(Date.now() / 1000)) : null
          }
        },
        verification_metadata: {
          verified_by: context.userId,
          verified_at: new Date().toISOString(),
          secret_source_used: verification.secretSource
        }
      }
    } else {
      // Token is invalid
      response = {
        project_ref: projectRef,
        verification_result: {
          is_valid: false,
          error: 'JWT token verification failed',
          details: 'Token is either malformed, expired, or signed with an incorrect secret',
          attempted_sources: ['global', 'project-specific', 'legacy']
        },
        verification_metadata: {
          verified_by: context.userId,
          verified_at: new Date().toISOString(),
          all_sources_attempted: true
        }
      }
    }
    
    return res.status(200).json(response)
    
  } catch (error) {
    console.error('Error verifying JWT token:', error)
    
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