import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertError } from 'components/ui/AlertError'
import { Button } from 'ui'

interface Props {
  children: ReactNode
  projectRef?: string
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

/**
 * Error boundary component for connection pooling configuration
 * Catches JavaScript errors anywhere in the pooling component tree
 */
export class PoolingErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Connection pooling error boundary caught an error:', error, errorInfo)
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined })
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <AlertError
          projectRef={this.props.projectRef}
          subject="Connection pooling configuration error"
          error={this.state.error}
          additionalActions={
            <Button type="default" onClick={this.handleRetry}>
              Try again
            </Button>
          }
        >
          <p>
            An unexpected error occurred while loading the connection pooling configuration.
            This might be due to a temporary issue with the pooling service or configuration.
          </p>
        </AlertError>
      )
    }

    return this.props.children
  }
}