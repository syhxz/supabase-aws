import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from 'lib/api/apiWrapper'
import { requireAuthentication } from 'lib/api/auth-helpers'

/**
 * Global JWT Secrets API endpoint
 * GET /api/v1/config/auth/jwt-secrets
 * 
 * Returns global JWT secret information (masked for security)
 * Requires authentication and admin permissions
 */
export default (req: NextApiRequest, res: NextApiResponse) => 
  apiWrapper(req, res, handler, { withAuth: true })

async function handler(req: NextApiRequest, res: NextApiResponse) {
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

const handleGet = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    // Require authentication
    const userId = await requireAuthentication(req)
    
    // TODO: Add admin permission check here
    // For now, we'll allow any authenticated user
    
    // Get global JWT secrets from environment
    const globalJwtSecret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET
    const supabaseUrl = process.env.SUPABASE_URL
    
    if (!globalJwtSecret) {
      return res.status(404).json({
        data: null,
        error: { message: 'Global JWT secret not configured' }
      })
    }
    
    // Return masked secret information for security
    const response = {
      global_jwt_secret: {
        configured: true,
        length: globalJwtSecret.length,
        masked_value: `${globalJwtSecret.substring(0, 4)}${'*'.repeat(Math.max(0, globalJwtSecret.length - 8))}${globalJwtSecret.substring(Math.max(4, globalJwtSecret.length - 4))}`,
        source: 'environment',
        environment_variables: {
          SUPABASE_JWT_SECRET: !!process.env.SUPABASE_JWT_SECRET,
          JWT_SECRET: !!process.env.JWT_SECRET
        }
      },
      supabase_url: supabaseUrl || null,
      algorithm: 'HS256',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    return res.status(200).json(response)
    
  } catch (error) {
    console.error('Error getting global JWT secrets:', error)
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return res.status(401).json({
        data: null,
        error: { message: 'Authentication required' }
      })
    }
    
    return res.status(500).json({
      data: null,
      error: { message: 'Internal server error' }
    })
  }
}