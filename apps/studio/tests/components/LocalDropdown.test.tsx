/**
 * Unit Tests for Logout Functionality
 * Tests logout button visibility, session clearing, and redirect
 * Requirements: 7.1, 7.2, 7.3, 7.4
 * 
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LocalDropdown } from 'components/interfaces/LocalDropdown'

// Mock dependencies
vi.mock('common', () => ({
  useIsLoggedIn: vi.fn(),
}))

vi.mock('lib/auth', () => ({
  useSignOut: vi.fn(),
}))

vi.mock('lib/constants', () => ({
  IS_PLATFORM: false,
}))

vi.mock('next/router', () => ({
  useRouter: vi.fn(),
}))

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', setTheme: vi.fn() }),
}))

vi.mock('ui-patterns', () => ({
  useSetCommandMenuOpen: () => vi.fn(),
}))

vi.mock('components/interfaces/App/FeaturePreview/FeaturePreviewContext', () => ({
  useFeaturePreviewModal: () => ({ openFeaturePreviewModal: vi.fn() }),
}))

describe('LocalDropdown - Logout Functionality', () => {
  const mockPush = vi.fn()
  const mockSignOut = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_REQUIRE_LOGIN = 'true'
    
    const { useRouter } = require('next/router')
    useRouter.mockReturnValue({ push: mockPush })
    
    const { useSignOut } = require('lib/auth')
    useSignOut.mockReturnValue(mockSignOut)
  })

  it('should show logout button when authenticated and login is required', () => {
    const { useIsLoggedIn } = require('common')
    useIsLoggedIn.mockReturnValue(true)

    render(<LocalDropdown />)
    
    // Open dropdown
    const trigger = screen.getByRole('button')
    userEvent.click(trigger)
    
    // Check for logout button
    expect(screen.getByText('Log out')).toBeInTheDocument()
  })

  it('should not show logout button when not authenticated', () => {
    const { useIsLoggedIn } = require('common')
    useIsLoggedIn.mockReturnValue(false)

    render(<LocalDropdown />)
    
    // Open dropdown
    const trigger = screen.getByRole('button')
    userEvent.click(trigger)
    
    // Logout button should not be present
    expect(screen.queryByText('Log out')).not.toBeInTheDocument()
  })

  it('should call signOut and redirect when logout is clicked', async () => {
    const { useIsLoggedIn } = require('common')
    useIsLoggedIn.mockReturnValue(true)

    render(<LocalDropdown />)
    
    // Open dropdown
    const trigger = screen.getByRole('button')
    await userEvent.click(trigger)
    
    // Click logout
    const logoutButton = screen.getByText('Log out')
    await userEvent.click(logoutButton)
    
    // Verify signOut was called
    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled()
    })
    
    // Verify redirect to sign-in
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/sign-in')
    })
  })
})
