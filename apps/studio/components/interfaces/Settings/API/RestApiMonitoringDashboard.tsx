import { memo, useState, useEffect, useCallback } from 'react'
import { useParams } from 'common'
import { 
  Card, 
  CardContent, 
  CardHeader,
  Badge,
  Button,
  Alert_Shadcn_,
  AlertTitle_Shadcn_,
  AlertDescription_Shadcn_
} from 'ui'
import { 
  Activity, 
  Clock, 
  Database, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  RefreshCw,
  BarChart3,
  Zap,
  Server
} from 'lucide-react'
import { useSupabaseRestContainerHealthQuery } from 'data/monitoring/supabase-rest-container-health-query'
import { useSupabaseRestContainerMetricsQuery } from 'data/monitoring/supabase-rest-container-metrics-query'
import { formatDistanceToNow } from 'date-fns'

interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  status?: 'good' | 'warning' | 'error' | 'neutral'
  trend?: 'up' | 'down' | 'stable'
  loading?: boolean
}

const MetricCard = memo(({ title, value, subtitle, icon: Icon, status = 'neutral', trend, loading }: MetricCardProps) => {
  const getStatusColor = () => {
    switch (status) {
      case 'good': return 'text-green-600'
      case 'warning': return 'text-yellow-600'
      case 'error': return 'text-red-600'
      default: return 'text-muted-foreground'
    }
  }

  const getTrendIcon = () => {
    if (!trend) return null
    switch (trend) {
      case 'up': return <TrendingUp size={12} className="text-green-500" />
      case 'down': return <TrendingUp size={12} className="text-red-500 rotate-180" />
      case 'stable': return <div className="w-3 h-0.5 bg-gray-400 rounded" />
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="animate-pulse">
            <div className="flex items-center justify-between mb-2">
              <div className="h-4 bg-gray-200 rounded w-20"></div>
              <div className="h-4 w-4 bg-gray-200 rounded"></div>
            </div>
            <div className="h-8 bg-gray-200 rounded w-16 mb-1"></div>
            <div className="h-3 bg-gray-200 rounded w-24"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
          <Icon size={16} className={getStatusColor()} />
        </div>
        <div className="flex items-end gap-2">
          <span className="text-2xl font-bold">{value}</span>
          {getTrendIcon()}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  )
})

MetricCard.displayName = 'MetricCard'

export const RestApiMonitoringDashboard = memo(() => {
  const { ref: projectRef } = useParams()
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshInterval, setRefreshInterval] = useState(30000) // 30 seconds

  const {
    data: healthData,
    isLoading: isLoadingHealth,
    isError: isHealthError,
    error: healthError,
    refetch: refetchHealth
  } = useSupabaseRestContainerHealthQuery({ 
    projectRef,
    refetchInterval: autoRefresh ? refreshInterval : false
  })

  const {
    data: metricsData,
    isLoading: isLoadingMetrics,
    isError: isMetricsError,
    error: metricsError,
    refetch: refetchMetrics
  } = useSupabaseRestContainerMetricsQuery({ 
    projectRef,
    refetchInterval: autoRefresh ? refreshInterval : false
  })

  const handleRefresh = useCallback(() => {
    refetchHealth()
    refetchMetrics()
  }, [refetchHealth, refetchMetrics])

  const getHealthStatus = () => {
    if (isLoadingHealth) return 'loading'
    if (isHealthError || !healthData) return 'error'
    return healthData.healthy ? 'good' : 'error'
  }

  const getHealthStatusText = () => {
    const status = getHealthStatus()
    switch (status) {
      case 'loading': return 'Checking...'
      case 'good': return 'Healthy'
      case 'error': return 'Unhealthy'
      default: return 'Unknown'
    }
  }

  const formatResponseTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`
  }

  const formatMemoryUsage = (bytes: number) => {
    const mb = bytes / (1024 * 1024)
    if (mb < 1024) return `${mb.toFixed(1)}MB`
    return `${(mb / 1024).toFixed(1)}GB`
  }

  const getResponseTimeStatus = (ms: number): 'good' | 'warning' | 'error' => {
    if (ms < 100) return 'good'
    if (ms < 500) return 'warning'
    return 'error'
  }

  const getErrorRateStatus = (rate: number): 'good' | 'warning' | 'error' => {
    if (rate < 1) return 'good'
    if (rate < 5) return 'warning'
    return 'error'
  }

  const isLoading = isLoadingHealth || isLoadingMetrics
  const hasError = isHealthError || isMetricsError

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity size={20} />
            <div>
              <h3 className="text-lg font-medium">REST API Monitoring</h3>
              <p className="text-sm text-muted-foreground">
                Real-time performance metrics for your enhanced PostgREST container
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Auto-refresh:</span>
              <Button
                variant={autoRefresh ? "default" : "outline"}
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                {autoRefresh ? 'On' : 'Off'}
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              Refresh
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Error States */}
      {hasError && (
        <Alert_Shadcn_ variant="destructive">
          <AlertTriangle size={16} />
          <AlertTitle_Shadcn_>Monitoring Error</AlertTitle_Shadcn_>
          <AlertDescription_Shadcn_>
            {healthError?.message || metricsError?.message || 'Failed to load monitoring data'}
          </AlertDescription_Shadcn_>
        </Alert_Shadcn_>
      )}

      {/* Health Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Container Health</h4>
            <div className="flex items-center gap-2">
              {getHealthStatus() === 'good' && <CheckCircle size={16} className="text-green-600" />}
              {getHealthStatus() === 'error' && <XCircle size={16} className="text-red-600" />}
              <Badge variant={getHealthStatus() === 'good' ? 'default' : 'destructive'}>
                {getHealthStatusText()}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {healthData && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Status:</span>
                <div className="font-medium">{healthData.status}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Response Time:</span>
                <div className="font-medium">{formatResponseTime(healthData.responseTime)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Last Check:</span>
                <div className="font-medium">
                  {formatDistanceToNow(new Date(healthData.timestamp), { addSuffix: true })}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Avg Response Time"
          value={metricsData ? formatResponseTime(metricsData.metrics.averageResponseTime) : '-'}
          subtitle="Last 5 minutes"
          icon={Clock}
          status={metricsData ? getResponseTimeStatus(metricsData.metrics.averageResponseTime) : 'neutral'}
          loading={isLoadingMetrics}
        />
        
        <MetricCard
          title="Active Connections"
          value={metricsData?.metrics.activeConnections ?? '-'}
          subtitle="Current connections"
          icon={Database}
          status={metricsData && metricsData.metrics.activeConnections > 80 ? 'warning' : 'good'}
          loading={isLoadingMetrics}
        />
        
        <MetricCard
          title="Error Rate"
          value={metricsData ? formatPercentage(metricsData.metrics.errorRate) : '-'}
          subtitle="Last hour"
          icon={AlertTriangle}
          status={metricsData ? getErrorRateStatus(metricsData.metrics.errorRate) : 'neutral'}
          loading={isLoadingMetrics}
        />
        
        <MetricCard
          title="Cache Hit Rate"
          value={metricsData ? formatPercentage(metricsData.metrics.cacheHitRate) : '-'}
          subtitle="Cache efficiency"
          icon={Zap}
          status={metricsData && metricsData.metrics.cacheHitRate > 80 ? 'good' : 'warning'}
          loading={isLoadingMetrics}
        />
      </div>

      {/* System Resources */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="Memory Usage"
          value={metricsData ? formatMemoryUsage(metricsData.metrics.memoryUsage) : '-'}
          subtitle="Container memory"
          icon={Server}
          status={metricsData && metricsData.metrics.memoryUsage > 0.8 ? 'warning' : 'good'}
          loading={isLoadingMetrics}
        />
        
        <MetricCard
          title="CPU Usage"
          value={metricsData ? formatPercentage(metricsData.metrics.cpuUsage) : '-'}
          subtitle="Container CPU"
          icon={BarChart3}
          status={metricsData && metricsData.metrics.cpuUsage > 80 ? 'warning' : 'good'}
          loading={isLoadingMetrics}
        />
        
        <MetricCard
          title="Total Queries"
          value={metricsData?.metrics.totalQueries ?? '-'}
          subtitle="Since container start"
          icon={Activity}
          status="neutral"
          loading={isLoadingMetrics}
        />
      </div>

      {/* Query Statistics */}
      {metricsData?.queryStats && Object.keys(metricsData.queryStats).length > 0 && (
        <Card>
          <CardHeader>
            <h4 className="font-medium">Query Statistics</h4>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              {Object.entries(metricsData.queryStats).map(([key, value]) => (
                <div key={key}>
                  <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span>
                  <div className="font-medium">{String(value)}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Statistics */}
      {metricsData?.errorStats && Object.keys(metricsData.errorStats).length > 0 && (
        <Card>
          <CardHeader>
            <h4 className="font-medium">Error Statistics</h4>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              {Object.entries(metricsData.errorStats).map(([key, value]) => (
                <div key={key}>
                  <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span>
                  <div className="font-medium">{String(value)}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Information Panel */}
      <Card>
        <CardContent className="p-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              <strong>Monitoring Information:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Metrics are updated every {refreshInterval / 1000} seconds when auto-refresh is enabled</li>
              <li>Response times are averaged over the last 5 minutes</li>
              <li>Error rates are calculated over the last hour</li>
              <li>Memory and CPU usage reflect current container resource consumption</li>
              <li>Cache hit rate shows the effectiveness of response caching when enabled</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
})

RestApiMonitoringDashboard.displayName = 'RestApiMonitoringDashboard'