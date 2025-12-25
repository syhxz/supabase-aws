import { useRouter } from 'next/router'
import { PropsWithChildren, useEffect, useState } from 'react'
import { useIsLoggedIn, useIsUserLoading, useSession, gotrueClient, clearLocalStorage } from 'common'
import { IS_PLATFORM } from 'lib/constants'
import { toast } from 'sonner'

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/sign-in',
  '/sign-up',
  '/sign-in-sso',
  '/sign-in-mfa',
  '/forgot-password',
  '/reset-password',
  '/verify',
  '/logout',
]

/**
 * AuthGuard component that handles route protection for self-hosted mode
 * when NEXT_PUBLIC_REQUIRE_LOGIN is enabled.
 * 
 * This component:
 * - Redirects unauthenticated users to /sign-in
 * - Preserves the requested URL for post-login redirect
 * - Allows access to public routes without authentication
 * - Validates session tokens with GoTrue
 * - Handles expired sessions by redirecting to login
 * - Only runs in self-hosted mode when login is required
 */
export const AuthGuard = ({ children }: PropsWithChildren) => {
  const router = useRouter()
  const isLoggedIn = useIsLoggedIn()
  const isLoading = useIsUserLoading()
  const session = useSession()
  const [isChecking, setIsChecking] = useState(true)

  const requireLogin = process.env.NEXT_PUBLIC_REQUIRE_LOGIN === 'true'

  useEffect(() => {
    // Skip auth guard if on platform or login not required
    if (IS_PLATFORM || !requireLogin) {
      setIsChecking(false)
      return
    }

    // Wait for auth state to be determined
    if (isLoading) {
      return
    }

    const currentPath = router.pathname

    // Allow access to public routes
    const isPublicRoute = PUBLIC_ROUTES.some((route) => currentPath.startsWith(route))
    if (isPublicRoute) {
      setIsChecking(false)
      return
    }

    // If not logged in and not on a public route, redirect to sign-in
    if (!isLoggedIn) {
      const returnTo = `${router.asPath}`
      const signInUrl = returnTo !== '/sign-in' 
        ? `/sign-in?returnTo=${encodeURIComponent(returnTo)}`
        : '/sign-in'
      
      router.replace(signInUrl)
      return
    }

    // Validate session token
    if (session) {
      validateSessionToken(session)
    } else {
      // User is authenticated with valid session, allow access
      setIsChecking(false)
    }
  }, [isLoggedIn, isLoading, session, router, requireLogin])

  /**
   * Validates the session token and handles various failure scenarios
   */
  const validateSessionToken = async (session: any) => {
    try {
      // Check if session is expired
      if (session.expires_at) {
        const expiresAt = session.expires_at * 1000 // Convert to milliseconds
        const now = Date.now()
        
        // If session is expired, try to refresh it
        if (expiresAt < now) {
          console.warn('[AuthGuard] Session expired, attempting refresh...')
          
          const { data, error } = await gotrueClient.refreshSession()
          
          if (error || !data.session) {
            // Refresh failed - could be invalid token
            console.error('[AuthGuard] Token refresh failed:', error)
            handleInvalidToken('Session expired and could not be refreshed')
            return
          } else {
            // Refresh succeeded, allow access
            console.log('[AuthGuard] Session refreshed successfully')
            setIsChecking(false)
            return
          }
        }
      }

      // Validate token structure
      if (!session.access_token || typeof session.access_token !== 'string') {
        console.error('[AuthGuard] Invalid token structure:', session)
        handleInvalidToken('Invalid session token structure')
        return
      }

      // Check if token looks like a JWT (has 3 parts separated by dots)
      const tokenParts = session.access_token.split('.')
      if (tokenParts.length !== 3) {
        console.error('[AuthGuard] Token does not appear to be a valid JWT')
        handleInvalidToken('Malformed session token')
        return
      }

      // Token appears valid, allow access
      setIsChecking(false)
    } catch (error) {
      console.error('[AuthGuard] Error validating token:', error)
      handleInvalidToken('Token validation failed')
    }
  }

  /**
   * Handles invalid or tampered tokens by clearing session and redirecting
   */
  const handleInvalidToken = (reason: string) => {
    console.error('[AuthGuard] Invalid token detected:', reason)
    
    // Log security event
    console.warn('[Security] Invalid token detected and cleared:', {
      reason,
      timestamp: new Date().toISOString(),
      path: router.asPath,
    })

    // Clear the invalid session immediately
    clearLocalStorage()
    gotrueClient.signOut()

    // Show error message to user
    toast.error('Your session is invalid. Please sign in again.', {
      description: 'For security reasons, you have been signed out.',
    })

    // Redirect to login
    const returnTo = `${router.asPath}`
    const signInUrl = returnTo !== '/sign-in' 
      ? `/sign-in?returnTo=${encodeURIComponent(returnTo)}`
      : '/sign-in'
    
    router.replace(signInUrl)
  }

  // Show nothing while checking authentication
  // This prevents flash of protected content
  if (isChecking || (requireLogin && !IS_PLATFORM && isLoading)) {
    return null
  }

  return <>{children}</>
}
