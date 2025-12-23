import { NextApiRequest } from 'next'

/**
 * Authentication helper functions for API endpoints
 */

/**
 * Get the current authenticated user ID from the request
 * 
 * @param req - Next.js API request object
 * @returns User ID string or null if not authenticated
 */
export async function getCurrentUserId(req: NextApiRequest): Promise<string | null> {
  try {
    // In a real implementation, this would:
    // 1. Extract JWT token from Authorization header or cookies
    // 2. Verify the token signature
    // 3. Extract user ID from token payload
    // 4. Optionally validate user exists in database
    
    // Check for Authorization header
    const authHeader = req.headers.authorization
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      
      // Mock implementation - in real code this would verify JWT
      if (token && token.length > 0) {
        // Return mock user ID for testing
        return `user_${token.substring(0, 8)}`
      }
    }
    
    // Check for session cookie (alternative auth method)
    const sessionCookie = req.cookies['supabase-auth-token']
    if (sessionCookie) {
      // Mock implementation - in real code this would verify session
      return `user_session_${sessionCookie.substring(0, 8)}`
    }
    
    // No authentication found
    return null
    
  } catch (error) {
    console.error('Error getting current user ID:', error)
    return null
  }
}

/**
 * Validate that a user has access to a specific project
 * 
 * @param userId - User ID
 * @param projectId - Project ID
 * @returns True if user has access, false otherwise
 */
export async function validateUserProjectAccess(
  userId: string, 
  projectId: number
): Promise<boolean> {
  try {
    // In a real implementation, this would:
    // 1. Query the database to check user-project relationships
    // 2. Check organization memberships
    // 3. Validate project permissions (read, write, admin)
    
    // Mock implementation - assume all authenticated users have access
    // In production, this would be a proper database query like:
    // SELECT 1 FROM project_members WHERE user_id = $1 AND project_id = $2
    
    if (!userId || !projectId) {
      return false
    }
    
    // For testing purposes, return true for valid inputs
    return true
    
  } catch (error) {
    console.error('Error validating user project access:', error)
    return false
  }
}

/**
 * Get user permissions for a specific project
 * 
 * @param userId - User ID
 * @param projectId - Project ID
 * @returns User permissions object
 */
export async function getUserProjectPermissions(
  userId: string,
  projectId: number
): Promise<{
  canRead: boolean
  canWrite: boolean
  canAdmin: boolean
  canDelete: boolean
}> {
  try {
    // In a real implementation, this would query user roles and permissions
    // For now, return mock permissions
    
    const hasAccess = await validateUserProjectAccess(userId, projectId)
    
    if (!hasAccess) {
      return {
        canRead: false,
        canWrite: false,
        canAdmin: false,
        canDelete: false
      }
    }
    
    // Mock implementation - grant all permissions for testing
    return {
      canRead: true,
      canWrite: true,
      canAdmin: true,
      canDelete: true
    }
    
  } catch (error) {
    console.error('Error getting user project permissions:', error)
    return {
      canRead: false,
      canWrite: false,
      canAdmin: false,
      canDelete: false
    }
  }
}

/**
 * Extract user ID from JWT token (helper function)
 * 
 * @param token - JWT token string
 * @returns User ID or null if invalid
 */
export function extractUserIdFromToken(token: string): string | null {
  try {
    // In a real implementation, this would:
    // 1. Verify JWT signature
    // 2. Check token expiration
    // 3. Extract payload
    // 4. Return user ID from payload
    
    // Mock implementation for testing
    if (token && token.length >= 8) {
      return `user_${token.substring(0, 8)}`
    }
    
    return null
    
  } catch (error) {
    console.error('Error extracting user ID from token:', error)
    return null
  }
}

/**
 * Check if request is from an authenticated user
 * 
 * @param req - Next.js API request object
 * @returns True if authenticated, false otherwise
 */
export async function isAuthenticated(req: NextApiRequest): Promise<boolean> {
  const userId = await getCurrentUserId(req)
  return userId !== null
}

/**
 * Require authentication for an API endpoint
 * Throws error if user is not authenticated
 * 
 * @param req - Next.js API request object
 * @returns User ID
 * @throws Error if not authenticated
 */
export async function requireAuthentication(req: NextApiRequest): Promise<string> {
  const userId = await getCurrentUserId(req)
  
  if (!userId) {
    throw new Error('Authentication required')
  }
  
  return userId
}

/**
 * Check if user isolation is enabled in the current environment
 * 
 * @returns True if user isolation is enabled, false otherwise
 */
export function isUserIsolationEnabled(): boolean {
  // Check environment variable to determine if user isolation is enabled
  const userIsolationEnabled = process.env.ENABLE_USER_ISOLATION === 'true'
  
  // In development, we can enable it by default for testing
  const isDevelopment = process.env.NODE_ENV === 'development' || process.env.ENVIRONMENT === 'development'
  
  // Return true if explicitly enabled or in development mode
  return userIsolationEnabled || isDevelopment
}