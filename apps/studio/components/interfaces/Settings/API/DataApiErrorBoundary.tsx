import { ErrorBoundary } from 'components/ui/ErrorBoundary/ErrorBoundary'
import { AlertCircle, RefreshCw, Settings } from 'lucide-react'
import { useRouter } from 'next/router'
import { useCallback } from 'react'
import { Button } from 'ui'

interface DataApiErrorBoundaryProps {
  children: React.ReactNode
  projectRef?: string
}

export const DataApiErrorBoundary = ({ children, projectRef }: DataApiErrorBoundaryProps) => {
  const router = useRouter()

  const handleRetryConfiguration = useCallback(() => {
    // Force a page refresh to reset all state
    window.location.reload()
  }, [])

  const handleNavigateToSettings = useCallback(() => {
    if (projectRef) {
      router.push(`/project/${projectRef}/settings`)
    }
  }, [projectRef, router])

  const handleReportIssue = useCallback(() => {
    // Open support or GitHub issues
    window.open('https://github.com/supabase/supabase/issues/new', '_blank')
  }, [])

  return (
    <ErrorBoundary
      message="Data API Configuration Error"
      sentryContext={{
        component: 'DataApiManagement',
        projectRef,
        feature: 'data-api-configuration',
      }}
      actions={[
        {
          label: 'Retry Configuration',
          onClick: handleRetryConfiguration,
        },
        {
          label: 'Go to Settings',
          onClick: handleNavigateToSettings,
        },
        {
          label: 'Report Issue',
          onClick: handleReportIssue,
        },
      ]}
      onReset={() => {
        // Clear any cached data that might be causing issues
        if (typeof window !== 'undefined') {
          // Clear React Query cache for this project
          const queryClient = (window as any).__REACT_QUERY_CLIENT__
          if (queryClient) {
            queryClient.invalidateQueries({ queryKey: ['projects', projectRef] })
            queryClient.invalidateQueries({ queryKey: ['data-api-config', projectRef] })
          }
        }
      }}
    >
      {children}
    </ErrorBoundary>
  )
}