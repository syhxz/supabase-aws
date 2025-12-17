import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ArrayErrorBoundary } from '../ArrayErrorBoundary'

// Mock Sentry
vi.mock('@sentry/nextjs', () => ({
  withScope: vi.fn((callback) => callback({ 
    setTag: vi.fn(), 
    setExtra: vi.fn() 
  })),
  captureException: vi.fn()
}))

// Mock AlertError component
vi.mock('components/ui/AlertError', () => ({
  AlertError: ({ children, additionalActions, subject }: any) => (
    <div data-testid="alert-error">
      <div data-testid="error-subject">{subject}</div>
      <div>{children}</div>
      {additionalActions}
    </div>
  )
}))

// Component that throws an array-related error
const ThrowArrayError = () => {
  const notAnArray = null
  // This will throw "TypeError: Cannot read property 'find' of null"
  ;(notAnArray as any).find(() => true)
  return <div>Should not render</div>
}

// Component that throws a non-array error
const ThrowGenericError = () => {
  throw new Error('Generic error message')
}

// Component that works normally
const WorkingComponent = () => <div data-testid="working-component">Working!</div>

describe('ArrayErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Suppress console.error for cleaner test output
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders children when there is no error', () => {
    render(
      <ArrayErrorBoundary>
        <WorkingComponent />
      </ArrayErrorBoundary>
    )

    expect(screen.getByTestId('working-component')).toBeInTheDocument()
  })

  it('catches array-related errors and shows appropriate error message', () => {
    render(
      <ArrayErrorBoundary projectRef="test-project">
        <ThrowArrayError />
      </ArrayErrorBoundary>
    )

    expect(screen.getByTestId('alert-error')).toBeInTheDocument()
    expect(screen.getByTestId('error-subject')).toHaveTextContent('Data format error')
    expect(screen.getByText(/unexpected data format/)).toBeInTheDocument()
  })

  it('catches non-array errors and shows generic error message', () => {
    render(
      <ArrayErrorBoundary>
        <ThrowGenericError />
      </ArrayErrorBoundary>
    )

    expect(screen.getByTestId('alert-error')).toBeInTheDocument()
    expect(screen.getByTestId('error-subject')).toHaveTextContent('Unexpected error')
    expect(screen.getByText(/unexpected error occurred/)).toBeInTheDocument()
  })

  it('provides retry functionality', () => {
    const onRetry = vi.fn()
    
    render(
      <ArrayErrorBoundary onRetry={onRetry}>
        <ThrowArrayError />
      </ArrayErrorBoundary>
    )

    const retryButton = screen.getByText('Try again')
    fireEvent.click(retryButton)

    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('uses custom fallback when provided', () => {
    const customFallback = <div data-testid="custom-fallback">Custom Error UI</div>

    render(
      <ArrayErrorBoundary fallback={customFallback}>
        <ThrowArrayError />
      </ArrayErrorBoundary>
    )

    expect(screen.getByTestId('custom-fallback')).toBeInTheDocument()
    expect(screen.queryByTestId('alert-error')).not.toBeInTheDocument()
  })

  it('calls custom error handler when provided', () => {
    const onError = vi.fn()

    render(
      <ArrayErrorBoundary onError={onError}>
        <ThrowArrayError />
      </ArrayErrorBoundary>
    )

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String)
      })
    )
  })

  it('identifies array-related errors correctly', () => {
    // This test verifies the private isArrayRelatedError method indirectly
    // by checking the error message displayed
    
    render(
      <ArrayErrorBoundary>
        <ThrowArrayError />
      </ArrayErrorBoundary>
    )

    expect(screen.getByTestId('error-subject')).toHaveTextContent('Data format error')
  })

  it('provides reload page functionality', () => {
    // Mock window.location.reload
    const mockReload = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { reload: mockReload },
      writable: true
    })

    render(
      <ArrayErrorBoundary>
        <ThrowArrayError />
      </ArrayErrorBoundary>
    )

    const reloadButton = screen.getByText('Reload page')
    fireEvent.click(reloadButton)

    expect(mockReload).toHaveBeenCalledTimes(1)
  })
})