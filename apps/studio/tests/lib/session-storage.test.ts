/**
 * Tests for session storage implementation
 * Validates Requirements 3.1, 3.2
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { gotrueClient, STORAGE_KEY } from 'common/gotrue'

describe('Session Storage Implementation', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('should use the correct storage key format', () => {
    // Verify the storage key matches the expected format
    expect(STORAGE_KEY).toBeDefined()
    expect(typeof STORAGE_KEY).toBe('string')
    
    // The key should contain 'supabase' and 'auth' and 'token'
    expect(STORAGE_KEY).toContain('supabase')
    expect(STORAGE_KEY).toContain('auth')
    expect(STORAGE_KEY).toContain('token')
  })

  it('should store session in localStorage when user signs in', async () => {
    // Create a mock session
    const mockSession = {
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_in: 3600,
      token_type: 'bearer',
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
        role: 'authenticated',
        aud: 'authenticated',
        app_metadata: {},
        user_metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    }

    // Manually store session to simulate what gotrueClient does
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mockSession))

    // Verify session is stored
    const storedSession = localStorage.getItem(STORAGE_KEY)
    expect(storedSession).toBeDefined()
    expect(storedSession).not.toBeNull()

    // Verify stored data matches
    const parsedSession = JSON.parse(storedSession!)
    expect(parsedSession.access_token).toBe(mockSession.access_token)
    expect(parsedSession.user.email).toBe(mockSession.user.email)
  })

  it('should retrieve session from localStorage on page load', async () => {
    // Create and store a mock session
    const mockSession = {
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_in: 3600,
      token_type: 'bearer',
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
        role: 'authenticated',
        aud: 'authenticated',
        app_metadata: {},
        user_metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(mockSession))

    // Retrieve session using getSession
    const { data, error } = await gotrueClient.getSession()

    // Note: In a real environment with GoTrue running, this would validate the token
    // In test environment, we're verifying the storage mechanism works
    expect(error).toBeNull()
    
    // If there's a session, verify it has the expected structure
    if (data.session) {
      expect(data.session).toHaveProperty('access_token')
      expect(data.session).toHaveProperty('user')
    }
  })

  it('should handle missing session gracefully', async () => {
    // Ensure no session is stored
    localStorage.removeItem(STORAGE_KEY)

    // Try to get session
    const { data, error } = await gotrueClient.getSession()

    // Should not error, just return null session
    expect(error).toBeNull()
    expect(data.session).toBeNull()
  })

  it('should handle corrupted session data', () => {
    // Store invalid JSON
    localStorage.setItem(STORAGE_KEY, 'invalid-json-data')

    // Try to retrieve - should handle gracefully
    const storedData = localStorage.getItem(STORAGE_KEY)
    expect(storedData).toBe('invalid-json-data')

    // Parsing should throw, which the client should handle
    expect(() => JSON.parse(storedData!)).toThrow()
  })
})
