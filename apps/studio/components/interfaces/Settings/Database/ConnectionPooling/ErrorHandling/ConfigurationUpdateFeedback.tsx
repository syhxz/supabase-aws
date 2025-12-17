import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  AlertDescription_Shadcn_,
  AlertTitle_Shadcn_,
  Alert_Shadcn_,
  Button,
  CheckIcon,
  LoaderIcon,
  XIcon,
} from 'ui'

export interface ConfigurationUpdateState {
  status: 'idle' | 'updating' | 'success' | 'error'
  message?: string
  error?: Error | null
  updatedValues?: Record<string, any>
}

interface ConfigurationUpdateFeedbackProps {
  updateState: ConfigurationUpdateState
  onRetry?: () => void
  onDismiss?: () => void
  serviceName?: string
}

/**
 * Provides user feedback for configuration update operations
 */
export const ConfigurationUpdateFeedback: React.FC<ConfigurationUpdateFeedbackProps> = ({
  updateState,
  onRetry,
  onDismiss,
  serviceName = 'Supavisor',
}) => {
  const [showFeedback, setShowFeedback] = useState(false)

  useEffect(() => {
    if (updateState.status !== 'idle') {
      setShowFeedback(true)
    }

    // Auto-dismiss success messages after 5 seconds
    if (updateState.status === 'success') {
      const timer = setTimeout(() => {
        setShowFeedback(false)
        onDismiss?.()
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [updateState.status, onDismiss])

  if (!showFeedback || updateState.status === 'idle') {
    return null
  }

  const handleDismiss = () => {
    setShowFeedback(false)
    onDismiss?.()
  }

  switch (updateState.status) {
    case 'updating':
      return (
        <Alert_Shadcn_ variant="default" className="border-blue-200 bg-blue-50">
          <LoaderIcon className="h-4 w-4 text-blue-600 animate-spin" />
          <AlertTitle_Shadcn_ className="text-blue-800">
            Updating {serviceName} Configuration
          </AlertTitle_Shadcn_>
          <AlertDescription_Shadcn_ className="text-blue-700">
            <p>
              Please wait while we update your connection pooling settings. 
              This may take a few moments as the service restarts with the new configuration.
            </p>
          </AlertDescription_Shadcn_>
        </Alert_Shadcn_>
      )

    case 'success':
      return (
        <Alert_Shadcn_ variant="default" className="border-green-200 bg-green-50">
          <CheckIcon className="h-4 w-4 text-green-600" />
          <AlertTitle_Shadcn_ className="text-green-800">
            Configuration Updated Successfully
          </AlertTitle_Shadcn_>
          <AlertDescription_Shadcn_ className="text-green-700">
            <div className="space-y-2">
              <p>
                Your {serviceName} configuration has been updated successfully. 
                {updateState.message && ` ${updateState.message}`}
              </p>
              
              {updateState.updatedValues && (
                <div className="bg-green-100 p-3 rounded border border-green-200">
                  <p className="font-medium text-green-800 mb-2">Updated Settings:</p>
                  <ul className="text-sm text-green-700 space-y-1">
                    {Object.entries(updateState.updatedValues).map(([key, value]) => (
                      <li key={key}>
                        <span className="font-medium">{formatSettingName(key)}:</span> {value}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex gap-2">
                <Button type="outline" size="tiny" onClick={handleDismiss}>
                  Dismiss
                </Button>
              </div>
            </div>
          </AlertDescription_Shadcn_>
        </Alert_Shadcn_>
      )

    case 'error':
      return (
        <Alert_Shadcn_ variant="destructive" className="border-red-200 bg-red-50">
          <XIcon className="h-4 w-4 text-red-600" />
          <AlertTitle_Shadcn_ className="text-red-800">
            Configuration Update Failed
          </AlertTitle_Shadcn_>
          <AlertDescription_Shadcn_ className="text-red-700">
            <div className="space-y-3">
              <p>
                Failed to update {serviceName} configuration. 
                {updateState.message && ` ${updateState.message}`}
              </p>
              
              {updateState.error && (
                <div className="bg-red-100 p-3 rounded border border-red-200">
                  <p className="font-medium text-red-800 mb-1">Error Details:</p>
                  <p className="text-sm text-red-700 font-mono">
                    {updateState.error.message}
                  </p>
                </div>
              )}

              <div className="bg-red-100 p-3 rounded border border-red-200">
                <p className="font-medium text-red-800 mb-2">Possible Solutions:</p>
                <ul className="text-sm text-red-700 space-y-1 list-disc list-inside">
                  <li>Check that the {serviceName} service is running</li>
                  <li>Verify your configuration values are valid</li>
                  <li>Ensure you have the necessary permissions</li>
                  <li>Try refreshing the page and attempting the update again</li>
                </ul>
              </div>

              <div className="flex gap-2">
                {onRetry && (
                  <Button type="default" size="tiny" onClick={onRetry}>
                    Retry Update
                  </Button>
                )}
                <Button type="outline" size="tiny" onClick={handleDismiss}>
                  Dismiss
                </Button>
              </div>
            </div>
          </AlertDescription_Shadcn_>
        </Alert_Shadcn_>
      )

    default:
      return null
  }
}

/**
 * Format setting names for display
 */
function formatSettingName(key: string): string {
  switch (key) {
    case 'poolSize':
      return 'Pool Size'
    case 'maxClientConnections':
      return 'Max Client Connections'
    case 'poolMode':
      return 'Pool Mode'
    default:
      return key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
  }
}

/**
 * Hook for managing configuration update state and feedback
 */
export function useConfigurationUpdateFeedback() {
  const [updateState, setUpdateState] = useState<ConfigurationUpdateState>({
    status: 'idle'
  })

  const startUpdate = () => {
    setUpdateState({
      status: 'updating',
      message: 'Applying configuration changes...'
    })
  }

  const updateSuccess = (message?: string, updatedValues?: Record<string, any>) => {
    setUpdateState({
      status: 'success',
      message,
      updatedValues
    })
    
    // Show success toast
    toast.success(message || 'Configuration updated successfully')
  }

  const updateError = (error: Error, message?: string) => {
    setUpdateState({
      status: 'error',
      error,
      message
    })
    
    // Show error toast
    toast.error(message || 'Failed to update configuration')
  }

  const resetState = () => {
    setUpdateState({ status: 'idle' })
  }

  return {
    updateState,
    startUpdate,
    updateSuccess,
    updateError,
    resetState
  }
}