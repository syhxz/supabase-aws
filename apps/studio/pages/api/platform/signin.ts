import { NextApiRequest, NextApiResponse } from 'next'
import { getGoTrueUrl } from 'common/gotrue-config'

/**
 * Self-hosted signin endpoint
 * 
 * This endpoint allows user authentication in self-hosted mode by directly
 * calling GoTrue's token API with password grant. This ensures the correct
 * GoTrue URL is used at runtime, not build time.
 * 
 * We call the GoTrue HTTP API directly instead of using gotrueClient because
 * gotrueClient is initialized at module load time with build-time environment
 * variables, which means it cannot pick up runtime configuration changes.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const IS_PLATFORM = process.env.NEXT_PUBLIC_IS_PLATFORM === 'true'

  // In platform mode, this endpoint should not be used
  if (IS_PLATFORM) {
    return res.status(404).json({ 
      error: 'This endpoint is only available in self-hosted mode' 
    })
  }

  try {
    const { email, password, captchaToken } = req.body

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email and password are required' 
      })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        error: 'Invalid email format' 
      })
    }

    // Get GoTrue configuration - this reads from runtime environment variables
    const gotrueConfig = getGoTrueUrl()
    
    // Get anon key from environment
    const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!anonKey) {
      console.error('[Signin API] Missing SUPABASE_ANON_KEY environment variable')
      return res.status(500).json({ 
        error: 'Server configuration error. Please contact support.' 
      })
    }
    
    console.log('[Signin API] Attempting to sign in user:', email, 
      `using GoTrue URL: ${gotrueConfig.url} (source: ${gotrueConfig.source})`)

    // Call GoTrue HTTP API directly with runtime URL
    // This uses the password grant type to exchange credentials for a session
    const gotrueUrl = gotrueConfig.url.replace(/\/auth\/v1$/, '') + '/auth/v1/token?grant_type=password'
    
    const gotrueResponse = await fetch(gotrueUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': anonKey,
      },
      body: JSON.stringify({
        email,
        password,
        gotrue_meta_security: captchaToken ? { captcha_token: captchaToken } : undefined,
      }),
    })

    const responseData = await gotrueResponse.json()

    if (!gotrueResponse.ok) {
      console.error('[Signin API] GoTrue signin error:', responseData, 
        `attempted URL: ${gotrueUrl} (source: ${gotrueConfig.source})`)
      
      // Handle specific error cases with user-friendly messages
      const errorMessage = (responseData.error_description || responseData.msg || '').toLowerCase()
      
      if (errorMessage.includes('email not confirmed')) {
        return res.status(400).json({ 
          error: 'Account has not been verified. Please check your email.' 
        })
      }
      
      // Handle invalid credentials - don't reveal which field is incorrect
      if (
        errorMessage.includes('invalid login credentials') ||
        errorMessage.includes('invalid email or password') ||
        errorMessage.includes('email not found') ||
        errorMessage.includes('invalid password')
      ) {
        return res.status(400).json({ 
          error: 'Invalid email or password. Please check your credentials and try again.' 
        })
      }

      return res.status(gotrueResponse.status).json({ 
        error: responseData.error_description || responseData.msg || 'Failed to sign in' 
      })
    }

    console.log('[Signin API] User signed in successfully:', responseData.user?.id)

    // Return success response in the format expected by the client
    return res.status(200).json({
      user: responseData.user,
      session: {
        access_token: responseData.access_token,
        refresh_token: responseData.refresh_token,
        expires_in: responseData.expires_in,
        expires_at: responseData.expires_at,
        token_type: responseData.token_type,
        user: responseData.user,
      },
    })

  } catch (error: any) {
    // Get GoTrue configuration for error reporting
    const gotrueConfig = getGoTrueUrl()
    
    console.error('[Signin API] Unexpected error:', error, 
      `attempted URL: ${gotrueConfig.url} (source: ${gotrueConfig.source})`)
    
    // Check if this is a connection error
    const isConnectionError = 
      error.message?.includes('fetch failed') ||
      error.message?.includes('ECONNREFUSED') ||
      error.message?.includes('ENOTFOUND') ||
      error.message?.includes('ETIMEDOUT') ||
      error.message?.includes('network') ||
      error.code === 'ECONNREFUSED' ||
      error.code === 'ENOTFOUND' ||
      error.code === 'ETIMEDOUT'
    
    if (isConnectionError) {
      // Return user-friendly error for connection failures
      return res.status(503).json({ 
        error: 'Authentication service is currently unavailable. Please try again later.' 
      })
    }
    
    return res.status(500).json({ 
      error: 'An unexpected error occurred during signin. Please try again.' 
    })
  }
}
