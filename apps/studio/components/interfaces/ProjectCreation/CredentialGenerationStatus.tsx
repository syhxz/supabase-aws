/**
 * UI component for displaying credential generation status and error feedback.
 * Shows real-time status updates and provides actionable error messages.
 */

import { useState, useEffect } from 'react'
import { AlertCircle, CheckCircle, Clock, RefreshCw, AlertTriangle } from 'lucide-react'
import { Alert_Shadcn_ as Alert, AlertDescription_Shadcn_ as AlertDescription, AlertTitle_Shadcn_ as AlertTitle, Button } from 'ui'
// Dynamic imports to avoid loading Node.js modules on client side
let credentialErrorMessages: typeof import('lib/api/self-hosted/credential-generation-error-messages') | null = null

async function getCredentialErrorMessages() {
  if (!credentialErrorMessages) {
    credentialErrorMessages = await import('lib/api/self-hosted/credential-generation-error-messages')
  }
  return credentialErrorMessages
}

// Type-only imports
export type { CredentialGenerationErrorCode } from 'lib/api/self-hosted/enhanced-credential-generation'
export type { FormattedCredentialError } from 'lib/api/self-hosted/credential-generation-error-messages'

/**
 * Status types for credential generation
 */
export type CredentialGenerationStatus = 
  | 'idle'
  | 'generating-database-name'
  | 'generating-username'
  | 'checking-uniqueness'
  | 'retrying-generation'
  | 'generation-complete'
  | 'applying-fallback'
  | 'error'

// Import the type dynamically
type CredentialGenerationErrorCode = import('lib/api/self-hosted/enhanced-credential-generation').CredentialGenerationErrorCode

/**
 * Props for the CredentialGenerationStatus component
 */
interface CredentialGenerationStatusProps {
  status: CredentialGenerationStatus
  error?: {
    code: CredentialGenerationErrorCode
    message: string
    details?: any
    attempts?: number
  }
  onRetry?: () => void
  className?: string
}

/**
 * Gets the appropriate icon for the current status
 */
function getStatusIcon(status: CredentialGenerationStatus, isRetrying: boolean = false) {
  switch (status) {
    case 'idle':
      return <Clock className="h-4 w-4 text-foreground-muted" />
    case 'generation-complete':
      return <CheckCircle className="h-4 w-4 text-brand" />
    case 'error':
      return <AlertCircle className="h-4 w-4 text-destructive" />
    case 'applying-fallback':
      return <AlertTriangle className="h-4 w-4 text-warning" />
    default:
      return isRetrying ? 
        <RefreshCw className="h-4 w-4 text-foreground-muted animate-spin" /> :
        <Clock className="h-4 w-4 text-foreground-muted animate-pulse" />
  }
}

/**
 * Gets the status message for display
 */
function getStatusMessage(status: CredentialGenerationStatus): string {
  switch (status) {
    case 'idle':
      return 'Preparing to generate database credentials...'
    case 'generating-database-name':
      return 'Generating unique database name...'
    case 'generating-username':
      return 'Creating database user credentials...'
    case 'checking-uniqueness':
      return 'Verifying credential uniqueness...'
    case 'retrying-generation':
      return 'Retrying credential generation...'
    case 'generation-complete':
      return 'Database credentials ready!'
    case 'applying-fallback':
      return 'Applying fallback credential strategy...'
    case 'error':
      return 'Credential generation failed'
    default:
      return 'Processing...'
  }
}

/**
 * Component for displaying credential generation status and errors
 */
export const CredentialGenerationStatus = ({
  status,
  error,
  onRetry,
  className = '',
}: CredentialGenerationStatusProps) => {
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null)
  const [formattedError, setFormattedError] = useState<{
    title: string
    message: string
    userAction: string
    suggestions: string[]
    canRetry: boolean
    severity: 'low' | 'medium' | 'high'
    retryDelay?: number
    technicalDetails?: string
  } | null>(null)

  // Format error when error prop changes
  useEffect(() => {
    if (error) {
      // Use dynamic import to format error
      getCredentialErrorMessages().then((errorMessages) => {
        const formatted = errorMessages.formatCredentialGenerationError(
          error.code,
          error.attempts || 1,
          error.details
        )
        setFormattedError(formatted)

        // Start countdown if retry is available and has delay
        if (formatted.canRetry && formatted.retryDelay) {
          setRetryCountdown(Math.ceil(formatted.retryDelay / 1000))
        }
      }).catch(() => {
        // Fallback error formatting
        setFormattedError({
          title: 'Credential Generation Error',
          message: error.message || 'An error occurred during credential generation',
          userAction: 'Please try again',
          suggestions: ['Check your project name', 'Try again in a few moments'],
          canRetry: true,
          severity: 'medium',
          technicalDetails: error.details ? JSON.stringify(error.details) : undefined
        })
      })
    } else {
      setFormattedError(null)
      setRetryCountdown(null)
    }
  }, [error])

  // Handle countdown timer
  useEffect(() => {
    if (retryCountdown === null || retryCountdown <= 0) return

    const timer = setTimeout(() => {
      setRetryCountdown(retryCountdown - 1)
    }, 1000)

    return () => clearTimeout(timer)
  }, [retryCountdown])

  // Don't render anything if idle and no error
  if (status === 'idle' && !error) {
    return null
  }

  // Render error state
  if (status === 'error' && formattedError) {
    return (
      <div className={`space-y-4 ${className}`}>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{formattedError.title}</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{formattedError.message}</p>
            
            <div className="space-y-2">
              <p className="font-medium text-sm">What you can do:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>{formattedError.userAction}</li>
                {formattedError.suggestions.map((suggestion, index) => (
                  <li key={index}>{suggestion}</li>
                ))}
              </ul>
            </div>

            {formattedError.canRetry && onRetry && (
              <div className="flex items-center gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onRetry}
                  disabled={retryCountdown !== null && retryCountdown > 0}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-3 w-3" />
                  {retryCountdown !== null && retryCountdown > 0
                    ? `Retry in ${retryCountdown}s`
                    : 'Try Again'
                  }
                </Button>
                
                {formattedError.severity === 'high' && (
                  <span className="text-xs text-foreground-muted">
                    If this continues, please contact support
                  </span>
                )}
              </div>
            )}
          </AlertDescription>
        </Alert>

        {/* Technical details for debugging (only in development) */}
        {process.env.NODE_ENV === 'development' && formattedError.technicalDetails && (
          <Alert variant="default">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Technical Details (Development Only)</AlertTitle>
            <AlertDescription>
              <code className="text-xs bg-background-surface-300 p-2 rounded block mt-2">
                {formattedError.technicalDetails}
              </code>
            </AlertDescription>
          </Alert>
        )}
      </div>
    )
  }

  // Render status state
  const isRetrying = status === 'retrying-generation'
  const statusMessage = getStatusMessage(status)
  const statusIcon = getStatusIcon(status, isRetrying)

  // Determine alert variant based on status
  let alertVariant: 'default' | 'destructive' | 'warning' = 'default'
  if (status === 'error') {
    alertVariant = 'destructive'
  } else if (status === 'applying-fallback') {
    alertVariant = 'warning'
  }

  return (
    <div className={className}>
      <Alert variant={alertVariant}>
        {statusIcon}
        <AlertTitle>
          {status === 'generation-complete' ? 'Ready to Create Project' : 'Setting Up Your Project'}
        </AlertTitle>
        <AlertDescription>
          <div className="flex items-center gap-2">
            <span>{statusMessage}</span>
            {isRetrying && (
              <span className="text-xs text-foreground-muted">
                (This may take a moment)
              </span>
            )}
          </div>
          
          {status === 'applying-fallback' && (
            <p className="text-xs text-foreground-muted mt-2">
              Using alternative credential generation strategy to ensure your project is created successfully.
            </p>
          )}
        </AlertDescription>
      </Alert>
    </div>
  )
}

/**
 * Hook for managing credential generation status
 */
export function useCredentialGenerationStatus() {
  const [status, setStatus] = useState<CredentialGenerationStatus>('idle')
  const [error, setError] = useState<CredentialGenerationStatusProps['error'] | null>(null)

  const updateStatus = (newStatus: CredentialGenerationStatus) => {
    setStatus(newStatus)
    if (newStatus !== 'error') {
      setError(null)
    }
  }

  const setGenerationError = (
    code: CredentialGenerationErrorCode,
    message: string,
    details?: any,
    attempts?: number
  ) => {
    setStatus('error')
    setError({ code, message, details, attempts })
  }

  const reset = () => {
    setStatus('idle')
    setError(null)
  }

  return {
    status,
    error,
    updateStatus,
    setGenerationError,
    reset,
  }
}