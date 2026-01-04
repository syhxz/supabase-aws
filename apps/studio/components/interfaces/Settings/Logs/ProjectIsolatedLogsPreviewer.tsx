import { useParams } from 'common'
import { LogsPreviewer } from './LogsPreviewer'
import { LogsTableName } from './Logs.constants'
import type { Filters, QueryType } from './Logs.types'
import { useLogData } from '../../../../hooks/analytics/useLogData'
import { Card, Alert_Shadcn_, AlertDescription_Shadcn_, AlertTitle_Shadcn_ } from 'ui'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { PropsWithChildren } from 'react'

/**
 * Project-isolated logs previewer that ensures logs are filtered by current project
 * Requirements: 2.5, 2.6
 */
interface ProjectIsolatedLogsPreviewerProps {
  queryType: QueryType
  filterOverride?: Filters
  condensedLayout?: boolean
  tableName?: LogsTableName
  EmptyState?: React.ReactNode
  filterPanelClassName?: string
}

export const ProjectIsolatedLogsPreviewer = ({
  queryType,
  filterOverride,
  condensedLayout = false,
  tableName,
  children,
  EmptyState,
  filterPanelClassName,
}: PropsWithChildren<ProjectIsolatedLogsPreviewerProps>) => {
  const { ref: projectRef } = useParams()

  // Fetch project-specific log data
  const { 
    data: logResponse, 
    isLoading: isLogDataLoading, 
    error: logError, 
    refetch: refetchLogData 
  } = useLogData({
    limit: 100
  })

  if (!projectRef) {
    return (
      <Alert_Shadcn_ variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle_Shadcn_>Project Context Required</AlertTitle_Shadcn_>
        <AlertDescription_Shadcn_>
          Unable to load logs without project context. Please ensure you are viewing this page within a project.
        </AlertDescription_Shadcn_>
      </Alert_Shadcn_>
    )
  }

  const logData = logResponse?.data || []

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Project-specific log data display */}
      {logData.length > 0 && (
        <Card className="p-4 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium">Project Log Data</h4>
            <button
              onClick={() => refetchLogData()}
              disabled={isLogDataLoading}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <RefreshCw className={`h-4 w-4 ${isLogDataLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {logData.slice(0, 20).map((log) => (
              <div 
                key={log.id} 
                className={`p-2 rounded text-sm border-l-4 ${
                  log.log_level === 'error' 
                    ? 'border-red-500 bg-red-50' 
                    : log.log_level === 'warn'
                    ? 'border-yellow-500 bg-yellow-50'
                    : log.log_level === 'info'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-500 bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-1 text-xs rounded font-mono ${
                        log.log_level === 'error' 
                          ? 'bg-red-100 text-red-800' 
                          : log.log_level === 'warn'
                          ? 'bg-yellow-100 text-yellow-800'
                          : log.log_level === 'info'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {log.log_level.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-gray-700 font-mono text-xs">
                      {log.message}
                    </p>
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <details className="mt-1">
                        <summary className="text-xs text-gray-500 cursor-pointer">
                          Metadata
                        </summary>
                        <pre className="text-xs text-gray-600 mt-1 bg-gray-100 p-1 rounded">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 ml-4">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Error state for project log data */}
      {logError && (
        <Alert_Shadcn_ variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle_Shadcn_>Error Loading Project Log Data</AlertTitle_Shadcn_>
          <AlertDescription_Shadcn_>
            {logError.message || 'Failed to load log data for this project'}
          </AlertDescription_Shadcn_>
        </Alert_Shadcn_>
      )}

      {/* Standard logs previewer with project isolation */}
      <LogsPreviewer
        projectRef={projectRef}
        queryType={queryType}
        filterOverride={filterOverride}
        condensedLayout={condensedLayout}
        tableName={tableName}
        EmptyState={EmptyState}
        filterPanelClassName={filterPanelClassName}
      >
        {children}
      </LogsPreviewer>
    </div>
  )
}