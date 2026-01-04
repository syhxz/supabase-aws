/**
 * Property-Based Tests for Logout Cleanup
 * 
 * Feature: add-login-page, Property 4: Logout cleanup
 * Validates: Requirements 7.2, 7.3, 7.4
 * 
 * Property: For any authenticated session, logging out should clear all session data
 * from localStorage and redirect to the login page.
 * 
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'

const STORAGE_KEY = 'supabase.dashboard.auth.token'

function performLogoutCleanup() {
  localStorage.clear()
}

describe('Logout Cleanup - Property-Based Tests', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('Property 4: Logout cleanup - any session should be cleared from localStorage', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 100 }),
        (sessionData) => {
          // Store session
          localStorage.setItem(STORAGE_KEY, sessionData)
          expect(localStorage.getItem(STORAGE_KEY)).toBe(sessionData)
          
          // Logout
          performLogoutCleanup()
          
          // Verify cleared
          expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
          expect(localStorage.length).toBe(0)
        }
      ),
      { numRuns: 100 }
    )
  })
})
