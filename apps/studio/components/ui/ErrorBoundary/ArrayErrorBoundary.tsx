import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertError } from 'components/ui/AlertError'
import { Button } from 'ui'
import * as Sentry from '@sentry/nextjs'

interface Props {
  children: ReactNode
  projectRef?: string
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  onRetry?: () => void
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
}

/**
 * Error boundary component specifically for array-related runtime errors
 * Catches JavaScript errors related to array operations (e.g., "TypeError: n.find is not a function")
 * and provides graceful fallback UI with recovery mechanisms
 */
export class ArrayErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Store error info for debugging
    this.setState({ errorInfo })

    // Log array-related errors with specific context
    const isArrayError = this.isArrayRelatedError(error)
    
    console.error('ArrayErrorBoundary caught an error:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      isArrayRelated: isArrayError
    })

    // Report to Sentry with array-specific context
    Sentry.withScope((scope) => {
      scope.setTag('errorBoundary', 'ArrayErrorBoundary')
      scope.setTag('isArrayRelated', isArrayError)
      scope.setExtra('componentStack', errorInfo.componentStack)
      scope.setExtra('errorMessage', error.message)
      
      if (this.props.projectRef) {
        scope.setTag('projectRef', this.props.projectRef)
      }
      
      Sentry.captureException(error)
    })

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo)
  }

  /**
   * Determines if the error is related to array operations
   */
  private isArrayRelatedError(error: Error): boolean {
    const arrayErrorPatterns = [
      /\.find is not a function/,
      /\.filter is not a function/,
      /\.map is not a function/,
      /\.forEach is not a function/,
      /\.reduce is not a function/,
      /\.some is not a function/,
      /\.every is not a function/,
      /Cannot read propert(y|ies) of .* \(reading '(find|filter|map|forEach|reduce|some|every)'\)/
    ]

    return arrayErrorPatterns.some(pattern => pattern.test(error.message))
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined })
    this.props.onRetry?.()
  }

  private handleReload = () => {
    window.location.reload()
  }

  public render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      const isArrayError = this.state.error ? this.isArrayRelatedError(this.state.error) : false

      return (
        <AlertError
          projectRef={this.props.projectRef}
          subject={isArrayError ? "Data format error" : "Unexpected error"}
          error={this.state.error}
          additionalActions={
            <div className="flex gap-2">
              <Button type="default" onClick={this.handleRetry}>
                Try again
              </Button>
              <Button type="outline" onClick={this.handleReload}>
                Reload page
              </Button>
            </div>
          }
        >
          {isArrayError ? (
            <div>
              <p>
                An error occurred while processing data. This might be due to an unexpected data format
                or a temporary issue with the data source.
              </p>
              <p className="mt-2 text-sm text-foreground-light">
                The application expected array data but received a different format. 
                Please try refreshing the page or contact support if the issue persists.
              </p>
            </div>
          ) : (
            <p>
              An unexpected error occurred. Please try again or reload the page.
            </p>
          )}
        </AlertError>
      )
    }

    return this.props.children
  }
}