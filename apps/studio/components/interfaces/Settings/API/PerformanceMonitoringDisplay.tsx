import { useDataApiPerformanceMonitoring } from 'hooks/useDataApiPerformanceMonitoring'
import { Card, CardContent, CardHeader } from 'ui'
import { Activity, Clock, CheckCircle, XCircle } from 'lucide-react'

interface PerformanceMonitoringDisplayProps {
  projectRef?: string
  showInProduction?: boolean
}

export const PerformanceMonitoringDisplay = ({ 
  projectRef, 
  showInProduction = false 
}: PerformanceMonitoringDisplayProps) => {
  const { getPerformanceSummary, isEnabled } = useDataApiPerformanceMonitoring()

  // Only show in development or when explicitly enabled
  if (!isEnabled || (process.env.NODE_ENV === 'production' && !showInProduction)) {
    return null
  }

  const summary = getPerformanceSummary()

  return (
    <Card className="mt-4 border-dashed border-gray-300">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
          <Activity size={16} />
          Performance Monitoring
          {projectRef && <span className="text-xs text-gray-400">({projectRef})</span>}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-blue-500" />
            <div>
              <div className="font-medium">Avg Response</div>
              <div className="text-gray-600">
                {summary.averageResponseTime > 0 
                  ? `${summary.averageResponseTime.toFixed(0)}ms`
                  : 'N/A'
                }
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <CheckCircle size={14} className="text-green-500" />
            <div>
              <div className="font-medium">Success Rate</div>
              <div className="text-gray-600">
                {summary.totalOperations > 0 
                  ? `${summary.successRate.toFixed(1)}%`
                  : 'N/A'
                }
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <XCircle size={14} className="text-red-500" />
            <div>
              <div className="font-medium">Errors</div>
              <div className="text-gray-600">{summary.errorCount}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Activity size={14} className={summary.isPerformant ? 'text-green-500' : 'text-yellow-500'} />
            <div>
              <div className="font-medium">Status</div>
              <div className="text-gray-600">
                {summary.isPerformant ? 'Good' : 'Slow'}
              </div>
            </div>
          </div>
        </div>

        {summary.lastOperationDuration && (
          <div className="mt-2 text-xs text-gray-500">
            Last operation: {summary.lastOperationDuration.toFixed(0)}ms
          </div>
        )}

        {summary.hasErrors && (
          <div className="mt-2 text-xs text-red-600">
            ⚠️ Performance issues detected. Check network connection and server status.
          </div>
        )}
      </CardContent>
    </Card>
  )
}