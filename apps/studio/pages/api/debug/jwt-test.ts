import { NextApiRequest, NextApiResponse } from 'next'
import jwt from 'jsonwebtoken'

/**
 * Debug endpoint to test JWT verification directly
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const debugInfo: any = {
    timestamp: new Date().toISOString(),
    environment: {
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_API_URL: process.env.SUPABASE_API_URL,
      GOTRUE_JWT_ISSUER: process.env.GOTRUE_JWT_ISSUER,
      SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET ? 'SET' : 'NOT_SET',
      JWT_SECRET: process.env.JWT_SECRET ? 'SET' : 'NOT_SET',
      NODE_ENV: process.env.NODE_ENV
    }
  }

  try {
    // Extract JWT token
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      debugInfo.error = 'No Bearer token found'
      return res.status(200).json(debugInfo)
    }

    const token = authHeader.substring(7).trim()
    debugInfo.tokenLength = token.length

    // Decode token without verification first
    const decoded = jwt.decode(token) as any
    debugInfo.decodedPayload = decoded

    // Build valid issuers list (same logic as auth-helpers.ts)
    const validIssuers: string[] = []
    if (process.env.SUPABASE_URL) {
      validIssuers.push(process.env.SUPABASE_URL)
    }
    if (process.env.SUPABASE_API_URL) {
      validIssuers.push(process.env.SUPABASE_API_URL)
    }
    if (process.env.GOTRUE_JWT_ISSUER) {
      validIssuers.push(process.env.GOTRUE_JWT_ISSUER)
    }
    if (process.env.NODE_ENV === 'development') {
      validIssuers.push('http://localhost:8000')
    }

    debugInfo.validIssuers = validIssuers
    debugInfo.tokenIssuer = decoded?.iss
    debugInfo.issuerMatch = validIssuers.includes(decoded?.iss)

    // Try JWT verification with global secret
    const globalJwtSecret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET
    debugInfo.hasGlobalSecret = !!globalJwtSecret

    if (globalJwtSecret) {
      try {
        // Try without issuer validation first
        const verifiedWithoutIssuer = jwt.verify(token, globalJwtSecret, {
          algorithms: ['HS256']
        })
        debugInfo.verificationWithoutIssuer = {
          success: true,
          sub: (verifiedWithoutIssuer as any)?.sub
        }
      } catch (error) {
        debugInfo.verificationWithoutIssuer = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }

      // Try with issuer validation
      try {
        const verifyOptions: jwt.VerifyOptions = {
          algorithms: ['HS256']
        }

        if (validIssuers.length > 0) {
          verifyOptions.issuer = validIssuers.length === 1 ? validIssuers[0] : validIssuers as [string, ...string[]]
        }

        const verifiedWithIssuer = jwt.verify(token, globalJwtSecret, verifyOptions)
        debugInfo.verificationWithIssuer = {
          success: true,
          sub: (verifiedWithIssuer as any)?.sub,
          verifyOptions
        }
      } catch (error) {
        debugInfo.verificationWithIssuer = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          verifyOptions: {
            algorithms: ['HS256'],
            issuer: validIssuers.length > 0 ? (validIssuers.length === 1 ? validIssuers[0] : validIssuers) : undefined
          }
        }
      }
    }

    return res.status(200).json(debugInfo)

  } catch (error) {
    debugInfo.error = {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }
    
    return res.status(200).json(debugInfo)
  }
}