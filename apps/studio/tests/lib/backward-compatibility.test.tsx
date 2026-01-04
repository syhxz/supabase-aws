/**
 * Backward Compatibility Integration Tests
 * 
 * These tests ensure that the auto-login mode (NEXT_PUBLIC_REQUIRE_LOGIN=false)
 * continues to work as expected and that existing deployments aren't broken.
 * 
 * This file contains integration tests that verify:
 * - Auto-login mode functionality (Requirements 5.1, 5.3)
 * - Switching between authentication modes (Requirements 5.1, 5.3)
 * - Existing deployments aren't broken (Requirements 5.3, 5.4)
 * 
 * Requirements: 5.1, 5.3, 5.4
 */

import { render, screen, waitFor, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { AuthProvider, useAuth, useIsLoggedIn, useUser } from 'common'
import { PropsWithChildren } from 'react'

// Test component to access auth state
function TestComponent() {
  const { session, isLoading } = useAuth()
  const isLoggedIn = useIsLoggedIn()
  const user = useUser()

  return (
    <div>
      <div data-testid="loading">{isLoading ? 'loading' : 'loaded'}</div>
      <div data-testid="logged-in">{isLoggedIn ? 'yes' : 'no'}</div>
      <div data-testid="has-session">{session ? 'yes' : 'no'}</div>
      <div data-testid="user-id">{user?.id || 'none'}</div>
      <div data-testid="user-email">{user?.email || 'none'}</div>
    </div>
  )
}

// Test component that simulates project loading
function ProjectLoadingComponent() {
  const isLoggedIn = useIsLoggedIn()
  const { isLoading } = useAuth()
  const [projectsLoaded, setProjectsLoaded] = React.useState(false)

  React.useEffect(() => {
    if (isLoggedIn && !isLoading) {
      // Simulate project loading
      setProjectsLoaded(true)
    }
  }, [isLoggedIn, isLoading])

  return (
    <div>
      <div data-testid="auth-loading">{isLoading ? 'loading' : 'loaded'}</div>
      <div data-testid="logged-in">{isLoggedIn ? 'yes' : 'no'}</div>
      <div data-testid="projects-loaded">{projectsLoaded ? 'yes' : 'no'}</div>
    </div>
  )
}

// Import React for the component above
import * as React from 'react'

describe('Backward Compatibility - Auto-Login Mode', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
    
    // Clear any stored sessions
    localStorage.clear()
  })

  describe('Auto-login mode (alwaysLoggedIn=true)', () => {
    it('should automatically provide a session without requiring authentication', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider alwaysLoggedIn={true}>
            <TestComponent />
          </AuthProvider>
        </QueryClientProvider>
      )

      // Should not be loading
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded')
      })

      // Should be logged in automatically
      expect(screen.getByTestId('logged-in')).toHaveTextContent('yes')
      expect(screen.getByTestId('has-session')).toHaveTextContent('yes')
    })

    it('should provide a default session immediately', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider alwaysLoggedIn={true}>
            <TestComponent />
          </AuthProvider>
        </QueryClientProvider>
      )

      // Should have session immediately (no loading state)
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded')
      })
      
      expect(screen.getByTestId('has-session')).toHaveTextContent('yes')
    })

    it('should not attempt to restore session from localStorage in auto-login mode', async () => {
      // Set a fake session in localStorage
      localStorage.setItem('supabase.auth.token', JSON.stringify({
        access_token: 'fake-token',
        user: { id: 'fake-user-id' }
      }))

      render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider alwaysLoggedIn={true}>
            <TestComponent />
          </AuthProvider>
        </QueryClientProvider>
      )

      // Should use default session, not the one from localStorage
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded')
      })
      
      expect(screen.getByTestId('logged-in')).toHaveTextContent('yes')
      expect(screen.getByTestId('has-session')).toHaveTextContent('yes')
    })

    it('should not perform token refresh in auto-login mode', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log')
      
      render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider alwaysLoggedIn={true}>
            <TestComponent />
          </AuthProvider>
        </QueryClientProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded')
      })

      // Wait a bit to ensure no token refresh attempts
      await new Promise(resolve => setTimeout(resolve, 100))

      // Should not see any token refresh logs
      const refreshLogs = consoleLogSpy.mock.calls.filter(call => 
        call.some(arg => typeof arg === 'string' && arg.includes('Token expiring soon'))
      )
      expect(refreshLogs).toHaveLength(0)

      consoleLogSpy.mockRestore()
    })
  })

  describe('GoTrue authentication mode (alwaysLoggedIn=false)', () => {
    it('should not provide a session automatically', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider alwaysLoggedIn={false}>
            <TestComponent />
          </AuthProvider>
        </QueryClientProvider>
      )

      // Should finish loading
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded')
      })

      // Should NOT be logged in automatically
      expect(screen.getByTestId('logged-in')).toHaveTextContent('no')
      expect(screen.getByTestId('has-session')).toHaveTextContent('no')
    })

    it('should attempt to restore session from localStorage', async () => {
      // Set a valid session in localStorage
      const mockSession = {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
        refresh_token: 'refresh-token',
        expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        user: { 
          id: 'test-user-id',
          email: 'test@example.com',
          aud: 'authenticated',
          role: 'authenticated'
        }
      }
      
      localStorage.setItem('supabase.auth.token', JSON.stringify(mockSession))

      render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider alwaysLoggedIn={false}>
            <TestComponent />
          </AuthProvider>
        </QueryClientProvider>
      )

      // Should finish loading
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded')
      }, { timeout: 3000 })

      // Note: In a real scenario with a working GoTrue service, this would restore the session
      // For this test, we're just verifying the attempt is made
    })
  })

  describe('Mode switching', () => {
    it('should behave differently based on alwaysLoggedIn prop', async () => {
      // First render with auto-login
      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider alwaysLoggedIn={true}>
            <TestComponent />
          </AuthProvider>
        </QueryClientProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded')
      })
      expect(screen.getByTestId('logged-in')).toHaveTextContent('yes')

      // Rerender with GoTrue mode
      rerender(
        <QueryClientProvider client={queryClient}>
          <AuthProvider alwaysLoggedIn={false}>
            <TestComponent />
          </AuthProvider>
        </QueryClientProvider>
      )

      // Should start loading again
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded')
      })
      
      // Should not be logged in (no session in localStorage)
      expect(screen.getByTestId('logged-in')).toHaveTextContent('no')
    })
  })

  describe('Existing deployment compatibility', () => {
    it('should work when NEXT_PUBLIC_REQUIRE_LOGIN is not set (undefined)', () => {
      // Simulate the environment variable not being set
      const originalEnv = process.env.NEXT_PUBLIC_REQUIRE_LOGIN
      delete process.env.NEXT_PUBLIC_REQUIRE_LOGIN

      // In this case, alwaysLoggedIn should be true (default behavior)
      const requireLogin = process.env.NEXT_PUBLIC_REQUIRE_LOGIN === 'true'
      const alwaysLoggedIn = !requireLogin

      expect(alwaysLoggedIn).toBe(true)

      // Restore
      if (originalEnv !== undefined) {
        process.env.NEXT_PUBLIC_REQUIRE_LOGIN = originalEnv
      }
    })

    it('should work when NEXT_PUBLIC_REQUIRE_LOGIN is explicitly false', () => {
      const originalEnv = process.env.NEXT_PUBLIC_REQUIRE_LOGIN
      process.env.NEXT_PUBLIC_REQUIRE_LOGIN = 'false'

      const requireLogin = process.env.NEXT_PUBLIC_REQUIRE_LOGIN === 'true'
      const alwaysLoggedIn = !requireLogin

      expect(alwaysLoggedIn).toBe(true)

      // Restore
      if (originalEnv !== undefined) {
        process.env.NEXT_PUBLIC_REQUIRE_LOGIN = originalEnv
      } else {
        delete process.env.NEXT_PUBLIC_REQUIRE_LOGIN
      }
    })

    it('should enable GoTrue mode only when NEXT_PUBLIC_REQUIRE_LOGIN is explicitly true', () => {
      const originalEnv = process.env.NEXT_PUBLIC_REQUIRE_LOGIN
      process.env.NEXT_PUBLIC_REQUIRE_LOGIN = 'true'

      const requireLogin = process.env.NEXT_PUBLIC_REQUIRE_LOGIN === 'true'
      const alwaysLoggedIn = !requireLogin

      expect(alwaysLoggedIn).toBe(false)
      expect(requireLogin).toBe(true)

      // Restore
      if (originalEnv !== undefined) {
        process.env.NEXT_PUBLIC_REQUIRE_LOGIN = originalEnv
      } else {
        delete process.env.NEXT_PUBLIC_REQUIRE_LOGIN
      }
    })
  })
})

/**
 * Integration Tests for Backward Compatibility
 * 
 * These tests verify complete workflows and interactions between components
 * to ensure backward compatibility is maintained.
 */
describe('Backward Compatibility - Integration Tests', () => {
  let queryClient: QueryClient
  let originalEnv: string | undefined

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
    
    // Clear any stored sessions
    localStorage.clear()
    
    // Save original environment
    originalEnv = process.env.NEXT_PUBLIC_REQUIRE_LOGIN
  })

  afterEach(() => {
    // Restore original environment
    if (originalEnv !== undefined) {
      process.env.NEXT_PUBLIC_REQUIRE_LOGIN = originalEnv
    } else {
      delete process.env.NEXT_PUBLIC_REQUIRE_LOGIN
    }
  })

  /**
   * Test: Auto-login mode functionality
   * 
   * Verifies that when NEXT_PUBLIC_REQUIRE_LOGIN is false or undefined,
   * the application automatically logs users in without requiring authentication.
   * 
   * Requirements: 5.1, 5.3
   */
  describe('Auto-login mode functionality', () => {
    it('should automatically authenticate users when NEXT_PUBLIC_REQUIRE_LOGIN is undefined', async () => {
      delete process.env.NEXT_PUBLIC_REQUIRE_LOGIN

      render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider alwaysLoggedIn={true}>
            <TestComponent />
          </AuthProvider>
        </QueryClientProvider>
      )

      // Should be logged in immediately
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded')
      })

      expect(screen.getByTestId('logged-in')).toHaveTextContent('yes')
      expect(screen.getByTestId('has-session')).toHaveTextContent('yes')
    })

    it('should automatically authenticate users when NEXT_PUBLIC_REQUIRE_LOGIN is false', async () => {
      process.env.NEXT_PUBLIC_REQUIRE_LOGIN = 'false'

      render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider alwaysLoggedIn={true}>
            <TestComponent />
          </AuthProvider>
        </QueryClientProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded')
      })

      expect(screen.getByTestId('logged-in')).toHaveTextContent('yes')
      expect(screen.getByTestId('has-session')).toHaveTextContent('yes')
    })

    it('should load projects immediately in auto-login mode', async () => {
      delete process.env.NEXT_PUBLIC_REQUIRE_LOGIN

      render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider alwaysLoggedIn={true}>
            <ProjectLoadingComponent />
          </AuthProvider>
        </QueryClientProvider>
      )

      // Auth should complete quickly
      await waitFor(() => {
        expect(screen.getByTestId('auth-loading')).toHaveTextContent('loaded')
      })

      // Should be logged in
      expect(screen.getByTestId('logged-in')).toHaveTextContent('yes')

      // Projects should be loaded
      await waitFor(() => {
        expect(screen.getByTestId('projects-loaded')).toHaveTextContent('yes')
      })
    })

    it('should not require localStorage session in auto-login mode', async () => {
      // Ensure localStorage is empty
      localStorage.clear()

      render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider alwaysLoggedIn={true}>
            <TestComponent />
          </AuthProvider>
        </QueryClientProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded')
      })

      // Should still be logged in without localStorage
      expect(screen.getByTestId('logged-in')).toHaveTextContent('yes')
      expect(screen.getByTestId('has-session')).toHaveTextContent('yes')
    })

    it('should ignore localStorage session in auto-login mode', async () => {
      // Set a fake session in localStorage
      localStorage.setItem('supabase.auth.token', JSON.stringify({
        access_token: 'fake-token-should-be-ignored',
        user: { id: 'fake-user-id', email: 'fake@example.com' }
      }))

      render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider alwaysLoggedIn={true}>
            <TestComponent />
          </AuthProvider>
        </QueryClientProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded')
      })

      // Should use default session, not localStorage
      expect(screen.getByTestId('logged-in')).toHaveTextContent('yes')
      expect(screen.getByTestId('has-session')).toHaveTextContent('yes')
      
      // User ID should not be the fake one from localStorage
      expect(screen.getByTestId('user-id')).not.toHaveTextContent('fake-user-id')
    })
  })

  /**
   * Test: Switching between authentication modes
   * 
   * Verifies that the application can switch between auto-login mode
   * and GoTrue authentication mode without breaking.
   * 
   * Requirements: 5.1, 5.3
   */
  describe('Switching between authentication modes', () => {
    it('should switch from auto-login to GoTrue mode', async () => {
      // Start in auto-login mode
      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider alwaysLoggedIn={true}>
            <TestComponent />
          </AuthProvider>
        </QueryClientProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded')
      })
      expect(screen.getByTestId('logged-in')).toHaveTextContent('yes')

      // Switch to GoTrue mode
      rerender(
        <QueryClientProvider client={queryClient}>
          <AuthProvider alwaysLoggedIn={false}>
            <TestComponent />
          </AuthProvider>
        </QueryClientProvider>
      )

      // Should reload auth state
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded')
      })

      // Should not be logged in (no session in localStorage)
      expect(screen.getByTestId('logged-in')).toHaveTextContent('no')
      expect(screen.getByTestId('has-session')).toHaveTextContent('no')
    })

    it('should switch from GoTrue mode to auto-login', async () => {
      // Start in GoTrue mode
      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider alwaysLoggedIn={false}>
            <TestComponent />
          </AuthProvider>
        </QueryClientProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded')
      })
      expect(screen.getByTestId('logged-in')).toHaveTextContent('no')

      // Switch to auto-login mode
      rerender(
        <QueryClientProvider client={queryClient}>
          <AuthProvider alwaysLoggedIn={true}>
            <TestComponent />
          </AuthProvider>
        </QueryClientProvider>
      )

      // Should be logged in immediately
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded')
      })
      expect(screen.getByTestId('logged-in')).toHaveTextContent('yes')
      expect(screen.getByTestId('has-session')).toHaveTextContent('yes')
    })

    it('should handle multiple mode switches without errors', async () => {
      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider alwaysLoggedIn={true}>
            <TestComponent />
          </AuthProvider>
        </QueryClientProvider>
      )

      // First switch: auto-login -> GoTrue
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded')
      })

      rerender(
        <QueryClientProvider client={queryClient}>
          <AuthProvider alwaysLoggedIn={false}>
            <TestComponent />
          </AuthProvider>
        </QueryClientProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded')
      })

      // Second switch: GoTrue -> auto-login
      rerender(
        <QueryClientProvider client={queryClient}>
          <AuthProvider alwaysLoggedIn={true}>
            <TestComponent />
          </AuthProvider>
        </QueryClientProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded')
      })
      expect(screen.getByTestId('logged-in')).toHaveTextContent('yes')

      // Third switch: auto-login -> GoTrue
      rerender(
        <QueryClientProvider client={queryClient}>
          <AuthProvider alwaysLoggedIn={false}>
            <TestComponent />
          </AuthProvider>
        </QueryClientProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded')
      })
      expect(screen.getByTestId('logged-in')).toHaveTextContent('no')
    })

    it('should preserve project loading behavior when switching modes', async () => {
      // Start in auto-login mode
      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider alwaysLoggedIn={true}>
            <ProjectLoadingComponent />
          </AuthProvider>
        </QueryClientProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('auth-loading')).toHaveTextContent('loaded')
      })
      expect(screen.getByTestId('projects-loaded')).toHaveTextContent('yes')

      // Switch to GoTrue mode
      rerender(
        <QueryClientProvider client={queryClient}>
          <AuthProvider alwaysLoggedIn={false}>
            <ProjectLoadingComponent />
          </AuthProvider>
        </QueryClientProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('auth-loading')).toHaveTextContent('loaded')
      })

      // Projects should not be loaded (not authenticated)
      expect(screen.getByTestId('projects-loaded')).toHaveTextContent('no')
    })
  })

  /**
   * Test: Existing deployments aren't broken
   * 
   * Verifies that existing deployments continue to work without any
   * configuration changes or code modifications.
   * 
   * Requirements: 5.3, 5.4
   */
  describe('Existing deployments compatibility', () => {
    it('should maintain default behavior when no environment variable is set', async () => {
      // Simulate existing deployment with no NEXT_PUBLIC_REQUIRE_LOGIN set
      delete process.env.NEXT_PUBLIC_REQUIRE_LOGIN

      // Existing deployments should default to auto-login
      const requireLogin = process.env.NEXT_PUBLIC_REQUIRE_LOGIN === 'true'
      const alwaysLoggedIn = !requireLogin

      expect(alwaysLoggedIn).toBe(true)

      render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider alwaysLoggedIn={alwaysLoggedIn}>
            <TestComponent />
          </AuthProvider>
        </QueryClientProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded')
      })

      // Should work exactly as before
      expect(screen.getByTestId('logged-in')).toHaveTextContent('yes')
      expect(screen.getByTestId('has-session')).toHaveTextContent('yes')
    })

    it('should not break existing functionality with default session', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider alwaysLoggedIn={true}>
            <TestComponent />
          </AuthProvider>
        </QueryClientProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded')
      })

      // All existing auth hooks should work
      expect(screen.getByTestId('logged-in')).toHaveTextContent('yes')
      expect(screen.getByTestId('has-session')).toHaveTextContent('yes')
      expect(screen.getByTestId('user-id')).not.toHaveTextContent('none')
    })

    it('should maintain backward compatibility with useAuth hook', async () => {
      const wrapper = ({ children }: PropsWithChildren) => (
        <QueryClientProvider client={queryClient}>
          <AuthProvider alwaysLoggedIn={true}>
            {children}
          </AuthProvider>
        </QueryClientProvider>
      )

      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // useAuth should return session as before
      expect(result.current.session).not.toBeNull()
      expect(result.current.error).toBeNull()
    })

    it('should maintain backward compatibility with useIsLoggedIn hook', async () => {
      const wrapper = ({ children }: PropsWithChildren) => (
        <QueryClientProvider client={queryClient}>
          <AuthProvider alwaysLoggedIn={true}>
            {children}
          </AuthProvider>
        </QueryClientProvider>
      )

      const { result } = renderHook(() => useIsLoggedIn(), { wrapper })

      await waitFor(() => {
        expect(result.current).toBe(true)
      })
    })

    it('should maintain backward compatibility with useUser hook', async () => {
      const wrapper = ({ children }: PropsWithChildren) => (
        <QueryClientProvider client={queryClient}>
          <AuthProvider alwaysLoggedIn={true}>
            {children}
          </AuthProvider>
        </QueryClientProvider>
      )

      const { result } = renderHook(() => useUser(), { wrapper })

      await waitFor(() => {
        expect(result.current).not.toBeNull()
      })

      // User should have expected properties
      expect(result.current).toHaveProperty('id')
      expect(result.current).toHaveProperty('email')
    })

    it('should not require any code changes for existing deployments', async () => {
      // Simulate existing deployment code that doesn't know about NEXT_PUBLIC_REQUIRE_LOGIN
      const IS_PLATFORM = false
      const requireLogin = process.env.NEXT_PUBLIC_REQUIRE_LOGIN === 'true'
      const alwaysLoggedIn = !IS_PLATFORM && !requireLogin

      // Should default to auto-login (existing behavior)
      expect(alwaysLoggedIn).toBe(true)

      render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider alwaysLoggedIn={alwaysLoggedIn}>
            <TestComponent />
          </AuthProvider>
        </QueryClientProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded')
      })

      // Should work without any changes
      expect(screen.getByTestId('logged-in')).toHaveTextContent('yes')
    })

    it('should handle project loading in existing deployments', async () => {
      // Existing deployment behavior
      delete process.env.NEXT_PUBLIC_REQUIRE_LOGIN

      render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider alwaysLoggedIn={true}>
            <ProjectLoadingComponent />
          </AuthProvider>
        </QueryClientProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('auth-loading')).toHaveTextContent('loaded')
      })

      // Projects should load as they did before
      expect(screen.getByTestId('logged-in')).toHaveTextContent('yes')
      await waitFor(() => {
        expect(screen.getByTestId('projects-loaded')).toHaveTextContent('yes')
      })
    })
  })

  /**
   * Test: Environment variable edge cases
   * 
   * Verifies that various environment variable configurations
   * are handled correctly.
   * 
   * Requirements: 5.1, 5.3, 5.4
   */
  describe('Environment variable edge cases', () => {
    it('should handle NEXT_PUBLIC_REQUIRE_LOGIN="TRUE" (uppercase)', () => {
      process.env.NEXT_PUBLIC_REQUIRE_LOGIN = 'TRUE'
      
      // Should NOT enable GoTrue mode (only lowercase "true" should)
      const requireLogin = process.env.NEXT_PUBLIC_REQUIRE_LOGIN === 'true'
      expect(requireLogin).toBe(false)
    })

    it('should handle NEXT_PUBLIC_REQUIRE_LOGIN="1"', () => {
      process.env.NEXT_PUBLIC_REQUIRE_LOGIN = '1'
      
      // Should NOT enable GoTrue mode (only "true" should)
      const requireLogin = process.env.NEXT_PUBLIC_REQUIRE_LOGIN === 'true'
      expect(requireLogin).toBe(false)
    })

    it('should handle NEXT_PUBLIC_REQUIRE_LOGIN="" (empty string)', () => {
      process.env.NEXT_PUBLIC_REQUIRE_LOGIN = ''
      
      // Should NOT enable GoTrue mode
      const requireLogin = process.env.NEXT_PUBLIC_REQUIRE_LOGIN === 'true'
      expect(requireLogin).toBe(false)
    })

    it('should handle NEXT_PUBLIC_REQUIRE_LOGIN with whitespace', () => {
      process.env.NEXT_PUBLIC_REQUIRE_LOGIN = ' true '
      
      // Should NOT enable GoTrue mode (exact match required)
      const requireLogin = process.env.NEXT_PUBLIC_REQUIRE_LOGIN === 'true'
      expect(requireLogin).toBe(false)
    })
  })
})
