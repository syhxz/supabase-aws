'use client'

import type { AuthError, Session } from '@supabase/supabase-js'
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { clearLocalStorage } from './constants/local-storage'
import { gotrueClient, updateGoTrueClientUrl, type User } from './gotrue'

export type { User }

const DEFAULT_SESSION: any = {
  access_token: undefined,
  expires_at: 0,
  expires_in: 0,
  refresh_token: '',
  token_type: '',
  user: {
    aud: '',
    app_metadata: {},
    confirmed_at: '',
    created_at: '',
    email: '',
    email_confirmed_at: '',
    id: '',
    identities: [],
    last_signed_in_at: '',
    phone: '',
    role: '',
    updated_at: '',
    user_metadata: {},
  },
} as unknown as Session

/* Auth Context */

type AuthState =
  | {
      session: Session | null
      error: AuthError | null
      isLoading: false
    }
  | {
      session: null
      error: AuthError | null
      isLoading: true
    }

export type AuthContext = { refreshSession: () => Promise<Session | null> } & AuthState

export const AuthContext = createContext<AuthContext>({
  session: null,
  error: null,
  isLoading: true,
  refreshSession: () => Promise.resolve(null),
})

export type AuthProviderProps = {
  alwaysLoggedIn?: boolean
}

export const AuthProvider = ({
  alwaysLoggedIn,
  children,
}: PropsWithChildren<AuthProviderProps>) => {
  const [state, setState] = useState<AuthState>({ session: null, error: null, isLoading: true })

  useEffect(() => {
    let mounted = true
    
    // Update GoTrue client URL from runtime config before initializing
    ;(async () => {
      try {
        // Update client URL with runtime configuration
        await updateGoTrueClientUrl()
        // GoTrue client URL updated from runtime config
      } catch (error) {
        console.warn('Failed to update GoTrue URL from runtime config:', error)
        // Continue with initialization even if runtime config fails
      }

      if (!mounted) return

      // Initialize GoTrue client and restore session from localStorage
      const { error } = await gotrueClient.initialize()
      
      if (!mounted) return
      
      if (error !== null) {
        setState((prev) => ({ ...prev, error, isLoading: false }))
        return
      }

      // Try to restore session from localStorage
      try {
        const { data, error: sessionError } = await gotrueClient.getSession()
        
        if (!mounted) return
        
        if (sessionError) {
          console.error('[Auth] Failed to restore session:', sessionError)
          setState((prev) => ({ ...prev, error: sessionError, isLoading: false }))
        } else if (data.session) {
          // Session restored successfully
          console.log('[Auth] Session restored from localStorage')
          setState({ session: data.session, error: null, isLoading: false })
        } else {
          // No session to restore
          setState({ session: null, error: null, isLoading: false })
        }
      } catch (err) {
        console.error('[Auth] Error restoring session:', err)
        setState({ session: null, error: err as AuthError, isLoading: false })
      }
    })()

    return () => {
      mounted = false
    }
  }, [])

  // Keep the session in sync
  useEffect(() => {
    const {
      data: { subscription },
    } = gotrueClient.onAuthStateChange((event, session) => {
      // Handle session expiration
      if (event === 'TOKEN_REFRESHED') {
        console.log('[Auth] Token refreshed successfully')
      } else if (event === 'SIGNED_OUT') {
        console.log('[Auth] User signed out')
      } else if (event === 'SIGNED_IN') {
        console.log('[Auth] User signed in')
      }
      
      // Validate session token if present
      if (session) {
        // Check if session is expired
        if (session.expires_at) {
          const expiresAt = session.expires_at * 1000 // Convert to milliseconds
          const now = Date.now()
          
          if (expiresAt < now) {
            console.warn('[Auth] Session has expired')
            // Clear the expired session
            gotrueClient.signOut()
            return
          }
        }

        // Validate token structure
        if (!session.access_token || typeof session.access_token !== 'string') {
          console.error('[Auth] Invalid token structure detected')
          // Log security event
          console.warn('[Security] Invalid token structure, signing out')
          gotrueClient.signOut()
          return
        }

        // Check if token looks like a JWT (has 3 parts separated by dots)
        const tokenParts = session.access_token.split('.')
        if (tokenParts.length !== 3) {
          console.error('[Auth] Token does not appear to be a valid JWT')
          // Log security event
          console.warn('[Security] Malformed JWT token detected, signing out')
          gotrueClient.signOut()
          return
        }
      }
      
      setState((prev) => ({
        session,
        // If there is a session, we clear the error
        error: session !== null ? null : prev.error,
        isLoading: false,
      }))
    })

    return subscription.unsubscribe
  }, [])

  // Automatic token refresh - check every minute and refresh if needed
  useEffect(() => {
    if (alwaysLoggedIn) {
      // Skip token refresh in auto-login mode
      return
    }

    const REFRESH_BUFFER = 30 // Refresh 30 seconds before expiration
    const CHECK_INTERVAL = 60000 // Check every minute

    const intervalId = setInterval(async () => {
      try {
        const { data: { session } } = await gotrueClient.getSession()
        
        if (!session || !session.expires_at) {
          return
        }

        const expiresAt = session.expires_at
        const now = Math.ceil(Date.now() / 1000)
        const timeUntilExpiry = expiresAt - now

        // If token expires in less than REFRESH_BUFFER seconds, refresh it
        if (timeUntilExpiry < REFRESH_BUFFER) {
          console.log('[Auth] Token expiring soon, refreshing...')
          const { data, error } = await gotrueClient.refreshSession()
          
          if (error) {
            console.error('[Auth] Failed to refresh token:', error)
            // If refresh fails, sign out the user
            await gotrueClient.signOut()
          } else if (data.session) {
            console.log('[Auth] Token refreshed successfully')
          }
        }
      } catch (error) {
        console.error('[Auth] Error in token refresh check:', error)
      }
    }, CHECK_INTERVAL)

    return () => clearInterval(intervalId)
  }, [alwaysLoggedIn])

  // Helper method to refresh the session.
  // For example after a user updates their profile
  const refreshSession = useCallback(async () => {
    const {
      data: { session },
    } = await gotrueClient.refreshSession()

    return session
  }, [])

  const value = useMemo(() => {
    if (alwaysLoggedIn) {
      return { session: DEFAULT_SESSION, error: null, isLoading: false, refreshSession } as const
    } else {
      return { ...state, refreshSession } as const
    }
  }, [state, refreshSession])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/* Auth Utils */

export const useAuth = () => useContext(AuthContext)

export const useSession = () => useAuth().session

export const useUser = () => useSession()?.user ?? null

export const useIsUserLoading = () => useAuth().isLoading

export const useIsLoggedIn = () => {
  const user = useUser()

  return user !== null
}

export const useAuthError = () => useAuth().error

export const useIsMFAEnabled = () => {
  const user = useUser()

  return user !== null && user.factors && user.factors.length > 0
}

export const signOut = async () => await gotrueClient.signOut()

export const logOut = async () => {
  await signOut()
  clearLocalStorage()
}

let currentSession: Session | null = null

gotrueClient.onAuthStateChange((event, session) => {
  currentSession = session
})

/**
 * Grabs the currently available access token, or calls getSession.
 */
export async function getAccessToken() {
  // ignore if server-side
  if (typeof window === 'undefined') return undefined

  const aboutToExpire = currentSession?.expires_at
    ? currentSession.expires_at - Math.ceil(Date.now() / 1000) < 30
    : false

  if (!currentSession || aboutToExpire) {
    const {
      data: { session },
      error,
    } = await gotrueClient.getSession()
    if (error) {
      throw error
    }

    return session?.access_token
  }

  return currentSession.access_token
}
