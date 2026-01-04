/**
 * Configuration Error Recovery Component
 * 
 * Provides comprehensive error recovery and user feedback for configuration failures.
 * This component handles:
 * - User-friendly error messages
 * - Graceful degradation strategies
 * - Troubleshooting guidance
 * - Recovery actions (retry, fallback)
 * - Progressive disclosure of technical details
 */

import { useState, useCallback } from 'react'
import { AlertTriangle, RefreshCw, Settings, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from 'ui'
import { ConfigError, formatErrorForUser } from 'common/runtime-config-errors'
import type { ConfigHealthResult } from 'lib/config-health'

interface ConfigurationErrorRecoveryProps {
  /** Configuration error that occurred */
  error: ConfigError
  /** Health check result (optional) */
  healthResult?: ConfigHealthResult
  /** Whether retry is in progress */
  isRetrying?: boolean
  /** Callback for retry action */
  onRetry?: () => void
  /** Callback for fallback action */
  onUseFallback?: () => void
  /** Whether fallback is available */
  canUseFallback?: boolean
  /** Additional context for the error */
  context?: string
}

/**
 * Gets appropriate icon and styling based on error severity
 */
function getErrorSeverityInfo(error: ConfigError): {
  icon: React.ComponentType<{ className?: string }>
  bgColor: string
  borderColor: string
  textColor: string
  iconColor: string
} {
  if (error.canFallback) {
    return {
      icon: AlertTriangle,
      bgColor: 'bg-warning-300',
      borderColor: 'border-warning-400',
      textColor: 'text-warning-900',
      iconColor: 'text-warning-900',
    }
  } else {
    return {
      icon: AlertTriangle,
      bgColor: 'bg-destructive-300',
      borderColor: 'border-destructive-400',
      textColor: 'text-destructive-900',
      iconColor: 'text-destructive-900',
    }
  }
}

/**
 * Gets user-friendly title based on error type
 */
function getErrorTitle(error: ConfigError): string {
  switch (error.type) {
    case 'NETWORK_TIMEOUT':
      return 'Configuration Request Timed Out'
    case 'NETWORK_ERROR':
      return 'Network Connection Failed'
    case 'INVALID_RESPONSE':
      return 'Invalid Configuration Response'
    case 'MISSING_ENV_VARS':
      return 'Server Configuration Incomplete'
    case 'INVALID_URL':
      return 'Invalid URL Configuration'
    case 'SERVER_ERROR':
      return 'Server Configuration Error'
    default:
      return 'Configuration Error'
  }
}

/**
 * Gets recovery actions based on error type and context
 */
function getRecoveryActions(error: ConfigError): {
  primary: string
  secondary?: string
  description: string
} {
  switch (error.type) {
    case 'NETWORK_TIMEOUT':
      return {
        primary: 'Retry Connection',
        secondary: 'Use Offline Mode',
        description: 'Try connecting again or continue with cached configuration',
      }
    case 'NETWORK_ERROR':
      return {
        primary: 'Retry Connection',
        secondary: 'Check Network',
        description: 'Verify your network connection and try again',
      }
    case 'INVALID_RESPONSE':
      return {
        primary: 'Retry Request',
        secondary: 'Use Defaults',
        description: 'The server response was invalid. Try again or use default settings.',
      }
    case 'MISSING_ENV_VARS':
      return {
        primary: 'Retry After Setup',
        secondary: 'Use Development Mode',
        description: 'Configure environment variables or continue in development mode',
      }
    case 'SERVER_ERROR':
      return {
        primary: 'Retry Request',
        secondary: 'Use Fallback',
        description: 'Server error detected. Try again or use fallback configuration.',
      }
    default:
      return {
        primary: 'Retry',
        secondary: 'Continue Anyway',
        description: 'Try the operation again or continue with available configuration',
      }
  }
}

/**
 * Formats health check information for display
 */
function formatHealthCheckInfo(healthResult: ConfigHealthResult): {
  summary: string
  details: string[]
} {
  const details: string[] = []
  
  // Add check results
  if (!healthResult.checks.runtimeConfigAvailable.healthy) {
    details.push(`❌ Runtime Configuration: ${healthResult.checks.runtimeConfigAvailable.error || 'Failed'}`)
  } else {
    details.push(`✅ Runtime Configuration: Available (${healthResult.checks.runtimeConfigAvailable.responseTime}ms)`)
  }
  
  if (!healthResult.checks.gotrueReachable.healthy) {
    details.push(`❌ GoTrue Service: ${healthResult.checks.gotrueReachable.error || 'Unreachable'}`)
  } else {
    details.push(`✅ GoTrue Service: Reachable (${healthResult.checks.gotrueReachable.responseTime}ms)`)
  }
  
  if (!healthResult.checks.apiGatewayReachable.healthy) {
    details.push(`⚠️ API Gateway: ${healthResult.checks.apiGatewayReachable.error || 'Check failed'}`)
  } else {
    details.push(`✅ API Gateway: Reachable (${healthResult.checks.apiGatewayReachable.responseTime}ms)`)
  }
  
  // Add configuration info if available
  if (healthResult.config) {
    details.push('')
    details.push('Configuration Details:')
    details.push(`  Environment: ${healthResult.config.environment}`)
    details.push(`  Source: ${healthResult.config.source}`)
    details.push(`  GoTrue URL: ${healthResult.config.gotrueUrl}`)
    details.push(`  API URL: ${healthResult.config.apiUrl}`)
  }
  
  const summary = healthResult.healthy 
    ? 'All systems operational'
    : `${healthResult.errors.length} error(s), ${healthResult.warnings.length} warning(s)`
  
  return { summary, details }
}

export function ConfigurationErrorRecovery({
  error,
  healthResult,
  isRetrying = false,
  onRetry,
  onUseFallback,
  canUseFallback = true,
  context,
}: ConfigurationErrorRecoveryProps) {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false)
  const [showHealthDetails, setShowHealthDetails] = useState(false)
  
  const severityInfo = getErrorSeverityInfo(error)
  const errorTitle = getErrorTitle(error)
  const recoveryActions = getRecoveryActions(error)
  const formattedError = formatErrorForUser(error)
  
  const handleRetry = useCallback(() => {
    if (onRetry && !isRetrying) {
      onRetry()
    }
  }, [onRetry, isRetrying])
  
  const handleUseFallback = useCallback(() => {
    if (onUseFallback) {
      onUseFallback()
    }
  }, [onUseFallback])
  
  const healthInfo = healthResult ? formatHealthCheckInfo(healthResult) : null
  
  return (
    <div className={`w-full ${severityInfo.bgColor} border-b ${severityInfo.borderColor} px-4 py-4`}>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-start gap-4">
          <severityInfo.icon className={`h-6 w-6 ${severityInfo.iconColor} flex-shrink-0 mt-0.5`} />
          
          <div className="flex-1 min-w-0">
            {/* Main Error Message */}
            <div className="mb-3">
              <h3 className={`text-base font-semibold ${severityInfo.textColor} mb-1`}>
                {errorTitle}
                {context && <span className="text-sm font-normal ml-2">({context})</span>}
              </h3>
              <p className={`text-sm ${severityInfo.textColor} mb-2`}>
                {formattedError.message}
              </p>
              <p className={`text-xs ${severityInfo.textColor} opacity-80`}>
                {recoveryActions.description}
              </p>
            </div>
            
            {/* Troubleshooting Suggestions */}
            {formattedError.suggestions.length > 0 && (
              <div className="mb-3">
                <details className={`text-sm ${severityInfo.textColor}`}>
                  <summary className="cursor-pointer hover:underline font-medium mb-2">
                    💡 Troubleshooting Steps
                  </summary>
                  <div className="ml-4 space-y-1">
                    {formattedError.suggestions.map((suggestion, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-xs mt-1">•</span>
                        <span className="text-xs">{suggestion}</span>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            )}
            
            {/* Health Check Information */}
            {healthInfo && (
              <div className="mb-3">
                <button
                  onClick={() => setShowHealthDetails(!showHealthDetails)}
                  className={`flex items-center gap-2 text-sm ${severityInfo.textColor} hover:underline`}
                >
                  <Settings className="h-4 w-4" />
                  <span>System Health: {healthInfo.summary}</span>
                  {showHealthDetails ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
                
                {showHealthDetails && (
                  <div className={`mt-2 ml-6 text-xs ${severityInfo.textColor} font-mono bg-black bg-opacity-10 rounded p-2`}>
                    {healthInfo.details.map((detail, i) => (
                      <div key={i}>{detail}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* Technical Details */}
            <div className="mb-3">
              <button
                onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                className={`flex items-center gap-2 text-sm ${severityInfo.textColor} hover:underline`}
              >
                <span>Technical Details</span>
                {showTechnicalDetails ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
              
              {showTechnicalDetails && (
                <div className={`mt-2 text-xs ${severityInfo.textColor} space-y-1`}>
                  <div><strong>Error Type:</strong> {error.type}</div>
                  <div><strong>Technical Message:</strong> {error.message}</div>
                  {error.originalError && (
                    <div><strong>Original Error:</strong> {error.originalError.message}</div>
                  )}
                  <div><strong>Can Fallback:</strong> {error.canFallback ? 'Yes' : 'No'}</div>
                  {error.docsUrl && (
                    <div>
                      <strong>Documentation:</strong>{' '}
                      <a
                        href={error.docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:no-underline inline-flex items-center gap-1"
                      >
                        View Docs <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Fallback Information */}
            {error.canFallback && (
              <div className={`text-xs ${severityInfo.textColor} opacity-80 mb-3 p-2 bg-black bg-opacity-10 rounded`}>
                <strong>Graceful Degradation:</strong> The application will continue to work using build-time configuration. 
                Some features may be limited until the configuration issue is resolved.
              </div>
            )}
          </div>
          
          {/* Action Buttons */}
          <div className="flex flex-col gap-2 flex-shrink-0">
            <Button
              type="default"
              size="tiny"
              onClick={handleRetry}
              loading={isRetrying}
              disabled={isRetrying}
              className="min-w-[80px]"
            >
              {isRetrying ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : (
                recoveryActions.primary
              )}
            </Button>
            
            {canUseFallback && error.canFallback && recoveryActions.secondary && (
              <Button
                type="outline"
                size="tiny"
                onClick={handleUseFallback}
                disabled={isRetrying}
                className="min-w-[80px]"
              >
                {recoveryActions.secondary}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Simplified error banner for less critical errors
 */
interface ConfigurationWarningBannerProps {
  /** Warning message */
  message: string
  /** Optional details */
  details?: string[]
  /** Whether to show dismiss button */
  dismissible?: boolean
  /** Callback when dismissed */
  onDismiss?: () => void
}

export function ConfigurationWarningBanner({
  message,
  details = [],
  dismissible = false,
  onDismiss,
}: ConfigurationWarningBannerProps) {
  const [dismissed, setDismissed] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  
  const handleDismiss = useCallback(() => {
    setDismissed(true)
    if (onDismiss) {
      onDismiss()
    }
  }, [onDismiss])
  
  if (dismissed) {
    return null
  }
  
  return (
    <div className="w-full bg-orange-200 border-b border-orange-300 px-4 py-3">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-orange-800 flex-shrink-0 mt-0.5" />
          
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-orange-900 mb-1">
              Configuration Warning
            </p>
            <p className="text-sm text-orange-900 mb-2">
              {message}
            </p>
            
            {details.length > 0 && (
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-xs text-orange-800 hover:underline font-medium flex items-center gap-1"
              >
                {showDetails ? 'Hide details' : 'Show details'}
                {showDetails ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </button>
            )}
            
            {showDetails && details.length > 0 && (
              <div className="mt-2 text-xs text-orange-800 space-y-1 ml-2">
                {details.map((detail, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span>•</span>
                    <span>{detail}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {dismissible && (
            <Button
              type="outline"
              size="tiny"
              onClick={handleDismiss}
              className="flex-shrink-0"
            >
              Dismiss
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}