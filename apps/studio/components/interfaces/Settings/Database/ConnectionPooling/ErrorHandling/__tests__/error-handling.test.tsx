import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { SupavisorErrorStates, SupavisorSetupGuidance } from '../SupavisorErrorStates'
import { ConfigurationUpdateFeedback, useConfigurationUpdateFeedback } from '../ConfigurationUpdateFeedback'
import { PoolingErrorBoundary } from '../PoolingErrorBoundary'

// Mock components and hooks
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  }
}))

vi.mock('ui', () => ({
  Alert_Shadcn_: ({ children, ...props }: any) => <div data-testid="alert" {...props}>{children}</div>,
  AlertTitle_Shadcn_: ({ children }: any) => <div data-testid="alert-title">{children}</div>,
  AlertDescription_Shadcn_: ({ children }: any) => <div data-testid="alert-description">{children}</div>,
  Button: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
  InfoIcon: () => <div data-testid="info-icon" />,
  WarningIcon: () => <div data-testid="warning-icon" />,
  CheckIcon: () => <div data-testid="check-icon" />,
  LoaderIcon: () => <div data-testid="loader-icon" />,
  XIcon: () => <div data-testid="x-icon" />,
  ExternalLinkIcon: () => <div data-testid="external-link-icon" />,
}))

vi.mock('ui-patterns', () => ({
  Admonition: ({ children, title }: any) => (
    <div data-testid="admonition">
      <div data-testid="admonition-title">{title}</div>
      {children}
    </div>
  )
}))

vi.mock('components/ui/InlineLink', () => ({
  InlineLink: ({ children, href }: any) => <a href={href}>{children}</a>
}))

describe('Error Handling Components', () => {
  describe('SupavisorErrorStates', () => {
    it('renders missing config error state correctly', () => {
      render(
        <SupavisorErrorStates
          errorType="missing-config"
          projectRef="test-project"
        />
      )

      expect(screen.getByText('Supavisor Configuration Required')).toBeInTheDocument()
      expect(screen.getByText(/environment variables are not configured/)).toBeInTheDocument()
      expect(screen.getByText('POOLER_TENANT_ID')).toBeInTheDocument()
      expect(screen.getByText('Setup Guide')).toBeInTheDocument()
    })

    it('renders service unavailable error state correctly', () => {
      render(
        <SupavisorErrorStates
          errorType="service-unavailable"
          projectRef="test-project"
        />
      )

      expect(screen.getByText('Supavisor Service Unavailable')).toBeInTheDocument()
      expect(screen.getByText(/service is not running or not accessible/)).toBeInTheDocument()
      expect(screen.getByText('Troubleshooting Guide')).toBeInTheDocument()
    })

    it('calls onRetry when retry button is clicked', () => {
      const onRetry = vi.fn()
      
      render(
        <SupavisorErrorStates
          errorType="network-error"
          projectRef="test-project"
          onRetry={onRetry}
        />
      )

      const retryButton = screen.getByText('Retry Connection')
      fireEvent.click(retryButton)
      
      expect(onRetry).toHaveBeenCalledTimes(1)
    })
  })

  describe('SupavisorSetupGuidance', () => {
    it('renders setup guidance correctly', () => {
      render(<SupavisorSetupGuidance projectRef="test-project" />)

      expect(screen.getByText('Connection Pooling Setup Required')).toBeInTheDocument()
      expect(screen.getByText(/configure Supavisor with the appropriate environment variables/)).toBeInTheDocument()
      expect(screen.getByText(/POOLER_TENANT_ID=your-project-id/)).toBeInTheDocument()
      expect(screen.getByText('Complete Setup Guide')).toBeInTheDocument()
    })
  })

  describe('ConfigurationUpdateFeedback', () => {
    it('renders updating state correctly', () => {
      const updateState = {
        status: 'updating' as const,
        message: 'Applying changes...'
      }

      render(
        <ConfigurationUpdateFeedback
          updateState={updateState}
          serviceName="Supavisor"
        />
      )

      expect(screen.getByText('Updating Supavisor Configuration')).toBeInTheDocument()
      expect(screen.getByTestId('loader-icon')).toBeInTheDocument()
    })

    it('renders success state with updated values', () => {
      const updateState = {
        status: 'success' as const,
        message: 'Configuration updated',
        updatedValues: {
          poolSize: 25,
          maxClientConnections: 200
        }
      }

      render(
        <ConfigurationUpdateFeedback
          updateState={updateState}
          serviceName="Supavisor"
        />
      )

      expect(screen.getByText('Configuration Updated Successfully')).toBeInTheDocument()
      expect(screen.getByText('Updated Settings:')).toBeInTheDocument()
      // Check that the values are present somewhere in the document
      expect(screen.getByText('25')).toBeInTheDocument()
      expect(screen.getByText('200')).toBeInTheDocument()
      expect(screen.getByTestId('check-icon')).toBeInTheDocument()
    })

    it('renders error state with suggestions', () => {
      const error = new Error('Invalid pool size')
      const updateState = {
        status: 'error' as const,
        error,
        message: 'Validation failed'
      }

      render(
        <ConfigurationUpdateFeedback
          updateState={updateState}
          serviceName="Supavisor"
        />
      )

      expect(screen.getByText('Configuration Update Failed')).toBeInTheDocument()
      expect(screen.getByText('Invalid pool size')).toBeInTheDocument()
      expect(screen.getByTestId('x-icon')).toBeInTheDocument()
    })

    it('calls onRetry when retry button is clicked', () => {
      const onRetry = vi.fn()
      const updateState = {
        status: 'error' as const,
        error: new Error('Network error')
      }

      render(
        <ConfigurationUpdateFeedback
          updateState={updateState}
          onRetry={onRetry}
        />
      )

      const retryButton = screen.getByText('Retry Update')
      fireEvent.click(retryButton)
      
      expect(onRetry).toHaveBeenCalledTimes(1)
    })
  })

  describe('useConfigurationUpdateFeedback', () => {
    const TestComponent = () => {
      const {
        updateState,
        startUpdate,
        updateSuccess,
        updateError,
        resetState
      } = useConfigurationUpdateFeedback()

      return (
        <div>
          <div data-testid="status">{updateState.status}</div>
          <button onClick={startUpdate}>Start Update</button>
          <button onClick={() => updateSuccess('Success!', { poolSize: 25 })}>
            Update Success
          </button>
          <button onClick={() => updateError(new Error('Failed'), 'Error!')}>
            Update Error
          </button>
          <button onClick={resetState}>Reset</button>
        </div>
      )
    }

    it('manages update state correctly', async () => {
      render(<TestComponent />)

      // Initial state
      expect(screen.getByTestId('status')).toHaveTextContent('idle')

      // Start update
      fireEvent.click(screen.getByText('Start Update'))
      expect(screen.getByTestId('status')).toHaveTextContent('updating')

      // Success
      fireEvent.click(screen.getByText('Update Success'))
      expect(screen.getByTestId('status')).toHaveTextContent('success')

      // Reset
      fireEvent.click(screen.getByText('Reset'))
      expect(screen.getByTestId('status')).toHaveTextContent('idle')

      // Error
      fireEvent.click(screen.getByText('Update Error'))
      expect(screen.getByTestId('status')).toHaveTextContent('error')
    })
  })

  describe('PoolingErrorBoundary', () => {
    const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
      if (shouldThrow) {
        throw new Error('Test error')
      }
      return <div>No error</div>
    }

    beforeEach(() => {
      // Suppress console.error for these tests
      vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    it('renders children when no error occurs', () => {
      render(
        <PoolingErrorBoundary projectRef="test-project">
          <ThrowError shouldThrow={false} />
        </PoolingErrorBoundary>
      )

      expect(screen.getByText('No error')).toBeInTheDocument()
    })

    it('renders error UI when error occurs', () => {
      render(
        <PoolingErrorBoundary projectRef="test-project">
          <ThrowError shouldThrow={true} />
        </PoolingErrorBoundary>
      )

      expect(screen.getByText('Connection pooling configuration error')).toBeInTheDocument()
      expect(screen.getByText('Try again')).toBeInTheDocument()
    })

    it('renders custom fallback when provided', () => {
      const fallback = <div>Custom error fallback</div>

      render(
        <PoolingErrorBoundary projectRef="test-project" fallback={fallback}>
          <ThrowError shouldThrow={true} />
        </PoolingErrorBoundary>
      )

      expect(screen.getByText('Custom error fallback')).toBeInTheDocument()
    })
  })
})