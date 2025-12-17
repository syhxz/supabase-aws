/**
 * Authentication helpers for API routes
 */

import { NextApiRequest } from 'next'
import { gotrueClient } from 'common'

/**
 * Gets the current user ID from the request
 * 
 * This extracts the user ID from the Authorization header JWT token.
 * Returns null if no valid session is found.
 */
export async function getCurrentUserId(req: NextApiRequest): Promise<string | null> {
  try {
    console.log('[Auth] ========== AUTH START ==========')
    
    // Get the authorization header
    const authHeader = req.headers.authorization
    console.log('[Auth] Authorization header present:', !!authHeader)
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[Auth] No valid authorization header found')
      return null
    }

    // Extract the token
    const token = authHeader.substring(7)
    console.log('[Auth] Token length:', token.length)
    console.log('[Auth] Token preview:', token.substring(0, 20) + '...')
    
    // Get user from token
    console.log('[Auth] Calling gotrueClient.getUser...')
    const { data, error } = await gotrueClient.getUser(token)
    
    console.log('[Auth] GoTrue response:', {
      hasData: !!data,
      hasUser: !!data?.user,
      hasError: !!error,
      errorMessage: error?.message,
      userId: data?.user?.id
    })
    
    if (error || !data.user) {
      console.warn('[Auth] Failed to get user from token:', error?.message)
      return null
    }

    console.log('[Auth] Successfully extracted user ID:', data.user.id)
    console.log('[Auth] ========== AUTH SUCCESS ==========')
    return data.user.id
  } catch (error) {
    console.error('[Auth] Error getting current user ID:', error)
    console.log('[Auth] ========== AUTH ERROR ==========')
    return null
  }
}

/**
 * Gets the current user from the request
 * 
 * Returns the full user object if authenticated, null otherwise.
 */
export async function getCurrentUser(req: NextApiRequest) {
  try {
    const authHeader = req.headers.authorization
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null
    }

    const token = authHeader.substring(7)
    const { data, error } = await gotrueClient.getUser(token)
    
    if (error || !data.user) {
      return null
    }

    return data.user
  } catch (error) {
    console.error('[Auth] Error getting current user:', error)
    return null
  }
}

/**
 * Checks if user isolation is enabled
 * 
 * User isolation is enabled when:
 * - Not in platform mode (IS_PLATFORM=false)
 * - Login is required (NEXT_PUBLIC_REQUIRE_LOGIN=true)
 */
export function isUserIsolationEnabled(): boolean {
  const IS_PLATFORM = process.env.NEXT_PUBLIC_IS_PLATFORM === 'true'
  const REQUIRE_LOGIN = process.env.NEXT_PUBLIC_REQUIRE_LOGIN === 'true'
  
  return !IS_PLATFORM && REQUIRE_LOGIN
}
