import { memo, useCallback, useMemo } from 'react'
import { useParams } from 'common'
import { useDataApiConfigQuery } from 'data/config/data-api-config-query'
import { useProjectUrlQuery } from 'data/config/project-url-query'
import { useSchemasQuery } from 'data/database/schemas-query'
import { useSelectedProjectQuery } from 'hooks/misc/useSelectedProject'
import { PostgrestConfig } from './PostgrestConfig'
import { DataApiErrorBoundary } from './DataApiErrorBoundary'

// Memoized component to prevent unnecessary re-renders
const MemoizedPostgrestConfig = memo(PostgrestConfig)

// Performance-optimized wrapper with error boundary and loading states
export const OptimizedPostgrestConfig = () => {
  const { ref: projectRef } = useParams()
  const { data: project } = useSelectedProjectQuery()

  // Memoize query options to prevent unnecessary re-fetches
  const queryOptions = useMemo(() => ({
    projectRef,
    enabled: !!projectRef,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  }), [projectRef])

  const schemaQueryOptions = useMemo(() => ({
    projectRef: project?.ref,
    connectionString: project?.connectionString,
    enabled: !!project?.ref && !!project?.connectionString,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  }), [project?.ref, project?.connectionString])

  // Prefetch related data to improve perceived performance
  const { isLoading: isLoadingConfig } = useDataApiConfigQuery(queryOptions)
  const { isLoading: isLoadingProjectUrl } = useProjectUrlQuery(queryOptions)
  const { isLoading: isLoadingSchemas } = useSchemasQuery(schemaQueryOptions)

  // Memoize loading state to prevent unnecessary re-renders
  const isLoading = useMemo(() => 
    isLoadingConfig || isLoadingProjectUrl || isLoadingSchemas,
    [isLoadingConfig, isLoadingProjectUrl, isLoadingSchemas]
  )

  // Early return for loading state to prevent rendering heavy components
  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded mb-4"></div>
        <div className="h-64 bg-gray-200 rounded"></div>
      </div>
    )
  }

  return (
    <DataApiErrorBoundary projectRef={projectRef}>
      <MemoizedPostgrestConfig />
    </DataApiErrorBoundary>
  )
}

// Export with display name for debugging
OptimizedPostgrestConfig.displayName = 'OptimizedPostgrestConfig'