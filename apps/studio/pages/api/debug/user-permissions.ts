import { NextApiRequest, NextApiResponse } from 'next'
import { getCurrentUserId, validateUserProjectAccessByRef } from 'lib/api/auth-helpers'

/**
 * Debug endpoint to test user permission validation
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    console.log('=== Debug User Permissions ===')
    console.log('Headers:', req.headers)
    console.log('Query:', req.query)
    
    // Extract project ref from query
    const projectRef = req.query.projectRef as string
    if (!projectRef) {
      return res.status(400).json({
        error: 'Missing projectRef query parameter'
      })
    }
    
    // Get user ID from JWT token
    const userId = await getCurrentUserId(req, projectRef)
    console.log('User ID from JWT:', userId)
    
    if (!userId) {
      return res.status(401).json({
        error: 'No valid user ID found in JWT token',
        debug: {
          authHeader: req.headers.authorization ? 'present' : 'missing',
          cookies: Object.keys(req.cookies)
        }
      })
    }
    
    // Validate project access
    console.log('Validating project access for:', { userId, projectRef })
    const accessResult = await validateUserProjectAccessByRef(userId, projectRef)
    console.log('Access result:', accessResult)
    
    return res.status(200).json({
      success: true,
      userId,
      projectRef,
      accessResult,
      debug: {
        hasAccess: accessResult.hasAccess,
        accessType: accessResult.accessType,
        reason: accessResult.reason
      }
    })
    
  } catch (error) {
    console.error('Debug endpoint error:', error)
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      debug: {
        stack: error instanceof Error ? error.stack : undefined
      }
    })
  }
}